// 场馆卡片上的“置顶公告”（UI-3 裁决第 1 节第一层、第 4 节第 3 条）：接口没有置顶字段，
// 取每个场馆最新一条有效的场馆公告（GET /announcements?scope=VENUE 按发布时间倒序的第一条）。
// 所有场馆都取，包括未开放预约的。取不到时该卡片不显示公告，不打断订场（完整公告与错误文案仍在时段层显示）。
import { ref } from 'vue'

import type { ApiClient } from '../api/client'
import { buildAnnouncement, type AnnouncementItem } from '../utils/reservationDisplay'
import type { ApiCaller } from './session'

interface PinnedDeps {
  api: ApiClient
  call: ApiCaller
}

export function createPinnedNotices(deps: PinnedDeps) {
  const items = ref<Record<number, AnnouncementItem>>({})
  let latest = 0

  async function fetchOne(venueId: number): Promise<[number, AnnouncementItem | null]> {
    const result = await deps.call(() => deps.api.listAnnouncements({ scope: 'VENUE', venueId }))
    const first = result.ok ? result.value[0] : undefined
    return [venueId, first === undefined ? null : buildAnnouncement(first)]
  }

  // 较早发出、较晚返回的一轮结果不覆盖较新的一轮。
  async function load(venueIds: number[]): Promise<void> {
    latest += 1
    const mine = latest
    const pairs = await Promise.all(venueIds.map(fetchOne))
    if (mine !== latest) {
      return
    }
    const next: Record<number, AnnouncementItem> = {}
    for (const [venueId, item] of pairs) {
      if (item !== null) {
        next[venueId] = item
      }
    }
    items.value = next
  }

  return { items, load }
}
