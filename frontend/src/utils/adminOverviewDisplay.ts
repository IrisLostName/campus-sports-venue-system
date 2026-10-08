// 概览页的展示口径（FE-5 P1）。只格式化接口返回的数字，不重新计算任何统计（docs/16 第 5 节第 3 项、FE-5 X6）。
import type { StatsOverview } from '../api/typesSection5'

export const EMPTY_RATE_TEXT = '—'

// 比率 0–1 → 百分数文案；null（分母为 0）显示“—”。
export function formatRate(rate: number | null): string {
  return rate === null ? EMPTY_RATE_TEXT : `${(rate * 100).toFixed(1)}%`
}

export interface MetricView {
  key: string
  label: string
  value: string
}

export function buildMetrics(stats: StatsOverview): MetricView[] {
  return [
    { key: 'reservationCount', label: '预约量', value: String(stats.reservationCount) },
    { key: 'activeOccupiedSlots', label: '有效占用时段数', value: String(stats.activeOccupiedSlots) },
    { key: 'openSlots', label: '开放时段数', value: String(stats.openSlots) },
    { key: 'utilizationRate', label: '利用率', value: formatRate(stats.utilizationRate) },
    { key: 'currentInUse', label: '当前使用', value: String(stats.currentInUse) },
    { key: 'userCancelCount', label: '用户取消量', value: String(stats.userCancelCount) },
    { key: 'adminCancelCount', label: '管理员取消量', value: String(stats.adminCancelCount) },
    { key: 'noShowRate', label: '未到场率', value: formatRate(stats.noShowRate) },
  ]
}

export interface DailyView {
  date: string
  countText: string
  rateText: string
  barPercent: number     // 仅用于柱条宽度（相对本区间最大预约量），不是统计口径
}

export function buildDaily(stats: StatsOverview): DailyView[] {
  const peak = Math.max(0, ...stats.daily.map((day) => day.reservationCount))
  return stats.daily.map((day) => ({
    date: day.date,
    countText: String(day.reservationCount),
    rateText: formatRate(day.utilizationRate),
    barPercent: peak === 0 ? 0 : Math.round((day.reservationCount / peak) * 100),
  }))
}

export function rangeText(stats: StatsOverview): string {
  return `统计区间：${stats.dateFrom} 至 ${stats.dateTo}`
}
