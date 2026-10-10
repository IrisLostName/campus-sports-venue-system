// UI-1 UiSheet / UiDialog（docs/17 第 6 节）：打开与关闭、对话框语义、遮罩点击；FE-8 L5 起还有 Esc 关闭。
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

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

const mounted: VueWrapper[] = []

function track(wrapper: VueWrapper): VueWrapper {
  mounted.push(wrapper)
  return wrapper
}

function pressEscape(): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
}

afterEach(() => {
  while (mounted.length > 0) {
    mounted.pop()?.unmount()
  }
})

describe('Esc 关闭（FE-8 L5）', () => {
  it('打开时按 Esc 发出一次 dismiss；其他按键不发出', () => {
    const opened = track(sheet(true))

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(opened.emitted('dismiss')).toBeUndefined()
    pressEscape()
    expect(opened.emitted('dismiss')).toHaveLength(1)
  })

  it('未打开时 Esc 不发出；打开后才响应，关闭后又不响应', async () => {
    const wrapper = track(sheet(false))

    pressEscape()
    expect(wrapper.emitted('dismiss')).toBeUndefined()
    await wrapper.setProps({ open: true })
    pressEscape()
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
    await wrapper.setProps({ open: false })
    pressEscape()
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })

  it('卸载后不再响应', () => {
    const opened = sheet(true)

    opened.unmount()
    pressEscape()
    expect(opened.emitted('dismiss')).toBeUndefined()
  })

  it('busy（提交中）时 Esc 不关闭；不忙时关闭', async () => {
    const dialog = track(mount(UiDialog, { props: { open: true, title: '改派', busy: true }, slots: { default: '正文' } }))

    pressEscape()
    expect(dialog.emitted('dismiss')).toBeUndefined()
    await dialog.setProps({ busy: false })
    pressEscape()
    expect(dialog.emitted('dismiss')).toHaveLength(1)
  })

  it('closeOnEscape=false：Esc 不关闭，点遮罩照常关闭', async () => {
    const opened = track(mount(UiSheet, { props: { open: true, title: '确认', closeOnEscape: false } }))

    pressEscape()
    expect(opened.emitted('dismiss')).toBeUndefined()
    await opened.find('.backdrop').trigger('click')
    expect(opened.emitted('dismiss')).toHaveLength(1)
  })

  it('UiDialog 与 UiSheet 一样响应 Esc', () => {
    const dialog = track(mount(UiDialog, { props: { open: true, title: '改派' }, slots: { default: '正文' } }))

    pressEscape()
    expect(dialog.emitted('dismiss')).toHaveLength(1)
  })

})

describe('Esc 关闭：多层与取消（FE-8 L5）', () => {
  it('两层叠放：只有最上层响应；它关闭后下一次 Esc 轮到下面一层', async () => {
    const lower = track(sheet(true))
    const upper = track(sheet(true))

    pressEscape()
    expect(upper.emitted('dismiss')).toHaveLength(1)
    expect(lower.emitted('dismiss')).toBeUndefined()
    await upper.setProps({ open: false })
    pressEscape()
    expect(lower.emitted('dismiss')).toHaveLength(1)
    expect(upper.emitted('dismiss')).toHaveLength(1)
  })

  it('最上层忙碌时 Esc 也不会落到下面一层', () => {
    const lower = track(sheet(true))
    const upper = track(mount(UiSheet, { props: { open: true, title: '提交中', busy: true } }))

    pressEscape()
    expect(upper.emitted('dismiss')).toBeUndefined()
    expect(lower.emitted('dismiss')).toBeUndefined()
  })

  it('已被 preventDefault 的 Esc 不处理', () => {
    const opened = track(sheet(true))

    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    event.preventDefault()
    window.dispatchEvent(event)
    expect(opened.emitted('dismiss')).toBeUndefined()
  })
})
