// 运营大屏的展示数据映射（docs/12 第 5.10 节、docs/03 第 4.5、8 节；FE-7-rulings D2–D4）。
// 只把接口给出的值整理成页面要显示的文字与分组，不重新计算场地实时状态或统计口径。
import type { ResourceLiveState, VenueStatus } from '../api/types'
import type { DisplaySummary } from '../api/typesSection5'
import type { ErrorText } from './errorText'

export const NOTICE_LIMIT = 5
export const NO_RATE_TEXT = '—'
// 场馆列表为空时的空状态（FE-8 L3，FE-7 N6）：只看接口返回的 venues 有没有内容。
export const NO_VENUES_TITLE = '暂无场馆数据'
export const NO_VENUES_DESCRIPTION = '当前没有可展示的场馆'

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
  key: 'reservations' | 'inUse' | 'utilization' | 'openResources'
  label: string
  value: string
}

// “开放场地 X/Y”（UI-2a）：各场馆 resourceOpen、resourceTotal 的合计，不另取数据。
export interface OpenResourcesView {
  open: number
  total: number
  text: string
}

// “场地实时状态”环形图（UI-2a）：按接口给出的 state 计数，五种状态都列出（数量可为 0）。
export interface StateCountView {
  state: ResourceLiveState
  label: string
  count: number
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
  isOpen: boolean
  bookingEnabled: boolean
  openText: string
  reservedNowText: string
  // 进度条：当前已预约 ÷ 开放场地（0–1）；开放场地为 0 时为 0。
  reservedRatio: number
  resources: ResourceView[]
}

// x、y 是折线点在绘图区里的百分比坐标：x 取每列的中点，y 从上往下量（100 为横轴）。
export interface TrendBarView {
  date: string
  label: string
  count: number
  heightPercent: number
  x: number
  y: number
}

// 纵轴刻度：只取 0、最大值的一半与最大值中的整数；percent 是距横轴的高度。
export interface TrendTickView {
  value: number
  percent: number
}

export interface NoticeView {
  id: number
  title: string
}

export interface DisplayBoardView {
  generatedAtText: string
  metrics: MetricView[]
  openResources: OpenResourcesView
  venues: VenueGroupView[]
  stateBreakdown: StateCountView[]
  resourceCount: number
  trend: TrendBarView[]
  trendTicks: TrendTickView[]
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
    isOpen: venue.operationalStatus === 'OPEN',
    bookingEnabled: venue.userBookingEnabled,
    openText: `开放场地 ${venue.resourceOpen}/${venue.resourceTotal}`,
    reservedNowText: `当前已预约 ${venue.resourcesReservedNow}`,
    reservedRatio: venue.resourceOpen === 0 ? 0 : Math.min(1, venue.resourcesReservedNow / venue.resourceOpen),
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
  const columns = summary.weekTrend.length
  return summary.weekTrend.map((day, index) => {
    const heightPercent = peak === 0 ? 0 : (day.reservationCount / peak) * 100
    return {
      date: day.date,
      label: day.date.slice(YEAR_PREFIX_LENGTH),
      count: day.reservationCount,
      heightPercent,
      x: ((index + 0.5) / columns) * 100,
      y: 100 - heightPercent,
    }
  })
}

function buildTrendTicks(summary: DisplaySummary): TrendTickView[] {
  const peak = Math.max(0, ...summary.weekTrend.map((day) => day.reservationCount))
  if (peak === 0) {
    return [{ value: 0, percent: 0 }]
  }
  return [0, 0.5, 1]
    .map((share) => ({ value: peak * share, percent: share * 100 }))
    .filter((tick) => Number.isInteger(tick.value))
}

function buildOpenResources(summary: DisplaySummary): OpenResourcesView {
  const open = summary.venues.reduce((sum, venue) => sum + venue.resourceOpen, 0)
  const total = summary.venues.reduce((sum, venue) => sum + venue.resourceTotal, 0)
  return { open, total, text: `${open}/${total}` }
}

// 只计入归属于 venues[] 的场地，与页面上显示的场地方块一致。
function shownResources(summary: DisplaySummary) {
  const venueIds = new Set(summary.venues.map((venue) => venue.venueId))
  return summary.resources.filter((resource) => venueIds.has(resource.venueId))
}

function buildStateBreakdown(summary: DisplaySummary): StateCountView[] {
  const resources = shownResources(summary)
  return (Object.keys(STATE_LABELS) as ResourceLiveState[]).map((state) => ({
    state,
    label: STATE_LABELS[state],
    count: resources.filter((resource) => resource.state === state).length,
  }))
}

export function buildDisplayBoardView(summary: DisplaySummary): DisplayBoardView {
  return {
    generatedAtText: formatTimestamp(summary.generatedAt),
    metrics: buildMetrics(summary),
    openResources: buildOpenResources(summary),
    venues: buildVenues(summary),
    stateBreakdown: buildStateBreakdown(summary),
    resourceCount: shownResources(summary).length,
    trend: buildTrend(summary),
    trendTicks: buildTrendTicks(summary),
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
