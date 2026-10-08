// 预约管理的展示口径（FE-5 P2；docs/10 第 6 节、FE-5 裁决 Q1）。
// 按钮是否出现只依据 status / displayStatus / checkInAt，不做时间运算；其余以后端错误码为准（INVALID_STATE 等）。
import type { Occupancy, AdminReservation } from '../api/typesSection5'
import type { ReservationStatus } from '../api/types'
import { displayStatusLabel, formatTimeRange } from './reservationDisplay'
import { toneForDisplayStatus, type Tone } from './statusTone'

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  CONFIRMED: '已确认',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  ADMIN_CANCELLED: '管理员已取消',
  NO_SHOW: '未到场',
}

export const RESERVATION_FILTER_OPTIONS = (Object.keys(RESERVATION_STATUS_LABELS) as ReservationStatus[])
  .map((value) => ({ value, label: RESERVATION_STATUS_LABELS[value] }))

export type ReservationOp = 'CANCEL' | 'REASSIGN_RESOURCE' | 'REASSIGN_USER'

export const OP_LABELS: Record<ReservationOp, string> = {
  CANCEL: '取消',
  REASSIGN_RESOURCE: '改派场地',
  REASSIGN_USER: '改派人员',
}

type OpInput = Pick<AdminReservation, 'status' | 'displayStatus' | 'checkInAt'>

// Q1：CONFIRMED 且展示状态不是 COMPLETED / NO_SHOW 时可取消；两种改派再加“没有签到记录”。
export function opsFor(reservation: OpInput): ReservationOp[] {
  const open = reservation.status === 'CONFIRMED'
    && reservation.displayStatus !== 'COMPLETED' && reservation.displayStatus !== 'NO_SHOW'
  if (!open) {
    return []
  }
  return reservation.checkInAt === null ? ['CANCEL', 'REASSIGN_RESOURCE', 'REASSIGN_USER'] : ['CANCEL']
}

export interface AdminReservationRow {
  id: number
  dateText: string
  timeText: string
  place: string
  userName: string
  userDetail: string
  statusLabel: string
  tone: Tone
  adminNote: string | null
  ops: ReservationOp[]
}

export function buildReservationRow(reservation: AdminReservation): AdminReservationRow {
  const note = reservation.adminNote
  return {
    id: reservation.id,
    dateText: reservation.serviceDate,
    timeText: formatTimeRange(reservation),
    place: reservation.resourceName,
    userName: reservation.userDisplayName,
    userDetail: reservation.userPhone === null ? reservation.userUsername : `${reservation.userUsername} · ${reservation.userPhone}`,
    statusLabel: displayStatusLabel(reservation.displayStatus),
    tone: toneForDisplayStatus(reservation.displayStatus),
    adminNote: note === null || note.trim() === '' ? null : note,
    ops: opsFor(reservation),
  }
}

// 对话框里描述“是哪一条预约”。
export function reservationSummary(reservation: AdminReservation): string {
  return `${reservation.venueName} · ${reservation.resourceName} · ${reservation.serviceDate} ${formatTimeRange(reservation)} · ${reservation.userDisplayName}`
}

export interface ReassignResourceOption {
  resourceId: number
  name: string
  slots: { startTime: string; timeText: string }[]    // 只含状态为 AVAILABLE 的格子（FE-5 P2）
}

export function buildReassignOptions(occupancy: Occupancy): ReassignResourceOption[] {
  return occupancy.resources.map((resource) => ({
    resourceId: resource.resourceId,
    name: resource.resourceName,
    slots: resource.slots
      .filter((slot) => slot.status === 'AVAILABLE')
      .map((slot) => ({ startTime: slot.startTime, timeText: `${slot.startTime}–${slot.endTime}` })),
  }))
}

// 目标用户 ID：正整数。
export function parseUserId(text: string): number | null {
  return /^[1-9]\d*$/.test(text.trim()) ? Number(text.trim()) : null
}

export const USER_ID_INVALID_TEXT = '请输入有效的用户 ID（正整数）'
export const TARGET_RESOURCE_REQUIRED_TEXT = '请选择目标场地'
export const TARGET_START_REQUIRED_TEXT = '请选择开始时间'
