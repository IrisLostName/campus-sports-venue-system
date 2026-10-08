// UI-1 UiListRow（docs/17 第 6 节）：标题、副标题、右侧值、箭头、元素类型与插槽。
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UiListRow from '../../../src/components/ui/UiListRow.vue'

describe('内容', () => {
  it('标题、副标题、右侧值按各自的位置渲染，默认没有箭头', () => {
    const row = mount(UiListRow, { props: { title: '网球馆', subtitle: '4 个场地', value: '开放' } })

    expect(row.find('.title').text()).toBe('网球馆')
    expect(row.find('.subtitle').text()).toBe('4 个场地')
    expect(row.find('.value').text()).toBe('开放')
    expect(row.find('svg').exists()).toBe(false)
  })

  it('arrow：渲染 aria-hidden 的箭头，不产生文字', () => {
    const row = mount(UiListRow, { props: { title: '公告', arrow: true } })

    expect(row.find('svg').attributes('aria-hidden')).toBe('true')
    expect(row.text()).toBe('公告')
  })

  it('没有给副标题或值时，不渲染对应的节点', () => {
    const row = mount(UiListRow, { props: { title: '只有标题' } })

    expect(row.find('.subtitle').exists()).toBe(false)
    expect(row.find('.value').exists()).toBe(false)
  })

  it('默认插槽替换标题与副标题，value 插槽替换右侧值', () => {
    const row = mount(UiListRow, {
      props: { title: '不会出现' },
      slots: { default: '<h3>自定义标题</h3>', value: '<b class="custom">值</b>' },
    })

    expect(row.find('h3').text()).toBe('自定义标题')
    expect(row.find('.title').exists()).toBe(false)
    expect(row.find('.custom').text()).toBe('值')
  })
})

describe('元素类型', () => {
  it.each(['div', 'article', 'li'] as const)('tag=%s', (tag) => {
    const row = mount(UiListRow, { props: { tag, title: 'x' } })

    expect(row.element.tagName).toBe(tag.toUpperCase())
    expect(row.attributes('type')).toBeUndefined()
  })

  it('tag=button：type=button，disabled 属性与页面的类原样落到按钮上', () => {
    const row = mount(UiListRow, { props: { tag: 'button', title: '羽毛球馆' }, attrs: { disabled: true, class: 'venue' } })

    expect(row.element.tagName).toBe('BUTTON')
    expect(row.attributes('type')).toBe('button')
    expect(row.attributes('disabled')).toBeDefined()
    expect(row.classes()).toContain('venue')
  })
})
