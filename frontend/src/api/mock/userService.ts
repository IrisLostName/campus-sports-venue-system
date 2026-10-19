// docs/12 第 5.9 节：系统管理员的用户与授权管理。
import type { ApiClient } from '../client'
import type { Page, UserProfile } from '../types'
import type { AdminUsersQuery, CreateUserRequest, SetVenueScopeRequest, UpdateUserRequest } from '../requests'
import { passwordProblem, usernameProblem } from './authService'
import { ACCOUNT_STATUSES, ROLES, USER_TYPES } from './enums'
import { fail } from './fail'
import { authenticate, requireRole, toProfile } from './guards'
import { appendLog, snapshot } from './logService'
import { getOrFail } from './lookup'
import { pageOf } from './paging'
import { run } from './run'
import { nextId, type MockContext, type UserRecord } from './state'
import {
  blankToNull, collect, isAbsent, keywordNeedle, keywordProblem, oneOfProblem, optional, optionalText, pagingChecks, textProblem,
} from './validate'

const VENUE_IDS_PROBLEM = '应为已存在场馆 id 组成的数组'

// 格式阶段只查“正整数组成的数组”；场馆是否存在要查库，后端放在角色检查之后（台账 S-046）。
function venueIdsProblem(value: unknown): string | null {
  const ok = Array.isArray(value) && value.every((id) => typeof id === 'number' && Number.isInteger(id) && id > 0)
  return ok ? null : VENUE_IDS_PROBLEM
}

function requireExistingVenues(ctx: MockContext, venueIds: readonly number[]): void {
  if (!venueIds.every((id) => ctx.state.venues.some((venue) => venue.id === id))) {
    fail('VALIDATION_ERROR', { fields: { venueIds: VENUE_IDS_PROBLEM } })
  }
}

function listUsers(ctx: MockContext, query: AdminUsersQuery): Page<UserProfile> {
  const user = authenticate(ctx)
  collect([
    ['role', optional(query.role, (value) => oneOfProblem(value, ROLES))],
    ['keyword', optional(query.keyword, keywordProblem)],
    ...pagingChecks(query.page, query.pageSize),
  ])
  requireRole(user, 'SYS_ADMIN')
  const needle = keywordNeedle(query.keyword)
  const matches = ctx.state.users
    .filter((candidate) => query.role === undefined || candidate.role === query.role)
    .filter((candidate) => needle === null
      || candidate.username.toLowerCase().includes(needle) || candidate.displayName.toLowerCase().includes(needle))
    .sort((a, b) => a.id - b.id)
  return pageOf(matches.map((candidate) => toProfile(ctx, candidate)), query.page, query.pageSize)
}

// 创建账号（可为任意角色）；venueIds 仅当 role=VENUE_ADMIN 时有效。
function createUser(ctx: MockContext, request: CreateUserRequest): UserProfile {
  const admin = authenticate(ctx)
  collect([
    ['username', usernameProblem(request.username)],
    ['password', passwordProblem(request.password)],
    ['displayName', textProblem(request.displayName, 50)],
    ['role', oneOfProblem(request.role, ROLES)],
    ['userType', optional(request.userType, (value) => oneOfProblem(value, USER_TYPES))],
    ['phone', optionalText(request.phone, 20)],
    ['venueIds', optional(request.venueIds, venueIdsProblem)],
  ])
  requireRole(admin, 'SYS_ADMIN')
  if (ctx.state.users.some((candidate) => candidate.username === request.username)) {
    fail('USERNAME_TAKEN')
  }
  requireExistingVenues(ctx, request.venueIds ?? [])
  const user: UserRecord = {
    id: nextId(ctx.state, 'user'), username: request.username, password: request.password,
    displayName: request.displayName, role: request.role, userType: request.userType ?? 'STUDENT',
    phone: blankToNull(request.phone), status: 'ACTIVE',
  }
  ctx.state.users.push(user)
  ctx.state.scopes[user.id] = request.role === 'VENUE_ADMIN' ? [...(request.venueIds ?? [])] : []
  const created = toProfile(ctx, user)
  appendLog(ctx, admin, { venueId: null, action: 'USER_CREATE', targetId: user.id, before: snapshot(null), after: snapshot(created) })
  return created
}

// 只改 displayName 没有对应的日志枚举，不写日志；改 status 写 USER_STATUS_CHANGE。停用自己返回 INVALID_STATE。
function updateUser(ctx: MockContext, id: number, request: UpdateUserRequest): UserProfile {
  const admin = authenticate(ctx)
  collect([
    ['displayName', optional(request.displayName, (value) => textProblem(value, 50))],
    ['status', optional(request.status, (value) => oneOfProblem(value, ACCOUNT_STATUSES))],
  ])
  requireRole(admin, 'SYS_ADMIN')
  const user = getOrFail(ctx.state.users, id)
  if (request.status === 'DISABLED' && user.id === admin.id) {
    fail('INVALID_STATE', { status: user.status })
  }
  const before = toProfile(ctx, user)
  const statusChanged = !isAbsent(request.status) && request.status !== user.status
  user.displayName = request.displayName ?? user.displayName
  user.status = request.status ?? user.status
  const after = toProfile(ctx, user)
  if (statusChanged) {
    appendLog(ctx, admin, {
      venueId: null, action: 'USER_STATUS_CHANGE', targetId: user.id, before: snapshot(before), after: snapshot(after),
    })
  }
  return after
}

// 整体替换授权场馆；目标必须是 VENUE_ADMIN，否则 INVALID_STATE。
function setVenueScope(ctx: MockContext, id: number, request: SetVenueScopeRequest): UserProfile {
  const admin = authenticate(ctx)
  collect([['venueIds', venueIdsProblem(request.venueIds)]])
  requireRole(admin, 'SYS_ADMIN')
  const user = getOrFail(ctx.state.users, id)
  if (user.role !== 'VENUE_ADMIN') {
    fail('INVALID_STATE', { status: user.role })
  }
  requireExistingVenues(ctx, request.venueIds)
  const before = toProfile(ctx, user)
  ctx.state.scopes[user.id] = [...new Set(request.venueIds)]
  const after = toProfile(ctx, user)
  appendLog(ctx, admin, {
    venueId: null, action: 'SCOPE_UPDATE', targetId: user.id, before: snapshot(before), after: snapshot(after),
  })
  return after
}

export type UserApi = Pick<ApiClient, 'adminListUsers' | 'adminCreateUser' | 'adminUpdateUser' | 'adminSetVenueScope'>

export function userAdminApi(ctx: MockContext): UserApi {
  return {
    adminListUsers: (query = {}) => run(ctx, () => listUsers(ctx, query)),
    adminCreateUser: (request) => run(ctx, () => createUser(ctx, request)),
    adminUpdateUser: (id, request) => run(ctx, () => updateUser(ctx, id, request)),
    adminSetVenueScope: (id, request) => run(ctx, () => setVenueScope(ctx, id, request)),
  }
}
