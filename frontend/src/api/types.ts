// 逐字对应 docs/12-api-contract.md 第 1、2、3、4 节；第 5 节内联类型在 typesSection5.ts，请求与查询类型在 requests.ts。
// 本文件不得增删字段；落地后的差异由 API-SYNC 裁决（docs/12 第 8 节）。

// ---------- 第 1 节：通用 ----------
export interface Page<T> { items: T[]; page: number; pageSize: number; total: number }
export interface ErrorBody { code: string; message: string; details?: Record<string, unknown> }

// ---------- 第 2 节：枚举 ----------
export type Role = 'USER' | 'VENUE_ADMIN' | 'SYS_ADMIN'
export type UserType = 'STUDENT' | 'TEACHER' | 'OTHER'
export type AccountStatus = 'ACTIVE' | 'DISABLED'
export type VenueType = 'TENNIS' | 'BADMINTON' | 'SWIMMING' | 'BASKETBALL' | 'OTHER'
export type VenueStatus = 'OPEN' | 'CLOSED'
export type ResourceType = 'COURT' | 'LANE' | 'OTHER'
export type ResourceStatus = 'OPEN' | 'MAINTENANCE' | 'DISABLED'
export type ReservationStatus = 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'ADMIN_CANCELLED' | 'NO_SHOW'
export type DisplayStatus =
  | 'UPCOMING' | 'CHECKIN_OPEN' | 'IN_USE' | 'CHECKED_OUT'
  | 'COMPLETED' | 'CANCELLED' | 'ADMIN_CANCELLED' | 'NO_SHOW'
export type SlotStatus = 'AVAILABLE' | 'BOOKED' | 'MINE' | 'CLOSED' | 'PAST'
export type AnnouncementScope = 'SYSTEM' | 'VENUE'
export type AnnouncementStatus = 'ACTIVE' | 'ARCHIVED'
export type RepairStatus = 'SUBMITTED' | 'IN_PROGRESS' | 'RESOLVED'
export type OnExisting = 'KEEP' | 'CANCEL'
export type ResourceLiveState = 'FREE' | 'RESERVED' | 'IN_USE' | 'MAINTENANCE' | 'DISABLED'
export type LogAction =
  | 'RESERVATION_CANCEL' | 'RESERVATION_REASSIGN_RESOURCE' | 'RESERVATION_REASSIGN_USER'
  | 'RESOURCE_STATUS_CHANGE' | 'RESOURCE_COUNT_CHANGE' | 'VENUE_UPDATE'
  | 'RULE_WEEKLY_UPDATE' | 'CLOSURE_ADD' | 'CLOSURE_REMOVE' | 'SCOPE_UPDATE'
  | 'USER_CREATE' | 'USER_STATUS_CHANGE' | 'ANNOUNCEMENT_PUBLISH' | 'ANNOUNCEMENT_ARCHIVE'
  | 'REPAIR_UPDATE'
export type LogTargetType =
  | 'RESERVATION' | 'RESOURCE' | 'VENUE' | 'RULE' | 'USER' | 'SCOPE' | 'ANNOUNCEMENT' | 'REPAIR'

// ---------- 第 3 节：错误码 ----------
// 错误码集合是运行时常量，契约测试与 docs/12 第 3 节表格双向比对（docs/16 第 4.4 节）。
export const ERROR_CODES = [
  'VALIDATION_ERROR', 'RULE_INVALID', 'DATE_OUT_OF_RANGE',
  'AUTH_REQUIRED', 'TOKEN_EXPIRED', 'INVALID_CREDENTIALS',
  'ACCOUNT_DISABLED', 'FORBIDDEN', 'FORBIDDEN_SCOPE', 'NOT_OWNER',
  'NOT_FOUND', 'USERNAME_TAKEN', 'VENUE_NOT_BOOKABLE', 'RESOURCE_UNAVAILABLE',
  'SLOT_NOT_AVAILABLE', 'SLOT_IN_PAST', 'BOOKING_LIMIT_REACHED', 'SLOT_TAKEN',
  'INVALID_STATE', 'CANCEL_DEADLINE_PASSED', 'ALREADY_CHECKED_IN', 'CHECKIN_WINDOW_CLOSED',
  'NOT_CHECKED_IN', 'ALREADY_CHECKED_OUT', 'USER_NOT_ELIGIBLE', 'REASON_REQUIRED',
  'IMPACT_CONFIRMATION_REQUIRED', 'HAS_HISTORY', 'INTERNAL_ERROR',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

// HTTP 状态，逐行对应 docs/12 第 3 节表格的 HTTP 列。
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  RULE_INVALID: 400,
  DATE_OUT_OF_RANGE: 400,
  AUTH_REQUIRED: 401,
  TOKEN_EXPIRED: 401,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_DISABLED: 403,
  FORBIDDEN: 403,
  FORBIDDEN_SCOPE: 403,
  NOT_OWNER: 403,
  NOT_FOUND: 404,
  USERNAME_TAKEN: 409,
  VENUE_NOT_BOOKABLE: 409,
  RESOURCE_UNAVAILABLE: 409,
  SLOT_NOT_AVAILABLE: 409,
  SLOT_IN_PAST: 409,
  BOOKING_LIMIT_REACHED: 409,
  SLOT_TAKEN: 409,
  INVALID_STATE: 409,
  CANCEL_DEADLINE_PASSED: 409,
  ALREADY_CHECKED_IN: 409,
  CHECKIN_WINDOW_CLOSED: 409,
  NOT_CHECKED_IN: 409,
  ALREADY_CHECKED_OUT: 409,
  USER_NOT_ELIGIBLE: 409,
  REASON_REQUIRED: 400,
  IMPACT_CONFIRMATION_REQUIRED: 409,
  HAS_HISTORY: 409,
  INTERNAL_ERROR: 500,
}

