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
        <div v-if="visible" class="relative w-full max-w-md bg-primary border border-red-800/50 rounded-2xl shadow-2xl overflow-hidden">

          <!-- Step 1: Warning -->
          <div v-if="step === 1" class="p-6 md:p-8">
            <!-- Icon -->
            <div class="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
              <Icon name="ph:warning-diamond-fill" class="w-8 h-8 text-red-400" />
            </div>

            <h2 class="font-display text-xl font-bold text-white text-center mb-2">
              {{ $t('account.delete_title') }}
            </h2>
            <p class="text-text-secondary text-sm text-center mb-6">
              {{ $t('account.delete_warning') }}
            </p>

            <!-- Consequences list -->
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

          <!-- Step 2: Type confirmation -->
          <div v-if="step === 2" class="p-6 md:p-8">
            <div class="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
              <Icon name="ph:shield-warning-fill" class="w-8 h-8 text-red-400" />
            </div>

            <h2 class="font-display text-xl font-bold text-white text-center mb-2">
              {{ $t('account.delete_confirm') }}
            </h2>

            <p class="text-text-secondary text-sm text-center mb-4">
              {{ $t('account.delete_type_prompt') || typePromptFallback }}
            </p>

            <!-- Confirmation word -->
            <div class="bg-red-900/20 border border-red-800/30 rounded-lg px-4 py-2 text-center mb-4">
              <span class="text-red-400 font-mono font-bold text-lg tracking-wider">{{ confirmWord }}</span>
            </div>

            <div class="mb-6">
              <label for="delete-confirm-input" class="sr-only">{{ confirmWord }}</label>
              <input
                id="delete-confirm-input"
                name="confirm"
                v-model="userInput"
                type="text"
                class="input-field text-center font-mono tracking-wider"
                :placeholder="confirmWord"
                autocomplete="off"
                @paste.prevent
              />
            </div>

            <div class="flex gap-3">
              <button @click="step = 1" class="flex-1 py-3 rounded-lg bg-dark-secondary border border-dark-tertiary text-white font-medium hover:bg-dark-tertiary transition-colors">
                {{ $t('common.back') }}
              </button>
              <button
                @click="confirmDelete"
                :disabled="!isConfirmed || deleting"
                class="flex-1 py-3 rounded-lg font-medium transition-all"
                :class="isConfirmed ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-red-900/20 text-red-800 cursor-not-allowed'"
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
const { t, locale } = useI18n()

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'close': []; 'confirm': [] }>()

const step = ref(1)
const userInput = ref('')
const deleting = ref(false)

// Confirmation word per language
const confirmWords: Record<string, string> = {
  fr: 'SUPPRIMER',
  en: 'DELETE',
  es: 'ELIMINAR',
  nl: 'VERWIJDEREN',
  de: 'LÖSCHEN',
  ar: 'حذف',
}
const confirmWord = computed(() => confirmWords[locale.value] || 'DELETE')
const isConfirmed = computed(() => userInput.value.trim().toUpperCase() === confirmWord.value.toUpperCase())

const typePromptFallback = computed(() => {
  const w = confirmWord.value
  return locale.value === 'ar'
    ? `اكتب "${w}" لتأكيد الحذف`
    : `Tapez "${w}" pour confirmer`
})

const consequences = computed(() => [
  { icon: 'ph:x-circle', color: 'text-red-400', text: t('account.delete_consequence_1') || 'Your personal data will be permanently deleted' },
  { icon: 'ph:x-circle', color: 'text-red-400', text: t('account.delete_consequence_2') || 'Your saved addresses will be deleted' },
  { icon: 'ph:x-circle', color: 'text-red-400', text: t('account.delete_consequence_3') || 'You will lose access to your order history' },
  { icon: 'ph:warning', color: 'text-gold', text: t('account.delete_consequence_4') || 'Your previous orders will be kept anonymously for our records' },
  { icon: 'ph:info', color: 'text-text-secondary', text: t('account.delete_consequence_5') || 'This action cannot be undone' },
])

function cancel() {
  step.value = 1
  userInput.value = ''
  emit('close')
}

async function confirmDelete() {
  if (!isConfirmed.value) return
  deleting.value = true
  emit('confirm')
}

// Reset when modal opens
watch(() => props.visible, (v) => {
  if (v) { step.value = 1; userInput.value = ''; deleting.value = false }
})
</script>
