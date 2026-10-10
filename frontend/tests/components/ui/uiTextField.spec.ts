// UI-1 UiTextField（docs/17 第 6 节）：标签、maxlength、错误文案、计数、三种控件与属性去向。
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UiTextField from '../../../src/components/ui/UiTextField.vue'

describe('标签与输入框', () => {
  it('标签文字是 <label> 的第一个子节点，输入框在标签里面', () => {
    const field = mount(UiTextField, { props: { label: '用户名', modelValue: '' } })

    const label = field.find('label')
    expect(label.element.firstChild?.textContent?.trim()).toBe('用户名')
    expect(label.find('input').exists()).toBe(true)
  })

  it('输入：发出 update:modelValue', async () => {
    const field = mount(UiTextField, { props: { label: '用户名', modelValue: '' } })

    await field.find('input').setValue('zhangsan')

    expect(field.emitted('update:modelValue')).toEqual([['zhangsan']])
  })

  it('maxlength 原样写到控件上；没传则没有该属性', () => {
    expect(mount(UiTextField, { props: { label: '用途', modelValue: '', maxlength: 200 } }).find('input').attributes('maxlength')).toBe('200')
    expect(mount(UiTextField, { props: { label: '用途', modelValue: '' } }).find('input').attributes('maxlength')).toBeUndefined()
  })

  it('class 与 style 落在最外层，其余属性落在控件上', () => {
    const field = mount(UiTextField, {
      props: { label: '密码', modelValue: '' },
      attrs: { class: 'wide', type: 'password', autocomplete: 'new-password' },
    })

    expect(field.classes()).toContain('wide')
    expect(field.attributes('type')).toBeUndefined()
    expect(field.find('input').attributes('type')).toBe('password')
    expect(field.find('input').attributes('autocomplete')).toBe('new-password')
    expect(field.find('input').classes()).not.toContain('wide')
  })
})

describe('错误文案', () => {
  it('没有错误：不渲染提示，控件不标记无效', () => {
    const field = mount(UiTextField, { props: { label: '姓名', modelValue: '' } })

    expect(field.find('[role="alert"]').exists()).toBe(false)
    expect(field.find('input').attributes('aria-invalid')).toBeUndefined()
  })

  it('有错误：role=alert 显示文案，控件 aria-invalid，aria-describedby 指向该提示', () => {
    const field = mount(UiTextField, { props: { label: '姓名', modelValue: '', error: '请填写姓名' } })

    const alert = field.find('[role="alert"]')
    expect(alert.text()).toBe('请填写姓名')
    expect(field.find('input').attributes('aria-invalid')).toBe('true')
    expect(field.find('input').attributes('aria-describedby')).toBe(alert.attributes('id'))
  })
})

describe('说明文字 hint（FE-8 L10，可选）', () => {
  it('没有 hint：不渲染说明，控件也没有 aria-describedby（既有用法不变）', () => {
    const field = mount(UiTextField, { props: { label: '姓名', modelValue: '' } })

    expect(field.find('.help').exists()).toBe(false)
    expect(field.find('input').attributes('aria-describedby')).toBeUndefined()
  })

  it('有 hint：在控件下方显示可见文字，aria-describedby 指向它，且它不是 role=alert', () => {
    const field = mount(UiTextField, { props: { label: '用户名', modelValue: '', hint: '3–32 位字母、数字或下划线' } })

    const help = field.get('p.help')
    expect(help.text()).toBe('3–32 位字母、数字或下划线')
    expect(help.attributes('role')).toBeUndefined()
    expect(field.find('input').attributes('aria-describedby')).toBe(help.attributes('id'))
    expect(field.find('input').attributes('aria-invalid')).toBeUndefined()
  })

  it('hint 和 error 同时存在：aria-describedby 同时指向两者，说明在前', () => {
    const field = mount(UiTextField, { props: { label: '密码', modelValue: '', hint: '8–64 位', error: '密码需为 8–64 位' } })

    const help = field.get('p.help')
    const alert = field.get('[role="alert"]')
    expect(help.attributes('id')).not.toBe(alert.attributes('id'))
    expect(field.find('input').attributes('aria-describedby')).toBe(`${help.attributes('id')} ${alert.attributes('id')}`)
  })

  it('textarea 与 select 同样关联 hint', () => {
    const area = mount(UiTextField, { props: { label: '描述', modelValue: '', control: 'textarea', hint: '最多 500 字' } })
    const pick = mount(UiTextField, { props: { label: '场馆', modelValue: null, control: 'select', hint: '必选' } })

    expect(area.find('textarea').attributes('aria-describedby')).toBe(area.get('p.help').attributes('id'))
    expect(pick.find('select').attributes('aria-describedby')).toBe(pick.get('p.help').attributes('id'))
  })
})

describe('字数计数（默认关闭）', () => {
  it('默认不显示，即使有 maxlength', () => {
    expect(mount(UiTextField, { props: { label: '用途', modelValue: '社团训练', maxlength: 200 } }).find('.count').exists()).toBe(false)
  })

  it('counter 打开：显示“已输入 / 上限”', () => {
    const field = mount(UiTextField, { props: { label: '用途', modelValue: '社团训练', maxlength: 200, counter: true } })

    expect(field.find('.count').text()).toBe('4 / 200')
  })

  it('counter 打开但没有 maxlength：不显示', () => {
    expect(mount(UiTextField, { props: { label: '用途', modelValue: 'a', counter: true } }).find('.count').exists()).toBe(false)
  })
})

describe('textarea 与 select', () => {
  it('control=textarea：渲染 <textarea>，maxlength 与 rows 落在其上，输入发出更新', async () => {
    const field = mount(UiTextField, {
      props: { label: '问题描述', modelValue: '', control: 'textarea', maxlength: 500 },
      attrs: { rows: 3 },
    })

    expect(field.find('input').exists()).toBe(false)
    expect(field.find('textarea').attributes('maxlength')).toBe('500')
    expect(field.find('textarea').attributes('rows')).toBe('3')
    await field.find('textarea').setValue('灯不亮')
    expect(field.emitted('update:modelValue')).toEqual([['灯不亮']])
  })

  it('control=select：选项来自插槽，选择后发出所选选项的值（保留数字类型）', async () => {
    const field = mount(UiTextField, {
      props: { label: '场馆', modelValue: null, control: 'select' },
      slots: { default: '<option :value="null">请选择场馆</option><option :value="1">网球馆</option><option :value="2">羽毛球馆</option>' },
    })

    expect(field.findAll('option').map((option) => option.text())).toEqual(['请选择场馆', '网球馆', '羽毛球馆'])
    await field.find('select').setValue('2')
    expect(field.emitted('update:modelValue')).toEqual([[2]])
  })
})
