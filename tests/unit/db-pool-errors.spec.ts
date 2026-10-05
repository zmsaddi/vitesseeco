/**
 * A dropped database connection must fail the request, never the process.
 *
 * 2026-08-29: Neon refused every connection with its compute-quota error. The
 * transaction pool emitted 'error' with no listener attached — in Node that is
 * an uncaught exception, so the function died before answering and Vercel
 * reported a 504 timeout. The real error was invisible for hours, and every
 * order failed with it.
 *
 * Reproduced here without Neon: a local WebSocket stands in for Neon's proxy
 * and answers the Postgres startup with the quota error, then hangs up — what
 * the proxy did that day.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { WebSocketServer } from 'ws'
import type { AddressInfo } from 'node:net'
import { neonConfig } from '@neondatabase/serverless'
import { withTransaction } from '../../server/db/client'
import { sql } from 'drizzle-orm'

const QUOTA = 'Your account or project has exceeded the compute time quota. Upgrade your plan to increase limits.'

/** A Postgres ErrorResponse frame: 'E', length, fields, terminator. */
function errorResponse(message: string): Buffer {
  const fields = Buffer.concat([
    Buffer.from('SFATAL\0', 'utf8'),
    Buffer.from('C53300\0', 'utf8'),
    Buffer.from(`M${message}\0`, 'utf8'),
    Buffer.from('\0', 'utf8'),
  ])
  const header = Buffer.alloc(5)
  header.write('E', 0, 'latin1')
  header.writeUInt32BE(fields.length + 4, 1)
  return Buffer.concat([header, fields])
}

/** Minimal backend frames: AuthenticationOk and ReadyForQuery (idle). */
const AUTH_OK = Buffer.from([0x52, 0, 0, 0, 8, 0, 0, 0, 0])
const READY = Buffer.from([0x5a, 0, 0, 0, 5, 0x49])
const READY_IN_TX = Buffer.from([0x5a, 0, 0, 0, 5, 0x54])

function frame(type: string, body: Buffer): Buffer {
  const header = Buffer.alloc(5)
  header.write(type, 0, 'latin1')
  header.writeUInt32BE(body.length + 4, 1)
  return Buffer.concat([header, body])
}
const complete = (tag: string) => frame('C', Buffer.from(`${tag}\0`, 'latin1'))
/** RowDescription + one DataRow for `select 1 as one` (int4, text format). */
function oneRow(): Buffer {
  const name = Buffer.from('one\0', 'latin1')
  const meta = Buffer.alloc(18)
  meta.writeUInt32BE(0, 0) // table oid
  meta.writeUInt16BE(0, 4) // column attr
  meta.writeUInt32BE(23, 6) // int4
  meta.writeInt16BE(4, 10) // size
  meta.writeInt32BE(-1, 12) // modifier
  meta.writeUInt16BE(0, 16) // text
  const description = frame('T', Buffer.concat([Buffer.from([0, 1]), name, meta]))
  const value = Buffer.from('1', 'latin1')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(value.length)
  const row = frame('D', Buffer.concat([Buffer.from([0, 1]), length, value]))
  return Buffer.concat([description, row])
}

type Mode = 'quota-at-startup' | 'reset-at-connect' | 'drop-mid-transaction' | 'drop-after-begin' | 'healthy'
const statements: string[] = []
let mode: Mode = 'quota-at-startup'

let server: WebSocketServer
const saved = { ...neonConfig } as Record<string, unknown>
const savedUrl = process.env.DATABASE_URL

beforeAll(async () => {
  server = new WebSocketServer({ port: 0, host: '127.0.0.1' })
  server.on('connection', (socket) => {
    if (mode === 'reset-at-connect') {
      // No answer at all: the socket dies under the client mid-handshake.
      socket.terminate()
      return
    }
    let first = true
    socket.on('message', function () {
      if (mode === 'quota-at-startup') {
        // Whatever the client sends first (startup), answer with the quota
        // wall and drop the connection — no ReadyForQuery, ever.
        socket.send(errorResponse(QUOTA))
        setTimeout(() => socket.terminate(), 5)
        return
      }
      if (first) {
        first = false
        socket.send(Buffer.concat([AUTH_OK, READY]))
        return
      }
      const text = String(arguments[0]).replace(/^Q.{4}/s, '').replace(/\0$/, '').trim()
      statements.push(text)
      // drop-mid-transaction: vanish on BEGIN — compute suspended, or the
      // quota wall hit, as the transaction opens.
      if (mode === 'drop-mid-transaction') return void socket.terminate()
      if (/^begin/i.test(text)) return void socket.send(Buffer.concat([complete('BEGIN'), READY_IN_TX]))
      // drop-after-begin: the session is inside a transaction when it dies.
      if (mode === 'drop-after-begin') return void socket.terminate()
      if (/^select/i.test(text)) return void socket.send(Buffer.concat([oneRow(), complete('SELECT 1'), READY_IN_TX]))
      if (/^commit/i.test(text)) return void socket.send(Buffer.concat([complete('COMMIT'), READY]))
      if (/^rollback/i.test(text)) return void socket.send(Buffer.concat([complete('ROLLBACK'), READY]))
      socket.terminate()
    })
  })
  await new Promise<void>((resolve) => server.once('listening', () => resolve()))
  const { port } = server.address() as AddressInfo
  neonConfig.wsProxy = () => `127.0.0.1:${port}/v2`
  neonConfig.useSecureWebSocket = false
  neonConfig.pipelineTLS = false
  neonConfig.pipelineConnect = false
  neonConfig.forceDisablePgSSL = true
  // The hostname is what routes withTransaction onto the Neon pool driver.
  process.env.DATABASE_URL = 'postgresql://shop:secret@ep-quiet-rig-000000.eu-central-1.aws.neon.tech/neondb'
})

afterAll(async () => {
  Object.assign(neonConfig, saved)
  if (savedUrl === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = savedUrl
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

describe.each([
  ['quota-at-startup', /compute time quota/],
  ['reset-at-connect', /./],
  ['drop-mid-transaction', /./],
  ['drop-after-begin', /./],
] as const)('withTransaction when Neon %s', (scenario, expected) => {
  it('rejects the request and leaves the process standing', async () => {
    mode = scenario
    const uncaught: unknown[] = []
    const onUncaught = (error: unknown) => uncaught.push(error)
    process.on('uncaughtException', onUncaught)
    try {
      const attempt = withTransaction(async (tx) => tx.execute(sql`select 1`))
      await expect(attempt).rejects.toThrow(expected)
      // Late socket events land after the rejection; give them their chance.
      await new Promise((resolve) => setTimeout(resolve, 300))
      expect(uncaught.map(String)).toEqual([])
    } finally {
      process.off('uncaughtException', onUncaught)
    }
  })
})

describe('withTransaction through the Neon pool when nothing goes wrong', () => {
  it('commits, returns the rows, and lets the pool close', async () => {
    mode = 'healthy'
    statements.length = 0
    const result = await withTransaction(async (tx) => tx.execute(sql`select 1 as one`))
    expect((result as unknown as { rows: Array<{ one: number }> }).rows).toEqual([{ one: 1 }])
    expect(statements.map((statement) => statement.split(/\s/)[0]!.toLowerCase())).toEqual(['begin', 'select', 'commit'])
  })
})
