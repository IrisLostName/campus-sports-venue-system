// UI-5 “预约”页固定的预约规则提醒：标题与 5 条规则逐字写死（负责人决定）；整页里紧跟在持有数那一行之后，无论有无预约都显示。
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import BookingRulesNotice from '../../src/components/reservation/BookingRulesNotice.vue'
import ReservationView from '../../src/views/user/ReservationView.vue'
import { loginAs } from '../reservations/harness'
import { useApiClient } from './apiSwap'
import { mountWithApp, texts } from './support'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

const RULES = [
  '可预约今天起未来 7 天（含当天）的时段，每个时段 90 分钟。',
  '每人同时持有的未结束预约不超过 3 个。',
  '如需取消，请在开始前至少 120 分钟操作；临近开始无法自行取消。',
  '签到时间为开始前 15 分钟至开始后 15 分钟，请按时到场签到；使用结束后 30 分钟内可签退。',
  '请合理安排时间，尽量不要“订而不来”，把场地留给真正需要的同学。',
]

async function openPage(username: string): Promise<VueWrapper> {
  const ctx = await loginAs(username, '/reservation')
  useApiClient(ctx.h.api)
  const page = mountWithApp(ReservationView, ctx.h)
  await flushPromises()
  return page
}

describe('UI-5 预约规则提醒组件', () => {
  it('warning 横幅：标题“预约规则提醒”，有序列表 5 条，文字逐字一致且顺序不变', () => {
    const notice = mount(BookingRulesNotice)

    expect(notice.classes()).toContain('ui-banner--warning')
    expect(notice.find('h2').text()).toBe('预约规则提醒')
    expect(notice.findAll('ol > li')).toHaveLength(5)
    expect(texts(notice, 'ol > li')).toEqual(RULES)
  })
})

describe('UI-5 “预约”页上的位置', () => {
  it.each([
    ['有预约', 'zhangsan', 1],
    ['没有预约', 'wangwu', 0],
  ])('%s：提醒紧跟在持有数那一行之后', async (_label, username, cardCount) => {
    const page = await openPage(username)

    expect(page.findAll('article')).toHaveLength(cardCount)
    const limit = page.find('.limit').element
    const notice = page.find('.booking-rules').element
    expect(limit.nextElementSibling).toBe(notice)
    expect(texts(page, '.booking-rules ol > li')).toEqual(RULES)
  })
})
