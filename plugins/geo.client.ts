/**
 * IP → shipping-zone preset (owner flow decision 2026-07-05):
 * geolocation sets the DEFAULTS, the customer's typed address at checkout
 * decides the actual shipping methods.
 *
 * Runs after hydration; a Belgian first-time visitor sees the free-BE/NL
 * shipping bar in the cart drawer from the very first session, instead of
 * the French threshold.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', async () => {
    const { load } = useGeoCountry()
    const country = await load()
    useCartStore().initZoneFromGeo(country)
  })
})
