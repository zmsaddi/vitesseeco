<template>
  <div class="py-8 md:py-12">
    <div class="container-custom max-w-4xl">
      <div class="flex items-center justify-between mb-8">
        <h1 class="section-title">{{ $t('account.title') }}</h1>
        <button @click="handleLogout" class="text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/30 transition-colors text-sm flex items-center gap-2 px-4 py-2 rounded-lg border border-red-800/50">
          <Icon name="ph:sign-out" class="w-4 h-4" />
          {{ $t('nav.logout') }}
        </button>
      </div>

      <div class="space-y-6">
        <!-- Profile Section -->
        <div class="card p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-display font-semibold text-white flex items-center gap-2">
              <Icon name="ph:user-circle" class="w-5 h-5 text-accent" />
              {{ $t('account.profile') }}
            </h2>
            <button @click="editingProfile = !editingProfile" class="text-accent text-sm hover:underline">
              {{ editingProfile ? $t('common.back') : $t('account.edit_profile') }}
            </button>
          </div>

          <!-- View Mode -->
          <div v-if="!editingProfile" class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span class="text-text-secondary block text-xs mb-1">{{ $t('checkout.first_name') }}</span>
              <span class="text-white">{{ auth.user?.firstName }}</span>
            </div>
            <div>
              <span class="text-text-secondary block text-xs mb-1">{{ $t('checkout.last_name') }}</span>
              <span class="text-white">{{ auth.user?.lastName }}</span>
            </div>
            <div>
              <span class="text-text-secondary block text-xs mb-1">{{ $t('auth.email') }}</span>
              <span class="text-white">{{ auth.user?.email }}</span>
            </div>
            <div>
              <span class="text-text-secondary block text-xs mb-1">{{ $t('checkout.phone') }}</span>
              <span class="text-white">{{ auth.user?.phone || '—' }}</span>
            </div>
          </div>

          <!-- Edit Mode -->
          <form v-else @submit.prevent="saveProfile" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="prof-first" class="text-sm font-medium text-text-secondary block mb-2 required">{{ $t('checkout.first_name') }}</label>
                <input id="prof-first" name="firstName" v-model="profileForm.firstName" type="text" class="input-field" required />
              </div>
              <div>
                <label for="prof-last" class="text-sm font-medium text-text-secondary block mb-2 required">{{ $t('checkout.last_name') }}</label>
                <input id="prof-last" name="lastName" v-model="profileForm.lastName" type="text" class="input-field" required />
              </div>
            </div>
            <div>
              <label for="prof-phone" class="text-sm font-medium text-text-secondary block mb-2">{{ $t('checkout.phone') }}</label>
              <input id="prof-phone" name="phone" v-model="profileForm.phone" type="tel" class="input-field" autocomplete="tel" />
            </div>
            <div class="flex gap-3">
              <button type="submit" :disabled="savingProfile" class="btn-primary py-2 px-6 text-sm disabled:opacity-50">
                {{ savingProfile ? $t('common.loading') : $t('common.save') }}
              </button>
              <button type="button" @click="editingProfile = false" class="btn-secondary py-2 px-6 text-sm">
                {{ $t('common.back') }}
              </button>
            </div>
            <p v-if="profileSuccess" class="text-accent text-sm"><Icon name="ph:check-circle" class="w-4 h-4 text-accent inline" /> {{ $t('contact.success') }}</p>
          </form>
        </div>

        <!-- Addresses Section -->
        <div class="card p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-display font-semibold text-white flex items-center gap-2">
              <Icon name="ph:map-pin" class="w-5 h-5 text-accent" />
              {{ $t('contact.address') }}
            </h2>
            <button v-if="!addingAddress && (userAddresses?.length || 0) < 5" @click="addingAddress = true" class="text-accent text-sm hover:underline flex items-center gap-1">
              <Icon name="ph:plus" class="w-4 h-4" /> {{ $t('account.add_address') }}
            </button>
          </div>

          <!-- Address List -->
          <div v-if="userAddresses?.length" class="space-y-3 mb-4">
            <div v-for="addr in userAddresses" :key="addr.id" class="bg-dark-tertiary/30 rounded-lg p-4 flex justify-between items-start">
              <div class="text-sm">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-white font-medium">{{ addr.firstName }} {{ addr.lastName }}</span>
                  <span v-if="addr.isDefault" class="text-accent text-xs bg-accent/10 px-2 py-0.5 rounded-full">{{ $t('account.default_address') }}</span>
                </div>
                <p class="text-text-secondary">{{ addr.address }}</p>
                <p v-if="addr.addressLine2" class="text-text-secondary">{{ addr.addressLine2 }}</p>
                <p class="text-text-secondary">{{ addr.postalCode }} {{ addr.city }}, {{ addr.country }}</p>
                <p v-if="addr.phone" class="text-text-secondary">{{ addr.phone }}</p>
              </div>
              <button @click="deleteAddress(addr.id)" class="text-text-secondary hover:text-red-400 transition-colors shrink-0">
                <Icon name="ph:trash" class="w-4 h-4" />
              </button>
            </div>
          </div>
          <p v-else-if="!addingAddress" class="text-text-secondary text-sm mb-4">{{ $t('account.no_addresses') }}</p>

          <!-- Add Address Form -->
          <form v-if="addingAddress" @submit.prevent="saveAddress" class="space-y-4 border-t border-dark-tertiary pt-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="addr-first" class="text-sm font-medium text-text-secondary block mb-2 required">{{ $t('checkout.first_name') }}</label>
                <input id="addr-first" name="firstName" v-model="addressForm.firstName" type="text" class="input-field" required />
              </div>
              <div>
                <label for="addr-last" class="text-sm font-medium text-text-secondary block mb-2 required">{{ $t('checkout.last_name') }}</label>
                <input id="addr-last" name="lastName" v-model="addressForm.lastName" type="text" class="input-field" required />
              </div>
            </div>
            <div>
              <label for="addr-phone" class="text-sm font-medium text-text-secondary block mb-2">{{ $t('checkout.phone') }}</label>
              <input id="addr-phone" name="phone" v-model="addressForm.phone" type="tel" class="input-field" />
            </div>
            <!-- Country FIRST -->
            <div>
              <label for="addr-country" class="text-sm font-medium text-text-secondary block mb-2 required">{{ $t('checkout.country') }}</label>
              <select id="addr-country" name="country" v-model="addressForm.country" class="input-field">
                <option value="FR">🇫🇷 France</option>
                <option value="BE">🇧🇪 Belgique</option>
                <option value="LU">🇱🇺 Luxembourg</option>
                <option value="DE">🇩🇪 Deutschland</option>
                <option value="NL">🇳🇱 Nederland</option>
                <option value="ES">🇪🇸 España</option>
              </select>
            </div>
            <!-- Address with inline autocomplete -->
            <div>
              <label for="addr-address" class="text-sm font-medium text-text-secondary block mb-2 required">{{ $t('checkout.address') }}</label>
              <div class="relative">
                <input
                  id="addr-address"
                  ref="addrInput"
                  name="address"
                  type="text"
                  v-model="addressForm.address"
                  @input="onAddrInput"
                  @focus="addrFocused = true"
                  class="input-field"
                  :placeholder="$t('checkout.address')"
                  required
                  autocomplete="off"
                />
                <div v-if="addrLoading" class="absolute right-3 top-1/2 -translate-y-1/2">
                  <Icon name="ph:spinner" class="w-4 h-4 text-accent animate-spin" />
                </div>
                <div
                  v-if="addrSuggestions.length > 0"
                  class="absolute z-50 left-0 right-0 mt-1 bg-dark-secondary border border-dark-tertiary rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto"
                >
                  <button
                    v-for="s in addrSuggestions"
                    :key="s.place_id"
                    type="button"
                    @mousedown.prevent="pickAddr(s)"
                    class="w-full text-left px-3 py-2.5 text-sm text-text-secondary hover:bg-dark-tertiary hover:text-white transition-colors flex items-start gap-2"
                  >
                    <Icon name="ph:map-pin" class="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent" />
                    <span>{{ s.description }}</span>
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label for="addr-line2" class="text-sm font-medium text-text-secondary block mb-2">{{ $t('checkout.address') }} 2</label>
              <input id="addr-line2" name="addressLine2" v-model="addressForm.addressLine2" type="text" class="input-field" :placeholder="$t('checkout.address_line2_placeholder')" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="addr-postal" class="text-sm font-medium text-text-secondary block mb-2 required">{{ $t('checkout.postal_code') }}</label>
                <input id="addr-postal" name="postalCode" v-model="addressForm.postalCode" type="text" class="input-field" required autocomplete="postal-code" />
              </div>
              <div>
                <label for="addr-city" class="text-sm font-medium text-text-secondary block mb-2 required">{{ $t('checkout.city') }}</label>
                <input id="addr-city" name="city" v-model="addressForm.city" type="text" class="input-field" required autocomplete="address-level2" />
              </div>
            </div>
            <label class="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input type="checkbox" v-model="addressForm.isDefault" class="accent-accent" />
              {{ $t('account.set_default') }}
            </label>
            <div class="flex gap-3">
              <button type="submit" :disabled="savingAddress" class="btn-primary py-2 px-6 text-sm disabled:opacity-50">
                {{ savingAddress ? $t('common.loading') : $t('common.save') }}
              </button>
              <button type="button" @click="addingAddress = false" class="btn-secondary py-2 px-6 text-sm">
                {{ $t('common.back') }}
              </button>
            </div>
          </form>
        </div>

        <!-- Orders Section -->
        <div class="card p-6">
          <h2 class="font-display font-semibold text-white mb-4 flex items-center gap-2">
            <Icon name="ph:package" class="w-5 h-5 text-accent" />
            {{ $t('account.orders') }}
          </h2>
          <p class="text-text-secondary text-sm">
            {{ $t('account.no_orders') }}
            <NuxtLink :to="localePath('/produits')" class="text-accent hover:underline ml-1">{{ $t('cart.empty_cta') }}</NuxtLink>
          </p>
        </div>

        <!-- Delete Account -->
        <div class="border border-red-800/30 rounded-xl p-6">
          <h2 class="font-display font-semibold text-red-400 mb-2 flex items-center gap-2">
            <Icon name="ph:warning" class="w-5 h-5" />
            {{ $t('account.delete_title') || 'Delete Account' }}
          </h2>
          <p class="text-text-secondary text-sm mb-4">{{ $t('account.delete_warning') || 'This action is permanent. Your orders will be kept anonymously.' }}</p>
          <button
            @click="showDeleteModal = true"
            class="text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/30 transition-colors text-sm px-4 py-2 rounded-lg border border-red-800/50"
          >
            {{ $t('account.delete_button') }}
          </button>
        </div>
      </div>

      <!-- Delete Account Modal -->
      <ClientOnly>
        <DeleteAccountModal
          :visible="showDeleteModal"
          @close="showDeleteModal = false"
          @confirm="executeDeleteAccount"
        />
      </ClientOnly>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const auth = useAuthStore()

