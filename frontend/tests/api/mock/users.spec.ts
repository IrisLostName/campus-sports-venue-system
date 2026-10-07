// 系统管理员：用户与授权（docs/12 第 5.9 节）。
import { describe, expect, it } from 'vitest'

import { DEMO_PASSWORD } from '../../../src/api/mock/seed'
import type { CreateUserRequest } from '../../../src/api/requests'
import { createHarness, expectApiError, type Harness } from '../support/harness'

async function asSysAdmin(): Promise<Harness> {
  const h = createHarness()
  await h.loginAs('sysadmin')
  return h
}

const NEW_USER: CreateUserRequest = { username: 'teacher01', password: 'Passw0rd!', displayName: '体育老师', role: 'USER' }

describe('用户列表', () => {
  it('按角色与关键字过滤；只有场馆管理员带 venueIds', async () => {
    const h = await asSysAdmin()
    expect((await h.api.adminListUsers({ role: 'VENUE_ADMIN' })).items.map((u) => [u.username, u.venueIds]))
      .toEqual([['admin_tennis', [1]], ['admin_pool', [2, 3]]])
    expect((await h.api.adminListUsers({ keyword: '三' })).items.map((u) => u.username)).toEqual(['zhangsan'])
    expect((await h.api.adminListUsers({ keyword: 'ADMIN_' })).total).toBe(2)
  })

  it('分页', async () => {
    const h = await asSysAdmin()
    const page = await h.api.adminListUsers({ page: 2, pageSize: 3 })
    expect(page).toMatchObject({ page: 2, pageSize: 3, total: 7 })
    expect(page.items.map((u) => u.id)).toEqual([4, 5, 6])
  })

  it('非法角色或分页参数 → VALIDATION_ERROR', async () => {
    const h = await asSysAdmin()
    await expectApiError(h.api.adminListUsers({ role: 'BOSS' as 'USER' }), 'VALIDATION_ERROR')
    await expectApiError(h.api.adminListUsers({ pageSize: 101 }), 'VALIDATION_ERROR')
  })
})

describe('创建账号', () => {
  it('可创建任意角色；新账号能用设定的口令登录；写日志 USER_CREATE', async () => {
    const h = await asSysAdmin()
    const created = await h.api.adminCreateUser({ ...NEW_USER, userType: 'TEACHER', phone: '13900000000' })
    expect(created).toMatchObject({ role: 'USER', userType: 'TEACHER', phone: '13900000000', status: 'ACTIVE', venueIds: null })
    const [log] = (await h.api.adminListLogs({ action: 'USER_CREATE' })).items
    expect(log).toMatchObject({ targetType: 'USER', targetId: created.id, venueId: null })
    await expect(h.api.login({ username: 'teacher01', password: 'Passw0rd!' })).resolves.toMatchObject({ user: { id: created.id } })
  })

  it('role=VENUE_ADMIN 时 venueIds 有效；其他角色忽略 venueIds', async () => {
    const h = await asSysAdmin()
    const admin = await h.api.adminCreateUser({ ...NEW_USER, username: 'va_new', role: 'VENUE_ADMIN', venueIds: [3, 1] })
    expect(admin.venueIds).toEqual([1, 3])
    const user = await h.api.adminCreateUser({ ...NEW_USER, username: 'user_new', venueIds: [1] })
    expect(user.venueIds).toBeNull()
    const sys = await h.api.adminCreateUser({ ...NEW_USER, username: 'sys_new', role: 'SYS_ADMIN' })
    expect(sys).toMatchObject({ role: 'SYS_ADMIN', venueIds: null })
  })

  it('用户名重复 USERNAME_TAKEN；字段不合法或场馆不存在 VALIDATION_ERROR', async () => {
    const h = await asSysAdmin()
    await expectApiError(h.api.adminCreateUser({ ...NEW_USER, username: 'lisi' }), 'USERNAME_TAKEN')
    await expectApiError(h.api.adminCreateUser({ ...NEW_USER, username: 'x' }), 'VALIDATION_ERROR')
    await expectApiError(h.api.adminCreateUser({ ...NEW_USER, password: 'short' }), 'VALIDATION_ERROR')
    await expectApiError(h.api.adminCreateUser({ ...NEW_USER, role: 'BOSS' as 'USER' }), 'VALIDATION_ERROR')
    await expectApiError(h.api.adminCreateUser({ ...NEW_USER, role: 'VENUE_ADMIN', venueIds: [99] }), 'VALIDATION_ERROR')
  })
})

describe('修改账号', () => {
  it('停用：该用户立即无法登录，写日志 USER_STATUS_CHANGE；重新启用后恢复', async () => {
    const h = await asSysAdmin()
    expect(await h.api.adminUpdateUser(4, { status: 'DISABLED' })).toMatchObject({ status: 'DISABLED' })
    await expectApiError(h.api.login({ username: 'zhaoliu', password: DEMO_PASSWORD }), 'ACCOUNT_DISABLED')
    expect((await h.api.adminListLogs({ action: 'USER_STATUS_CHANGE' })).items[0]).toMatchObject({ targetId: 4, targetType: 'USER' })
    await h.api.adminUpdateUser(4, { status: 'ACTIVE' })
    await expect(h.api.login({ username: 'zhaoliu', password: DEMO_PASSWORD })).resolves.toBeDefined()
  })

  it('只改 displayName：没有对应日志枚举，不写日志', async () => {
    const h = await asSysAdmin()
    expect(await h.api.adminUpdateUser(4, { displayName: '赵六六' })).toMatchObject({ displayName: '赵六六' })
    expect((await h.api.adminListLogs()).total).toBe(0)
  })

  it('停用自己 → INVALID_STATE；不存在 NOT_FOUND；非法状态或空姓名 VALIDATION_ERROR', async () => {
    const h = await asSysAdmin()
    await expectApiError(h.api.adminUpdateUser(7, { status: 'DISABLED' }), 'INVALID_STATE')
    await expectApiError(h.api.adminUpdateUser(99, { displayName: 'x' }), 'NOT_FOUND')
    await expectApiError(h.api.adminUpdateUser(4, { status: 'GONE' as 'ACTIVE' }), 'VALIDATION_ERROR')
    await expectApiError(h.api.adminUpdateUser(4, { displayName: ' ' }), 'VALIDATION_ERROR')
  })
})

describe('授权场馆（整体替换）', () => {
  it('替换为新列表，去重，写日志 SCOPE_UPDATE', async () => {
    const h = await asSysAdmin()
    const updated = await h.api.adminSetVenueScope(5, { venueIds: [3, 2, 3] })
    expect(updated.venueIds).toEqual([2, 3])
    const [log] = (await h.api.adminListLogs({ action: 'SCOPE_UPDATE' })).items
    expect(log).toMatchObject({ targetType: 'SCOPE', targetId: 5, venueId: null })
    expect((await h.api.adminSetVenueScope(5, { venueIds: [] })).venueIds).toEqual([])
  })

  it('目标不是 VENUE_ADMIN → INVALID_STATE；不存在 NOT_FOUND；场馆不存在 VALIDATION_ERROR', async () => {
    const h = await asSysAdmin()
    await expectApiError(h.api.adminSetVenueScope(1, { venueIds: [1] }), 'INVALID_STATE')
    await expectApiError(h.api.adminSetVenueScope(7, { venueIds: [1] }), 'INVALID_STATE')
    await expectApiError(h.api.adminSetVenueScope(99, { venueIds: [1] }), 'NOT_FOUND')
    await expectApiError(h.api.adminSetVenueScope(5, { venueIds: [99] }), 'VALIDATION_ERROR')
  })
})
