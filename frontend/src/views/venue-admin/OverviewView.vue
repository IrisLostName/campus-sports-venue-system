<script setup lang="ts">
// 概览（FE-5 P1）：所选场馆的统计，只展示接口返回值。
import { onMounted } from 'vue'

import AdminPage from '../../components/admin/AdminPage.vue'
import OverviewDaily from '../../components/admin/overview/OverviewDaily.vue'
import OverviewMetrics from '../../components/admin/overview/OverviewMetrics.vue'
import { useCurrentVenue } from '../../composables/adminVenue'
import { useAdminOverview } from '../../composables/adminOverview'

const { venueId } = useCurrentVenue()
const { stats, metrics, daily, range, error, load } = useAdminOverview(venueId)

onMounted(load)
</script>

<template>
  <AdminPage
    title="概览"
    :error="error"
  >
    <template v-if="stats !== null">
      <OverviewMetrics
        :metrics="metrics"
        :range="range"
      />
      <OverviewDaily :rows="daily" />
    </template>
  </AdminPage>
</template>
