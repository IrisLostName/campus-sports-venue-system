// FE-8 L1（FE-4 N-1）：“我的”页报修区的两处“加载失败”提示：场馆下拉、我的报修列表（含“重试”）。
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import MeView from '../../src/views/user/MeView.vue'
import { loginAs } from '../reservations/harness'
import { useApiClient } from './apiSwap'
import { mountWithApp } from './support'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

const FAILURE_TEXT = '服务器开小差了，请稍后再试'
const failure = () => new ApiError(500, 'INTERNAL_ERROR', 'x')

async function openMe(wrap: (api: ApiClient) => ApiClient): Promise<VueWrapper> {
  const ctx = await loginAs('zhangsan', '/me')
  useApiClient(wrap(ctx.h.api))
  const page = mountWithApp(MeView, ctx.h)
  await flushPromises()
  return page
}

describe('报修的场馆下拉加载失败', () => {
  it('显示“场馆列表加载失败：…”，下拉里只有占位项；我的报修区不受影响', async () => {
    const page = await openMe((api) => ({ ...api, listVenues: () => Promise.reject(failure()) }))
    const section = page.get('section[aria-label="报修"]')

    expect(section.get('[role="alert"]').text()).toBe(`场馆列表加载失败：${FAILURE_TEXT}`)
    expect(section.findAll('form option').map((option) => option.text())).toEqual(['请选择场馆'])
    expect(section.get('section[aria-label="我的报修"] .none').text()).toBe('暂无报修记录')
  })
})

describe('我的报修列表加载失败', () => {
  it('显示“报修记录加载失败：…”和“重试”，不显示“暂无报修记录”；重试成功后提示消失', async () => {
    let calls = 0
    const page = await openMe((api) => ({
      ...api,
      listMyRepairs: () => {
        calls += 1
        return calls === 1 ? Promise.reject(failure()) : api.listMyRepairs()
      },
    }))
    const list = page.get('section[aria-label="我的报修"]')

    expect(list.get('[role="alert"] p').text()).toBe(`报修记录加载失败：${FAILURE_TEXT}`)
    expect(list.findAll('[role="alert"] button').map((button) => button.text())).toEqual(['重试'])
    expect(list.find('.none').exists()).toBe(false)

    await list.get('[role="alert"] button').trigger('click')
    await flushPromises()

    expect(list.find('[role="alert"]').exists()).toBe(false)
    expect(list.get('.none').text()).toBe('暂无报修记录')
    expect(calls).toBe(2)
  })
})
