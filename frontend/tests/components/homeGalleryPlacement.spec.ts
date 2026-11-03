// UI-6：首页图集位于预约卡片（摘要、空状态或错误提示）之后、系统公告之前；图片来自构建时生成的列表（仓库里的 public/media/gallery/）。
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import HomeView from '../../src/views/user/HomeView.vue'
import { loginAs } from '../reservations/harness'
import { useApiClient } from './apiSwap'
import { mountWithApp } from './support'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-12T01:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

async function openHome(username: string, wrap?: (api: ApiClient) => ApiClient): Promise<VueWrapper> {
  const ctx = await loginAs(username, '/')
  useApiClient(wrap === undefined ? ctx.h.api : wrap(ctx.h.api))
  const page = mountWithApp(HomeView, ctx.h)
  await flushPromises()
  return page
}

function before(a: Element, b: Element): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
}

function expectBetween(page: VueWrapper, reservationSelector: string): void {
  const reservation = page.find(reservationSelector).element
  const gallery = page.find('.home-gallery').element
  const announcements = page.find('section[aria-label="系统公告"]').element
  expect(before(reservation, gallery)).toBe(true)
  expect(before(gallery, announcements)).toBe(true)
  expect(page.findAll('.home-gallery')).toHaveLength(1)
}

describe('UI-6 图集位置', () => {
  it('有预约：摘要 → 图集 → 系统公告', async () => {
    const page = await openHome('zhangsan')
    expectBetween(page, 'section[aria-label="最近的预约"]')
    expect(page.find('.home-gallery img').attributes('src')).toMatch(/^\/media\/gallery\/[^/]+\.(jpe?g|png|webp)$/i)
  })

  it('没有预约：空状态 → 图集 → 系统公告', async () => {
    const page = await openHome('wangwu')
    expectBetween(page, '.empty')
  })

  it('预约加载失败：错误提示 → 图集 → 系统公告', async () => {
    const failure = () => Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x'))
    const page = await openHome('zhangsan', (api) => ({ ...api, listMyReservations: failure }))
    expectBetween(page, '.error')
  })

  it('加载中不显示图集', async () => {
    const ctx = await loginAs('zhangsan', '/')
    useApiClient({ ...ctx.h.api, listMyReservations: () => new Promise(() => undefined) })
    const page = mountWithApp(HomeView, ctx.h)
    expect(page.find('.home-gallery').exists()).toBe(false)
  })
})
