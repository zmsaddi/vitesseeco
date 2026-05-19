<template>
  <div class="space-y-2">
    <div ref="container" />

    <!-- Loading state -->
    <p
      v-if="state === 'loading'"
      class="text-text-secondary text-xs flex items-center gap-2"
      role="status"
      aria-live="polite"
    >
      <Icon name="ph:spinner-gap" class="w-3.5 h-3.5 animate-spin" />
      {{ $t('turnstile.loading') }}
    </p>

    <!-- Error state with retry -->
    <div
      v-else-if="state === 'error'"
      class="flex items-center gap-2 text-xs text-red-400"
      role="alert"
    >
      <Icon name="ph:warning-circle" class="w-3.5 h-3.5 shrink-0" />
      <span>{{ $t('turnstile.failed') }}</span>
      <button
        type="button"
        @click="retry"
        class="underline hover:text-red-300 font-medium"
      >
        {{ $t('turnstile.retry') }}
      </button>
    </div>

    <!-- Verified state (compact confirmation) -->
    <p
      v-else-if="state === 'verified'"
      class="text-accent text-xs flex items-center gap-2"
      role="status"
      aria-live="polite"
    >
      <Icon name="ph:check-circle" class="w-3.5 h-3.5" />
      {{ $t('turnstile.verified') }}
    </p>
  </div>
</template>

<script setup lang="ts">
type TurnstileState = 'loading' | 'verified' | 'error' | 'expired'

const emit = defineEmits<{
  verify: [token: string]
  expired: []
  error: []
}>()

const container = ref<HTMLElement>()
let widgetId: string | null = null
let scriptCheckInterval: ReturnType<typeof setInterval> | null = null
let scriptTimeout: ReturnType<typeof setTimeout> | null = null

const state = ref<TurnstileState>('loading')

// Read from runtimeConfig so Preview/Production can use different site keys
// (Preview uses Cloudflare's domain-agnostic test key when checked out on a
// Vercel preview URL that isn't in the production site key's allowlist).
const SITE_KEY = useRuntimeConfig().public.turnstileSiteKey as string
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const SCRIPT_LOAD_TIMEOUT_MS = 15_000

function clearScriptWatchers() {
  if (scriptCheckInterval !== null) {
    clearInterval(scriptCheckInterval)
    scriptCheckInterval = null
  }
  if (scriptTimeout !== null) {
    clearTimeout(scriptTimeout)
    scriptTimeout = null
  }
}

function renderWidget() {
  if (!container.value || !(window as any).turnstile || widgetId !== null) return

  try {
    widgetId = (window as any).turnstile.render(container.value, {
      sitekey: SITE_KEY,
      theme: 'dark',
      callback: (token: string) => {
        state.value = 'verified'
        emit('verify', token)
      },
      'error-callback': () => {
        state.value = 'error'
        emit('error')
      },
      'expired-callback': () => {
        state.value = 'expired'
        emit('expired')
        // Auto-prompt re-render so the user is not stuck
        retry()
      },
      'timeout-callback': () => {
        state.value = 'error'
        emit('error')
      },
    })
  } catch (_err) {
    state.value = 'error'
    emit('error')
  }
}

function loadScript() {
  state.value = 'loading'

  if ((window as any).turnstile) {
    renderWidget()
    return
  }

  if (!document.querySelector(`script[src*="challenges.cloudflare.com"]`)) {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => renderWidget()
    script.onerror = () => {
      state.value = 'error'
      emit('error')
    }
    document.head.appendChild(script)
  }

  // Poll for readiness up to SCRIPT_LOAD_TIMEOUT_MS, then fail clearly
  scriptCheckInterval = setInterval(() => {
    if ((window as any).turnstile) {
      clearScriptWatchers()
      renderWidget()
    }
  }, 100)

  scriptTimeout = setTimeout(() => {
    clearScriptWatchers()
    if (widgetId === null) {
      state.value = 'error'
      emit('error')
    }
  }, SCRIPT_LOAD_TIMEOUT_MS)
}

function retry() {
  // Reset widget if present, then try fresh
  if (widgetId !== null && (window as any).turnstile) {
    try { (window as any).turnstile.remove(widgetId) } catch { /* ignore */ }
    widgetId = null
  }
  clearScriptWatchers()
  loadScript()
}

onMounted(() => {
  loadScript()
})

onUnmounted(() => {
  clearScriptWatchers()
  if (widgetId !== null && (window as any).turnstile) {
    try { (window as any).turnstile.remove(widgetId) } catch { /* ignore */ }
    widgetId = null
  }
})

defineExpose({ retry, state })
</script>
