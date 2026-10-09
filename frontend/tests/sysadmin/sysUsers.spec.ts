// FE-6 G2 / G3：管理员与授权、用户。列表与筛选、新建账号（规则与注册一致、密码不外泄）、改显示名、停用需确认 / 启用直接提交、授权范围整体替换。
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../src/api/errors'
import type { UserProfile } from '../../src/api/types'
import { createSysUsers } from '../../src/composables/sysUsers'
import {
  buildCreateUserRequest, buildUserRow, emptyUserForm, NO_SCOPE_TEXT, ROLE_LABELS, userFormProblem,
} from '../../src/utils/sysUserDisplay'
import { loginAdmin } from '../admin/harness'
import { callsOf, fillAndCreate, openBoard, SECRET, SYSADMIN_ID } from './usersHarness'

describe('G2 / G3 展示口径', () => {
  it('角色中文名；账号规则与注册一致', () => {
    expect(ROLE_LABELS).toEqual({ USER: '普通用户', VENUE_ADMIN: '场馆管理员', SYS_ADMIN: '系统管理员' })
    const form = { ...emptyUserForm(), username: 'abc', password: '12345678', displayName: '甲' }

    expect(userFormProblem(form)).toBeNull()
    expect(userFormProblem({ ...form, username: 'ab' })).toBe('用户名需为 3–32 位字母、数字或下划线')
    expect(userFormProblem({ ...form, username: 'a b!' })).toBe('用户名需为 3–32 位字母、数字或下划线')
    expect(userFormProblem({ ...form, username: 'a'.repeat(33) })).toBe('用户名需为 3–32 位字母、数字或下划线')
    expect(userFormProblem({ ...form, password: '1234567' })).toBe('密码需为 8–64 位')
    expect(userFormProblem({ ...form, password: 'x'.repeat(65) })).toBe('密码需为 8–64 位')
    expect(userFormProblem({ ...form, displayName: ' ' })).toBe('请填写姓名')
  })

  it('创建请求：userType 只对 USER、venueIds 只对 VENUE_ADMIN；空手机号不发送', () => {
    const base = { ...emptyUserForm(), username: 'abc', password: '12345678', displayName: ' 甲 ', venueIds: [2, 3], phone: ' ' }

    expect(buildCreateUserRequest({ ...base, role: 'USER', userType: 'TEACHER' }))
      .toEqual({ username: 'abc', password: '12345678', displayName: '甲', role: 'USER', userType: 'TEACHER' })
    expect(buildCreateUserRequest({ ...base, role: 'VENUE_ADMIN', phone: '13800000000' }))
      .toEqual({ username: 'abc', password: '12345678', displayName: '甲', role: 'VENUE_ADMIN', phone: '13800000000', venueIds: [2, 3] })
    expect(buildCreateUserRequest({ ...base, role: 'SYS_ADMIN' }))
      .toEqual({ username: 'abc', password: '12345678', displayName: '甲', role: 'SYS_ADMIN' })
  })

  it('授权范围文字：场馆名用顿号连接；没有授权显示提示；非管理员没有授权范围', () => {
    const names = new Map([[2, '羽毛球馆'], [3, '游泳馆']])
    const profile = { id: 6, username: 'p', displayName: 'P', role: 'VENUE_ADMIN', userType: 'OTHER', phone: null, status: 'ACTIVE', venueIds: [] } satisfies UserProfile

    expect(buildUserRow({ ...profile, venueIds: [2, 3] }, names, 7).scopeText).toBe('羽毛球馆、游泳馆')
    expect(buildUserRow({ ...profile, venueIds: [] }, names, 7).scopeText).toBe(NO_SCOPE_TEXT)
    expect(buildUserRow({ ...profile, venueIds: [9] }, names, 7).scopeText).toBe('场馆 #9')
    expect(buildUserRow({ ...profile, role: 'USER', venueIds: null }, names, 7).scopeText).toBeNull()
    expect(buildUserRow(profile, names, 6).isSelf).toBe(true)
  })
})

describe('G3 用户列表', () => {
  it('不带筛选：全部 7 个账号，查询只带页码', async () => {
    const { board, spy } = await openBoard()

    expect(board.rows.value).toHaveLength(7)
    expect(callsOf(spy, 'adminListUsers')).toEqual([[{ page: 1 }]])
  })

  it('按角色筛选，关键字匹配用户名 / 显示名；点查询回到第 1 页', async () => {
    const { board, spy } = await openBoard()
    board.filters.role = 'USER'
    board.filters.keyword = ' zhang '
    await board.search()

    expect(callsOf(spy, 'adminListUsers').at(-1)).toEqual([{ page: 1, role: 'USER', keyword: 'zhang' }])
    expect(board.rows.value.map((row) => row.username)).toEqual(['zhangsan'])
  })

  it('接口返回的页码与总数原样保留', async () => {
    const { board } = await openBoard()

    expect(board.list.total.value).toBe(7)
    expect(board.list.page.value).toBe(1)
  })
})

