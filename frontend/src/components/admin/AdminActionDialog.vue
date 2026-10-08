<script setup lang="ts">
// 管理端确认类对话框的外壳（FE-5 S4）：UiDialog + 错误提示 + 取消 / 确认按钮。对话框正文由默认插槽提供。
import UiBanner from '../ui/UiBanner.vue'
import UiButton from '../ui/UiButton.vue'
import UiDialog from '../ui/UiDialog.vue'

withDefaults(defineProps<{
  open: boolean
  title: string
  confirmLabel: string
  confirmVariant?: 'primary' | 'destructive'
  busy?: boolean
  error?: string | null
}>(), {
  confirmVariant: 'primary',
  busy: false,
  error: null,
})

defineEmits<{ confirm: []; dismiss: [] }>()
</script>

<template>
  <UiDialog
    :open="open"
    :title="title"
    @dismiss="$emit('dismiss')"
  >
    <div class="body">
      <slot />
    </div>
    <UiBanner
      v-if="error"
      tone="danger"
      role="alert"
    >
      {{ error }}
    </UiBanner>
    <div class="buttons">
      <UiButton
        variant="secondary"
        @click="$emit('dismiss')"
      >
        取消
      </UiButton>
      <UiButton
        :variant="confirmVariant"
        :loading="busy"
        @click="$emit('confirm')"
      >
        {{ confirmLabel }}
      </UiButton>
    </div>
  </UiDialog>
</template>

<style scoped>
.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.buttons {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
