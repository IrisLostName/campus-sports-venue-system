// FE-3 首页（FE-3-rulings P2；ACC-M2-02、ACC-M2-03）：摘要先于公告、“还有 N 个预约”链接、空状态入口。
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import HomeView from '../../src/views/user/HomeView.vue'
import { loginAs, TOMORROW } from '../reservations/harness'
import { useApiClient } from './apiSwap'
import { mountWithApp, texts } from './support'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

async function openHome(username: string, options: { extra?: number; wrap?: (api: ApiClient) => ApiClient } = {}): Promise<VueWrapper> {
  const ctx = await loginAs(username, '/')
  const extraSlots = ['11:00', '12:30']
  for (const startTime of extraSlots.slice(0, options.extra ?? 0)) {
    await ctx.h.api.createReservation({ resourceId: 2, serviceDate: TOMORROW, startTime })
  }
  useApiClient(options.wrap === undefined ? ctx.h.api : options.wrap(ctx.h.api))
  const page = mountWithApp(HomeView, ctx.h)
  await flushPromises()
  return page
}

function sectionLabels(page: VueWrapper): (string | undefined)[] {
  return page.findAll('section[aria-label]').map((section) => section.attributes('aria-label'))
}

describe('ACC-M2-02 有预约', () => {
  it('摘要显示日期、时间、地点、预约人与状态，且排在系统公告之前', async () => {
    const page = await openHome('zhangsan')

    expect(page.find('h1').text()).toBe('首页')
    expect(sectionLabels(page)).toEqual(['最近的预约', '系统公告'])
    const summary = page.find('section[aria-label="最近的预约"]')
    expect(summary.find('.when').text()).toContain('2026-10-13 周二')
    expect(summary.find('.when strong').text()).toBe('08:00–09:30')
    expect(summary.find('.where').text()).toBe('网球馆 · 网球场1')
    expect(summary.find('.who span').text()).toBe('张三')
    expect(summary.find('.badge').text()).toBe('待使用')
    expect(summary.find('a.detail').attributes('href')).toBe('/reservation')
  })

  it('系统公告：标题与发布时间；正文与标题相同时不重复；不显示空状态', async () => {
    const page = await openHome('zhangsan')
    const announcements = page.find('section[aria-label="系统公告"]')

    expect(announcements.find('h2').text()).toBe('系统公告')
    expect(texts(page, 'section[aria-label="系统公告"] article h3')).toEqual(['欢迎使用校园场馆预约系统'])
    expect(announcements.find('article .content').exists()).toBe(false)
    expect(announcements.find('article .time').text()).toBe('2026-10-12 09:00')
    expect(page.find('.empty').exists()).toBe(false)
  })

  it('只有 1 条预约：没有“还有 N 个预约”', async () => {
    const page = await openHome('zhangsan')

    expect(page.find('.more').exists()).toBe(false)
    expect(page.text()).not.toContain('还有')
  })

  it('2 条预约：显示“还有 1 个预约”，链接指向 /reservation', async () => {
    const page = await openHome('zhangsan', { extra: 1 })
    const more = page.find('.more a')

    expect(more.text()).toBe('还有 1 个预约')
    expect(more.attributes('href')).toBe('/reservation')
  })

  it('3 条预约：显示“还有 2 个预约”，摘要仍是开始最早的一条', async () => {
    const page = await openHome('zhangsan', { extra: 2 })

    expect(page.find('.more a').text()).toBe('还有 2 个预约')
    expect(page.find('section[aria-label="最近的预约"] .when strong').text()).toBe('08:00–09:30')
    expect(page.findAll('section[aria-label="最近的预约"]')).toHaveLength(1)
  })
})

describe('ACC-M2-03 没有预约', () => {
  it('显示“你还没有预约”和指向 /booking 的“去订场”；公告区照常显示；没有摘要', async () => {
    const page = await openHome('wangwu')

    expect(page.find('.empty p').text()).toBe('你还没有预约')
    expect(page.find('.empty a').text()).toBe('去订场')
    expect(page.find('.empty a').attributes('href')).toBe('/booking')
    expect(sectionLabels(page)).toEqual(['系统公告'])
    expect(texts(page, 'section[aria-label="系统公告"] article h3')).toEqual(['欢迎使用校园场馆预约系统'])
  })
})

describe('加载失败', () => {
  const failure = () => Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x'))

  it('预约列表失败：显示错误与“重试”而不是空状态；公告不受影响', async () => {
    const page = await openHome('zhangsan', { wrap: (api) => ({ ...api, listMyReservations: failure }) })

    expect(page.find('.error p').text()).toBe('服务器开小差了，请稍后再试')
    expect(texts(page, '.error button')).toEqual(['重试'])
    expect(page.find('.empty').exists()).toBe(false)
    expect(page.find('section[aria-label="最近的预约"]').exists()).toBe(false)
    expect(texts(page, 'section[aria-label="系统公告"] article h3')).toEqual(['欢迎使用校园场馆预约系统'])
  })

  it('公告失败：摘要照常显示，公告区给出错误文案', async () => {
    const page = await openHome('zhangsan', { wrap: (api) => ({ ...api, listAnnouncements: failure }) })

    expect(page.find('section[aria-label="最近的预约"]').exists()).toBe(true)
    expect(page.find('section[aria-label="系统公告"] [role="alert"]').text()).toBe('公告加载失败：服务器开小差了，请稍后再试')
    expect(page.find('section[aria-label="系统公告"] article').exists()).toBe(false)
  })
})
