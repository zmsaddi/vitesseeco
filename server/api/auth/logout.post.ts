import { useDB } from '~/server/database/db'
import { sessions } from '~/server/database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token')
  if (token) {
    const db = useDB()
    await db.delete(sessions).where(eq(sessions.token, token))
    deleteCookie(event, 'auth_token')
  }
  return { ok: true }
})
