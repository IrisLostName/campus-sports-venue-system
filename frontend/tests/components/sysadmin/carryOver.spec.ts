// FE-6 对 FE-5 遗留的处理（FE-5 裁决 §6）：N1 简介 maxlength=500、N2 原因 maxlength=200、N3 改派对话框登录失效、N4 URL 规范化、N5 简介未改动不提交。
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../src/api/errors'
import { recordCalls } from '../apiSwap'
import { buttonIn, content, fieldByLabel, openSysApp } from './support'

vi.mock('../../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/api/index')>()
  const { swappedApi } = await import('../apiSwap')
  return { ...actual, api: swappedApi() }
})

describe('N1 场馆简介 maxlength=500', () => {
  it('场馆管理员的“场馆简介”表单与系统管理员的编辑对话框都限制 500', async () => {
    const venueAdmin = await openSysApp('/venue-admin/resources', { username: 'admin_tennis' })
    expect(fieldByLabel(content(venueAdmin.root).get('form[aria-label="场馆简介"]'), '简介').attributes('maxlength')).toBe('500')

    const sysAdmin = await openSysApp('/sys-admin')
    await buttonIn(content(sysAdmin.root).get('tbody tr'), '编辑资料').trigger('click')
    expect(fieldByLabel(content(sysAdmin.root).get('[role="dialog"]'), '简介').attributes('maxlength')).toBe('500')
  })
})

describe('N2 原因输入 maxlength=200', () => {
  it('特殊关闭表单的原因', async () => {
    const { root } = await openSysApp('/venue-admin/resources', { username: 'admin_tennis' })
    const section = content(root).get('section[aria-label="特殊关闭"]')

    expect(fieldByLabel(section, '原因').attributes('maxlength')).toBe('200')
  })

  it('取消预约、改派人员、改派场地、影响对话框的原因（场馆管理员端）', async () => {
    const { root } = await openSysApp('/venue-admin/reservations', { username: 'admin_tennis' })
    const first = () => content(root).findAll('tbody tr')[0]
    const reasonLimit = () => content(root).get('[role="dialog"] textarea').attributes('maxlength')

    await buttonIn(first()!, '取消').trigger('click')
    expect(reasonLimit()).toBe('200')
    await buttonIn(content(root).get('[role="dialog"]'), '取消').trigger('click')
    await buttonIn(first()!, '改派人员').trigger('click')
    expect(reasonLimit()).toBe('200')
    await buttonIn(content(root).get('[role="dialog"]'), '取消').trigger('click')
    await buttonIn(first()!, '改派场地').trigger('click')
    await flushPromises()
    expect(reasonLimit()).toBe('200')
  })

  it('影响对话框的原因（设为维护）', async () => {
    const { root } = await openSysApp('/venue-admin/resources', { username: 'admin_tennis' })
    const row = content(root).get('section[aria-label="场地"]').findAll('tbody tr')[0]
    await buttonIn(row!, '设为维护').trigger('click')
    await flushPromises()

    expect(content(root).get('[role="dialog"] textarea').attributes('maxlength')).toBe('200')
  })
})

describe('N3 改派对话框的占用查询遇到 TOKEN_EXPIRED', () => {
  it.each([
    ['/venue-admin/reservations', 'admin_tennis'],
    ['/sys-admin/reservations', 'sysadmin'],
  ])('%s：回到登录页，对话框关闭，不展示错误', async (path, username) => {
    const { root, router, h } = await openSysApp(path, {
      username,
      wrap: (api) => ({ ...api, adminGetOccupancy: () => Promise.reject(new ApiError(401, 'TOKEN_EXPIRED', '过期')) }),
    })
    await buttonIn(content(root).findAll('tbody tr')[0]!, '改派场地').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/login')
    expect(h.auth.isAuthenticated).toBe(false)
    expect(root.find('[role="dialog"]').exists()).toBe(false)
  })
})

describe('N4 场馆选择的 URL 规范化在查询参数变化时也执行', () => {
  it('场馆管理员端：打开后把 venueId 改成不在授权范围的值或乱码，都会被改回第一个授权场馆', async () => {
    const { router } = await openSysApp('/venue-admin/resources?venueId=3', { username: 'admin_pool' })
    expect(router.currentRoute.value.query.venueId).toBe('3')

    await router.replace({ query: { venueId: '1' } })
    await flushPromises()
    expect(router.currentRoute.value.query.venueId).toBe('2')

    await router.replace({ query: { venueId: 'abc' } })
    await flushPromises()
    expect(router.currentRoute.value.query.venueId).toBe('2')
  })

  it('有效的变化保持不变，页面随之重新取数', async () => {
    const { router, root } = await openSysApp('/venue-admin/occupancy?venueId=2', { username: 'admin_pool' })
    await router.replace({ query: { venueId: '3' } })
    await flushPromises()

    expect(router.currentRoute.value.query.venueId).toBe('3')
    expect(content(root).get('p.hint').text()).toContain('游泳馆')
  })
})

describe('N5 场馆简介没有改动时不提交', () => {
  it('简介为 null 的场馆点“保存简介”：不发 adminUpdateVenue；改了之后才发', async () => {
    let tracker: ReturnType<typeof recordCalls> | null = null
    const { root } = await openSysApp('/venue-admin/resources', {
      username: 'admin_tennis',
      wrap: (api) => {
        tracker = recordCalls(api)
        return tracker.client
      },
    })
    const form = () => content(root).get('form[aria-label="场馆简介"]')
    await buttonIn(form(), '保存简介').trigger('submit')
    await flushPromises()
    expect(tracker!.calls).not.toContain('adminUpdateVenue')
    expect(content(root).find('[role="status"]').exists()).toBe(false)

    await fieldByLabel(form(), '简介').setValue('室内网球场')
    await buttonIn(form(), '保存简介').trigger('submit')
    await flushPromises()
    expect(tracker!.calls.filter((call) => call === 'adminUpdateVenue')).toHaveLength(1)
    expect(content(root).get('[role="status"]').text()).toBe('场馆简介已保存')
  })
})
