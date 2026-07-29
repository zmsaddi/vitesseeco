/**
 * Migrations run once, before any integration file opens.
 *
 * Running them per-file raced: two suites issued `CREATE TYPE` at the same
 * moment and the loser failed. Doing it here also means a suite never has to
 * decide whether the schema is its responsibility.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

export default async function globalSetup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL
  // Unit runs have no database and need none.
  if (!url) return

  const migrationsDir = join(process.cwd(), 'server', 'db', 'migrations')
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()

  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    // A clean slate each run: the schema under test is the one in the
    // repository, not whatever a previous run happened to leave behind.
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')

    for (const file of files) {
      const contents = readFileSync(join(migrationsDir, file), 'utf8')
      for (const statement of contents.split('--> statement-breakpoint')) {
        const trimmed = statement.trim()
        if (trimmed) await client.query(trimmed)
      }
    }
  } finally {
    await client.end()
  }
}
