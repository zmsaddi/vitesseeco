import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  // Refuse to generate a destructive change silently — a dropped column should
  // be a decision, not a side effect of editing the schema file.
  strict: true,
  verbose: true,
})
