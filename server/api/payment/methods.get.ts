import { createClient } from '@sanity/client'

export default defineEventHandler(async () => {
  const client = createClient({
    projectId: '2jvnjf0c',
    dataset: 'production',
    apiVersion: '2024-01-01',
    useCdn: true,
  })

  const methods = await client.fetch(
    `*[_type == "paymentMethod" && isActive == true] | order(sortOrder asc) {
      code, name, description, icon, instructions
    }`
  )

  return { methods }
})
