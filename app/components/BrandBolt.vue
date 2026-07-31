<script setup lang="ts">
/**
 * The electric spark that replaces the space in "Vitesse Eco".
 *
 * Gradient stops read the CSS tokens (--spark-from/--spark-to) so no raw hex
 * lives in a component and the invariant gate stays honest. The 6° shear and
 * the twin-blade path are the brand's own drawing — never substitute an emoji
 * or an icon-font bolt.
 */
</script>

<template>
  <svg viewBox="-10 -4 76 126" aria-hidden="true" class="inline-block">
    <defs>
      <linearGradient id="vs-spark" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" style="stop-color: rgb(var(--spark-from))" />
        <stop offset="1" style="stop-color: rgb(var(--spark-to))" />
      </linearGradient>
    </defs>
    <path
      d="M34 0 L0 62 h20 L8 118 56 44 H34 L52 0 Z"
      fill="url(#vs-spark)"
      transform="skewX(-6)"
      transform-origin="28 59"
    />
  </svg>
</template>
