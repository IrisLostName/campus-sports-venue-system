// 订场页组件测试的共用脚手架：固定页面读到的“今天”、挂载页面、按文字找场馆/日期/时段。
// vi.mock 必须写在各 spec 文件里（会被提升），这里只放普通函数。
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { vi } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import BookingView from '../../src/views/user/BookingView.vue'
import { FREE_SLOT, TOMORROW } from '../booking/harness'
import { loginAs, type UserContext } from '../reservations/harness'
import { useApiClient } from './apiSwap'
import { mountWithApp } from './support'

// 页面里的“今天”读系统时间：把 Date 固定在 mock 服务端时钟同一天（2026-10-12 09:00 上海），其他计时器保持真实。
export function pinToday(): void {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-12T01:00:00Z'))
}

export function unpinToday(): void {
  vi.useRealTimers()
}

export interface OpenOptions {
  username?: string
  wrap?: (api: ApiClient) => ApiClient
}

export async function openPage(options: OpenOptions = {}): Promise<{ ctx: UserContext; page: VueWrapper }> {
  const ctx = await loginAs(options.username ?? 'zhangsan', '/booking')
  useApiClient(options.wrap === undefined ? ctx.h.api : options.wrap(ctx.h.api))
  const page = mountWithApp(BookingView, ctx.h)
  await flushPromises()
  return { ctx, page }
}

export function venueButton(page: VueWrapper, name: string) {
  const button = page.findAll('.venue').find((node) => node.find('.name').text() === name)
  if (button === undefined) {
    throw new Error(`没有场馆“${name}”`)
  }
  return button
}

export function dateButton(page: VueWrapper, date: string) {
  return page.find(`[data-date="${date}"]`)
}

export function slotButton(page: VueWrapper, resourceName: string, startTime: string) {
  const found = page.findAll(`section[aria-label="${resourceName}"] .cell`).find((node) => node.find('.time').text().startsWith(startTime))
  if (found === undefined) {
    throw new Error(`没有 ${resourceName} ${startTime} 的时段`)
  }
  return found
}

// UI-3：在时段层点“更改日期”回到月历层，再选另一天（时段层压在月历层上时，月历是 inert 的，不能直接点）。
export async function changeDate(page: VueWrapper, date: string): Promise<void> {
  await page.get('.change-date').trigger('click')
  await flushPromises()
  await dateButton(page, date).trigger('click')
  await flushPromises()
}

// 进入网球馆（弹出月历层）、选定日期（进入时段层）。
export async function enterTennis(page: VueWrapper, date: string = TOMORROW): Promise<void> {
  await venueButton(page, '网球馆').trigger('click')
  await flushPromises()
  await dateButton(page, date).trigger('click')
  await flushPromises()
}

// 进入网球馆明天，选中网球场4 的 11:00，停在确认步骤。
export async function pickFreeSlot(page: VueWrapper): Promise<void> {
  await enterTennis(page)
  await slotButton(page, '网球场4', FREE_SLOT).trigger('click')
}
