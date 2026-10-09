// FE-6 S2 / S3 / ACC-M2-08：/sys-admin 下的路由与两组导航；守卫与 access.ts 的规则不变（归属仍是 /sys-admin/**）。
import { describe, expect, it } from 'vitest'

import { resolvePostLoginTarget } from '../../src/router/access'
import { PATHS } from '../../src/router/paths'
import { GLOBAL_GROUP, OPERATION_GROUP, scopeOfPath, SYS_ADMIN_NAV } from '../../src/router/sysAdminNav'
import { createAuthHarness, DEMO_PASSWORD, type AuthHarness } from '../auth/harness'

async function loginAs(h: AuthHarness, username: string): Promise<void> {
  expect((await h.auth.login({ username, password: DEMO_PASSWORD })).ok).toBe(true)
}

async function visit(h: AuthHarness, path: string): Promise<string> {
  await h.router.push(path)
  return h.router.currentRoute.value.fullPath
}

describe('S2 两组导航', () => {
  it('全局六项在前、场馆运营五项在后，顺序与文案固定（ACC-M2-08）', () => {
    expect(SYS_ADMIN_NAV.filter((entry) => entry.group === GLOBAL_GROUP).map((entry) => entry.label)).toEqual([
      '场馆资料与开关', '管理员与授权', '用户', '系统公告', '全局统计', '操作记录',
    ])
    expect(SYS_ADMIN_NAV.filter((entry) => entry.group === OPERATION_GROUP).map((entry) => entry.label)).toEqual([
      '预约管理', '场地与开放规则', '场地占用总览', '场馆公告', '报修',
    ])
    expect(SYS_ADMIN_NAV.map((entry) => entry.group)).toEqual([
      ...Array<string>(6).fill(GLOBAL_GROUP), ...Array<string>(5).fill(OPERATION_GROUP),
    ])
  })

  it('十一个路径互不相同，都在 /sys-admin 下；/sys-admin 本身是场馆资料与开关', () => {
    const paths = SYS_ADMIN_NAV.map((entry) => entry.path)

    expect(new Set(paths).size).toBe(11)
    expect(paths[0]).toBe(PATHS.sysAdmin)
    expect(paths.every((path) => path === PATHS.sysAdmin || path.startsWith(`${PATHS.sysAdmin}/`))).toBe(true)
  })

  it('S4：只有预约管理与操作记录可以选“全部场馆”；运营页面必须选定场馆；其余全局页面不要场馆', () => {
    const scopes = Object.fromEntries(SYS_ADMIN_NAV.map((entry) => [entry.label, entry.scope]))

    expect(scopes).toEqual({
      场馆资料与开关: 'none', 管理员与授权: 'none', 用户: 'none', 系统公告: 'none', 全局统计: 'none',
      操作记录: 'venue-or-all', 预约管理: 'venue-or-all',
      场地与开放规则: 'venue', 场地占用总览: 'venue', 场馆公告: 'venue', 报修: 'venue',
    })
    expect(scopeOfPath(PATHS.sysAdminLogs)).toBe('venue-or-all')
    expect(scopeOfPath('/sys-admin/nope')).toBe('none')
  })
})

describe('S3 路由', () => {
  it('SYS_ADMIN 能进入十一个路径，保留查询参数', async () => {
    const h = createAuthHarness()
    await loginAs(h, 'sysadmin')

    for (const entry of SYS_ADMIN_NAV) {
      expect(await visit(h, `${entry.path}?venueId=2`)).toBe(`${entry.path}?venueId=2`)
    }
  })

  it('每个路径匹配各自的路由记录', async () => {
    const h = createAuthHarness()
    await loginAs(h, 'sysadmin')
    const names: string[] = []
    for (const entry of SYS_ADMIN_NAV) {
      await visit(h, entry.path)
      names.push(String(h.router.currentRoute.value.name))
    }

    expect(names).toEqual([
      'sys-admin', 'sys-admin-admins', 'sys-admin-users', 'sys-admin-announcements', 'sys-admin-stats', 'sys-admin-logs',
      'sys-admin-reservations', 'sys-admin-resources', 'sys-admin-occupancy', 'sys-admin-venue-announcements', 'sys-admin-repairs',
    ])
  })

  it('未知子路径回到 /sys-admin，并保留查询参数', async () => {
    const h = createAuthHarness()
    await loginAs(h, 'sysadmin')

    expect(await visit(h, '/sys-admin/nope?venueId=2')).toBe('/sys-admin?venueId=2')
    expect(await visit(h, '/sys-admin/users/extra')).toBe('/sys-admin')
  })

  it('USER 与 VENUE_ADMIN 访问任一子路径都被拦回本角色入口', async () => {
    for (const [username, entry] of [['zhangsan', '/'], ['admin_tennis', '/venue-admin']] as const) {
      const h = createAuthHarness()
      await loginAs(h, username)
      for (const item of SYS_ADMIN_NAV) {
        expect(await visit(h, item.path)).toBe(entry)
      }
    }
  })

  it('未登录访问子路径（含未知子路径）：回到 /login 并带原路径作返回地址', async () => {
    for (const path of ['/sys-admin/users', '/sys-admin/stats?x=1', '/sys-admin/nope']) {
      const h = createAuthHarness()
      await h.router.push(path)
      const route = h.router.currentRoute.value

      expect(route.path).toBe('/login')
      expect(route.query.redirect).toBe(path)
    }
  })

  it('登录后的返回地址：系统管理员的子路径被采用，别的角色的路径回到入口', () => {
    expect(resolvePostLoginTarget('SYS_ADMIN', '/sys-admin/stats')).toBe('/sys-admin/stats')
    expect(resolvePostLoginTarget('SYS_ADMIN', '/venue-admin/logs')).toBe('/sys-admin')
    expect(resolvePostLoginTarget('VENUE_ADMIN', '/sys-admin/stats')).toBe('/venue-admin')
  })
})
