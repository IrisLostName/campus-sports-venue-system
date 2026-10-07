// 请求、查询与未命名响应类型。字段与可选标记逐字取自 docs/12 第 5 节正文；
// 类型名按 <Action>Request / <Action>Query / <Noun>Response 统一命名（FE-1 规划裁决 A4）。
import type {
  AccountStatus, AnnouncementScope, AnnouncementStatus, LogAction, OnExisting, RepairStatus,
  ReservationStatus, ResourceStatus, ResourceType, Role, UserType, VenueStatus, VenueType,
} from './types'
import type { Closure, WeeklyWindow } from './typesSection5'

// ---------- 5.1 认证与配置 ----------
// POST /auth/register
export interface RegisterRequest {
  username: string; password: string; displayName: string
  userType?: UserType; phone?: string
}
// POST /auth/login
export interface LoginRequest { username: string; password: string }

// ---------- 5.2 用户端：场馆、时段、公告 ----------
// GET /announcements?scope=&venueId=
export interface AnnouncementQuery { scope: AnnouncementScope; venueId?: number }

// ---------- 5.3 用户端：预约 ----------
// POST /reservations
export interface CreateReservationRequest {
  resourceId: number; serviceDate: string; startTime: string; purpose?: string
}
// GET /reservations/me?scope=&page=&pageSize=
export type ReservationScope = 'CURRENT' | 'HISTORY' | 'ALL'
export interface MyReservationsQuery { scope?: ReservationScope; page?: number; pageSize?: number }
// POST /reservations/{id}/cancel
export interface CancelReservationRequest { reason?: string }

// ---------- 5.4 报修 ----------
// POST /repairs
export interface CreateRepairRequest { venueId: number; resourceId?: number; description: string }
// GET /admin/repairs?venueId=&status=&page=
export interface AdminRepairsQuery { venueId?: number; status?: RepairStatus; page?: number }
// PATCH /admin/repairs/{id}
export interface UpdateRepairRequest { status: 'IN_PROGRESS' | 'RESOLVED'; resultNote?: string }

// ---------- 5.5 管理端：场馆与场地（影响检查控制字段见各请求） ----------
interface ImpactControl { onExistingReservations?: OnExisting; reason?: string; dryRun?: boolean }

// POST /admin/venues
export interface CreateVenueRequest {
  name: string; venueType: VenueType; location?: string; description?: string
}
// PATCH /admin/venues/{id}：任意子集
export interface UpdateVenueRequest extends ImpactControl {
  name?: string; venueType?: VenueType; location?: string; description?: string
  operationalStatus?: VenueStatus; userBookingEnabled?: boolean
}
// PUT /admin/venues/{id}/resource-count
export interface SetResourceCountRequest extends ImpactControl {
  count: number; namePrefix?: string; resourceType?: ResourceType
}
// PATCH /admin/resources/{id}
export interface UpdateResourceRequest extends ImpactControl {
  name?: string; sortOrder?: number; operationalStatus?: ResourceStatus
}

// ---------- 5.6 管理端：开放规则 ----------
// GET /admin/venues/{id}/availability-rules
export interface AvailabilityRulesResponse { weekly: WeeklyWindow[]; closures: Closure[] }
// PUT /admin/venues/{id}/availability-rules/weekly
export interface WeeklyWindowInput { weekday: number; openTime: string; closeTime: string }
export interface ReplaceWeeklyRulesRequest extends ImpactControl { windows: WeeklyWindowInput[] }
// POST /admin/venues/{id}/closures
export interface AddClosureRequest extends ImpactControl {
  startDate: string; endDate: string; resourceId?: number
}

// ---------- 5.7 管理端：预约管理 ----------
// GET /admin/reservations
export interface AdminReservationsQuery {
  venueId?: number; dateFrom?: string; dateTo?: string; status?: ReservationStatus
  keyword?: string; page?: number; pageSize?: number
}
// POST /admin/reservations/{id}/cancel
export interface AdminCancelRequest { reason: string }
// POST /admin/reservations/{id}/reassign-resource
export interface ReassignResourceRequest {
  resourceId: number; serviceDate: string; startTime: string; reason: string
}
// POST /admin/reservations/{id}/reassign-user
export interface ReassignUserRequest { userId: number; reason: string }

// ---------- 5.8 管理端：公告 ----------
// GET /admin/announcements?scope=&venueId=&status=&page=
export interface AdminAnnouncementsQuery {
  scope?: AnnouncementScope; venueId?: number; status?: AnnouncementStatus; page?: number
}
// POST /admin/announcements
export interface CreateAnnouncementRequest {
  scope: AnnouncementScope; venueId?: number; title: string; content: string; expiresAt?: string
}

// ---------- 5.9 系统管理员：用户与授权 ----------
// GET /admin/users?role=&keyword=&page=&pageSize=
export interface AdminUsersQuery { role?: Role; keyword?: string; page?: number; pageSize?: number }
// POST /admin/users
export interface CreateUserRequest {
  username: string; password: string; displayName: string; role: Role
  userType?: UserType; phone?: string; venueIds?: number[]
}
// PATCH /admin/users/{id}
export interface UpdateUserRequest { displayName?: string; status?: AccountStatus }
// PUT /admin/users/{id}/venue-scope
export interface SetVenueScopeRequest { venueIds: number[] }

// ---------- 5.10 统计、操作记录与大屏 ----------
// GET /admin/stats/overview?venueId=&dateFrom=&dateTo=
export interface StatsOverviewQuery { venueId?: number; dateFrom?: string; dateTo?: string }
// GET /admin/logs?venueId=&action=&dateFrom=&dateTo=&page=&pageSize=
export interface LogsQuery {
  venueId?: number; action?: LogAction; dateFrom?: string; dateTo?: string
  page?: number; pageSize?: number
}
