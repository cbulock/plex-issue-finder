<script setup>
import { computed } from 'vue'
import { CindorTag } from 'cindor-ui-vue'

const props = defineProps({
  severity: {
    type: String,
    default: 'accent',
  },
  value: {
    type: String,
    required: true,
  },
})

const tone = computed(() => {
  if (props.severity === 'success') return 'success'
  if (props.severity === 'danger') return 'danger'
  if (props.severity === 'warn' || props.severity === 'warning') return 'warning'
  return 'neutral'
})
</script>

<template>
  <CindorTag :tone="tone">
    {{ value }}
  </CindorTag>
</template>
