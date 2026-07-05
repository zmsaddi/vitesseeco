/**
 * Admin contact messages — read from Sanity (contactMessage documents).
 * Uses the write token so the panel works even if the dataset goes private.
 */
import { createClient } from '@sanity/client'
import { rateLimit } from '~/server/utils/rateLimit'
import { requireAdmin } from '~/server/utils/adminAuth'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 60, windowMs: 60_000 })
  await requireAdmin(event)

  const client = createClient({
    projectId: '2jvnjf0c',
    dataset: 'production',
    token: process.env.SANITY_TOKEN,
    apiVersion: '2024-01-01',
    useCdn: false,
  })

  interface ContactMessage {
    _id: string
    name: string | null
    email: string | null
    subject: string | null
    message: string | null
    isRead: boolean | null
    reply: string | null
    createdAt: string | null
  }

  const [messages, unread] = await Promise.all([
    client.fetch<ContactMessage[]>(
      `*[_type == "contactMessage"] | order(coalesce(createdAt, _createdAt) desc)[0...100]{
        _id, name, email, subject, message, isRead, reply,
        "createdAt": coalesce(createdAt, _createdAt)
      }`
    ),
    client.fetch<number>(`count(*[_type == "contactMessage" && isRead != true])`),
  ])

  return { messages, unread: Number(unread), total: messages.length }
})
