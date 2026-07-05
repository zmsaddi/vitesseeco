<template>
  <div class="relative w-full" role="search">
    <div class="relative">
      <Icon name="ph:magnifying-glass" class="w-4 h-4 absolute start-3.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
      <input
        ref="inputEl"
        v-model="q"
        type="search"
        enterkeyhint="search"
        autocomplete="off"
        :placeholder="$t('search.placeholder')"
        :aria-label="$t('search.placeholder')"
        class="w-full bg-dark-secondary border border-dark-tertiary rounded-xl ps-10 pe-9 py-2.5 text-sm text-white placeholder:text-text-secondary focus:outline-none focus:border-accent transition-colors"
        @focus="open = true"
        @keydown.esc="close"
        @keydown.enter.prevent="goToAll"
      >
      <span v-if="loading" class="absolute end-3 top-1/2 -translate-y-1/2">
        <Icon name="ph:spinner" class="w-4 h-4 text-accent animate-spin" />
      </span>
      <button
        v-else-if="q"
        type="button"
        class="absolute end-2 top-1/2 -translate-y-1/2 p-1.5 text-text-secondary hover:text-white"
        :aria-label="$t('nav.close_menu')"
        @mousedown.prevent="q = ''; inputEl?.focus()"
      >
        <Icon name="ph:x" class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Suggestions panel -->
    <div
      v-if="open && (results.length || showRecent || (searched && !results.length))"
      class="absolute z-50 inset-x-0 top-full mt-2 bg-dark-secondary border border-dark-tertiary rounded-xl shadow-2xl overflow-hidden"
    >
      <!-- Recent searches (empty input) -->
      <template v-if="showRecent">
        <p class="px-4 pt-3 pb-1 text-xs uppercase tracking-wider text-text-secondary">{{ $t('search.recent') }}</p>
        <button
          v-for="r in recent"
          :key="r"
          type="button"
          class="w-full text-start px-4 py-2.5 text-sm text-text-secondary hover:bg-dark-tertiary hover:text-white flex items-center gap-2.5"
          @mousedown.prevent="q = r"
        >
          <Icon name="ph:clock-counter-clockwise" class="w-4 h-4 shrink-0 opacity-60" />
          {{ r }}
        </button>
        <div class="pb-2" />
      </template>

      <!-- Product results -->
      <template v-else-if="results.length">
        <NuxtLink
          v-for="p in results"
          :key="p.slug ?? ''"
          :to="localePath(`/produits/${p.slug}`)"
          class="flex items-center gap-3 px-3.5 py-2.5 hover:bg-dark-tertiary transition-colors"
          @click="pick(p)"
        >
          <img
            v-if="p.image"
            :src="`${p.image}?w=80&h=80&fit=crop&auto=format`"
            :alt="p.name ?? ''"
            width="40" height="40" loading="lazy"
            class="w-10 h-10 rounded-lg object-cover bg-dark-tertiary shrink-0"
          >
          <span v-else class="w-10 h-10 rounded-lg bg-dark-tertiary flex items-center justify-center shrink-0">
            <Icon name="ph:package" class="w-5 h-5 text-text-secondary" />
          </span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm text-white truncate">{{ p.name }}</span>
            <StockBadge :stock="p.stock" class="!text-xs" />
          </span>
          <span class="text-accent font-bold text-sm whitespace-nowrap">{{ p.price }}€</span>
        </NuxtLink>
        <button
          type="button"
          class="w-full text-center px-4 py-3 text-sm font-medium text-accent border-t border-dark-tertiary hover:bg-dark-tertiary transition-colors"
          @mousedown.prevent="goToAll"
        >
          {{ $t('search.see_all') }}<template v-if="total > results.length"> ({{ total }})</template>
        </button>
      </template>

      <!-- No results -->
      <p v-else class="px-4 py-4 text-sm text-text-secondary">
        {{ $t('search.no_results', { q }) }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{ (e: 'navigate'): void }>()

const { locale } = useI18n()
const localePath = useLocalePath()
const router = useRouter()

interface SuggestProduct {
  name: string | null
  slug: string | null
  price: number | null
  stock: number | null
  image: string | null
}

const inputEl = ref<HTMLInputElement>()
const q = ref('')
const open = ref(false)
const loading = ref(false)
const searched = ref(false)
const results = ref<SuggestProduct[]>([])
const total = ref(0)
const recent = ref<string[]>([])

const showRecent = computed(() => open.value && !q.value.trim() && recent.value.length > 0)

onMounted(() => {
  try {
    recent.value = JSON.parse(localStorage.getItem('vitesse-recent-searches') || '[]').slice(0, 5)
  } catch { recent.value = [] }
  document.addEventListener('click', onOutside)
})
onBeforeUnmount(() => document.removeEventListener('click', onOutside))

function onOutside(e: MouseEvent) {
  if (!(e.target as HTMLElement)?.closest?.('[role="search"]')) close()
}

function rememberQuery() {
  const term = q.value.trim()
  if (term.length < 2) return
  recent.value = [term, ...recent.value.filter((r) => r !== term)].slice(0, 5)
  try { localStorage.setItem('vitesse-recent-searches', JSON.stringify(recent.value)) } catch {}
}

let timer: ReturnType<typeof setTimeout>
watch(q, (val) => {
  clearTimeout(timer)
  searched.value = false
  const term = val.trim()
  if (term.length < 2) { results.value = []; total.value = 0; loading.value = false; return }
  loading.value = true
  timer = setTimeout(async () => {
    try {
      const res: any = await $fetch('/api/search/suggest', { query: { q: term, locale: locale.value } })
      results.value = res.products || []
      total.value = res.total || 0
      searched.value = true
      open.value = true
    } catch {
      results.value = []
    } finally {
      loading.value = false
    }
  }, 250)
})

function pick(_p: SuggestProduct) {
  rememberQuery()
  close()
  q.value = ''
  emit('navigate')
}

function goToAll() {
  const term = q.value.trim()
  if (term.length < 2) return
  rememberQuery()
  close()
  emit('navigate')
  router.push(localePath(`/produits?q=${encodeURIComponent(term)}`))
  q.value = ''
}

function close() {
  open.value = false
}
</script>
