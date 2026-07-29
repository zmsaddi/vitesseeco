<template>
  <div>
    <!-- Launcher -->
    <button
      v-if="!open"
      type="button"
      class="fixed bottom-5 end-5 z-modal w-touch h-touch min-w-14 min-h-14 rounded-full bg-accent text-primary shadow-lg flex items-center justify-center hover:scale-105 transition-transform duration-200"
      :aria-label="$t('chat.open')"
      @click="openChat"
    >
      <Icon name="heroicons:chat-bubble-left-right-solid" class="w-7 h-7" />
    </button>

    <!-- Panel -->
    <div
      v-if="open"
      class="fixed inset-x-0 bottom-0 sm:inset-x-auto sm:end-5 sm:bottom-5 z-modal w-full sm:w-96 h-[75dvh] sm:h-[540px] bg-surface border border-surface-2 sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
      role="dialog"
      :aria-label="$t('chat.title')"
    >
      <!-- Header -->
      <header class="flex items-center gap-3 px-4 py-3 bg-primary border-b border-surface-2 shrink-0">
        <span class="relative flex w-2.5 h-2.5">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />
          <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" />
        </span>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-sm">{{ $t('chat.title') }}</div>
          <div class="text-xs text-on-surface-muted">{{ $t('chat.subtitle') }}</div>
        </div>
        <a
          :href="whatsappUrl"
          target="_blank"
          rel="noopener"
          class="p-2 rounded-lg text-accent hover:bg-surface-2"
          :aria-label="$t('chat.whatsapp')"
        >
          <WhatsAppIcon class="w-5 h-5" />
        </a>
        <button type="button" class="p-2 rounded-lg text-on-surface-muted hover:bg-surface-2" :aria-label="$t('nav.close_menu')" @click="open = false">
          <Icon name="heroicons:x-mark" class="w-5 h-5" />
        </button>
      </header>

      <!-- Messages -->
      <div ref="scroller" class="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        <div v-for="(m, i) in messages" :key="i" class="flex" :class="m.from === 'user' ? 'justify-end' : 'justify-start'">
          <div
            class="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap"
            :class="m.from === 'user' ? 'bg-accent/15 text-on-surface rounded-ee-md' : 'bg-surface-2 rounded-es-md'"
          >
            <p v-if="m.text">{{ m.text }}</p>
            <ul v-if="m.products?.length" class="space-y-1.5" :class="m.text ? 'mt-2' : ''">
              <li v-for="p in m.products" :key="p.slug">
                <NuxtLink :to="localePath(`/produits/${p.slug}`)" class="text-accent underline underline-offset-2" @click="open = false">
                  {{ p.name }}<template v-if="p.price"> — {{ formatPrice(p.price) }}</template>
                </NuxtLink>
              </li>
            </ul>
            <div v-if="m.actions" class="flex flex-wrap gap-2 mt-2">
              <a
                v-if="m.actions.includes('whatsapp')"
                :href="whatsappUrl"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-1.5 rounded-lg bg-accent text-primary px-3 py-2 text-xs font-semibold"
              >
                <WhatsAppIcon class="w-4 h-4" />
                WhatsApp
              </a>
              <NuxtLink
                v-if="m.actions.includes('contact')"
                :to="localePath('/contact')"
                class="inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-2 text-xs font-semibold border border-surface-2"
                @click="open = false"
              >
                <Icon name="heroicons:envelope" class="w-4 h-4" />
                {{ $t('nav.contact') }}
              </NuxtLink>
            </div>
          </div>
        </div>

        <div v-if="busy" class="flex justify-start">
          <div class="bg-surface-2 rounded-2xl rounded-es-md px-4 py-3 inline-flex gap-1.5" :aria-label="$t('chat.typing')">
            <span v-for="d in 3" :key="d" class="w-1.5 h-1.5 rounded-full bg-on-surface-muted animate-bounce" :style="{ animationDelay: `${d * 120}ms` }" />
          </div>
        </div>

        <!-- Quick replies -->
        <div v-if="showQuickReplies && !busy" class="flex flex-wrap gap-2 pt-1">
          <button
            v-for="q in quickReplies"
            :key="q.key"
            type="button"
            class="rounded-full border border-accent/40 text-accent px-3 py-1.5 text-xs hover:bg-accent/10 transition-colors duration-200"
            @click="q.run()"
          >
            {{ $t(q.key) }}
          </button>
        </div>
      </div>

      <!-- Input -->
      <form class="flex items-center gap-2 p-3 border-t border-surface-2 shrink-0" @submit.prevent="submit">
        <input
          ref="inputEl"
          v-model="draft"
          type="text"
          maxlength="500"
          :placeholder="$t('chat.placeholder')"
          class="flex-1 bg-bg border border-surface-2 rounded-xl px-3.5 py-2.5 text-sm placeholder:text-on-surface-muted focus:outline-none focus:border-accent"
          :aria-label="$t('chat.placeholder')"
        >
        <button
          type="submit"
          class="w-touch h-touch min-w-11 min-h-11 rounded-xl bg-accent text-primary flex items-center justify-center disabled:opacity-40"
          :disabled="!draft.trim() || busy"
          :aria-label="$t('chat.send')"
        >
          <Icon name="heroicons:paper-airplane-solid" class="w-5 h-5 rtl:-scale-x-100" />
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t, locale } = useI18n()
const localePath = useLocalePath()
const auth = useAuthStore()

