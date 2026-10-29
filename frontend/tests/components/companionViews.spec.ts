// P2-2c 各显示位置的渲染（裁决第 1、2 节，第 5 节第 1、2 条）：订场页确认层（回车查找、不提交预约、本人提示、未找到）、
// 成功页、预约卡片、签到码卡片表头、管理端列表“预约人”格、扫码结果；没有同行人时不渲染这一行。
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import type { CreateReservationRequest } from '../../src/api/requests'
import type { Reservation } from '../../src/api/types'
import type { AdminReservation } from '../../src/api/typesSection5'
import ReservationTable from '../../src/components/admin/reservations/ReservationTable.vue'
import ScanResult from '../../src/components/admin/checkin/ScanResult.vue'
import BookingResult from '../../src/components/booking/BookingResult.vue'
import CheckInTicket from '../../src/components/reservation/CheckInTicket.vue'
import ReservationCardView from '../../src/components/reservation/ReservationCard.vue'
import { buildReservationRow } from '../../src/utils/adminReservationDisplay'
import { buildTicket, scanSuccess } from '../../src/utils/checkInDisplay'
import { buildCard, buildSummary } from '../../src/utils/reservationDisplay'
import { openPage, pickFreeSlot, pinToday, unpinToday } from './bookingSupport'
import { buttonByText, texts } from './support'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

beforeEach(pinToday)
afterEach(unpinToday)

const TWO = [{ userId: 4, displayName: '赵六' }, { userId: 2, displayName: '李四' }]

const RESERVATION: Reservation = {
  id: 9, venueId: 1, venueName: '网球馆', resourceId: 2, resourceName: '网球场2', userId: 1, userDisplayName: '张三',
  serviceDate: '2026-10-13', startTime: '08:00', endTime: '09:30', status: 'CONFIRMED', displayStatus: 'UPCOMING',
  purpose: null, createdAt: '2026-10-12T07:00:00', cancelledAt: null, cancelReason: null, cancelledBy: null,
  adminNote: null, checkInAt: null, checkOutAt: null, companions: TWO,
}

const ADMIN: AdminReservation = { ...RESERVATION, userUsername: 'zhangsan', userPhone: null }

describe('订场页确认层', () => {
  it('回车查找并加入名单，不提交预约；确认后成功页显示“同行”', async () => {
    const creates: CreateReservationRequest[] = []
    const { page } = await openPage({
      wrap: (api): ApiClient => ({ ...api, createReservation: (request) => { creates.push(request); return api.createReservation(request) } }),
    })
    await pickFreeSlot(page)
    const input = page.get('[aria-label="同行好友"] input')
    await input.setValue('zhaoliu')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    await input.setValue('lisi')
    await buttonByText(page, '添加').trigger('click')
    await flushPromises()

    expect(texts(page, '.chip .name')).toEqual(['赵六', '李四'])
    expect(page.get('.counter').text()).toBe('已添加 2 / 6 位')
    expect(creates).toEqual([])

    await buttonByText(page, '确认预约').trigger('click')
    await flushPromises()
    expect(creates[0]?.companionUserIds).toEqual([4, 2])
    expect(texts(page, '[aria-label="预约结果"] dt')).toEqual(['地点', '日期', '时间', '同行', '状态'])
    expect(texts(page, '[aria-label="预约结果"] dd')[3]).toBe('赵六、李四')
  })

  it('输入本人的用户名：“不能添加自己”；找不到：“未找到该用户”', async () => {
    const { page } = await openPage()
    await pickFreeSlot(page)
    const input = page.get('[aria-label="同行好友"] input')
    await input.setValue('zhangsan')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(page.get('[aria-label="同行好友"] [role="alert"]').text()).toBe('不能添加自己')
    await input.setValue('nobody')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(page.get('[aria-label="同行好友"] [role="alert"]').text()).toBe('未找到该用户')
  })
})

describe('用户端显示', () => {
  it('成功页：没有同行人时不显示“同行”', () => {
    const wrapper = mount(BookingResult, { props: { result: buildSummary(RESERVATION) } })
    expect(texts(wrapper, 'dt')).toEqual(['地点', '日期', '时间', '状态'])
  })

  it('预约卡片：“同行”行在“预约人”之后；没有同行人时不显示', () => {
    const card = (source: Reservation) => mount(ReservationCardView, {
      props: { card: buildCard(source, null), busy: false, working: false, feedback: null },
    })
    const withCompanions = card(RESERVATION)
    expect(texts(withCompanions, 'dt')).toEqual(['日期', '时间', '预约人', '同行'])
    expect(texts(withCompanions, 'dd').at(-1)).toBe('赵六、李四')
    expect(texts(card({ ...RESERVATION, companions: [] }), 'dt')).toEqual(['日期', '时间', '预约人'])
  })

  it('签到码卡片表头：预约人下面一行“同行：…”；没有同行人时不显示', () => {
    const ticket = (source: Reservation) => mount(CheckInTicket, {
      props: { ticket: buildTicket(source, null, null), entry: { state: 'loading' } },
    })
    expect(texts(ticket(RESERVATION), '.ticket-head .who')).toEqual(['预约人 张三', '同行：赵六、李四'])
    expect(texts(ticket({ ...RESERVATION, companions: [] }), '.ticket-head .who')).toEqual(['预约人 张三'])
  })
})

describe('管理端显示', () => {
  it('预约列表“预约人”格：姓名、用户名、“同行：…”', () => {
    const table = mount(ReservationTable, { props: { rows: [buildReservationRow(ADMIN), buildReservationRow({ ...ADMIN, id: 10, companions: [] })] } })
    const cells = table.findAll('.user')
    expect(cells[0]?.findAll('.detail').map((node) => node.text())).toEqual(['zhangsan', '同行：赵六、李四'])
    expect(cells[1]?.findAll('.detail').map((node) => node.text())).toEqual(['zhangsan'])
  })

  it('扫码结果：最后一项“同行”', () => {
    const result = mount(ScanResult, { props: { outcome: scanSuccess({ ...ADMIN, checkInAt: '2026-10-13T07:52:31' }) } })
    expect(result.text()).toContain('同行')
    expect(result.text()).toContain('赵六、李四')
  })
})
