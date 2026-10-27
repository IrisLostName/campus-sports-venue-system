// FE-4 “订场”页的确认与提交（ACC-M2-04，B7、B8、X1）：确认步骤、防重复提交、成功结果、失败文案、登录失效。
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Reservation } from '../../src/api/types'
import ReservationView from '../../src/views/user/ReservationView.vue'
import { FREE_SLOT, TOMORROW } from '../booking/harness'
import { deferred } from '../display/support'
import { changeDate, openPage, pickFreeSlot, pinToday, slotButton, unpinToday } from './bookingSupport'
import { buttonByText, mountWithApp, texts } from './support'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

beforeEach(pinToday)
afterEach(unpinToday)

describe('确认与提交（B7）', () => {
  it('选中时段后显示场馆、场地、日期、时间；用途输入框 maxlength=200', async () => {
    const { page } = await openPage()
    await pickFreeSlot(page)

    const confirm = page.find('[aria-label="确认预约"]')
    expect(confirm.exists()).toBe(true)
    expect(texts(page, '[aria-label="确认预约"] dd')).toEqual(['网球馆', '网球场4', '2026-10-13 周二', '11:00–12:30'])
    expect(confirm.find('input').attributes('maxlength')).toBe('200')
    expect(page.find('[aria-label="选择日期"]').exists()).toBe(false)
  })

  it('“返回”回到时段列表，不提交', async () => {
    const { page, ctx } = await openPage()
    await pickFreeSlot(page)
    await buttonByText(page, '返回').trigger('click')

    expect(page.find('[aria-label="确认预约"]').exists()).toBe(false)
    expect(page.findAll('.cell').length).toBeGreaterThan(0)
    expect((await ctx.h.api.listMyReservations({ scope: 'CURRENT' })).total).toBe(1)
  })

  it('提交进行中：按钮显示“提交中…”且不可点，连点只提交一次', async () => {
    const pending = deferred<Reservation>()
    let calls = 0
    const { page, ctx } = await openPage({
      wrap: (api) => ({ ...api, createReservation: () => { calls += 1; return pending.promise } }),
    })
    await pickFreeSlot(page)

    const submit = buttonByText(page, '确认预约')
    await submit.trigger('click')
    await submit.trigger('click')
    const busy = buttonByText(page, '提交中…')
    expect(busy.attributes('disabled')).toBeDefined()
    expect(buttonByText(page, '返回').attributes('disabled')).toBeDefined()

    pending.resolve(await ctx.h.api.createReservation({ resourceId: 4, serviceDate: TOMORROW, startTime: FREE_SLOT }))
    await flushPromises()

    expect(calls).toBe(1)
    expect(page.find('[aria-label="预约结果"]').exists()).toBe(true)
  })
})

describe('ACC-M2-04 成功结果', () => {
  it('张三订网球馆明天网球场4的 11:00：显示成功结果与“查看预约”“回到首页”；新预约出现在“预约”页的当前列表', async () => {
    const { page, ctx } = await openPage()
    await pickFreeSlot(page)
    await page.find('input').setValue('网球训练')
    await buttonByText(page, '确认预约').trigger('click')
    await flushPromises()

    const result = page.find('[aria-label="预约结果"]')
    expect(result.find('h2').text()).toBe('预约成功')
    expect(texts(page, '[aria-label="预约结果"] dd')).toEqual(['网球馆 · 网球场4', '2026-10-13 周二', '11:00–12:30', '待使用'])
    const links = result.findAll('a')
    expect(links.map((link) => [link.text(), link.attributes('href')])).toEqual([['查看预约', '/reservation'], ['回到首页', '/']])
    expect(page.find('[aria-label="确认预约"]').exists()).toBe(false)

    await links[0]?.trigger('click')
    await flushPromises()
    expect(ctx.h.router.currentRoute.value.path).toBe('/reservation')

    const reservations = mountWithApp(ReservationView, ctx.h)
    await flushPromises()
    expect(texts(reservations, 'article h2')).toEqual(['网球馆 · 网球场1', '网球馆 · 网球场4'])
    expect(texts(reservations, 'article dd')).toContain('网球训练')
  })

  it('“继续订场”回到场馆列表', async () => {
    const { page } = await openPage()
    await pickFreeSlot(page)
    await buttonByText(page, '确认预约').trigger('click')
    await flushPromises()
    await buttonByText(page, '继续订场').trigger('click')
    await flushPromises()

    expect(page.find('[aria-label="预约结果"]').exists()).toBe(false)
    expect(texts(page, '.venue .name')).toEqual(['网球馆', '羽毛球馆', '游泳馆'])
  })
})

