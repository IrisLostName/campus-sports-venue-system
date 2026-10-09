// FE-6 G3：改显示名、停用 / 启用（停用需确认、启用直接提交）、登录失效。
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../src/api/errors'
import { createSysUsers } from '../../src/composables/sysUsers'
import { loginAdmin } from '../admin/harness'
import { callsOf, fillAndCreate, openBoard, SYSADMIN_ID } from './usersHarness'

describe('G3 改显示名', () => {
  it('只发送 displayName；名称为空时提示，不发请求', async () => {
    const { board, spy } = await openBoard()
    board.openRename(1)
    board.patchRename({ displayName: ' ' })
    await board.confirmRename()
    expect(board.rename.value?.error).toBe('请填写显示名')
    expect(callsOf(spy, 'adminUpdateUser')).toEqual([])

    board.patchRename({ displayName: '张三丰' })
    await board.confirmRename()
    expect(callsOf(spy, 'adminUpdateUser')).toEqual([[1, { displayName: '张三丰' }]])
    expect(board.notice.value).toBe('显示名已保存')
    expect(board.rows.value[0]?.displayName).toBe('张三丰')
  })
})

describe('G3 停用 / 启用', () => {
  it('停用需要确认：打开确认对话框不发请求；确认后账号停用且无法登录', async () => {
    const { ctx, board, spy } = await openBoard()
    board.askDisable(1)
    expect(board.disable.value).toMatchObject({ id: 1, name: '张三' })
    expect(callsOf(spy, 'adminUpdateUser')).toEqual([])

    await board.confirmDisable()

    expect(callsOf(spy, 'adminUpdateUser')).toEqual([[1, { status: 'DISABLED' }]])
    expect(board.disable.value).toBeNull()
    expect(board.notice.value).toBe('已停用账号：张三')
    expect(board.rows.value[0]).toMatchObject({ statusLabel: '已停用', active: false })
    await expect(ctx.h.clientFor('zhangsan')).rejects.toMatchObject({ code: 'ACCOUNT_DISABLED' })
  })

  it('取消确认：不停用', async () => {
    const { board, spy } = await openBoard()
    board.askDisable(1)
    board.dismissDisable()

    expect(board.disable.value).toBeNull()
    expect(callsOf(spy, 'adminUpdateUser')).toEqual([])
  })

  it('启用直接提交，没有确认对话框', async () => {
    const { ctx, board, spy } = await openBoard()
    board.askDisable(1)
    await board.confirmDisable()
    await board.enable(1)

    expect(callsOf(spy, 'adminUpdateUser').at(-1)).toEqual([1, { status: 'ACTIVE' }])
    expect(board.notice.value).toBe('已启用账号：张三')
    expect(board.rows.value[0]).toMatchObject({ statusLabel: '正常', active: true })
    expect((await ctx.h.clientFor('zhangsan')).listVenues).toBeTypeOf('function')
  })

  it('自己的账号：行标记为自己，不会打开停用确认；后端仍以 INVALID_STATE 拒绝', async () => {
    const { ctx, board, spy } = await openBoard()

    expect(board.rows.value.find((row) => row.id === SYSADMIN_ID)?.isSelf).toBe(true)
    board.askDisable(SYSADMIN_ID)
    expect(board.disable.value).toBeNull()
    expect(callsOf(spy, 'adminUpdateUser')).toEqual([])
    await expect(ctx.api.adminUpdateUser(SYSADMIN_ID, { status: 'DISABLED' })).rejects.toMatchObject({ code: 'INVALID_STATE' })
  })

  it('停用失败：确认对话框保留并显示接口文案', async () => {
    const ctx = await loginAdmin('sysadmin')
    const api = { ...ctx.api, adminUpdateUser: () => Promise.reject(new ApiError(409, 'INVALID_STATE', '状态')) }
    const board = createSysUsers({ api, call: ctx.call }, { venues: () => [], selfId: () => SYSADMIN_ID })
    await board.load()
    board.askDisable(1)
    await board.confirmDisable()

    expect(board.disable.value?.error).toBe('当前状态不允许该操作')
  })

  it('启用失败：页面错误提示显示接口文案', async () => {
    const ctx = await loginAdmin('sysadmin')
    await ctx.api.adminUpdateUser(1, { status: 'DISABLED' })
    const failing = createSysUsers(
      { api: { ...ctx.api, adminUpdateUser: () => Promise.reject(new ApiError(403, 'FORBIDDEN', '无权')) }, call: ctx.call },
      { venues: () => [], selfId: () => SYSADMIN_ID },
    )
    await failing.load()
    await failing.enable(1)

    expect(failing.error.value).toBe('无权执行此操作')
  })
})

describe('G2 / G3 X1 登录失效', () => {
  it('列表请求 TOKEN_EXPIRED：回到登录页，不展示错误', async () => {
    const ctx = await loginAdmin('sysadmin')
    const api = { ...ctx.api, adminListUsers: () => Promise.reject(new ApiError(401, 'TOKEN_EXPIRED', '过期')) }
    const board = createSysUsers({ api, call: ctx.call }, { venues: () => [], selfId: () => SYSADMIN_ID })
    await board.load()

    expect(ctx.h.router.currentRoute.value.path).toBe('/login')
    expect(board.error.value).toBeNull()
  })

  it('创建账号时 TOKEN_EXPIRED：对话框关闭并回到登录页', async () => {
    const ctx = await loginAdmin('sysadmin')
    const api = { ...ctx.api, adminCreateUser: () => Promise.reject(new ApiError(401, 'TOKEN_EXPIRED', '过期')) }
    const board = createSysUsers({ api, call: ctx.call }, { venues: () => [], selfId: () => SYSADMIN_ID })
    await board.load()
    await fillAndCreate(board, { role: 'USER' })

    expect(board.create.value).toBeNull()
    expect(ctx.h.router.currentRoute.value.path).toBe('/login')
  })
})
