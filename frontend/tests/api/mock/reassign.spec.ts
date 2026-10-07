// 管理员改派：资源改派与人员改派（docs/12 第 5.7 节；docs/10 第 6 节；规划裁决 §7-6）。
// 种子预约 1：zhangsan，网球场1，明天 08:00；预约 2：lisi，网球场2，明天 09:30。
import { describe, expect, it } from 'vitest'

import type { ReassignResourceRequest } from '../../../src/api/requests'
import { createHarness, expectApiError, travel, TODAY, TOMORROW, type Harness } from '../support/harness'

const MOVE: ReassignResourceRequest = { resourceId: 3, serviceDate: TOMORROW, startTime: '11:00', reason: '场地保养' }

async function asAdmin(username = 'admin_tennis'): Promise<Harness> {
  const h = createHarness()
  await h.loginAs(username)
  return h
}

describe('资源改派：成功', () => {
  it('换场地与时段：原行更新，仍为 CONFIRMED，endTime 重新计算，admin_note 记录原因', async () => {
    const h = await asAdmin()
    const moved = await h.api.adminReassignResource(1, MOVE)
    expect(moved).toMatchObject({
      id: 1, status: 'CONFIRMED', resourceId: 3, resourceName: '网球场3', serviceDate: TOMORROW,
      startTime: '11:00', endTime: '12:30', adminNote: '场地保养', userDisplayName: '张三',
    })
  })

  it('原时段释放、新时段被占用', async () => {
    const h = await asAdmin()
    await h.api.adminReassignResource(1, MOVE)
    await h.loginAs('lisi')
    const slots = (await h.api.getVenueSlots(1, TOMORROW)).resources
    expect(slots[0]?.slots[0]?.status).toBe('AVAILABLE')
    expect(slots[2]?.slots[2]?.status).toBe('BOOKED')
  })

  it('预约人在“我的预约”里看到变更结果与 admin_note', async () => {
    const h = await asAdmin()
    await h.api.adminReassignResource(1, MOVE)
    await h.loginAs('zhangsan')
    expect((await h.api.listMyReservations()).items[0]).toMatchObject({ resourceName: '网球场3', adminNote: '场地保养' })
  })

  it('改到原来的时段不算冲突（占用检查排除自身），admin_note 照常更新', async () => {
    const h = await asAdmin()
    const same = await h.api.adminReassignResource(1, { resourceId: 1, serviceDate: TOMORROW, startTime: '08:00', reason: '确认' })
    expect(same).toMatchObject({ resourceId: 1, startTime: '08:00', adminNote: '确认' })
  })

  it('不受 advanceDays 限制：可改到第 13 天', async () => {
    const h = await asAdmin()
    const far = await h.api.adminReassignResource(1, { ...MOVE, serviceDate: '2026-10-25' })
    expect(far.serviceDate).toBe('2026-10-25')
  })

  it('写日志 RESERVATION_REASSIGN_RESOURCE，含前后快照与受影响预约 id', async () => {
    const h = await asAdmin()
    await h.api.adminReassignResource(1, MOVE)
    const [log] = (await h.api.adminListLogs({ action: 'RESERVATION_REASSIGN_RESOURCE' })).items
    expect(log).toMatchObject({
      adminName: '网球馆管理员', venueId: 1, targetType: 'RESERVATION', targetId: 1, reason: '场地保养',
      before: { affectedReservationIds: [1], object: { resourceId: 1, startTime: '08:00' } },
      after: { affectedReservationIds: [1], object: { resourceId: 3, startTime: '11:00' } },
    })
  })

  it('系统管理员可跨场馆操作', async () => {
    const h = await asAdmin('sysadmin')
    await expect(h.api.adminReassignResource(1, MOVE)).resolves.toMatchObject({ resourceId: 3 })
  })
})

