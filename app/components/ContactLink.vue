<script setup lang="ts">
import { ORGANISATION } from '~~/shared/organisation'

/**
 * The shop's phone, email or WhatsApp, as a link.
 *
 * Two problems, one component.
 *
 * The address and phone number already had a single source in
 * shared/organisation.ts, and ten pages hard-coded them anyway — the footer,
 * the contact page, and every legal page. Changing a phone number meant finding
 * thirty-one literals, and the Impressum a German customer reads could quietly
 * drift from the Organization data Google reads.
 *
 * The second problem only shows in Arabic. `+33 7 45 83 00 49` is a leading
 * PLUS, which the bidi algorithm resolves as a neutral, and in a right-to-left
 * paragraph a neutral takes the paragraph's direction — so the plus is laid out
 * to the RIGHT of the digits. Measured in a browser: with no isolation the plus
 * sits at x=1169 while the final digit sits at x=1061, i.e. after it. The
 * number a customer would dial is displayed wrong. `<bdi dir="ltr">` pins the
 * run and puts it back at x=1052, before the digits.
 *
 * Classes pass through to the <a> as fallthrough attributes, so callers keep
 * styling it exactly as they did.
 */
const props = defineProps<{
  kind: 'phone' | 'email' | 'whatsapp'
  /** Overrides the displayed text; the destination never changes. */
  label?: string
}>()

const HREF: Record<typeof props.kind, string> = {
  // tel: wants no spaces; the human-readable form keeps them.
  phone: `tel:${ORGANISATION.phone.replace(/\s/g, '')}`,
  email: `mailto:${ORGANISATION.email}`,
  whatsapp: ORGANISATION.whatsapp,
}

const TEXT: Record<typeof props.kind, string> = {
  phone: ORGANISATION.phone,
  email: ORGANISATION.email,
  whatsapp: ORGANISATION.whatsapp.replace('https://', ''),
}

const href = computed(() => HREF[props.kind])
const text = computed(() => props.label ?? TEXT[props.kind])
</script>

<template>
  <a :href="href" :rel="kind === 'whatsapp' ? 'noopener' : undefined">
    <!--
      A slot, because some callers put an icon and a translated word inside the
      link rather than the address itself. Those are not a `label` string; they
      are markup, and squeezing them into an attribute produces a broken tag.
      Slot content is NOT wrapped in <bdi>: it is translated prose that must
      follow the page direction, unlike the address, which must not.
    -->
    <slot><bdi dir="ltr">{{ text }}</bdi></slot>
  </a>
</template>