definePageMeta({ middleware: 'auth' })
useHead({ title: `${t('account.title')} — Vitesse Eco` })

// Profile
const editingProfile = ref(false)
const savingProfile = ref(false)
const profileSuccess = ref(false)
const profileForm = reactive({
  firstName: auth.user?.firstName || '',
  lastName: auth.user?.lastName || '',
  phone: auth.user?.phone || '',
})

watch(() => auth.user, (u) => {
  if (u) {
    profileForm.firstName = u.firstName
    profileForm.lastName = u.lastName
    profileForm.phone = u.phone || ''
  }
}, { immediate: true })

async function saveProfile() {
  savingProfile.value = true
  profileSuccess.value = false
  try {
    const { user } = await $fetch('/api/auth/profile', {
      method: 'PUT',
      body: profileForm,
    })
    auth.user = user
    profileSuccess.value = true
    setTimeout(() => { editingProfile.value = false; profileSuccess.value = false }, 1500)
  } catch (e) {
    console.error(e)
  } finally {
    savingProfile.value = false
  }
}

// Addresses
const addingAddress = ref(false)
const savingAddress = ref(false)
const userAddresses = ref<any[]>([])

const addressForm = reactive({
  firstName: auth.user?.firstName || '',
  lastName: auth.user?.lastName || '',
  phone: '',
  address: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  country: 'FR',
  isDefault: false,
})