describe('资源改派：目标检查', () => {
  it.each([
    ['其他场馆的场地', { resourceId: 5 }],
    ['不存在的场地', { resourceId: 999 }],
    ['不是派生出的时段', { startTime: '11:30' }],
    ['窗口之外', { startTime: '20:00' }],
  ])('%s → SLOT_NOT_AVAILABLE', async (_label, patch) => {
    const h = await asAdmin()
    await expectApiError(h.api.adminReassignResource(1, { ...MOVE, ...patch }), 'SLOT_NOT_AVAILABLE')
  })

  it('目标场地维护中、停用、被关闭规则覆盖、场馆已关闭 → SLOT_NOT_AVAILABLE', async () => {
    const h = await asAdmin()
    const { state } = h.context
    const resource3 = state.resources[2]
    const venue = state.venues[0]
    expect(resource3 !== undefined && venue !== undefined).toBe(true)
    if (resource3 === undefined || venue === undefined) {
      return
    }
    for (const status of ['MAINTENANCE', 'DISABLED'] as const) {
      resource3.operationalStatus = status
      await expectApiError(h.api.adminReassignResource(1, MOVE), 'SLOT_NOT_AVAILABLE')
    }
    resource3.operationalStatus = 'OPEN'
    state.closures.push({ id: 1, venueId: 1, resourceId: 3, startDate: TOMORROW, endDate: TOMORROW, reason: null, status: 'ACTIVE' })
    await expectApiError(h.api.adminReassignResource(1, MOVE), 'SLOT_NOT_AVAILABLE')
    state.closures.length = 0
    venue.operationalStatus = 'CLOSED'
    await expectApiError(h.api.adminReassignResource(1, MOVE), 'SLOT_NOT_AVAILABLE')
  })

  it('目标时段已开始 → SLOT_IN_PAST', async () => {
    const h = await asAdmin()
    await travel(h, `${TODAY}T12:00:00`, 'admin_tennis')
    await expectApiError(h.api.adminReassignResource(1, { ...MOVE, serviceDate: TODAY, startTime: '09:30' }), 'SLOT_IN_PAST')
  })

  it('目标时段已有有效预约 → SLOT_TAKEN', async () => {
    const h = await asAdmin()
    await expectApiError(h.api.adminReassignResource(1, { ...MOVE, resourceId: 2, startTime: '09:30' }), 'SLOT_TAKEN')
  })

  it('SLOT_NOT_AVAILABLE 先于 SLOT_IN_PAST，SLOT_IN_PAST 先于 SLOT_TAKEN', async () => {
    const h = await asAdmin()
    await travel(h, `${TOMORROW}T07:00:00`, 'admin_tennis')
    await expectApiError(
      h.api.adminReassignResource(2, { ...MOVE, serviceDate: TOMORROW, startTime: '07:00' }), 'SLOT_NOT_AVAILABLE')
    await travel(h, `${TOMORROW}T09:00:00`, 'admin_tennis')
    await expectApiError(
      h.api.adminReassignResource(2, { resourceId: 1, serviceDate: TOMORROW, startTime: '08:00', reason: 'x' }), 'SLOT_IN_PAST')
  })
})

describe('改派的统一阶段顺序（认证 → 格式 → 原因 → 角色 → 业务）', () => {
  it('未登录 → AUTH_REQUIRED', async () => {
    const h = createHarness()
    await expectApiError(h.api.adminReassignResource(1, MOVE), 'AUTH_REQUIRED')
  })

  it('格式错误先于 REASON_REQUIRED：日期非法且原因为空 → VALIDATION_ERROR', async () => {
    const h = await asAdmin()
    await expectApiError(h.api.adminReassignResource(1, { ...MOVE, serviceDate: 'x', reason: '' }), 'VALIDATION_ERROR')
  })

  it('REASON_REQUIRED 先于角色：普通用户不带原因 → REASON_REQUIRED，带原因 → FORBIDDEN', async () => {
    const h = await asAdmin('zhangsan')
    await expectApiError(h.api.adminReassignResource(1, { ...MOVE, reason: '  ' }), 'REASON_REQUIRED')
    await expectApiError(h.api.adminReassignResource(1, MOVE), 'FORBIDDEN')
  })

  it('预约不存在 → NOT_FOUND；越权场馆 → FORBIDDEN_SCOPE（先于 INVALID_STATE）', async () => {
    const h = await asAdmin('admin_pool')
    await expectApiError(h.api.adminReassignResource(999, MOVE), 'NOT_FOUND')
    await expectApiError(h.api.adminReassignResource(1, MOVE), 'FORBIDDEN_SCOPE', { venueId: 1 })
  })

  it('已取消 → INVALID_STATE；预约已 NO_SHOW → INVALID_STATE', async () => {
    const h = await asAdmin()
    await h.api.adminCancelReservation(1, { reason: '取消' })
    await expectApiError(h.api.adminReassignResource(1, MOVE), 'INVALID_STATE', { status: 'ADMIN_CANCELLED' })
    await travel(h, `${TOMORROW}T09:46:00`, 'admin_tennis')
    await expectApiError(h.api.adminReassignResource(2, MOVE), 'INVALID_STATE', { status: 'NO_SHOW' })
  })

  it('已签到 → ALREADY_CHECKED_IN（先于目标检查）', async () => {
    const h = await asAdmin()
    await travel(h, `${TOMORROW}T07:50:00`, 'zhangsan')
    await h.api.checkIn(1)
    await h.loginAs('admin_tennis')
    await expectApiError(h.api.adminReassignResource(1, { ...MOVE, resourceId: 999 }), 'ALREADY_CHECKED_IN')
  })
})

