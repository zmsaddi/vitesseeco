<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <h1 class="text-2xl font-display font-bold">{{ $t('admin.nav_messages') }}</h1>
      <div class="flex gap-2">
        <button
          v-for="tb in tabs"
          :key="tb.value"
          type="button"
          class="rounded-full px-3.5 py-1.5 text-sm border transition-colors duration-200"
          :class="tab === tb.value
            ? 'bg-accent/10 border-accent text-accent font-semibold'
            : 'bg-surface border-surface-2 text-on-surface-muted hover:text-on-surface'"
          @click="tab = tb.value"
        >
          {{ $t(tb.label) }}<span v-if="tb.count" class="ms-1 text-xs opacity-75">{{ tb.count }}</span>
        </button>
      </div>
    </div>

    <div v-if="pending" class="space-y-3">
      <div v-for="i in 4" :key="i" class="h-20 bg-surface-2 rounded-xl animate-pulse" />
    </div>

    <div v-else-if="!filtered.length" class="bg-surface border border-surface-2 rounded-xl p-12 text-center text-on-surface-muted">
      <Icon name="heroicons:envelope-open" class="w-10 h-10 mx-auto mb-3 opacity-50" />
      <p>{{ tab === 'unread' ? $t('admin.msg_empty_unread') : $t('admin.msg_empty') }}</p>
    </div>

    <div v-else class="space-y-3">
      <article
        v-for="msg in filtered"
        :key="msg._id"
        class="bg-surface border rounded-xl overflow-hidden"
        :class="msg.isRead ? 'border-surface-2' : 'border-accent/40'"
      >
        <button
          type="button"
          class="w-full text-start px-4 py-3.5 flex items-center gap-3"
          @click="toggleExpand(msg._id)"
        >
          <span class="w-2 h-2 rounded-full shrink-0" :class="msg.isRead ? 'bg-surface-2' : 'bg-accent'" />
          <span class="flex-1 min-w-0">
            <span class="block font-medium truncate">{{ msg.subject || $t('admin.no_subject') }}</span>
            <span class="block text-xs text-on-surface-muted truncate">{{ msg.name }} · {{ msg.email }} · {{ formatDate(msg.createdAt) }}</span>
          </span>
          <Icon :name="expanded === msg._id ? 'heroicons:chevron-up' : 'heroicons:chevron-down'" class="w-5 h-5 text-on-surface-muted shrink-0" />
        </button>

        <div v-if="expanded === msg._id" class="px-4 pb-4 border-t border-surface-2">
          <p class="text-sm whitespace-pre-wrap py-4">{{ msg.message }}</p>

          <div class="flex flex-wrap gap-2 mb-4">
            <a
              :href="mailtoLink(msg)"
              class="rounded-lg bg-accent text-primary px-4 py-2 text-sm font-semibold inline-flex items-center gap-2"
            >
              <Icon name="heroicons:arrow-uturn-right" class="w-4 h-4 rtl:-scale-x-100" />
              {{ $t('admin.reply_email') }}
            </a>
            <button
              type="button"
              class="rounded-lg bg-surface-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
              :disabled="savingId === msg._id"
              @click="toggleRead(msg)"
            >
              {{ msg.isRead ? $t('admin.mark_unread') : $t('admin.mark_read') }}
            </button>
          </div>

          <label class="block text-xs text-on-surface-muted mb-1.5" :for="`note-${msg._id}`">{{ $t('admin.internal_note') }}</label>
          <div class="flex gap-2">
            <input
              :id="`note-${msg._id}`"
              v-model="notes[msg._id]"
              type="text"
              maxlength="2000"
              :placeholder="$t('admin.note_placeholder')"
              class="flex-1 bg-bg border border-surface-2 rounded-lg px-3 py-2 text-sm placeholder:text-on-surface-muted focus:outline-none focus:border-accent"
            >
            <button
              type="button"
              class="rounded-lg bg-surface-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
              :disabled="savingId === msg._id || (notes[msg._id] ?? '') === (msg.reply ?? '')"
              @click="saveNote(msg)"
            >
              {{ $t('admin.save') }}
            </button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'admin' })

const { t, locale } = useI18n()
useHead({ title: computed(() => `${t('admin.nav_messages')} — Admin Vitesse Eco`) })

const toast = useToast()
const { data, pending, refresh } = await useFetch('/api/admin/messages')

const tab = ref<'unread' | 'all'>('unread')
const expanded = ref<string | null>(null)
const savingId = ref<string | null>(null)
const notes = reactive<Record<string, string>>({})

const messages = computed<any[]>(() => data.value?.messages ?? [])

watch(
  messages,
  (list) => {
    for (const m of list) {
      if (!(m._id in notes)) notes[m._id] = m.reply ?? ''
    }
  },
  { immediate: true }
)

const tabs = computed(() => [
  { value: 'unread' as const, label: 'admin.msg_unread', count: data.value?.unread ?? 0 },
  { value: 'all' as const, label: 'admin.msg_all', count: messages.value.length },
])

const filtered = computed(() =>
  tab.value === 'unread' ? messages.value.filter((m) => !m.isRead) : messages.value
)

function toggleExpand(id: string) {
  expanded.value = expanded.value === id ? null : id
  // Opening an unread message marks it read automatically — one less click.
  const msg = messages.value.find((m) => m._id === id)
  if (expanded.value === id && msg && !msg.isRead) {
    patch(msg, { isRead: true }, '')
  }
}

function toggleRead(msg: any) {
  patch(msg, { isRead: !msg.isRead }, msg.isRead ? t('admin.marked_unread') : t('admin.marked_read'))
}

function saveNote(msg: any) {
  patch(msg, { reply: notes[msg._id] ?? '' }, t('admin.note_saved'))
}

async function patch(msg: any, body: Record<string, unknown>, successMessage: string) {
  savingId.value = msg._id
  try {
    await $fetch(`/api/admin/messages/${msg._id}`, { method: 'PATCH', body })
    await refresh()
    if (successMessage) toast.success(successMessage)
  } catch (e: any) {
    toast.error(e?.data?.message || t('admin.update_failed'))
  } finally {
    savingId.value = null
  }
}

function mailtoLink(msg: any) {
  const subject = encodeURIComponent(`Re: ${msg.subject || 'Votre message — Vitesse Eco'}`)
  return `mailto:${msg.email}?subject=${subject}`
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString(locale.value, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>