// Inline address autocomplete
const addrInput = ref<HTMLInputElement>()
const addrSuggestions = ref<any[]>([])
const addrFocused = ref(false)
const addrLoading = ref(false)
let addrTimer: ReturnType<typeof setTimeout>

watch(() => addressForm.country, () => {
  addressForm.address = ''
  addressForm.city = ''
  addressForm.postalCode = ''
  addrSuggestions.value = []
})

function onAddrInput() {
  clearTimeout(addrTimer)
  if (addressForm.address.length < 3) {
    addrSuggestions.value = []
    addrLoading.value = false
    return
  }
  addrLoading.value = true
  addrTimer = setTimeout(async () => {
    try {
      const data = await $fetch<any>('/api/places/autocomplete', {
        query: { input: addressForm.address, country: addressForm.country.toLowerCase() },
      })
      addrSuggestions.value = data.predictions || []
    } catch {
      addrSuggestions.value = []
    } finally {
      addrLoading.value = false
    }
  }, 400)
}

async function pickAddr(s: any) {
  addrFocused.value = false
  addrSuggestions.value = []
  addressForm.address = s.structured_formatting?.main_text || s.description
  try {
    const data = await $fetch<any>('/api/places/details', { query: { place_id: s.place_id } })
    if (data.address) {
      addressForm.address = data.address
      addressForm.city = data.city || ''
      addressForm.postalCode = data.postalCode || ''
    }
  } catch {}
}

