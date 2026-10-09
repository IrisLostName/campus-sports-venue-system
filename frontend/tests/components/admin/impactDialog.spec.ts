// FE-5 P4：ImpactDialog 的渲染与事件（状态逻辑在 tests/admin/impactFlow.spec.ts）。
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ImpactDialog from '../../../src/components/admin/ImpactDialog.vue'
import type { ImpactDialogState } from '../../../src/composables/impactFlow'
import { buttonIn } from './support'

function state(overrides: Partial<ImpactDialogState> = {}): ImpactDialogState {
  return {
    title: '将 网球场1 设为维护',
    impact: {
      affectedCount: 2,
      reservations: [
        { id: 1, resourceName: '网球场1', serviceDate: '2026-10-13', startTime: '08:00', endTime: '09:30', userDisplayName: '张三' },
        { id: 9, resourceName: '网球场1', serviceDate: '2026-10-14', startTime: '09:30', endTime: '11:00', userDisplayName: '李四' },
      ],
    },
    choice: null, reason: '', busy: false, error: null,
    ...overrides,
  }
}

describe('P4 对话框', () => {
  it('没有状态时什么都不渲染', () => {
    expect(mount(ImpactDialog, { props: { state: null } }).find('[role="dialog"]').exists()).toBe(false)
  })

  it('有受影响预约：列出预约，保留 / 取消都不预选，原因输入框在', () => {
    const dialog = mount(ImpactDialog, { props: { state: state() } })

    expect(dialog.get('h2').text()).toBe('将 网球场1 设为维护')
    expect(dialog.get('.count').text()).toBe('该操作会影响 2 个未来预约：')
    expect(dialog.findAll('.list li').map((li) => li.text())).toEqual([
      '网球场1 · 2026-10-13 08:00–09:30 · 张三',
      '网球场1 · 2026-10-14 09:30–11:00 · 李四',
    ])
    const radios = dialog.findAll('input[type="radio"]')
    expect(radios.map((radio) => radio.attributes('value'))).toEqual(['KEEP', 'CANCEL'])
    expect(radios.map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([false, false])
    expect(dialog.get('label.label').text()).toContain('原因（选择取消时必填）')
    expect(buttonIn(dialog, '确认提交').exists()).toBe(true)
  })

  it('选择后对应单选被选中，并发出 choose；改原因发出 update:reason；确认与取消发出事件', async () => {
    const dialog = mount(ImpactDialog, { props: { state: state({ choice: 'CANCEL', reason: '检修' }) } })
    const radios = dialog.findAll('input[type="radio"]')

    expect(radios.map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([false, true])
    expect((dialog.get('textarea').element as HTMLTextAreaElement).value).toBe('检修')

    await radios[0]?.setValue(true)
    expect(dialog.emitted('choose')).toEqual([['KEEP']])
    await dialog.get('textarea').setValue('改期')
    expect(dialog.emitted('update:reason')).toEqual([['改期']])
    await buttonIn(dialog, '确认提交').trigger('click')
    await buttonIn(dialog, '取消').trigger('click')
    expect(dialog.emitted('confirm')).toHaveLength(1)
    expect(dialog.emitted('dismiss')).toHaveLength(1)
  })

  it('没有受影响预约：只是普通确认，没有单选与原因', () => {
    const dialog = mount(ImpactDialog, { props: { state: state({ impact: { affectedCount: 0, reservations: [] } }) } })

    expect(dialog.get('.none').text()).toBe('该操作不影响已有预约。')
    expect(dialog.find('input[type="radio"]').exists()).toBe(false)
    expect(dialog.find('textarea').exists()).toBe(false)
    expect(buttonIn(dialog, '确认').exists()).toBe(true)
  })

  it('错误文案以 alert 显示；提交中确认按钮不可用', () => {
    const dialog = mount(ImpactDialog, { props: { state: state({ error: '请选择保留或取消', busy: true }) } })

    expect(dialog.get('[role="alert"]').text()).toBe('请选择保留或取消')
    expect(buttonIn(dialog, '确认提交').attributes('disabled')).toBeDefined()
  })
})
