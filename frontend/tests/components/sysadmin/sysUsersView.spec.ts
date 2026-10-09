// FE-6 G2 / G3（ACC-M2-08）：“管理员与授权”“用户”两页挂载后的渲染结果与操作。密码框的属性与密码不外泄。
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { buttonIn, content, fieldByLabel, openSysApp } from './support'

vi.mock('../../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/api/index')>()
  const { swappedApi } = await import('../apiSwap')
  return { ...actual, api: swappedApi() }
})

const SECRET = 'S3cret-Pass-9'
type Main = ReturnType<typeof content>

function rowOf(main: Main, username: string) {
  const row = main.findAll('tbody tr').find((item) => item.text().startsWith(username))
  if (row === undefined) {
    throw new Error(`找不到 ${username}`)
  }
  return row
}

const dialogOf = (main: Main) => main.get('[role="dialog"]')

describe('G2 管理员与授权页', () => {
  it('只列场馆管理员，含授权场馆列；没有角色筛选', async () => {
    const { root } = await openSysApp('/sys-admin/admins')
    const main = content(root)

    expect(main.get('h1').text()).toBe('管理员与授权')
    expect(main.findAll('th').map((th) => th.text())).toEqual(['用户名', '显示名', '角色', '账号状态', '授权场馆', '操作'])
    expect(main.findAll('tbody tr').map((row) => row.findAll('td').map((td) => td.text()).slice(0, 5))).toEqual([
      ['admin_tennis', '网球馆管理员', '场馆管理员', '正常', '网球馆'],
      ['admin_pool', '游泳羽毛球馆管理员', '场馆管理员', '正常', '羽毛球馆、游泳馆'],
    ])
    expect(fieldByLabel(main, '关键字').exists()).toBe(true)
    expect(main.findAll('label.label').some((label) => label.text().startsWith('角色'))).toBe(false)
  })

  it('新建管理员并授权羽毛球馆：密码框 type=password / autocomplete=new-password；创建后新行出现，页面任何位置都没有密码', async () => {
    const { root } = await openSysApp('/sys-admin/admins')
    await buttonIn(content(root), '新建账号').trigger('click')
    const dialog = () => dialogOf(content(root))

    expect(dialog().get('h2').text()).toBe('新建账号')
    const password = fieldByLabel(dialog(), '密码')
    expect(password.attributes('type')).toBe('password')
    expect(password.attributes('autocomplete')).toBe('new-password')
    expect(password.attributes('maxlength')).toBe('64')
    expect(fieldByLabel(dialog(), '用户名').attributes('maxlength')).toBe('32')
    expect(dialog().findAll('label.label').some((label) => label.text().startsWith('角色'))).toBe(false)
    expect(dialog().findAll('label.label').some((label) => label.text().startsWith('用户类型'))).toBe(false)
    expect(dialog().findAll('fieldset label').map((label) => label.text())).toEqual(['网球馆', '羽毛球馆', '游泳馆'])

    await fieldByLabel(dialog(), '用户名').setValue('admin_new')
    await password.setValue(SECRET)
    await fieldByLabel(dialog(), '显示名').setValue('新管理员')
    await dialog().findAll('fieldset input')[1]?.setValue(true)
    expect(root.html()).not.toContain(SECRET)
    await buttonIn(dialog(), '创建').trigger('click')
    await flushPromises()

    expect(root.find('[role="dialog"]').exists()).toBe(false)
    expect(content(root).get('[role="status"]').text()).toBe('账号已创建')
    expect(rowOf(content(root), 'admin_new').findAll('td').map((td) => td.text()).slice(0, 5)).toEqual([
      'admin_new', '新管理员', '场馆管理员', '正常', '羽毛球馆',
    ])
    expect(root.html()).not.toContain(SECRET)
    expect(root.text()).not.toContain(SECRET)
  })

  it('用户名或密码不合格：对话框内提示，不创建；用户名已占用时显示接口文案', async () => {
    const { root } = await openSysApp('/sys-admin/admins')
    await buttonIn(content(root), '新建账号').trigger('click')
    const dialog = () => dialogOf(content(root))
    await fieldByLabel(dialog(), '用户名').setValue('ab')
    await buttonIn(dialog(), '创建').trigger('click')
    await flushPromises()
    expect(dialog().get('[role="alert"]').text()).toBe('用户名需为 3–32 位字母、数字或下划线')

    await fieldByLabel(dialog(), '用户名').setValue('admin_pool')
    await fieldByLabel(dialog(), '密码').setValue('short')
    await buttonIn(dialog(), '创建').trigger('click')
    await flushPromises()
    expect(dialog().get('[role="alert"]').text()).toBe('密码需为 8–64 位')

    await fieldByLabel(dialog(), '密码').setValue(SECRET)
    await fieldByLabel(dialog(), '显示名').setValue('重名')
    await buttonIn(dialog(), '创建').trigger('click')
    await flushPromises()
    expect(dialog().get('[role="alert"]').text()).toBe('用户名已被占用')
    expect(content(root).findAll('tbody tr')).toHaveLength(2)
  })
})

