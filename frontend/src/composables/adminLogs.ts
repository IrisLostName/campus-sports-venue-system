// 操作记录（FE-5 P8）：adminListLogs，所选场馆，按动作、日期区间筛选，分页，时间倒序（排序由接口保证）。
// venueId 缺省 = 全部场馆（FE-6 G6，系统管理员）：不带 venueId 查询（含 venueId 为 null 的记录），并显示场馆列。
import { computed, reactive } from 'vue'

import { api } from '../api/index'
import type { LogAction, VenueSummary } from '../api/types'
import type { LogsQuery } from '../api/requests'
import { buildLogRow } from '../utils/adminLogDisplay'
import { createPagedList } from './adminPaged'
import type { AdminDeps } from './adminRunner'
import { useOptionalVenue } from './adminVenue'
import { useSession } from './session'

export interface LogFilters {
  action: LogAction | ''
  dateFrom: string
  dateTo: string
}

export function createAdminLogs(deps: AdminDeps, venueId?: number, venues: () => readonly VenueSummary[] = () => []) {
  const filters = reactive<LogFilters>({ action: '', dateFrom: '', dateTo: '' })

  function queryFor(page: number): LogsQuery {
    const query: LogsQuery = venueId === undefined ? { page } : { venueId, page }
    if (filters.action !== '') {
      query.action = filters.action
    }
    if (filters.dateFrom !== '') {
      query.dateFrom = filters.dateFrom
    }
    if (filters.dateTo !== '') {
      query.dateTo = filters.dateTo
    }
    return query
  }

  const list = createPagedList(deps.call, (page) => deps.api.adminListLogs(queryFor(page)))
  const rows = computed(() => {
    const names = venueId === undefined ? new Map(venues().map((venue) => [venue.id, venue.name])) : undefined
    return list.items.value.map((log) => buildLogRow(log, names))
  })

  // 修改筛选后从第一页重新查询。
  const search = () => list.load(1)

  return { filters, rows, list, search, load: () => list.load(1), goTo: (page: number) => list.load(page) }
}

export function useAdminLogs(venueId?: number) {
  const options = venueId === undefined ? useOptionalVenue().venues : undefined
  return createAdminLogs({ api, call: useSession().caller() }, venueId, () => options?.value ?? [])
}
