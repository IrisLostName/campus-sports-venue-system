// docs/12 第 5.1 节：注册、登录、当前用户、预约参数。Token 为 mock 自管的不透明字符串，8 小时后过期。
import type { ApiClient } from '../client'
import type { BookingRules, UserProfile } from '../types'
import type { LoginRequest, RegisterRequest } from '../requests'
import type { LoginResponse } from '../typesSection5'
import { USER_TYPES } from './enums'
import { fail } from './fail'
import { authenticate, toProfile } from './guards'
import { run } from './run'
import { nextId, type MockContext, type UserRecord } from './state'
import { addHours } from './timeMath'
import { TOKEN_TTL_HOURS } from './bookingRules'
import { blankToNull, collect, oneOfProblem, optional, optionalText, textProblem } from './validate'

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,32}$/
const PASSWORD_MIN = 8
const PASSWORD_MAX = 64

export function usernameProblem(value: unknown): string | null {
  return typeof value === 'string' && USERNAME_PATTERN.test(value) ? null : '用户名应为 3–32 位字母、数字或下划线'
}

// BCrypt 只处理前 72 字节，后端拒绝更长的口令（台账 S-043）。
const PASSWORD_MAX_BYTES = 72

export function passwordProblem(value: unknown): string | null {
  const ok = typeof value === 'string' && value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX
  if (!ok) {
    return `密码应为 ${PASSWORD_MIN}–${PASSWORD_MAX} 位`
  }
  return new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES ? `不能超过 ${PASSWORD_MAX_BYTES} 字节` : null
}

export function issueSession(ctx: MockContext, user: UserRecord): LoginResponse {
  const token = `mock-token-${nextId(ctx.state, 'token')}`
  const expiresAt = addHours(ctx.clock.now(), TOKEN_TTL_HOURS)
  ctx.state.tokens[token] = { userId: user.id, expiresAt }
  return { token, expiresAt, user: toProfile(ctx, user) }
}

function register(ctx: MockContext, request: RegisterRequest): LoginResponse {
  collect([
    ['username', usernameProblem(request.username)],
    ['password', passwordProblem(request.password)],
    ['displayName', textProblem(request.displayName, 50)],
    ['userType', optional(request.userType, (value) => oneOfProblem(value, USER_TYPES))],
    ['phone', optionalText(request.phone, 20)],
  ])
  if (ctx.state.users.some((user) => user.username === request.username)) {
    fail('USERNAME_TAKEN')
  }
  const user: UserRecord = {
    id: nextId(ctx.state, 'user'), username: request.username, password: request.password,
    displayName: request.displayName, role: 'USER', userType: request.userType ?? 'STUDENT',
    phone: blankToNull(request.phone), status: 'ACTIVE',
  }
  ctx.state.users.push(user)
  return issueSession(ctx, user)
}

function login(ctx: MockContext, request: LoginRequest): LoginResponse {
  collect([
    ['username', textProblem(request.username, 32)],
    ['password', textProblem(request.password, PASSWORD_MAX)],
  ])
  const user = ctx.state.users.find((candidate) => candidate.username === request.username)
  if (user === undefined || user.password !== request.password) {
    fail('INVALID_CREDENTIALS')
  }
  if (user.status === 'DISABLED') {
    fail('ACCOUNT_DISABLED')
  }
  return issueSession(ctx, user)
}

function getMe(ctx: MockContext): UserProfile {
  return toProfile(ctx, authenticate(ctx))
}

function getBookingRules(ctx: MockContext): BookingRules {
  return { ...ctx.rules }
}

export function authApi(ctx: MockContext): Pick<ApiClient, 'register' | 'login' | 'getMe' | 'getBookingRules'> {
  return {
    register: (request) => run(ctx, () => register(ctx, request)),
    login: (request) => run(ctx, () => login(ctx, request)),
    getMe: () => run(ctx, () => getMe(ctx)),
    getBookingRules: () => run(ctx, () => getBookingRules(ctx)),
  }
}
