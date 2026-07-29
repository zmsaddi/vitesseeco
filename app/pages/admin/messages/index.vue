<script setup lang="ts">
/**
 * Customer messages.
 *
 * Read is a deliberate act, not a side effect of the page loading. Marking
 * everything read on render is how a message gets lost: the badge clears, the
 * owner moves on, and nobody ever answers it. Opening one message marks that
 * one.
 *
 * The note is the owner's own memory — "called back", "sent the quote" — and it
 * is stored server-side rather than in the browser so it survives the device.
 * It is never shown to the customer.
 */
definePageMeta({ layout: 'admin', middleware: 'auth' })

const { t, locale } = useI18n()

interface ContactMessage {
  id: string
  name: string
  email: string
  subject: string
  message: string
  locale: string
  isRead: boolean
  adminNote: string | null
  createdAt: string
}

const unreadOnly = ref(false)
const page = ref(1)

const { data, refresh, status: loadState } = await useFetch<{
  messages: ContactMessage[]
  unread: number
}>('/api/admin/messages', {
  query: computed(() => ({
    page: page.value,
    perPage: 25,
    ...(unreadOnly.value ? { unreadOnly: true } : {}),
  })),
})

const open = ref<string | null>(null)
const busy = ref<string | null>(null)
const error = ref<string | null>(null)

async function patch(id: string, body: Record<string, unknown>): Promise<void> {
  busy.value = id
  error.value = null
  try {
    await $fetch<unknown>(`/api/admin/messages/${id}`, { method: 'PATCH', body })
    await refresh()
  } catch (err: unknown) {
    const payload = (err as { data?: { messageKey?: string } })?.data
    error.value = payload?.messageKey ? t(payload.messageKey) : t('errors.internal')
  } finally {
    busy.value = null
  }
}

/** Opening a message is what marks it read — never the page load. */
function toggle(message: ContactMessage): void {
  const opening = open.value !== message.id
  open.value = opening ? message.id : null
  if (opening && !message.isRead) void patch(message.id, { isRead: true })
}

function saveNote(message: ContactMessage, raw: string): void {
  const note = raw.trim()
  if (note === (message.adminNote ?? '')) return
  void patch(message.id, { adminNote: note })
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value)
  )

/**
 * mailto with the subject already threaded, so replying is one click rather
 * than a copy, a paste and a retyped subject line.
 */
function replyHref(message: ContactMessage): string {
  const subject = encodeURIComponent(`Re: ${message.subject}`)
  return `mailto:${encodeURIComponent(message.email)}?subject=${subject}`
}

useSeoMeta({ title: () => t('admin.messages'), robots: 'noindex' })
</script>

<template>
  <div class="container-page">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="font-display text-2xl font-extrabold text-content-strong">
        {{ $t('admin.messages') }}
        <span v-if="data?.unread" class="ms-2 rounded-full bg-accent px-2 py-0.5 text-sm text-accent-contrast">
          {{ data.unread }}
        </span>
      </h1>
      <label class="flex min-h-11 items-center gap-2 text-sm text-content">
        <input v-model="unreadOnly" type="checkbox" class="accent-accent" @change="page = 1" />
        {{ $t('admin.unread_only') }}
      </label>
    </div>

    <p v-if="error" role="alert" class="mt-4 text-sm text-danger">{{ error }}</p>
    <p v-if="loadState === 'pending'" class="mt-6 text-content-muted">{{ $t('common.loading') }}</p>

    <p v-else-if="!data?.messages?.length" class="mt-6 text-content-muted">
      {{ $t('admin.no_messages') }}
    </p>

    <ul v-else class="mt-6 space-y-3">
      <li
        v-for="message in data.messages"
        :key="message.id"
        class="card overflow-hidden"
        :class="message.isRead ? '' : 'border-accent'"
      >
        <button
          type="button"
          class="flex w-full flex-wrap items-center gap-3 p-4 text-start"
          :aria-expanded="open === message.id"
          @click="toggle(message)"
        >
          <span
            class="h-2 w-2 shrink-0 rounded-full"
            :class="message.isRead ? 'bg-surface-border' : 'bg-accent'"
            :aria-label="message.isRead ? $t('admin.read') : $t('admin.unread')"
          />
          <span class="font-medium text-content-strong" :class="message.isRead ? '' : 'font-bold'">
            {{ message.subject }}
          </span>
          <span class="text-sm text-content-muted">{{ message.name }}</span>
          <span class="ms-auto text-xs text-content-muted">{{ formatDate(message.createdAt) }}</span>
        </button>

        <div v-if="open === message.id" class="border-t border-surface-border p-4">
          <p class="whitespace-pre-wrap text-content">{{ message.message }}</p>

          <div class="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <a :href="replyHref(message)" class="btn-primary h-9 px-3 text-xs">
              {{ $t('admin.reply') }}
            </a>
            <a :href="`mailto:${message.email}`" class="text-content-muted hover:text-content-strong">
              {{ message.email }}
            </a>
            <span class="text-content-muted">{{ message.locale.toUpperCase() }}</span>
            <button
              type="button"
              class="btn-secondary ms-auto h-9 px-3 text-xs"
              :disabled="busy === message.id"
              @click="patch(message.id, { isRead: !message.isRead })"
            >
              {{ message.isRead ? $t('admin.mark_unread') : $t('admin.mark_read') }}
            </button>
          </div>

          <!-- Saved on blur, like every other field in this panel: a note saved
               per keystroke would be a write for every letter typed. -->
          <label class="mt-4 block">
            <span class="text-xs font-semibold uppercase tracking-wide text-content-muted">
              {{ $t('admin.internal_note') }}
            </span>
            <textarea
              :value="message.adminNote ?? ''"
              rows="2"
              class="field mt-1 w-full"
              :placeholder="$t('admin.internal_note_hint')"
              :disabled="busy === message.id"
              @blur="saveNote(message, ($event.target as HTMLTextAreaElement).value)"
            />
          </label>
        </div>
      </li>
    </ul>

    <nav v-if="data?.messages?.length === 25 || page > 1" class="mt-8 flex justify-center gap-2">
      <button type="button" class="btn-secondary" :disabled="page <= 1" @click="page--">
        {{ $t('common.previous') }}
      </button>
      <span class="flex items-center px-3 text-sm text-content-muted">{{ page }}</span>
      <button
        type="button"
        class="btn-secondary"
        :disabled="(data?.messages?.length ?? 0) < 25"
        @click="page++"
      >
        {{ $t('common.next') }}
      </button>
    </nav>
  </div>
</template>
