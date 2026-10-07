// ApiClient：http 与 mock 两种实现共用的接口，逐条覆盖 docs/12 第 5 节的全部 42 个接口（ADR-0006）。
// 页面只依赖 api/index.ts 导出的实例。
import type {
  Announcement, BookingRules, ImpactChangeResponse, OperationLog, Page, RepairReport, Reservation,
  Resource, VenueSlots, VenueSummary, UserProfile,
} from './types'
import type {
  AdminReservation, Closure, DisplaySummary, LoginResponse, Occupancy, StatsOverview, WeeklyWindow,
} from './typesSection5'
import type {
  AddClosureRequest, AdminAnnouncementsQuery, AdminCancelRequest, AdminRepairsQuery,
  AdminReservationsQuery, AdminUsersQuery, AnnouncementQuery, AvailabilityRulesResponse,
  CancelReservationRequest, CreateAnnouncementRequest, CreateRepairRequest,
  CreateReservationRequest, CreateUserRequest, CreateVenueRequest, LoginRequest, LogsQuery,
  MyReservationsQuery, ReassignResourceRequest, ReassignUserRequest, RegisterRequest,
  ReplaceWeeklyRulesRequest, SetResourceCountRequest, SetVenueScopeRequest, StatsOverviewQuery,
  UpdateRepairRequest, UpdateResourceRequest, UpdateUserRequest, UpdateVenueRequest,
} from './requests'

export interface ApiClientOptions {
  // 返回当前登录令牌；未登录返回 null。令牌由 auth store 持有（FE-2），这里只读取。
  getToken: () => string | null
}

export interface ApiClient {
  // 5.1 认证与配置
  register(request: RegisterRequest): Promise<LoginResponse>
  login(request: LoginRequest): Promise<LoginResponse>
  getMe(): Promise<UserProfile>
  getBookingRules(): Promise<BookingRules>

  // 5.2 用户端：场馆、时段、公告
  listVenues(): Promise<VenueSummary[]>
  getVenueSlots(venueId: number, date: string): Promise<VenueSlots>
  listAnnouncements(query: AnnouncementQuery): Promise<Announcement[]>

  // 5.3 用户端：预约
  createReservation(request: CreateReservationRequest): Promise<Reservation>
  listMyReservations(query?: MyReservationsQuery): Promise<Page<Reservation>>
  getReservation(id: number): Promise<Reservation>
  cancelReservation(id: number, request?: CancelReservationRequest): Promise<Reservation>
  checkIn(id: number): Promise<Reservation>
  checkOut(id: number): Promise<Reservation>

  // 5.4 报修
  createRepair(request: CreateRepairRequest): Promise<RepairReport>
  listMyRepairs(): Promise<RepairReport[]>
  adminListRepairs(query?: AdminRepairsQuery): Promise<Page<RepairReport>>
  adminUpdateRepair(id: number, request: UpdateRepairRequest): Promise<RepairReport>

  // 5.5 管理端：场馆与场地
  adminListVenues(): Promise<VenueSummary[]>
  adminCreateVenue(request: CreateVenueRequest): Promise<VenueSummary>
  adminUpdateVenue(id: number, request: UpdateVenueRequest): Promise<ImpactChangeResponse<VenueSummary>>
  adminListResources(venueId: number): Promise<Resource[]>
  adminSetResourceCount(venueId: number, request: SetResourceCountRequest): Promise<ImpactChangeResponse<Resource[]>>
  adminUpdateResource(id: number, request: UpdateResourceRequest): Promise<ImpactChangeResponse<Resource>>
  adminGetOccupancy(venueId: number, date: string): Promise<Occupancy>

  // 5.6 管理端：开放规则
  adminGetAvailabilityRules(venueId: number): Promise<AvailabilityRulesResponse>
  adminReplaceWeeklyRules(venueId: number, request: ReplaceWeeklyRulesRequest): Promise<ImpactChangeResponse<WeeklyWindow[]>>
  adminAddClosure(venueId: number, request: AddClosureRequest): Promise<ImpactChangeResponse<Closure>>
  adminRemoveClosure(id: number): Promise<void>

  // 5.7 管理端：预约管理
  adminListReservations(query?: AdminReservationsQuery): Promise<Page<AdminReservation>>
  adminCancelReservation(id: number, request: AdminCancelRequest): Promise<Reservation>
  adminReassignResource(id: number, request: ReassignResourceRequest): Promise<Reservation>
  adminReassignUser(id: number, request: ReassignUserRequest): Promise<Reservation>

  // 5.8 管理端：公告
  adminListAnnouncements(query?: AdminAnnouncementsQuery): Promise<Page<Announcement>>
  adminCreateAnnouncement(request: CreateAnnouncementRequest): Promise<Announcement>
  adminArchiveAnnouncement(id: number): Promise<void>

  // 5.9 系统管理员：用户与授权
  adminListUsers(query?: AdminUsersQuery): Promise<Page<UserProfile>>
  adminCreateUser(request: CreateUserRequest): Promise<UserProfile>
  adminUpdateUser(id: number, request: UpdateUserRequest): Promise<UserProfile>
  adminSetVenueScope(id: number, request: SetVenueScopeRequest): Promise<UserProfile>

  // 5.10 统计、操作记录与大屏
  adminGetStatsOverview(query?: StatsOverviewQuery): Promise<StatsOverview>
  adminListLogs(query?: LogsQuery): Promise<Page<OperationLog>>
  getDisplaySummary(): Promise<DisplaySummary>
}

// 供“两种实现方法集合一致”的测试使用：与接口逐一对应的方法名清单。
export const API_CLIENT_METHODS = [
  'register', 'login', 'getMe', 'getBookingRules',
  'listVenues', 'getVenueSlots', 'listAnnouncements',
  'createReservation', 'listMyReservations', 'getReservation', 'cancelReservation', 'checkIn', 'checkOut',
  'createRepair', 'listMyRepairs', 'adminListRepairs', 'adminUpdateRepair',
  'adminListVenues', 'adminCreateVenue', 'adminUpdateVenue', 'adminListResources',
  'adminSetResourceCount', 'adminUpdateResource', 'adminGetOccupancy',
  'adminGetAvailabilityRules', 'adminReplaceWeeklyRules', 'adminAddClosure', 'adminRemoveClosure',
  'adminListReservations', 'adminCancelReservation', 'adminReassignResource', 'adminReassignUser',
  'adminListAnnouncements', 'adminCreateAnnouncement', 'adminArchiveAnnouncement',
  'adminListUsers', 'adminCreateUser', 'adminUpdateUser', 'adminSetVenueScope',
  'adminGetStatsOverview', 'adminListLogs', 'getDisplaySummary',
] as const satisfies readonly (keyof ApiClient)[]
