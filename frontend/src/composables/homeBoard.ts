// 首页的全部逻辑（FE-3 规划裁决 P2）：最近一条预约的摘要、“还有 N 个预约”、系统公告、空状态。
// 页面按 sections 的顺序渲染，所以“公告在摘要之后”由数据保证，而不是靠模板顺序碰巧。
import { computed, ref } from 'vue'

import type { ApiClient } from '../api/client'
import { api } from '../api/index'
import type { Announcement } from '../api/types'
import { buildAnnouncement, buildSummary, type AnnouncementItem, type ReservationSummary } from '../utils/reservationDisplay'
import { createReservationList } from './reservationList'
import { useSession, type ApiCaller } from './session'

export interface HomeDeps {
  api: ApiClient
  call: ApiCaller
}

export type HomeSection =
  | { kind: 'summary'; summary: ReservationSummary; moreCount: number }
  | { kind: 'empty' }
  | { kind: 'reservationError'; message: string }
  | { kind: 'announcements' }

export function createHomeBoard(deps: HomeDeps) {
  const list = createReservationList(deps, 'CURRENT')
  const announcements = ref<Announcement[]>([])
  const announcementsLoaded = ref(false)
  const announcementError = ref<string | null>(null)

  const announcementItems = computed<AnnouncementItem[]>(() => announcements.value.map(buildAnnouncement))

  // CURRENT 按开始时间升序（docs/12 第 5.3 节），第一条就是最近一条；其余的数量以 total 为准。
  const phase = list.phase
  const sections = computed<HomeSection[]>(() => {
    if (phase.value === 'idle' || phase.value === 'loading') {
      return []
    }
    const first = list.items.value[0]
    const head: HomeSection = phase.value === 'failed'
      ? { kind: 'reservationError', message: list.error.value ?? '' }
      : first === undefined
        ? { kind: 'empty' }
        : { kind: 'summary', summary: buildSummary(first), moreCount: Math.max(list.total.value - 1, 0) }
    return [head, { kind: 'announcements' }]
  })

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
    await Promise.all([list.load(), loadAnnouncements()])
  }

  return { phase, sections, announcementItems, announcementsLoaded, announcementError, load }
}

export type HomeBoard = ReturnType<typeof createHomeBoard>

export function useHomeBoard(): HomeBoard {
  return createHomeBoard({ api, call: useSession().caller() })
}
