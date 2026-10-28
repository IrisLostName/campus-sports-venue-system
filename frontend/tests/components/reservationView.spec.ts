// FE-3 “预约”页（挂载整页，数据来自 mock 与注入时钟）：按钮表在页面上的实际结果、操作进行中全部按钮禁用、取消确认层的打开/关闭/提交。
// P2-1c：“签到”改为“出示签到码”（打开签到码浮层）；已签到的前置状态由管理员扫码（checkInByScan）完成。
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import type { Reservation } from '../../src/api/types'
import ReservationView from '../../src/views/user/ReservationView.vue'
import { deferred } from '../display/support'
import { checkInByScan } from '../api/support/harness'
import { at, loginAs, type UserContext } from '../reservations/harness'
import { useApiClient } from './apiSwap'
import { buttonByText, mountWithApp, texts } from './support'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

interface OpenOptions {
  username?: string
  // 先把时钟拨到这个时刻再进入页面（07:45 起可签到）。
  at?: string
  wrap?: (api: ApiClient) => ApiClient
  // 进入页面之前先准备数据。
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

function buttonLabels(page: VueWrapper): string[] {
  return texts(page, 'article button')
}

function badge(page: VueWrapper): string {
  return page.find('article .badge').text()
}

describe('页面上的按钮表（ACC-M2-06）', () => {
  it('预约尚未开始、不在签到窗口：显示卡片内容、“出示签到码”与“取消预约”，没有签退', async () => {
    const { page } = await openPage()

    expect(page.find('h1').text()).toBe('预约')
    expect(page.findAll('article')).toHaveLength(1)
    expect(page.find('article h2').text()).toBe('网球馆 · 网球场1')
    expect(texts(page, 'article dd')).toEqual(['2026-10-13 周二', '08:00–09:30', '张三'])
    expect(badge(page)).toBe('待使用')
    expect(buttonLabels(page)).toEqual(['出示签到码', '取消预约'])
    expect(texts(page, '.notes li')).toEqual([
      '签到：开始前 15 分钟至开始后 15 分钟内，向工作人员出示签到码签到；结束后 30 分钟内可签退',
      '取消：开始前至少 120 分钟可取消',
    ])
  })

  it('进入签到窗口：只有“出示签到码”，没有“取消预约”（B1）', async () => {
    const { page } = await openPage({ at: at('07:50') })

    expect(badge(page)).toBe('可签到')
    expect(buttonLabels(page)).toEqual(['出示签到码'])
  })

  it('点“出示签到码”打开签到码浮层，不签到；管理员扫码后关闭浮层，卡片按服务端状态变为使用中，只剩“签退”', async () => {
    const { page, ctx } = await openPage({ at: at('07:50') })
    await buttonByText(page, '出示签到码').trigger('click')
    await flushPromises()
    await vi.dynamicImportSettled()
    await flushPromises()

    expect(page.find('[data-checkin-sheet] [role="dialog"]').exists()).toBe(true)
    expect((await ctx.h.api.getReservation(1)).checkInAt).toBeNull()
    await checkInByScan(ctx.h.api, await ctx.h.clientFor('sysadmin'), 1)
    await page.get('[data-checkin-sheet] button[aria-label="关闭"]').trigger('click')
    await flushPromises()

    expect(badge(page)).toBe('使用中')
    expect(buttonLabels(page)).toEqual(['签退'])
  })

  it('点“签退”后：预约结束前签退，卡片变为已签退，不再有按钮', async () => {
    const { page, ctx } = await openPage({
      at: at('07:50'),
      prepare: async ({ h }) => { await checkInByScan(h.api, await h.clientFor('sysadmin'), 1) },
    })
    // 钟固定在 08:05：预约 08:00–09:30 尚未结束，所以签退后展示状态是 CHECKED_OUT（已签退），不会是 COMPLETED。
    ctx.h.clock.set(at('08:05'))
    await buttonByText(page, '签退').trigger('click')
    await flushPromises()

    expect((await ctx.h.api.getReservation(1)).checkOutAt).not.toBeNull()
    expect(buttonLabels(page)).toEqual([])
    expect(badge(page)).toBe('已签退')
  })

  it('没有 CURRENT 预约：显示“暂无当前预约”，入口指向 /booking', async () => {
    const { page } = await openPage({ username: 'wangwu' })

    expect(page.findAll('article')).toHaveLength(0)
    expect(page.find('.empty p').text()).toBe('暂无当前预约')
    expect(page.find('.empty a').text()).toBe('去订场')
    expect(page.find('.empty a').attributes('href')).toBe('/booking')
  })
})

describe('取消确认层：打开、关闭、提交（B2）', () => {
  it('点“取消预约”只打开确认层，不取消；“再想想”关闭，预约不变', async () => {
    const { page, ctx } = await openPage()
    expect(page.find('[role="dialog"]').exists()).toBe(false)

    await buttonByText(page, '取消预约').trigger('click')
    const dialog = page.find('[role="dialog"]')
    expect(dialog.exists()).toBe(true)
    expect(dialog.find('h2').text()).toBe('确认取消预约？')
    expect(dialog.find('.what').text()).toContain('网球馆 · 网球场1')
    expect((await ctx.h.api.getReservation(1)).status).toBe('CONFIRMED')

    await buttonByText(page, '再想想').trigger('click')
    expect(page.find('[role="dialog"]').exists()).toBe(false)
    expect((await ctx.h.api.getReservation(1)).status).toBe('CONFIRMED')
    expect(badge(page)).toBe('待使用')
  })

  it('FE-8 L5 原因输入框 maxlength=200；按 Esc 关闭确认层，预约不变，也没有发出取消请求', async () => {
    const { page, ctx } = await openPage()
    await buttonByText(page, '取消预约').trigger('click')

    expect(page.get('[role="dialog"] textarea').attributes('maxlength')).toBe('200')
    await page.get('[role="dialog"] textarea').setValue('临时有事')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()

    expect(page.find('[role="dialog"]').exists()).toBe(false)
    expect(badge(page)).toBe('待使用')
    expect((await ctx.h.api.getReservation(1)).status).toBe('CONFIRMED')
    // 重新打开时上次输入的原因已被清空。
    await buttonByText(page, '取消预约').trigger('click')
    expect((page.get('[role="dialog"] textarea').element as HTMLTextAreaElement).value).toBe('')
    page.unmount()
  })

  it('填写原因并确认：确认层消失，卡片变为已取消且没有按钮，原因随请求提交', async () => {
    const { page, ctx } = await openPage()
    await buttonByText(page, '取消预约').trigger('click')
    await page.find('textarea').setValue('  临时有事  ')
    await buttonByText(page, '确认取消').trigger('click')
    await flushPromises()

    expect(page.find('[role="dialog"]').exists()).toBe(false)
    expect(badge(page)).toBe('已取消')
    expect(buttonLabels(page)).toEqual([])
    expect(await ctx.h.api.getReservation(1)).toMatchObject({ status: 'CANCELLED', cancelReason: '临时有事' })
  })

  it('再次打开确认层时，上一次填写的原因已清空', async () => {
    const { page } = await openPage()
    await buttonByText(page, '取消预约').trigger('click')
    await page.find('textarea').setValue('先随便写点')
    await buttonByText(page, '再想想').trigger('click')
    await buttonByText(page, '取消预约').trigger('click')

    expect((page.find('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('取消失败：确认层关闭，卡片上显示错误文案，预约仍在', async () => {
    const { page } = await openPage({
      wrap: (api) => ({ ...api, cancelReservation: () => Promise.reject(new Error('boom')) }),
    })
    await buttonByText(page, '取消预约').trigger('click')
    await buttonByText(page, '确认取消').trigger('click')
    await flushPromises()

    expect(page.find('[role="dialog"]').exists()).toBe(false)
    expect(page.find('article [role="alert"]').text()).toBe('服务器开小差了，请稍后再试')
    expect(buttonLabels(page)).toEqual(['出示签到码', '取消预约'])
  })
})

describe('操作进行中：所有卡片的按钮都不可用', () => {
  async function pendingCancel() {
    const pending = deferred<Reservation>()
    const { page, ctx } = await openPage({
      wrap: (api) => ({ ...api, cancelReservation: () => pending.promise }),
      prepare: async ({ h }) => {
        await h.api.createReservation({ resourceId: 2, serviceDate: '2026-10-13', startTime: '11:00' })
      },
    })
    return { page, ctx, pending }
  }

  it('取消请求未返回时：处理中的卡片显示“处理中…”，两张卡片的按钮都有 disabled；返回后恢复', async () => {
    const { page, ctx, pending } = await pendingCancel()
    expect(page.findAll('article')).toHaveLength(2)

    await page.findAll('article')[0]?.findAll('button').find((button) => button.text() === '取消预约')?.trigger('click')
    await buttonByText(page, '确认取消').trigger('click')
    await flushPromises()

    const cards = page.findAll('article')
    expect(cards.map((card) => card.findAll('button').map((button) => button.text()))).toEqual([['处理中…', '处理中…'], ['出示签到码', '取消预约']])
    expect(cards.flatMap((card) => card.findAll('button')).every((button) => button.attributes('disabled') !== undefined)).toBe(true)

    pending.resolve(await ctx.h.api.cancelReservation(1, {}))
    await flushPromises()

    expect(page.findAll('article').map((card) => card.find('.badge').text())).toEqual(['已取消', '待使用'])
    expect(page.findAll('article').flatMap((card) => card.findAll('button'))).toHaveLength(2)
    expect(page.find('article:nth-of-type(2) button').attributes('disabled')).toBeUndefined()
  })
})

// 审计 N4：关闭签到码浮层并刷新后，焦点落在该预约卡片上（原“出示签到码”按钮已被扫码换成“签退”时给“签退”），不落到 body。
describe('关闭签到码浮层后的焦点', () => {
  async function openAttached() {
    const ctx = await loginAs('zhangsan', '/reservation')
    await ctx.travelTo(at('07:50'))
    useApiClient(ctx.h.api)
    const page = mount(ReservationView, { global: { plugins: [ctx.h.auth._p, ctx.h.router] }, attachTo: document.body })
    await flushPromises()
    const opener = buttonByText(page, '出示签到码')
    ;(opener.element as HTMLButtonElement).focus()
    await opener.trigger('click')
    await flushPromises()
    await vi.dynamicImportSettled()
    await flushPromises()
    return { ctx, page, opener }
  }

  async function closeSheet(page: VueWrapper): Promise<void> {
    await page.get('[data-checkin-sheet] button[aria-label="关闭"]').trigger('click')
    await flushPromises()
  }

  it('已被扫码：原按钮不在了，焦点落到该卡片的“签退”按钮', async () => {
    const { ctx, page } = await openAttached()
    await checkInByScan(ctx.h.api, await ctx.h.clientFor('sysadmin'), 1)
    await closeSheet(page)

    expect(buttonLabels(page)).toEqual(['签退'])
    expect(document.activeElement).not.toBe(document.body)
    expect(document.activeElement).toBe(buttonByText(page, '签退').element)
    page.unmount()
  })

  it('未被扫码：焦点回到原来的“出示签到码”按钮', async () => {
    const { page, opener } = await openAttached()
    await closeSheet(page)

    expect(document.activeElement).toBe(opener.element)
    page.unmount()
  })
})