function onAddrClickOutside(e: MouseEvent) {
  if (addrInput.value && !addrInput.value.parentElement?.contains(e.target as Node)) {
    addrFocused.value = false
  }
}
onMounted(() => document.addEventListener('click', onAddrClickOutside))
onUnmounted(() => document.removeEventListener('click', onAddrClickOutside))

async function fetchAddresses() {
  try {
    const { addresses } = await $fetch('/api/addresses')
    userAddresses.value = addresses
  } catch {}
}

async function saveAddress() {
  savingAddress.value = true
  try {
    await $fetch('/api/addresses', { method: 'POST', body: addressForm })
    addingAddress.value = false
    addressForm.address = ''
    addressForm.addressLine2 = ''
    addressForm.postalCode = ''
    addressForm.city = ''
    addressForm.isDefault = false
    await fetchAddresses()
  } catch (e: any) {
    alert(e.data?.message || 'Error')
  } finally {
    savingAddress.value = false
  }
}

async function deleteAddress(id: string) {
  await $fetch(`/api/addresses/${id}`, { method: 'DELETE' })
  await fetchAddresses()
}

async function handleLogout() {
  await auth.logout()
  navigateTo(localePath('/'))
}

const showDeleteModal = ref(false)

async function executeDeleteAccount() {
  try {
    await $fetch('/api/auth/delete-account', { method: 'POST' })
    auth.user = null
    showDeleteModal.value = false
    navigateTo(localePath('/'))
  } catch (e: any) {
    alert(e.data?.message || 'Error')
  }
}

onMounted(fetchAddresses)
</script>
