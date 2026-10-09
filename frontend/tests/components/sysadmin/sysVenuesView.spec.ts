// FE-6 G1（ACC-M2-08）：“场馆资料与开关”页挂载后的渲染结果与操作——新增、编辑、开放预约开关、关闭（影响对话框）、重新开放。
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../src/api/errors'
import { buttonIn, content, fieldByLabel, openSysApp } from './support'

vi.mock('../../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/api/index')>()
  const { swappedApi } = await import('../apiSwap')
  return { ...actual, api: swappedApi() }
})

type Main = ReturnType<typeof content>

function rowOf(main: Main, name: string) {
  const row = main.findAll('tbody tr').find((item) => item.text().startsWith(name))
  if (row === undefined) {
    throw new Error(`找不到 ${name}`)
  }
  return row
}

describe('G1 页面内容', () => {
  it('标题、三个场馆行（名称 / 类型 / 位置 / 运营状态 / 开关 / 场地数）和三张表单入口', async () => {
    const { root } = await openSysApp('/sys-admin')
    const main = content(root)

    expect(main.get('h1').text()).toBe('场馆资料与开关')
    expect(main.findAll('th').map((th) => th.text())).toEqual(['名称', '类型', '位置', '运营状态', '对用户开放预约', '场地数', '操作'])
    expect(main.findAll('tbody tr').map((row) => row.findAll('td').map((td) => td.text()).slice(0, 6))).toEqual([
      ['网球馆', '网球', '—', '开放', '已开放', '4'],
      ['羽毛球馆', '羽毛球', '—', '开放', '未开放', '6'],
      ['游泳馆', '游泳', '—', '开放', '未开放', '6'],
    ])
    expect(rowOf(main, '网球馆').findAll('button, a').map((node) => node.text())).toEqual(['编辑资料', '场地与开放规则', '关闭场馆'])
    expect(main.get('form[aria-label="新增场馆"] h2').text()).toBe('新增场馆')
  })

  it('开关是带名称的 switch：状态来自接口，只有网球馆是开的；状态文字用文字而不是状态胶囊', async () => {
    const { root } = await openSysApp('/sys-admin')
    const switches = content(root).findAll('input[role="switch"]')

    expect(switches.map((node) => node.attributes('aria-label'))).toEqual([
      '对用户开放预约：网球馆', '对用户开放预约：羽毛球馆', '对用户开放预约：游泳馆',
    ])
    expect(switches.map((node) => (node.element as HTMLInputElement).checked)).toEqual([true, false, false])
    expect(content(root).find('.ui-status-pill').exists()).toBe(false)
  })
})

describe('G1 开放预约开关（演示：羽毛球馆一键开放）', () => {
  it('打开羽毛球馆：提示成功、开关保持打开、没有影响对话框；同一会话里 zhangsan 看到该场馆可预约', async () => {
    const { root, h } = await openSysApp('/sys-admin')
    const zhangsan = await h.clientFor('zhangsan')
    expect((await zhangsan.listVenues()).find((venue) => venue.id === 2)?.bookable).toBe(false)

    await rowOf(content(root), '羽毛球馆').get('input[role="switch"]').setValue(true)
    await flushPromises()

    expect(content(root).get('[role="status"]').text()).toBe('羽毛球馆已对用户开放预约')
    expect((rowOf(content(root), '羽毛球馆').get('input[role="switch"]').element as HTMLInputElement).checked).toBe(true)
    expect(rowOf(content(root), '羽毛球馆').findAll('td')[4]?.text()).toBe('已开放')
    expect(root.find('[role="dialog"]').exists()).toBe(false)
    expect((await zhangsan.listVenues()).find((venue) => venue.id === 2)?.bookable).toBe(true)
  })

  it('关闭有预约的网球馆的开关：直接生效，不弹对话框，既有预约不变', async () => {
    const { root, h } = await openSysApp('/sys-admin')
    await rowOf(content(root), '网球馆').get('input[role="switch"]').setValue(false)
    await flushPromises()

    expect(content(root).get('[role="status"]').text()).toBe('网球馆已暂停对用户开放预约')
    expect(root.find('[role="dialog"]').exists()).toBe(false)
    const reservations = await h.api.adminListReservations({ venueId: 1 })
    expect(reservations.items.map((item) => item.status)).toEqual(['CONFIRMED', 'CONFIRMED'])
  })

  it('接口失败：提示错误，开关回到服务端的值', async () => {
    const { root } = await openSysApp('/sys-admin', {
      wrap: (api) => ({ ...api, adminUpdateVenue: () => Promise.reject(new ApiError(403, 'FORBIDDEN', '无权')) }),
    })
    await rowOf(content(root), '羽毛球馆').get('input[role="switch"]').setValue(true)
    await flushPromises()

    expect((rowOf(content(root), '羽毛球馆').get('input[role="switch"]').element as HTMLInputElement).checked).toBe(false)
    expect(content(root).get('[role="alert"]').text()).toBe('无权执行此操作')
  })
})

