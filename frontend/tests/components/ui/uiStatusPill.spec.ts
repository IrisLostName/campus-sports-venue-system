// UI-1 UiStatusPill（docs/17 第 6 节）：五种 tone、文字、装饰圆点。
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UiStatusPill from '../../../src/components/ui/UiStatusPill.vue'
import type { Tone } from '../../../src/utils/statusTone'

describe('UiStatusPill', () => {
  it.each(['accent', 'success', 'warning', 'danger', 'neutral'] as Tone[])('tone=%s：带对应的类', (tone) => {
    const pill = mount(UiStatusPill, { props: { tone }, slots: { default: '待使用' } })

    expect(pill.classes()).toContain(`ui-status-pill--${tone}`)
    expect(pill.classes().filter((name) => name.startsWith('ui-status-pill--'))).toHaveLength(1)
  })

  it('文字只有插槽内容；圆点是 aria-hidden 的装饰，不产生文字', () => {
    const pill = mount(UiStatusPill, { props: { tone: 'success' }, slots: { default: '待使用' } })

    expect(pill.text()).toBe('待使用')
    expect(pill.find('.dot').attributes('aria-hidden')).toBe('true')
    expect(pill.find('.dot').text()).toBe('')
  })

  it('页面传入的类（例如 badge）落在根元素上', () => {
    expect(mount(UiStatusPill, { props: { tone: 'neutral' }, attrs: { class: 'badge' } }).classes()).toContain('badge')
  })
})
