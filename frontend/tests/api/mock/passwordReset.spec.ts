// v1.3 自助找回密码（docs/12 第 5.1 节 POST /auth/password-reset、docs/10 第 4a 节；SEC-2c 裁决第 0 节第 2 条）：
// 按用户名字符串计数、24 小时窗口且只数最近一次成功之后的失败、7 次锁定、成功后旧 Token 失效（整秒）；
// 以及注册与系统管理员创建账号的手机号规则。
import { describe, expect, it } from 'vitest'

import { createMockClient } from '../../../src/api/mock/index'
import type { PasswordResetRequest, RegisterRequest } from '../../../src/api/requests'
import { createHarness, expectApiError, NOW, type Harness } from '../support/harness'

const PHONE = '13800000001'
const OWNER = { username: 'stu01', password: 'Passw0rd!', displayName: '周八', phone: PHONE }
const RIGHT: PasswordResetRequest = { username: 'stu01', displayName: '周八', phone: PHONE, newPassword: 'NewPassw0rd!' }
const WRONG: PasswordResetRequest = { ...RIGHT, phone: '13800000002' }

async function withOwner(): Promise<{ h: Harness; token: string }> {
  const h = createHarness()
  const session = await h.api.register(OWNER)
  return { h, token: session.token }
}

async function failTimes(h: Harness, request: PasswordResetRequest, times: number): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await expectApiError(h.api.resetPassword(request), 'RESET_INFO_MISMATCH')
  }
}

describe('找回密码：格式', () => {
  it.each([
    ['用户名为空白', { username: ' ' }, 'username'],
    ['用户名超过 32 位', { username: 'a'.repeat(33) }, 'username'],
    ['姓名为空白', { displayName: '  ' }, 'displayName'],
    ['姓名超过 50 字', { displayName: '名'.repeat(51) }, 'displayName'],
    ['手机号 10 位', { phone: '1380000000' }, 'phone'],
    ['手机号带空格', { phone: ' 13800000001' }, 'phone'],
    ['新密码 7 位', { newPassword: '1234567' }, 'newPassword'],
    ['新密码超过 72 字节', { newPassword: '密'.repeat(25) }, 'newPassword'],
  ])('%s → VALIDATION_ERROR（fields.%s），不记尝试', async (_label, patch, field) => {
    const { h } = await withOwner()
    const error = await expectApiError(h.api.resetPassword({ ...RIGHT, ...patch }), 'VALIDATION_ERROR')
    expect(Object.keys(error.details?.fields as object)).toEqual([field])
    expect(h.context.state.resetAttempts).toEqual([])
  })
})

describe('找回密码：核对', () => {
  it('四项都对：成功（204，无返回值），旧密码不能登录，新密码能登录', async () => {
    const { h } = await withOwner()
    await expect(h.api.resetPassword(RIGHT)).resolves.toBeUndefined()
    await expectApiError(h.api.login({ username: 'stu01', password: 'Passw0rd!' }), 'INVALID_CREDENTIALS')
    expect((await h.api.login({ username: 'stu01', password: 'NewPassw0rd!' })).user.username).toBe('stu01')
    expect(h.context.state.resetAttempts).toEqual([{ username: 'stu01', attemptedAt: NOW, succeeded: true }])
  })

  it('姓名或手机号差一个字、管理员账号、停用账号、没有登记手机号、不存在的用户名：一律 RESET_INFO_MISMATCH，剩余次数相同', async () => {
    const { h } = await withOwner()
    await h.loginAs('sysadmin')
    await h.api.adminCreateUser({ username: 'va_phone', password: 'Passw0rd!', displayName: '馆员', role: 'VENUE_ADMIN', phone: PHONE })
    const disabled = await h.api.adminCreateUser({ username: 'gone', password: 'Passw0rd!', displayName: '离校', role: 'USER', phone: PHONE })
    await h.api.adminUpdateUser(disabled.id, { status: 'DISABLED' })
    const cases: PasswordResetRequest[] = [
      { ...RIGHT, displayName: '周 八' },
      { ...RIGHT, phone: '13800000009' },
      { ...RIGHT, username: 'va_phone', displayName: '馆员' },
      { ...RIGHT, username: 'gone', displayName: '离校' },
      { ...RIGHT, username: 'zhangsan', displayName: '张三' },
      { ...RIGHT, username: 'nobody_here' },
    ]
    for (const request of cases) {
      const before = h.context.state.resetAttempts.filter((attempt) => attempt.username === request.username).length
      await expectApiError(h.api.resetPassword(request), 'RESET_INFO_MISMATCH', { remainingAttempts: 6 - before })
    }
    expect(JSON.stringify(h.context.state.users.find((user) => user.username === 'stu01'))).toContain('Passw0rd!')
  })

  it('剩余次数逐次递减：6、5、…、0', async () => {
    const { h } = await withOwner()
    for (let remaining = 6; remaining >= 0; remaining -= 1) {
      await expectApiError(h.api.resetPassword(WRONG), 'RESET_INFO_MISMATCH', { remainingAttempts: remaining })
    }
  })
})

