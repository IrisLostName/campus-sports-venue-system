// 逐字对应 docs/12-api-contract.md 第 5 节中内联定义的类型；由 types.ts 统一再导出。
import type {
  DisplayStatus, Reservation, ResourceLiveState, ResourceStatus, UserProfile, VenueStatus,
} from './types'

// 5.1 认证与配置
export interface LoginResponse { token: string; expiresAt: string; user: UserProfile }

// 5.5 管理端：场馆与场地（场地占用总览）
export interface OccupancySlot {
  startTime: string; endTime: string
  status: 'AVAILABLE' | 'BOOKED' | 'CLOSED' | 'PAST'
  reservation: { id: number; userDisplayName: string; displayStatus: DisplayStatus } | null
}
export interface Occupancy {
  venueId: number; venueName: string; date: string
  resourceCount: number
  resources: { resourceId: number; resourceName: string
               operationalStatus: ResourceStatus; slots: OccupancySlot[] }[]
}

// 5.6 管理端：开放规则
export interface WeeklyWindow { id: number; weekday: number; openTime: string; closeTime: string }
export interface Closure { id: number; venueId: number; resourceId: number | null
                    startDate: string; endDate: string; reason: string | null }

// 5.7 管理端：预约管理
export type AdminReservation = Reservation & { userUsername: string; userPhone: string | null }

// 5.10 统计、操作记录与大屏
export interface StatsOverview {
  dateFrom: string; dateTo: string
  reservationCount: number
  activeOccupiedSlots: number
  openSlots: number
  utilizationRate: number | null      // 0–1；openSlots=0 时为 null
  currentInUse: number
  userCancelCount: number; adminCancelCount: number
  noShowRate: number | null
  byVenue: { venueId: number; venueName: string; reservationCount: number; utilizationRate: number | null }[]
  daily: { date: string; reservationCount: number; utilizationRate: number | null }[]
}

export interface DisplaySummary {
  generatedAt: string
  todayReservationCount: number
  currentInUse: number
  todayUtilizationRate: number | null
  venues: { venueId: number; venueName: string; operationalStatus: VenueStatus
            userBookingEnabled: boolean; resourceTotal: number; resourceOpen: number
            resourcesReservedNow: number }[]
  resources: { venueId: number; resourceId: number; resourceName: string; state: ResourceLiveState }[]
  weekTrend: { date: string; reservationCount: number }[]     // 近 7 天（含今天）
  notices: { id: number; title: string }[]                    // 系统公告标题，最多 5 条
}
