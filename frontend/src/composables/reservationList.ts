// 本人预约列表（CURRENT 或 HISTORY）的拉取与分页，首页、预约页、“我的”共用（FE-3 N3）。
// 所有调用都经 ApiCaller（callApi），登录失效时由它回到登录页（X1）；这里只管数据，不管展示。
import { computed, ref } from 'vue'

import type { ApiClient } from '../api/client'
import type { ReservationScope } from '../api/requests'
import type { Reservation } from '../api/types'
import type { ApiCaller } from './session'

export const RESERVATION_PAGE_SIZE = 20

export type ListPhase = 'idle' | 'loading' | 'ready' | 'failed'

export interface ReservationListDeps {
  api: ApiClient
  call: ApiCaller
}

// 翻页期间预约可能改变状态而换页，同一条可能出现在相邻两页：按 id 去重，保留先出现的位置。
function mergeById(base: Reservation[], extra: Reservation[]): Reservation[] {
  const known = new Set(base.map((item) => item.id))
  return [...base, ...extra.filter((item) => !known.has(item.id))]
}

export function createReservationList(deps: ReservationListDeps, scope: ReservationScope) {
  const items = ref<Reservation[]>([])
  const total = ref(0)
  const phase = ref<ListPhase>('idle')
  const error = ref<string | null>(null)
  const pages = ref(0)                 // 已取得的页数
  const loadingMore = ref(false)

  // 以页数而不是条数判断，去重后条数变少也不会出现永远点不完的“加载更多”。
  const hasMore = computed(() => pages.value * RESERVATION_PAGE_SIZE < total.value)

  function fetchPage(page: number) {
    return deps.call(() => deps.api.listMyReservations({ scope, page, pageSize: RESERVATION_PAGE_SIZE }))
  }

  // 失败时保留已有内容：已有条目则仍是 ready，只显示错误；没有条目才是 failed。
  function fail(message: string): void {
    error.value = message
    phase.value = items.value.length > 0 ? 'ready' : 'failed'
  }

  // 重新拉取已取得的所有页（至少第 1 页），用于操作失败后与服务端对齐，不会把“加载更多”的结果丢掉。
  async function refresh(): Promise<void> {
    const lastPage = Math.max(pages.value, 1)
    let collected: Reservation[] = []
    let latestTotal = 0
    for (let page = 1; page <= lastPage; page += 1) {
      const result = await fetchPage(page)
      if (!result.ok) {
        if (!result.sessionEnded) {
          fail(result.message)
        }
        return
      }
      collected = mergeById(collected, result.value.items)
      latestTotal = result.value.total
    }
    items.value = collected
    total.value = latestTotal
    pages.value = lastPage
    error.value = null
    phase.value = 'ready'
  }

  async function load(): Promise<void> {
    phase.value = 'loading'
    pages.value = 0
    await refresh()
  }

  async function loadMore(): Promise<void> {
    if (loadingMore.value || !hasMore.value) {
      return
    }
    loadingMore.value = true
    const result = await fetchPage(pages.value + 1)
    if (result.ok) {
      items.value = mergeById(items.value, result.value.items)
      total.value = result.value.total
      pages.value += 1
      error.value = null
    } else if (!result.sessionEnded) {
      fail(result.message)
    }
    loadingMore.value = false
  }

  function replace(updated: Reservation): void {
    items.value = items.value.map((item) => (item.id === updated.id ? updated : item))
  }

  return { items, total, phase, error, hasMore, loadingMore, load, loadMore, refresh, replace }
}

export type ReservationList = ReturnType<typeof createReservationList>