describe('找回密码：锁定与解锁', () => {
  it('7 次失败后第 8 次 PASSWORD_RESET_LOCKED，unlocksAt = 最早一次失败 + 24 小时；锁定时不核对、不记录', async () => {
    const { h } = await withOwner()
    await failTimes(h, WRONG, 1)
    h.clock.advanceMinutes(30)
    await failTimes(h, WRONG, 6)
    const recorded = h.context.state.resetAttempts.length
    await expectApiError(h.api.resetPassword(RIGHT), 'PASSWORD_RESET_LOCKED', { unlocksAt: '2026-10-13T07:00:00' })
    expect(h.context.state.resetAttempts).toHaveLength(recorded)
    await expectApiError(h.api.login({ username: 'stu01', password: 'NewPassw0rd!' }), 'INVALID_CREDENTIALS')
  })

  it('到 unlocksAt 那一刻最早一次失败不再计入：恢复 1 次机会；再到第二次失败满 24 小时后全部恢复', async () => {
    const { h } = await withOwner()
    await failTimes(h, WRONG, 1)
    h.clock.advanceMinutes(30)
    await failTimes(h, WRONG, 6)
    h.clock.set('2026-10-13T06:59:59')
    await expectApiError(h.api.resetPassword(RIGHT), 'PASSWORD_RESET_LOCKED')
    h.clock.set('2026-10-13T07:00:00')
    await expectApiError(h.api.resetPassword(WRONG), 'RESET_INFO_MISMATCH', { remainingAttempts: 0 })
    await expectApiError(h.api.resetPassword(RIGHT), 'PASSWORD_RESET_LOCKED', { unlocksAt: '2026-10-13T07:30:00' })
    h.clock.set('2026-10-13T07:30:00')
    await expect(h.api.resetPassword(RIGHT)).resolves.toBeUndefined()
  })

  it('不存在的用户名同样会被锁定（表现与真实账号一致）；计数只按用户名字符串，互不影响', async () => {
    const h = createHarness()
    const ghost = { ...RIGHT, username: 'nobody_here' }
    await failTimes(h, ghost, 7)
    await expectApiError(h.api.resetPassword(ghost), 'PASSWORD_RESET_LOCKED', { unlocksAt: '2026-10-13T07:00:00' })
    await expectApiError(h.api.resetPassword({ ...ghost, username: 'Nobody_here' }), 'RESET_INFO_MISMATCH', { remainingAttempts: 6 })
  })

  it('成功清零：只数最近一次成功之后的失败', async () => {
    const { h } = await withOwner()
    await failTimes(h, WRONG, 6)
    await h.api.resetPassword(RIGHT)
    await expectApiError(h.api.resetPassword(WRONG), 'RESET_INFO_MISMATCH', { remainingAttempts: 6 })
  })
})

