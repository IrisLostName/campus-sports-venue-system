// mock 种子数据：唯一来源是 docs/13 第 5 节（演示数据，不是真实业务数据）。
// 文档未给出、由 FE-1 规划裁决 A12 补定的“mock 取值”：
//   用户 id 1–7 按 13 第 5.3 节表格顺序；场地 id：网球 1–4、羽毛球 5–10、游泳 11–16，sortOrder = 名称中的数字；
//   手机号、场馆位置与简介均为 null；公告内容 = 标题原文；系统公告发布人 sysadmin，网球馆公告发布人 admin_tennis；
//   公告 publishedAt = 生成种子时的 mock 时钟；演示预约：zhangsan 明天 08:00 网球场1、lisi 明天 09:30 网球场2。
// 种子相对注入的“今天”生成，所以演示预约永远在明天。
import type { ResourceType, Role, UserType, VenueType } from '../types'
import type { Clock } from './clock'
import { addDays, dateOf, endTimeOf } from './timeMath'
import type {
  AnnouncementRecord, MockState, ReservationRecord, ResourceRecord, UserRecord, VenueRecord, WeeklyRecord,
} from './state'

export const DEMO_PASSWORD = 'Demo@1234'

// 13 第 5.3 节：用户名、姓名、角色、user_type。
const USER_ROWS: ReadonlyArray<readonly [string, string, Role, UserType]> = [
  ['zhangsan', '张三', 'USER', 'STUDENT'],
  ['lisi', '李四', 'USER', 'STUDENT'],
  ['wangwu', '王五', 'USER', 'TEACHER'],
  ['zhaoliu', '赵六', 'USER', 'STUDENT'],
  ['admin_tennis', '网球馆管理员', 'VENUE_ADMIN', 'OTHER'],
  ['admin_pool', '游泳羽毛球馆管理员', 'VENUE_ADMIN', 'OTHER'],
  ['sysadmin', '系统管理员', 'SYS_ADMIN', 'OTHER'],
]

// 13 第 5.3 节“授权场馆”：admin_tennis → 网球馆；admin_pool → 羽毛球馆、游泳馆。
const SCOPE_BY_USERNAME: Record<string, number[]> = { admin_tennis: [1], admin_pool: [2, 3] }

// 13 第 5.1、5.2 节：场馆、场地、每周开放窗口。
interface VenueSeed {
  id: number; name: string; venueType: VenueType; userBookingEnabled: boolean
  resourcePrefix: string; resourceType: ResourceType; resourceCount: number
  openTime: string; closeTime: string
}
const VENUE_ROWS: readonly VenueSeed[] = [
  { id: 1, name: '网球馆', venueType: 'TENNIS', userBookingEnabled: true, resourcePrefix: '网球场', resourceType: 'COURT', resourceCount: 4, openTime: '08:00', closeTime: '20:00' },
  { id: 2, name: '羽毛球馆', venueType: 'BADMINTON', userBookingEnabled: false, resourcePrefix: '羽毛球场', resourceType: 'COURT', resourceCount: 6, openTime: '08:00', closeTime: '20:00' },
  { id: 3, name: '游泳馆', venueType: 'SWIMMING', userBookingEnabled: false, resourcePrefix: '泳道', resourceType: 'LANE', resourceCount: 6, openTime: '09:00', closeTime: '21:00' },
]

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

function seedUsers(): UserRecord[] {
  return USER_ROWS.map(([username, displayName, role, userType], index) => ({
    id: index + 1, username, password: DEMO_PASSWORD, displayName, role, userType, phone: null, status: 'ACTIVE',
  }))
}

function seedVenues(): VenueRecord[] {
  return VENUE_ROWS.map((row) => ({
    id: row.id, name: row.name, venueType: row.venueType, location: null, description: null,
    operationalStatus: 'OPEN', userBookingEnabled: row.userBookingEnabled,
  }))
}

function seedResources(): ResourceRecord[] {
  const resources: ResourceRecord[] = []
  for (const row of VENUE_ROWS) {
    for (let number = 1; number <= row.resourceCount; number += 1) {
      resources.push({
        id: resources.length + 1, venueId: row.id, name: `${row.resourcePrefix}${number}`,
        resourceType: row.resourceType, sortOrder: number, operationalStatus: 'OPEN',
      })
    }
  }
  return resources
}

function seedWeekly(): WeeklyRecord[] {
  const windows: WeeklyRecord[] = []
  for (const row of VENUE_ROWS) {
    for (const weekday of WEEKDAYS) {
      windows.push({
        id: windows.length + 1, venueId: row.id, weekday,
        openTime: row.openTime, closeTime: row.closeTime, status: 'ACTIVE',
      })
    }
  }
  return windows
}

// 13 第 5.4 节：1 条系统公告、1 条网球馆公告。
function seedAnnouncements(publishedAt: string): AnnouncementRecord[] {
  const base = { status: 'ACTIVE', publishedAt, expiresAt: null } as const
  return [
    { ...base, id: 1, scope: 'SYSTEM', venueId: null, title: '欢迎使用校园场馆预约系统', content: '欢迎使用校园场馆预约系统', publishedById: 7 },
    { ...base, id: 2, scope: 'VENUE', venueId: 1, title: '场地保养：每周一 08:00–09:30 视情况关闭 1 片球场', content: '场地保养：每周一 08:00–09:30 视情况关闭 1 片球场', publishedById: 5 },
  ]
}

// 13 第 5.5 节：zhangsan 明天网球场1的一个时段，lisi 明天网球场2的一个时段；wangwu 无预约。
function seedReservations(createdAt: string): ReservationRecord[] {
  const tomorrow = addDays(dateOf(createdAt), 1)
  const rows: ReadonlyArray<readonly [number, number, string]> = [[1, 1, '08:00'], [2, 2, '09:30']]
  return rows.map(([userId, resourceId, startTime], index) => ({
    id: index + 1, userId, resourceId, serviceDate: tomorrow, startTime, endTime: endTimeOf(startTime),
    status: 'CONFIRMED', purpose: null, createdAt, cancelledAt: null, cancelledBy: null,
    cancelReason: null, adminNote: null, checkInAt: null, checkOutAt: null,
  }))
}

function seedScopes(users: UserRecord[]): Record<number, number[]> {
  const scopes: Record<number, number[]> = {}
  for (const user of users) {
    scopes[user.id] = SCOPE_BY_USERNAME[user.username] ?? []
  }
  return scopes
}

export function createSeedState(clock: Clock): MockState {
  const now = clock.now()
  const users = seedUsers()
  const state: MockState = {
    users,
    venues: seedVenues(),
    resources: seedResources(),
    weekly: seedWeekly(),
    closures: [],
    reservations: seedReservations(now),
    announcements: seedAnnouncements(now),
    repairs: [],
    scopes: seedScopes(users),
    tokens: {},
    logs: [],
    seq: { user: 0, venue: 0, resource: 0, weekly: 0, closure: 0, reservation: 0, announcement: 0, repair: 0, log: 0, token: 0 },
  }
  state.seq.user = state.users.length
  state.seq.venue = state.venues.length
  state.seq.resource = state.resources.length
  state.seq.weekly = state.weekly.length
  state.seq.reservation = state.reservations.length
  state.seq.announcement = state.announcements.length
  return state
}
