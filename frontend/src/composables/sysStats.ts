// 全局统计（FE-6 G5）：adminGetStatsOverview({dateFrom?, dateTo?})，不带 venueId = 全局；区间缺省按后端（FE-1 裁决 A14）。
// 指标、每日趋势沿用 FE-5 概览的展示函数，另加 byVenue 表；只展示接口值。
import { computed, reactive, ref } from 'vue'

import { api } from '../api/index'
import type { StatsOverviewQuery } from '../api/requests'
import type { StatsOverview } from '../api/typesSection5'
import { buildDaily, buildMetrics, rangeText } from '../utils/adminOverviewDisplay'
import { buildByVenue } from '../utils/sysStatsDisplay'
import { createAdminRunner, type AdminDeps } from './adminRunner'
import { useSession } from './session'

export interface StatsFilters {
  dateFrom: string
  dateTo: string
}

export function createSysStats(deps: AdminDeps) {
  const runner = createAdminRunner(deps.call)
  const stats = ref<StatsOverview | null>(null)
  const filters = reactive<StatsFilters>({ dateFrom: '', dateTo: '' })
  const metrics = computed(() => (stats.value === null ? [] : buildMetrics(stats.value)))
  const daily = computed(() => (stats.value === null ? [] : buildDaily(stats.value)))
  const byVenue = computed(() => (stats.value === null ? [] : buildByVenue(stats.value)))
  const range = computed(() => (stats.value === null ? '' : rangeText(stats.value)))

  async function load(): Promise<void> {
    const query: StatsOverviewQuery = {
      ...(filters.dateFrom === '' ? {} : { dateFrom: filters.dateFrom }),
      ...(filters.dateTo === '' ? {} : { dateTo: filters.dateTo }),
    }
    const result = await runner.run(() => deps.api.adminGetStatsOverview(query))
    if (result.ok) {
      stats.value = result.value
    }
  }

  return { stats, filters, metrics, daily, byVenue, range, busy: runner.busy, error: runner.error, load }
}

export function useSysStats() {
  return createSysStats({ api, call: useSession().caller() })
}