// ---------- 第 4 节：核心数据结构 ----------
export interface UserProfile {
  id: number; username: string; displayName: string
  role: Role; userType: UserType; phone: string | null
  status: AccountStatus
  venueIds: number[] | null      // 仅 VENUE_ADMIN 返回授权场馆；其他角色为 null
}

export interface BookingRules {
  slotMinutes: 90; advanceDays: number; cancelDeadlineMinutes: number
  checkInOpenBeforeMinutes: number; checkInCloseAfterMinutes: number
  checkOutGraceMinutes: number; maxActiveReservationsPerUser: number
  timezone: string
}

export interface VenueSummary {
  id: number; name: string; venueType: VenueType; location: string | null
  description: string | null
  operationalStatus: VenueStatus; userBookingEnabled: boolean
  bookable: boolean               // = operationalStatus==='OPEN' && userBookingEnabled
  resourceCount: number           // 非 DISABLED 的场地数
}

export interface Resource {
  id: number; venueId: number; name: string; resourceType: ResourceType
  sortOrder: number; operationalStatus: ResourceStatus
}

export interface Reservation {
  id: number
  venueId: number; venueName: string
  resourceId: number; resourceName: string
  userId: number; userDisplayName: string
  serviceDate: string; startTime: string; endTime: string
  status: ReservationStatus; displayStatus: DisplayStatus
  purpose: string | null
  createdAt: string
  cancelledAt: string | null; cancelReason: string | null; cancelledBy: number | null
  adminNote: string | null
  checkInAt: string | null; checkOutAt: string | null
}

export interface ReservationBrief {
  id: number; resourceName: string; serviceDate: string
  startTime: string; endTime: string; userDisplayName: string
}

export interface SlotItem { startTime: string; endTime: string; status: SlotStatus }
export interface ResourceSlots { resourceId: number; resourceName: string; operationalStatus: ResourceStatus; slots: SlotItem[] }
export interface VenueSlots { venueId: number; venueName: string; date: string; resources: ResourceSlots[] }

export interface Announcement {
  id: number; scope: AnnouncementScope; venueId: number | null
  title: string; content: string
  status: AnnouncementStatus; publishedAt: string; publishedByName: string
  expiresAt: string | null
}

export interface RepairReport {
  id: number; venueId: number; venueName: string
  resourceId: number | null; resourceName: string | null
  reporterId: number; reporterName: string
  description: string; status: RepairStatus
  resultNote: string | null; createdAt: string; updatedAt: string
}

export interface ImpactReport { affectedCount: number; reservations: ReservationBrief[] }

export interface ImpactChangeResponse<T> {
  applied: boolean               // dryRun=true 时为 false
  impact: ImpactReport
  cancelledIds: number[]         // 实际被 ADMIN_CANCELLED 的预约 id；dryRun 或 KEEP 时为空
  data: T | null                 // 变更后的对象；dryRun 时为 null
}

export interface OperationLog {
  id: number; adminId: number; adminName: string; venueId: number | null
  action: LogAction; targetType: LogTargetType; targetId: number | null
  reason: string | null
  before: unknown | null; after: unknown | null
  createdAt: string
}

export * from './typesSection5'
export * from './requests'
