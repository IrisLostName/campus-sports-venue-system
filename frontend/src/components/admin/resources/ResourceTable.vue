<script setup lang="ts">
// 场地列表（FE-5 P3）：含已停用的场地；状态按钮只依据 operationalStatus（docs/03 第 6 节状态图）。
import { labelFor } from '../../../utils/accessibleLabel'
import type { ResourceRowView } from '../../../utils/adminResourceDisplay'
import type { ResourceStatus } from '../../../api/types'
import UiButton from '../../ui/UiButton.vue'
import UiStatusPill from '../../ui/UiStatusPill.vue'
import AdminDataTable from '../AdminDataTable.vue'

defineProps<{ rows: ResourceRowView[] }>()

defineEmits<{ rename: [id: number]; status: [id: number, target: ResourceStatus] }>()

const COLUMNS = [
  { key: 'name', label: '场地' },
  { key: 'typeLabel', label: '类型' },
  { key: 'status', label: '状态' },
  { key: 'actions', label: '操作' },
]
</script>

<template>
  <AdminDataTable
    :columns="COLUMNS"
    :rows="rows"
    row-key="id"
    caption="场地列表"
    empty-title="该场馆还没有场地"
  >
    <template #cell-status="{ row }">
      <UiStatusPill :tone="row.tone">
        {{ row.statusLabel }}
      </UiStatusPill>
    </template>
    <template #cell-actions="{ row }">
      <div class="actions">
        <UiButton
          variant="plain"
          :aria-label="labelFor('改名', row.name)"
          @click="$emit('rename', row.id)"
        >
          改名
        </UiButton>
        <UiButton
          v-for="action in row.actions"
          :key="action.target"
          :variant="action.destructive ? 'destructive' : 'secondary'"
          :aria-label="labelFor(action.label, row.name)"
          @click="$emit('status', row.id, action.target)"
        >
          {{ action.label }}
        </UiButton>
      </div>
    </template>
  </AdminDataTable>
</template>

<style scoped>
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
