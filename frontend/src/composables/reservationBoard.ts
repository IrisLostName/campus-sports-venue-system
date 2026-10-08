// “预约”页的全部逻辑（FE-3 规划裁决 P1、B2、B3）：拉取本人 CURRENT 预约、签到、签退、取消。
// 页面只负责渲染；所有需登录的调用都经 ApiCaller（callApi），登录失效时由它回到登录页（N-1）。
import { computed, ref } from 'vue'

import type { ApiClient } from '../api/client'
import { api } from '../api/index'
import type { BookingRules, Reservation } from '../api/types'
import { useReferenceStore, type ReferenceStore } from '../stores/reference'
import { buildCard, type ReservationAction } from '../utils/reservationDisplay'
import { useSession, type ApiCaller } from './session'

export interface BoardDeps {
  api: ApiClient
  call: ApiCaller
  reference: ReferenceStore
}

export type BoardPhase = 'idle' | 'loading' | 'ready' | 'failed'

// 列表数据：本人 CURRENT 预约与 BookingRules。
function createBoardData(deps: BoardDeps) {
  const items = ref<Reservation[]>([])
  const phase = ref<BoardPhase>('idle')
  const loadError = ref<string | null>(null)
  const rulesError = ref<string | null>(null)

  const rules = computed<BookingRules | null>(() => deps.reference.bookingRules)
  const cards = computed(() => items.value.map((item) => buildCard(item, rules.value)))
  // 没有 CURRENT 预约是空状态（订场入口在页面里）。
  const isEmpty = computed(() => phase.value === 'ready' && items.value.length === 0)

  async function fetchList(): Promise<void> {
    const result = await deps.call(() => deps.api.listMyReservations({ scope: 'CURRENT' }))
    if (result.ok) {
      items.value = result.value.items
      loadError.value = null
      phase.value = 'ready'
    } else if (!result.sessionEnded) {
      loadError.value = result.message
      phase.value = items.value.length > 0 ? 'ready' : 'failed'
    }
  }

  async function fetchRules(): Promise<void> {
    const result = await deps.reference.loadBookingRules(deps.call)
    rulesError.value = result.ok || result.sessionEnded ? null : result.message
  }

  async function load(): Promise<void> {
    phase.value = 'loading'
    await Promise.all([fetchList(), fetchRules()])
  }

  function replace(updated: Reservation): void {
    items.value = items.value.map((item) => (item.id === updated.id ? updated : item))
  }

  return { items, phase, loadError, rulesError, rules, cards, isEmpty, fetchList, load, replace }
}

type BoardData = ReturnType<typeof createBoardData>

interface CardFeedback {
  reservationId: number
  text: string
}

// 操作：签到、签退、取消（取消须二次确认，可填可选的 reason）。
function createBoardActions(deps: BoardDeps, data: BoardData) {
  const feedback = ref<CardFeedback | null>(null)
  const busyId = ref<number | null>(null)
  const cancelTargetId = ref<number | null>(null)
  const cancelReason = ref('')

  const isBusy = computed(() => busyId.value !== null)
  const cancelTarget = computed(() => data.cards.value.find((card) => card.id === cancelTargetId.value) ?? null)
  // 反馈跟随它所属的卡片；若卡片已不在列表里（例如刷新后已不是 CURRENT），改为页面顶部提示。
  const pageFeedback = computed(() => {
    const current = feedback.value
    return current !== null && !data.items.value.some((item) => item.id === current.reservationId) ? current.text : null
  })

  function feedbackFor(id: number): string | null {
    return feedback.value?.reservationId === id ? feedback.value.text : null
  }

  // B3：成功后用接口返回的 Reservation 替换卡片；失败显示错误码文案并重新拉取列表。进行中不可重复触发。
  async function perform(id: number, request: () => Promise<Reservation>): Promise<void> {
    if (isBusy.value) {
      return
    }
    busyId.value = id
    feedback.value = null
    const result = await deps.call(request)
    if (result.ok) {
      data.replace(result.value)
    } else if (!result.sessionEnded) {
      feedback.value = { reservationId: id, text: result.message }
      await data.fetchList()
    }
    busyId.value = null
  }

  function isOffered(id: number, action: ReservationAction): boolean {
    return data.cards.value.some((card) => card.id === id && card.actions.includes(action))
  }

  function dismissCancel(): void {
    cancelTargetId.value = null
    cancelReason.value = ''
  }

  async function confirmCancel(): Promise<void> {
    const id = cancelTargetId.value
    if (id === null) {
      return
    }
    const reason = cancelReason.value.trim()
    dismissCancel()
    await perform(id, () => deps.api.cancelReservation(id, reason === '' ? {} : { reason }))
  }

  // 页面上的按钮统一从这里进入：只有当前卡片确实提供该动作时才执行。防重复点击只在 perform 里守卫一次（FE-3 N2）。
  async function trigger(action: ReservationAction, id: number): Promise<void> {
    if (!isOffered(id, action)) {
      return
    }
    if (action === 'CANCEL') {
      cancelTargetId.value = id
      cancelReason.value = ''
    } else {
      await perform(id, () => (action === 'CHECK_IN' ? deps.api.checkIn(id) : deps.api.checkOut(id)))
    }
  }

  return { busyId, isBusy, cancelTarget, cancelReason, pageFeedback, feedbackFor, trigger, confirmCancel, dismissCancel }
}

export function createReservationBoard(deps: BoardDeps) {
  const data = createBoardData(deps)
  const actions = createBoardActions(deps, data)
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
