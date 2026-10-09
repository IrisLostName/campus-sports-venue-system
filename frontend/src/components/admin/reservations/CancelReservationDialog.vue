<script setup lang="ts">
// 管理员取消预约（FE-5 P2）：原因必填（REASON_REQUIRED）。
import type { CancelState } from '../../../composables/adminReservationActions'
import UiTextField from '../../ui/UiTextField.vue'
import AdminActionDialog from '../AdminActionDialog.vue'

defineProps<{ state: CancelState | null }>()

defineEmits<{ patch: [change: Partial<CancelState>]; confirm: []; dismiss: [] }>()
</script>

<template>
  <AdminActionDialog
    :open="state !== null"
    title="取消预约"
    confirm-label="确认取消"
    confirm-variant="destructive"
    :busy="state?.busy ?? false"
    :error="state?.error ?? null"
    @confirm="$emit('confirm')"
    @dismiss="$emit('dismiss')"
  >
    <p class="summary">
      {{ state?.summary }}
    </p>
    <UiTextField
      :model-value="state?.reason ?? ''"
      label="取消原因（必填）"
      control="textarea"
      rows="3"
      @update:model-value="$emit('patch', { reason: $event })"
    />
  </AdminActionDialog>
</template>

<style scoped>
.summary {
  color: var(--color-text-secondary);
}
</style>
