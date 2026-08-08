<script setup lang="ts">
import type { AddressInput } from '~~/shared/schemas'

/**
 * The address book.
 *
 * The form is built from the same schema the server validates against, so the
 * customer is never asked for something that will be rejected — including the
 * country list, which is shorter than the one the checkout offers and would
 * otherwise let someone save an address to a country we refuse at the edge.
 */
definePageMeta({ middleware: 'auth' })

const localePath = useLocalePath()
const { t } = useI18n()
const { formatShortDate } = useFormatDate()

type Country = AddressInput['country']

/**
 * The countries the address schema accepts. Typed from it, so removing one there
 * stops the build here instead of leaving a choice the server rejects.
 *
 * Each is named in its own language, as the checkout does: an endonym is the
 * same word in all six of our languages, and a customer looking for "Nederland"
 * finds it whichever version of the site they are reading.
 */
const COUNTRIES: ReadonlyArray<{ code: Country; name: string }> = [
  { code: 'FR', name: 'France' },
  { code: 'BE', name: 'Belgique' },
  { code: 'NL', name: 'Nederland' },
  { code: 'DE', name: 'Deutschland' },
  { code: 'ES', name: 'España' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'AT', name: 'Österreich' },
  { code: 'IT', name: 'Italia' },
  { code: 'PT', name: 'Portugal' },
  { code: 'CH', name: 'Suisse' },
]

/** Mirrors LIMITS.MAX_ADDRESSES_PER_CUSTOMER — see shared/schemas.ts. */
const MAX_ADDRESSES = 10

interface SavedAddress {
  id: string
  label: string | null
  firstName: string
  lastName: string
  phone: string | null
  line1: string
  line2: string | null
  postalCode: string
  city: string
  country: string
  isDefault: boolean
  createdAt: string
}

// Stated explicitly: the route is wrapped by defineRoute, so its shape cannot be
// inferred through the wrapper.
const { data: saved, refresh } = await useFetch<SavedAddress[]>('/api/account/addresses')
const { data: me } = await useFetch<{ firstName: string; lastName: string } | null>('/api/auth/me')

const list = computed(() => saved.value ?? [])
const atLimit = computed(() => list.value.length >= MAX_ADDRESSES)

interface AddressForm {
  label: string
  firstName: string
  lastName: string
  phone: string
  line1: string
  line2: string
  postalCode: string
  city: string
  country: Country
  isDefault: boolean
}

function emptyForm(): AddressForm {
  return {
    label: '',
    // Almost every parcel goes to the account holder, and a prefilled name is
    // overwritten in one keystroke by the minority for whom it does not.
    firstName: me.value?.firstName ?? '',
    lastName: me.value?.lastName ?? '',
    phone: '',
    line1: '',
    line2: '',
    postalCode: '',
    city: '',
    country: 'FR',
    isDefault: false,
  }
}

const form = reactive<AddressForm>(emptyForm())

// An empty address book has exactly one useful action on it. Both renders read
// the same fetched list, so opening the form here cannot disagree with the HTML.
const showForm = ref(list.value.length === 0)

const submitting = ref(false)
const error = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})
const justSaved = ref(false)

/** Which card is asking; deletion is unrecoverable, so it never happens on one click. */
const confirmingId = ref<string | null>(null)
const deletingId = ref<string | null>(null)

function openForm(): void {
  Object.assign(form, emptyForm())
  fieldErrors.value = {}
  error.value = null
  justSaved.value = false
  showForm.value = true
}

function countryName(code: string): string {
  return COUNTRIES.find((entry) => entry.code === code)?.name ?? code
}

function readError(err: unknown): void {
  const data = (err as {
    data?: { messageKey?: string; details?: { issues?: Array<{ path: string; message: string }> } }
  })?.data
  // A field error only helps if the field is on screen. The server can reject
  // on a path this form does not render — the address limit arrives as
  // `address`, an unknown key as `(root)` — and attaching those to invisible
  // fields made the save fail with nothing at all on screen.
  const RENDERED_FIELDS = new Set([
    'label', 'firstName', 'lastName', 'phone',
    'line1', 'line2', 'postalCode', 'city', 'country',
  ])
  const unshowable: string[] = []

  for (const issue of data?.details?.issues ?? []) {
    const message = issue.message.startsWith('errors.') ? t(issue.message) : issue.message
    if (RENDERED_FIELDS.has(issue.path)) fieldErrors.value[issue.path] = message
    else unshowable.push(message)
  }

  if (unshowable.length > 0) {
    error.value = unshowable.join(' · ')
  } else if (Object.keys(fieldErrors.value).length === 0) {
    error.value = data?.messageKey ? t(data.messageKey) : t('errors.internal')
  }
}

