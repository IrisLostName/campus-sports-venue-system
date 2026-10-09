// FE-5 S1 / S4 / X7：AdminShell 只负责外壳；导航项由调用方传入（FE-6 将传另一组）。
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AdminShell from '../../../src/components/admin/AdminShell.vue'
import type { AdminNavItem } from '../../../src/utils/adminNav'
import { createAuthHarness, DEMO_PASSWORD, type AuthHarness } from '../../auth/harness'
import { buttonIn } from './support'

const VENUE_ITEMS: AdminNavItem[] = [
  { label: '概览', to: '/venue-admin' },
  { label: '预约管理', to: '/venue-admin/reservations' },
]
const SYS_ITEMS: AdminNavItem[] = [
  { label: '用户', to: '/sys-admin' },
  { label: '系统公告', to: { path: '/sys-admin/announcements', query: { page: '2' } } },
  { label: '全局统计', to: '/sys-admin/stats' },
]

async function mountShell(username: string, items: AdminNavItem[], brand: string): Promise<{ h: AuthHarness; page: ReturnType<typeof mount> }> {
  const h = createAuthHarness()
  await h.auth.login({ username, password: DEMO_PASSWORD })
  await h.router.push(username === 'sysadmin' ? '/sys-admin' : '/venue-admin')
  const page = mount(AdminShell, {
    props: { brand, items },
    slots: { default: '<p class="body">页面内容</p>', toolbar: '<span class="tool">工具栏</span>' },
    global: { plugins: [h.auth._p, h.router] },
  })
  await flushPromises()
  return { h, page }
}

describe('S1 / S4 外壳', () => {
  it('根元素是管理端表面，侧栏与顶栏是玻璃，内容与工具栏来自插槽', async () => {
    const { page } = await mountShell('admin_tennis', VENUE_ITEMS, '场馆管理端')

    expect(page.attributes('data-surface')).toBe('admin')
    expect(page.get('aside').classes()).toContain('ui-glass')
    expect(page.get('header').classes()).toContain('ui-glass')
    expect(page.get('main').text()).toBe('页面内容')
    expect(page.get('header .tool').text()).toBe('工具栏')
    expect(page.get('aside .brand').text()).toBe('场馆管理端')
  })

  it('导航项按传入顺序渲染成链接；当前页高亮并带 aria-current', async () => {
    const { page } = await mountShell('admin_tennis', VENUE_ITEMS, '场馆管理端')

    const links = page.findAll('nav a')
    expect(links.map((link) => link.text())).toEqual(['概览', '预约管理'])
    expect(links.map((link) => link.attributes('href'))).toEqual(['/venue-admin', '/venue-admin/reservations'])
    expect(links[0]?.classes()).toContain('active')
    expect(links[0]?.attributes('aria-current')).toBe('page')
    expect(links[1]?.classes()).not.toContain('active')
  })

  it('X7：换一组导航项（FE-6 复用）和品牌名，外壳不变', async () => {
    const { page } = await mountShell('sysadmin', SYS_ITEMS, '系统管理端')

    expect(page.findAll('nav a').map((link) => link.text())).toEqual(['用户', '系统公告', '全局统计'])
    expect(page.findAll('nav a')[1]?.attributes('href')).toBe('/sys-admin/announcements?page=2')
    expect(page.get('aside .brand').text()).toBe('系统管理端')
    expect(page.attributes('data-surface')).toBe('admin')
  })

  it('顶栏显示当前登录人，“退出登录”清除登录状态并回到登录页', async () => {
    const { h, page } = await mountShell('admin_tennis', VENUE_ITEMS, '场馆管理端')
    expect(page.get('header .user').text()).toBe('网球馆管理员')

    await buttonIn(page, '退出登录').trigger('click')
    await flushPromises()

    expect(h.auth.isAuthenticated).toBe(false)
    expect(h.router.currentRoute.value.path).toBe('/login')
  })
})
