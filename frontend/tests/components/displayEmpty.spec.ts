// FE-8 L3（FE-7 N6）：大屏 venues 为空时的空状态；其余部分照常显示，页面仍然只读。
import { describe, expect, it, vi } from 'vitest'

import { makeSummary } from '../display/support'
import { controls, DISPLAY_BUTTONS, installDisplayEnvironment, installIntervalClock, mountDisplay } from './displaySupport'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

installIntervalClock()
installDisplayEnvironment()

describe('场馆为空', () => {
  it('venues 为空数组：显示“暂无场馆数据”，没有场馆分组；指标与趋势仍在，且只有主题与全屏两个按钮', async () => {
    const { page } = await mountDisplay([makeSummary({ venues: [], resources: [] })])

    expect(page.get('.no-venues .ui-empty-state .title').text()).toBe('暂无场馆数据')
    expect(page.get('.no-venues .ui-empty-state .description').text()).toBe('当前没有可展示的场馆')
    expect(page.findAll('section.venue')).toHaveLength(0)
    expect(page.findAll('li.metric')).toHaveLength(4)
    expect(controls(page)).toEqual(DISPLAY_BUTTONS)
  })

  it('有场馆时不显示空状态', async () => {
    const { page } = await mountDisplay([makeSummary()])

    expect(page.find('.no-venues').exists()).toBe(false)
    expect(page.findAll('section.venue')).toHaveLength(2)
  })
})
