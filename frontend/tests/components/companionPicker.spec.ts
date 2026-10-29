// P2-2c 确认层的“同行好友（可选）”组件（裁决第 1 节、第 5 节第 5 条）：输入框与“添加”、头像首字 + 姓名的名单、
// “已添加 n / 6 位”、满 6 位后不可用、焦点（加满第 6 位后到最后一位的“移除”，移除后到下一位 / 上一位 / 输入框）。
// “移除”按钮的触控区见 tests/styles/companionTouchTargets.spec.ts。
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import type { Companion } from '../../src/api/types'
import CompanionPicker from '../../src/components/booking/CompanionPicker.vue'

const PEOPLE: Companion[] = ['李四', '王五', '赵六', '周八', '吴九', '郑十'].map((displayName, index) => ({ userId: index + 2, displayName }))

let wrapper: VueWrapper | null = null

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

interface Options {
  companions?: Companion[]
  looking?: boolean
  notice?: string | null
  disabled?: boolean
}

// 父组件的最小替身：remove 时把名单更新回来。
function mountPicker(options: Options = {}) {
  const lookups: number[] = []
  const removed: number[] = []
  const current = mount(CompanionPicker, {
    attachTo: document.body,
    props: {
      companions: options.companions ?? [],
      looking: options.looking ?? false,
      notice: options.notice ?? null,
      disabled: options.disabled ?? false,
      query: '',
      'onUpdate:query': (value: string) => { void current.setProps({ query: value }) },
      onLookup: () => { lookups.push(lookups.length + 1) },
      onRemove: (userId: number) => {
        removed.push(userId)
        void current.setProps({ companions: (current.props('companions') as Companion[]).filter((item) => item.userId !== userId) })
      },
    },
  })
  wrapper = current
  return { picker: current, lookups, removed }
}

function removeButtons(picker: VueWrapper) {
  return picker.findAll('button.remove')
}

describe('输入与查找', () => {
  it('标签、提示文字、maxlength=32；回车与“添加”都触发查找', async () => {
    const { picker, lookups } = mountPicker()
    expect(picker.find('label').text()).toContain('同行好友（可选）')
    const input = picker.find('input')
    expect(input.attributes('placeholder')).toBe('用户名、学号或手机号')
    expect(input.attributes('maxlength')).toBe('32')
    await input.trigger('keydown', { key: 'Enter' })
    await picker.find('button.add').trigger('click')
    expect(lookups).toEqual([1, 2])
  })

  it('查找中：按钮显示“查找中…”，再次回车不触发', async () => {
    const { picker, lookups } = mountPicker({ looking: true })
    expect(picker.find('button.add').text()).toBe('查找中…')
    await picker.find('input').trigger('keydown', { key: 'Enter' })
    expect(lookups).toEqual([])
  })

  it('提示文案在 role=alert 中，输入框标记 aria-invalid', () => {
    const { picker } = mountPicker({ notice: '未找到该用户' })
    expect(picker.find('[role="alert"]').text()).toBe('未找到该用户')
    expect(picker.find('input').attributes('aria-invalid')).toBe('true')
  })
})

describe('名单', () => {
  it('没有同行人：不显示名单，计数“已添加 0 / 6 位”', () => {
    const { picker } = mountPicker()
    expect(picker.find('ul.chips').exists()).toBe(false)
    expect(picker.find('.counter').text()).toBe('已添加 0 / 6 位')
    expect(picker.find('.counter').attributes('aria-live')).toBe('polite')
  })

  it('头像首字 + 姓名，“移除”按钮的可访问名称含姓名', () => {
    const { picker } = mountPicker({ companions: PEOPLE.slice(0, 2) })
    expect(picker.findAll('.chip .avatar').map((node) => node.text())).toEqual(['李', '王'])
    expect(picker.findAll('.chip .name').map((node) => node.text())).toEqual(['李四', '王五'])
    expect(removeButtons(picker).map((node) => node.attributes('aria-label'))).toEqual(['移除李四', '移除王五'])
    expect(picker.find('.counter').text()).toBe('已添加 2 / 6 位')
  })

  it('满 6 位：输入框与“添加”不可用，计数“已添加 6 / 6 位”', () => {
    const { picker } = mountPicker({ companions: PEOPLE })
    expect(picker.find('input').attributes('disabled')).toBeDefined()
    expect(picker.find('button.add').attributes('disabled')).toBeDefined()
    expect(picker.find('.counter').text()).toBe('已添加 6 / 6 位')
  })

  it('提交中：输入框、“添加”与“移除”都不可用', () => {
    const { picker } = mountPicker({ companions: PEOPLE.slice(0, 1), disabled: true })
    expect(picker.find('input').attributes('disabled')).toBeDefined()
    expect(picker.find('button.add').attributes('disabled')).toBeDefined()
    expect(removeButtons(picker)[0]?.attributes('disabled')).toBeDefined()
  })
})

describe('焦点', () => {
  it('加满第 6 位后：焦点移到最后一位的“移除”按钮', async () => {
    const { picker } = mountPicker({ companions: PEOPLE.slice(0, 5) })
    picker.find('input').element.focus()
    await picker.setProps({ companions: PEOPLE })
    await flushPromises()
    expect(document.activeElement?.getAttribute('aria-label')).toBe('移除郑十')
  })

  it('加入第 1–5 位时焦点不动', async () => {
    const { picker } = mountPicker({ companions: [] })
    picker.find('input').element.focus()
    await picker.setProps({ companions: PEOPLE.slice(0, 1) })
    await flushPromises()
    expect(document.activeElement).toBe(picker.find('input').element)
  })

  it('移除：焦点到下一位；移除最后一位时到上一位；全部移除后回到输入框', async () => {
    const { picker, removed } = mountPicker({ companions: PEOPLE.slice(0, 3) })
    await removeButtons(picker)[1]?.trigger('click')
    await flushPromises()
    expect(removed).toEqual([3])
    expect(document.activeElement?.getAttribute('aria-label')).toBe('移除赵六')

    await removeButtons(picker)[1]?.trigger('click')
    await flushPromises()
    expect(document.activeElement?.getAttribute('aria-label')).toBe('移除李四')

    await removeButtons(picker)[0]?.trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(picker.find('input').element)
  })
})
