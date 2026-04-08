<template>
  <div ref="container" class="cf-turnstile" />
</template>

<script setup lang="ts">
const emit = defineEmits<{ 'verify': [token: string] }>()
const container = ref<HTMLElement>()
const config = useRuntimeConfig()

const siteKey = String(config.public.turnstileSiteKey || '0x4AAAAAAC2BKiJdmw--5jl9').trim()

onMounted(() => {
  // Load Turnstile script
  if (!document.querySelector('script[src*="turnstile"]')) {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad'
    script.async = true
    document.head.appendChild(script)
  }

  const render = () => {
    if (container.value && (window as any).turnstile) {
      (window as any).turnstile.render(container.value, {
        sitekey: siteKey,
        theme: 'dark',
        callback: (token: string) => emit('verify', token),
      })
    }
  }

  // If already loaded
  if ((window as any).turnstile) {
    render()
  } else {
    (window as any).onTurnstileLoad = render
  }
})
</script>
