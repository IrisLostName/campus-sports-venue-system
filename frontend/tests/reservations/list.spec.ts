// 本人预约列表的共用组合函数（FE-3 N3）：CURRENT 与 HISTORY 共用同一份拉取、分页与失败处理。
import { describe, expect, it } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import type { MyReservationsQuery } from '../../src/api/requests'
import { RESERVATION_PAGE_SIZE } from '../../src/composables/reservationList'
import { loginAs } from './harness'
import { seedCancelledHistory } from './history'

function recordQueries(api: ApiClient): { client: ApiClient; queries: MyReservationsQuery[] } {
  const queries: MyReservationsQuery[] = []
  const client: ApiClient = {
    ...api,
    listMyReservations: (query) => {
      queries.push({ ...query })
      return api.listMyReservations(query)
    },
  }
  return { client, queries }
}

const failure = () => Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x'))
const FAILURE_TEXT = '服务器开小差了，请稍后再试'

describe('CURRENT 列表', () => {
  it('只请求 scope=CURRENT 第 1 页，条目与总数来自接口', async () => {
    const ctx = await loginAs('zhangsan', '/')
    const { client, queries } = recordQueries(ctx.h.api)
    const list = ctx.reservationList('CURRENT', client)
    expect(list.phase.value).toBe('idle')

    await list.load()

    expect(queries).toEqual([{ scope: 'CURRENT', page: 1, pageSize: RESERVATION_PAGE_SIZE }])
    expect(list.items.value.map((item) => item.id)).toEqual([1])
    expect(list.total.value).toBe(1)
    expect(list.phase.value).toBe('ready')
    expect(list.hasMore.value).toBe(false)
  })

  it('没有预约：ready 且为空', async () => {
    const ctx = await loginAs('wangwu', '/')
    const list = ctx.reservationList('CURRENT')
    await list.load()

    expect(list.items.value).toEqual([])
    expect(list.phase.value).toBe('ready')
  })
})

describe('HISTORY 列表分页', () => {
  it('每页 20 条：第 1 页 20 条且还有更多；加载更多追加剩下 5 条，之后没有更多', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    await seedCancelledHistory(ctx.h.api, 25)
    const { client, queries } = recordQueries(ctx.h.api)
    const list = ctx.reservationList('HISTORY', client)

    await list.load()
    expect(list.items.value).toHaveLength(20)
    expect(list.total.value).toBe(25)
    expect(list.hasMore.value).toBe(true)

    await list.loadMore()
    expect(list.items.value).toHaveLength(25)
    expect(new Set(list.items.value.map((item) => item.id)).size).toBe(25)
    expect(list.hasMore.value).toBe(false)
    expect(queries.map((query) => [query.scope, query.page])).toEqual([['HISTORY', 1], ['HISTORY', 2]])
  })

  it('没有更多时 loadMore 不发请求；连点 loadMore 只请求一次', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    await seedCancelledHistory(ctx.h.api, 25)
    const { client, queries } = recordQueries(ctx.h.api)
    const list = ctx.reservationList('HISTORY', client)
    await list.load()

    await Promise.all([list.loadMore(), list.loadMore()])
    await list.loadMore()

    expect(queries.filter((query) => query.page === 2)).toHaveLength(1)
    expect(list.items.value).toHaveLength(25)
  })

  it('refresh 重新取回所有已加载的页，不会退回第 1 页', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    await seedCancelledHistory(ctx.h.api, 25)
    const list = ctx.reservationList('HISTORY')
    await list.load()
    await list.loadMore()

    await list.refresh()

    expect(list.items.value).toHaveLength(25)
    expect(list.hasMore.value).toBe(false)
  })

  it('第 2 页开头重复出现第 1 页末尾的那条：按 id 去重，不重复显示', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    await seedCancelledHistory(ctx.h.api, 25)
    const firstPage = await ctx.h.api.listMyReservations({ scope: 'HISTORY', page: 1, pageSize: RESERVATION_PAGE_SIZE })
    const lastOfFirstPage = firstPage.items[RESERVATION_PAGE_SIZE - 1]
    if (lastOfFirstPage === undefined) {
      throw new Error('第 1 页应有 20 条')
    }
    const shifted: ApiClient = {
      ...ctx.h.api,
      listMyReservations: async (query) => {
        const page = await ctx.h.api.listMyReservations(query)
        return query?.page === 2 ? { ...page, items: [lastOfFirstPage, ...page.items] } : page
      },
    }
    const list = ctx.reservationList('HISTORY', shifted)

    await list.load()
    await list.loadMore()

    expect(list.items.value).toHaveLength(25)
    expect(new Set(list.items.value.map((item) => item.id)).size).toBe(25)
  })
})

describe('失败', () => {
  it('第一次拉取失败：failed 与错误文案；重试成功后恢复', async () => {
    const ctx = await loginAs('zhangsan', '/')
    let broken = true
    const flaky: ApiClient = { ...ctx.h.api, listMyReservations: (query) => (broken ? failure() : ctx.h.api.listMyReservations(query)) }
    const list = ctx.reservationList('CURRENT', flaky)

    await list.load()
    expect(list.phase.value).toBe('failed')
    expect(list.error.value).toBe(FAILURE_TEXT)

    broken = false
    await list.load()
    expect(list.phase.value).toBe('ready')
    expect(list.error.value).toBeNull()
    expect(list.items.value).toHaveLength(1)
  })

  it('已有内容后再拉取失败：保留原有条目，仍是 ready，只带错误文案', async () => {
    const ctx = await loginAs('zhangsan', '/')
    let broken = false
    const flaky: ApiClient = { ...ctx.h.api, listMyReservations: (query) => (broken ? failure() : ctx.h.api.listMyReservations(query)) }
    const list = ctx.reservationList('CURRENT', flaky)
    await list.load()

    broken = true
    await list.refresh()

    expect(list.items.value).toHaveLength(1)
    expect(list.phase.value).toBe('ready')
    expect(list.error.value).toBe(FAILURE_TEXT)
  })

  it('加载更多失败：保留已有条目，错误文案可见，之后还能再试', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    await seedCancelledHistory(ctx.h.api, 25)
    let broken = false
    const flaky: ApiClient = {
      ...ctx.h.api,
      listMyReservations: (query) => (broken && query?.page === 2 ? failure() : ctx.h.api.listMyReservations(query)),
    }
    const list = ctx.reservationList('HISTORY', flaky)
    await list.load()

    broken = true
    await list.loadMore()
    expect(list.items.value).toHaveLength(20)
    expect(list.error.value).toBe(FAILURE_TEXT)
    expect(list.hasMore.value).toBe(true)

    broken = false
    await list.loadMore()
    expect(list.items.value).toHaveLength(25)
    expect(list.error.value).toBeNull()
  })

  it('X1 令牌过期：回到登录页，不显示错误文案', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    const expired: ApiClient = { ...ctx.h.api, listMyReservations: () => Promise.reject(new ApiError(401, 'TOKEN_EXPIRED', 'x')) }
    const list = ctx.reservationList('HISTORY', expired)

    await list.load()

    expect(ctx.h.router.currentRoute.value.path).toBe('/login')
    expect(ctx.h.auth.isAuthenticated).toBe(false)
    expect(list.error.value).toBeNull()
  })
})
