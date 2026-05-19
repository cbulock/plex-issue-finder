<script setup>
import { CindorLink } from 'cindor-ui-vue'

defineProps({
  href: {
    type: String,
    required: true,
  },
  rel: {
    type: String,
    default: 'noopener noreferrer',
  },
  target: {
    type: String,
    default: '_blank',
  },
})
</script>

<template>
  <CindorLink :href="href" :rel="rel" :target="target">
    <slot />
  </CindorLink>
</template>