async function save(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  error.value = null
  fieldErrors.value = {}

  try {
    await $fetch('/api/account/addresses', {
      method: 'POST',
      // Blank optional fields are left out rather than sent empty: the schema is
      // strict, and an empty phone fails its pattern instead of meaning "none".
      body: {
        ...(form.label.trim() ? { label: form.label.trim() } : {}),
        firstName: form.firstName,
        lastName: form.lastName,
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        line1: form.line1,
        ...(form.line2.trim() ? { line2: form.line2.trim() } : {}),
        postalCode: form.postalCode,
        city: form.city,
        country: form.country,
        ...(form.isDefault ? { isDefault: true } : {}),
      },
    })
    showForm.value = false
    justSaved.value = true
    await refresh()
  } catch (err: unknown) {
    readError(err)
  } finally {
    submitting.value = false
  }
}

async function remove(id: string): Promise<void> {
  if (deletingId.value) return
  deletingId.value = id
  error.value = null

  try {
    await $fetch(`/api/account/addresses/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (err: unknown) {
    readError(err)
  } finally {
    deletingId.value = null
    confirmingId.value = null
  }
}

useSeoMeta({ title: () => t('account.addresses'), robots: 'noindex' })
</script>

<template>
  <div class="container-page py-10">
    <NuxtLink :to="localePath('/compte')" class="text-sm text-content-muted hover:text-accent">
      {{ $t('account.title') }}
    </NuxtLink>

    <h1 class="mt-2 font-display text-3xl font-extrabold text-content-strong">
      {{ $t('account.addresses') }}
    </h1>

    <p v-if="error" role="alert" class="mt-6 text-sm text-danger">{{ error }}</p>
    <p v-else-if="justSaved" class="mt-6 text-sm text-success">{{ $t('addresses.saved') }}</p>

    <p v-if="!list.length" class="mt-8 text-content-muted">{{ $t('addresses.empty') }}</p>

    <ul v-else class="mt-8 grid gap-4 sm:grid-cols-2">
      <li v-for="address in list" :key="address.id" class="card flex flex-col p-5">
        <div class="flex items-start justify-between gap-3">
          <p class="font-medium text-content-strong">
            {{ address.label || `${address.firstName} ${address.lastName}` }}
          </p>
          <span
            v-if="address.isDefault"
            class="shrink-0 rounded-full bg-accent-subtle px-3 py-1 text-xs font-semibold text-accent"
          >
            {{ $t('addresses.default') }}
          </span>
        </div>

        <address class="mt-2 flex-1 text-sm not-italic text-content">
          <span class="block">{{ address.firstName }} {{ address.lastName }}</span>
          <span class="block">{{ address.line1 }}</span>
          <span v-if="address.line2" class="block">{{ address.line2 }}</span>
          <span class="block">{{ address.postalCode }} {{ address.city }}</span>
          <span class="block">{{ countryName(address.country) }}</span>
          <span v-if="address.phone" class="mt-1 block text-content-muted"><bdi dir="ltr">{{ address.phone }}</bdi></span>
        </address>

        <p class="mt-3 text-xs text-content-muted">
          {{ $t('addresses.added_on', { date: formatShortDate(address.createdAt) }) }}
        </p>

        <!-- Nothing here can be undone and nothing here can be edited back, so
             the question is asked on the card being deleted, not in a dialog
             that hides which one it is. -->
        <div v-if="confirmingId === address.id" class="mt-4 rounded-xl bg-danger-subtle p-3">
          <p class="text-sm text-danger">{{ $t('addresses.delete_question') }}</p>
          <div class="mt-3 flex gap-2">
            <button
              type="button"
              class="btn-secondary"
              :disabled="deletingId === address.id"
              @click="confirmingId = null"
            >
              {{ $t('common.cancel') }}
            </button>
            <button
              type="button"
              class="btn-primary"
              :disabled="deletingId === address.id"
              @click="remove(address.id)"
            >
              {{ deletingId === address.id ? $t('common.loading') : $t('addresses.delete_confirm') }}
            </button>
          </div>
        </div>

        <button
          v-else
          type="button"
          class="mt-4 self-start text-sm text-content-muted hover:text-danger"
          @click="confirmingId = address.id"
        >
          {{ $t('addresses.delete') }}
        </button>
      </li>
    </ul>

    <p v-if="atLimit" class="mt-8 text-sm text-content-muted">
      {{ $t('addresses.limit_reached', { max: MAX_ADDRESSES }) }}
    </p>

    <button v-else-if="!showForm" type="button" class="btn-primary mt-8" @click="openForm">
      {{ $t('addresses.add') }}
    </button>

    <section v-else class="card mt-8 max-w-2xl p-6">
      <h2 class="font-display text-xl font-bold text-content-strong">{{ $t('addresses.new_title') }}</h2>

      <form class="mt-6 space-y-4" @submit.prevent="save">
        <label class="block">
          <span class="text-sm text-content-muted">{{ $t('addresses.label') }}</span>
          <input
            v-model="form.label"
            type="text"
            maxlength="40"
            :placeholder="$t('addresses.label_placeholder')"
            class="field mt-1"
          />
        </label>

        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block">
            <span class="text-sm text-content-muted">{{ $t('auth.first_name') }}</span>
            <input
              v-model="form.firstName"
              type="text"
              autocomplete="given-name"
              maxlength="100"
              required
              class="field mt-1"
            />
            <span v-if="fieldErrors.firstName" class="mt-1 block text-sm text-danger">
              {{ fieldErrors.firstName }}
            </span>
          </label>
          <label class="block">
            <span class="text-sm text-content-muted">{{ $t('auth.last_name') }}</span>
            <input
              v-model="form.lastName"
              type="text"
              autocomplete="family-name"
              maxlength="100"
              required
              class="field mt-1"
            />
            <span v-if="fieldErrors.lastName" class="mt-1 block text-sm text-danger">
              {{ fieldErrors.lastName }}
            </span>
          </label>
        </div>

        <label class="block">
          <span class="text-sm text-content-muted">{{ $t('addresses.line1') }}</span>
          <input
            v-model="form.line1"
            type="text"
            autocomplete="address-line1"
            maxlength="200"
            required
            class="field mt-1"
          />
          <span v-if="fieldErrors.line1" class="mt-1 block text-sm text-danger">{{ fieldErrors.line1 }}</span>
        </label>

        <label class="block">
          <span class="text-sm text-content-muted">{{ $t('addresses.line2') }}</span>
          <input
            v-model="form.line2"
            type="text"
            autocomplete="address-line2"
            maxlength="200"
            class="field mt-1"
          />
        </label>

        <div class="grid gap-3 sm:grid-cols-3">
          <label class="block">
            <span class="text-sm text-content-muted">{{ $t('checkout.postal_code') }}</span>
            <!-- Dutch postcodes contain letters, so a numeric keypad would make
                 them impossible to type on a phone. -->
            <input
              v-model="form.postalCode"
              type="text"
              :inputmode="form.country === 'NL' ? 'text' : 'numeric'"
              autocomplete="postal-code"
              minlength="3"
              maxlength="12"
              pattern="[A-Za-z0-9][A-Za-z0-9 -]*"
              required
              class="field mt-1"
            />
            <span v-if="fieldErrors.postalCode" class="mt-1 block text-sm text-danger">
              {{ fieldErrors.postalCode }}
            </span>
          </label>

          <label class="block">
            <span class="text-sm text-content-muted">{{ $t('addresses.city') }}</span>
            <input
              v-model="form.city"
              type="text"
              autocomplete="address-level2"
              maxlength="120"
              required
              class="field mt-1"
            />
            <span v-if="fieldErrors.city" class="mt-1 block text-sm text-danger">{{ fieldErrors.city }}</span>
          </label>

          <label class="block">
            <span class="text-sm text-content-muted">{{ $t('checkout.country') }}</span>
            <select v-model="form.country" autocomplete="country" class="field mt-1">
              <option v-for="country in COUNTRIES" :key="country.code" :value="country.code">
                {{ country.name }}
              </option>
            </select>
          </label>
        </div>

        <label class="block">
          <span class="text-sm text-content-muted">{{ $t('auth.phone_optional') }}</span>
          <input
            v-model="form.phone"
            type="tel"
            autocomplete="tel"
            pattern="\+?[0-9 ().-]{6,20}"
            class="field mt-1"
          />
          <span v-if="fieldErrors.phone" class="mt-1 block text-sm text-danger">{{ fieldErrors.phone }}</span>
        </label>

        <label class="flex items-center gap-3">
          <input v-model="form.isDefault" type="checkbox" class="accent-accent" />
          <span class="text-sm text-content">{{ $t('addresses.make_default') }}</span>
        </label>

        <p v-if="error" role="alert" class="text-sm text-danger">{{ error }}</p>

        <div class="flex flex-wrap gap-3 pt-2">
          <button type="submit" class="btn-primary" :disabled="submitting">
            {{ submitting ? $t('common.loading') : $t('addresses.save') }}
          </button>
          <button v-if="list.length" type="button" class="btn-secondary" @click="showForm = false">
            {{ $t('common.cancel') }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
