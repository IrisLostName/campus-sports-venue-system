<script setup lang="ts">
// 全局统计（FE-6 G5，/sys-admin/stats）：全部场馆的指标、分场馆（byVenue）与每日趋势，只展示接口返回值。
import { onMounted } from 'vue'

import AdminPage from '../../components/admin/AdminPage.vue'
import OverviewDaily from '../../components/admin/overview/OverviewDaily.vue'
import OverviewMetrics from '../../components/admin/overview/OverviewMetrics.vue'
import StatsByVenue from '../../components/sys-admin/stats/StatsByVenue.vue'
import StatsFilters from '../../components/sys-admin/stats/StatsFilters.vue'
import { useSysStats } from '../../composables/sysStats'

const { stats, filters, metrics, daily, byVenue, range, busy, error, load } = useSysStats()

onMounted(load)
</script>

<template>
  <AdminPage
    title="全局统计"
    :error="error"
  >
    <StatsFilters
      v-model:filters="filters"
      :busy="busy"
      @search="load"
    />
    <template v-if="stats !== null">
      <OverviewMetrics
        :metrics="metrics"
        :range="range"
      />
      <StatsByVenue :rows="byVenue" />
      <OverviewDaily :rows="daily" />
    </template>
  </AdminPage>
</template>
