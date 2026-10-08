// ACC-M2-07 场馆管理员端：概览、预约管理、场地与开放规则、场地占用总览、公告、报修、操作记录可切换。
// 同时覆盖 S1–S4：外壳与七项导航、场馆选择器与 venueId 查询参数、桌面管理端表面。
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../src/api/errors'
import { buttonIn, content, openAdminApp } from './support'

vi.mock('../../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/api/index')>()
  const { swappedApi } = await import('../apiSwap')
  return { ...actual, api: swappedApi() }
})

const SECTIONS = ['概览', '预约管理', '场地与开放规则', '场地占用总览', '公告', '报修', '操作记录']

describe('ACC-M2-07 七个部分可切换', () => {
  it('侧栏按顺序有七项；逐项点击后页面标题随之切换，当前项高亮', async () => {
    const { root, router } = await openAdminApp('/venue-admin')
    const links = () => root.findAll('nav a')
    expect(links().map((link) => link.text())).toEqual(SECTIONS)

    for (const [index, title] of SECTIONS.entries()) {
      await links()[index]?.trigger('click')
      await flushPromises()

      expect(content(root).get('h1').text()).toBe(title)
      expect(links()[index]?.classes()).toContain('active')
      expect(links().filter((link) => link.classes().includes('active'))).toHaveLength(1)
      expect(router.currentRoute.value.query.venueId).toBe('1')
    }
  })

  it('S4：根元素是管理端表面；顶栏有退出登录；不是用户端的手机列', async () => {
    const { root } = await openAdminApp('/venue-admin')

    expect(root.find('[data-surface="admin"]').exists()).toBe(true)
    expect(root.findAll('header button').map((button) => button.text())).toContain('退出登录')
    expect(root.find('.phone').exists()).toBe(false)
  })
})

describe('S3 场馆选择器与 venueId', () => {
  it('admin_tennis：只有网球馆；地址里没有 venueId 时写回第一个场馆，链接带着它', async () => {
    const { root, router } = await openAdminApp('/venue-admin')

    expect(root.get('header select').findAll('option').map((option) => option.text())).toEqual(['网球馆'])
    expect(router.currentRoute.value.fullPath).toBe('/venue-admin?venueId=1')
    expect(root.findAll('nav a').map((link) => link.attributes('href'))).toEqual([
      '/venue-admin?venueId=1', '/venue-admin/reservations?venueId=1', '/venue-admin/resources?venueId=1',
      '/venue-admin/occupancy?venueId=1', '/venue-admin/announcements?venueId=1', '/venue-admin/repairs?venueId=1',
      '/venue-admin/logs?venueId=1',
    ])
  })

  it('admin_pool：选择器恰好是羽毛球馆和游泳馆；越权的 venueId 回到第一个授权场馆', async () => {
    const { root, router } = await openAdminApp('/venue-admin?venueId=1', { username: 'admin_pool' })

    expect(root.get('header select').findAll('option').map((option) => option.text())).toEqual(['羽毛球馆', '游泳馆'])
    expect(router.currentRoute.value.query.venueId).toBe('2')
    expect((root.get('header select').element as HTMLSelectElement).value).toBe('2')
  })

  it('切换场馆：地址改为所选场馆，当前页面按新场馆重新取数；刷新（带 venueId 重新进入）保持', async () => {
    const { root, router } = await openAdminApp('/venue-admin/occupancy?venueId=2', { username: 'admin_pool' })
    await root.get('header input[type="date"], main input[type="date"]').setValue('2026-10-13')
    await flushPromises()
    expect(content(root).get('.hint').text()).toContain('羽毛球馆')

    await root.get('header select').setValue('3')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/venue-admin/occupancy')
    expect(router.currentRoute.value.query.venueId).toBe('3')
    expect(content(root).get('.hint').text()).toContain('游泳馆')
    expect(content(root).get('.hint').text()).toContain('场地数量 6')

    await root.findAll('nav a')[1]?.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/venue-admin/reservations?venueId=3')
    expect(content(root).get('.ui-empty-state .title').text()).toBe('没有符合条件的预约')

    const reloaded = await openAdminApp(router.currentRoute.value.fullPath, { username: 'admin_pool' })
    expect((reloaded.root.get('header select').element as HTMLSelectElement).value).toBe('3')
  })
})

describe('外壳的加载、失败与无场馆状态', () => {
  it('场馆列表失败：显示错误和“重试”，重试成功后进入页面', async () => {
    let attempts = 0
    const { root } = await openAdminApp('/venue-admin', {
      wrap: (api) => ({
        ...api,
        adminListVenues: () => {
          attempts += 1
          return attempts === 1 ? Promise.reject(new ApiError(403, 'FORBIDDEN', 'x')) : api.adminListVenues()
        },
      }),
    })

    expect(content(root).get('[role="alert"]').text()).toBe('无权执行此操作')
    expect(root.find('header select').exists()).toBe(false)
    await buttonIn(content(root), '重试').trigger('click')
    await flushPromises()

    expect(content(root).find('[role="alert"]').exists()).toBe(false)
    expect(content(root).get('h1').text()).toBe('概览')
  })

  it('没有任何授权场馆：显示“暂无授权场馆”，不渲染页面', async () => {
    const { root } = await openAdminApp('/venue-admin', { wrap: (api) => ({ ...api, adminListVenues: async () => [] }) })

    expect(content(root).get('.ui-empty-state .title').text()).toBe('暂无授权场馆')
    expect(content(root).find('h1').exists()).toBe(false)
  })

  it('X1：场馆列表返回 TOKEN_EXPIRED → 回到登录页', async () => {
    const { router } = await openAdminApp('/venue-admin', {
      wrap: (api) => ({ ...api, adminListVenues: () => Promise.reject(new ApiError(401, 'TOKEN_EXPIRED', 'x')) }),
    })

    expect(router.currentRoute.value.path).toBe('/login')
  })
})
