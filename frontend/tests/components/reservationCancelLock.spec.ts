// TEST-2 K3：取消按钮按截止时间置灰（docs/03 第 4.4 节）。卡片组件、预约页（客户端时钟每 30 秒刷新）与操作入口三层。
// zhangsan 的预约是 2026-10-13 08:00 开始，cancelDeadlineMinutes = 120：06:00 正好截止（仍可用），06:00 之后置灰。
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { BookingRules, Reservation } from '../../src/api/types'
import ReservationCardView from '../../src/components/reservation/ReservationCard.vue'
import { createReservationBoard } from '../../src/composables/reservationBoard'
import { buildCard } from '../../src/utils/reservationDisplay'
import ReservationView from '../../src/views/user/ReservationView.vue'
import { at, loginAs } from '../reservations/harness'
import { useApiClient } from './apiSwap'
import { buttonByText, mountWithApp } from './support'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

const RULES: BookingRules = {
  slotMinutes: 90, advanceDays: 7, cancelDeadlineMinutes: 120, checkInOpenBeforeMinutes: 15,
  checkInCloseAfterMinutes: 15, checkOutGraceMinutes: 30, maxActiveReservationsPerUser: 3, timezone: 'Asia/Shanghai',
}
const NOTE = '已过可取消时间（需在开始前至少 120 分钟取消）'

const RESERVATION: Reservation = {
  id: 7, venueId: 1, venueName: '网球馆', resourceId: 1, resourceName: '网球场1', userId: 3, userDisplayName: '张三',
  serviceDate: '2026-10-13', startTime: '08:00', endTime: '09:30', status: 'CONFIRMED', displayStatus: 'UPCOMING',
  purpose: null, createdAt: '2026-10-12T08:00:00', cancelledAt: null, cancelReason: null, cancelledBy: null,
  adminNote: null, checkInAt: null, checkOutAt: null,
}

// 上海时间 → 系统时间（UTC+8）。
function shanghai(timestamp: string): Date {
  return new Date(`${timestamp}+08:00`)
}

afterEach(() => {
  vi.useRealTimers()
})

describe('TEST-2 K3 卡片组件：cancelLocked', () => {
  function mountCard(cancelLocked?: boolean) {
    return mount(ReservationCardView, {
      props: {
        card: buildCard(RESERVATION, RULES), busy: false, working: false, feedback: null,
        ...(cancelLocked === undefined ? {} : { cancelLocked, cancelLockedNote: NOTE }),
      },
    })
  }

  it('缺省（未传）：“取消预约”可用，没有说明', () => {
    const card = mountCard()

    expect(buttonByText(card, '取消预约').attributes('disabled')).toBeUndefined()
    expect(card.find('.lock-note').exists()).toBe(false)
  })

  it('置灰：按钮 disabled，说明文字经 aria-describedby 关联，点击不发出 action', async () => {
    const card = mountCard(true)
    const button = buttonByText(card, '取消预约')
    const note = card.find('.lock-note')

    expect(button.attributes('disabled')).toBeDefined()
    expect(note.text()).toBe(NOTE)
    expect(button.attributes('aria-describedby')).toBe(note.attributes('id'))
    await button.trigger('click')
    expect(card.emitted('action')).toBeUndefined()
  })
})

describe('TEST-2 K3 预约页：客户端时钟越过截止时置灰', () => {
  async function openAt(clientTime: string): Promise<VueWrapper> {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(shanghai(clientTime))
    const ctx = await loginAs('zhangsan', '/reservation')
    await ctx.travelTo(clientTime)
    useApiClient(ctx.h.api)
    const page = mountWithApp(ReservationView, ctx.h)
    await flushPromises()
    return page
  }

  it('截止前一分钟可用；正好截止仍可用；之后（下一次 30 秒刷新）置灰并显示说明', async () => {
    const page = await openAt(at('05:59'))
    expect(buttonByText(page, '取消预约').attributes('disabled')).toBeUndefined()

    vi.advanceTimersByTime(60 * 1000)          // 06:00:00，正好 120 分钟
    await nextTick()
    expect(buttonByText(page, '取消预约').attributes('disabled')).toBeUndefined()
    expect(page.find('.lock-note').exists()).toBe(false)

    vi.advanceTimersByTime(30 * 1000)          // 06:00:30
    await nextTick()
    expect(buttonByText(page, '取消预约').attributes('disabled')).toBeDefined()
    expect(page.find('.lock-note').text()).toBe(NOTE)
    expect(page.find('article .badge').text()).toBe('待使用')
    page.unmount()
  })

  it('进入页面时已过截止：直接置灰，点击不打开取消确认层', async () => {
    const page = await openAt(at('06:01'))
    const button = buttonByText(page, '取消预约')

    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    expect(page.find('[role="dialog"]').exists()).toBe(false)
    page.unmount()
  })
})

describe('TEST-2 K3 操作入口：置灰的卡片 trigger 不打开取消确认层', () => {
  it('客户端时间在截止之后：cancelTarget 保持为空；截止之前：打开', async () => {
    const ctx = await loginAs('zhangsan', '/reservation')
    await ctx.travelTo(at('06:30'))
    const now = ref(at('06:30'))
    const board = createReservationBoard({ api: ctx.h.api, call: ctx.call, reference: ctx.reference, now })
    await board.load()

    expect([...board.cancelLockedIds.value]).toEqual([1])
    await board.trigger('CANCEL', 1)
    expect(board.cancelTarget.value).toBeNull()

    now.value = at('05:30')
    expect([...board.cancelLockedIds.value]).toEqual([])
    await board.trigger('CANCEL', 1)
    expect(board.cancelTarget.value?.id).toBe(1)
  })
})
