// FE-4 “我的”页（挂载整页，数据来自 mock 与注入时钟）：用户资料、历史预约与加载更多、历史里签退、报修、退出登录、登录失效。
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import type { CreateRepairRequest } from '../../src/api/requests'
import MeView from '../../src/views/user/MeView.vue'
import { at, loginAs, type UserContext } from '../reservations/harness'
import { seedCancelledHistory } from '../reservations/history'
import { useApiClient } from './apiSwap'
import { mountWithApp, texts } from './support'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

interface OpenOptions {
  username?: string
  wrap?: (api: ApiClient) => ApiClient
  prepare?: (ctx: UserContext) => Promise<void>
}

async function openPage(options: OpenOptions = {}): Promise<{ ctx: UserContext; page: VueWrapper }> {
  const ctx = await loginAs(options.username ?? 'zhangsan', '/me')
  await options.prepare?.(ctx)
  useApiClient(options.wrap === undefined ? ctx.h.api : options.wrap(ctx.h.api))
  const page = mountWithApp(MeView, ctx.h)
  await flushPromises()
  return { ctx, page }
}

// 在某个区块里找文字完全等于 text 的按钮（找不到时抛错）。
function buttonIn(page: VueWrapper, scope: string, text: string) {
  const button = page.findAll(`${scope} button`).find((node) => node.text() === text)
  if (button === undefined) {
    throw new Error(`在 ${scope} 里找不到按钮“${text}”`)
  }
  return button
}

const history = (page: VueWrapper) => page.find('section[aria-label="历史预约"]')
const repairs = (page: VueWrapper) => page.find('section[aria-label="报修"]')

describe('M1 用户资料', () => {
  it('显示姓名、用户名、身份；手机号为空显示“未填写”', async () => {
    const { page } = await openPage()
    const profile = page.find('section[aria-label="用户资料"]')

    expect(page.find('h1').text()).toBe('我的')
    expect(profile.find('h2').text()).toBe('张三')
    expect(texts(page, 'section[aria-label="用户资料"] dd')).toEqual(['zhangsan', '学生', '未填写'])
  })

  it('教师显示“教师”', async () => {
    const { page } = await openPage({ username: 'wangwu' })

    expect(texts(page, 'section[aria-label="用户资料"] dd')).toEqual(['wangwu', '教师', '未填写'])
  })

  it('手机号有值时显示原值', async () => {
    const { page } = await openPage({
      prepare: async (ctx) => {
        const user = ctx.h.auth.user
        if (user !== null) {
          user.phone = '13800000000'
        }
      },
    })

    expect(texts(page, 'section[aria-label="用户资料"] dd')).toEqual(['zhangsan', '学生', '13800000000'])
  })

  it('M4 退出登录：按钮在资料区块里，点击后回到登录页并清除登录状态；不再有“由 FE-4 实现”占位', async () => {
    const { page, ctx } = await openPage()
    expect(page.text()).not.toContain('由 FE-4 实现')

    await buttonIn(page, 'section[aria-label="用户资料"]', '退出登录').trigger('click')
    await flushPromises()

    expect(ctx.h.router.currentRoute.value.path).toBe('/login')
    expect(ctx.h.auth.isAuthenticated).toBe(false)
  })
})

describe('M2 历史预约', () => {
  it('没有历史预约：显示“暂无历史预约”，没有“加载更多”', async () => {
    const { page } = await openPage()

    expect(history(page).find('.hint').text()).toBe('暂无历史预约')
    expect(history(page).findAll('article')).toHaveLength(0)
    expect(history(page).find('.more').exists()).toBe(false)
  })

  it('取消过的预约出现在历史里：卡片显示“已取消”，没有按钮', async () => {
    const { page } = await openPage({ prepare: async (ctx) => { await ctx.h.api.cancelReservation(1, {}) } })
    const cards = history(page).findAll('article')

    expect(cards).toHaveLength(1)
    expect(cards[0]?.find('h2').text()).toBe('网球馆 · 网球场1')
    expect(cards[0]?.find('.badge').text()).toBe('已取消')
    expect(cards[0]?.findAll('button')).toHaveLength(0)
    expect(history(page).find('.hint').exists()).toBe(false)
  })

  it('25 条历史：先显示 20 条和“加载更多”，点后显示 25 条且按钮消失', async () => {
    const { page } = await openPage({ prepare: async (ctx) => { await seedCancelledHistory(ctx.h.api, 25) } })
    expect(history(page).findAll('article')).toHaveLength(20)

    await history(page).find('.more').trigger('click')
    await flushPromises()

    expect(history(page).findAll('article')).toHaveLength(25)
    expect(history(page).find('.more').exists()).toBe(false)
  })

  it('已完成、已签到、未签退：历史卡片有“签退”，点后卡片不再有按钮', async () => {
    const { page, ctx } = await openPage({
      prepare: async (prepared) => {
        await prepared.travelTo(at('07:50'))
        await prepared.h.api.checkIn(1)
        await prepared.travelTo(at('09:40'))
      },
    })
    const card = history(page).find('article')
    expect(card.find('.badge').text()).toBe('已完成')
    expect(card.findAll('button').map((button) => button.text())).toEqual(['签退'])

    await buttonIn(page, 'section[aria-label="历史预约"]', '签退').trigger('click')
    await flushPromises()

    expect((await ctx.h.api.getReservation(1)).checkOutAt).not.toBeNull()
    expect(history(page).find('article').findAll('button')).toHaveLength(0)
  })

  it('超过签退宽限：卡片上显示失败文案，按钮仍在', async () => {
    const { page, ctx } = await openPage({
      prepare: async (prepared) => {
        await prepared.travelTo(at('07:50'))
        await prepared.h.api.checkIn(1)
        await prepared.travelTo(at('09:40'))
      },
    })
    await ctx.travelTo(at('10:05'))

    await buttonIn(page, 'section[aria-label="历史预约"]', '签退').trigger('click')
    await flushPromises()

    expect(history(page).find('article [role="alert"]').text()).toBe('当前状态不允许该操作')
    expect(history(page).find('article button').text()).toBe('签退')
  })

  it('X1 历史预约加载时 TOKEN_EXPIRED：回到登录页', async () => {
    const ctx = await loginAs('zhangsan', '/me')
    ctx.h.clock.set('2026-10-12T18:00:00')
    useApiClient(ctx.h.api)
    const page = mountWithApp(MeView, ctx.h)
    await flushPromises()

    expect(ctx.h.router.currentRoute.value.path).toBe('/login')
    expect(page.find('[role="alert"]').exists()).toBe(false)
  })
})

