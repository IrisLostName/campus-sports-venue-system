// FE-6 X1 / X6：系统管理员端各页面的接口调用经 callApi——登录失效回到登录页；权限错误显示 messageFor 文案（权限以后端为准）。
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../src/api/errors'
import type { ApiClient } from '../../../src/api/client'
import { buttonIn, content, fieldByLabel, openSysApp } from './support'

vi.mock('../../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/api/index')>()
  const { swappedApi } = await import('../apiSwap')
  return { ...actual, api: swappedApi() }
})

function failing(code: string, ...methods: (keyof ApiClient)[]) {
  return (api: ApiClient): ApiClient => {
    const override: Partial<ApiClient> = {}
    for (const method of methods) {
      Object.assign(override, { [method]: () => Promise.reject(new ApiError(code.startsWith('FORBIDDEN') ? 403 : 401, code, '服务端文案')) })
    }
    return { ...api, ...override }
  }
}

const PAGES: [string, keyof ApiClient][] = [
  ['/sys-admin', 'adminListVenues'],
  ['/sys-admin/admins', 'adminListUsers'],
  ['/sys-admin/users', 'adminListUsers'],
  ['/sys-admin/announcements', 'adminListAnnouncements'],
  ['/sys-admin/stats', 'adminGetStatsOverview'],
  ['/sys-admin/logs', 'adminListLogs'],
  ['/sys-admin/reservations', 'adminListReservations'],
  ['/sys-admin/resources', 'adminListResources'],
  ['/sys-admin/occupancy', 'adminGetOccupancy'],
  ['/sys-admin/venue-announcements', 'adminListAnnouncements'],
  ['/sys-admin/repairs', 'adminListRepairs'],
]

describe('X1 登录失效', () => {
  it.each(PAGES)('%s 的数据请求返回 TOKEN_EXPIRED：回到登录页并清除登录状态', async (path, method) => {
    const { router, h } = await openSysApp(path, { wrap: failing('TOKEN_EXPIRED', method) })
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/login')
    expect(h.auth.isAuthenticated).toBe(false)
  })

  it('新增场馆时登录失效：回到登录页', async () => {
    const { router, root } = await openSysApp('/sys-admin', { wrap: failing('TOKEN_EXPIRED', 'adminCreateVenue') })
    const form = content(root).get('form[aria-label="新增场馆"]')
    await fieldByLabel(form, '名称').setValue('篮球馆')
    await fieldByLabel(form, '类型').setValue('BASKETBALL')
    await buttonIn(form, '新增场馆').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('切换开放预约开关时登录失效：回到登录页', async () => {
    const { router, root } = await openSysApp('/sys-admin', { wrap: failing('TOKEN_EXPIRED', 'adminUpdateVenue') })
    await content(root).findAll('input[role="switch"]')[1]?.setValue(true)
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('关闭场馆的预检遇到登录失效：回到登录页，不出现对话框', async () => {
    const { router, root } = await openSysApp('/sys-admin', { wrap: failing('TOKEN_EXPIRED', 'adminUpdateVenue') })
    await buttonIn(content(root).findAll('tbody tr')[0]!, '关闭场馆').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/login')
    expect(root.find('[role="dialog"]').exists()).toBe(false)
  })

  it('新建账号时登录失效：回到登录页，对话框关闭', async () => {
    const { router, root } = await openSysApp('/sys-admin/users', { wrap: failing('TOKEN_EXPIRED', 'adminCreateUser') })
    await buttonIn(content(root), '新建账号').trigger('click')
    const dialog = () => content(root).get('[role="dialog"]')
    await fieldByLabel(dialog(), '用户名').setValue('abc')
    await fieldByLabel(dialog(), '密码').setValue('12345678')
    await fieldByLabel(dialog(), '显示名').setValue('甲')
    await buttonIn(dialog(), '创建').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/login')
    expect(root.find('[role="dialog"]').exists()).toBe(false)
  })

  it('发布系统公告时登录失效：回到登录页', async () => {
    const { router, root } = await openSysApp('/sys-admin/announcements', { wrap: failing('TOKEN_EXPIRED', 'adminCreateAnnouncement') })
    const form = content(root).get('form[aria-label="发布系统公告"]')
    await fieldByLabel(form, '标题').setValue('标题')
    await fieldByLabel(form, '内容').setValue('内容')
    await buttonIn(form, '发布').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/login')
  })
})

describe('X6 权限错误显示文案', () => {
  it.each(PAGES.filter(([path]) => path !== '/sys-admin'))('%s 的数据请求返回 FORBIDDEN_SCOPE：显示“无权操作该场馆”，页面没有数据', async (path, method) => {
    const { root } = await openSysApp(path, { wrap: failing('FORBIDDEN_SCOPE', method) })

    expect(content(root).get('[role="alert"]').text()).toBe('无权操作该场馆')
  })

  it('场馆列表 FORBIDDEN：外壳显示“无权执行此操作”和重试', async () => {
    const { root } = await openSysApp('/sys-admin', { wrap: failing('FORBIDDEN', 'adminListVenues') })

    expect(content(root).get('[role="alert"]').text()).toBe('无权执行此操作')
    expect(buttonIn(content(root), '重试').exists()).toBe(true)
  })

  it('开关被拒绝（FORBIDDEN）：显示文案，开关回到服务端的值', async () => {
    const { root } = await openSysApp('/sys-admin', { wrap: failing('FORBIDDEN', 'adminUpdateVenue') })
    await content(root).findAll('input[role="switch"]')[1]?.setValue(true)
    await flushPromises()

    expect(content(root).get('[role="alert"]').text()).toBe('无权执行此操作')
    expect((content(root).findAll('input[role="switch"]')[1]?.element as HTMLInputElement).checked).toBe(false)
  })
})
