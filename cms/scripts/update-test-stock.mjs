import { getCliClient } from 'sanity/cli'
const client = getCliClient({ apiVersion: '2024-01-01' })
const r = await client.patch('qreaEEKCEqJb6GObKl0HiI').set({ stock: 10 }).commit()
console.log('Sanity stock updated. _rev:', r._rev)
