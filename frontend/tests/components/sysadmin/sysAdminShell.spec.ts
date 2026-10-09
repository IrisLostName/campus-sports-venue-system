// ACC-M2-08 系统管理员端：场馆资料与开关、管理员授权、用户、系统公告、全局统计、操作记录可切换。
// 同时覆盖 FE-6 S1–S4：系统管理员外壳、两组导航、场馆选择器（含“全部场馆”）与 venueId 查询参数、复用的场馆运营页面。
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../src/api/errors'
import { buttonIn, content, fieldByLabel, openSysApp } from './support'

vi.mock('../../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/api/index')>()
  const { swappedApi } = await import('../apiSwap')
  return { ...actual, api: swappedApi() }
})

const GLOBAL_SECTIONS: [string, string][] = [
  ['场馆资料与开关', '场馆资料与开关'],
  ['管理员与授权', '管理员与授权'],
  ['用户', '用户'],
  ['系统公告', '系统公告'],
  ['全局统计', '全局统计'],
  ['操作记录', '操作记录'],
]
const OPERATION_SECTIONS: [string, string][] = [
  ['预约管理', '预约管理'],
  ['场地与开放规则', '场地与开放规则'],
  ['场地占用总览', '场地占用总览'],
  ['场馆公告', '公告'],
  ['报修', '报修'],
]

describe('ACC-M2-08 六个全局部分可切换', () => {
  it('侧栏分“全局”“场馆运营”两组；逐项点击全局部分后页面标题随之切换，当前项高亮', async () => {
    const { root } = await openSysApp('/sys-admin')
    const links = () => root.findAll('nav a')

    expect(root.findAll('nav .group').map((heading) => heading.text())).toEqual(['全局', '场馆运营'])
    expect(links().map((link) => link.text())).toEqual([...GLOBAL_SECTIONS, ...OPERATION_SECTIONS].map(([label]) => label))
    for (const [index, [, title]] of GLOBAL_SECTIONS.entries()) {
      await links()[index]?.trigger('click')
      await flushPromises()

      expect(content(root).get('h1').text()).toBe(title)
      expect(links()[index]?.classes()).toContain('active')
      expect(links().filter((link) => link.classes().includes('active'))).toHaveLength(1)
    }
  })

  it('场馆运营五个部分（复用场馆管理员端的页面）同样可切换', async () => {
    const { root } = await openSysApp('/sys-admin')
    const links = () => root.findAll('nav a')

    for (const [offset, [, title]] of OPERATION_SECTIONS.entries()) {
      await links()[GLOBAL_SECTIONS.length + offset]?.trigger('click')
      await flushPromises()

      expect(content(root).get('h1').text()).toBe(title)
    }
  })

  it('分组标题在导航里位于各自第一项之前', async () => {
    const { root } = await openSysApp('/sys-admin')
    const nav = root.get('nav')
    const order = nav.findAll('.group, a').map((node) => node.text())

    expect(order[0]).toBe('全局')
    expect(order[1]).toBe('场馆资料与开关')
    expect(order.indexOf('场馆运营')).toBe(7)
    expect(order[8]).toBe('预约管理')
  })
})

