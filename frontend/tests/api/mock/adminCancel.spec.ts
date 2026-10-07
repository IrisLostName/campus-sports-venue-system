// 管理员取消预约与管理端预约列表（docs/12 第 5.7 节；docs/10 第 6 节；docs/03 第 7 节）。
// 管理员取消不受用户取消期限限制；预约须为 CONFIRMED 且 end_time 在未来；必须填写原因。
import { describe, expect, it } from 'vitest'

import { createHarness, expectApiError, travel, TOMORROW, type Harness } from '../support/harness'

async function asAdmin(username = 'admin_tennis'): Promise<Harness> {
  const h = createHarness()
  await h.loginAs(username)
  return h
}

describe('管理员取消：成功', () => {
  it('置 ADMIN_CANCELLED，admin_note = 原因，记录 cancelledBy 与 cancelledAt', async () => {
    const h = await asAdmin()
    const result = await h.api.adminCancelReservation(1, { reason: '场地维修' })
    expect(result).toMatchObject({
      status: 'ADMIN_CANCELLED', displayStatus: 'ADMIN_CANCELLED', adminNote: '场地维修',
      cancelledBy: 5, cancelledAt: '2026-10-12T07:00:00',
    })
  })

  it('释放时段：其他人随后可预约', async () => {
    const h = await asAdmin()
    await h.api.adminCancelReservation(1, { reason: '场地维修' })
    await h.loginAs('wangwu')
    await expect(h.api.createReservation({ resourceId: 1, serviceDate: TOMORROW, startTime: '08:00' }))
      .resolves.toMatchObject({ status: 'CONFIRMED' })
  })

  it('预约人看到 ADMIN_CANCELLED 与 admin_note', async () => {
    const h = await asAdmin()
    await h.api.adminCancelReservation(1, { reason: '场地维修' })
    await h.loginAs('zhangsan')
    expect((await h.api.getReservation(1))).toMatchObject({ displayStatus: 'ADMIN_CANCELLED', adminNote: '场地维修' })
  })

  it('不受用户取消期限限制：开始前 1 分钟仍可取消', async () => {
    const h = await asAdmin()
    await travel(h, `${TOMORROW}T07:59:00`, 'admin_tennis')
    await expect(h.api.adminCancelReservation(1, { reason: '临时' })).resolves.toMatchObject({ status: 'ADMIN_CANCELLED' })
  })

  it('已签到但 end_time 在未来时仍可取消', async () => {
    const h = await asAdmin()
    await travel(h, `${TOMORROW}T08:00:00`, 'zhangsan')
    await h.api.checkIn(1)
    await h.loginAs('admin_tennis')
    await expect(h.api.adminCancelReservation(1, { reason: '设备故障' })).resolves.toMatchObject({ status: 'ADMIN_CANCELLED' })
  })

  it('系统管理员可取消任意场馆的预约', async () => {
    const h = await asAdmin('sysadmin')
    await expect(h.api.adminCancelReservation(2, { reason: '覆盖' })).resolves.toMatchObject({ status: 'ADMIN_CANCELLED' })
  })

  it('写日志 RESERVATION_CANCEL：前后快照含预约 id，reason 与场馆', async () => {
    const h = await asAdmin()
    await h.api.adminCancelReservation(1, { reason: '场地维修' })
    const [log] = (await h.api.adminListLogs({ action: 'RESERVATION_CANCEL' })).items
    expect(log).toMatchObject({
      adminId: 5, venueId: 1, targetType: 'RESERVATION', targetId: 1, reason: '场地维修',
      before: { affectedReservationIds: [1], object: { status: 'CONFIRMED' } },
      after: { affectedReservationIds: [1], object: { status: 'ADMIN_CANCELLED' } },
    })
  })
})

