// 首页的全部逻辑（FE-3 规划裁决 P2）：最近一条预约的摘要、“还有 N 个预约”、系统公告、空状态。
// 页面按 sections 的顺序渲染，所以“公告在摘要之后”由数据保证，而不是靠模板顺序碰巧。
import { computed, ref } from 'vue'

import type { ApiClient } from '../api/client'
import { api } from '../api/index'
import type { Announcement, Reservation } from '../api/types'
import { buildAnnouncement, buildSummary, type AnnouncementItem, type ReservationSummary } from '../utils/reservationDisplay'
import { useSession, type ApiCaller } from './session'

export interface HomeDeps {
  api: ApiClient
  call: ApiCaller
}

export type HomePhase = 'idle' | 'loading' | 'ready' | 'failed'

export type HomeSection =
  | { kind: 'summary'; summary: ReservationSummary; moreCount: number }
  | { kind: 'empty' }
  | { kind: 'reservationError'; message: string }
  | { kind: 'announcements' }

export function createHomeBoard(deps: HomeDeps) {
  const reservations = ref<Reservation[]>([])
  const total = ref(0)
  const phase = ref<HomePhase>('idle')
  const reservationError = ref<string | null>(null)
  const announcements = ref<Announcement[]>([])
  const announcementsLoaded = ref(false)
  const announcementError = ref<string | null>(null)

  const announcementItems = computed<AnnouncementItem[]>(() => announcements.value.map(buildAnnouncement))

  // CURRENT 按开始时间升序（docs/12 第 5.3 节），第一条就是最近一条；其余的数量以 total 为准。
  const sections = computed<HomeSection[]>(() => {
    if (phase.value === 'idle' || phase.value === 'loading') {
      return []
    }
    const first = reservations.value[0]
    const head: HomeSection = phase.value === 'failed'
      ? { kind: 'reservationError', message: reservationError.value ?? '' }
      : first === undefined
        ? { kind: 'empty' }
        : { kind: 'summary', summary: buildSummary(first), moreCount: Math.max(total.value - 1, 0) }
    return [head, { kind: 'announcements' }]
  })

  async function loadReservations(): Promise<void> {
    const result = await deps.call(() => deps.api.listMyReservations({ scope: 'CURRENT' }))
    if (result.ok) {
      reservations.value = result.value.items
      total.value = result.value.total
      reservationError.value = null
      phase.value = 'ready'
    } else if (!result.sessionEnded) {
      reservationError.value = result.message
      phase.value = 'failed'
    }
  }

  async function loadAnnouncements(): Promise<void> {
    const result = await deps.call(() => deps.api.listAnnouncements({ scope: 'SYSTEM' }))
    if (result.ok) {
      announcements.value = result.value
      announcementError.value = null
      announcementsLoaded.value = true
    } else if (!result.sessionEnded) {
      announcementError.value = result.message
    }
  }

  async function load(): Promise<void> {
    phase.value = 'loading'
    await Promise.all([loadReservations(), loadAnnouncements()])
  }

  return { phase, sections, announcementItems, announcementsLoaded, announcementError, load }
}

export type HomeBoard = ReturnType<typeof createHomeBoard>

export function useHomeBoard(): HomeBoard {
  return createHomeBoard({ api, call: useSession().caller() })
}
