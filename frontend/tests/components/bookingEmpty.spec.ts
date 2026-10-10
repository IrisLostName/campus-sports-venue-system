// FE-8 L3（FE-4 N-3）：订场页的空状态——没有场馆、所选日期没有场地或时段。是否为空只看接口返回的数组。
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import { TOMORROW } from '../booking/harness'
import { dateButton, enterTennis, openPage, pinToday, unpinToday } from './bookingSupport'
import { texts } from './support'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

beforeEach(pinToday)
afterEach(unpinToday)

const NO_SLOTS = '所选日期没有可预约的场地或时段'

describe('没有场馆', () => {
  it('listVenues 返回空数组：显示“暂无场馆”与说明，没有场馆行，也没有错误或加载提示', async () => {
    const { page } = await openPage({ wrap: (api: ApiClient) => ({ ...api, listVenues: () => Promise.resolve([]) }) })

    expect(page.get('.ui-empty-state .title').text()).toBe('暂无场馆')
    expect(page.get('.ui-empty-state .description').text()).toBe('目前还没有可以预约的场馆，请稍后再来看看。')
    expect(page.findAll('.venue')).toHaveLength(0)
    expect(page.find('[role="alert"]').exists()).toBe(false)
    expect(page.find('.hint').exists()).toBe(false)
  })

  it('有场馆时不显示；加载失败时显示错误而不是“暂无场馆”', async () => {
    const normal = await openPage()
    expect(normal.page.find('.ui-empty-state').exists()).toBe(false)

    const failed = await openPage({
      wrap: (api: ApiClient) => ({ ...api, listVenues: () => Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x')) }),
    })
    expect(failed.page.find('.ui-empty-state').exists()).toBe(false)
    expect(failed.page.get('[role="alert"] p').text()).toBe('服务器开小差了，请稍后再试')
  })
})

describe('所选日期没有场地或时段', () => {
  it('接口没有返回任何场地：显示空状态，日期条仍可换日期', async () => {
    const { page } = await openPage({
      wrap: (api: ApiClient) => ({
        ...api,
        getVenueSlots: async (venueId, date) => ({ ...(await api.getVenueSlots(venueId, date)), resources: [] }),
      }),
    })
    await enterTennis(page)

    expect(page.get('.ui-empty-state .title').text()).toBe(NO_SLOTS)
    expect(page.get('.ui-empty-state .description').text()).toBe('换一个日期试试。')
    expect(page.findAll('.cell')).toHaveLength(0)
    expect(dateButton(page, TOMORROW).exists()).toBe(true)
  })

  it('场地都没有时段（例如整天关闭）：同样显示空状态，不渲染空的场地分组', async () => {
    const { page } = await openPage({
      wrap: (api: ApiClient) => ({
        ...api,
        getVenueSlots: async (venueId, date) => {
          const venue = await api.getVenueSlots(venueId, date)
          return { ...venue, resources: venue.resources.map((resource) => ({ ...resource, slots: [] })) }
        },
      }),
    })
    await enterTennis(page)

    expect(page.get('.ui-empty-state .title').text()).toBe(NO_SLOTS)
    expect(page.findAll('section[aria-label^="网球场"]')).toHaveLength(0)
  })

  it('有时段时不显示空状态；换到无时段的日期后出现，换回来又消失', async () => {
    const { page } = await openPage({
      wrap: (api: ApiClient) => ({
        ...api,
        getVenueSlots: async (venueId, date) => {
          const venue = await api.getVenueSlots(venueId, date)
          return date === TOMORROW ? venue : { ...venue, resources: [] }
        },
      }),
    })
    await enterTennis(page)
    expect(page.find('.ui-empty-state').exists()).toBe(false)
    expect(page.findAll('.cell').length).toBeGreaterThan(0)

    await page.findAll('[data-date]').find((node) => node.attributes('data-date') !== TOMORROW)?.trigger('click')
    await flushPromises()
    expect(page.get('.ui-empty-state .title').text()).toBe(NO_SLOTS)

    await dateButton(page, TOMORROW).trigger('click')
    await flushPromises()
    expect(page.find('.ui-empty-state').exists()).toBe(false)
    expect(texts(page, '.cell .time').length).toBeGreaterThan(0)
  })

  it('时段加载失败时显示错误与重试，不显示空状态', async () => {
    const { page } = await openPage({
      wrap: (api: ApiClient) => ({ ...api, getVenueSlots: () => Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'x')) }),
    })
    await enterTennis(page)

    expect(page.find('.ui-empty-state').exists()).toBe(false)
    expect(page.get('[role="alert"] p').text()).toBe('服务器开小差了，请稍后再试')
  })
})
