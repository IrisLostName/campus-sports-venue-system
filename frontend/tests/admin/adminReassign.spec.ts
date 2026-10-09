// FE-5 P2 / FE-6 N4：改派对话框取占用总览时登录失效（createReassign.loadOptions 的 sessionEnded 分支）。
// 种子：zhangsan 明天 08:00 网球场1（预约 1）。
import { describe, expect, it } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import { createReassign } from '../../src/composables/adminReassign'
import { loginAdmin } from './harness'

async function setup(failure: ApiError) {
  const ctx = await loginAdmin('admin_tennis')
  const { items } = await ctx.api.adminListReservations({ venueId: 1, page: 1 })
  const api: ApiClient = { ...ctx.api, adminGetOccupancy: () => Promise.reject(failure) }
  const reassign = createReassign({ api, call: ctx.call }, {
    find: (id) => items.find((item) => item.id === id),
    refresh: () => Promise.resolve(),
    notify: () => undefined,
  })
  return { ctx, reassign }
}

describe('N4 改派对话框取占用总览失败', () => {
  it('登录失效（TOKEN_EXPIRED）：对话框随即关闭，不显示错误，回到登录页', async () => {
    const { ctx, reassign } = await setup(new ApiError(401, 'TOKEN_EXPIRED', '过期'))

    const opening = reassign.open(1)
    expect(reassign.state.value).toMatchObject({ id: 1, loading: true })
    await opening

    expect(reassign.state.value).toBeNull()
    expect(ctx.h.router.currentRoute.value.path).toBe('/login')
  })

  it('其它失败（FORBIDDEN）：对话框保留，停止加载并显示错误', async () => {
    const { ctx, reassign } = await setup(new ApiError(403, 'FORBIDDEN', '无权'))

    await reassign.open(1)

    expect(reassign.state.value).toMatchObject({ id: 1, loading: false, error: '无权执行此操作' })
    expect(ctx.h.router.currentRoute.value.path).toBe('/venue-admin')
  })
})
