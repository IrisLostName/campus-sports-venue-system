// UI-3 裁决第 2 节：三层叠放（场馆 → 月历 → 时段）的键盘操作与焦点管理、31 格中只有可预约日可点、各层返回、提交流程不变。
// 页面挂到 document 上（attachTo），焦点才是真实的 document.activeElement。
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import BookingView from '../../src/views/user/BookingView.vue'
import { FREE_SLOT, TODAY, TOMORROW } from '../booking/harness'
import { loginAs } from '../reservations/harness'
import { useApiClient } from './apiSwap'
import { dateButton, pinToday, slotButton, unpinToday, venueButton } from './bookingSupport'
import { buttonByText, texts } from './support'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

let mounted: VueWrapper | null = null

beforeEach(pinToday)
afterEach(() => {
  mounted?.unmount()
  mounted = null
  unpinToday()
})

async function openAttached(wrap?: (api: ApiClient) => ApiClient) {
  const ctx = await loginAs('zhangsan', '/booking')
  useApiClient(wrap === undefined ? ctx.h.api : wrap(ctx.h.api))
  const page = mount(BookingView, { attachTo: document.body, global: { plugins: [ctx.h.auth._p, ctx.h.router] } })
  mounted = page
  await flushPromises()
  return { ctx, page }
}

const calendarLayer = (page: VueWrapper) => page.find('[role="dialog"][aria-label="选择日期"]')
const slotsLayer = (page: VueWrapper) => page.find('[role="dialog"][aria-label$="时段"]')
const baseLayer = (page: VueWrapper) => page.get('.layer-base')
const active = () => document.activeElement as HTMLElement | null

async function press(page: VueWrapper, key: string): Promise<void> {
  await page.get('[role="grid"]').trigger('keydown', { key })
  await flushPromises()
}

async function openCalendar(page: VueWrapper): Promise<void> {
  const button = venueButton(page, '网球馆')
  ;(button.element as HTMLElement).focus()
  await button.trigger('click')
  await flushPromises()
}

describe('第二层：月历弹出', () => {
  it('选定场馆后弹出“选择日期”层（role=dialog，无 aria-modal）；第一层变为 inert 并缩到层深 1；焦点落在第一个可选日期', async () => {
    const { page } = await openAttached()
    expect(calendarLayer(page).exists()).toBe(false)

    await openCalendar(page)

    const layer = calendarLayer(page)
    expect(layer.exists()).toBe(true)
    expect(layer.attributes('aria-modal')).toBeUndefined()
    expect(baseLayer(page).attributes('inert')).toBeDefined()
    expect(baseLayer(page).attributes('aria-hidden')).toBe('true')
    expect(baseLayer(page).attributes('data-depth')).toBe('1')
    expect(layer.attributes('inert')).toBeUndefined()
    expect(active()?.getAttribute('data-date')).toBe(TODAY)
    expect(page.findAll('[data-date][tabindex="0"]')).toHaveLength(1)
  })

  it('置灰日期带 aria-disabled 与指向说明的 aria-describedby；说明里的天数跟着 advanceDays 变', async () => {
    const { page } = await openAttached((api) => ({ ...api, getBookingRules: async () => ({ ...(await api.getBookingRules()), advanceDays: 3 }) }))
    await openCalendar(page)

    const off = dateButton(page, '2026-10-15')
    const hintId = off.attributes('aria-describedby') ?? ''
    expect(off.attributes('aria-disabled')).toBe('true')
    expect(page.get(`[id="${hintId}"]`).text()).toBe('可预约今天起 3 天内（含今天）的日期，其余日期暂不可预约')
    expect(dateButton(page, '2026-10-14').attributes('aria-disabled')).toBeUndefined()
    expect(dateButton(page, '2026-10-14').attributes('aria-describedby')).toBeUndefined()
  })

  it('点置灰的日期：不请求时段，仍在月历层', async () => {
    const requested: string[] = []
    const { page } = await openAttached((api) => ({ ...api, getVenueSlots: (venueId, date) => { requested.push(date); return api.getVenueSlots(venueId, date) } }))
    await openCalendar(page)

    await dateButton(page, '2026-10-19').trigger('click')
    await dateButton(page, '2026-11-11').trigger('click')
    await flushPromises()

    expect(requested).toEqual([])
    expect(slotsLayer(page).exists()).toBe(false)
    expect(calendarLayer(page).exists()).toBe(true)
  })

  it('键盘：方向键、Home/End、PageUp/PageDown 移动漫游焦点（置灰日期也能停留），Enter 选定可选日期进入时段层', async () => {
    const { page } = await openAttached()
    await openCalendar(page)

    await press(page, 'ArrowRight')
    expect(active()?.getAttribute('data-date')).toBe(TOMORROW)
    await press(page, 'ArrowDown')
    expect(active()?.getAttribute('data-date')).toBe('2026-10-20')
    expect(active()?.getAttribute('aria-disabled')).toBe('true')
    await press(page, 'Home')
    expect(active()?.getAttribute('data-date')).toBe('2026-10-19')
    await press(page, 'PageDown')
    expect(active()?.getAttribute('data-date')).toBe('2026-11-11')
    await press(page, 'PageUp')
    expect(active()?.getAttribute('data-date')).toBe(TODAY)
    await press(page, 'End')
    expect(active()?.getAttribute('data-date')).toBe('2026-10-18')
    expect(page.findAll('[data-date][tabindex="0"]').map((node) => node.attributes('data-date'))).toEqual(['2026-10-18'])

    await dateButton(page, '2026-10-18').trigger('click')
    await flushPromises()
    expect(slotsLayer(page).exists()).toBe(true)
  })
})

