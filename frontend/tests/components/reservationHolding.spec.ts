// UI-4 “预约”页：标题行右侧“＋ 新建预约”始终显示；下面一行是同时持有数与上限（上限取自 BookingRules，不写死），
// 达上限时改为提示但按钮仍可点；规则或列表取不到时不显示这一行。计数口径与后端第 7 步相同（CONFIRMED 且未结束）。
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import ReservationView from '../../src/views/user/ReservationView.vue'
import { checkInByScan } from '../api/support/harness'
import { at, loginAs, type UserContext } from '../reservations/harness'
import { useApiClient } from './apiSwap'
import { buttonByText, mountWithApp } from './support'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

interface OpenOptions {
  username?: string
  at?: string
  wrap?: (api: ApiClient) => ApiClient
  prepare?: (ctx: UserContext) => Promise<void>
}

async function openPage(options: OpenOptions = {}): Promise<{ ctx: UserContext; page: VueWrapper }> {
  const ctx = await loginAs(options.username ?? 'zhangsan', '/reservation')
  if (options.at !== undefined) {
    await ctx.travelTo(options.at)
  }
  await options.prepare?.(ctx)
  useApiClient(options.wrap === undefined ? ctx.h.api : options.wrap(ctx.h.api))
  const page = mountWithApp(ReservationView, ctx.h)
  await flushPromises()
  return { ctx, page }
}

function badge(page: VueWrapper): string {
  return page.find('article .badge').text()
}

const extra = (startTime: string) => async ({ h }: UserContext) => {
  await h.api.createReservation({ resourceId: 2, serviceDate: '2026-10-13', startTime })
}

describe('UI-4 新建预约与同时持有上限', () => {
  it('有预约：标题右侧“＋ 新建预约”指向 /booking；“当前 1 个预约，最多可同时持有 3 个”（mock 规则 3）', async () => {
    const { page } = await openPage()

    expect(page.find('.head a.new').text()).toBe('＋ 新建预约')
    expect(page.find('.head a.new').attributes('href')).toBe('/booking')
    expect(page.find('.limit').text()).toBe('当前 1 个预约，最多可同时持有 3 个')
  })

  it('没有预约：按钮照常显示，计数为 0；空状态的“去订场”也在', async () => {
    const { page } = await openPage({ username: 'wangwu' })

    expect(page.find('.head a.new').attributes('href')).toBe('/booking')
    expect(page.find('.limit').text()).toBe('当前 0 个预约，最多可同时持有 3 个')
    expect(page.find('.empty a').text()).toBe('去订场')
  })

  it('上限来自 BookingRules，不写死：规则给 5 时显示 5', async () => {
    const { page } = await openPage({
      wrap: (api) => ({ ...api, getBookingRules: async () => ({ ...(await api.getBookingRules()), maxActiveReservationsPerUser: 5 }) }),
    })

    expect(page.find('.limit').text()).toBe('当前 1 个预约，最多可同时持有 5 个')
  })

  it('达到上限：改为“已达同时持有上限（3 个）…”，“＋ 新建预约”仍可点（链接，无 disabled）', async () => {
    const { page } = await openPage({
      prepare: async (ctx) => { await extra('11:00')(ctx); await extra('12:30')(ctx) },
    })

    expect(page.findAll('article')).toHaveLength(3)
    expect(page.find('.limit').text()).toBe('已达同时持有上限（3 个），取消一个预约后才能新建')
    const button = page.find('.head a.new')
    expect(button.attributes('href')).toBe('/booking')
    expect(button.attributes('aria-disabled')).toBeUndefined()
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it('超过上限（规则调小后）也显示达上限文字', async () => {
    const { page } = await openPage({
      prepare: extra('11:00'),
      wrap: (api) => ({ ...api, getBookingRules: async () => ({ ...(await api.getBookingRules()), maxActiveReservationsPerUser: 1 }) }),
    })

    expect(page.find('.limit').text()).toBe('已达同时持有上限（1 个），取消一个预约后才能新建')
  })

  it('在本页取消一个后：已取消的卡片不再计入，回到“当前 N 个”', async () => {
    const { page } = await openPage({
      prepare: async (ctx) => { await extra('11:00')(ctx); await extra('12:30')(ctx) },
    })
    await page.findAll('article')[0]?.findAll('button').find((button) => button.text() === '取消预约')?.trigger('click')
    await buttonByText(page, '确认取消').trigger('click')
    await flushPromises()

    expect(page.findAll('article').map((card) => card.find('.badge').text())).toContain('已取消')
    expect(page.find('.limit').text()).toBe('当前 2 个预约，最多可同时持有 3 个')
  })

  it('已签到（使用中）仍占名额', async () => {
    const { page } = await openPage({
      at: at('07:50'),
      prepare: async ({ h }) => { await checkInByScan(h.api, await h.clientFor('sysadmin'), 1) },
    })

    expect(badge(page)).toBe('使用中')
    expect(page.find('.limit').text()).toBe('当前 1 个预约，最多可同时持有 3 个')
  })

})

// 审计 F1：每页 20 条，未取得的页也计入 N（total − 已取得条数），不能只数已加载的条目。
describe('UI-4 计数包含未加载的页', () => {
  const pagedTotal = (api: ApiClient): ApiClient['listMyReservations'] => async (query) => ({
    ...(await api.listMyReservations(query)), total: 25,
  })

  it('total 25、只加载 1 条，上限 30：“当前 25 个预约，最多可同时持有 30 个”', async () => {
    const { page } = await openPage({
      wrap: (api) => ({
        ...api,
        listMyReservations: pagedTotal(api),
        getBookingRules: async () => ({ ...(await api.getBookingRules()), maxActiveReservationsPerUser: 30 }),
      }),
    })

    expect(page.findAll('article')).toHaveLength(1)
    expect(page.find('.limit').text()).toBe('当前 25 个预约，最多可同时持有 30 个')
  })

  it('total 25、只加载 1 条，上限 3：显示达上限文字', async () => {
    const { page } = await openPage({ wrap: (api) => ({ ...api, listMyReservations: pagedTotal(api) }) })

    expect(page.findAll('article')).toHaveLength(1)
    expect(page.find('.limit').text()).toBe('已达同时持有上限（3 个），取消一个预约后才能新建')
  })
})

describe('UI-4 不可用时不显示持有提示', () => {
  it('规则取不到：不显示这一行，按钮照常', async () => {
    const { page } = await openPage({
      wrap: (api) => ({ ...api, getBookingRules: () => Promise.reject(new Error('boom')) }),
    })

    expect(page.find('.limit').exists()).toBe(false)
    expect(page.find('.head a.new').exists()).toBe(true)
  })

  it('列表取不到：不显示这一行，按钮照常', async () => {
    const { page } = await openPage({
      wrap: (api) => ({ ...api, listMyReservations: () => Promise.reject(new Error('boom')) }),
    })

    expect(page.find('.limit').exists()).toBe(false)
    expect(page.find('.head a.new').exists()).toBe(true)
  })
})
