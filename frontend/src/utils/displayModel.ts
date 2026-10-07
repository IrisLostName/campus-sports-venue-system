// 运营大屏的展示数据映射（docs/12 第 5.10 节、docs/03 第 4.5、8 节；FE-7-rulings D2–D4）。
// 只把接口给出的值整理成页面要显示的文字与分组，不重新计算场地实时状态或统计口径。
import type { ResourceLiveState, VenueStatus } from '../api/types'
import type { DisplaySummary } from '../api/typesSection5'
import type { ErrorText } from './errorText'

export const NOTICE_LIMIT = 5
export const NO_RATE_TEXT = '—'

const STATE_LABELS: Record<ResourceLiveState, string> = {
  FREE: '空闲',
  RESERVED: '已预约',
  IN_USE: '使用中',
  MAINTENANCE: '维护',
  DISABLED: '停用',
}

const VENUE_STATUS_LABELS: Record<VenueStatus, string> = {
  OPEN: '开放',
  CLOSED: '关闭',
}

const YEAR_PREFIX_LENGTH = 'YYYY-'.length

export function stateLabel(state: ResourceLiveState): string {
  return STATE_LABELS[state]
}

// 比率（0–1）显示为百分比，保留一位小数；null（开放时段数为 0）显示“—”（docs/03 第 8 节）。
export function formatRate(rate: number | null): string {
  return rate === null ? NO_RATE_TEXT : `${(rate * 100).toFixed(1)}%`
}

// 场馆本地时间戳 YYYY-MM-DDTHH:mm:ss（docs/12 第 1 节）→ 页面上的 YYYY-MM-DD HH:mm:ss。
export function formatTimestamp(timestamp: string): string {
  return timestamp.replace('T', ' ')
}

export interface MetricView {
  key: 'reservations' | 'inUse' | 'utilization'
  label: string
  value: string
}

export interface ResourceView {
  id: number
  name: string
  state: ResourceLiveState
  stateLabel: string
}

export interface VenueGroupView {
  id: number
  name: string
  statusLabel: string
  bookingLabel: string
  openText: string
  reservedNowText: string
  resources: ResourceView[]
}

export interface TrendBarView {
  date: string
  label: string
  count: number
  heightPercent: number
}

export interface NoticeView {
  id: number
  title: string
}

export interface DisplayBoardView {
  generatedAtText: string
  metrics: MetricView[]
  venues: VenueGroupView[]
  trend: TrendBarView[]
  notices: NoticeView[]
}

function buildMetrics(summary: DisplaySummary): MetricView[] {
  return [
    { key: 'reservations', label: '今日预约量', value: String(summary.todayReservationCount) },
    { key: 'inUse', label: '当前使用', value: String(summary.currentInUse) },
    { key: 'utilization', label: '今日利用率', value: formatRate(summary.todayUtilizationRate) },
  ]
}

function buildVenues(summary: DisplaySummary): VenueGroupView[] {
  return summary.venues.map((venue) => ({
    id: venue.venueId,
    name: venue.venueName,
    statusLabel: VENUE_STATUS_LABELS[venue.operationalStatus],
    bookingLabel: venue.userBookingEnabled ? '开放预约' : '未开放预约',
    openText: `开放场地 ${venue.resourceOpen}/${venue.resourceTotal}`,
    reservedNowText: `当前已预约 ${venue.resourcesReservedNow}`,
    resources: summary.resources
      .filter((resource) => resource.venueId === venue.venueId)
      .map((resource) => ({
        id: resource.resourceId,
        name: resource.resourceName,
        state: resource.state,
        stateLabel: stateLabel(resource.state),
      })),
  }))
}

// 柱高只是相对最大值的显示比例；日期标签取 MM-DD。
function buildTrend(summary: DisplaySummary): TrendBarView[] {
  const peak = Math.max(0, ...summary.weekTrend.map((day) => day.reservationCount))
  return summary.weekTrend.map((day) => ({
    date: day.date,
    label: day.date.slice(YEAR_PREFIX_LENGTH),
    count: day.reservationCount,
    heightPercent: peak === 0 ? 0 : (day.reservationCount / peak) * 100,
  }))
}

export function buildDisplayBoardView(summary: DisplaySummary): DisplayBoardView {
  return {
    generatedAtText: formatTimestamp(summary.generatedAt),
    metrics: buildMetrics(summary),
    venues: buildVenues(summary),
    trend: buildTrend(summary),
    notices: summary.notices.slice(0, NOTICE_LIMIT).map((notice) => ({ id: notice.id, title: notice.title })),
  }
}

// 轮询状态（composables/displayPolling.ts 维护）：尚无数据 / 无数据且失败 / 有数据（可能带最近一次失败）。
export type DisplayBoardState =
  | { phase: 'loading' }
  | { phase: 'error'; failure: ErrorText }
  | { phase: 'ready'; summary: DisplaySummary; failure: ErrorText | null }

export type BoardPresentation =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; view: DisplayBoardView; staleNotice: string | null }

// FE-7-rulings T3：保留上一次成功的数据，提示失败原因与旧数据的生成时间。
export function staleNoticeText(failure: ErrorText, generatedAt: string): string {
  return `数据更新失败，${failure.message}，显示的是 ${formatTimestamp(generatedAt)} 的数据`
}

export function presentBoard(state: DisplayBoardState): BoardPresentation {
  if (state.phase === 'loading') {
    return { kind: 'loading' }
  }
  if (state.phase === 'error') {
    return { kind: 'error', message: `数据加载失败，${state.failure.message}，系统会自动重试` }
  }
  return {
    kind: 'ready',
    view: buildDisplayBoardView(state.summary),
    staleNotice: state.failure === null ? null : staleNoticeText(state.failure, state.summary.generatedAt),
  }
}