describe('FE-8 L2 历史里不提供“取消”', () => {
  it('接口在历史里给出 UPCOMING 的预约时，卡片显示“待使用”但没有“取消预约”按钮，点不到确认层', async () => {
    const { page, ctx } = await openPage({
      wrap: (api) => ({ ...api, listMyReservations: () => api.listMyReservations({ scope: 'CURRENT' }) }),
    })
    const card = history(page).find('article')

    expect(card.find('.badge').text()).toBe('待使用')
    expect(card.findAll('button')).toHaveLength(0)
    expect(history(page).text()).not.toContain('取消预约')
    expect(page.find('[role="dialog"]').exists()).toBe(false)
    expect((await ctx.h.api.getReservation(1)).status).toBe('CONFIRMED')
  })

  it('同一份数据里已进入签到窗口的预约仍有“签到”按钮（只排除取消）', async () => {
    const { page } = await openPage({
      wrap: (api) => ({ ...api, listMyReservations: () => api.listMyReservations({ scope: 'CURRENT' }) }),
      prepare: async (ctx) => { await ctx.travelTo(at('07:50')) },
    })

    expect(history(page).find('article .badge').text()).toBe('可签到')
    expect(history(page).findAll('article button').map((button) => button.text())).toEqual(['签到'])
  })
})

describe('M3 报修', () => {
  it('场馆下拉包含全部场馆（含未开放预约的）；问题描述 maxlength=500；没有场地选择', async () => {
    const { page } = await openPage()
    const form = repairs(page).find('form')

    expect(form.findAll('option').map((option) => option.text())).toEqual(['请选择场馆', '网球馆', '羽毛球馆', '游泳馆'])
    expect(form.find('textarea').attributes('maxlength')).toBe('500')
    expect(form.findAll('select')).toHaveLength(1)
    expect(repairs(page).find('.none').text()).toBe('暂无报修记录')
  })

  it('没选场馆或没填描述就提交：显示提示，不创建报修', async () => {
    const created: CreateRepairRequest[] = []
    const { page } = await openPage({
      wrap: (api) => ({ ...api, createRepair: (request) => { created.push(request); return api.createRepair(request) } }),
    })

    await repairs(page).find('form').trigger('submit')
    expect(repairs(page).find('[role="alert"]').text()).toBe('请选择场馆')

    await repairs(page).find('select').setValue('1')
    await repairs(page).find('form').trigger('submit')
    expect(repairs(page).find('[role="alert"]').text()).toBe('请填写问题描述')
    expect(created).toEqual([])
  })

  it('选场馆、填描述并提交：请求不带 resourceId；表单清空；列表刷新并显示状态“已提交”', async () => {
    const created: CreateRepairRequest[] = []
    const { page } = await openPage({
      wrap: (api) => ({ ...api, createRepair: (request) => { created.push(request); return api.createRepair(request) } }),
    })
    await repairs(page).find('select').setValue('2')
    await repairs(page).find('textarea').setValue('羽毛球场 3 的灯不亮')
    await repairs(page).find('form').trigger('submit')
    await flushPromises()

    expect(created).toEqual([{ venueId: 2, description: '羽毛球场 3 的灯不亮' }])
    expect((repairs(page).find('select').element as HTMLSelectElement).selectedIndex).toBe(0)
    expect((repairs(page).find('textarea').element as HTMLTextAreaElement).value).toBe('')
    expect(repairs(page).find('[role="status"]').text()).toBe('报修已提交')
    const items = repairs(page).findAll('article')
    expect(items).toHaveLength(1)
    expect(items[0]?.find('.venue').text()).toBe('羽毛球馆')
    expect(items[0]?.find('.badge').text()).toBe('已提交')
    expect(items[0]?.find('.description').text()).toBe('羽毛球场 3 的灯不亮')
    expect(repairs(page).find('.none').exists()).toBe(false)
  })

  it('已解决的报修显示“已解决”和处理结果', async () => {
    const { page } = await openPage({
      prepare: async (ctx) => {
        await ctx.h.api.createRepair({ venueId: 1, description: '球网损坏' })
        const admin = await ctx.h.clientFor('admin_tennis')
        await admin.adminUpdateRepair(1, { status: 'RESOLVED', resultNote: '已更换球网' })
      },
    })
    const item = repairs(page).find('article')

    expect(item.find('.badge').text()).toBe('已解决')
    expect(item.find('.result').text()).toBe('处理结果：已更换球网')
  })

  it('X1 提交报修时 TOKEN_EXPIRED：回到登录页', async () => {
    const { page, ctx } = await openPage()
    await repairs(page).find('select').setValue('1')
    await repairs(page).find('textarea').setValue('球网损坏')
    ctx.h.clock.set('2026-10-12T18:00:00')
    await repairs(page).find('form').trigger('submit')
    await flushPromises()

    expect(ctx.h.router.currentRoute.value.path).toBe('/login')
  })
})
