/**
 * Upload 6 professional blog articles to Sanity CMS
 * With images from Unsplash (free license)
 */
import { createClient } from '@sanity/client'
import { article1, article2 } from './articles-data-1.mjs'
import { article3, article4, article5, article6 } from './articles-data-2.mjs'

const client = createClient({
  projectId: '2jvnjf0c',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  token: process.env.SANITY_TOKEN,
})

async function uploadImage(url, filename) {
  console.log(`  📸 Uploading: ${filename}...`)
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    const asset = await client.assets.upload('image', buffer, { filename })
    console.log(`  ✅ Image uploaded: ${asset._id}`)
    return { _type: 'image', asset: { _type: 'reference', _ref: asset._id } }
  } catch (e) {
    console.error(`  ❌ Failed: ${e.message}`)
    return null
  }
}

const articles = [article1, article2, article3, article4, article5, article6]

async function main() {
  console.log(`🚀 Uploading ${articles.length} professional articles to Sanity...\n`)

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i]
    const wordCount = a.content.fr.split(/\s+/).length
    console.log(`📝 Article ${i + 1}/${articles.length}: "${a.title.fr.slice(0, 55)}..."`)
    console.log(`   Words (FR): ${wordCount}`)

    const image = await uploadImage(a.imageUrl, `blog-${a.slug}.jpg`)

    const doc = {
      _type: 'article',
      title: a.title,
      slug: { _type: 'slug', current: a.slug },
      excerpt: a.excerpt,
      content: a.content,
      author: a.author,
      publishedAt: new Date(Date.now() - i * 5 * 24 * 60 * 60 * 1000).toISOString(),
      isPublished: true,
      seo: {
        _type: 'seoFields',
        title: a.title.fr.slice(0, 60),
        description: a.excerpt.fr.slice(0, 160),
      },
    }

    if (image) doc.featuredImage = image

    await client.create(doc)
    console.log(`   ✅ Published: /blog/${a.slug}\n`)
  }

  console.log('🎉 All articles uploaded successfully!')
}

main().catch(console.error)
