// 路由与角色守卫（docs/02 第 3.1 节）。用内存路由 + Pinia + mock ApiClient，不涉及浏览器。
import { describe, expect, it } from 'vitest'

import { createAuthHarness, DEMO_PASSWORD, type AuthHarness } from './harness'

const ENTRY = { USER: '/', VENUE_ADMIN: '/venue-admin', SYS_ADMIN: '/sys-admin' } as const

async function loginAs(h: AuthHarness, username: string): Promise<void> {
  const result = await h.auth.login({ username, password: DEMO_PASSWORD })
  expect(result.ok).toBe(true)
}

async function visit(h: AuthHarness, path: string): Promise<string> {
  await h.router.push(path)
  return h.router.currentRoute.value.fullPath
}

describe('ACC-M2-01 越权路径被守卫拦回本角色入口', () => {
  it.each([
    ['zhangsan', 'USER', '/venue-admin'],
    ['zhangsan', 'USER', '/sys-admin'],
    ['zhangsan', 'USER', '/venue-admin/anything'],
    ['admin_tennis', 'VENUE_ADMIN', '/'],
    ['admin_tennis', 'VENUE_ADMIN', '/booking'],
    ['admin_tennis', 'VENUE_ADMIN', '/sys-admin'],
    ['sysadmin', 'SYS_ADMIN', '/'],
    ['sysadmin', 'SYS_ADMIN', '/me'],
    ['sysadmin', 'SYS_ADMIN', '/venue-admin'],
  ] as const)('%s（%s）访问 %s → 回到本角色入口', async (username, role, forbidden) => {
    const h = createAuthHarness()
    await loginAs(h, username)

    expect(await visit(h, forbidden)).toBe(ENTRY[role])
  })

  it.each([
    ['zhangsan', ['/', '/reservation', '/booking', '/me']],
    ['admin_pool', ['/venue-admin', '/venue-admin/reservations']],
    ['sysadmin', ['/sys-admin', '/sys-admin/users']],
  ] as const)('%s 访问本角色的路径不被拦截', async (username, paths) => {
    const h = createAuthHarness()
    await loginAs(h, username)

    for (const path of paths) {
      expect(await visit(h, path)).toBe(path)
    }
  })

  it('已登录访问 /login → 本角色入口（三种角色）', async () => {
    for (const [username, entry] of [['zhangsan', '/'], ['admin_tennis', '/venue-admin'], ['sysadmin', '/sys-admin']]) {
      const h = createAuthHarness()
      await loginAs(h, username as string)
      expect(await visit(h, '/login')).toBe(entry)
    }
  })

  it('未知路径：已登录 → 本角色入口；未登录 → /login', async () => {
    const guest = createAuthHarness()
    expect(await visit(guest, '/no-such-page')).toBe('/login')

    const admin = createAuthHarness()
    await loginAs(admin, 'admin_tennis')
    expect(await visit(admin, '/no-such-page')).toBe('/venue-admin')
  })
})

describe('未登录访问', () => {
  it.each(['/', '/reservation', '/booking', '/me', '/venue-admin', '/venue-admin/x', '/sys-admin'])(
    '访问 %s → /login 并带 redirect=原路径', async (path) => {
      const h = createAuthHarness()
      await h.router.push(path)

      const route = h.router.currentRoute.value
      expect(route.path).toBe('/login')
      expect(route.query.redirect).toBe(path)
    },
  )

  it('redirect 保留原路径上的查询参数', async () => {
    const h = createAuthHarness()
    await h.router.push('/booking?venueId=1')

    expect(h.router.currentRoute.value.query.redirect).toBe('/booking?venueId=1')
  })

  it('/display 无需登录即可访问', async () => {
    const h = createAuthHarness()

    expect(await visit(h, '/display')).toBe('/display')
  })

  it('/login 无需登录即可访问', async () => {
    const h = createAuthHarness()

    expect(await visit(h, '/login')).toBe('/login')
  })

  it('已登录用户也可以访问 /display', async () => {
    const h = createAuthHarness()
    await loginAs(h, 'sysadmin')

    expect(await visit(h, '/display')).toBe('/display')
  })
})

describe('守卫等待启动恢复完成', () => {
  it('令牌有效：刷新后直接进入原路径，不会先被当作未登录', async () => {
    const h = createAuthHarness()
    await loginAs(h, 'zhangsan')
    const reloaded = h.reload()

    expect(await visit(reloaded, '/booking')).toBe('/booking')
    expect(reloaded.auth.role).toBe('USER')
  })

  it('令牌有效的管理员刷新后访问越权路径，被拦回自己的入口（而不是登录页）', async () => {
    const h = createAuthHarness()
    await loginAs(h, 'admin_tennis')
    const reloaded = h.reload()

    expect(await visit(reloaded, '/sys-admin')).toBe('/venue-admin')
  })

  it('令牌已过期：刷新后访问受保护路径 → /login 并带 redirect', async () => {
    const h = createAuthHarness()
    await loginAs(h, 'zhangsan')
    h.clock.set('2026-10-12T17:00:00')
    const reloaded = h.reload()
    await reloaded.router.push('/booking')

    const route = reloaded.router.currentRoute.value
    expect(route.path).toBe('/login')
    expect(route.query.redirect).toBe('/booking')
    expect(reloaded.auth.isAuthenticated).toBe(false)
  })

  it('getMe 失败：刷新后访问受保护路径 → /login，令牌被清除', async () => {
    const h = createAuthHarness()
    h.storage.setItem('campus-venue.auth', JSON.stringify({ token: 'forged', expiresAt: '2026-10-12T17:00:00' }))
    const reloaded = h.reload()
    await reloaded.router.push('/me')

    expect(reloaded.router.currentRoute.value.path).toBe('/login')
    expect(reloaded.storage.items.size).toBe(0)
  })
})
