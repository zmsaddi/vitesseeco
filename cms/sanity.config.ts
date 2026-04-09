import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
// @ts-ignore — @sanity/vision may not be installed as a direct dependency
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './schemas'
import { deskStructure } from './structure/deskStructure'

export default defineConfig({
  name: 'vitesseeco',
  title: 'Vitesse Eco — لوحة التحكم',
  projectId: '2jvnjf0c',
  dataset: 'production',
  plugins: [
    structureTool({
      structure: deskStructure,
    }),
    visionTool(),
  ],
  schema: {
    types: schemaTypes,
  },
})
