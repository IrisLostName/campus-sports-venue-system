// 认证、角色与授权范围（统一阶段顺序：认证 → 格式 → 角色 → 业务；docs/12 第 6 节）。
import type { Role, UserProfile } from '../types'
import { fail } from './fail'
import type { MockContext, UserRecord } from './state'
import { secondsOf } from './timeMath'

// 认证：无令牌或未知令牌 AUTH_REQUIRED；过期 TOKEN_EXPIRED；账号停用 ACCOUNT_DISABLED（立即生效）。
export function authenticate(ctx: MockContext): UserRecord {
  const token = ctx.getToken()
  const record = token === null ? undefined : ctx.state.tokens[token]
  if (record === undefined) {
    return fail('AUTH_REQUIRED')
  }
  if (secondsOf(ctx.clock.now()) >= secondsOf(record.expiresAt)) {
    return fail('TOKEN_EXPIRED')
  }
  const user = ctx.state.users.find((candidate) => candidate.id === record.userId)
  if (user === undefined) {
    return fail('AUTH_REQUIRED')
  }
  if (user.status === 'DISABLED') {
    return fail('ACCOUNT_DISABLED')
  }
  return user
}

export function requireRole(user: UserRecord, ...roles: Role[]): void {
  if (!roles.includes(user.role)) {
    fail('FORBIDDEN')
  }
}

// 场馆授权范围：SYS_ADMIN 全局；VENUE_ADMIN 只限 admin_venue_scope 中的场馆；其他角色无范围。
export function hasScope(ctx: MockContext, user: UserRecord, venueId: number): boolean {
  if (user.role === 'SYS_ADMIN') {
    return true
  }
  return user.role === 'VENUE_ADMIN' && (ctx.state.scopes[user.id] ?? []).includes(venueId)
}

export function requireScope(ctx: MockContext, user: UserRecord, venueId: number): void {
  if (!hasScope(ctx, user, venueId)) {
    fail('FORBIDDEN_SCOPE', { venueId })
  }
}

// 管理员可管理的场馆 id：SYS_ADMIN 为全部场馆。
export function manageableVenueIds(ctx: MockContext, user: UserRecord): number[] {
  return ctx.state.venues.filter((venue) => hasScope(ctx, user, venue.id)).map((venue) => venue.id)
}

export function toProfile(ctx: MockContext, user: UserRecord): UserProfile {
  const venueIds = user.role === 'VENUE_ADMIN' ? [...(ctx.state.scopes[user.id] ?? [])].sort((a, b) => a - b) : null
  return {
    id: user.id, username: user.username, displayName: user.displayName,
    role: user.role, userType: user.userType, phone: user.phone, status: user.status, venueIds,
  }
}
