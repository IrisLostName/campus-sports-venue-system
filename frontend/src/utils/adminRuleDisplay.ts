// 开放规则的展示口径（FE-5 P3；docs/12 第 5.6 节、docs/09 第 4 节）：每周窗口的编辑草稿与特殊关闭列表。
import type { Closure, WeeklyWindow } from '../api/typesSection5'
import type { WeeklyWindowInput } from '../api/requests'
import type { Resource } from '../api/types'
import { weekdayLabel, WHOLE_VENUE_TEXT } from './adminResourceDisplay'

// 编辑中的一行：weekday 是 select 的值（'1'–'7'），时间是 <input type="time"> 的 HH:mm。key 只用于列表渲染。
export interface WeeklyDraftRow {
  key: number
  weekday: string
  openTime: string
  closeTime: string
}

// 删除按钮的可访问名称里指明“是哪个窗口”（FE-8 L11）：星期 开放时间–关闭时间，没填的时间写“未填”。
export function windowName(row: Pick<WeeklyDraftRow, 'weekday' | 'openTime' | 'closeTime'>): string {
  return `${weekdayLabel(Number(row.weekday))} ${row.openTime === '' ? '未填' : row.openTime}–${row.closeTime === '' ? '未填' : row.closeTime}`
}

export const WEEKLY_INCOMPLETE_TEXT = '请填写每个窗口的开放时间和关闭时间'

export function draftFromWeekly(windows: readonly WeeklyWindow[]): WeeklyDraftRow[] {
  return windows.map((window, index) => ({
    key: index, weekday: String(window.weekday), openTime: window.openTime, closeTime: window.closeTime,
  }))
}

// 整体替换：草稿按原样提交；时间缺失时返回 null（提示补全），其余规则（90 分钟整数倍、重叠）由接口返回 RULE_INVALID。
export function windowsFromDraft(rows: readonly WeeklyDraftRow[]): WeeklyWindowInput[] | null {
  if (rows.some((row) => row.openTime === '' || row.closeTime === '')) {
    return null
  }
  return rows.map((row) => ({ weekday: Number(row.weekday), openTime: row.openTime, closeTime: row.closeTime }))
}

export interface ClosureRowView {
  id: number
  rangeText: string
  scopeText: string
  reasonText: string | null
}

export function buildClosureRows(closures: readonly Closure[], resources: readonly Resource[]): ClosureRowView[] {
  return closures.map((closure) => ({
    id: closure.id,
    rangeText: closure.startDate === closure.endDate ? closure.startDate : `${closure.startDate} 至 ${closure.endDate}`,
    scopeText: closure.resourceId === null
      ? WHOLE_VENUE_TEXT
      : (resources.find((resource) => resource.id === closure.resourceId)?.name ?? `场地 #${closure.resourceId}`),
    reasonText: closure.reason === null || closure.reason.trim() === '' ? null : closure.reason,
  }))
}

export const CLOSURE_DATES_REQUIRED_TEXT = '请填写关闭的起止日期'
