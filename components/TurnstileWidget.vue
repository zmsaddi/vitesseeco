<template>
  <div ref="container" />
</template>

<script setup lang="ts">
const emit = defineEmits<{ 'verify': [token: string] }>()
const container = ref<HTMLElement>()
let widgetId: string | null = null

const SITE_KEY = '0x4AAAAAAC2BKiJdmw--5jl9'

function renderWidget() {
  if (!container.value || !(window as any).turnstile || widgetId !== null) return

  widgetId = (window as any).turnstile.render(container.value, {
    sitekey: SITE_KEY,
    theme: 'dark',
    callback: (token: string) => emit('verify', token),
  })
}

onMounted(() => {
  if ((window as any).turnstile) {
    renderWidget()
    return
  }

  if (!document.querySelector('script[src*="challenges.cloudflare.com"]')) {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = () => renderWidget()
    document.head.appendChild(script)
  } else {
    // Script loading, wait for it
    const check = setInterval(() => {
      if ((window as any).turnstile) {
        clearInterval(check)
        renderWidget()
      }
    }, 100)
  }
})

onUnmounted(() => {
  if (widgetId !== null && (window as any).turnstile) {
    try { (window as any).turnstile.remove(widgetId) } catch {}
    widgetId = null
  }
})
</script>
