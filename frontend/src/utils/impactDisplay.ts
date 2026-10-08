// 影响检查的展示口径（docs/12 第 5.5 节，FE-5 P4）：解析 409 的 details.impact，并给出完成后的提示文案。
import type { ImpactReport, OnExisting, ReservationBrief } from '../api/types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isBrief(value: unknown): value is ReservationBrief {
  return isRecord(value)
    && typeof value.id === 'number' && typeof value.resourceName === 'string'
    && typeof value.serviceDate === 'string' && typeof value.startTime === 'string'
    && typeof value.endTime === 'string' && typeof value.userDisplayName === 'string'
}

// details.impact 不符合 ImpactReport 时返回 null，由调用方按普通错误处理。
export function parseImpact(value: unknown): ImpactReport | null {
  if (!isRecord(value) || typeof value.affectedCount !== 'number' || !Array.isArray(value.reservations)) {
    return null
  }
  const reservations: unknown[] = value.reservations
  return reservations.every(isBrief) ? { affectedCount: value.affectedCount, reservations } : null
}

export function briefText(brief: ReservationBrief): string {
  return `${brief.resourceName} · ${brief.serviceDate} ${brief.startTime}–${brief.endTime} · ${brief.userDisplayName}`
}

export const CHOICE_REQUIRED_TEXT = '请选择保留或取消'

// 提交成功后的提示：选了取消时显示接口返回的 cancelledIds 数量。
export function impactDoneText(choice: OnExisting | null, cancelledCount: number): string {
  return choice === 'CANCEL' ? `已保存，并取消 ${cancelledCount} 个受影响预约` : '已保存'
}