describe('N1 新建账号对话框的规则说明', () => {
  it('用户名与密码的规则是输入框下方的可见说明文字，不只放在占位符里', async () => {
    const { root } = await openSysApp('/sys-admin/admins')
    await buttonIn(content(root), '新建账号').trigger('click')
    const dialog = dialogOf(content(root))
    const fieldOf = (label: string) => fieldByLabel(dialog, label).element.closest('.field')

    expect(dialog.findAll('p.rule').map((rule) => rule.text())).toEqual(['3–32 位字母、数字或下划线', '8–64 位'])
    expect(fieldOf('用户名')?.querySelector('p.rule')?.textContent?.trim()).toBe('3–32 位字母、数字或下划线')
    expect(fieldOf('密码')?.querySelector('p.rule')?.textContent?.trim()).toBe('8–64 位')
    expect(fieldByLabel(dialog, '用户名').attributes('placeholder')).toBeUndefined()
    expect(fieldByLabel(dialog, '密码').attributes('placeholder')).toBeUndefined()
    // 输入内容后说明仍在；它不是错误提示，不带 role=alert。
    await fieldByLabel(dialog, '用户名').setValue('admin_new')
    expect(dialog.findAll('p.rule')).toHaveLength(2)
    expect(dialog.find('[role="alert"]').exists()).toBe(false)
  })

})

describe('G2 授权与停用', () => {
  it('调整授权：对话框勾选当前授权，保存后表格显示新范围', async () => {
    const { root, h } = await openSysApp('/sys-admin/admins')
    await buttonIn(rowOf(content(root), 'admin_tennis'), '调整授权').trigger('click')
    const dialog = () => dialogOf(content(root))

    expect(dialog().get('h2').text()).toBe('调整授权范围')
    expect(dialog().findAll('fieldset input').map((input) => (input.element as HTMLInputElement).checked)).toEqual([true, false, false])
    await dialog().findAll('fieldset input')[1]?.setValue(true)
    await buttonIn(dialog(), '保存').trigger('click')
    await flushPromises()

    expect(root.find('[role="dialog"]').exists()).toBe(false)
    expect(content(root).get('[role="status"]').text()).toBe('授权范围已更新')
    expect(rowOf(content(root), 'admin_tennis').findAll('td')[4]?.text()).toBe('网球馆、羽毛球馆')
    expect((await (await h.clientFor('admin_tennis')).adminListVenues()).map((venue) => venue.name)).toEqual(['网球馆', '羽毛球馆'])
  })

  it('取消勾选全部场馆后保存：授权范围为空，显示“未授权任何场馆”', async () => {
    const { root } = await openSysApp('/sys-admin/admins')
    await buttonIn(rowOf(content(root), 'admin_tennis'), '调整授权').trigger('click')
    await dialogOf(content(root)).findAll('fieldset input')[0]?.setValue(false)
    await buttonIn(dialogOf(content(root)), '保存').trigger('click')
    await flushPromises()

    expect(rowOf(content(root), 'admin_tennis').findAll('td')[4]?.text()).toBe('未授权任何场馆')
  })

  it('停用需确认，启用直接生效', async () => {
    const { root } = await openSysApp('/sys-admin/admins')
    await buttonIn(rowOf(content(root), 'admin_pool'), '停用').trigger('click')
    const dialog = () => dialogOf(content(root))
    expect(dialog().get('h2').text()).toBe('确认停用账号？')
    expect(rowOf(content(root), 'admin_pool').findAll('td')[3]?.text()).toBe('正常')

    await buttonIn(dialog(), '停用').trigger('click')
    await flushPromises()
    expect(content(root).get('[role="status"]').text()).toBe('已停用账号：游泳羽毛球馆管理员')
    expect(rowOf(content(root), 'admin_pool').findAll('td')[3]?.text()).toBe('已停用')

    await buttonIn(rowOf(content(root), 'admin_pool'), '启用').trigger('click')
    await flushPromises()
    expect(root.find('[role="dialog"]').exists()).toBe(false)
    expect(rowOf(content(root), 'admin_pool').findAll('td')[3]?.text()).toBe('正常')
    expect(content(root).get('[role="status"]').text()).toBe('已启用账号：游泳羽毛球馆管理员')
  })
})

