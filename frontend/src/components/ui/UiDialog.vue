<script setup lang="ts">
// 居中对话框（docs/17 第 6 节，管理端）：与 UiSheet 同一套行为，只是居中显示。
import UiSheet from './UiSheet.vue'

defineProps<{ open: boolean; title: string }>()

defineEmits<{ dismiss: [] }>()
</script>

<template>
  <UiSheet
    :open="open"
    :title="title"
    placement="center"
    @dismiss="$emit('dismiss')"
  >
    <slot />
  </UiSheet>
</template>
