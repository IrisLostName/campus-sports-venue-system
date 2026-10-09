// 预约管理（FE-5 P2）：adminListReservations（日期区间、状态、关键字、分页）+ 取消、资源改派、人员改派。
// venueId 缺省 = 全部场馆（FE-6 G7，系统管理员）：不带 venueId 查询，场地列显示场馆名；单条预约的操作仍按其所在场馆进行。
import { computed, reactive, ref } from 'vue'

import { api } from '../api/index'
import type { ReservationStatus } from '../api/types'
import type { AdminReservationsQuery } from '../api/requests'
import { buildReservationRow } from '../utils/adminReservationDisplay'
import { createPagedList } from './adminPaged'
import { createReassign } from './adminReassign'
import { createReservationActions } from './adminReservationActions'
import type { AdminDeps } from './adminRunner'
import { useSession } from './session'

export interface ReservationFilters {
  dateFrom: string
  dateTo: string
  status: ReservationStatus | ''
  keyword: string
}

export function createAdminReservations(deps: AdminDeps, venueId?: number) {
  const filters = reactive<ReservationFilters>({ dateFrom: '', dateTo: '', status: '', keyword: '' })
  const notice = ref<string | null>(null)

  function queryFor(page: number): AdminReservationsQuery {
    const query: AdminReservationsQuery = venueId === undefined ? { page } : { venueId, page }
    if (filters.dateFrom !== '') {
      query.dateFrom = filters.dateFrom
    }
    if (filters.dateTo !== '') {
      query.dateTo = filters.dateTo
    }
    if (filters.status !== '') {
      query.status = filters.status
    }
    if (filters.keyword.trim() !== '') {
      query.keyword = filters.keyword.trim()
    }
    return query
  }

  const list = createPagedList(deps.call, (page) => deps.api.adminListReservations(queryFor(page)))
  const rows = computed(() => list.items.value.map((item) => buildReservationRow(item, venueId === undefined)))
  const hooks = {
    find: (id: number) => list.items.value.find((item) => item.id === id),
    refresh: () => list.load(),
    notify: (text: string) => { notice.value = text },
  }
  const actions = createReservationActions(deps, hooks)
  const reassign = createReassign(deps, hooks)

  async function search(): Promise<void> {
    notice.value = null
    await list.load(1)
  }

  async function goTo(page: number): Promise<void> {
    notice.value = null
    await list.load(page)
  }

  return { filters, list, rows, notice, actions, reassign, load: () => list.load(1), search, goTo }
}

export function useAdminReservations(venueId?: number) {
  return createAdminReservations({ api, call: useSession().caller() }, venueId)
}
