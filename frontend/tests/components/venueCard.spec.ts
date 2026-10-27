// UI-3 裁决第 1 节第一层、第 2 节：场馆宽卡片——封面与标志按静态文件约定取图、缺图占位、置顶公告、未开放预约的场馆不可进入。
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { VenueSummary } from '../../src/api/types'
import VenueCard from '../../src/components/booking/VenueCard.vue'
import BookingView from '../../src/views/user/BookingView.vue'
import { useApiClient } from './apiSwap'
import { openPage, pinToday, unpinToday, venueButton } from './bookingSupport'
import { mountWithApp, texts } from './support'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

beforeEach(pinToday)
afterEach(unpinToday)

const TENNIS: VenueSummary = {
  id: 1, name: '网球馆', venueType: 'TENNIS', location: '东区', description: null,
  operationalStatus: 'OPEN', userBookingEnabled: true, bookable: true, resourceCount: 4,
}

describe('封面与标志', () => {
  it('按约定取 /media/venues/<id>/cover.jpg 与 logo.png；图片是装饰（alt 为空）', () => {
    const card = mount(VenueCard, { props: { venue: TENNIS, pinned: null } })

    const images = card.findAll('img')
    expect(images.map((node) => node.attributes('src'))).toEqual(['/media/venues/1/cover.jpg', '/media/venues/1/logo.png'])
    expect(images.map((node) => node.attributes('alt'))).toEqual(['', ''])
    expect(card.find('[data-placeholder]').exists()).toBe(false)
  })

  it('缺图（img 触发 error）：封面换成中性占位，标志换成场馆名的第一个字；占位不给读屏', async () => {
    const card = mount(VenueCard, { props: { venue: TENNIS, pinned: null } })

    for (const image of card.findAll('img')) {
      await image.trigger('error')
    }

    expect(card.findAll('img')).toHaveLength(0)
    const cover = card.get('[data-placeholder="cover"]')
    const logo = card.get('[data-placeholder="logo"]')
    expect(cover.attributes('aria-hidden')).toBe('true')
    expect(logo.attributes('aria-hidden')).toBe('true')
    expect(logo.text()).toBe('网')
    expect(card.get('.venue .name').text()).toBe('网球馆')
  })

  it('只缺封面时只有封面换成占位，标志仍是图片', async () => {
    const card = mount(VenueCard, { props: { venue: TENNIS, pinned: null } })

    await card.get('img[src$="cover.jpg"]').trigger('error')
    await flushPromises()

    expect(card.find('[data-placeholder="cover"]').exists()).toBe(true)
    expect(card.findAll('img').map((node) => node.attributes('src'))).toEqual(['/media/venues/1/logo.png'])
  })
})

describe('卡片内容', () => {
  it('名称、场地数与位置；置顶公告在按钮之外（不并入按钮名称），role=note', () => {
    const card = mount(VenueCard, {
      props: { venue: TENNIS, pinned: { id: 9, title: '新球网已更换', content: '欢迎体验', publishedText: '2026-10-12 08:00' } },
    })

    expect(card.get('.venue .meta').text()).toBe('4 个场地 · 东区')
    const note = card.get('[role="note"]')
    expect(note.attributes('aria-label')).toBe('场馆公告')
    expect(note.text()).toContain('新球网已更换')
    expect(note.text()).toContain('欢迎体验')
    expect(card.get('button.venue').text()).not.toContain('新球网已更换')
  })

  it('没有置顶公告时不显示公告区', () => {
    const card = mount(VenueCard, { props: { venue: TENNIS, pinned: null } })

    expect(card.find('[role="note"]').exists()).toBe(false)
  })

  it('未开放预约：按钮 disabled、显示“暂未开放预约”、没有箭头；点击不发出 select', async () => {
    const closed = { ...TENNIS, id: 3, name: '游泳馆', userBookingEnabled: false, bookable: false }
    const card = mount(VenueCard, { props: { venue: closed, pinned: null } })

    await card.get('button.venue').trigger('click')

    expect(card.get('button.venue').attributes('disabled')).toBeDefined()
    expect(card.get('.venue .meta').text()).toBe('暂未开放预约')
    expect(card.find('.arrow').exists()).toBe(false)
    expect(card.emitted('select')).toBeUndefined()
  })
})

describe('整页：第一层的卡片', () => {
  it('每张卡片显示各自最新的场馆公告（含未开放预约的场馆），不显示系统公告', async () => {
    const { page, ctx } = await openPage()
    const poolAdmin = await ctx.h.clientFor('admin_pool')
    await poolAdmin.adminCreateAnnouncement({ scope: 'VENUE', venueId: 3, title: '游泳馆检修', content: '本周停开' })
    page.unmount()
    useApiClient(ctx.h.api)
    const again = { page: mountWithApp(BookingView, ctx.h) }
    await flushPromises()

    expect(texts(again.page, '[data-venue-id="1"] .pinned-title')).toEqual(['场地保养：每周一 08:00–09:30 视情况关闭 1 片球场'])
    expect(texts(again.page, '[data-venue-id="2"] .pinned-title')).toEqual([])
    expect(texts(again.page, '[data-venue-id="3"] .pinned-title')).toEqual(['游泳馆检修'])
    expect(again.page.text()).not.toContain('欢迎使用校园场馆预约系统')
  })

  it('未开放预约的场馆点了不弹出月历层', async () => {
    const { page } = await openPage()

    await venueButton(page, '游泳馆').trigger('click')
    await flushPromises()

    expect(page.find('[role="dialog"]').exists()).toBe(false)
    expect(page.get('.layer-base').attributes('inert')).toBeUndefined()
  })
})
