<template>
  <address class="text-sm not-italic space-y-0.5">
    <div class="font-medium">{{ fullName }}</div>
    <div v-if="address.address">{{ address.address }}</div>
    <div v-if="address.addressLine2">{{ address.addressLine2 }}</div>
    <div v-if="address.postalCode || address.city">{{ address.postalCode }} {{ address.city }}</div>
    <div v-if="address.country" class="text-on-surface-muted">{{ address.country }}</div>
    <div v-if="address.phone" class="text-on-surface-muted pt-1">{{ address.phone }}</div>
  </address>
</template>

<script setup lang="ts">
const props = defineProps<{
  address: {
    firstName?: string
    lastName?: string
    phone?: string
    address?: string
    addressLine2?: string
    city?: string
    postalCode?: string
    country?: string
  }
}>()

const fullName = computed(() =>
  [props.address.firstName, props.address.lastName].filter(Boolean).join(' ')
)
</script>
