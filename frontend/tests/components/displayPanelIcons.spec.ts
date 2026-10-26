// UI-2b-rulings 已定事项第 2、4 条：大屏各面板标题（今日概览、各场馆分组标题、本周预约趋势、场地实时状态、系统提示）前
// 有同风格的 aria-hidden 图标，标题文字不变；副标题是项目名。
import { describe, expect, it, vi } from 'vitest'

import { makeSummary } from '../display/support'
import { installDisplayEnvironment, installIntervalClock, mountDisplay } from './displaySupport'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

installIntervalClock()
installDisplayEnvironment()

describe('大屏面板标题图标', () => {
  it('五类面板标题各有一个 aria-hidden 图标，文字不变', async () => {
    const { page } = await mountDisplay([makeSummary()])
    const titles = page.findAll('h2, h3').filter((heading) => heading.find('svg.panel-title-icon').exists())
    const texts = titles.map((heading) => heading.text())

    expect(texts.slice(0, 1)).toEqual(['今日概览'])
    expect(texts).toEqual(expect.arrayContaining(['本周预约趋势', '场地实时状态', '系统提示']))
    expect(page.findAll('h3.name').map((heading) => heading.find('svg.panel-title-icon').exists()).every(Boolean)).toBe(true)
    expect(page.findAll('h3.name').length).toBeGreaterThan(0)
    for (const heading of titles) {
      const icon = heading.get('svg')
      expect(icon.attributes('aria-hidden')).toBe('true')
      expect(icon.attributes('focusable')).toBe('false')
      expect(heading.findAll('svg')).toHaveLength(1)
    }
  })

  it('副标题是项目名', async () => {
    const { page } = await mountDisplay([makeSummary()])
    expect(page.get('.subtitle').text()).toBe('校园场馆预约与服务管理系统')
  })
})
