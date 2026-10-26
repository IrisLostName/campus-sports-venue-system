<script setup lang="ts">
import { DISPLAY_ICONS, type DisplayIconName } from './displayIcons'

defineProps<{ name: DisplayIconName }>()
</script>

<template>
  <svg
    class="display-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="DISPLAY_ICONS[name]" />
  </svg>
</template>

<style scoped>
.display-icon {
  display: block;
  width: 1em;
  height: 1em;
}
</style>
