// 场地占用总览（FE-5 P5）：adminGetOccupancy(venueId, date)，日期可选，默认今天。
import { computed, ref } from 'vue'

import { api } from '../api/index'
import type { Occupancy } from '../api/typesSection5'
import { buildOccupancyGrid } from '../utils/occupancyDisplay'
import { todayShanghai } from '../utils/shanghaiTime'
import { createAdminRunner, type AdminDeps } from './adminRunner'
import { useSession } from './session'

export function createAdminOccupancy(deps: AdminDeps, venueId: number, today: string) {
  const runner = createAdminRunner(deps.call)
  const date = ref(today)
  const occupancy = ref<Occupancy | null>(null)
  const grid = computed(() => (occupancy.value === null ? null : buildOccupancyGrid(occupancy.value)))

  async function load(): Promise<void> {
    const result = await runner.run(() => deps.api.adminGetOccupancy(venueId, date.value))
    if (result.ok) {
      occupancy.value = result.value
    }
  }

  // 日期输入被清空时保持原日期，不发请求。
  async function setDate(next: string): Promise<void> {
    if (next === '') {
      return
    }
    date.value = next
    await load()
  }

  return { date, occupancy, grid, loading: runner.busy, error: runner.error, load, setDate }
}

export function useAdminOccupancy(venueId: number) {
  return createAdminOccupancy({ api, call: useSession().caller() }, venueId, todayShanghai())
}
