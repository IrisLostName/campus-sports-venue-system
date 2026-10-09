<script setup lang="ts">
// 分场馆统计（FE-6 G5）：接口 byVenue 的预约量与利用率；利用率为 null 时显示“—”（格式化在 utils/sysStatsDisplay）。
import type { ByVenueView } from '../../../utils/sysStatsDisplay'
import AdminDataTable from '../../admin/AdminDataTable.vue'

defineProps<{ rows: ByVenueView[] }>()

const COLUMNS = [
  { key: 'venueName', label: '场馆' },
  { key: 'countText', label: '预约量' },
  { key: 'rateText', label: '利用率', align: 'end' as const },
]
</script>

<template>
  <section aria-label="分场馆统计">
    <h2 class="heading">
      分场馆统计
    </h2>
    <AdminDataTable
      :columns="COLUMNS"
      :rows="rows"
      row-key="venueId"
      caption="分场馆预约量与利用率"
      empty-title="暂无场馆统计"
    />
  </section>
</template>

<style scoped>
.heading {
  margin-bottom: var(--space-3);
  font: var(--font-headline);
}
</style>
