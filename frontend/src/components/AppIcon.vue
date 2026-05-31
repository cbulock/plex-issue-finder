<script setup>
import { CindorIcon } from 'cindor-ui-vue'

const props = defineProps({
  label: {
    type: String,
    default: '',
  },
  name: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    default: 18,
  },
  strokeWidth: {
    type: Number,
    default: 2,
  },
})

</script>

<template>
  <CindorIcon
    :label="label || undefined"
    :name="name"
    :size="size"
    :stroke-width="strokeWidth"
    aria-hidden="true"
  />
</template>