describe('找回密码：成功后旧 Token 失效（截到整秒）', () => {
  it('重置之前签发的 Token → TOKEN_EXPIRED；重置之后新登录的 Token 有效；其他账号不受影响', async () => {
    const { h, token } = await withOwner()
    const other = (await h.api.login({ username: 'zhangsan', password: 'Demo@1234' })).token
    h.clock.advanceMinutes(1)
    await h.api.resetPassword(RIGHT)
    const asToken = (value: string) => createMockClient({ state: h.context.state, clock: h.clock, getToken: () => value })

    await expectApiError(asToken(token).getMe(), 'TOKEN_EXPIRED')
    await expectApiError(asToken(token).listMyReservations(), 'TOKEN_EXPIRED')
    const fresh = (await h.api.login({ username: 'stu01', password: 'NewPassw0rd!' })).token
    expect((await asToken(fresh).getMe()).username).toBe('stu01')
    expect((await asToken(other).getMe()).username).toBe('zhangsan')
  })

  it('同一秒内：重置前签发的 Token 与重置后立刻登录的 Token 都有效（签发时刻不早于改密时刻）', async () => {
    const { h, token } = await withOwner()
    await h.api.resetPassword(RIGHT)
    const fresh = (await h.api.login({ username: 'stu01', password: 'NewPassw0rd!' })).token
    for (const value of [token, fresh]) {
      expect((await createMockClient({ state: h.context.state, clock: h.clock, getToken: () => value }).getMe()).username).toBe('stu01')
    }
    h.clock.advanceMinutes(1)
    await h.api.resetPassword({ ...RIGHT, newPassword: 'Third0ne!!' })
    await expectApiError(createMockClient({ state: h.context.state, clock: h.clock, getToken: () => fresh }).getMe(), 'TOKEN_EXPIRED')
  })

  it('TOKEN_EXPIRED 先于 ACCOUNT_DISABLED', async () => {
    const { h, token } = await withOwner()
    h.clock.advanceMinutes(1)
    await h.api.resetPassword(RIGHT)
    const user = h.context.state.users.find((candidate) => candidate.username === 'stu01')
    if (user === undefined) {
      throw new Error('stu01')
    }
    user.status = 'DISABLED'
    await expectApiError(createMockClient({ state: h.context.state, clock: h.clock, getToken: () => token }).getMe(), 'TOKEN_EXPIRED')
  })
})

describe('手机号规则：注册与系统管理员创建账号', () => {
  it.each([
    ['缺省', undefined, '不能为空'],
    ['空白', '   ', '不能为空'],
    ['10 位', '1380000000', '应为 11 位手机号'],
    ['12 位', '138000000000', '应为 11 位手机号'],
    ['含空格', '138 0000 000', '应为 11 位手机号'],
    ['含短横线', '138-0000-000', '应为 11 位手机号'],
    ['不以 1 开头', '23800000000', '应为 11 位手机号'],
  ])('注册：手机号%s → VALIDATION_ERROR（fields.phone）', async (_label, phone, reason) => {
    const h = createHarness()
    await expectApiError(h.api.register({ ...OWNER, phone } as RegisterRequest), 'VALIDATION_ERROR', { fields: { phone: reason } })
  })

  it('注册：11 位手机号成功，原样保存', async () => {
    const { h } = await withOwner()
    expect(h.context.state.users.find((user) => user.username === 'stu01')?.phone).toBe(PHONE)
  })

  it('创建普通用户：缺手机号或格式不对 VALIDATION_ERROR（fields.phone）；格式正确成功', async () => {
    const h = createHarness()
    await h.loginAs('sysadmin')
    const base = { username: 'stu02', password: 'Passw0rd!', displayName: '吴九', role: 'USER' as const }
    await expectApiError(h.api.adminCreateUser(base), 'VALIDATION_ERROR', { fields: { phone: '不能为空' } })
    await expectApiError(h.api.adminCreateUser({ ...base, phone: '1380000000' }), 'VALIDATION_ERROR', { fields: { phone: '应为 11 位手机号' } })
    await expect(h.api.adminCreateUser({ ...base, phone: PHONE })).resolves.toMatchObject({ role: 'USER', phone: PHONE })
  })

  it('创建管理员账号：手机号可不填；填写时同样校验格式', async () => {
    const h = createHarness()
    await h.loginAs('sysadmin')
    await expect(h.api.adminCreateUser({ username: 'va_new', password: 'Passw0rd!', displayName: '馆员', role: 'VENUE_ADMIN' }))
      .resolves.toMatchObject({ phone: null })
    await expect(h.api.adminCreateUser({ username: 'sa_new', password: 'Passw0rd!', displayName: '系统', role: 'SYS_ADMIN' }))
      .resolves.toMatchObject({ phone: null })
    await expectApiError(h.api.adminCreateUser({ username: 'sa_bad', password: 'Passw0rd!', displayName: '系统', role: 'SYS_ADMIN', phone: '12345' }),
      'VALIDATION_ERROR', { fields: { phone: '应为 11 位手机号' } })
  })
})
