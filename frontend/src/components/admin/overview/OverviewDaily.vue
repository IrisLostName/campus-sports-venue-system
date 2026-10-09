<script setup lang="ts">
// 每日趋势（FE-5 P1）：日期、预约量（带柱条）、利用率，全部是接口 daily 的值。
import type { DailyView } from '../../../utils/adminOverviewDisplay'
import AdminDataTable from '../AdminDataTable.vue'

defineProps<{ rows: DailyView[] }>()

const COLUMNS = [
  { key: 'date', label: '日期' },
  { key: 'countText', label: '预约量' },
  { key: 'rateText', label: '利用率', align: 'end' as const },
]
</script>

<template>
  <section aria-label="每日趋势">
    <h2 class="heading">
      每日趋势
    </h2>
    <AdminDataTable
      :columns="COLUMNS"
      :rows="rows"
      row-key="date"
      caption="每日预约量与利用率"
      empty-title="暂无统计数据"
    >
      <template #cell-countText="{ row }">
        <span class="count">{{ row.countText }}</span>
        <span
          class="bar"
          :style="{ width: `${row.barPercent}%` }"
        />
      </template>
    </AdminDataTable>
  </section>
</template>

<style scoped>
.heading {
  margin-bottom: var(--space-3);
  font: var(--font-headline);
}

.count {
  display: inline-block;
  min-width: 2ch;
  margin-right: var(--space-2);
}

.bar {
  display: inline-block;
  max-width: 160px;
  height: 8px;
  border-radius: var(--radius-capsule);
  background: var(--color-accent);
  vertical-align: middle;
}
</style>
