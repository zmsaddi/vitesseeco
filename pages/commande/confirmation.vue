<template>
  <div class="py-16 md:py-24">
    <div class="container-custom max-w-lg text-center">
      <div class="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
        <Icon name="ph:check-circle-fill" class="w-10 h-10 text-accent" />
      </div>

      <h1 class="font-display text-3xl font-bold text-white mb-3">{{ $t('checkout.order_confirmed') }}</h1>

      <p class="text-text-secondary text-lg mb-2">
        {{ $t('checkout.order_number') }}: <strong class="text-accent">{{ orderNumber }}</strong>
      </p>

      <div class="card p-6 mt-8 text-left">
        <h2 class="font-display font-semibold text-white mb-3 flex items-center gap-2">
          <Icon name="ph:info" class="w-5 h-5 text-accent" />
          {{ $t('common.see_more') }}
        </h2>
        <div class="text-text-secondary text-sm space-y-2">
          <p>{{ paymentInstructions }}</p>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row gap-3 mt-8 justify-center">
        <NuxtLink v-if="auth.isLoggedIn" :to="localePath('/compte')" class="btn-primary">
          {{ $t('account.orders') }}
        </NuxtLink>
        <NuxtLink :to="localePath('/')" class="btn-outline">
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
  fr: 'Votre commande a été enregistrée. Si vous avez choisi le retrait en magasin, vous recevrez un email quand votre commande sera prête. Présentez-vous au 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers.',
  en: 'Your order has been registered. If you chose store pickup, you will receive an email when your order is ready. Visit us at 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers.',
  es: 'Tu pedido ha sido registrado. Si elegiste recoger en tienda, recibirás un email cuando esté listo. Visítanos en 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers.',
  nl: 'Je bestelling is geregistreerd. Als je hebt gekozen voor afhalen in de winkel, ontvang je een email wanneer je bestelling klaar is. Bezoek ons op 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers.',
  de: 'Ihre Bestellung wurde registriert. Wenn Sie Abholung im Geschäft gewählt haben, erhalten Sie eine E-Mail, wenn Ihre Bestellung fertig ist. Besuchen Sie uns: 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers.',
  ar: 'تم تسجيل طلبك. إذا اخترت الاستلام من المتجر، ستتلقى بريداً إلكترونياً عندما يكون طلبك جاهزاً. زرنا في 32 Rue du Faubourg du Pont Neuf, 86000 Poitiers.',
}
const paymentInstructions = computed(() => instructions[locale.value] || instructions.fr)
</script>
