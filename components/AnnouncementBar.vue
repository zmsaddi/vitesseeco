<template>
  <div
    v-if="visible"
    class="relative bg-accent text-primary text-center text-sm font-medium"
  >
    <component
      :is="link ? NuxtLink : 'div'"
      :to="link ? localePath(link) : undefined"
      class="block px-12 py-2.5"
    >
      {{ text }}
    </component>
    <button
      type="button"
      class="absolute end-1 top-1/2 -translate-y-1/2 p-2.5 opacity-70 hover:opacity-100"
      :aria-label="$t('nav.close_menu')"
      @click="dismiss"
    >
      <Icon name="ph:x" class="w-4 h-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * Sitewide announcement bar (U-P6, plan §3.3) — Sanity-driven via
 * siteSettings.announcement. Dismiss is remembered per message text in
 * sessionStorage, so a NEW message reappears even after an old dismiss.
 */
const NuxtLink = resolveComponent('NuxtLink')
const localePath = useLocalePath()
const l = useLocalizedField()

const query = groq`*[_type == "siteSettings"][0].announcement{ enabled, text, link }`
const { data } = useSanityFetch('site-announcement', query)

const dismissed = ref(false)

const text = computed(() => (data.value?.enabled ? l(data.value.text) : ''))
const link = computed(() => data.value?.link || '')
const visible = computed(() => Boolean(text.value) && !dismissed.value)

const storageKey = computed(() => `vitesse-announcement-${text.value}`)

watch(text, (val) => {
  if (!val || import.meta.server) return
  // invariant-ok: the bar is wrapped in ClientOnly in layouts/default.vue, so it
  // is never server-rendered and there is no SSR output to disagree with
  try { dismissed.value = sessionStorage.getItem(storageKey.value) === '1' } catch {}
}, { immediate: true })

function dismiss() {
  dismissed.value = true
  try { sessionStorage.setItem(storageKey.value, '1') } catch {}
}
</script>
