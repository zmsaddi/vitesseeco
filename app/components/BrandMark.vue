<script setup lang="ts">
/**
 * The stag, inline.
 *
 * Inlined rather than an <img> so the header costs zero extra requests and the
 * mark inherits `currentColor` — one component serves the green header, a white
 * footer on dark, and anything in between. The path itself lives in
 * public/brand/stag-green.svg's siblings for use OUTSIDE the app (printers,
 * marketplaces, invoices); this component must stay visually identical to them.
 *
 * Traced with potrace from the owner's drawn original at full resolution —
 * both eyes with their brow lines, nostrils, mouth and inner-ear leaves are
 * part of the path. If a redesign ever replaces `d`, regenerate the files in
 * public/brand/ from the same source in the same commit.
 */
defineProps<{ label?: string }>()
</script>

<template>
  <svg
    viewBox="0 0 2076 2832"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
    :role="label ? 'img' : undefined"
    fill="currentColor"
  >
    <use href="/brand/stag-symbol.svg#stag" />
  </svg>
</template>