describe('G1 新增场馆（演示：新增一个场馆）', () => {
  it('字段长度上限取自 docs/13：名称 50、位置 100、简介 500', async () => {
    const { root } = await openSysApp('/sys-admin')
    const form = content(root).get('form[aria-label="新增场馆"]')

    expect(fieldByLabel(form, '名称').attributes('maxlength')).toBe('50')
    expect(fieldByLabel(form, '位置').attributes('maxlength')).toBe('100')
    expect(fieldByLabel(form, '简介').attributes('maxlength')).toBe('500')
    expect(fieldByLabel(form, '类型').findAll('option').map((option) => option.text())).toEqual(['请选择', '网球', '羽毛球', '游泳', '篮球', '其他'])
  })

  it('未填名称 / 类型：表单内显示提示；填写后新增，表格出现新行（默认开放、不开放预约、0 个场地），并指向场地与开放规则', async () => {
    const { root, router } = await openSysApp('/sys-admin')
    const form = () => content(root).get('form[aria-label="新增场馆"]')
    await buttonIn(form(), '新增场馆').trigger('submit')
    await flushPromises()
    expect(form().get('[role="alert"]').text()).toBe('请填写场馆名称')

    await fieldByLabel(form(), '名称').setValue('篮球馆')
    await buttonIn(form(), '新增场馆').trigger('submit')
    await flushPromises()
    expect(form().get('[role="alert"]').text()).toBe('请选择场馆类型')

    await fieldByLabel(form(), '类型').setValue('BASKETBALL')
    await buttonIn(form(), '新增场馆').trigger('submit')
    await flushPromises()

    expect(rowOf(content(root), '篮球馆').findAll('td').map((td) => td.text()).slice(0, 6)).toEqual(['篮球馆', '篮球', '—', '开放', '未开放', '0'])
    expect(content(root).get('[role="status"]').text()).toBe('已新增场馆“篮球馆”。请到“场地与开放规则”设定场地数量和每周开放窗口。')
    expect((fieldByLabel(form(), '名称').element as HTMLInputElement).value).toBe('')

    const next = content(root).get('a[href*="/sys-admin/resources"]')
    expect(next.attributes('href')).toBe('/sys-admin/resources?venueId=4')
    await next.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/sys-admin/resources?venueId=4')
    expect(content(root).get('h1').text()).toBe('场地与开放规则')
    expect(fieldByLabel(root.get('header'), '场馆').findAll('option').map((option) => option.text())).toContain('篮球馆')
  })
})

