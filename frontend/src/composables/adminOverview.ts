// 概览页（FE-5 P1）：adminGetStatsOverview({venueId})，缺省区间按后端（mock 口径：近 7 天含今天）。只展示返回值。
import { computed, ref } from 'vue'

import { api } from '../api/index'
import type { StatsOverview } from '../api/typesSection5'
import { buildDaily, buildMetrics, rangeText } from '../utils/adminOverviewDisplay'
import { createAdminRunner, type AdminDeps } from './adminRunner'
import { useSession } from './session'

export function createAdminOverview(deps: AdminDeps, venueId: number) {
  const runner = createAdminRunner(deps.call)
  const stats = ref<StatsOverview | null>(null)
  const metrics = computed(() => (stats.value === null ? [] : buildMetrics(stats.value)))
  const daily = computed(() => (stats.value === null ? [] : buildDaily(stats.value)))
  const range = computed(() => (stats.value === null ? '' : rangeText(stats.value)))

  async function load(): Promise<void> {
    const result = await runner.run(() => deps.api.adminGetStatsOverview({ venueId }))
    if (result.ok) {
      stats.value = result.value
    }
  }

  return { stats, metrics, daily, range, loading: runner.busy, error: runner.error, load }
}

export function useAdminOverview(venueId: number) {
  return createAdminOverview({ api, call: useSession().caller() }, venueId)
}
