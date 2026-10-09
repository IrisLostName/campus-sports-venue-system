<script setup lang="ts">
// 编辑场馆资料（FE-6 G1）：名称、类型、位置、简介；只提交改动的字段。简介 maxlength=500（FE-5 N1）。
import type { VenueEditState } from '../../../composables/sysVenueEdit'
import {
  VENUE_DESCRIPTION_MAX_LENGTH, VENUE_LOCATION_MAX_LENGTH, VENUE_NAME_MAX_LENGTH,
} from '../../../utils/fieldLimits'
import { VENUE_TYPE_OPTIONS } from '../../../utils/sysVenueDisplay'
import AdminActionDialog from '../../admin/AdminActionDialog.vue'
import UiTextField from '../../ui/UiTextField.vue'

defineProps<{ state: VenueEditState | null }>()

defineEmits<{ patch: [change: Partial<VenueEditState>]; confirm: []; dismiss: [] }>()
</script>

<template>
  <AdminActionDialog
    :open="state !== null"
    title="编辑场馆资料"
    confirm-label="保存"
    :busy="state?.busy ?? false"
    :error="state?.error ?? null"
    @confirm="$emit('confirm')"
    @dismiss="$emit('dismiss')"
  >
    <UiTextField
      :model-value="state?.name ?? ''"
      label="名称"
      :maxlength="VENUE_NAME_MAX_LENGTH"
      @update:model-value="$emit('patch', { name: $event })"
    />
    <UiTextField
      :model-value="state?.venueType ?? ''"
      label="类型"
      control="select"
      @update:model-value="$emit('patch', { venueType: $event as VenueEditState['venueType'] })"
    >
      <option
        v-for="option in VENUE_TYPE_OPTIONS"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </UiTextField>
    <UiTextField
      :model-value="state?.location ?? ''"
      label="位置"
      :maxlength="VENUE_LOCATION_MAX_LENGTH"
      @update:model-value="$emit('patch', { location: $event })"
    />
    <UiTextField
      :model-value="state?.description ?? ''"
      label="简介"
      control="textarea"
      rows="3"
      :maxlength="VENUE_DESCRIPTION_MAX_LENGTH"
      @update:model-value="$emit('patch', { description: $event })"
    />
  </AdminActionDialog>
</template>