describe('管理员取消：错误码与阶段顺序', () => {
  it.each([['缺省', undefined], ['空串', ''], ['空白', '   ']])('原因%s → REASON_REQUIRED', async (_label, reason) => {
    const h = await asAdmin()
    const request = reason === undefined ? ({} as { reason: string }) : { reason }
    await expectApiError(h.api.adminCancelReservation(1, request), 'REASON_REQUIRED')
  })

  it('未登录 AUTH_REQUIRED；普通用户 FORBIDDEN（带原因）', async () => {
    const h = createHarness()
    await expectApiError(h.api.adminCancelReservation(1, { reason: 'x' }), 'AUTH_REQUIRED')
    await h.loginAs('zhangsan')
    await expectApiError(h.api.adminCancelReservation(1, { reason: 'x' }), 'FORBIDDEN')
  })

  it('预约不存在 NOT_FOUND；越权场馆 FORBIDDEN_SCOPE 且 details.venueId', async () => {
    const h = await asAdmin('admin_pool')
    await expectApiError(h.api.adminCancelReservation(999, { reason: 'x' }), 'NOT_FOUND')
    await expectApiError(h.api.adminCancelReservation(1, { reason: 'x' }), 'FORBIDDEN_SCOPE', { venueId: 1 })
  })

  it('不是 CONFIRMED（已取消）→ INVALID_STATE', async () => {
    const h = await asAdmin()
    await h.api.adminCancelReservation(1, { reason: 'x' })
    await expectApiError(h.api.adminCancelReservation(1, { reason: 'x' }), 'INVALID_STATE', { status: 'ADMIN_CANCELLED' })
  })

  it('预约已结束（COMPLETED、NO_SHOW）→ INVALID_STATE', async () => {
    const h = await asAdmin()
    await travel(h, `${TOMORROW}T08:00:00`, 'zhangsan')
    await h.api.checkIn(1)
    await travel(h, `${TOMORROW}T09:46:00`, 'admin_tennis')
    await expectApiError(h.api.adminCancelReservation(1, { reason: 'x' }), 'INVALID_STATE', { status: 'COMPLETED' })
    await expectApiError(h.api.adminCancelReservation(2, { reason: 'x' }), 'INVALID_STATE', { status: 'NO_SHOW' })
  })
})

describe('管理端预约列表（docs/12 第 5.7 节）', () => {
  it('场馆管理员只看到授权场馆的预约，并带 userUsername 与 userPhone', async () => {
    const h = await asAdmin('admin_pool')
    expect((await h.api.adminListReservations()).items).toEqual([])
    await h.loginAs('admin_tennis')
    const page = await h.api.adminListReservations()
    expect(page).toMatchObject({ page: 1, pageSize: 20, total: 2 })
    expect(page.items.map((r) => [r.id, r.userUsername, r.userPhone])).toEqual([[2, 'lisi', null], [1, 'zhangsan', null]])
  })

  it('越出授权范围的 venueId → FORBIDDEN_SCOPE；系统管理员不受限', async () => {
    const h = await asAdmin('admin_pool')
    await expectApiError(h.api.adminListReservations({ venueId: 1 }), 'FORBIDDEN_SCOPE')
    await h.loginAs('sysadmin')
    expect((await h.api.adminListReservations({ venueId: 1 })).total).toBe(2)
  })

  it('keyword 匹配用户名、姓名、场地名；status 与日期范围过滤；分页', async () => {
    const h = await asAdmin('sysadmin')
    const ids = async (query: Parameters<typeof h.api.adminListReservations>[0]) =>
      (await h.api.adminListReservations(query)).items.map((r) => r.id)
    expect(await ids({ keyword: 'lisi' })).toEqual([2])
    expect(await ids({ keyword: '张三' })).toEqual([1])
    expect(await ids({ keyword: '网球场2' })).toEqual([2])
    expect(await ids({ status: 'CANCELLED' })).toEqual([])
    expect(await ids({ dateFrom: TOMORROW, dateTo: TOMORROW })).toEqual([2, 1])
    expect(await ids({ dateFrom: '2026-10-14' })).toEqual([])
    const second = await h.api.adminListReservations({ page: 2, pageSize: 1 })
    expect(second.items.map((r) => r.id)).toEqual([1])
    expect(second.total).toBe(2)
  })

  it('普通用户 FORBIDDEN；非法分页参数 VALIDATION_ERROR', async () => {
    const h = await asAdmin('zhangsan')
    await expectApiError(h.api.adminListReservations(), 'FORBIDDEN')
    await h.loginAs('sysadmin')
    await expectApiError(h.api.adminListReservations({ pageSize: 101 }), 'VALIDATION_ERROR')
    await expectApiError(h.api.adminListReservations({ page: 0 }), 'VALIDATION_ERROR')
  })
})
