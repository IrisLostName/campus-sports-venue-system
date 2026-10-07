// 认证与配置（docs/12 第 5.1 节）：注册、登录、当前用户、预约参数、Token 过期。
import { describe, expect, it } from 'vitest'

import { createMockClient } from '../../../src/api/mock/index'
import { DEMO_PASSWORD } from '../../../src/api/mock/seed'
import type { RegisterRequest } from '../../../src/api/requests'
import { createFakeClock, createHarness, expectApiError, NOW, TODAY } from '../support/harness'

const NEWCOMER = { username: 'newcomer', password: 'Passw0rd!', displayName: '新同学' }

describe('注册', () => {
  it('成功：角色强制为 USER，默认 STUDENT / ACTIVE，返回可用的 Token', async () => {
    const h = createHarness()
    const session = await h.api.register({ ...NEWCOMER, phone: '13800000000' })
    expect(session.user).toMatchObject({
      username: 'newcomer', displayName: '新同学', role: 'USER', userType: 'STUDENT', status: 'ACTIVE',
      phone: '13800000000', venueIds: null,
    })
    expect(session.expiresAt).toBe(`${TODAY}T15:00:00`)
    const other = createMockClient({ state: h.context.state, clock: h.clock, getToken: () => session.token })
    expect((await other.getMe()).username).toBe('newcomer')
  })

  it('请求里的 role 被忽略', async () => {
    const h = createHarness()
    const body = { ...NEWCOMER, role: 'SYS_ADMIN' }
    const session = await h.api.register(body as RegisterRequest)
    expect(session.user.role).toBe('USER')
  })

  it('用户名已存在 → USERNAME_TAKEN', async () => {
    const h = createHarness()
    await expectApiError(h.api.register({ ...NEWCOMER, username: 'zhangsan' }), 'USERNAME_TAKEN')
  })

  it.each([
    ['用户名过短', { username: 'ab' }],
    ['用户名过长', { username: 'a'.repeat(33) }],
    ['用户名含非法字符', { username: 'bad-name' }],
    ['密码过短（7 位）', { password: '1234567' }],
    ['密码过长（65 位）', { password: 'p'.repeat(65) }],
    ['姓名为空', { displayName: ' ' }],
    ['userType 非法', { userType: 'ALIEN' }],
  ])('%s → VALIDATION_ERROR', async (_label, patch) => {
    const h = createHarness()
    await expectApiError(h.api.register({ ...NEWCOMER, ...patch } as RegisterRequest), 'VALIDATION_ERROR')
  })

  it('边界合法：用户名 3 位与 32 位，密码 8 位与 64 位', async () => {
    const h = createHarness()
    await expect(h.api.register({ ...NEWCOMER, username: 'abc', password: '12345678' })).resolves.toBeDefined()
    await expect(h.api.register({ ...NEWCOMER, username: 'a_'.repeat(16), password: 'p'.repeat(64) })).resolves.toBeDefined()
  })
})

describe('登录', () => {
  it('成功：返回 Token、过期时间与 UserProfile（场馆管理员含 venueIds）', async () => {
    const h = createHarness()
    const session = await h.api.login({ username: 'admin_pool', password: DEMO_PASSWORD })
    expect(session.user).toMatchObject({ role: 'VENUE_ADMIN', venueIds: [2, 3] })
    expect(session.token).not.toBe('')
  })

  it('密码错误与用户名不存在都是 INVALID_CREDENTIALS', async () => {
    const h = createHarness()
    await expectApiError(h.api.login({ username: 'zhangsan', password: 'wrong-password' }), 'INVALID_CREDENTIALS')
    await expectApiError(h.api.login({ username: 'nobody', password: DEMO_PASSWORD }), 'INVALID_CREDENTIALS')
  })

  it('账号被停用：登录 ACCOUNT_DISABLED，已有 Token 立即 ACCOUNT_DISABLED', async () => {
    const h = createHarness()
    await h.loginAs('zhangsan')
    const token = (await h.api.login({ username: 'zhangsan', password: DEMO_PASSWORD })).token
    await h.loginAs('sysadmin')
    await h.api.adminUpdateUser(1, { status: 'DISABLED' })
    await expectApiError(h.api.login({ username: 'zhangsan', password: DEMO_PASSWORD }), 'ACCOUNT_DISABLED')
    const stale = createMockClient({ state: h.context.state, clock: h.clock, getToken: () => token })
    await expectApiError(stale.getMe(), 'ACCOUNT_DISABLED')
    await expectApiError(stale.listVenues(), 'ACCOUNT_DISABLED')
  })

  it('停用后的错误密码仍是 INVALID_CREDENTIALS，不泄露账号状态', async () => {
    const h = createHarness()
    await h.loginAs('sysadmin')
    await h.api.adminUpdateUser(1, { status: 'DISABLED' })
    await expectApiError(h.api.login({ username: 'zhangsan', password: 'wrong-password' }), 'INVALID_CREDENTIALS')
  })

  it('用户名或密码为空 → VALIDATION_ERROR', async () => {
    const h = createHarness()
    await expectApiError(h.api.login({ username: '', password: '' }), 'VALIDATION_ERROR')
  })
})

describe('Token', () => {
  it('没有 Token 或未知 Token → AUTH_REQUIRED', async () => {
    const h = createHarness()
    await expectApiError(h.api.getMe(), 'AUTH_REQUIRED')
    const forged = createMockClient({ state: h.context.state, clock: h.clock, getToken: () => 'forged-token' })
    await expectApiError(forged.getMe(), 'AUTH_REQUIRED')
  })

  it('签发 8 小时后过期：7 小时 59 分 59 秒有效，8 小时整 TOKEN_EXPIRED', async () => {
    const h = createHarness()
    await h.loginAs('zhangsan')
    h.clock.set(`${TODAY}T14:59:59`)
    await expect(h.api.getMe()).resolves.toMatchObject({ username: 'zhangsan' })
    h.clock.set(`${TODAY}T15:00:00`)
    await expectApiError(h.api.getMe(), 'TOKEN_EXPIRED')
  })

  it('getToken 每次调用都重新读取：切换 Token 即切换身份', async () => {
    const clock = createFakeClock(NOW)
    let token: string | null = null
    const api = createMockClient({ clock, getToken: () => token })
    token = (await api.login({ username: 'lisi', password: DEMO_PASSWORD })).token
    expect((await api.getMe()).username).toBe('lisi')
    token = (await api.login({ username: 'wangwu', password: DEMO_PASSWORD })).token
    expect((await api.getMe()).username).toBe('wangwu')
  })
})

describe('预约参数与返回值隔离', () => {
  it('GET /config/booking-rules 公开，返回 03 第 4.3 节的默认参数', async () => {
    const h = createHarness()
    expect(await h.api.getBookingRules()).toEqual({
      slotMinutes: 90, advanceDays: 7, cancelDeadlineMinutes: 120, checkInOpenBeforeMinutes: 15,
      checkInCloseAfterMinutes: 15, checkOutGraceMinutes: 30, maxActiveReservationsPerUser: 3, timezone: 'Asia/Shanghai',
    })
  })

  it('返回值是副本：调用方修改不会影响 mock 内部状态', async () => {
    const h = createHarness()
    await h.loginAs('zhangsan')
    const venues = await h.api.listVenues()
    venues[0]!.name = '被篡改'
    expect((await h.api.listVenues())[0]?.name).toBe('网球馆')
  })
})
