// FE-7 大屏（FE-7-rulings T1–T4、D1）：失败时保留旧数据并提示、首次失败的错误状态、只调用 getDisplaySummary。
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../src/api/errors'
import { makeSummary } from '../display/support'
import { installIntervalClock, mountDisplay, type MountedDisplay } from './displaySupport'
import { texts } from './support'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

installIntervalClock()

const OLD = makeSummary({ generatedAt: '2026-10-12T07:00:00', todayReservationCount: 7 })
const NEW = makeSummary({ generatedAt: '2026-10-12T07:01:00', todayReservationCount: 9 })
const FAILURE = new ApiError(500, 'INTERNAL_ERROR', '服务端出错')

function firstMetric(shown: MountedDisplay): string | undefined {
  return shown.page.find('li.metric .value').exists() ? shown.page.find('li.metric .value').text() : undefined
}

describe('加载中', () => {
  it('第一次拉取未返回：显示“正在加载数据…”，没有指标与场馆', async () => {
    const { page } = await mountDisplay(['pending'])

    expect(page.find('[role="status"]').text()).toBe('正在加载数据…')
    expect(page.find('li.metric').exists()).toBe(false)
    expect(page.find('section.venue').exists()).toBe(false)
  })
})

describe('已有旧数据时拉取失败', () => {
  it('保留旧数据，并提示失败原因与旧数据的生成时间', async () => {
    const shown = await mountDisplay([OLD, FAILURE])
    expect(shown.page.find('.stale').exists()).toBe(false)
    await shown.nextPoll()

    expect(shown.page.find('.stale').attributes('role')).toBe('alert')
    expect(shown.page.find('.stale').text()).toBe('数据更新失败，服务器开小差了，请稍后再试，显示的是 2026-10-12 07:00:00 的数据')
    expect(firstMetric(shown)).toBe('7')
    expect(shown.page.findAll('section.venue')).toHaveLength(2)
    expect(shown.page.find('.updated').text()).toBe('数据更新于 2026-10-12 07:00:00')
  })

  it('下一轮成功：提示消失，换成新数据', async () => {
    const shown = await mountDisplay([OLD, FAILURE, NEW])
    await shown.nextPoll()
    await shown.nextPoll()

    expect(shown.page.find('.stale').exists()).toBe(false)
    expect(firstMetric(shown)).toBe('9')
    expect(shown.page.find('.updated').text()).toBe('数据更新于 2026-10-12 07:01:00')
  })

  it('连续失败：仍显示最近一次成功的数据与它的生成时间', async () => {
    const shown = await mountDisplay([OLD, FAILURE, FAILURE])
    await shown.nextPoll()
    await shown.nextPoll()

    expect(shown.page.find('.stale').text()).toContain('显示的是 2026-10-12 07:00:00 的数据')
    expect(firstMetric(shown)).toBe('7')
  })
})

describe('从未取到数据时拉取失败', () => {
  it('显示错误状态与失败原因，没有指标；不显示“数据更新于”', async () => {
    const shown = await mountDisplay([FAILURE])

    expect(shown.page.find('.state.error').attributes('role')).toBe('alert')
    expect(shown.page.find('.state.error').text()).toBe('数据加载失败，服务器开小差了，请稍后再试，系统会自动重试')
    expect(shown.page.find('li.metric').exists()).toBe(false)
    expect(shown.page.find('.stale').exists()).toBe(false)
    expect(shown.page.find('.updated').exists()).toBe(false)
  })

  it('下一轮重试成功：错误状态消失，显示数据', async () => {
    const shown = await mountDisplay([FAILURE, NEW])
    await shown.nextPoll()

    expect(shown.page.find('.state').exists()).toBe(false)
    expect(texts(shown.page, 'li.metric .value')).toEqual(['9', '1', '62.5%', '2/3'])
  })
})

describe('只调用 getDisplaySummary（D1、T4）', () => {
  it('进入页面与多轮轮询期间，页面对 api 的调用只有 getDisplaySummary，且每次轮询调用一次', async () => {
    const shown = await mountDisplay([OLD, FAILURE, NEW])
    await shown.nextPoll()
    await shown.nextPoll()

    expect(shown.calls).toEqual(['getDisplaySummary', 'getDisplaySummary', 'getDisplaySummary'])
  })

  it('离开页面（卸载）后不再轮询', async () => {
    const shown = await mountDisplay([OLD])
    await shown.nextPoll()
    expect(shown.calls).toHaveLength(2)

    shown.page.unmount()
    await shown.nextPoll()
    await flushPromises()
    expect(shown.calls).toHaveLength(2)
  })
})
