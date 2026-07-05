/**
 * Admin contact message update: mark read/unread, save internal reply note.
 * Writes to Sanity directly (messages live only in Sanity) + audit log.
 */
import { createClient } from '@sanity/client'
import { rateLimit } from '~/server/utils/rateLimit'
import { requireAdmin } from '~/server/utils/adminAuth'
import { audit } from '~/server/utils/audit'

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 60, windowMs: 60_000 })
  const admin = await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id || !/^[a-zA-Z0-9_.-]{1,200}$/.test(id) || id.startsWith('drafts.')) {
    throw createError({ statusCode: 400, message: 'Invalid message id' })
  }

  const body = await readBody(event)
  const patch: Record<string, unknown> = {}
  if (body.isRead !== undefined) {
    if (typeof body.isRead !== 'boolean') throw createError({ statusCode: 400, message: 'Invalid isRead' })
    patch.isRead = body.isRead
  }
  if (body.reply !== undefined) {
    if (typeof body.reply !== 'string' || body.reply.length > 2000) {
      throw createError({ statusCode: 400, message: 'Invalid reply' })
    }
    patch.reply = body.reply.trim()
  }
  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, message: 'Nothing to update' })
  }

  const token = process.env.SANITY_TOKEN
  if (!token) throw createError({ statusCode: 503, message: 'SANITY_TOKEN not configured' })

  const client = createClient({
    projectId: '2jvnjf0c',
    dataset: 'production',
    token,
    apiVersion: '2024-01-01',
    useCdn: false,
  })

  const existing = await client.fetch(`*[_type == "contactMessage" && _id == $id][0]{ _id, isRead }`, { id })
  if (!existing?._id) throw createError({ statusCode: 404, message: 'Message not found' })

  await client.patch(id).set(patch).commit()

  await audit({
    actorType: 'admin',
    actorId: admin.email,
    action: 'contact.admin_update',
    resourceType: 'contactMessage',
    resourceId: id,
    after: patch,
  })

  return { ok: true, id, ...patch }
})
