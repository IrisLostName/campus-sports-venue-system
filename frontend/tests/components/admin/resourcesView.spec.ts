// FE-5 P3 / P4：“场地与开放规则”页挂载后的渲染结果与操作（ACC-M2-07；演示：维护 + 影响对话框、改数量、加 / 删关闭）。
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { ImpactChangeResponse, Resource } from '../../../src/api/types'
import { deferred } from '../../display/support'
import { buttonIn, content, fieldByLabel, openAdminApp } from './support'

vi.mock('../../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/api/index')>()
  const { swappedApi } = await import('../apiSwap')
  return { ...actual, api: swappedApi() }
})

async function openPage() {
  return openAdminApp('/venue-admin/resources')
}

function rowOf(main: ReturnType<typeof content>, name: string) {
  const row = main.get('section[aria-label="场地"]').findAll('tbody tr').find((item) => item.text().includes(name))
  if (row === undefined) {
    throw new Error(`找不到 ${name}`)
  }
  return row
}

describe('P3 页面内容', () => {
  it('依次是场地、设定数量、每周窗口、特殊关闭、场馆简介；场地含状态与按钮', async () => {
    const { root } = await openPage()
    const main = content(root)

    expect(main.get('h1').text()).toBe('场地与开放规则')
    expect(main.findAll('h2').map((h2) => h2.text())).toEqual(['场地', '设定场地数量', '每周开放窗口', '特殊关闭', '场馆简介'])
    expect(main.get('section[aria-label="场地"]').findAll('tbody tr')).toHaveLength(4)
    expect(rowOf(main, '网球场1').findAll('td').map((td) => td.text()).slice(0, 3)).toEqual(['网球场1', '球场', '开放'])
    expect(rowOf(main, '网球场1').findAll('button').map((button) => button.text())).toEqual(['改名', '设为维护', '停用'])
    expect((fieldByLabel(main, '场地数量').element as HTMLInputElement).value).toBe('4')
    expect(main.findAll('section[aria-label="每周开放窗口"] li.row').length).toBeGreaterThan(0)
  })

  it('场馆简介表单里没有系统管理员才能改的字段', async () => {
    const { root } = await openPage()
    const form = content(root).get('form[aria-label="场馆简介"]')

    expect(form.findAll('label.label').map((label) => label.text())).toEqual(['简介'])
  })
})

