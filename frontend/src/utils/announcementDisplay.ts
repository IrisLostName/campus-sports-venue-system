// 公告管理的展示口径（FE-5 P6；docs/12 第 5.8 节）。归档按钮只依据 scope 与 status：系统公告不显示归档，已归档的不再显示。
import type { Announcement, AnnouncementScope, AnnouncementStatus } from '../api/types'
import { formatTimestamp } from './reservationDisplay'

export const SCOPE_LABELS: Record<AnnouncementScope, string> = {
  SYSTEM: '系统公告',
  VENUE: '场馆公告',
}

export const STATUS_LABELS: Record<AnnouncementStatus, string> = {
  ACTIVE: '生效中',
  ARCHIVED: '已归档',
}

export const ANNOUNCEMENT_FILTER_ITEMS = [
  { value: '', label: '全部' },
  { value: 'ACTIVE', label: STATUS_LABELS.ACTIVE },
  { value: 'ARCHIVED', label: STATUS_LABELS.ARCHIVED },
]

// docs/13：公告标题 100、内容 2000（FE-5 裁决 Q8）。
export const TITLE_MAX_LENGTH = 100
export const CONTENT_MAX_LENGTH = 2000
export const TITLE_REQUIRED_TEXT = '请填写标题'
export const CONTENT_REQUIRED_TEXT = '请填写内容'

// datetime-local 给出 YYYY-MM-DDTHH:mm，接口要 YYYY-MM-DDTHH:mm:ss（docs/12 第 1 节）；空表示不过期。
export function toExpiresAt(local: string): string | undefined {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ? `${local}:00` : undefined
}

export interface AnnouncementRowView {
  id: number
  title: string
  content: string
  scopeLabel: string
  statusLabel: string
  publishedText: string
  publishedByName: string
  expiresText: string | null
  canArchive: boolean
}

export function buildAnnouncementRow(announcement: Announcement): AnnouncementRowView {
  return {
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    scopeLabel: SCOPE_LABELS[announcement.scope],
    statusLabel: STATUS_LABELS[announcement.status],
    publishedText: formatTimestamp(announcement.publishedAt),
    publishedByName: announcement.publishedByName,
    expiresText: announcement.expiresAt === null ? null : formatTimestamp(announcement.expiresAt),
    canArchive: announcement.scope === 'VENUE' && announcement.status === 'ACTIVE',
  }
}
