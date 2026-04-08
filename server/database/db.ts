import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle> | null = null

export function useDB() {
  if (!_db) {
    const url = process.env.DATABASE_URL || useRuntimeConfig().databaseUrl
    if (!url) throw new Error('DATABASE_URL not set')
    const sql = neon(url)
    _db = drizzle(sql, { schema })
  }
  return _db
}
