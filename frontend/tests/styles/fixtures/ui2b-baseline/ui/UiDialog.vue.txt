<script setup lang="ts">
// 居中对话框（docs/17 第 6 节，管理端）：与 UiSheet 同一套行为（含 Esc 关闭与 busy），只是居中显示。
import UiSheet from './UiSheet.vue'

withDefaults(defineProps<{
  open: boolean
  title: string
  busy?: boolean
  closeOnEscape?: boolean
}>(), {
  busy: false,
  closeOnEscape: true,
})

defineEmits<{ dismiss: [] }>()
</script>

<template>
  <UiSheet
    :open="open"
    :title="title"
    :busy="busy"
    :close-on-escape="closeOnEscape"
    placement="center"
    @dismiss="$emit('dismiss')"
  >
    <slot />
  </UiSheet>
</template>
