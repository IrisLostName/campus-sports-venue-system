<script setup lang="ts">
// 场馆列表（FE-6 G1）：名称、类型、位置、运营状态（文字）、开放预约开关、场地数，以及编辑 / 关闭 / 重新开放 / 去设定场地。
// 开关直接提交（不做影响检查，FE-1 裁决 A9）：提交前先把控件还原，只有服务端确认后的列表才会改变它的显示。
import { PATHS } from '../../../router/paths'
import { BOOKING_SWITCH_LABEL, type VenueRowView } from '../../../utils/sysVenueDisplay'
import AdminDataTable from '../../admin/AdminDataTable.vue'
import UiButton from '../../ui/UiButton.vue'

defineProps<{ rows: VenueRowView[]; busy: boolean }>()

const emit = defineEmits<{
  toggle: [id: number, enabled: boolean]
  edit: [id: number]
  close: [id: number]
  reopen: [id: number]
}>()

const COLUMNS = [
  { key: 'name', label: '名称' },
  { key: 'typeLabel', label: '类型' },
  { key: 'locationText', label: '位置' },
  { key: 'statusLabel', label: '运营状态' },
  { key: 'booking', label: BOOKING_SWITCH_LABEL },
  { key: 'resourceCount', label: '场地数', align: 'end' as const },
  { key: 'ops', label: '操作' },
]

function onToggle(input: { checked: boolean }, id: number): void {
  const enabled = input.checked
  input.checked = !enabled
  emit('toggle', id, enabled)
}
</script>

<template>
  <AdminDataTable
    :columns="COLUMNS"
    :rows="rows"
    row-key="id"
    caption="场馆列表"
    empty-title="还没有场馆"
  >
    <template #cell-booking="{ row }">
      <div class="booking">
        <label class="switch">
          <input
            type="checkbox"
            role="switch"
            :checked="row.bookingEnabled"
            :disabled="busy"
            :aria-label="`${BOOKING_SWITCH_LABEL}：${row.name}`"
            @change="onToggle($event.target as HTMLInputElement, row.id)"
          >
          {{ row.bookingEnabled ? '已开放' : '未开放' }}
        </label>
        <p
          v-if="row.bookingHint !== null"
          class="booking-hint"
        >
          {{ row.bookingHint }}
        </p>
      </div>
    </template>
    <template #cell-ops="{ row }">
      <div class="ops">
        <UiButton
          variant="secondary"
          @click="emit('edit', row.id)"
        >
          编辑资料
        </UiButton>
        <UiButton
          :to="{ path: PATHS.sysAdminResources, query: { venueId: String(row.id) } }"
          variant="plain"
        >
          场地与开放规则
        </UiButton>
        <UiButton
          v-if="row.open"
          variant="destructive"
          @click="emit('close', row.id)"
        >
          关闭场馆
        </UiButton>
        <UiButton
          v-else
          variant="secondary"
          @click="emit('reopen', row.id)"
        >
          重新开放
        </UiButton>
      </div>
    </template>
  </AdminDataTable>
</template>

<style scoped>
.booking {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.booking-hint {
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}

.switch {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 44px;
  cursor: pointer;
}

.switch input {
  width: 20px;
  height: 20px;
  accent-color: var(--color-accent-fill);
}

.ops {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
