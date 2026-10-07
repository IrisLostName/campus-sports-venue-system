// 展示状态 displayStatus 与落库状态的时间判定点（docs/03 第 4.3、4.4 节）。前端不推导，全部来自接口。
// 种子预约 1：zhangsan，明天 08:00–09:30。
import { describe, expect, it } from 'vitest'

import { createHarness, travel, TODAY, TOMORROW } from '../support/harness'

const ID = 1
const at = (time: string) => `${TOMORROW}T${time}`

async function statusAt(time: string, before?: (h: Awaited<ReturnType<typeof setup>>) => Promise<void>) {
  const h = await setup()
  if (before !== undefined) {
    await before(h)
  }
  await travel(h, at(time), 'zhangsan')
  const reservation = await h.api.getReservation(ID)
  return [reservation.displayStatus, reservation.status]
}

async function setup() {
  const h = createHarness()
  await travel(h, `${TODAY}T07:00:00`, 'zhangsan')
  return h
}

describe('从未签到的预约', () => {
  it.each([
    ['07:44:59', 'UPCOMING', 'CONFIRMED'],
    ['07:45:00', 'CHECKIN_OPEN', 'CONFIRMED'],
    ['08:15:00', 'CHECKIN_OPEN', 'CONFIRMED'],
    ['08:15:01', 'NO_SHOW', 'NO_SHOW'],
    ['12:00:00', 'NO_SHOW', 'NO_SHOW'],
  ])('%s → displayStatus %s，status %s', async (time, display, status) => {
    expect(await statusAt(time)).toEqual([display, status])
  })
})

describe('已签到的预约', () => {
  const checkIn = async (h: Awaited<ReturnType<typeof setup>>) => {
    await travel(h, at('08:00:00'), 'zhangsan')
    await h.api.checkIn(ID)
  }

  it.each([
    ['08:30:00', 'IN_USE', 'CONFIRMED'],
    ['09:29:59', 'IN_USE', 'CONFIRMED'],
    ['09:30:00', 'COMPLETED', 'COMPLETED'],
    ['11:00:00', 'COMPLETED', 'COMPLETED'],
  ])('签到后未签退，%s → %s / %s', async (time, display, status) => {
    expect(await statusAt(time, checkIn)).toEqual([display, status])
  })

  it('签到并签退后，结束前为 CHECKED_OUT，结束时刻起为 COMPLETED', async () => {
    const checkOut = async (h: Awaited<ReturnType<typeof setup>>) => {
      await checkIn(h)
      h.clock.set(at('08:45:00'))
      await h.api.checkOut(ID)
    }
    expect(await statusAt('09:29:59', checkOut)).toEqual(['CHECKED_OUT', 'CONFIRMED'])
    expect(await statusAt('09:30:00', checkOut)).toEqual(['COMPLETED', 'COMPLETED'])
  })
})

describe('取消类终态', () => {
  it('用户取消 → CANCELLED', async () => {
    const cancel = async (h: Awaited<ReturnType<typeof setup>>) => {
      await h.api.cancelReservation(ID)
    }
    expect(await statusAt('09:00:00', cancel)).toEqual(['CANCELLED', 'CANCELLED'])
  })

  it('管理员取消 → ADMIN_CANCELLED', async () => {
    const adminCancel = async (h: Awaited<ReturnType<typeof setup>>) => {
      await h.loginAs('admin_tennis')
      await h.api.adminCancelReservation(ID, { reason: '场地维修' })
      await h.loginAs('zhangsan')
    }
    expect(await statusAt('09:00:00', adminCancel)).toEqual(['ADMIN_CANCELLED', 'ADMIN_CANCELLED'])
  })

  it('NO_SHOW 的时段在占用总览中状态为 PAST，但 reservation 字段仍填充（规划裁决 A7）', async () => {
    const h = await setup()
    await travel(h, at('08:20:00'), 'sysadmin')
    const slot = (await h.api.adminGetOccupancy(1, TOMORROW)).resources[0]?.slots[0]
    expect(slot).toMatchObject({
      status: 'PAST', reservation: { id: ID, userDisplayName: '张三', displayStatus: 'NO_SHOW' },
    })
  })
})
