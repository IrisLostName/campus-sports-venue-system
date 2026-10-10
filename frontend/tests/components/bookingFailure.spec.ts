// FE-8 L1（FE-4 N-1）：订场页两处“加载失败”提示的渲染：场馆列表、BookingRules（无日期可选）。
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import { openPage, pinToday, unpinToday, venueButton } from './bookingSupport'
import { texts } from './support'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

beforeEach(pinToday)
afterEach(unpinToday)

const FAILURE_TEXT = '服务器开小差了，请稍后再试'
const failure = () => new ApiError(500, 'INTERNAL_ERROR', 'x')

describe('场馆列表加载失败', () => {
  it('显示错误文案与“重试”，没有场馆行；重试成功后错误消失、场馆出现', async () => {
    let calls = 0
    const { page } = await openPage({
      wrap: (api: ApiClient) => ({
        ...api,
        listVenues: () => {
          calls += 1
          return calls === 1 ? Promise.reject(failure()) : api.listVenues()
        },
      }),
    })

    expect(page.get('[role="alert"] p').text()).toBe(FAILURE_TEXT)
    expect(texts(page, '[role="alert"] button')).toEqual(['重试'])
    expect(page.findAll('.venue')).toHaveLength(0)

    await page.get('[role="alert"] button').trigger('click')
    await flushPromises()

    expect(page.find('[role="alert"]').exists()).toBe(false)
    expect(texts(page, '.venue .name')).toEqual(['网球馆', '羽毛球馆', '游泳馆'])
  })
})

describe('BookingRules 取不到：没有可选日期', () => {
  it('进入网球馆后显示“无法取得可预约的日期范围：…”，没有日期条与时段', async () => {
    const { page } = await openPage({
      wrap: (api: ApiClient) => ({ ...api, getBookingRules: () => Promise.reject(failure()) }),
    })

    await venueButton(page, '网球馆').trigger('click')
    await flushPromises()

    expect(page.get('[role="alert"]').text()).toContain(`无法取得可预约的日期范围：${FAILURE_TEXT}`)
    expect(page.findAll('[data-date]')).toHaveLength(0)
    expect(page.findAll('.cell')).toHaveLength(0)
  })
})
