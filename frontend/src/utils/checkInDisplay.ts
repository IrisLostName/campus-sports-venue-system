// 扫码签到的展示口径（P2-1c）：用户端签到码卡片上的各项时间，与管理端扫码结果的文案。
// 卡片上的签到时间、签到截止、签退截止由 BookingRules 算出，只是展示文字（P2-1c 裁决第 6 节第 4 条，TEST-2 K3 先例）；
// 状态与按钮仍只来自后端的 displayStatus，这里不判断任何状态。
import type { BookingRules, DisplayStatus, Reservation, ReservationStatus, UserProfile } from '../api/types'
import type { AdminReservation } from '../api/typesSection5'
import { messageFor } from './errorMessages'
import { DISPLAY_STATUS_LABELS, formatServiceDate, formatTimeRange, formatTimestamp, placeOf } from './reservationDisplay'

const MINUTES_PER_DAY = 24 * 60

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

// HH:mm 加减分钟后的 HH:mm；跨过午夜时注明（演示场馆不会出现，只为文字不出错）。
export function shiftTime(time: string, deltaMinutes: number): string {
  const total = minutesOf(time) + deltaMinutes
  const day = Math.floor(total / MINUTES_PER_DAY)
  const inDay = total - day * MINUTES_PER_DAY
  const text = `${String(Math.floor(inDay / 60)).padStart(2, '0')}:${String(inDay % 60).padStart(2, '0')}`
  return day === 0 ? text : `${day > 0 ? '次日' : '前一日'} ${text}`
}

export interface CheckInTicketView {
  id: number
  venueId: number
  venueName: string
  place: string                 // 场馆 · 场地
  bookerText: string            // 预约人 姓名（用户名）
  dateText: string
  slotText: string              // 预约时段
  usableText: string | null     // 可使用时段（含签退截止）；规则未取得时为 null
  windowText: string | null     // 签到时间窗口
  deadlineText: string | null   // 签到截止
  statusLabel: string
  displayStatus: DisplayStatus
}

type Booker = Pick<UserProfile, 'displayName' | 'username'> | null

export function bookerText(reservation: Pick<Reservation, 'userDisplayName'>, booker: Booker): string {
  return booker === null ? `预约人 ${reservation.userDisplayName}` : `预约人 ${booker.displayName}（${booker.username}）`
}

export function buildTicket(reservation: Reservation, rules: BookingRules | null, booker: Booker): CheckInTicketView {
  const slot = formatTimeRange(reservation)
  const opens = rules === null ? null : shiftTime(reservation.startTime, -rules.checkInOpenBeforeMinutes)
  const closes = rules === null ? null : shiftTime(reservation.startTime, rules.checkInCloseAfterMinutes)
  const checkoutBy = rules === null ? null : shiftTime(reservation.endTime, rules.checkOutGraceMinutes)
  return {
    id: reservation.id,
    venueId: reservation.venueId,
    venueName: reservation.venueName,
    place: placeOf(reservation),
    bookerText: bookerText(reservation, booker),
    dateText: formatServiceDate(reservation.serviceDate),
    slotText: slot,
    usableText: checkoutBy === null ? null : `${slot}（${checkoutBy} 前签退）`,
    windowText: opens === null || closes === null ? null : `${opens}–${closes}`,
    deadlineText: closes,
    statusLabel: DISPLAY_STATUS_LABELS[reservation.displayStatus],
    displayStatus: reservation.displayStatus,
  }
}

// 轮播当前是第几张：按滚动位置取最近的一张，限制在 [0, count − 1]。
export function slideIndex(scrollLeft: number, slideWidth: number, count: number): number {
  if (count <= 0 || slideWidth <= 0) {
    return 0
  }
  return Math.min(count - 1, Math.max(0, Math.round(scrollLeft / slideWidth)))
}

// ---------- 管理端扫码结果 ----------

export interface ScanFact {
  label: string
  value: string
}

export interface ScanOutcome {
  ok: boolean
  title: string
  detail: string | null
  facts: ScanFact[]
}

// 成功：预约人（姓名与用户名）、场馆 · 场地、日期与时段、签到时刻。
export function scanSuccess(reservation: AdminReservation): ScanOutcome {
  const checkedAt = reservation.checkInAt === null ? '—' : formatTimestamp(reservation.checkInAt).slice('YYYY-MM-DD '.length)
  return {
    ok: true,
    title: '签到成功',
    detail: null,
    facts: [
      { label: '预约人', value: `${reservation.userDisplayName}（${reservation.userUsername}）` },
      { label: '场地', value: placeOf(reservation) },
      { label: '时段', value: `${formatServiceDate(reservation.serviceDate)} ${formatTimeRange(reservation)}` },
      { label: '签到时间', value: checkedAt },
    ],
  }
}

const STATUS_LABELS: Record<ReservationStatus, string> = {
  CONFIRMED: '已确认',
  CANCELLED: DISPLAY_STATUS_LABELS.CANCELLED,
  ADMIN_CANCELLED: DISPLAY_STATUS_LABELS.ADMIN_CANCELLED,
  NO_SHOW: DISPLAY_STATUS_LABELS.NO_SHOW,
  COMPLETED: DISPLAY_STATUS_LABELS.COMPLETED,
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function windowDetail(details: Record<string, unknown> | undefined): string | null {
  const opensAt = textOf(details?.opensAt)
  const closesAt = textOf(details?.closesAt)
  return opensAt === null || closesAt === null
    ? null
    : `该预约的签到时间为 ${formatTimestamp(opensAt)}–${formatTimestamp(closesAt).slice('YYYY-MM-DD '.length)}。`
}

function stateDetail(details: Record<string, unknown> | undefined): string | null {
  const status = textOf(details?.status)
  return status !== null && Object.hasOwn(STATUS_LABELS, status)
    ? `该预约当前为“${STATUS_LABELS[status as ReservationStatus]}”。`
    : null
}

type DetailOf = (details: Record<string, unknown> | undefined) => string | null

// 各错误码的补充说明；VALIDATION_ERROR 另换标题（签到码格式由后端校验，fields.code）。
const FAILURE_DETAILS: Record<string, DetailOf> = {
  VALIDATION_ERROR: () => '请对准用户手机上的二维码重新扫描，或检查输入的内容。',
  CHECKIN_CODE_INVALID: () => '这个码与任何预约都对不上。',
  FORBIDDEN_SCOPE: () => '该预约所属场馆不在你的授权范围内。',
  CHECKIN_WINDOW_CLOSED: windowDetail,
  INVALID_STATE: stateDetail,
  ALREADY_CHECKED_IN: () => '该预约已经签到过了。',
}

// 失败：按错误码显示 ERROR_MESSAGES 文案（契约 v1.1 第 3 节），并按码补充说明。
export function scanFailure(code: string, details: Record<string, unknown> | undefined): ScanOutcome {
  const title = code === 'VALIDATION_ERROR' ? '签到码格式不正确' : messageFor(code)
  const detailOf = Object.hasOwn(FAILURE_DETAILS, code) ? FAILURE_DETAILS[code] : undefined
  return { ok: false, title, detail: detailOf === undefined ? null : detailOf(details), facts: [] }
}
