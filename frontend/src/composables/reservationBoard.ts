// “预约”页的全部逻辑（FE-3 规划裁决 P1、B2、B3）：拉取本人 CURRENT 预约、出示签到码（P2-1c 浮层）、签退、取消。
// 页面只负责渲染；所有需登录的调用都经 ApiCaller（callApi），登录失效时由它回到登录页（N-1）。
import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

import type { ApiClient } from '../api/client'
import { api } from '../api/index'
import type { BookingRules, DisplayStatus, Reservation, UserProfile } from '../api/types'
import { useAuthStore } from '../stores/auth'
import { useReferenceStore, type ReferenceStore } from '../stores/reference'
import { cancelLockedNote, isCancelLocked } from '../utils/cancelDeadline'
import { buildCard } from '../utils/reservationDisplay'
import { nowShanghai } from '../utils/shanghaiTime'
import { createCheckInSheet } from './checkInSheet'
import { createReservationActions } from './reservationActions'
import { createReservationList } from './reservationList'
import { useSession, type ApiCaller } from './session'

export interface BoardDeps {
  api: ApiClient
  call: ApiCaller
  reference: ReferenceStore
  // 客户端“现在”（场馆本地时间戳），只用于取消按钮置灰（TEST-2 K3）；缺省取创建时刻，页面里每 30 秒刷新。
  now?: Ref<string>
  // 当前登录人（签到码卡片上的“预约人 姓名（用户名）”）；缺省时卡片只显示预约里的姓名。
  booker?: () => Pick<UserProfile, 'displayName' | 'username'> | null
}

const NOW_REFRESH_MS = 30 * 1000

// 仍占用名额的展示状态：后端持有数（HeldReservations）= CONFIRMED 且未结束，已签到、结束前已签退的也算。
const HOLDING_DISPLAY: ReadonlySet<DisplayStatus> = new Set(['UPCOMING', 'CHECKIN_OPEN', 'IN_USE', 'CHECKED_OUT'])

function isHolding(item: Reservation): boolean {
  return item.status === 'CONFIRMED' && HOLDING_DISPLAY.has(item.displayStatus)
}

export interface HoldingLimit {
  held: number
  max: number
}

// 列表数据：本人 CURRENT 预约（共用列表组合函数）与 BookingRules。
function createBoardData(deps: BoardDeps) {
  const list = createReservationList(deps, 'CURRENT')
  const rulesError = ref<string | null>(null)

  const rules = computed<BookingRules | null>(() => deps.reference.bookingRules)
  const cards = computed(() => list.items.value.map((item) => buildCard(item, rules.value)))
  // 没有 CURRENT 预约是空状态（订场入口在页面里）。
  const isEmpty = computed(() => list.phase.value === 'ready' && list.items.value.length === 0)

  // UI-4 同时持有提示：CURRENT 与后端第 7 步共用“CONFIRMED 且未结束”的口径（后端 HeldReservations），所以未取得的页按 total 计；
  // 本页取消、签退后卡片就地替换、暂不离开列表，已取得的条目按状态重新数。列表或规则不可用时不显示（null）。
  const holding = computed<HoldingLimit | null>(() => {
    if (list.phase.value !== 'ready' || rules.value === null) {
      return null
    }
    const unloaded = Math.max(list.total.value - list.items.value.length, 0)
    return { held: unloaded + list.items.value.filter(isHolding).length, max: rules.value.maxActiveReservationsPerUser }
  })

  async function fetchRules(): Promise<void> {
    const result = await deps.reference.loadBookingRules(deps.call)
    rulesError.value = result.ok || result.sessionEnded ? null : result.message
  }

  async function load(): Promise<void> {
    await Promise.all([list.load(), fetchRules()])
  }

  return {
    items: list.items, phase: list.phase, loadError: list.error, rulesError, rules, cards, isEmpty, holding,
    fetchList: list.refresh, load, replace: list.replace,
  }
}

// 取消按钮置灰（docs/03 第 4.4 节，TEST-2 K3）：置灰的卡片 id 与说明文字；不改变卡片本身与 displayStatus。
function createCancelLock(data: ReturnType<typeof createBoardData>, now: Ref<string>) {
  const cancelLockedIds = computed(() => new Set(data.items.value
    .filter((item) => isCancelLocked(item, data.rules.value, now.value)).map((item) => item.id)))
  const lockNote = computed(() => (data.rules.value === null ? null : cancelLockedNote(data.rules.value)))
  return { cancelLockedIds, cancelLockedNote: lockNote }
}

export function createReservationBoard(deps: BoardDeps) {
  const data = createBoardData(deps)
  const now = deps.now ?? ref(nowShanghai())
  const lock = createCancelLock(data, now)
  const sheet = createCheckInSheet({
    api: deps.api, call: deps.call, items: data.items, cards: data.cards, rules: data.rules,
    booker: deps.booker ?? (() => null), refresh: data.fetchList,
  })
  const actions = createReservationActions(deps, {
    items: data.items, cards: data.cards, replace: data.replace, refresh: data.fetchList,
    isLocked: (id, action) => action === 'CANCEL' && lock.cancelLockedIds.value.has(id),
    showCode: sheet.open,
  })
  return {
    phase: data.phase, loadError: data.loadError, rulesError: data.rulesError, rules: data.rules,
    cards: data.cards, isEmpty: data.isEmpty, holding: data.holding, load: data.load, now,
    ...lock,
    ...actions,
    sheet,
  }
}

export type ReservationBoard = ReturnType<typeof createReservationBoard>

export function useReservationBoard(): ReservationBoard {
  const now = ref(nowShanghai())
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    timer = setInterval(() => {
      now.value = nowShanghai()
    }, NOW_REFRESH_MS)
  })
  onBeforeUnmount(() => clearInterval(timer))
  const auth = useAuthStore()
  return createReservationBoard({
    api, call: useSession().caller(), reference: useReferenceStore(), now, booker: () => auth.user,
  })
}