const WHATSAPP_NUMBER = '33745830049'

interface ChatMessage {
  from: 'bot' | 'user'
  text: string
  products?: Array<{ name: string; slug: string; price?: number | null }>
  actions?: Array<'whatsapp' | 'contact'>
}

const open = ref(false)
const busy = ref(false)
const draft = ref('')
const messages = ref<ChatMessage[]>([])
const showQuickReplies = ref(true)
/** Order-tracking mini state machine. */
const mode = ref<'chat' | 'await_order' | 'await_email'>('chat')
const pendingOrder = ref('')

const scroller = ref<HTMLElement>()
const inputEl = ref<HTMLInputElement>()

const whatsappUrl = computed(() => {
  const text = `Bonjour Vitesse Eco 👋 (${typeof location !== 'undefined' ? location.href : 'vitesse-eco.fr'})`
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
})

const quickReplies = [
  { key: 'chat.quick_track', run: () => startTracking() },
  { key: 'chat.quick_shipping', run: () => send(t('chat.quick_shipping')) },
  { key: 'chat.quick_warranty', run: () => send(t('chat.quick_warranty')) },
  { key: 'chat.quick_human', run: () => humanHandoff() },
]

function openChat() {
  open.value = true
  if (!messages.value.length) {
    bot(t('chat.greeting'))
  }
  nextTick(() => inputEl.value?.focus())
}

function bot(text: string, extra: Partial<ChatMessage> = {}) {
  messages.value.push({ from: 'bot', text, ...extra })
  scrollDown()
}

function user(text: string) {
  messages.value.push({ from: 'user', text })
  scrollDown()
}

function scrollDown() {
  nextTick(() => scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' }))
}

function startTracking() {
  showQuickReplies.value = false
  user(t('chat.quick_track'))
  mode.value = 'await_order'
  bot(t('chat.ask_order'))
}

function humanHandoff() {
  showQuickReplies.value = false
  user(t('chat.quick_human'))
  bot(t('chat.human_msg'), { actions: ['whatsapp', 'contact'] })
}

function submit() {
  const text = draft.value.trim()
  if (!text || busy.value) return
  draft.value = ''
  showQuickReplies.value = false

  if (mode.value === 'await_order') return handleOrderNumber(text)
  if (mode.value === 'await_email') return handleOrderEmail(text)
  send(text, true)
}

function handleOrderNumber(text: string) {
  user(text)
  const num = text.toUpperCase().match(/ORD-[A-Z0-9]+/)?.[0]
  if (!num) {
    bot(t('chat.invalid_order'))
    return
  }
  pendingOrder.value = num
  if (auth.isLoggedIn) {
    mode.value = 'chat'
    trackOrder(num, '')
  } else {
    mode.value = 'await_email'
    bot(t('chat.ask_email'))
  }
}

function handleOrderEmail(text: string) {
  user(text)
  mode.value = 'chat'
  trackOrder(pendingOrder.value, text)
}

async function trackOrder(orderNumber: string, email: string) {
  busy.value = true
  try {
    const res: any = await $fetch('/api/chat/track-order', { method: 'POST', body: { orderNumber, email } })
    if (!res.found) {
      bot(t('chat.order_not_found'))
    } else {
      const statusLabel = t(`chat.status_${res.status}`)
      let text = t('chat.order_status', { number: res.orderNumber, status: statusLabel })
      text += '\n' + (res.trackingNumber ? t('chat.order_tracking', { tracking: res.trackingNumber }) : t('chat.order_no_tracking'))
      bot(text)
    }
  } catch {
    bot(t('chat.error'))
  } finally {
    busy.value = false
  }
}

async function send(text: string, fromInput = false) {
  if (!fromInput) showQuickReplies.value = false
  user(text)
  busy.value = true
  try {
    const res: any = await $fetch('/api/chat/ask', { method: 'POST', body: { message: text, locale: locale.value } })
    if (res.source === 'products' && res.products?.length) {
      bot(t('chat.fallback').split('.')[0] + ' :', { products: res.products })
    } else if (res.answer) {
      bot(res.answer)
    } else {
      bot(t('chat.fallback'), { actions: ['whatsapp', 'contact'] })
    }
  } catch {
    bot(t('chat.error'))
  } finally {
    busy.value = false
  }
}

function formatPrice(n: number) {
  // invariant-ok: the chat panel is client-only, so this never reaches SSR output
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}
</script>
