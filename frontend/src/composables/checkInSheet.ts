// “预约”页的签到码浮层（P2-1c 裁决第 2 节）：可出示的预约、打开时定位的那张、每张卡片的签到码获取与缓存。
// 可出示 = 卡片提供“出示签到码”（只依据后端 displayStatus，见 actionsFor），按列表顺序。
// 签到码固定不变：按预约逐个获取（GET /reservations/{id}/check-in-code），成功后在本页缓存；失败只影响该卡片，可单独重试。
// 扫码成功后用户端不会被推送：关闭浮层时重新拉取列表，按后端状态显示“使用中”与“签退”。
import { computed, reactive, ref, type ComputedRef, type Ref } from 'vue'

import type { ApiClient } from '../api/client'
import type { BookingRules, Reservation, UserProfile } from '../api/types'
import { buildTicket, type CheckInTicketView } from '../utils/checkInDisplay'
import type { ReservationCard } from '../utils/reservationDisplay'
import type { ApiCaller } from './session'

export type CodeEntry =
  | { state: 'loading' }
  | { state: 'ready'; code: string }
  | { state: 'error'; message: string }

export interface CheckInSheetDeps {
  api: ApiClient
  call: ApiCaller
  items: Ref<Reservation[]>
  cards: ComputedRef<ReservationCard[]>
  rules: ComputedRef<BookingRules | null>
  booker: () => Pick<UserProfile, 'displayName' | 'username'> | null
  refresh(): Promise<void>
}

export function createCheckInSheet(deps: CheckInSheetDeps) {
  const isOpen = ref(false)
  const everOpened = ref(false)        // 浮层组件只在第一次打开后才挂载（按需加载其分包）
  const startId = ref<number | null>(null)
  const codes = reactive(new Map<number, CodeEntry>())

  const showableIds = computed(() => new Set(deps.cards.value
    .filter((card) => card.actions.includes('SHOW_CODE')).map((card) => card.id)))
  const tickets = computed<CheckInTicketView[]>(() => deps.items.value
    .filter((item) => showableIds.value.has(item.id))
    .map((item) => buildTicket(item, deps.rules.value, deps.booker())))
  const startIndex = computed(() => Math.max(0, tickets.value.findIndex((ticket) => ticket.id === startId.value)))

  async function fetchCode(id: number): Promise<void> {
    codes.set(id, { state: 'loading' })
    const result = await deps.call(() => deps.api.getCheckInCode(id))
    if (result.ok) {
      codes.set(id, { state: 'ready', code: result.value.code })
    } else if (result.sessionEnded) {
      codes.delete(id)
    } else {
      codes.set(id, { state: 'error', message: result.message })
    }
  }

  // 已不在列表里的预约，缓存一并丢弃。
  function prune(): void {
    const present = new Set(deps.items.value.map((item) => item.id))
    for (const id of [...codes.keys()]) {
      if (!present.has(id)) {
        codes.delete(id)
      }
    }
  }

  function open(id: number): void {
    if (!showableIds.value.has(id)) {
      return
    }
    prune()
    startId.value = id
    isOpen.value = true
    everOpened.value = true
    for (const ticket of tickets.value) {
      const entry = codes.get(ticket.id)
      if (entry === undefined || entry.state === 'error') {
        void fetchCode(ticket.id)
      }
    }
  }

  function retry(id: number): void {
    if (codes.get(id)?.state !== 'loading') {
      void fetchCode(id)
    }
  }

  async function close(): Promise<void> {
    if (!isOpen.value) {
      return
    }
    isOpen.value = false
    await deps.refresh()
    prune()
  }

  function entryOf(id: number): CodeEntry {
    return codes.get(id) ?? { state: 'loading' }
  }

  return { isOpen, everOpened, tickets, startIndex, open, close, retry, entryOf }
}

export type CheckInSheet = ReturnType<typeof createCheckInSheet>