describe('第三层：时段层与逐层返回', () => {
  it('选定日期后时段层压在月历层上：月历 inert、层深 1，第一层层深 2；焦点落在时段层标题', async () => {
    const { page } = await openAttached()
    await openCalendar(page)
    await dateButton(page, TOMORROW).trigger('click')
    await flushPromises()

    expect(slotsLayer(page).attributes('aria-label')).toBe('网球馆 2026-10-13 周二 时段')
    expect(calendarLayer(page).attributes('inert')).toBeDefined()
    expect(calendarLayer(page).attributes('data-depth')).toBe('1')
    expect(baseLayer(page).attributes('data-depth')).toBe('2')
    expect(active()?.textContent?.trim()).toBe('网球馆')
    expect(active()?.tagName).toBe('H2')
    expect(texts(page, '.group h3')).toEqual(['网球场1', '网球场2', '网球场3', '网球场4'])
  })

  it('“更改日期”回到月历层，焦点回到刚才选的日期；“重选场馆”回到第一层，焦点回到场馆按钮', async () => {
    const { page } = await openAttached()
    await openCalendar(page)
    const day = dateButton(page, TOMORROW)
    ;(day.element as HTMLElement).focus()
    await day.trigger('click')
    await flushPromises()

    await page.get('.change-date').trigger('click')
    await flushPromises()
    expect(slotsLayer(page).exists()).toBe(false)
    expect(calendarLayer(page).attributes('inert')).toBeUndefined()
    expect(active()?.getAttribute('data-date')).toBe(TOMORROW)
    expect(page.findAll('.cell')).toHaveLength(0)

    await buttonByText(page, '重选场馆').trigger('click')
    await flushPromises()
    expect(calendarLayer(page).exists()).toBe(false)
    expect(baseLayer(page).attributes('inert')).toBeUndefined()
    expect(active()?.textContent).toContain('网球馆')
    expect(active()?.classList.contains('venue')).toBe(true)
  })

  it('Esc 只关最上层：时段层 → 月历层 → 场馆列表', async () => {
    const { page } = await openAttached()
    await openCalendar(page)
    await dateButton(page, TOMORROW).trigger('click')
    await flushPromises()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(slotsLayer(page).exists()).toBe(false)
    expect(calendarLayer(page).exists()).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(calendarLayer(page).exists()).toBe(false)
    expect(texts(page, '.venue .name')).toEqual(['网球馆', '羽毛球馆', '游泳馆'])
  })

  it('点月历层外的空白（层的底板）也回到场馆列表', async () => {
    const { page } = await openAttached()
    await openCalendar(page)

    await page.get('.layer-root').trigger('click')
    await flushPromises()

    expect(calendarLayer(page).exists()).toBe(false)
  })
})

describe('提交流程不变', () => {
  it('场馆 → 月历 → 时段 → 确认（整体替换三层）→ 成功；“继续订场”回到场馆列表', async () => {
    const { page, ctx } = await openAttached()
    await openCalendar(page)
    await dateButton(page, TOMORROW).trigger('click')
    await flushPromises()
    await slotButton(page, '网球场4', FREE_SLOT).trigger('click')
    await flushPromises()

    expect(page.find('[aria-label="确认预约"]').exists()).toBe(true)
    expect(page.find('[role="dialog"]').exists()).toBe(false)
    expect(page.find('.layer-base').exists()).toBe(false)

    await buttonByText(page, '确认预约').trigger('click')
    await flushPromises()
    expect(page.find('[aria-label="预约结果"] h2').text()).toBe('预约成功')
    expect((await ctx.h.api.listMyReservations({ scope: 'CURRENT' })).total).toBe(2)

    await buttonByText(page, '继续订场').trigger('click')
    await flushPromises()
    expect(texts(page, '.venue .name')).toEqual(['网球馆', '羽毛球馆', '游泳馆'])
    expect(page.find('[role="dialog"]').exists()).toBe(false)
  })

  it('从确认步骤“返回”：时段层直接出现（不重放弹出），焦点在时段层标题', async () => {
    const { page } = await openAttached()
    await openCalendar(page)
    await dateButton(page, TOMORROW).trigger('click')
    await flushPromises()
    await slotButton(page, '网球场4', FREE_SLOT).trigger('click')
    await flushPromises()

    await buttonByText(page, '返回').trigger('click')
    await flushPromises()

    expect(slotsLayer(page).exists()).toBe(true)
    expect(calendarLayer(page).attributes('data-depth')).toBe('1')
    expect(active()?.tagName).toBe('H2')
  })
})
