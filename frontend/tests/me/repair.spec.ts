// “我的”页的报修（FE-4 M3）：场馆必选、描述必填且最多 500 字、请求不带 resourceId、提交后刷新列表并显示状态。
import { describe, expect, it } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import type { CreateRepairRequest } from '../../src/api/requests'
import type { RepairReport } from '../../src/api/types'
import { createRepairBoard, REPAIR_NOTICE } from '../../src/composables/repairBoard'
import { deferred } from '../display/support'
import { loginAs, type UserContext } from '../reservations/harness'

function boardFor(ctx: UserContext, api: ApiClient = ctx.h.api) {
  return createRepairBoard({ api, call: ctx.call })
}

function recordCreates(api: ApiClient): { client: ApiClient; requests: CreateRepairRequest[] } {
  const requests: CreateRepairRequest[] = []
  const client: ApiClient = { ...api, createRepair: (request) => { requests.push(request); return api.createRepair(request) } }
  return { client, requests }
}

describe('加载', () => {
  it('场馆下拉取 listVenues 的全部场馆（含未开放预约的）；还没有报修时列表为空', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    const board = boardFor(ctx)

    await board.load()

    expect(board.venues.value.map((venue) => [venue.name, venue.bookable])).toEqual([
      ['网球馆', true], ['羽毛球馆', false], ['游泳馆', false],
    ])
    expect(board.items.value).toEqual([])
    expect(board.listLoaded.value).toBe(true)
  })

  it('场馆或报修列表拉取失败：各自给出错误文案，互不影响', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    const board = boardFor(ctx, {
      ...ctx.h.api,
      listVenues: () => Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x')),
      listMyRepairs: () => Promise.reject(new ApiError(403, 'FORBIDDEN', 'x')),
    })

    await board.load()

    expect(board.venuesError.value).toBe('服务器开小差了，请稍后再试')
    expect(board.listError.value).toBe('无权执行此操作')
    expect(board.listLoaded.value).toBe(false)
  })
})

describe('提交前检查', () => {
  it('没有选场馆：提示“请选择场馆”，不发请求', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    const { client, requests } = recordCreates(ctx.h.api)
    const board = boardFor(ctx, client)
    board.description.value = '球网损坏'

    await board.submit()

    expect(board.formError.value).toBe('请选择场馆')
    expect(requests).toEqual([])
  })

  it('描述为空或纯空白：提示“请填写问题描述”，不发请求', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    const { client, requests } = recordCreates(ctx.h.api)
    const board = boardFor(ctx, client)
    board.venueId.value = 1
    board.description.value = '   '

    await board.submit()

    expect(board.formError.value).toBe('请填写问题描述')
    expect(requests).toEqual([])
  })

  it('描述超过 500 字：提示，不发请求；恰好 500 字可以提交', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    const { client, requests } = recordCreates(ctx.h.api)
    const board = boardFor(ctx, client)
    board.venueId.value = 1
    board.description.value = '损'.repeat(501)

    await board.submit()
    expect(board.formError.value).toBe('问题描述不能超过 500 个字')
    expect(requests).toEqual([])

    board.description.value = '损'.repeat(500)
    await board.submit()
    expect(requests).toHaveLength(1)
    expect(board.formError.value).toBeNull()
  })
})

describe('提交与刷新', () => {
  it('请求只含 venueId 与去掉首尾空白的 description，不带 resourceId；成功后清空表单、刷新列表并显示“已提交”', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    const { client, requests } = recordCreates(ctx.h.api)
    const board = boardFor(ctx, client)
    await board.load()
    board.venueId.value = 2
    board.description.value = '  羽毛球场 3 的灯不亮  '

    await board.submit()

    expect(requests).toEqual([{ venueId: 2, description: '羽毛球场 3 的灯不亮' }])
    expect(Object.keys(requests[0] ?? {})).not.toContain('resourceId')
    expect(board.notice.value).toBe(REPAIR_NOTICE)
    expect(board.venueId.value).toBeNull()
    expect(board.description.value).toBe('')
    expect(board.items.value.map((item) => [item.venueName, item.description, item.statusLabel, item.resultNote]))
      .toEqual([['羽毛球馆', '羽毛球场 3 的灯不亮', '已提交', null]])
  })

  it('已处理的报修显示新状态和处理结果', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    const board = boardFor(ctx)
    board.venueId.value = 1
    board.description.value = '球网损坏'
    await board.submit()
    const admin = await ctx.h.clientFor('admin_tennis')
    await admin.adminUpdateRepair(1, { status: 'RESOLVED', resultNote: '已更换球网' })

    await board.load()

    expect(board.items.value.map((item) => [item.statusLabel, item.resultNote])).toEqual([['已解决', '已更换球网']])
  })

  it('提交进行中不可重复：连点只发出一次请求', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    const pending = deferred<RepairReport>()
    let calls = 0
    const board = boardFor(ctx, { ...ctx.h.api, createRepair: () => { calls += 1; return pending.promise } })
    board.venueId.value = 1
    board.description.value = '球网损坏'

    const first = board.submit()
    expect(board.submitting.value).toBe(true)
    const second = board.submit()
    pending.resolve(await ctx.h.api.createRepair({ venueId: 1, description: '球网损坏' }))
    await Promise.all([first, second])

    expect(calls).toBe(1)
    expect(board.submitting.value).toBe(false)
  })

})

describe('提交失败与重复提交', () => {
  it('接口返回错误：显示错误码文案，表单内容保留以便修改后再提交', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    const board = boardFor(ctx, {
      ...ctx.h.api, createRepair: () => Promise.reject(new ApiError(400, 'VALIDATION_ERROR', 'x')),
    })
    board.venueId.value = 1
    board.description.value = '球网损坏'

    await board.submit()

    expect(board.formError.value).toBe('请求参数不合法')
    expect(board.description.value).toBe('球网损坏')
    expect(board.venueId.value).toBe(1)
    expect(board.notice.value).toBeNull()
  })

  it('再次提交时上一次的成功提示和错误被清掉', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    const board = boardFor(ctx)
    board.venueId.value = 1
    board.description.value = '球网损坏'
    await board.submit()
    expect(board.notice.value).toBe(REPAIR_NOTICE)

    await board.submit()

    expect(board.notice.value).toBeNull()
    expect(board.formError.value).toBe('请选择场馆')
  })
})

describe('X1 登录失效', () => {
  it('提交时 TOKEN_EXPIRED：回到登录页，没有错误文案，submitting 恢复', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    const board = boardFor(ctx)
    board.venueId.value = 1
    board.description.value = '球网损坏'
    ctx.h.clock.set('2026-10-12T18:00:00')

    await board.submit()

    expect(ctx.h.router.currentRoute.value.path).toBe('/login')
    expect(board.formError.value).toBeNull()
    expect(board.submitting.value).toBe(false)
  })

  it('加载时 TOKEN_EXPIRED：回到登录页', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    const board = boardFor(ctx)
    ctx.h.clock.set('2026-10-12T18:00:00')

    await board.load()

    expect(ctx.h.router.currentRoute.value.path).toBe('/login')
    expect(board.venuesError.value).toBeNull()
    expect(board.listError.value).toBeNull()
  })
})