describe('P4 影响对话框（维护）', () => {
  it('设为维护：列出受影响预约，不预选；先要求选择，选取消再要求原因，提交后显示取消数量', async () => {
    const { root } = await openPage()
    const main = content(root)
    await buttonIn(rowOf(main, '网球场1'), '设为维护').trigger('click')
    await flushPromises()

    const dialog = main.get('[role="dialog"]')
    expect(dialog.get('h2').text()).toBe('将 网球场1 设为维护')
    expect(dialog.findAll('.list li').map((li) => li.text())).toEqual(['网球场1 · 2026-10-13 08:00–09:30 · 张三'])
    expect(dialog.findAll('input[type="radio"]').map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([false, false])

    await buttonIn(dialog, '确认提交').trigger('click')
    await flushPromises()
    expect(dialog.get('[role="alert"]').text()).toBe('请选择保留或取消')

    await dialog.findAll('input[type="radio"]')[1]?.setValue(true)
    await buttonIn(dialog, '确认提交').trigger('click')
    await flushPromises()
    expect(dialog.get('[role="alert"]').text()).toBe('请填写原因')

    await dialog.get('textarea').setValue('场地检修')
    await buttonIn(dialog, '确认提交').trigger('click')
    await flushPromises()

    expect(main.find('[role="dialog"]').exists()).toBe(false)
    expect(main.get('[role="status"]').text()).toBe('已保存，并取消 1 个受影响预约')
    expect(rowOf(main, '网球场1').findAll('td')[2]?.text()).toBe('维护中')
    expect(rowOf(main, '网球场1').findAll('button').map((button) => button.text())).toEqual(['改名', '恢复开放', '停用'])
  })

  it('没有受影响预约：对话框只是普通确认', async () => {
    const { root } = await openPage()
    const main = content(root)
    await buttonIn(rowOf(main, '网球场4'), '停用').trigger('click')
    await flushPromises()
    const dialog = main.get('[role="dialog"]')

    expect(dialog.get('.none').text()).toBe('该操作不影响已有预约。')
    await buttonIn(dialog, '确认').trigger('click')
    await flushPromises()
    expect(rowOf(main, '网球场4').findAll('td')[2]?.text()).toBe('已停用')
    expect(rowOf(main, '网球场4').findAll('button').map((button) => button.text())).toEqual(['改名', '重新启用'])
  })

  it('取消对话框：什么都不改', async () => {
    const { root } = await openPage()
    const main = content(root)
    await buttonIn(rowOf(main, '网球场1'), '停用').trigger('click')
    await flushPromises()
    await buttonIn(main.get('[role="dialog"]'), '取消').trigger('click')

    expect(main.find('[role="dialog"]').exists()).toBe(false)
    expect(rowOf(main, '网球场1').findAll('td')[2]?.text()).toBe('开放')
  })
})

describe('P3 改名与数量', () => {
  it('改名：对话框里改名字，保存后列表更新', async () => {
    const { root } = await openPage()
    const main = content(root)
    await buttonIn(rowOf(main, '网球场3'), '改名').trigger('click')
    const dialog = main.get('[role="dialog"]')
    expect(dialog.get('input').attributes('maxlength')).toBe('50')
    await dialog.get('input').setValue('')
    await buttonIn(dialog, '保存').trigger('click')
    expect(dialog.get('[role="alert"]').text()).toBe('请填写场地名称')
    await dialog.get('input').setValue('训练场')
    await buttonIn(dialog, '保存').trigger('click')
    await flushPromises()

    expect(main.get('[role="status"]').text()).toBe('场地已改名')
    expect(main.get('section[aria-label="场地"]').findAll('tbody tr').map((row) => row.findAll('td')[0]?.text())).toContain('训练场')
  })

  it('FE-8 F1 改名提交中：点遮罩与“取消”都不关闭对话框；请求完成后才关闭并更新列表', async () => {
    const gate = deferred<void>()
    const { root } = await openAdminApp('/venue-admin/resources', {
      wrap: (api) => ({
        ...api,
        adminUpdateResource: async (...args): Promise<ImpactChangeResponse<Resource>> => {
          await gate.promise
          return api.adminUpdateResource(...args)
        },
      }),
    })
    const main = content(root)
    await buttonIn(rowOf(main, '网球场3'), '改名').trigger('click')
    await main.get('[role="dialog"] input').setValue('训练场')
    await buttonIn(main.get('[role="dialog"]'), '保存').trigger('click')
    await flushPromises()

    await main.get('.backdrop').trigger('click')
    expect(buttonIn(main.get('[role="dialog"]'), '取消').attributes('disabled')).toBeDefined()
    await buttonIn(main.get('[role="dialog"]'), '取消').trigger('click')
    await flushPromises()
    expect(main.find('[role="dialog"]').exists()).toBe(true)
    expect((main.get('[role="dialog"] input').element as HTMLInputElement).value).toBe('训练场')

    gate.resolve()
    await flushPromises()
    expect(main.find('[role="dialog"]').exists()).toBe(false)
    expect(main.get('[role="status"]').text()).toBe('场地已改名')
    expect(main.get('section[aria-label="场地"]').findAll('tbody tr').map((row) => row.findAll('td')[0]?.text())).toContain('训练场')
  })

  it('设定数量：改成 3 → 影响对话框 → 确认后网球场4 停用，表单显示 3', async () => {
    const { root } = await openPage()
    const main = content(root)
    const form = main.get('form[aria-label="设定场地数量"]')
    expect(fieldByLabel(form, '名称前缀').attributes('maxlength')).toBe('40')
    expect(form.findAll('option').map((option) => option.text())).toEqual(['请选择', '球场', '泳道', '其他'])

    await fieldByLabel(form, '场地数量').setValue('99')
    await buttonIn(form, '设定数量').trigger('submit')
    await flushPromises()
    expect(main.get('[role="alert"]').text()).toBe('场地数量须为 0 到 50 的整数')

    await fieldByLabel(form, '场地数量').setValue('3')
    await buttonIn(form, '设定数量').trigger('submit')
    await flushPromises()
    expect(main.get('[role="dialog"] h2').text()).toBe('将场地数量设为 3')
    await buttonIn(main.get('[role="dialog"]'), '确认').trigger('click')
    await flushPromises()

    expect(rowOf(main, '网球场4').findAll('td')[2]?.text()).toBe('已停用')
    expect((fieldByLabel(main, '场地数量').element as HTMLInputElement).value).toBe('3')
  })
})

describe('P3 窗口、关闭、简介', () => {
  it('每周窗口：添加一行、不填时间保存会提示；删除该行后恢复', async () => {
    const { root } = await openPage()
    const main = content(root)
    const editor = main.get('section[aria-label="每周开放窗口"]')
    const before = editor.findAll('li.row').length
    await buttonIn(editor, '添加窗口').trigger('click')
    expect(editor.findAll('li.row')).toHaveLength(before + 1)
    await buttonIn(editor, '保存每周窗口').trigger('click')
    await flushPromises()
    expect(main.get('[role="alert"]').text()).toBe('请填写每个窗口的开放时间和关闭时间')

    await buttonIn(editor.findAll('li.row')[before] as never, '删除窗口').trigger('click')
    expect(editor.findAll('li.row')).toHaveLength(before)
  })

  it('每周窗口：长度不合法时显示 RULE_INVALID 文案', async () => {
    const { root } = await openPage()
    const main = content(root)
    const editor = main.get('section[aria-label="每周开放窗口"]')
    await editor.findAll('li.row')[0]?.findAll('input')[1]?.setValue('08:30')
    await buttonIn(editor, '保存每周窗口').trigger('click')
    await flushPromises()

    expect(main.get('[role="alert"]').text()).toBe('开放规则不合法：窗口长度必须是 90 分钟的整数倍')
    expect(main.find('[role="dialog"]').exists()).toBe(false)
  })

  it('特殊关闭：新增整馆关闭（影响对话框，保留），再删除', async () => {
    const { root } = await openPage()
    const main = content(root)
    const closures = main.get('section[aria-label="特殊关闭"]')
    expect(closures.get('.ui-empty-state .title').text()).toBe('没有特殊关闭')

    const form = closures.get('form')
    await fieldByLabel(form, '起始日期').setValue('2026-10-13')
    await fieldByLabel(form, '截止日期').setValue('2026-10-13')
    await fieldByLabel(form, '原因').setValue('节假日')
    await buttonIn(form, '新增关闭').trigger('submit')
    await flushPromises()

    const dialog = main.get('[role="dialog"]')
    expect(dialog.get('h2').text()).toBe('新增特殊关闭')
    await dialog.findAll('input[type="radio"]')[0]?.setValue(true)
    await buttonIn(dialog, '确认提交').trigger('click')
    await flushPromises()

    expect(closures.findAll('tbody tr').map((row) => row.findAll('td').slice(0, 3).map((td) => td.text()))).toEqual([['2026-10-13', '整馆', '节假日']])

    await buttonIn(closures, '删除').trigger('click')
    expect(main.get('[role="dialog"] h2').text()).toBe('确认删除特殊关闭？')
    await buttonIn(main.get('[role="dialog"]'), '删除').trigger('click')
    await flushPromises()
    expect(main.get('[role="status"]').text()).toBe('特殊关闭已移除')
    expect(closures.find('table').exists()).toBe(false)
  })

  it('场馆简介：保存后提示，管理员重新读取能看到', async () => {
    const { root, h } = await openPage()
    const main = content(root)
    const form = main.get('form[aria-label="场馆简介"]')
    await fieldByLabel(form, '简介').setValue('室内网球馆')
    await buttonIn(form, '保存简介').trigger('submit')
    await flushPromises()

    expect(main.get('[role="status"]').text()).toBe('场馆简介已保存')
    expect((await h.api.adminListVenues())[0]?.description).toBe('室内网球馆')
  })
})
