// FE-5 S2：/venue-admin 下的七个页面路径、未知子路径回到概览；守卫与 access.ts 规则不变（归属仍是 /venue-admin/**）。
import { describe, expect, it } from 'vitest'

import { PATHS } from '../../src/router/paths'
import { VENUE_ADMIN_NAV } from '../../src/router/venueAdminNav'
import { createAuthHarness, DEMO_PASSWORD, type AuthHarness } from '../auth/harness'

async function loginAs(h: AuthHarness, username: string): Promise<void> {
  expect((await h.auth.login({ username, password: DEMO_PASSWORD })).ok).toBe(true)
}

async function visit(h: AuthHarness, path: string): Promise<string> {
  await h.router.push(path)
  return h.router.currentRoute.value.fullPath
}

describe('S2 场馆管理员路由', () => {
  it('七项导航对应七个互不相同的路径，都在 /venue-admin 下，概览就是 /venue-admin', () => {
    const paths = VENUE_ADMIN_NAV.map((entry) => entry.path)

    expect(VENUE_ADMIN_NAV.map((entry) => entry.label)).toEqual([
      '概览', '预约管理', '场地与开放规则', '场地占用总览', '公告', '报修', '操作记录',
    ])
    expect(new Set(paths).size).toBe(7)
    expect(paths[0]).toBe(PATHS.venueAdmin)
    expect(paths.every((path) => path === PATHS.venueAdmin || path.startsWith(`${PATHS.venueAdmin}/`))).toBe(true)
  })

  it('VENUE_ADMIN 能进入七个路径，保留 venueId 查询参数', async () => {
    const h = createAuthHarness()
    await loginAs(h, 'admin_pool')

    for (const entry of VENUE_ADMIN_NAV) {
      expect(await visit(h, `${entry.path}?venueId=3`)).toBe(`${entry.path}?venueId=3`)
    }
  })

  it('每个子路径匹配的是各自的路由记录', async () => {
    const h = createAuthHarness()
    await loginAs(h, 'admin_tennis')
    const names: string[] = []
    for (const entry of VENUE_ADMIN_NAV) {
      await visit(h, entry.path)
      names.push(String(h.router.currentRoute.value.name))
    }

    expect(names).toEqual([
      'venue-admin', 'venue-admin-reservations', 'venue-admin-resources', 'venue-admin-occupancy',
      'venue-admin-announcements', 'venue-admin-repairs', 'venue-admin-logs',
    ])
  })

  it('未知子路径回到概览，并保留查询参数', async () => {
    const h = createAuthHarness()
    await loginAs(h, 'admin_pool')

    expect(await visit(h, '/venue-admin/nope?venueId=3')).toBe('/venue-admin?venueId=3')
    expect(await visit(h, '/venue-admin/logs/extra')).toBe('/venue-admin')
  })

  it('USER 与 SYS_ADMIN 访问任一子路径都被拦回本角色入口', async () => {
    for (const [username, entry] of [['zhangsan', '/'], ['sysadmin', '/sys-admin']] as const) {
      const h = createAuthHarness()
      await loginAs(h, username)
      for (const item of VENUE_ADMIN_NAV) {
        expect(await visit(h, item.path)).toBe(entry)
      }
    }
  })

  it('未登录访问子路径（含未知子路径）：回到 /login 并带原路径作返回地址', async () => {
    for (const path of ['/venue-admin/reservations?venueId=2', '/venue-admin/nope']) {
      const h = createAuthHarness()
      await h.router.push(path)
      const route = h.router.currentRoute.value

      expect(route.path).toBe('/login')
      expect(route.query.redirect).toBe(path)
    }
  })
})
