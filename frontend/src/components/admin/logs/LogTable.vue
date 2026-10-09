<script setup lang="ts">
// 操作记录表（FE-5 P8）：时间、操作人、动作、对象、原因；变更前 / 变更后是可展开的格式化 JSON，不做解释。
import { computed } from 'vue'

import type { LogRowView } from '../../../utils/adminLogDisplay'
import AdminDataTable from '../AdminDataTable.vue'

// showVenue（FE-6 G6，全部场馆）：多一列“场馆”，venueId 为 null 的记录显示“全局”。
const props = withDefaults(defineProps<{ rows: LogRowView[]; showVenue?: boolean }>(), { showVenue: false })

const BASE_COLUMNS = [
  { key: 'timeText', label: '时间' },
  { key: 'adminName', label: '操作人' },
  { key: 'actionLabel', label: '动作' },
  { key: 'targetText', label: '对象' },
  { key: 'reasonText', label: '原因' },
  { key: 'detail', label: '详情' },
]

const COLUMNS = computed(() => (props.showVenue ? [{ key: 'venueText', label: '场馆' }, ...BASE_COLUMNS] : BASE_COLUMNS))
</script>

<template>
  <AdminDataTable
    :columns="COLUMNS"
    :rows="rows"
    row-key="id"
    caption="操作记录"
    empty-title="没有符合条件的操作记录"
  >
    <template #cell-detail="{ row }">
      <details class="detail">
        <summary>查看详情</summary>
        <h3 class="heading">
          变更前
        </h3>
        <pre class="json before">{{ row.before ?? '—' }}</pre>
        <h3 class="heading">
          变更后
        </h3>
        <pre class="json after">{{ row.after ?? '—' }}</pre>
      </details>
    </template>
  </AdminDataTable>
</template>

<style scoped>
.detail summary {
  color: var(--color-accent);
  cursor: pointer;
}

.heading {
  margin-top: var(--space-2);
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}

.json {
  max-width: 420px;
  margin: 0;
  overflow-x: auto;
  font: var(--font-caption);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
