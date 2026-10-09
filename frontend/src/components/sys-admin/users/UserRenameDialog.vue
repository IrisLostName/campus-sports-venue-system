<script setup lang="ts">
// 修改显示名（FE-6 G3；docs/12 第 5.9 节 PATCH displayName，docs/13 上限 50）。
import type { RenameUserState } from '../../../composables/sysUsers'
import { DISPLAY_NAME_MAX_LENGTH } from '../../../utils/fieldLimits'
import AdminActionDialog from '../../admin/AdminActionDialog.vue'
import UiTextField from '../../ui/UiTextField.vue'

defineProps<{ state: RenameUserState | null }>()

defineEmits<{ patch: [change: Partial<RenameUserState>]; confirm: []; dismiss: [] }>()
</script>

<template>
  <AdminActionDialog
    :open="state !== null"
    title="修改显示名"
    confirm-label="保存"
    :busy="state?.busy ?? false"
    :error="state?.error ?? null"
    @confirm="$emit('confirm')"
    @dismiss="$emit('dismiss')"
  >
    <UiTextField
      :model-value="state?.displayName ?? ''"
      label="显示名"
      :maxlength="DISPLAY_NAME_MAX_LENGTH"
      @update:model-value="$emit('patch', { displayName: $event })"
    />
  </AdminActionDialog>
</template>
