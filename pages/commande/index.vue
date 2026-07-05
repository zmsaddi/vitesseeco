<template>
  <div>
    <!-- Compact header: title + guest reassurance (no hero band — checkout is for finishing, not browsing) -->
    <section class="pt-8 md:pt-10 pb-4">
      <div class="container-custom max-w-6xl">
        <h1 class="font-display text-2xl md:text-3xl font-black text-white leading-tight tracking-tight">{{ $t('checkout.title') }}</h1>
        <p class="text-text-secondary text-sm mt-1.5 flex items-center gap-2 flex-wrap">
          <Icon name="ph:lock-simple" class="w-3.5 h-3.5 text-accent shrink-0" />
          <span v-if="!auth.isLoggedIn">{{ $t('checkout.guest_hint') }}</span>
          <span v-else>{{ $t('trust.secure_payment') }}</span>
        </p>
      </div>
    </section>

    <div class="container-custom max-w-6xl pb-24 lg:pb-12">
      <!-- Known-issue #2: cart hydrates from localStorage, so SSR HTML can
           never match a filled cart. Checkout is client-only by design. -->
      <ClientOnly>
      <!-- Empty cart -->
      <div v-if="cart.isEmpty" class="text-center py-20">
        <Icon name="ph:shopping-cart" class="w-16 h-16 text-dark-tertiary mx-auto mb-4" />
        <p class="text-text-secondary mb-4">{{ $t('cart.empty') }}</p>
        <NuxtLink :to="localePath('/produits')" class="btn-primary inline-block">{{ $t('cart.empty_cta') }}</NuxtLink>
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- ═══ Left column: the 3 blocks ═══ -->
        <div class="lg:col-span-2 space-y-5">

          <!-- ① ADRESSE -->
          <div class="card p-5 md:p-6">
            <h2 class="font-display font-semibold text-white mb-4 flex items-center gap-2.5">
              <span class="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                :class="addressComplete ? 'bg-accent text-primary' : 'bg-accent/20 text-accent'">
                <Icon v-if="addressComplete" name="ph:check-bold" class="w-4 h-4" />
                <span v-else>1</span>
              </span>
              {{ isPickup ? $t('checkout.pickup_contact_title') : $t('checkout.shipping_address') }}
            </h2>

            <!-- Delivery MODE first — one clear fork instead of pickup hiding
                 inside the shipping-methods list (owner: page felt scattered) -->
            <div class="grid grid-cols-2 gap-2 mb-5">
              <button
                type="button"
                @click="setMode('delivery')"
                class="flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors min-h-touch"
                :class="mode === 'delivery' ? 'border-accent bg-accent/10 text-white' : 'border-dark-tertiary text-text-secondary hover:border-accent/50'"
              >
                <Icon name="ph:truck" class="w-5 h-5 shrink-0" :class="mode === 'delivery' ? 'text-accent' : ''" />
                {{ $t('checkout.mode_delivery') }}
              </button>
              <button
                type="button"
                @click="setMode('pickup')"
                class="flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors min-h-touch"
                :class="mode === 'pickup' ? 'border-accent bg-accent/10 text-white' : 'border-dark-tertiary text-text-secondary hover:border-accent/50'"
              >
                <Icon name="ph:storefront" class="w-5 h-5 shrink-0" :class="mode === 'pickup' ? 'text-accent' : ''" />
                {{ $t('checkout.mode_pickup') }}
              </button>
            </div>

            <!-- PICKUP: only name + phone needed -->
            <div v-if="isPickup" class="space-y-3">
              <p class="text-text-secondary text-sm flex items-start gap-2">
                <Icon name="ph:storefront" class="w-4 h-4 text-accent shrink-0 mt-0.5" />
                {{ $t('checkout.pickup_addr_hint') }}
              </p>
              <template v-if="!auth.isLoggedIn">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label for="co-fn" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.first_name') }}</label>
                    <input id="co-fn" v-model="addr.firstName" @blur="touch('firstName')" type="text" class="input-field" :class="fieldError('firstName', addr.firstName) ? 'border-red-500' : ''" required />
                  </div>
                  <div>
                    <label for="co-ln" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.last_name') }}</label>
                    <input id="co-ln" v-model="addr.lastName" @blur="touch('lastName')" type="text" class="input-field" :class="fieldError('lastName', addr.lastName) ? 'border-red-500' : ''" required />
                  </div>
                </div>
                <div>
                  <label for="co-phone" class="text-sm font-medium text-text-secondary block mb-1.5">{{ $t('checkout.phone') }}</label>
                  <input id="co-phone" v-model="addr.phone" type="tel" class="input-field" />
                </div>
              </template>
              <p v-else class="text-white text-sm flex items-center gap-2">
                <Icon name="ph:check-circle" class="w-4 h-4 text-accent" /> {{ auth.user?.firstName }} {{ auth.user?.lastName }}
              </p>
            </div>

            <!-- DELIVERY address -->
            <div v-else>
              <div v-if="loadingAddresses" class="flex items-center gap-2 text-text-secondary text-sm py-4">
                <Icon name="ph:spinner" class="w-4 h-4 animate-spin" /> {{ $t('common.loading') }}
              </div>

              <!-- Saved addresses -->
              <div v-else-if="savedAddresses.length && !showNewForm" class="space-y-2">
                <label
                  v-for="a in savedAddresses" :key="a.id" :for="`addr-${a.id}`"
                  class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
                  :class="selectedAddressId === a.id ? 'border-accent bg-accent/5' : 'border-dark-tertiary'"
                >
                  <input :id="`addr-${a.id}`" type="radio" :value="a.id" v-model="selectedAddressId" class="mt-1 accent-accent" />
                  <div class="text-sm flex-1">
                    <p class="text-white font-medium">{{ a.firstName }} {{ a.lastName }}</p>
                    <p class="text-text-secondary">{{ a.address }}, {{ a.postalCode }} {{ a.city }}</p>
                  </div>
                </label>
                <button @click="showNewForm = true" class="w-full p-3 rounded-lg border border-dashed border-dark-tertiary text-accent text-sm hover:border-accent transition-colors flex items-center justify-center gap-2 min-h-touch">
                  <Icon name="ph:plus" class="w-4 h-4" /> {{ $t('account.add_address') }}
                </button>
              </div>

              <!-- New address form -->
              <div v-else class="space-y-3">
                <div>
                  <label for="co-country" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.country') }}</label>
                  <select id="co-country" v-model="addr.country" class="input-field">
                    <option value="FR">🇫🇷 France</option>
                    <option value="BE">🇧🇪 Belgique</option>
                    <option value="LU">🇱🇺 Luxembourg</option>
                    <option value="DE">🇩🇪 Deutschland</option>
                    <option value="NL">🇳🇱 Nederland</option>
                    <option value="ES">🇪🇸 España</option>
                  </select>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label for="co-fn" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.first_name') }}</label>
                    <input id="co-fn" v-model="addr.firstName" @blur="touch('firstName')" type="text" class="input-field" :class="fieldError('firstName', addr.firstName) ? 'border-red-500' : ''" required />
                    <p v-if="fieldError('firstName', addr.firstName)" class="text-red-400 text-xs mt-1">{{ $t('checkout.first_name') }} {{ $t('common.error') }}</p>
                  </div>
                  <div>
                    <label for="co-ln" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.last_name') }}</label>
                    <input id="co-ln" v-model="addr.lastName" @blur="touch('lastName')" type="text" class="input-field" :class="fieldError('lastName', addr.lastName) ? 'border-red-500' : ''" required />
                  </div>
                </div>
                <div>
                  <label for="co-phone" class="text-sm font-medium text-text-secondary block mb-1.5">{{ $t('checkout.phone') }}</label>
                  <input id="co-phone" v-model="addr.phone" type="tel" class="input-field" />
                </div>
                <div>
                  <label for="co-addr" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.address') }}</label>
                  <div class="relative">
                    <input id="co-addr" ref="coInput" v-model="addr.address" @input="onCoInput" @blur="touch('address')" type="text" class="input-field" :class="fieldError('address', addr.address) ? 'border-red-500' : ''" autocomplete="off" required />
                    <div v-if="coLoading" class="absolute right-3 top-1/2 -translate-y-1/2"><Icon name="ph:spinner" class="w-4 h-4 text-accent animate-spin" /></div>
                    <div v-if="coSuggestions.length" class="absolute z-50 left-0 right-0 mt-1 bg-dark-secondary border border-dark-tertiary rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      <button v-for="s in coSuggestions" :key="s.place_id" type="button" @mousedown.prevent="pickCo(s)" class="w-full text-start px-3 py-2.5 text-sm text-text-secondary hover:bg-dark-tertiary hover:text-white flex items-start gap-2">
                        <Icon name="ph:map-pin" class="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent" /><span>{{ s.description }}</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label for="co-zip" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.postal_code') }}</label>
                    <input id="co-zip" v-model="addr.postalCode" @blur="touch('postalCode')" type="text" class="input-field" :class="fieldError('postalCode', addr.postalCode) ? 'border-red-500' : ''" required />
                    <p v-if="fieldError('postalCode', addr.postalCode)" class="text-red-400 text-xs mt-1">{{ $t('checkout.postal_code') }} {{ $t('common.error') }}</p>
                  </div>
                  <div>
                    <label for="co-city" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.city') }}</label>
                    <input id="co-city" v-model="addr.city" @blur="touch('city')" type="text" class="input-field" :class="fieldError('city', addr.city) ? 'border-red-500' : ''" required />
                  </div>
                </div>
                <label v-if="auth.isLoggedIn" class="flex items-center gap-2 text-text-secondary text-xs cursor-pointer">
                  <input type="checkbox" v-model="saveAddr" class="accent-accent" /> {{ $t('common.save') }}
                </label>
                <button v-if="savedAddresses.length" @click="showNewForm = false" class="text-text-secondary text-xs hover:text-accent">← {{ $t('common.back') }}</button>
              </div>

              <!-- Billing: folded into block ① so the page stays 3 blocks -->
              <div class="mt-4 pt-4 border-t border-dark-tertiary">
                <label class="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" v-model="billingSameAsShipping" class="accent-accent w-4 h-4" />
                  <span class="text-white text-sm">{{ $t('checkout.same_as_shipping') }}</span>
                </label>
                <div v-if="!billingSameAsShipping" class="space-y-3 mt-4">
                  <div>
                    <label for="bill-country" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.country') }}</label>
                    <select id="bill-country" v-model="billing.country" class="input-field">
                      <option value="FR">🇫🇷 France</option>
                      <option value="BE">🇧🇪 Belgique</option>
                      <option value="LU">🇱🇺 Luxembourg</option>
                      <option value="DE">🇩🇪 Deutschland</option>
                      <option value="NL">🇳🇱 Nederland</option>
                      <option value="ES">🇪🇸 España</option>
                    </select>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label for="bill-fn" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.first_name') }}</label>
                      <input id="bill-fn" v-model="billing.firstName" type="text" class="input-field" required />
                    </div>
                    <div>
                      <label for="bill-ln" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.last_name') }}</label>
                      <input id="bill-ln" v-model="billing.lastName" type="text" class="input-field" required />
                    </div>
                  </div>
                  <div>
                    <label for="bill-addr" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.address') }}</label>
                    <input id="bill-addr" v-model="billing.address" type="text" class="input-field" required />
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label for="bill-zip" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.postal_code') }}</label>
                      <input id="bill-zip" v-model="billing.postalCode" type="text" class="input-field" required />
                    </div>
                    <div>
                      <label for="bill-city" class="text-sm font-medium text-text-secondary block mb-1.5 required">{{ $t('checkout.city') }}</label>
                      <input id="bill-city" v-model="billing.city" type="text" class="input-field" required />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ② LIVRAISON -->
          <div class="card p-5 md:p-6">
            <h2 class="font-display font-semibold text-white mb-4 flex items-center gap-2.5">
              <span class="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                :class="selectedShipping ? 'bg-accent text-primary' : 'bg-accent/20 text-accent'">
                <Icon v-if="selectedShipping" name="ph:check-bold" class="w-4 h-4" />
                <span v-else>2</span>
              </span>
              {{ $t('shipping.title') }}
            </h2>
            <!-- The methods follow the DESTINATION address entered in step ① —
                 say so, or a gift buyer never realizes options change per country. -->
            <p v-if="!isPickup && deliveryAddressReady" class="text-text-secondary text-xs mb-3 flex items-center gap-1.5">
              <Icon name="ph:map-pin" class="w-3.5 h-3.5 text-accent shrink-0" />
              {{ $t('checkout.shipping_dest') }} <span class="text-white font-medium">{{ countryLabel(addr.country) }}</span>
              — {{ $t('checkout.shipping_dest_hint') }}
            </p>
            <!-- Address not entered yet → delivery options wait for it -->
            <div v-if="!isPickup && !deliveryAddressReady" class="bg-dark-tertiary/30 border border-dark-tertiary rounded-lg p-3 mb-3 flex items-start gap-2.5">
              <Icon name="ph:arrow-up" class="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p class="text-text-secondary text-xs">{{ $t('checkout.enter_address_first') }}</p>
            </div>
            <!-- Country has no home delivery configured yet -->
            <div v-if="!isPickup && deliveryAddressReady && !visibleShippingMethods.length" class="bg-gold/10 border border-gold/30 rounded-lg p-3 mb-3 flex items-start gap-2.5">
              <Icon name="ph:info" class="w-4 h-4 text-gold shrink-0 mt-0.5" />
              <p class="text-text-secondary text-xs">{{ $t('checkout.no_delivery_country') }}</p>
            </div>
            <div v-if="!isPickup && visibleShippingMethods?.length" class="space-y-2">
              <label
                v-for="method in visibleShippingMethods"
                :key="method.code"
                :for="`ship-${method.code}`"
                class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors min-h-touch"
                :class="selectedShipping === method.code ? 'border-accent bg-accent/5' : 'border-dark-tertiary'"
              >
                <input :id="`ship-${method.code}`" type="radio" :value="method.code" v-model="selectedShipping" class="mt-1 accent-accent" />
                <div class="flex-1">
                  <div class="flex justify-between gap-2">
                    <span class="text-white text-sm font-medium">{{ l(method.name) }}</span>
                    <span class="text-accent text-sm font-bold whitespace-nowrap">
                      {{ getShippingPrice(method) === 0 ? $t('shipping.free') : getShippingPrice(method) + $t('common.currency') }}
                    </span>
                  </div>
                  <p class="text-text-secondary text-xs mt-0.5">{{ l(method.description) }}</p>
                </div>
              </label>
            </div>
            <div v-else class="flex items-center gap-2 text-text-secondary text-sm py-2">
              <Icon name="ph:spinner" class="w-4 h-4 animate-spin" /> {{ $t('common.loading') }}
            </div>

            <!-- Store info when pickup selected -->
            <div v-if="isPickup" class="bg-accent/5 border border-accent/20 rounded-lg p-4 mt-3">
              <div class="flex items-start gap-3">
                <Icon name="ph:storefront" class="w-6 h-6 text-accent shrink-0 mt-0.5" />
                <div>
                  <p class="text-white font-medium text-sm">Vitesse Eco — Poitiers</p>
                  <p class="text-text-secondary text-sm mt-1">32 Rue du Faubourg du Pont Neuf<br>86000 Poitiers, France</p>
                  <p class="text-text-secondary text-xs mt-2">{{ $t('contact.hours_text') }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- ③ PAIEMENT -->
          <div class="card p-5 md:p-6">
            <h2 class="font-display font-semibold text-white mb-4 flex items-center gap-2.5">
              <span class="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                :class="selectedPayment ? 'bg-accent text-primary' : 'bg-accent/20 text-accent'">
                <Icon v-if="selectedPayment" name="ph:check-bold" class="w-4 h-4" />
                <span v-else>3</span>
              </span>
              {{ $t('checkout.payment_method') }}
            </h2>
            <div v-if="paymentMethods?.length" class="space-y-2">
              <label v-for="m in paymentMethods" :key="m.code" :for="`pay-${m.code}`" class="flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors min-h-touch" :class="selectedPayment === m.code ? 'border-accent bg-accent/5' : 'border-dark-tertiary'">
                <input :id="`pay-${m.code}`" type="radio" :value="m.code" v-model="selectedPayment" class="mt-1 accent-accent" />
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <Icon :name="m.icon || 'ph:credit-card'" class="w-5 h-5 text-accent" />
                    <span class="text-white font-medium text-sm">{{ l(m.name) }}</span>
                  </div>
                  <p class="text-text-secondary text-xs mt-1">{{ l(m.description) }}</p>
                </div>
              </label>
            </div>
            <div v-if="selectedPaymentData?.instructions" class="mt-4 bg-accent/5 border border-accent/20 rounded-lg p-4">
              <p class="text-text-secondary text-sm whitespace-pre-line">{{ l(selectedPaymentData.instructions) }}</p>
            </div>
          </div>
        </div>

        <!-- ═══ Right: summary ═══ -->
        <div>
          <div id="checkout-summary" class="card p-5 md:p-6 lg:sticky lg:top-24 space-y-4 scroll-mt-24">
            <h2 class="font-display font-semibold text-white flex items-center gap-2">
              <Icon name="ph:receipt" class="w-5 h-5 text-accent" /> {{ $t('checkout.step_review') }}
            </h2>
            <div class="space-y-2">
              <div v-for="item in cart.items" :key="`${item.productId}-${item.sku}`" class="flex justify-between text-sm">
                <!-- New tab: re-checking a product must never lose the typed
                     address / checkout state. -->
                <span class="text-white truncate flex-1">
                  <NuxtLink
                    :to="localePath(`/produits/${item.slug}`)"
                    target="_blank"
                    class="hover:text-accent transition-colors"
                  >{{ l(item.name) }}</NuxtLink>
                  <span class="text-text-secondary">× {{ item.quantity }}</span>
                </span>
                <span class="text-white font-medium ml-2 whitespace-nowrap">{{ (item.price * item.quantity).toFixed(2) }}{{ $t('common.currency') }}</span>
              </div>
            </div>
            <div class="border-t border-dark-tertiary pt-3 space-y-2 text-sm">
              <div class="flex justify-between"><span class="text-text-secondary">{{ $t('cart.subtotal') }}</span><span class="text-white">{{ cart.subtotal }}{{ $t('common.currency') }}</span></div>
              <div class="flex justify-between"><span class="text-text-secondary">{{ $t('cart.shipping') }}</span><span :class="currentShippingCost === 0 ? 'text-accent' : 'text-white'">{{ currentShippingCost === 0 ? $t('shipping.free') : currentShippingCost + $t('common.currency') }}</span></div>
              <div v-if="cart.discount > 0" class="flex justify-between"><span class="text-accent">{{ $t('cart.discount') }}</span><span class="text-accent">-{{ cart.discount }}{{ $t('common.currency') }}</span></div>
              <div class="flex justify-between text-lg font-bold border-t border-dark-tertiary pt-2"><span class="text-white">{{ $t('cart.total') }}</span><span class="text-accent">{{ orderTotal }}{{ $t('common.currency') }}</span></div>
            </div>
            <p v-if="orderError" class="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg" role="alert">{{ orderError }}</p>
            <ClientOnly><TurnstileWidget @verify="tk => turnstileToken = tk" /></ClientOnly>
            <!-- PayPal Smart Buttons — the PayPal popup IS the confirmation step -->
            <PayPalButtons
              v-if="selectedPayment === 'paypal' && canOrder && paypalOrderPayload"
              :order-payload="paypalOrderPayload"
              :disabled="placing"
              @success="onPayPalSuccess"
              @error="(m) => orderError = m"
              @cancel="orderError = $t('checkout.paypal_cancelled')"
            />
            <template v-else>
              <div v-if="showConfirmation" class="bg-accent/5 border border-accent/30 rounded-lg p-4 space-y-3">
                <p class="text-white text-sm font-medium">{{ $t('checkout.step_review') }}</p>
                <p class="text-text-secondary text-xs">{{ cart.items.length }} {{ $t('products.results') }} — {{ orderTotal }}{{ $t('common.currency') }}</p>
                <div class="flex gap-2">
                  <button @click="placeOrder" :disabled="placing" class="btn-primary flex-1 py-3 text-sm disabled:opacity-50">
                    <span v-if="placing" class="flex items-center justify-center gap-2"><Icon name="ph:spinner" class="w-4 h-4 animate-spin" /></span>
                    <span v-else>{{ $t('checkout.place_order') }}</span>
                  </button>
                  <button @click="showConfirmation = false" class="btn-secondary px-4 py-3 text-sm">{{ $t('common.back') }}</button>
                </div>
              </div>
              <button v-else @click="requestConfirmation" :disabled="!canOrder || placing" class="btn-primary w-full py-4 text-lg disabled:opacity-50">
                <span v-if="placing" class="flex items-center justify-center gap-2"><Icon name="ph:spinner" class="w-5 h-5 animate-spin" /></span>
                <span v-else>{{ $t('checkout.place_order') }}</span>
              </button>
            </template>
            <!-- P1-08: never a silently disabled button -->
            <p v-if="disabledReason" class="text-text-secondary text-xs text-center mt-2 flex items-center justify-center gap-1.5" role="status">
              <Icon name="ph:info" class="w-3.5 h-3.5 shrink-0" />
              <span>{{ disabledReason }}</span>
            </p>
            <div class="flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-dark-tertiary mt-3">
              <span class="flex items-center gap-1.5 text-xs text-text-secondary"><Icon name="ph:lock-simple" class="w-3.5 h-3.5 text-accent" /> {{ $t('trust.secure_payment') }}</span>
              <span class="flex items-center gap-1.5 text-xs text-text-secondary"><Icon name="ph:shield-check" class="w-3.5 h-3.5 text-accent" /> {{ $t('trust.warranty') }}</span>
            </div>
          </div>
        </div>
      </div>
      <template #fallback>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6" aria-hidden="true">
          <div class="lg:col-span-2 space-y-5">
            <div class="card p-6 h-48 animate-pulse" />
            <div class="card p-6 h-32 animate-pulse" />
            <div class="card p-6 h-32 animate-pulse" />
          </div>
          <div class="card p-6 h-80 animate-pulse" />
        </div>
      </template>
      </ClientOnly>
    </div>

    <!-- Mobile sticky pay bar: total always visible; tapping scrolls to the
         summary (PayPal buttons cannot be duplicated). pe leaves room for the
         chat launcher. -->
    <ClientOnly>
    <div v-if="!cart.isEmpty" class="lg:hidden fixed bottom-0 inset-x-0 z-header bg-dark-secondary/95 backdrop-blur border-t border-dark-tertiary px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] pe-20">
      <a href="#checkout-summary" class="flex items-center justify-between gap-3">
        <span>
          <span class="block text-xs text-text-secondary leading-tight">{{ $t('cart.total') }}</span>
          <span class="block text-accent font-bold text-lg leading-tight">{{ orderTotal }}{{ $t('common.currency') }}</span>
        </span>
        <span class="btn-primary px-5 py-2.5 text-sm">{{ $t('checkout.place_order') }} ↓</span>
      </a>
    </div>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const l = useLocalizedField()
const cart = useCartStore()
const auth = useAuthStore()

useHead({ title: `${t('checkout.title')} — Vitesse Eco`, meta: [{ name: 'robots', content: 'noindex' }] })

const selectedShipping = ref(cart.shippingCode || '')
const selectedAddressId = ref('')
const selectedPayment = ref('')
const placing = ref(false)
const orderError = ref('')
const turnstileToken = ref('')
const showConfirmation = ref(false)
const showNewForm = ref(false)
const saveAddr = ref(true)
const loadingAddresses = ref(true)

const addr = reactive({ firstName: auth.user?.firstName || '', lastName: auth.user?.lastName || '', phone: '', address: '', postalCode: '', city: '', country: cart.shippingZone || 'FR' })

// IP preset resolving after this page mounted: adopt it only while the
// form is still untouched — a typed address always wins over geolocation.
watch(() => cart.shippingZone, (zone) => {
  if (!zone || selectedAddressId.value) return
  if (!addr.address && !addr.postalCode && !addr.city) addr.country = zone
})
const touched = reactive<Record<string, boolean>>({})
function touch(field: string) { touched[field] = true }
function fieldError(field: string, value: string): string {
  if (!touched[field]) return ''
  if (!value?.trim()) return t('common.error')
  return ''
}
const billingSameAsShipping = ref(true)
const billing = reactive({ firstName: '', lastName: '', address: '', postalCode: '', city: '', country: 'FR' })

const isPickup = computed(() => selectedShipping.value === 'pickup')

// Block ① completion drives its number → checkmark.
const addressComplete = computed(() => {
  if (isPickup.value) {
    return auth.isLoggedIn || !!(addr.firstName?.trim() && addr.lastName?.trim())
  }
  if (selectedAddressId.value && !showNewForm.value) return true
  return !!(showNewForm.value && addr.address && addr.city && addr.postalCode && addr.firstName && addr.lastName)
})

// Shipping — methods follow the customer's destination country (U-X1).
// The server falls back to FR methods when a zone has no configuration yet,
// so switching country can never leave the customer with zero options.
const shippingZone = computed(() => (isPickup.value ? 'FR' : addr.country || 'FR'))

const COUNTRY_LABELS: Record<string, string> = {
  FR: '🇫🇷 France', BE: '🇧🇪 Belgique', LU: '🇱🇺 Luxembourg',
  DE: '🇩🇪 Deutschland', NL: '🇳🇱 Nederland', ES: '🇪🇸 España',
}
const countryLabel = (c: string) => COUNTRY_LABELS[c] || c

// Owner flow (2026-07-05): pickup vs delivery is ONE clear fork up front;
// in delivery mode the customer enters the address FIRST and only then do
// the delivery options for that address appear.
const mode = ref<'delivery' | 'pickup'>(cart.shippingCode === 'pickup' ? 'pickup' : 'delivery')
function setMode(m: 'delivery' | 'pickup') {
  mode.value = m
  if (m === 'pickup') selectedShipping.value = 'pickup'
  else if (selectedShipping.value === 'pickup') selectedShipping.value = ''
}

const deliveryAddressReady = computed(() => {
  if (selectedAddressId.value && !showNewForm.value) return true
  return !!(addr.address && addr.city && addr.postalCode)
})
// Pickup is a MODE now, never a row in the methods list.
const deliveryMethods = computed(() => (shippingMethods.value || []).filter((m: any) => m.code !== 'pickup'))
const visibleShippingMethods = computed(() => (deliveryAddressReady.value ? deliveryMethods.value : []))
const { data: shippingData } = useFetch('/api/shipping/methods', {
  query: computed(() => ({ zone: shippingZone.value })),
})
const shippingMethods = computed(() => (shippingData.value as any)?.methods || [])
function getShippingPrice(m: any) { return m.freeAbove && cart.subtotal >= m.freeAbove ? 0 : m.price || 0 }
const currentShippingCost = computed(() => { const m = shippingMethods.value.find((m: any) => m.code === selectedShipping.value); return m ? getShippingPrice(m) : 0 })
const orderTotal = computed(() => Math.max(0, cart.subtotal - cart.discount + currentShippingCost.value))

// Payment
const { data: paymentData } = useFetch('/api/payment/methods')
const paymentMethods = computed(() => (paymentData.value as any)?.methods || [])
const selectedPaymentData = computed(() => paymentMethods.value.find((m: any) => m.code === selectedPayment.value))

// P1-01 / P1-02: auto-select when exactly one option is available so the user
// is never blocked by a hidden default. Only auto-selects if nothing is yet
// selected (respects manual choice on subsequent renders).
watch(visibleShippingMethods, (methods) => {
  if (mode.value === 'delivery' && methods.length === 1 && !selectedShipping.value) {
    selectedShipping.value = methods[0].code
  }
}, { immediate: true })

watch(paymentMethods, (methods) => {
  if (methods.length === 1 && !selectedPayment.value) {
    selectedPayment.value = methods[0].code
  }
}, { immediate: true })

// Addresses
const savedAddresses = ref<any[]>([])
onMounted(async () => {
  if (auth.isLoggedIn) {
    try {
      const { addresses } = await $fetch<any>('/api/addresses')
      savedAddresses.value = addresses
      if (addresses.length) { selectedAddressId.value = (addresses.find((a: any) => a.isDefault) || addresses[0]).id }
      else { showNewForm.value = true }
    } catch {}
  } else { showNewForm.value = true }
  loadingAddresses.value = false
})

// Autocomplete
const coInput = ref<HTMLInputElement>()
const coSuggestions = ref<any[]>([])
const coLoading = ref(false)
let coTimer: ReturnType<typeof setTimeout>
watch(() => addr.country, () => { addr.address = ''; addr.city = ''; addr.postalCode = ''; coSuggestions.value = [] })
function onCoInput() {
  clearTimeout(coTimer)
  if (addr.address.length < 3) { coSuggestions.value = []; coLoading.value = false; return }
  coLoading.value = true
  coTimer = setTimeout(async () => {
    try { const d = await $fetch<any>('/api/places/autocomplete', { query: { input: addr.address, country: addr.country.toLowerCase() } }); coSuggestions.value = d.predictions || [] }
    catch { coSuggestions.value = [] } finally { coLoading.value = false }
  }, 400)
}
async function pickCo(s: any) {
  coSuggestions.value = []; addr.address = s.structured_formatting?.main_text || s.description
  try { const d = await $fetch<any>('/api/places/details', { query: { place_id: s.place_id } }); if (d.address) { addr.address = d.address; addr.city = d.city || ''; addr.postalCode = d.postalCode || '' } } catch {}
}

// Can order?
const canOrder = computed(() => {
  if (!selectedShipping.value || !selectedPayment.value || !turnstileToken.value) return false
  return addressComplete.value
})

// P1-08: explicit reason shown to the user when the submit button is disabled.
const disabledReason = computed(() => {
  if (canOrder.value) return ''
  if (!selectedShipping.value) return t('checkout.disabled_no_shipping')
  if (isPickup.value && !auth.isLoggedIn) {
    if (!addr.firstName?.trim() || !addr.lastName?.trim()) return t('checkout.disabled_no_name')
  } else if (!isPickup.value) {
    if (showNewForm.value) {
      const missing = ['firstName', 'lastName', 'address', 'city', 'postalCode']
        .filter((k) => !(addr as any)[k]?.trim())
      if (missing.length) return t('checkout.disabled_no_address')
    } else if (!selectedAddressId.value) {
      return t('checkout.disabled_no_address')
    }
  }
  if (!selectedPayment.value) return t('checkout.disabled_no_payment')
  if (!turnstileToken.value) return t('checkout.disabled_no_turnstile')
  return ''
})

// Confirmation step before placing order
function requestConfirmation() {
  if (!canOrder.value) return
  orderError.value = ''
  showConfirmation.value = true
}

// Build the shipping address from whichever input the user filled in. Shared
// between placeOrder() (in-store path) and the PayPal flow.
function resolveShippingAddress(): any | null {
  if (isPickup.value) {
    const fn = (auth.user?.firstName?.trim() || addr.firstName?.trim() || '')
    const ln = (auth.user?.lastName?.trim() || addr.lastName?.trim() || '')
    const ph = (auth.user?.phone?.trim() || addr.phone?.trim() || undefined)
    return { firstName: fn, lastName: ln, phone: ph, address: '32 Rue du Faubourg du Pont Neuf', city: 'Poitiers', postalCode: '86000', country: 'FR' }
  }
  if (selectedAddressId.value && !showNewForm.value) {
    const a = savedAddresses.value.find(a => a.id === selectedAddressId.value)
    if (!a) return null
    return { firstName: a.firstName, lastName: a.lastName, phone: a.phone, address: a.address, city: a.city, postalCode: a.postalCode, country: a.country }
  }
  return { ...addr }
}

// Reactive payload PayPalButtons consumes. Recomputes when any checkout
// field changes; PayPalButtons re-renders on change so the next click reflects
// the latest state. `null` blocks render until the form is valid.
const paypalOrderPayload = computed(() => {
  if (!canOrder.value || !turnstileToken.value) return null
  const shippingAddress = resolveShippingAddress()
  if (!shippingAddress) return null
  return {
    items: cart.items.map(i => ({ productId: i.productId, sku: i.sku, quantity: i.quantity })),
    shippingCode: selectedShipping.value,
    shippingAddress,
    billingAddress: billingSameAsShipping.value || isPickup.value ? shippingAddress : { ...billing },
    promoCode: cart.promoCode || undefined,
    turnstileToken: turnstileToken.value,
  }
})

async function onPayPalSuccess(orderNumber: string) {
  // The PayPal flow does not pre-save the new address (we don't know if the
  // user will complete the PayPal popup until they do). Save it now on a
  // successful capture, same condition placeOrder() uses for the in-store path.
  if (!isPickup.value && auth.isLoggedIn && saveAddr.value && showNewForm.value && !selectedAddressId.value) {
    try { await $fetch('/api/addresses', { method: 'POST', body: { ...addr, isDefault: !savedAddresses.value.length } }) } catch {}
  }
  cart.clearCart()
  navigateTo(localePath(`/commande/confirmation?order=${orderNumber}`))
}

// Place order
async function placeOrder() {
  if (!canOrder.value) return
  showConfirmation.value = false
  placing.value = true; orderError.value = ''

  const shippingAddress = resolveShippingAddress()
  if (!shippingAddress) { orderError.value = t('checkout.disabled_no_address'); placing.value = false; return }

  // Persist a newly typed address for logged-in users before ordering.
  if (!isPickup.value && !selectedAddressId.value && showNewForm.value && auth.isLoggedIn && saveAddr.value) {
    try { await $fetch('/api/addresses', { method: 'POST', body: { ...addr, isDefault: !savedAddresses.value.length } }) } catch {}
  }

  try {
    const stockCheck = await cart.checkStock()
    if (!stockCheck.allValid) { orderError.value = stockCheck.messages.join(', '); placing.value = false; return }
    const result = await $fetch<any>('/api/orders/create', {
      method: 'POST',
      body: {
        items: cart.items.map(i => ({ productId: i.productId, sku: i.sku, quantity: i.quantity })),
        shippingCode: selectedShipping.value,
        paymentCode: selectedPayment.value,
        shippingAddress,
        billingAddress: billingSameAsShipping.value || isPickup.value ? shippingAddress : { ...billing },
        promoCode: cart.promoCode || undefined,
        turnstileToken: turnstileToken.value,
      },
    })
    // PSP redirect flows (card/Klarna when wired): the adapter returns a
    // hosted-payment URL in clientPayload — hand the browser over BEFORE
    // clearing the cart, so an abandoned payment keeps the cart intact.
    const redirectUrl = result?.clientPayload?.redirectUrl
    if (typeof redirectUrl === 'string' && redirectUrl.startsWith('https://')) {
      window.location.href = redirectUrl
      return
    }
    cart.clearCart()
    navigateTo(localePath(`/commande/confirmation?order=${result.orderNumber}`))
  } catch (e: any) { orderError.value = e.data?.message || t('common.error') }
  finally { placing.value = false }
}
</script>