describe('人员改派', () => {
  it('预约分配给另一名用户：原行更新，仍为 CONFIRMED，admin_note 记录原因，写日志', async () => {
    const h = await asAdmin()
    const moved = await h.api.adminReassignUser(1, { userId: 3, reason: '转让' })
    expect(moved).toMatchObject({ id: 1, status: 'CONFIRMED', userId: 3, userDisplayName: '王五', adminNote: '转让' })
    const [log] = (await h.api.adminListLogs({ action: 'RESERVATION_REASSIGN_USER' })).items
    expect(log).toMatchObject({ targetId: 1, reason: '转让', venueId: 1 })
  })

  it('不校验目标用户的预约数上限（管理员覆盖优先）', async () => {
    const h = await asAdmin()
    await h.loginAs('wangwu')
    for (const resourceId of [3, 4]) {
      await h.api.createReservation({ resourceId, serviceDate: TOMORROW, startTime: '14:00' })
    }
    await h.api.createReservation({ resourceId: 1, serviceDate: TOMORROW, startTime: '14:00' })
    await h.loginAs('admin_tennis')
    await expect(h.api.adminReassignUser(1, { userId: 3, reason: '覆盖' })).resolves.toMatchObject({ userId: 3 })
  })

  it.each([['管理员账号', 5], ['不存在的用户', 999]])('目标是%s → USER_NOT_ELIGIBLE', async (_label, userId) => {
    const h = await asAdmin()
    await expectApiError(h.api.adminReassignUser(1, { userId, reason: '转让' }), 'USER_NOT_ELIGIBLE')
  })

  it('目标账号已停用 → USER_NOT_ELIGIBLE', async () => {
    const h = await asAdmin()
    const target = h.context.state.users.find((user) => user.id === 3)
    if (target !== undefined) {
      target.status = 'DISABLED'
    }
    await expectApiError(h.api.adminReassignUser(1, { userId: 3, reason: '转让' }), 'USER_NOT_ELIGIBLE')
  })

  it('原因必填、角色、范围、状态与签到前置', async () => {
    const h = await asAdmin()
    await expectApiError(h.api.adminReassignUser(1, { userId: 3, reason: '' }), 'REASON_REQUIRED')
    await expectApiError(h.api.adminReassignUser(999, { userId: 3, reason: 'x' }), 'NOT_FOUND')
    await h.api.adminCancelReservation(1, { reason: '取消' })
    await expectApiError(h.api.adminReassignUser(1, { userId: 3, reason: 'x' }), 'INVALID_STATE')
    await h.loginAs('admin_pool')
    await expectApiError(h.api.adminReassignUser(2, { userId: 3, reason: 'x' }), 'FORBIDDEN_SCOPE')
    await h.loginAs('lisi')
    await expectApiError(h.api.adminReassignUser(2, { userId: 3, reason: 'x' }), 'FORBIDDEN')
  })

  it('已签到 → ALREADY_CHECKED_IN', async () => {
    const h = await asAdmin()
    await travel(h, `${TOMORROW}T07:50:00`, 'zhangsan')
    await h.api.checkIn(1)
    await h.loginAs('admin_tennis')
    await expectApiError(h.api.adminReassignUser(1, { userId: 3, reason: 'x' }), 'ALREADY_CHECKED_IN')
  })
})
