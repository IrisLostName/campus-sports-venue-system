// TEST-2 K1（FE-8 复审转入）：用户端取消确认层在提交中（busy）不能被遮罩点击或 Esc 关闭；空闲时两者都能关闭。
// 断言的是 CancelDialog 自己把 busy 传给了 UiSheet（去掉该绑定时本文件失败）。
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import type { BookingRules, Reservation } from '../../src/api/types'
import CancelDialog from '../../src/components/reservation/CancelDialog.vue'
import { buildCard } from '../../src/utils/reservationDisplay'

const RULES: BookingRules = {
  slotMinutes: 90, advanceDays: 7, cancelDeadlineMinutes: 120, checkInOpenBeforeMinutes: 15,
  checkInCloseAfterMinutes: 15, checkOutGraceMinutes: 30, maxActiveReservationsPerUser: 3, timezone: 'Asia/Shanghai',
}

const RESERVATION: Reservation = {
  id: 7, venueId: 1, venueName: '网球馆', resourceId: 1, resourceName: '网球场1', userId: 3, userDisplayName: '张三',
  serviceDate: '2026-10-13', startTime: '08:00', endTime: '09:30', status: 'CONFIRMED', displayStatus: 'UPCOMING',
  purpose: null, createdAt: '2026-10-12T08:00:00', cancelledAt: null, cancelReason: null, cancelledBy: null,
  adminNote: null, checkInAt: null, checkOutAt: null,
}

const mounted: VueWrapper[] = []

function mountDialog(busy: boolean): VueWrapper {
  const wrapper = mount(CancelDialog, { props: { target: buildCard(RESERVATION, RULES), busy, reason: '' } })
  mounted.push(wrapper)
  return wrapper
}

function pressEscape(): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
}

afterEach(() => {
  while (mounted.length > 0) {
    mounted.pop()?.unmount()
  }
})

describe('TEST-2 K1 取消确认层：提交中不可关闭', () => {
  it('busy 时点遮罩不发出 dismiss', async () => {
    const dialog = mountDialog(true)
    await dialog.find('.backdrop').trigger('click')

    expect(dialog.emitted('dismiss')).toBeUndefined()
  })

  it('busy 时按 Esc 不发出 dismiss', () => {
    const dialog = mountDialog(true)
    pressEscape()

    expect(dialog.emitted('dismiss')).toBeUndefined()
  })

  it('空闲时点遮罩与按 Esc 都发出 dismiss', async () => {
    const dialog = mountDialog(false)
    await dialog.find('.backdrop').trigger('click')
    pressEscape()

    expect(dialog.emitted('dismiss')).toHaveLength(2)
  })

  it('busy 结束后：Esc 重新可以关闭', async () => {
    const dialog = mountDialog(true)
    pressEscape()
    await dialog.setProps({ busy: false })
    pressEscape()

    expect(dialog.emitted('dismiss')).toHaveLength(1)
  })
})
