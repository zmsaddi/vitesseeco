<template>
  <div class="py-16 md:py-24">
    <div class="container-custom max-w-lg text-center">
      <div class="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
        <Icon name="ph:check-circle-fill" class="w-10 h-10 text-accent" />
      </div>

      <h1 class="font-display text-3xl font-bold text-white mb-3">{{ $t('checkout.order_confirmed') }}</h1>
      <p class="text-accent text-lg font-semibold mb-1">{{ $t('checkout.thank_you') }}</p>

      <p class="text-text-secondary text-lg mb-6">
        {{ $t('checkout.order_number') }}: <strong class="text-white bg-dark-secondary px-3 py-1 rounded-lg">{{ orderNumber }}</strong>
      </p>

      <!-- Order summary card -->
      <div class="card p-6 mt-6 text-left space-y-4">
        <div class="flex items-center gap-3 text-accent">
          <Icon name="ph:envelope-simple" class="w-5 h-5" />
          <span class="text-sm font-medium">{{ $t('checkout.email_confirmation') }}</span>
        </div>

        <div class="border-t border-dark-tertiary pt-4">
          <h2 class="font-display font-semibold text-white mb-3 flex items-center gap-2">
            <Icon name="ph:info" class="w-5 h-5 text-accent" />
            {{ $t('checkout.next_steps') }}
          </h2>
          <div class="text-text-secondary text-sm space-y-2">
            <p>{{ paymentInstructions }}</p>
          </div>
        </div>

        <!-- Store address if pickup -->
        <div class="bg-accent/5 border border-accent/20 rounded-lg p-4 flex items-start gap-3">
          <Icon name="ph:storefront" class="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <div class="text-sm">
            <p class="text-white font-medium">Vitesse Eco — Poitiers</p>
            <p class="text-text-secondary">32 Rue du Faubourg du Pont Neuf<br>86000 Poitiers, France</p>
          </div>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row gap-3 mt-8 justify-center">
        <NuxtLink v-if="auth.isLoggedIn" :to="localePath('/compte')" class="btn-primary flex items-center justify-center gap-2">
          <Icon name="ph:package" class="w-5 h-5" />
          {{ $t('account.orders') }}
        </NuxtLink>
        <NuxtLink :to="localePath('/produits')" class="btn-outline flex items-center justify-center gap-2">
          <Icon name="ph:shopping-bag" class="w-5 h-5" />
          {{ $t('cart.continue_shopping') }}
        </NuxtLink>
        <NuxtLink :to="localePath('/')" class="btn-outline flex items-center justify-center gap-2">
          <Icon name="ph:house" class="w-5 h-5" />
          {{ $t('checkout.back_to_home') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t, locale } = useI18n()
const localePath = useLocalePath()
const auth = useAuthStore()
const route = useRoute()

const orderNumber = computed(() => route.query.order as string || '')

useHead({ title: `${t('checkout.order_confirmed')} — Vitesse Eco` })

const instructions: Record<string, string> = {
  fr: 'Votre commande a été enregistrée avec succès ! Si vous avez choisi le retrait en magasin, présentez-vous avec votre numéro de commande. Pour la livraison, nous vous informerons par email de l\'avancement de votre commande.',
  en: 'Your order has been successfully registered! If you chose store pickup, please come with your order number. For delivery, we will inform you by email about your order progress.',
  es: '¡Tu pedido ha sido registrado con éxito! Si elegiste recoger en tienda, preséntate con tu número de pedido. Para la entrega, te informaremos por email del avance de tu pedido.',
  nl: 'Uw bestelling is succesvol geregistreerd! Als u hebt gekozen voor afhalen in de winkel, kom dan met uw bestelnummer. Voor bezorging informeren wij u per email over de voortgang.',
  de: 'Ihre Bestellung wurde erfolgreich registriert! Wenn Sie Abholung gewählt haben, kommen Sie bitte mit Ihrer Bestellnummer. Bei Lieferung informieren wir Sie per E-Mail über den Fortschritt.',
  ar: 'تم تسجيل طلبك بنجاح! إذا اخترت الاستلام من المتجر، احضر مع رقم طلبك. بالنسبة للتوصيل، سنبلغك عبر البريد الإلكتروني بتقدم طلبك.',
}
const paymentInstructions = computed(() => instructions[locale.value] || instructions.fr)
</script>
