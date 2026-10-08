// 操作记录（FE-5 P8）：adminListLogs，所选场馆，按动作、日期区间筛选，分页，时间倒序（排序由接口保证）。
import { computed, reactive } from 'vue'

import { api } from '../api/index'
import type { LogAction } from '../api/types'
import type { LogsQuery } from '../api/requests'
import { buildLogRow } from '../utils/adminLogDisplay'
import { createPagedList } from './adminPaged'
import type { AdminDeps } from './adminRunner'
import { useSession } from './session'

export interface LogFilters {
  action: LogAction | ''
  dateFrom: string
  dateTo: string
}

export function createAdminLogs(deps: AdminDeps, venueId: number) {
  const filters = reactive<LogFilters>({ action: '', dateFrom: '', dateTo: '' })

  function queryFor(page: number): LogsQuery {
    const query: LogsQuery = { venueId, page }
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
  const rows = computed(() => list.items.value.map(buildLogRow))

  // 修改筛选后从第一页重新查询。
  const search = () => list.load(1)

  return { filters, rows, list, search, load: () => list.load(1), goTo: (page: number) => list.load(page) }
}

export function useAdminLogs(venueId: number) {
  return createAdminLogs({ api, call: useSession().caller() }, venueId)
}