describe('S1 外壳', () => {
  it('品牌是“系统管理端”，根元素是管理端表面；顶栏显示当前登录人并有退出登录', async () => {
    const { root, h, router } = await openSysApp('/sys-admin')

    expect(root.get('aside .brand').text()).toBe('系统管理端')
    expect(root.find('[data-surface="admin"]').exists()).toBe(true)
    expect(root.get('header .user').text()).toBe('系统管理员')
    await buttonIn(root.get('header'), '退出登录').trigger('click')
    await flushPromises()

    expect(h.auth.isAuthenticated).toBe(false)
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('场馆列表加载失败：显示错误与“重试”，重试成功后页面出现', async () => {
    let failures = 1
    const { root } = await openSysApp('/sys-admin', {
      wrap: (api) => ({
        ...api,
        adminListVenues: () => {
          if (failures > 0) {
            failures -= 1
            return Promise.reject(new ApiError(403, 'FORBIDDEN', '无权'))
          }
          return api.adminListVenues()
        },
      }),
    })
    expect(root.get('main [role="alert"]').text()).toBe('无权执行此操作')

    await buttonIn(root.get('main'), '重试').trigger('click')
    await flushPromises()

    expect(content(root).get('h1').text()).toBe('场馆资料与开关')
  })
})

describe('S4 场馆选择器', () => {
  it('全局页面不显示场馆选择器', async () => {
    for (const path of ['/sys-admin', '/sys-admin/users', '/sys-admin/stats']) {
      const { root } = await openSysApp(path)

      expect(root.get('header').findAll('select')).toHaveLength(0)
    }
  })

  it('场地与开放规则等运营页面必须选定场馆：缺省取第一个场馆并写回地址栏，选项没有“全部场馆”', async () => {
    const { root, router } = await openSysApp('/sys-admin/resources')
    const select = fieldByLabel(root.get('header'), '场馆')

    expect(router.currentRoute.value.query.venueId).toBe('1')
    expect(select.findAll('option').map((option) => option.text())).toEqual(['网球馆', '羽毛球馆', '游泳馆'])
    expect(content(root).get('h1').text()).toBe('场地与开放规则')
  })

  it('预约管理与操作记录缺省是“全部场馆”：选项里有“全部场馆”，地址栏不带 venueId', async () => {
    for (const path of ['/sys-admin/reservations', '/sys-admin/logs']) {
      const { root, router } = await openSysApp(path)
      const select = fieldByLabel(root.get('header'), '场馆')

      expect(router.currentRoute.value.query.venueId).toBeUndefined()
      expect(select.findAll('option').map((option) => option.text())).toEqual(['全部场馆', '网球馆', '羽毛球馆', '游泳馆'])
    }
  })

  it('选定场馆后导航链接携带 venueId；全局页面的链接不带', async () => {
    const { root } = await openSysApp('/sys-admin/resources?venueId=2')
    const hrefs = Object.fromEntries(root.findAll('nav a').map((link) => [link.text(), link.attributes('href')]))

    expect(hrefs['场地占用总览']).toBe('/sys-admin/occupancy?venueId=2')
    expect(hrefs['预约管理']).toBe('/sys-admin/reservations?venueId=2')
    expect(hrefs['操作记录']).toBe('/sys-admin/logs?venueId=2')
    expect(hrefs['用户']).toBe('/sys-admin/users')
    expect(hrefs['全局统计']).toBe('/sys-admin/stats')
    expect(hrefs['场馆资料与开关']).toBe('/sys-admin')
  })

  it('从“全部场馆”的预约管理切到运营页面：自动选定第一个场馆；切回去又是“全部场馆”', async () => {
    const { root, router } = await openSysApp('/sys-admin/reservations')
    await root.findAll('nav a').find((link) => link.text() === '场地占用总览')?.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/sys-admin/occupancy')
    expect(router.currentRoute.value.query.venueId).toBe('1')
    expect(content(root).get('h1').text()).toBe('场地占用总览')
  })

  it('选择“全部场馆”：移除 venueId；选择具体场馆：写入 venueId 并重新取数', async () => {
    const { root, router } = await openSysApp('/sys-admin/logs?venueId=2')
    const select = fieldByLabel(root.get('header'), '场馆')
    await select.setValue('')
    await flushPromises()
    expect(router.currentRoute.value.query.venueId).toBeUndefined()

    await select.setValue('3')
    await flushPromises()
    expect(router.currentRoute.value.query.venueId).toBe('3')
  })

  it('N4：地址栏的 venueId 在页面打开后被改成无效值，外壳把它规范化为第一个场馆', async () => {
    const { router } = await openSysApp('/sys-admin/resources?venueId=2')
    await router.replace({ query: { venueId: 'abc' } })
    await flushPromises()

    expect(router.currentRoute.value.query.venueId).toBe('1')
  })
})

// F1：场馆要求取自匹配到的路由记录，不按地址字符串判断；vue-router 接受的等价地址（尾部斜杠、大小写）与规范地址行为一致。
describe('F1 等价地址得到与规范地址相同的场馆要求', () => {
  const VENUE_PAGES: [string, string, string][] = [
    ['/sys-admin/resources/', '/sys-admin/resources', '场地与开放规则'],
    ['/sys-admin/Resources', '/sys-admin/resources', '场地与开放规则'],
    ['/sys-admin/occupancy/', '/sys-admin/occupancy', '场地占用总览'],
    ['/sys-admin/Venue-Announcements', '/sys-admin/venue-announcements', '公告'],
    ['/sys-admin/REPAIRS/', '/sys-admin/repairs', '报修'],
  ]
  const ALL_VENUE_PAGES: [string, string][] = [
    ['/sys-admin/reservations/', '预约管理'],
    ['/sys-admin/Logs', '操作记录'],
  ]

  it.each(VENUE_PAGES)('%s：必须选定场馆——页面照常渲染，选择器没有“全部场馆”，地址栏写入第一个场馆', async (path, canonical, title) => {
    const { root, router } = await openSysApp(path)
    const select = fieldByLabel(root.get('header'), '场馆')

    expect(content(root).get('h1').text()).toBe(title)
    expect(select.findAll('option').map((option) => option.text())).toEqual(['网球馆', '羽毛球馆', '游泳馆'])
    expect(router.currentRoute.value.path).toBe(canonical)
    expect(router.currentRoute.value.query.venueId).toBe('1')
  })

  it.each(ALL_VENUE_PAGES)('%s：可选“全部场馆”——有选择器，缺省是全部场馆，地址栏不带 venueId', async (path, title) => {
    const { root, router } = await openSysApp(path)
    const select = fieldByLabel(root.get('header'), '场馆')

    expect(content(root).get('h1').text()).toBe(title)
    expect(select.findAll('option').map((option) => option.text())).toEqual(['全部场馆', '网球馆', '羽毛球馆', '游泳馆'])
    expect(router.currentRoute.value.query.venueId).toBeUndefined()
  })

  it('场馆列表还没返回时不渲染需要场馆的页面；返回并选定场馆后才出现', async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const { root } = await openSysApp('/sys-admin/Resources', {
      wrap: (api) => ({
        ...api,
        adminListVenues: async () => {
          await gate
          return api.adminListVenues()
        },
      }),
    })

    expect(root.find('main h1').exists()).toBe(false)
    expect(root.get('main').text()).toContain('加载中')
    release()
    await flushPromises()

    expect(content(root).get('h1').text()).toBe('场地与开放规则')
  })

  it('等价地址上带着已有的 venueId：导航链接仍按规范路径携带场馆', async () => {
    const { root } = await openSysApp('/sys-admin/Resources/?venueId=2')
    const hrefs = Object.fromEntries(root.findAll('nav a').map((link) => [link.text(), link.attributes('href')]))

    expect(hrefs['场地占用总览']).toBe('/sys-admin/occupancy?venueId=2')
    expect(hrefs['用户']).toBe('/sys-admin/users')
  })
})