describe('G2 管理员与授权', () => {
  it('固定角色 VENUE_ADMIN：只列场馆管理员，并显示各自授权的场馆名', async () => {
    const { board, spy } = await openBoard('VENUE_ADMIN')

    expect(callsOf(spy, 'adminListUsers')).toEqual([[{ page: 1, role: 'VENUE_ADMIN' }]])
    expect(board.rows.value.map((row) => [row.username, row.scopeText])).toEqual([
      ['admin_tennis', '网球馆'], ['admin_pool', '羽毛球馆、游泳馆'],
    ])
  })

  it('新建场馆管理员并授权羽毛球馆：请求带 venueIds、不带 userType；新账号出现在列表里', async () => {
    const { board, spy } = await openBoard('VENUE_ADMIN')
    board.openCreate()
    expect(board.create.value?.role).toBe('VENUE_ADMIN')
    board.patchCreate({ username: 'admin_new', password: SECRET, displayName: '新管理员', venueIds: [2] })
    await board.confirmCreate()

    expect(callsOf(spy, 'adminCreateUser')).toEqual([[{
      username: 'admin_new', password: SECRET, displayName: '新管理员', role: 'VENUE_ADMIN', venueIds: [2],
    }]])
    expect(board.create.value).toBeNull()
    expect(board.notice.value).toBe('账号已创建')
    expect(board.rows.value.find((row) => row.username === 'admin_new')).toMatchObject({ roleLabel: '场馆管理员', scopeText: '羽毛球馆', statusLabel: '正常' })
  })

  it('调整授权：整体替换；目标不是场馆管理员时不打开；生效后该管理员的可管理场馆随之变化', async () => {
    const { ctx, board, spy } = await openBoard('VENUE_ADMIN')
    board.openScope(5)
    expect(board.scope.value).toMatchObject({ id: 5, name: '网球馆管理员', venueIds: [1] })
    board.patchScope({ venueIds: [1, 2] })
    await board.confirmScope()

    expect(callsOf(spy, 'adminSetVenueScope')).toEqual([[5, { venueIds: [1, 2] }]])
    expect(board.scope.value).toBeNull()
    expect(board.notice.value).toBe('授权范围已更新')
    expect(board.rows.value[0]?.scopeText).toBe('网球馆、羽毛球馆')
    const tennisAdmin = await ctx.h.clientFor('admin_tennis')
    expect((await tennisAdmin.adminListVenues()).map((venue) => venue.name)).toEqual(['网球馆', '羽毛球馆'])

    board.openScope(1)
    expect(board.scope.value).toBeNull()
  })

  it('授权范围可以清空（整体替换为空数组）', async () => {
    const { board, spy } = await openBoard('VENUE_ADMIN')
    board.openScope(6)
    board.patchScope({ venueIds: [] })
    await board.confirmScope()

    expect(callsOf(spy, 'adminSetVenueScope')).toEqual([[6, { venueIds: [] }]])
    expect(board.rows.value[1]?.scopeText).toBe(NO_SCOPE_TEXT)
  })

  it('授权失败（接口拒绝）：对话框保留并显示文案', async () => {
    const ctx = await loginAdmin('sysadmin')
    const api = { ...ctx.api, adminSetVenueScope: () => Promise.reject(new ApiError(403, 'FORBIDDEN', '无权')) }
    const board = createSysUsers({ api, call: ctx.call }, { venues: () => [], selfId: () => SYSADMIN_ID, fixedRole: 'VENUE_ADMIN' })
    await board.load()
    board.openScope(5)
    await board.confirmScope()

    expect(board.scope.value?.error).toBe('无权执行此操作')
  })
})

describe('G3 新建账号', () => {
  it('普通用户：带 userType，不带 venueIds', async () => {
    const { board, spy } = await openBoard()
    await fillAndCreate(board, { role: 'USER', userType: 'TEACHER', venueIds: [1] })

    expect(callsOf(spy, 'adminCreateUser')).toEqual([[{
      username: 'new_admin', password: SECRET, displayName: '新管理员', role: 'USER', userType: 'TEACHER',
    }]])
  })

  it('规则与注册一致：用户名 / 密码不合格时给出提示，不发请求，对话框保留', async () => {
    const { board, spy } = await openBoard()
    await fillAndCreate(board, { username: 'a!' })
    expect(board.create.value?.error).toBe('用户名需为 3–32 位字母、数字或下划线')

    board.patchCreate({ username: 'abc', password: 'short' })
    await board.confirmCreate()
    expect(board.create.value?.error).toBe('密码需为 8–64 位')
    expect(callsOf(spy, 'adminCreateUser')).toEqual([])
  })

  it('用户名已占用：显示接口文案，对话框保留', async () => {
    const { board } = await openBoard()
    await fillAndCreate(board, { username: 'zhangsan' })

    expect(board.create.value?.error).toBe('用户名已被占用')
  })

  it('密码不外泄：创建成功后状态被丢弃，提示、列表行、错误里都没有密码', async () => {
    const { board } = await openBoard()
    await fillAndCreate(board, { role: 'USER' })
    const visible = JSON.stringify([board.create.value, board.notice.value, board.rows.value, board.error.value, board.list.items.value])

    expect(visible).not.toContain(SECRET)
    expect(board.create.value).toBeNull()
  })

  it('关闭对话框（不提交）也会丢弃密码', async () => {
    const { board } = await openBoard()
    board.openCreate()
    board.patchCreate({ password: SECRET })
    board.dismissCreate()

    expect(board.create.value).toBeNull()
  })

  it('创建账号会写入 USER_CREATE 日志（venueId 为 null），日志里没有密码', async () => {
    const { ctx, board } = await openBoard()
    await fillAndCreate(board, { role: 'USER' })
    const logs = await ctx.api.adminListLogs({})

    expect(logs.items[0]).toMatchObject({ action: 'USER_CREATE', venueId: null })
    expect(JSON.stringify(logs)).not.toContain(SECRET)
  })
})

