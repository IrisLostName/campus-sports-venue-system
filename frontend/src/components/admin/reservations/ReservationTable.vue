<script setup lang="ts">
// 预约列表（FE-5 P2）：日期、时间、场地、预约人、状态（后端 displayStatus 的中文名）、管理员说明与操作按钮。
// 按钮由 row.ops 决定（见 utils/adminReservationDisplay.opsFor），这里只负责渲染并发出事件。
import { labelFor } from '../../../utils/accessibleLabel'
import {
  OP_LABELS, reservationName, type AdminReservationRow, type ReservationOp,
} from '../../../utils/adminReservationDisplay'
import UiButton from '../../ui/UiButton.vue'
import UiStatusPill from '../../ui/UiStatusPill.vue'
import AdminDataTable from '../AdminDataTable.vue'

defineProps<{ rows: AdminReservationRow[] }>()

defineEmits<{ op: [id: number, op: ReservationOp] }>()

const COLUMNS = [
  { key: 'dateText', label: '日期' },
  { key: 'timeText', label: '时间' },
  { key: 'place', label: '场地' },
  { key: 'user', label: '预约人' },
  { key: 'status', label: '状态' },
  { key: 'adminNote', label: '管理员说明' },
  { key: 'ops', label: '操作' },
]
</script>

<template>
  <AdminDataTable
    :columns="COLUMNS"
    :rows="rows"
    row-key="id"
    caption="预约列表"
    empty-title="没有符合条件的预约"
  >
    <template #cell-user="{ row }">
      <div class="user">
        <strong>{{ row.userName }}</strong>
        <span class="detail">{{ row.userDetail }}</span>
      </div>
    </template>
    <template #cell-status="{ row }">
      <UiStatusPill :tone="row.tone">
        {{ row.statusLabel }}
      </UiStatusPill>
    </template>
    <template #cell-ops="{ row }">
      <div class="ops">
        <UiButton
          v-for="op in row.ops"
          :key="op"
          :variant="op === 'CANCEL' ? 'destructive' : 'secondary'"
          :aria-label="labelFor(OP_LABELS[op], reservationName(row))"
          @click="$emit('op', row.id, op)"
        >
          {{ OP_LABELS[op] }}
        </UiButton>
      </div>
    </template>
  </AdminDataTable>
</template>

<style scoped>
.user {
  display: flex;
  flex-direction: column;
}

.detail {
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}

.ops {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
