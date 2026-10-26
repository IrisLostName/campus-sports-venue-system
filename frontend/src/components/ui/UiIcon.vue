<script setup lang="ts">
// 内联图标（UI-2b，由 UI-2a 的 DisplayIcon 提升为共用）：装饰用，aria-hidden，名称由旁边的文字提供。
// 尺寸默认 1em（随字号），颜色取 currentColor；使用处只改字号或宽高与颜色。
import { ICONS, type UiIconName } from '../../utils/icons'

defineProps<{ name: UiIconName }>()
</script>

<template>
  <svg
    class="ui-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="ICONS[name]" />
  </svg>
</template>

<style scoped>
.ui-icon {
  display: block;
  width: 1em;
  height: 1em;
}
</style>
