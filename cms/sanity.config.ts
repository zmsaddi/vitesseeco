import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './schemas'
import { deskStructure } from './structure/deskStructure'

export default defineConfig({
  name: 'vitesseeco',
  title: 'Vitesse Eco — CMS',
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
