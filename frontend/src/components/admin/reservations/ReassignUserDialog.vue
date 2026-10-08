<script setup lang="ts">
// 人员改派（FE-5 P2）：场馆管理员没有查询用户列表的接口（adminListUsers 仅系统管理员），所以直接输入目标用户 ID。
import type { UserReassignState } from '../../../composables/adminReservationActions'
import UiTextField from '../../ui/UiTextField.vue'
import AdminActionDialog from '../AdminActionDialog.vue'

defineProps<{ state: UserReassignState | null }>()

defineEmits<{ patch: [change: Partial<UserReassignState>]; confirm: []; dismiss: [] }>()
</script>

<template>
  <AdminActionDialog
    :open="state !== null"
    title="改派预约人"
    confirm-label="确认改派"
    :busy="state?.busy ?? false"
    :error="state?.error ?? null"
    @confirm="$emit('confirm')"
    @dismiss="$emit('dismiss')"
  >
    <p class="summary">
      {{ state?.summary }}
    </p>
    <UiTextField
      :model-value="state?.userId ?? ''"
      label="目标用户 ID"
      inputmode="numeric"
      @update:model-value="$emit('patch', { userId: $event })"
    />
    <p class="hint">
      场馆管理员无法查询用户列表，请向用户或系统管理员获取目标用户的 ID。
    </p>
    <UiTextField
      :model-value="state?.reason ?? ''"
      label="改派原因（必填）"
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
