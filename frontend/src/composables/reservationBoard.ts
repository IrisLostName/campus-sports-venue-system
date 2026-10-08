// “预约”页的全部逻辑（FE-3 规划裁决 P1、B2、B3）：拉取本人 CURRENT 预约、签到、签退、取消。
// 页面只负责渲染；所有需登录的调用都经 ApiCaller（callApi），登录失效时由它回到登录页（N-1）。
import { computed, ref } from 'vue'

import type { ApiClient } from '../api/client'
import { api } from '../api/index'
import type { BookingRules } from '../api/types'
import { useReferenceStore, type ReferenceStore } from '../stores/reference'
import { buildCard } from '../utils/reservationDisplay'
import { createReservationActions } from './reservationActions'
import { createReservationList } from './reservationList'
import { useSession, type ApiCaller } from './session'

export interface BoardDeps {
  api: ApiClient
  call: ApiCaller
  reference: ReferenceStore
}

// 列表数据：本人 CURRENT 预约（共用列表组合函数）与 BookingRules。
function createBoardData(deps: BoardDeps) {
  const list = createReservationList(deps, 'CURRENT')
  const rulesError = ref<string | null>(null)

  const rules = computed<BookingRules | null>(() => deps.reference.bookingRules)
  const cards = computed(() => list.items.value.map((item) => buildCard(item, rules.value)))
  // 没有 CURRENT 预约是空状态（订场入口在页面里）。
  const isEmpty = computed(() => list.phase.value === 'ready' && list.items.value.length === 0)

  async function fetchRules(): Promise<void> {
    const result = await deps.reference.loadBookingRules(deps.call)
    rulesError.value = result.ok || result.sessionEnded ? null : result.message
  }

  async function load(): Promise<void> {
    await Promise.all([list.load(), fetchRules()])
  }

  return {
    items: list.items, phase: list.phase, loadError: list.error, rulesError, rules, cards, isEmpty,
    fetchList: list.refresh, load, replace: list.replace,
  }
}

export function createReservationBoard(deps: BoardDeps) {
  const data = createBoardData(deps)
  const actions = createReservationActions(deps, {
    items: data.items, cards: data.cards, replace: data.replace, refresh: data.fetchList,
  })
  return {
    phase: data.phase, loadError: data.loadError, rulesError: data.rulesError, rules: data.rules,
    cards: data.cards, isEmpty: data.isEmpty, load: data.load,
    ...actions,
  }
}

export type ReservationBoard = ReturnType<typeof createReservationBoard>

export function useReservationBoard(): ReservationBoard {
  return createReservationBoard({ api, call: useSession().caller(), reference: useReferenceStore() })
}
