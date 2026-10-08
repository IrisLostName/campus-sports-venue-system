// 预约卡片上的操作（FE-3 B2、B3；FE-4 M2 起“预约”页与“我的”历史列表共用）：签到、签退、取消。
// 按钮是否出现由 buildCard 里的 actionsFor 决定，这里只执行；所有调用都经 ApiCaller（X1）。
import { computed, ref, type ComputedRef, type Ref } from 'vue'

import type { ApiClient } from '../api/client'
import type { Reservation } from '../api/types'
import type { ReservationAction, ReservationCard } from '../utils/reservationDisplay'
import type { ApiCaller } from './session'

export interface ActionDeps {
  api: ApiClient
  call: ApiCaller
}

// 操作所作用的列表：条目、卡片、替换单条，以及失败后与服务端对齐的重新拉取。
export interface ActionSource {
  items: Ref<Reservation[]>
  cards: ComputedRef<ReservationCard[]>
  replace(updated: Reservation): void
  refresh(): Promise<void>
}

interface CardFeedback {
  reservationId: number
  text: string
}

// 操作：签到、签退、取消（取消须二次确认，可填可选的 reason）。
export function createReservationActions(deps: ActionDeps, source: ActionSource) {
  const feedback = ref<CardFeedback | null>(null)
  const busyId = ref<number | null>(null)
  const cancelTargetId = ref<number | null>(null)
  const cancelReason = ref('')

  const isBusy = computed(() => busyId.value !== null)
  const cancelTarget = computed(() => source.cards.value.find((card) => card.id === cancelTargetId.value) ?? null)
  // 反馈跟随它所属的卡片；若卡片已不在列表里（例如刷新后已不是 CURRENT），改为页面顶部提示。
  const pageFeedback = computed(() => {
    const current = feedback.value
    return current !== null && !source.items.value.some((item) => item.id === current.reservationId) ? current.text : null
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
      source.replace(result.value)
    } else if (!result.sessionEnded) {
      feedback.value = { reservationId: id, text: result.message }
      await source.refresh()
    }
    busyId.value = null
  }

  function isOffered(id: number, action: ReservationAction): boolean {
    return source.cards.value.some((card) => card.id === id && card.actions.includes(action))
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
