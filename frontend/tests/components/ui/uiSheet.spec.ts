// UI-1 UiSheet / UiDialog（docs/17 第 6 节）：打开与关闭、对话框语义、遮罩点击。
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UiDialog from '../../../src/components/ui/UiDialog.vue'
import UiSheet from '../../../src/components/ui/UiSheet.vue'

function sheet(open: boolean) {
  return mount(UiSheet, { props: { open, title: '确认取消预约？' }, slots: { default: '<p class="body">内容</p>' } })
}

describe('打开与关闭', () => {
  it('open=false：什么都不渲染', () => {
    const closed = sheet(false)

    expect(closed.find('[role="dialog"]').exists()).toBe(false)
    expect(closed.find('.backdrop').exists()).toBe(false)
  })

  it('open=true：渲染对话框、标题与插槽内容', () => {
    const opened = sheet(true)

    expect(opened.find('[role="dialog"]').exists()).toBe(true)
    expect(opened.find('h2').text()).toBe('确认取消预约？')
    expect(opened.find('.body').text()).toBe('内容')
  })

  it('open 从 true 变 false 再变回：对话框随之移除与重现', async () => {
    const wrapper = sheet(true)

    await wrapper.setProps({ open: false })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    await wrapper.setProps({ open: true })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
  })
})

describe('对话框语义与关闭', () => {
  it('role=dialog、aria-modal，aria-labelledby 指向标题的 id', () => {
    const dialog = sheet(true).find('[role="dialog"]')

    expect(dialog.attributes('aria-modal')).toBe('true')
    const labelledBy = dialog.attributes('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(dialog.find('h2').attributes('id')).toBe(labelledBy)
  })

  it('点遮罩发出 dismiss；点面板内部不发出', async () => {
    const opened = sheet(true)

    await opened.find('.sheet').trigger('click')
    expect(opened.emitted('dismiss')).toBeUndefined()
    await opened.find('.backdrop').trigger('click')
    expect(opened.emitted('dismiss')).toHaveLength(1)
  })

  it('同一页面里两个浮层的标题 id 不同（aria-labelledby 不会串）', () => {
    const page = mount({
      components: { UiSheet },
      template: '<div><UiSheet :open="true" title="甲" /><UiSheet :open="true" title="乙" /></div>',
    })

    const ids = page.findAll('h2').map((title) => title.attributes('id'))
    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
  })
})

describe('位置', () => {
  it('UiSheet 默认贴底；UiDialog 居中，行为与 UiSheet 相同', async () => {
    expect(sheet(true).find('.backdrop').classes()).toContain('backdrop--bottom')

    const dialog = mount(UiDialog, { props: { open: true, title: '改派' }, slots: { default: '正文' } })
    expect(dialog.find('.backdrop').classes()).toContain('backdrop--center')
    expect(dialog.find('h2').text()).toBe('改派')
    expect(dialog.text()).toContain('正文')
    await dialog.find('.backdrop').trigger('click')
    expect(dialog.emitted('dismiss')).toHaveLength(1)
  })
})
