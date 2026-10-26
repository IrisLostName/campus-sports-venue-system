// UI-2b-rulings 已定事项第 4 条：导航成功后，路由统一把标签页标题设为“页面名 - 校园场馆预约与服务管理系统”。
// 经过守卫的真实导航：未登录打开管理端被送去登录页，标题随之是登录页的。
import { describe, expect, it } from 'vitest'

import { createAuthHarness, DEMO_PASSWORD } from '../auth/harness'

const NAME = '校园场馆预约与服务管理系统'

describe('导航后设置 document.title', () => {
  it('未登录：/display 为运营大屏；/venue-admin 被送去登录页，标题是登录页的', async () => {
    const h = createAuthHarness()
    await h.router.push('/display')
    expect(document.title).toBe(`运营大屏 - ${NAME}`)
    await h.router.push('/venue-admin')
    expect(h.router.currentRoute.value.path).toBe('/login')
    expect(document.title).toBe(`登录 - ${NAME}`)
  })

  it('用户端四页', async () => {
    const h = createAuthHarness()
    await h.auth.login({ username: 'zhangsan', password: DEMO_PASSWORD })
    for (const [path, page] of [['/', '首页'], ['/reservation', '预约'], ['/booking', '订场'], ['/me', '我的']] as const) {
      await h.router.push(path)
      expect(document.title, path).toBe(`${page} - ${NAME}`)
    }
  })

  it('管理端：系统管理员的场馆运营页与全局页', async () => {
    const h = createAuthHarness()
    await h.auth.login({ username: 'sysadmin', password: DEMO_PASSWORD })
    await h.router.push('/sys-admin/stats')
    expect(document.title).toBe(`全局统计 - ${NAME}`)
    await h.router.push('/sys-admin/occupancy?venueId=1')
    expect(document.title).toBe(`场地占用总览 - ${NAME}`)
  })

  it('被拒绝的导航不改标题：场馆管理员打开系统管理端被带回自己的端', async () => {
    const h = createAuthHarness()
    await h.auth.login({ username: 'admin_tennis', password: DEMO_PASSWORD })
    await h.router.push('/venue-admin/logs')
    expect(document.title).toBe(`操作记录 - ${NAME}`)
    await h.router.push('/sys-admin')
    expect(h.router.currentRoute.value.path.startsWith('/venue-admin')).toBe(true)
    expect(document.title).toBe(`${h.router.currentRoute.value.meta.title ?? ''} - ${NAME}`)
  })
})
