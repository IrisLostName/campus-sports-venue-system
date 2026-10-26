// UI-2b-rulings 已定事项第 4 条、第 3 节：每条路由的标签页标题为“页面名 - 校园场馆预约与服务管理系统”，未知页面为项目名。
// 这里按路由表解析地址（不经过守卫）；导航后真正写入 document.title 由 tests/components/pageTitle.spec.ts 覆盖。
import { createMemoryHistory, createRouter, type RouteComponent } from 'vue-router'
import { describe, expect, it } from 'vitest'

import { buildRoutes, type RouteViews } from '../../src/router/routes'
import { SYS_ADMIN_NAV } from '../../src/router/sysAdminNav'
import { APP_NAME, documentTitle, pageTitleOf } from '../../src/router/titles'
import { VENUE_ADMIN_NAV } from '../../src/router/venueAdminNav'

const STUB: RouteComponent = { render: () => null }
const VIEWS = new Proxy({}, { get: () => STUB }) as RouteViews
const router = createRouter({ history: createMemoryHistory(), routes: buildRoutes(VIEWS) })

const title = (path: string) => documentTitle(router.resolve(path))
const suffix = (page: string) => `${page} - 校园场馆预约与服务管理系统`

const TABLE: ReadonlyArray<readonly [path: string, page: string]> = [
  ['/login', '登录'],
  ['/', '首页'], ['/reservation', '预约'], ['/booking', '订场'], ['/me', '我的'],
  ['/venue-admin', '概览'], ['/venue-admin/reservations', '预约管理'], ['/venue-admin/resources', '场地与开放规则'],
  ['/venue-admin/occupancy', '场地占用总览'], ['/venue-admin/announcements', '公告'], ['/venue-admin/repairs', '报修'],
  ['/venue-admin/logs', '操作记录'],
  ['/sys-admin', '场馆资料与开关'], ['/sys-admin/admins', '管理员与授权'], ['/sys-admin/users', '用户'],
  ['/sys-admin/announcements', '系统公告'], ['/sys-admin/stats', '全局统计'], ['/sys-admin/logs', '操作记录'],
  ['/sys-admin/reservations', '预约管理'], ['/sys-admin/resources', '场地与开放规则'], ['/sys-admin/occupancy', '场地占用总览'],
  ['/sys-admin/venue-announcements', '场馆公告'], ['/sys-admin/repairs', '报修'],
  ['/display', '运营大屏'],
]

describe('标签页标题', () => {
  it('项目名', () => {
    expect(APP_NAME).toBe('校园场馆预约与服务管理系统')
  })

  it.each(TABLE)('%s → %s', (path, page) => {
    expect(title(path)).toBe(suffix(page))
  })

  it('路由表里每条命名路由都有页面名（not-found 除外），上表覆盖了全部', () => {
    const named = router.getRoutes().filter((record) => typeof record.name === 'string' && record.name !== 'not-found')
    expect(named.every((record) => record.meta.title !== undefined)).toBe(true)
    expect(named).toHaveLength(TABLE.length)
  })

  it('未知页面与管理端未知子路径只显示项目名', () => {
    for (const path of ['/no-such-page', '/venue-admin/no-such-page', '/sys-admin/x/y']) {
      expect(title(path), path).toBe(APP_NAME)
      expect(pageTitleOf(router.resolve(path)), path).toBeNull()
    }
  })

  it('管理端的页面名与侧栏导航项文字相同', () => {
    for (const entry of [...VENUE_ADMIN_NAV, ...SYS_ADMIN_NAV]) {
      expect(pageTitleOf(router.resolve(entry.path)), entry.path).toBe(entry.label)
    }
  })
})