describe('G1 / N1 编辑资料', () => {
  it('对话框预填当前值，简介 maxlength=500；只改位置后保存，表格显示新位置', async () => {
    const { root, h } = await openSysApp('/sys-admin')
    await buttonIn(rowOf(content(root), '网球馆'), '编辑资料').trigger('click')
    const dialog = () => content(root).get('[role="dialog"]')

    expect(dialog().get('h2').text()).toBe('编辑场馆资料')
    expect((fieldByLabel(dialog(), '名称').element as HTMLInputElement).value).toBe('网球馆')
    expect((fieldByLabel(dialog(), '类型').element as HTMLSelectElement).value).toBe('TENNIS')
    expect(fieldByLabel(dialog(), '简介').attributes('maxlength')).toBe('500')

    await buttonIn(dialog(), '保存').trigger('click')
    await flushPromises()
    expect(dialog().get('[role="alert"]').text()).toBe('没有需要保存的修改')

    await fieldByLabel(dialog(), '位置').setValue('东区体育中心')
    await buttonIn(dialog(), '保存').trigger('click')
    await flushPromises()

    expect(root.find('[role="dialog"]').exists()).toBe(false)
    expect(content(root).get('[role="status"]').text()).toBe('场馆资料已保存')
    expect(rowOf(content(root), '网球馆').findAll('td')[2]?.text()).toBe('东区体育中心')
    expect((await h.api.adminListVenues())[0]?.description).toBeNull()
  })
})

describe('G1 / N2 关闭场馆与重新开放', () => {
  it('网球馆有 2 个未来预约：影响对话框列出预约，保留 / 取消都不预选，原因 maxlength=200；选取消并填原因后场馆关闭', async () => {
    const { root, h } = await openSysApp('/sys-admin')
    await buttonIn(rowOf(content(root), '网球馆'), '关闭场馆').trigger('click')
    await flushPromises()
    const dialog = () => content(root).get('[role="dialog"]')

    expect(dialog().get('h2').text()).toBe('关闭场馆：网球馆')
    expect(dialog().findAll('.list li').map((li) => li.text())).toEqual([
      '网球场1 · 2026-10-13 08:00–09:30 · 张三', '网球场2 · 2026-10-13 09:30–11:00 · 李四',
    ])
    expect(dialog().findAll('input[type="radio"]').map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([false, false])
    expect(dialog().get('textarea').attributes('maxlength')).toBe('200')
    expect(rowOf(content(root), '网球馆').findAll('td')[3]?.text()).toBe('开放')

    await buttonIn(dialog(), '确认提交').trigger('click')
    await flushPromises()
    expect(dialog().get('[role="alert"]').text()).toBe('请选择保留或取消')

    await dialog().findAll('input[type="radio"]')[1]?.setValue(true)
    await buttonIn(dialog(), '确认提交').trigger('click')
    await flushPromises()
    expect(dialog().get('[role="alert"]').text()).toBe('请填写原因')

    await dialog().get('textarea').setValue('场馆装修')
    await buttonIn(dialog(), '确认提交').trigger('click')
    await flushPromises()

    expect(root.find('[role="dialog"]').exists()).toBe(false)
    expect(content(root).get('[role="status"]').text()).toBe('已保存，并取消 2 个受影响预约')
    expect(rowOf(content(root), '网球馆').findAll('td')[3]?.text()).toBe('已关闭')
    expect((await h.api.adminListReservations({ venueId: 1 })).items.map((item) => item.status)).toEqual(['ADMIN_CANCELLED', 'ADMIN_CANCELLED'])
  })

  it('没有受影响预约的游泳馆：对话框写明不影响预约，确认后关闭；“重新开放”直接生效', async () => {
    const { root } = await openSysApp('/sys-admin')
    await buttonIn(rowOf(content(root), '游泳馆'), '关闭场馆').trigger('click')
    await flushPromises()
    const dialog = () => content(root).get('[role="dialog"]')

    expect(dialog().text()).toContain('该操作不影响已有预约。')
    await buttonIn(dialog(), '确认').trigger('click')
    await flushPromises()
    expect(rowOf(content(root), '游泳馆').findAll('td')[3]?.text()).toBe('已关闭')
    expect(rowOf(content(root), '游泳馆').findAll('button').map((button) => button.text())).toContain('重新开放')

    await buttonIn(rowOf(content(root), '游泳馆'), '重新开放').trigger('click')
    await flushPromises()

    expect(root.find('[role="dialog"]').exists()).toBe(false)
    expect(content(root).get('[role="status"]').text()).toBe('场馆已重新开放')
    expect(rowOf(content(root), '游泳馆').findAll('td')[3]?.text()).toBe('开放')
  })
})
