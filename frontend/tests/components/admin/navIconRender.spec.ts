// UI-2b-rulings 第 3 节：两类管理端每个导航项都有图标且图标 aria-hidden，名称仍由文字提供；
// 侧栏品牌区是图标方块 + 端名 + 项目名（计划闸门第 3 条）；顶栏的页面名与标签页标题一致。
import type { VueWrapper } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { SYS_ADMIN_NAV } from '../../../src/router/sysAdminNav'
import { VENUE_ADMIN_NAV } from '../../../src/router/venueAdminNav'
import { accessibleName } from '../a11yName'
import { openSysApp } from '../sysadmin/support'
import { openAdminApp } from './support'

vi.mock('../../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/api/index')>()
  const { swappedApi } = await import('../apiSwap')
  return { ...actual, api: swappedApi() }
})

function expectIconLinks(root: VueWrapper, labels: string[]): void {
  const links = root.findAll('nav a')
  expect(links.map((link) => link.text())).toEqual(labels)
  for (const [index, link] of links.entries()) {
    const icons = link.findAll('svg')
    expect(icons, labels[index]).toHaveLength(1)
    expect(icons[0]?.attributes('aria-hidden')).toBe('true')
    expect(icons[0]?.attributes('focusable')).toBe('false')
    expect(icons[0]?.classes()).toContain('nav-icon')
    expect(accessibleName(link.element), labels[index]).toBe(labels[index])
  }
}

describe('场馆管理员端导航图标', () => {
  it('七项都有一个 aria-hidden 图标，链接的可访问名称就是文字', async () => {
    const { root } = await openAdminApp('/venue-admin')
    expectIconLinks(root, VENUE_ADMIN_NAV.map((entry) => entry.label))
  })

  it('品牌区：图标方块（aria-hidden）、端名、项目名；顶栏页面名为当前页', async () => {
    const { root } = await openAdminApp('/venue-admin/reservations')
    expect(root.get('aside .brand').text()).toBe('场馆管理端')
    expect(root.get('aside .app-name').text()).toBe('校园场馆预约与服务管理系统')
    expect(root.get('aside .logo svg').attributes('aria-hidden')).toBe('true')
    expect(root.get('header .page-name').text()).toBe('预约管理')
    expect(root.get('header .page-name').element.tagName).toBe('P')
  })
})

describe('系统管理员端导航图标', () => {
  it('十一项都有一个 aria-hidden 图标，链接的可访问名称就是文字；分组标题没有图标', async () => {
    const { root } = await openSysApp('/sys-admin')
    expectIconLinks(root, SYS_ADMIN_NAV.map((entry) => entry.label))
    expect(root.findAll('nav .group').map((group) => group.find('svg').exists())).toEqual([false, false])
  })

  it('顶栏页面名跟随路由：场馆公告页显示“场馆公告”', async () => {
    const { root } = await openSysApp('/sys-admin/venue-announcements?venueId=1')
    expect(root.get('aside .brand').text()).toBe('系统管理端')
    expect(root.get('header .page-name').text()).toBe('场馆公告')
  })
})
