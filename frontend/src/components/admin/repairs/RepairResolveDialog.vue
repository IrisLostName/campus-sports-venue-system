<script setup lang="ts">
// 标记报修已解决的对话框（FE-5 P7）：处理结果必填，最多 500 字（docs/13）。
import type { ResolveDialogState } from '../../../composables/adminRepairs'
import { REPAIR_NOTE_MAX_LENGTH } from '../../../utils/adminRepairDisplay'
import UiTextField from '../../ui/UiTextField.vue'
import AdminActionDialog from '../AdminActionDialog.vue'

defineProps<{ state: ResolveDialogState | null }>()

defineEmits<{ 'update:note': [note: string]; confirm: []; dismiss: [] }>()
</script>

<template>
  <AdminActionDialog
    :open="state !== null"
    title="标记已解决"
    confirm-label="确认"
    :busy="state?.busy ?? false"
    :error="state?.error ?? null"
    @confirm="$emit('confirm')"
    @dismiss="$emit('dismiss')"
  >
    <UiTextField
      :model-value="state?.note ?? ''"
      label="处理结果（必填）"
      control="textarea"
      rows="3"
      :maxlength="REPAIR_NOTE_MAX_LENGTH"
      counter
      @update:model-value="$emit('update:note', $event)"
    />
  </AdminActionDialog>
</template>
