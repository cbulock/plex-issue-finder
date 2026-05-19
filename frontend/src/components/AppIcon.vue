<script setup>
import { computed } from 'vue'
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

const PRIME_TO_CINDOR_ICON = {
  'pi-home': 'home',
  'pi-cog': 'settings',
  'pi-clock': 'clock',
  'pi-stopwatch': 'clock-3',
  'pi-video': 'video',
  'pi-search': 'search',
  'pi-list': 'list',
  'pi-arrow-right': 'arrow-right',
  'pi-play-circle': 'circle-play',
  'pi-database': 'database',
  'pi-th-large': 'layout-grid',
  'pi-sync': 'refresh-cw',
  'pi-sliders-h': 'sliders-horizontal',
  'pi-check': 'check',
  'pi-check-circle': 'circle-check',
  'pi-play': 'play',
  'pi-refresh': 'refresh-cw',
  'pi-times': 'x',
  'pi-exclamation-circle': 'triangle-alert',
  'pi-exclamation-triangle': 'triangle-alert',
  'pi-question-circle': 'circle-help',
  'pi-eye': 'eye',
  'pi-external-link': 'external-link',
}

const resolvedName = computed(() => PRIME_TO_CINDOR_ICON[props.name] || props.name)
</script>

<template>
  <CindorIcon
    :label="label || undefined"
    :name="resolvedName"
    :size="size"
    :stroke-width="strokeWidth"
    aria-hidden="true"
  />
</template>