describe('G3 用户页', () => {
  it('全部 7 个账号，没有授权场馆列；自己的账号没有“停用”按钮，其他账号有；场馆管理员有“调整授权”', async () => {
    const { root } = await openSysApp('/sys-admin/users')
    const main = content(root)

    expect(main.get('h1').text()).toBe('用户')
    expect(main.findAll('th').map((th) => th.text())).toEqual(['用户名', '显示名', '角色', '账号状态', '操作'])
    expect(main.findAll('tbody tr')).toHaveLength(7)
    expect(rowOf(main, 'sysadmin').findAll('button').map((button) => button.text())).toEqual(['改显示名'])
    expect(rowOf(main, 'zhangsan').findAll('button').map((button) => button.text())).toEqual(['改显示名', '停用'])
    expect(rowOf(main, 'admin_tennis').findAll('button').map((button) => button.text())).toEqual(['改显示名', '调整授权', '停用'])
  })

  it('按角色与关键字筛选，点“查询”才发请求', async () => {
    const { root } = await openSysApp('/sys-admin/users')
    await fieldByLabel(content(root), '角色').setValue('VENUE_ADMIN')
    expect(content(root).findAll('tbody tr')).toHaveLength(7)

    await buttonIn(content(root), '查询').trigger('submit')
    await flushPromises()
    expect(content(root).findAll('tbody tr').map((row) => row.findAll('td')[0]?.text())).toEqual(['admin_tennis', 'admin_pool'])

    await fieldByLabel(content(root), '角色').setValue('')
    await fieldByLabel(content(root), '关键字').setValue('zhang')
    await buttonIn(content(root), '查询').trigger('submit')
    await flushPromises()
    expect(content(root).findAll('tbody tr').map((row) => row.findAll('td')[0]?.text())).toEqual(['zhangsan'])
  })

  it('新建账号对话框：角色决定出现哪些字段（普通用户 → 用户类型；场馆管理员 → 授权场馆；系统管理员 → 都没有）', async () => {
    const { root } = await openSysApp('/sys-admin/users')
    await buttonIn(content(root), '新建账号').trigger('click')
    const dialog = () => dialogOf(content(root))
    const has = (label: string) => dialog().findAll('label.label').some((node) => node.text().startsWith(label))

    expect(fieldByLabel(dialog(), '角色').findAll('option').map((option) => option.text())).toEqual(['普通用户', '场馆管理员', '系统管理员'])
    expect(fieldByLabel(dialog(), '用户类型').findAll('option').map((option) => option.text())).toEqual(['学生', '教师', '其他'])
    expect(dialog().find('fieldset').exists()).toBe(false)

    await fieldByLabel(dialog(), '角色').setValue('VENUE_ADMIN')
    expect(has('用户类型')).toBe(false)
    expect(dialog().find('fieldset').exists()).toBe(true)

    await fieldByLabel(dialog(), '角色').setValue('SYS_ADMIN')
    expect(has('用户类型')).toBe(false)
    expect(dialog().find('fieldset').exists()).toBe(false)
    expect(fieldByLabel(dialog(), '密码').attributes('type')).toBe('password')
    expect(fieldByLabel(dialog(), '密码').attributes('autocomplete')).toBe('new-password')
  })

})

describe('G3 新建、改名与停用', () => {
  it('新建普通用户（教师）：新行出现，页面没有密码', async () => {
    const { root } = await openSysApp('/sys-admin/users')
    await buttonIn(content(root), '新建账号').trigger('click')
    const dialog = () => dialogOf(content(root))
    await fieldByLabel(dialog(), '用户名').setValue('teacher_a')
    await fieldByLabel(dialog(), '密码').setValue(SECRET)
    await fieldByLabel(dialog(), '显示名').setValue('甲老师')
    await fieldByLabel(dialog(), '用户类型').setValue('TEACHER')
    await buttonIn(dialog(), '创建').trigger('click')
    await flushPromises()

    expect(rowOf(content(root), 'teacher_a').findAll('td').map((td) => td.text()).slice(0, 4)).toEqual(['teacher_a', '甲老师', '普通用户', '正常'])
    expect(root.text()).not.toContain(SECRET)
    expect(root.html()).not.toContain(SECRET)
  })

  it('改显示名：maxlength=50，空名称提示，保存后表格更新', async () => {
    const { root } = await openSysApp('/sys-admin/users')
    await buttonIn(rowOf(content(root), 'zhangsan'), '改显示名').trigger('click')
    const dialog = () => dialogOf(content(root))

    expect(fieldByLabel(dialog(), '显示名').attributes('maxlength')).toBe('50')
    await fieldByLabel(dialog(), '显示名').setValue(' ')
    await buttonIn(dialog(), '保存').trigger('click')
    await flushPromises()
    expect(dialog().get('[role="alert"]').text()).toBe('请填写显示名')

    await fieldByLabel(dialog(), '显示名').setValue('张三丰')
    await buttonIn(dialog(), '保存').trigger('click')
    await flushPromises()
    expect(rowOf(content(root), 'zhangsan').findAll('td')[1]?.text()).toBe('张三丰')
    expect(content(root).get('[role="status"]').text()).toBe('显示名已保存')
  })

  it('停用再启用 zhangsan：停用后无法登录，启用后可以', async () => {
    const { root, h } = await openSysApp('/sys-admin/users')
    await buttonIn(rowOf(content(root), 'zhangsan'), '停用').trigger('click')
    await buttonIn(dialogOf(content(root)), '停用').trigger('click')
    await flushPromises()
    expect(rowOf(content(root), 'zhangsan').findAll('td')[3]?.text()).toBe('已停用')
    await expect(h.clientFor('zhangsan')).rejects.toMatchObject({ code: 'ACCOUNT_DISABLED' })

    await buttonIn(rowOf(content(root), 'zhangsan'), '启用').trigger('click')
    await flushPromises()
    expect(rowOf(content(root), 'zhangsan').findAll('td')[3]?.text()).toBe('正常')
    const client = await h.clientFor('zhangsan')
    expect(await client.listVenues()).toHaveLength(3)
  })
})
