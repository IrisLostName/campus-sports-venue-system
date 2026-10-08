<script setup lang="ts">
// 场地改名（FE-5 P3）：名称上限 50（docs/13）。
import type { RenameState } from '../../../composables/adminResources'
import { RESOURCE_NAME_MAX_LENGTH } from '../../../utils/adminResourceDisplay'
import UiTextField from '../../ui/UiTextField.vue'
import AdminActionDialog from '../AdminActionDialog.vue'

defineProps<{ state: RenameState | null }>()

defineEmits<{ patch: [change: Partial<RenameState>]; confirm: []; dismiss: [] }>()
</script>

<template>
  <AdminActionDialog
    :open="state !== null"
    title="场地改名"
    confirm-label="保存"
    :busy="state?.busy ?? false"
    :error="state?.error ?? null"
    @confirm="$emit('confirm')"
    @dismiss="$emit('dismiss')"
  >
    <UiTextField
      :model-value="state?.name ?? ''"
      label="场地名称"
      :maxlength="RESOURCE_NAME_MAX_LENGTH"
      @update:model-value="$emit('patch', { name: $event })"
    />
  </AdminActionDialog>
</template>
