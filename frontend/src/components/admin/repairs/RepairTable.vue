<script setup lang="ts">
// 报修表（FE-5 P7）：提交时间、场地、报修人、问题描述、状态、处理结果与当前状态允许的下一步按钮。
import type { RepairRowView, RepairTarget } from '../../../utils/adminRepairDisplay'
import UiButton from '../../ui/UiButton.vue'
import UiStatusPill from '../../ui/UiStatusPill.vue'
import AdminDataTable from '../AdminDataTable.vue'

defineProps<{ rows: RepairRowView[]; busy: boolean }>()

defineEmits<{ step: [id: number, target: RepairTarget] }>()

const COLUMNS = [
  { key: 'createdText', label: '提交时间' },
  { key: 'place', label: '场地' },
  { key: 'reporterName', label: '报修人' },
  { key: 'description', label: '问题描述' },
  { key: 'status', label: '状态' },
  { key: 'resultNote', label: '处理结果' },
  { key: 'steps', label: '操作' },
]
</script>

<template>
  <AdminDataTable
    :columns="COLUMNS"
    :rows="rows"
    row-key="id"
    caption="报修列表"
    empty-title="没有报修记录"
  >
    <template #cell-status="{ row }">
      <UiStatusPill :tone="row.tone">
        {{ row.statusLabel }}
      </UiStatusPill>
    </template>
    <template #cell-steps="{ row }">
      <div class="steps">
        <UiButton
          v-for="step in row.steps"
          :key="step.target"
          variant="secondary"
          :disabled="busy"
          @click="$emit('step', row.id, step.target)"
        >
          {{ step.label }}
        </UiButton>
      </div>
    </template>
  </AdminDataTable>
</template>

<style scoped>
.steps {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
