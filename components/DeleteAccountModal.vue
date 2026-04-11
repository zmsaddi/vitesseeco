<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="cancel" />

      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-90"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-90"
      >
        <div v-if="visible" class="relative w-full max-w-md bg-primary border border-red-800/50 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">

          <!-- Step 1: Warning -->
          <div v-if="step === 1" class="p-6 md:p-8">
            <div class="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
              <Icon name="ph:warning-diamond-fill" class="w-8 h-8 text-red-400" />
            </div>

            <h2 class="font-display text-xl font-bold text-white text-center mb-2">
              {{ $t('account.delete_title') }}
            </h2>
            <p class="text-text-secondary text-sm text-center mb-6">
              {{ $t('account.delete_warning') }}
            </p>

            <div class="bg-red-900/10 border border-red-800/30 rounded-xl p-4 mb-6 space-y-3">
              <div v-for="(item, i) in consequences" :key="i" class="flex items-start gap-3">
                <Icon :name="item.icon" class="w-4 h-4 shrink-0 mt-0.5" :class="item.color" />
                <span class="text-sm" :class="item.color">{{ item.text }}</span>
              </div>
            </div>

            <div class="flex gap-3">
              <button @click="cancel" class="flex-1 py-3 rounded-lg bg-dark-secondary border border-dark-tertiary text-white font-medium hover:bg-dark-tertiary transition-colors">
                {{ $t('common.back') }}
              </button>
              <button @click="step = 2" class="flex-1 py-3 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 font-medium hover:bg-red-900/50 transition-colors">
                {{ $t('common.continue') }}
              </button>
            </div>
          </div>

          <!-- Step 2: Confirm with password + checkboxes -->
          <div v-if="step === 2" class="p-6 md:p-8">
            <div class="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
              <Icon name="ph:shield-warning-fill" class="w-8 h-8 text-red-400" />
            </div>

            <h2 class="font-display text-xl font-bold text-white text-center mb-4">
              {{ $t('account.delete_confirm') }}
            </h2>

            <!-- Password confirmation -->
            <div class="mb-4">
              <label for="delete-password" class="text-sm font-medium text-text-secondary block mb-2">{{ $t('auth.password') }}</label>
              <input id="delete-password" v-model="password" type="password" class="input-field" :placeholder="$t('auth.password')" autocomplete="current-password" />
              <p v-if="deleteError" class="text-red-400 text-xs mt-1">{{ deleteError }}</p>
            </div>

            <!-- Confirmation checkboxes -->
            <div class="space-y-3 mb-6">
              <label class="flex items-start gap-3 cursor-pointer bg-red-900/10 border border-red-800/30 rounded-lg p-3">
                <input type="checkbox" v-model="check1" class="mt-1 accent-red-500 w-4 h-4" />
                <span class="text-text-secondary text-sm">{{ $t('account.delete_consequence_1') }}</span>
              </label>
              <label class="flex items-start gap-3 cursor-pointer bg-red-900/10 border border-red-800/30 rounded-lg p-3">
                <input type="checkbox" v-model="check2" class="mt-1 accent-red-500 w-4 h-4" />
                <span class="text-text-secondary text-sm">{{ $t('account.delete_consequence_3') }}</span>
              </label>
              <label class="flex items-start gap-3 cursor-pointer bg-red-900/10 border border-red-800/30 rounded-lg p-3">
                <input type="checkbox" v-model="check3" class="mt-1 accent-red-500 w-4 h-4" />
                <span class="text-text-secondary text-sm">{{ $t('account.delete_consequence_5') }}</span>
              </label>
            </div>

            <div class="flex gap-3">
              <button @click="step = 1" class="flex-1 py-3 rounded-lg bg-dark-secondary border border-dark-tertiary text-white font-medium hover:bg-dark-tertiary transition-colors">
                {{ $t('common.back') }}
              </button>
              <button
                @click="confirmDelete"
                :disabled="!allChecked || deleting"
                class="flex-1 py-3 rounded-lg font-medium transition-all"
                :class="allChecked ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-red-900/20 text-red-800 cursor-not-allowed'"
              >
                <span v-if="deleting" class="flex items-center justify-center gap-2">
                  <Icon name="ph:spinner" class="w-4 h-4 animate-spin" />
                </span>
                <span v-else>{{ $t('account.delete_button') }}</span>
              </button>
            </div>
          </div>

        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const { t } = useI18n()

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'close': []; 'confirm': [password: string] }>()

const step = ref(1)
const check1 = ref(false)
const check2 = ref(false)
const check3 = ref(false)
const deleting = ref(false)
const password = ref('')
const deleteError = ref('')

const allChecked = computed(() => check1.value && check2.value && check3.value && password.value.length >= 1)

const consequences = computed(() => [
  { icon: 'ph:x-circle', color: 'text-red-400', text: t('account.delete_consequence_1') },
  { icon: 'ph:x-circle', color: 'text-red-400', text: t('account.delete_consequence_2') },
  { icon: 'ph:x-circle', color: 'text-red-400', text: t('account.delete_consequence_3') },
  { icon: 'ph:warning', color: 'text-gold', text: t('account.delete_consequence_4') },
  { icon: 'ph:info', color: 'text-text-secondary', text: t('account.delete_consequence_5') },
])

function cancel() {
  step.value = 1
  check1.value = false
  check2.value = false
  check3.value = false
  password.value = ''
  deleteError.value = ''
  emit('close')
}

async function confirmDelete() {
  if (!allChecked.value) return
  deleteError.value = ''
  deleting.value = true
  emit('confirm', password.value)
}

watch(() => props.visible, (v) => {
  if (v) { step.value = 1; check1.value = false; check2.value = false; check3.value = false; deleting.value = false; password.value = ''; deleteError.value = '' }
})

// Escape key + body scroll lock
function onKeydown(e: KeyboardEvent) { if (e.key === 'Escape') cancel() }
watch(() => props.visible, (v) => {
  if (import.meta.client) document.body.style.overflow = v ? 'hidden' : ''
})
onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => { document.removeEventListener('keydown', onKeydown); if (import.meta.client) document.body.style.overflow = '' })
</script>
