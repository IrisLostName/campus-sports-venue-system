// 预约的展示口径（FE-3 规划裁决 P3、P4、P5 与按钮规则 B1）。
// 前端不推导状态：按钮只依据后端给出的 displayStatus 与 checkInAt / checkOutAt，不做时间运算（docs/16 第 5 节第 3 项）。
import type { Announcement, BookingRules, DisplayStatus, Reservation } from '../api/types'

// P5：中文名取自 docs/03 第 4.4 节；ADMIN_CANCELLED 的“管理员已取消”由规划裁决给出。
export const DISPLAY_STATUS_LABELS: Record<DisplayStatus, string> = {
  UPCOMING: '待使用',
  CHECKIN_OPEN: '可签到',
  IN_USE: '使用中',
  CHECKED_OUT: '已签退',
  COMPLETED: '已完成',
  NO_SHOW: '未到场',
  CANCELLED: '已取消',
  ADMIN_CANCELLED: '管理员已取消',
}

export function displayStatusLabel(status: DisplayStatus): string {
  return DISPLAY_STATUS_LABELS[status]
}

export type ReservationAction = 'CHECK_IN' | 'CHECK_OUT' | 'CANCEL'

export const ACTION_LABELS: Record<ReservationAction, string> = {
  CHECK_IN: '签到',
  CHECK_OUT: '签退',
  CANCEL: '取消预约',
}

type ActionInput = Pick<Reservation, 'displayStatus' | 'checkInAt' | 'checkOutAt'>

// FE-3-rulings 第 2 节表格。CHECKIN_OPEN 不显示“取消”（B1）：签到窗口必然晚于取消期限。
// COMPLETED 且已签到未签退：03 第 4.3 节允许在宽限内签退，超出宽限由后端返回 INVALID_STATE。
export function actionsFor(reservation: ActionInput): ReservationAction[] {
  switch (reservation.displayStatus) {
    case 'UPCOMING':
      return ['CANCEL']
    case 'CHECKIN_OPEN':
      return ['CHECK_IN']
    case 'IN_USE':
      return ['CHECK_OUT']
    case 'COMPLETED':
      return reservation.checkInAt !== null && reservation.checkOutAt === null ? ['CHECK_OUT'] : []
    default:
      return []
  }
}

// P4：说明文案里的数字全部来自 BookingRules，不写死。
export function cancelNote(rules: BookingRules): string {
  return `开始前至少 ${rules.cancelDeadlineMinutes} 分钟可取消`
}

export function checkInNote(rules: BookingRules): string {
  return `开始前 ${rules.checkInOpenBeforeMinutes} 分钟至开始后 ${rules.checkInCloseAfterMinutes} 分钟可签到；`
    + `结束后 ${rules.checkOutGraceMinutes} 分钟内可签退`
}

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'] as const

// 2026-10-13 → 2026-10-13 周二。星期只用于展示，与 UTC 无关（先按 UTC 构造再按 UTC 读取）。
export function formatServiceDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) {
    return date
  }
  const weekday = WEEKDAY_NAMES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return weekday === undefined ? date : `${date} 周${weekday}`
}

export function formatTimeRange(reservation: Pick<Reservation, 'startTime' | 'endTime'>): string {
  return `${reservation.startTime}–${reservation.endTime}`
}

// 2026-10-12T09:00:00 → 2026-10-12 09:00
export function formatTimestamp(timestamp: string): string {
  return timestamp.slice(0, 'YYYY-MM-DDTHH:mm'.length).replace('T', ' ')
}

export interface ReservationCard {
  id: number
  place: string                  // 场馆 · 场地
  dateText: string
  timeText: string
  userDisplayName: string
  statusLabel: string
  displayStatus: DisplayStatus
  purpose: string | null         // 非空时显示
  adminNote: string | null       // 非空时显示，标题“管理员说明”
  checkInNote: string | null     // 规则尚未取得时为 null
  cancelNote: string | null
  actions: ReservationAction[]
}

function nonEmpty(text: string | null): string | null {
  return text === null || text.trim() === '' ? null : text
}

// P3 详情卡片的全部字段。rules 为 null（尚未取得）时不显示说明文案，也不写死数字。
export function buildCard(reservation: Reservation, rules: BookingRules | null): ReservationCard {
  return {
    id: reservation.id,
    place: `${reservation.venueName} · ${reservation.resourceName}`,
    dateText: formatServiceDate(reservation.serviceDate),
    timeText: formatTimeRange(reservation),
    userDisplayName: reservation.userDisplayName,
    statusLabel: displayStatusLabel(reservation.displayStatus),
    displayStatus: reservation.displayStatus,
    purpose: nonEmpty(reservation.purpose),
    adminNote: nonEmpty(reservation.adminNote),
    checkInNote: rules === null ? null : checkInNote(rules),
    cancelNote: rules === null ? null : cancelNote(rules),
    actions: actionsFor(reservation),
  }
}

export interface AnnouncementItem {
  id: number
  title: string
  content: string | null         // 与标题完全相同时不重复显示
  publishedText: string
}

export function buildAnnouncement(announcement: Announcement): AnnouncementItem {
  return {
    id: announcement.id,
    title: announcement.title,
    content: announcement.content === announcement.title ? null : announcement.content,
    publishedText: formatTimestamp(announcement.publishedAt),
  }
}

// P2 首页摘要：日期、时间、地点、人物、展示状态。
export interface ReservationSummary {
  id: number
  dateText: string
  timeText: string
  place: string
  userDisplayName: string
  statusLabel: string
}

export function buildSummary(reservation: Reservation): ReservationSummary {
  return {
    id: reservation.id,
    dateText: formatServiceDate(reservation.serviceDate),
    timeText: formatTimeRange(reservation),
    place: `${reservation.venueName} · ${reservation.resourceName}`,
    userDisplayName: reservation.userDisplayName,
    statusLabel: displayStatusLabel(reservation.displayStatus),
  }
}