describe('失败文案（B8）', () => {
  it('SLOT_TAKEN：李四先订走 → 页面提示该文案，重新拉取后该时段显示“已被预约”且不可点', async () => {
    const { page, ctx } = await openPage()
    await pickFreeSlot(page)
    const lisi = await ctx.h.clientFor('lisi')
    await lisi.createReservation({ resourceId: 4, serviceDate: TOMORROW, startTime: FREE_SLOT })

    await buttonByText(page, '确认预约').trigger('click')
    await flushPromises()

    expect(page.find('[role="alert"]').text()).toBe('该时段刚刚被别人预约了，请重新选择')
    const cell = slotButton(page, '网球场4', FREE_SLOT)
    expect(cell.find('.label').text()).toBe('已被预约')
    expect(cell.attributes('disabled')).toBeDefined()
    expect(page.find('[aria-label="确认预约"]').exists()).toBe(false)
  })

  it('提交失败回到时段列表后，重复点击已选中的日期：清掉错误横幅并重新拉取时段（与 main 一致）', async () => {
    let slotRequests = 0
    const { page, ctx } = await openPage({
      wrap: (api) => ({ ...api, getVenueSlots: (venueId, date) => { slotRequests += 1; return api.getVenueSlots(venueId, date) } }),
    })
    await pickFreeSlot(page)
    const lisi = await ctx.h.clientFor('lisi')
    await lisi.createReservation({ resourceId: 4, serviceDate: TOMORROW, startTime: FREE_SLOT })
    await buttonByText(page, '确认预约').trigger('click')
    await flushPromises()
    expect(page.find('[role="alert"]').text()).toBe('该时段刚刚被别人预约了，请重新选择')
    const requestsBefore = slotRequests

    await changeDate(page, TOMORROW)                    // UI-3：经“更改日期”回到月历再选同一天

    expect(page.find('[role="alert"]').exists()).toBe(false)
    expect(page.find('[aria-label="确认预约"]').exists()).toBe(false)
    expect(slotRequests).toBe(requestsBefore + 1)
  })

  it('BOOKING_LIMIT_REACHED：已持有 3 个 → 页面提示该文案，仍可返回', async () => {
    const { page, ctx } = await openPage()
    await ctx.h.api.createReservation({ resourceId: 3, serviceDate: TOMORROW, startTime: '14:00' })
    await ctx.h.api.createReservation({ resourceId: 3, serviceDate: TOMORROW, startTime: '15:30' })
    await pickFreeSlot(page)
    await buttonByText(page, '确认预约').trigger('click')
    await flushPromises()

    expect(page.find('[aria-label="确认预约"] [role="alert"]').text()).toBe('已达同时持有预约数上限')
    expect(page.find('[aria-label="预约结果"]').exists()).toBe(false)
  })

  it('DATE_OUT_OF_RANGE：服务端时钟已过几天 → 页面提示该文案', async () => {
    const { page, ctx } = await openPage()
    await pickFreeSlot(page)
    await ctx.travelTo('2026-10-20T09:00:00')
    await buttonByText(page, '确认预约').trigger('click')
    await flushPromises()

    expect(texts(page, '[role="alert"]')).toContain('超出可预约日期范围')
    expect(page.find('[aria-label="预约结果"]').exists()).toBe(false)
  })
})

describe('X1 登录失效', () => {
  it('提交时 TOKEN_EXPIRED：回到登录页，页面上没有错误提示', async () => {
    const { page, ctx } = await openPage()
    await pickFreeSlot(page)
    ctx.h.clock.set('2026-10-12T18:00:00')
    await buttonByText(page, '确认预约').trigger('click')
    await flushPromises()

    expect(ctx.h.router.currentRoute.value.path).toBe('/login')
    expect(ctx.h.auth.notice).toBe('登录已过期，请重新登录')
    expect(page.find('[role="alert"]').exists()).toBe(false)
  })
})
