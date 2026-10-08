<script setup lang="ts">
// 资源改派（FE-5 P2）：目标场地（本场馆）、日期、开始时间；可选时间来自占用总览里状态为 AVAILABLE 的格子。日期不限于未来 7 天。
import { computed } from 'vue'

import type { ReassignState } from '../../../composables/adminReassign'
import UiTextField from '../../ui/UiTextField.vue'
import AdminActionDialog from '../AdminActionDialog.vue'

const props = defineProps<{ state: ReassignState | null }>()

defineEmits<{
  patch: [change: Partial<ReassignState>]
  'set-date': [date: string]
  confirm: []
  dismiss: []
}>()

const slots = computed(() => {
  const state = props.state
  return state?.options.find((option) => String(option.resourceId) === state.resourceId)?.slots ?? []
})
</script>

<template>
  <AdminActionDialog
    :open="state !== null"
    title="改派场地"
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
      :model-value="state?.date ?? ''"
      label="目标日期"
      type="date"
      @update:model-value="$emit('set-date', $event)"
    />
    <p
      v-if="state?.loading"
      class="hint"
    >
      正在加载当天的占用情况…
    </p>
    <template v-else>
      <UiTextField
        :model-value="state?.resourceId ?? ''"
        label="目标场地"
        control="select"
        @update:model-value="$emit('patch', { resourceId: $event, startTime: '' })"
      >
        <option value="">
          请选择
        </option>
        <option
          v-for="option in state?.options ?? []"
          :key="option.resourceId"
          :value="String(option.resourceId)"
        >
          {{ option.name }}
        </option>
      </UiTextField>
      <UiTextField
        :model-value="state?.startTime ?? ''"
        label="开始时间"
        control="select"
        @update:model-value="$emit('patch', { startTime: $event })"
      >
        <option value="">
          请选择
        </option>
        <option
          v-for="slot in slots"
          :key="slot.startTime"
          :value="slot.startTime"
        >
          {{ slot.timeText }}
        </option>
      </UiTextField>
      <p
        v-if="state !== null && state.resourceId !== '' && slots.length === 0"
        class="hint"
      >
        该场地当天没有可选时段。
      </p>
    </template>
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
