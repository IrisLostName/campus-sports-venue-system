// mock 的内存状态与上下文。记录类型对应 docs/13 的表（预约记录内含使用记录的签到/签退时间）。
import type {
  AccountStatus, AnnouncementScope, AnnouncementStatus, BookingRules, OperationLog, RepairStatus,
  ReservationStatus, ResourceStatus, ResourceType, Role, UserType, VenueStatus, VenueType,
} from '../types'
import type { Clock } from './clock'

export interface UserRecord {
  id: number; username: string; password: string; displayName: string
  role: Role; userType: UserType; phone: string | null; status: AccountStatus
}

export interface VenueRecord {
  id: number; name: string; venueType: VenueType; location: string | null
  description: string | null; operationalStatus: VenueStatus; userBookingEnabled: boolean
}

export interface ResourceRecord {
  id: number; venueId: number; name: string; resourceType: ResourceType
  sortOrder: number; operationalStatus: ResourceStatus
}

export interface WeeklyRecord {
  id: number; venueId: number; weekday: number; openTime: string; closeTime: string
  status: 'ACTIVE' | 'INACTIVE'
}

export interface ClosureRecord {
  id: number; venueId: number; resourceId: number | null
  startDate: string; endDate: string; reason: string | null; status: 'ACTIVE' | 'INACTIVE'
}

export interface ReservationRecord {
  id: number; userId: number; resourceId: number
  serviceDate: string; startTime: string; endTime: string
  status: ReservationStatus; purpose: string | null; createdAt: string
  cancelledAt: string | null; cancelledBy: number | null; cancelReason: string | null
  adminNote: string | null
  checkInAt: string | null; checkOutAt: string | null
}

export interface AnnouncementRecord {
  id: number; scope: AnnouncementScope; venueId: number | null
  title: string; content: string; status: AnnouncementStatus
  publishedById: number; publishedAt: string; expiresAt: string | null
}

export interface RepairRecord {
  id: number; venueId: number; resourceId: number | null; reporterId: number
  description: string; status: RepairStatus; resultNote: string | null
  handledBy: number | null; createdAt: string; updatedAt: string
}

export interface TokenRecord { userId: number; expiresAt: string }

export type SeqKey =
  | 'user' | 'venue' | 'resource' | 'weekly' | 'closure' | 'reservation'
  | 'announcement' | 'repair' | 'log' | 'token'

export interface MockState {
  users: UserRecord[]
  venues: VenueRecord[]
  resources: ResourceRecord[]
  weekly: WeeklyRecord[]
  closures: ClosureRecord[]
  reservations: ReservationRecord[]
  announcements: AnnouncementRecord[]
  repairs: RepairRecord[]
  scopes: Record<number, number[]>        // 场馆管理员 id → 授权场馆 id
  tokens: Record<string, TokenRecord>
  logs: OperationLog[]
  seq: Record<SeqKey, number>
}

export interface MockContext {
  state: MockState
  clock: Clock
  rules: BookingRules
  getToken: () => string | null
}

export function nextId(state: MockState, key: SeqKey): number {
  state.seq[key] += 1
  return state.seq[key]
}
