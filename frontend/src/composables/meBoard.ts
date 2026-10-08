// “我的”页的历史预约（FE-4 规划裁决 M2）：scope=HISTORY、每页 20 条、“加载更多”分页；
// 卡片构造与 actionsFor、签到/签退/取消的操作流程都复用“预约”页的（已完成但未签退的预约在这里仍可签退）。
// 历史筛选属 C 级，本包不做。
import { computed } from 'vue'

import type { ApiClient } from '../api/client'
import { api } from '../api/index'
import { buildCard } from '../utils/reservationDisplay'
import { createReservationActions } from './reservationActions'
import { createReservationList } from './reservationList'
import { useSession, type ApiCaller } from './session'

export interface MeDeps {
  api: ApiClient
  call: ApiCaller
}

export function createMeBoard(deps: MeDeps) {
  const list = createReservationList(deps, 'HISTORY')
  // 历史卡片不显示签到与取消说明，所以不需要 BookingRules（传 null 则说明文案为空）。
  const cards = computed(() => list.items.value.map((item) => buildCard(item, null)))
  const actions = createReservationActions(deps, {
    items: list.items, cards, replace: list.replace, refresh: list.refresh,
  })
  const isEmpty = computed(() => list.phase.value === 'ready' && list.items.value.length === 0)

  return {
    phase: list.phase, loadError: list.error, hasMore: list.hasMore, loadingMore: list.loadingMore,
    cards, isEmpty, total: list.total, load: list.load, loadMore: list.loadMore,
    ...actions,
  }
}

export type MeBoard = ReturnType<typeof createMeBoard>

export function useMeBoard(): MeBoard {
  return createMeBoard({ api, call: useSession().caller() })
}
