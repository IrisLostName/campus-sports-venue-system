// FE-6 G1 / A9 / N5：场馆资料与开关。新增、只提交改动的字段、开放预约开关不做影响检查、关闭场馆走影响检查流程、重新开放。
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../src/api/errors'
import { createSysVenues } from '../../src/composables/sysVenues'
import {
  buildCreateVenueRequest, buildUpdateVenueRequest, BOOKING_SWITCH_LABEL, VENUE_STATUS_LABELS, VENUE_TYPE_LABELS,
  VENUE_TYPE_OPTIONS,
} from '../../src/utils/sysVenueDisplay'
import { TOMORROW, loginAdmin, spyOn } from '../admin/harness'

async function openBoard() {
  const ctx = await loginAdmin('sysadmin')
  const spy = spyOn(ctx.api)
  let contextReloads = 0
  const board = createSysVenues({ api: spy.client, call: ctx.call }, async () => { contextReloads += 1 })
  await board.load()
  return { ctx, spy, board, reloads: () => contextReloads }
}

function updateCalls(spy: ReturnType<typeof spyOn>) {
  return spy.calls.filter((call) => call.method === 'adminUpdateVenue')
}

describe('G1 展示口径', () => {
  it('VenueType 五个取值都有中文名；文档没有的两项是施工拟定', () => {
    expect(VENUE_TYPE_LABELS).toEqual({ TENNIS: '网球', BADMINTON: '羽毛球', SWIMMING: '游泳', BASKETBALL: '篮球', OTHER: '其他' })
    expect(VENUE_TYPE_OPTIONS.map((option) => option.value)).toEqual(['TENNIS', 'BADMINTON', 'SWIMMING', 'BASKETBALL', 'OTHER'])
    expect(VENUE_STATUS_LABELS).toEqual({ OPEN: '开放', CLOSED: '已关闭' })
    expect(BOOKING_SWITCH_LABEL).toBe('对用户开放预约')
  })

  it('列表行：名称、类型、位置、状态、开关、场地数全部取自接口', async () => {
    const { board } = await openBoard()

    expect(board.rows.value.map((row) => [row.name, row.typeLabel, row.statusLabel, row.bookingEnabled, row.resourceCount])).toEqual([
      ['网球馆', '网球', '开放', true, 4],
      ['羽毛球馆', '羽毛球', '开放', false, 6],
      ['游泳馆', '游泳', '开放', false, 6],
    ])
    expect(board.rows.value[0]?.locationText).toBeNull()
  })

  it('请求构造：新建时空的可选字段不发送；编辑时只含改动的字段', async () => {
    const { ctx } = await openBoard()
    const venues = await ctx.api.adminListVenues()
    const tennis = venues[0]
    if (tennis === undefined) {
      throw new Error('缺少种子场馆')
    }

    expect(buildCreateVenueRequest({ name: ' 篮球馆 ', venueType: 'BASKETBALL', location: ' ', description: '' }))
      .toEqual({ name: '篮球馆', venueType: 'BASKETBALL' })
    expect(buildCreateVenueRequest({ name: '篮球馆', venueType: 'BASKETBALL', location: '东区', description: '室内' }))
      .toEqual({ name: '篮球馆', venueType: 'BASKETBALL', location: '东区', description: '室内' })
    expect(buildUpdateVenueRequest(tennis, { name: '网球馆', venueType: 'TENNIS', location: '', description: '' })).toEqual({})
    expect(buildUpdateVenueRequest(tennis, { name: '网球中心', venueType: 'TENNIS', location: '南区', description: '' }))
      .toEqual({ name: '网球中心', location: '南区' })
  })
})

describe('G1 新增场馆', () => {
  it('新场馆默认开放运营、不开放预约、无场地；提示指向“场地与开放规则”；外壳的场馆列表同步刷新', async () => {
    const { board, spy, reloads } = await openBoard()
    Object.assign(board.form, { name: '篮球馆', venueType: 'BASKETBALL', location: '', description: '' })
    await board.submitCreate()

    expect(spy.calls.filter((call) => call.method === 'adminCreateVenue').map((call) => call.args)).toEqual([[{ name: '篮球馆', venueType: 'BASKETBALL' }]])
    const row = board.rows.value.find((item) => item.name === '篮球馆')
    expect(row).toMatchObject({ typeLabel: '篮球', statusLabel: '开放', bookingEnabled: false, resourceCount: 0 })
    expect(board.created.value).toEqual({ id: row?.id, name: '篮球馆' })
    expect(board.notice.value).toBe('已新增场馆“篮球馆”。请到“场地与开放规则”设定场地数量和每周开放窗口。')
    expect(board.form).toEqual({ name: '', venueType: '', location: '', description: '' })
    expect(reloads()).toBe(1)
  })

  it('名称或类型为空：显示提示，不发请求', async () => {
    const { board, spy } = await openBoard()
    await board.submitCreate()
    expect(board.formError.value).toBe('请填写场馆名称')

    board.form.name = '篮球馆'
    await board.submitCreate()
    expect(board.formError.value).toBe('请选择场馆类型')
    expect(spy.calls.some((call) => call.method === 'adminCreateVenue')).toBe(false)
  })

  it('接口拒绝（场馆名重复）：表单保留，显示接口文案', async () => {
    const { board } = await openBoard()
    Object.assign(board.form, { name: '网球馆', venueType: 'TENNIS' })
    await board.submitCreate()

    expect(board.formError.value).toBe('请求参数不合法')
    expect(board.form.name).toBe('网球馆')
    expect(board.created.value).toBeNull()
  })
})

describe('G1 / N5 编辑资料只提交改动的字段', () => {
  it('只改位置：请求里只有 location；null 的简介不会被提交成空串', async () => {
    const { board, spy } = await openBoard()
    board.openEdit(1)
    board.patchEdit({ location: '东区体育中心' })
    await board.confirmEdit()

    expect(updateCalls(spy).map((call) => call.args)).toEqual([[1, { location: '东区体育中心' }]])
    expect(board.edit.value).toBeNull()
    expect(board.notice.value).toBe('场馆资料已保存')
    expect(board.rows.value[0]?.locationText).toBe('东区体育中心')
  })

  it('没有任何改动：提示且不发请求', async () => {
    const { board, spy } = await openBoard()
    board.openEdit(1)
    await board.confirmEdit()

    expect(updateCalls(spy)).toEqual([])
    expect(board.edit.value?.error).toBe('没有需要保存的修改')
  })

  it('名称为空：提示，不发请求', async () => {
    const { board, spy } = await openBoard()
    board.openEdit(1)
    board.patchEdit({ name: '  ' })
    await board.confirmEdit()

    expect(updateCalls(spy)).toEqual([])
    expect(board.edit.value?.error).toBe('请填写场馆名称')
  })

  it('把非空简介清空：照实提交空串，接口拒绝时对话框显示接口文案，不另造规则', async () => {
    const { board, spy } = await openBoard()
    board.openEdit(1)
    board.patchEdit({ description: '室内网球场' })
    await board.confirmEdit()
    board.openEdit(1)
    board.patchEdit({ description: '' })
    await board.confirmEdit()

    expect(updateCalls(spy).map((call) => call.args)).toEqual([[1, { description: '室内网球场' }], [1, { description: '' }]])
    expect(board.edit.value?.error).toBe('请求参数不合法')
  })
})

describe('G1 / A9 开放预约开关不做影响检查', () => {
  it('打开羽毛球馆：只发一次 userBookingEnabled=true，没有 dryRun；同一会话里 USER 立即看到可预约', async () => {
    const { ctx, spy, board } = await openBoard()
    const zhangsan = await ctx.h.clientFor('zhangsan')
    expect((await zhangsan.listVenues()).find((venue) => venue.id === 2)?.bookable).toBe(false)

    await board.status.toggleBooking(2, true)

    expect(updateCalls(spy).map((call) => call.args)).toEqual([[2, { userBookingEnabled: true }]])
    expect(board.status.flow.dialog.value).toBeNull()
    expect(board.notice.value).toBe('羽毛球馆已对用户开放预约')
    expect(board.rows.value.find((row) => row.id === 2)?.bookingEnabled).toBe(true)
    expect((await zhangsan.listVenues()).find((venue) => venue.id === 2)?.bookable).toBe(true)
    expect((await zhangsan.getVenueSlots(2, TOMORROW)).venueId).toBe(2)
  })

  it('关闭有预约的网球馆的开关：不弹影响检查，既有预约保持不变', async () => {
    const { ctx, spy, board } = await openBoard()
    await board.status.toggleBooking(1, false)

    expect(updateCalls(spy).map((call) => call.args)).toEqual([[1, { userBookingEnabled: false }]])
    expect(board.status.flow.dialog.value).toBeNull()
    const reservations = await ctx.api.adminListReservations({ venueId: 1 })
    expect(reservations.items.map((item) => item.status)).toEqual(['CONFIRMED', 'CONFIRMED'])
    const zhangsan = await ctx.h.clientFor('zhangsan')
    await expect(zhangsan.getVenueSlots(1, TOMORROW)).rejects.toMatchObject({ code: 'VENUE_NOT_BOOKABLE' })
  })

  it('失败时显示文案并与服务端对齐', async () => {
    const ctx = await loginAdmin('sysadmin')
    const failing = { ...ctx.api, adminUpdateVenue: () => Promise.reject(new ApiError(403, 'FORBIDDEN', '无权')) }
    const board = createSysVenues({ api: failing, call: ctx.call }, async () => undefined)
    await board.load()
    await board.status.toggleBooking(2, true)

    expect(board.error.value).toBe('无权执行此操作')
    expect(board.rows.value.find((row) => row.id === 2)?.bookingEnabled).toBe(false)
  })
})

describe('G1 关闭场馆走影响检查流程', () => {
  it('网球馆有 2 个未来预约：先 dryRun，对话框列出预约，什么都不预选；未选择 / 缺原因都不提交', async () => {
    const { spy, board } = await openBoard()
    await board.status.askClose(1)

    const dialog = board.status.flow.dialog.value
    expect(dialog?.title).toBe('关闭场馆：网球馆')
    expect(dialog?.impact.affectedCount).toBe(2)
    expect(dialog?.choice).toBeNull()
    expect(updateCalls(spy).map((call) => call.args)).toEqual([[1, { operationalStatus: 'CLOSED', dryRun: true }]])
    expect(board.rows.value[0]?.statusLabel).toBe('开放')

    await board.status.flow.confirm()
    expect(board.status.flow.dialog.value?.error).toBe('请选择保留或取消')
    board.status.flow.choose('CANCEL')
    await board.status.flow.confirm()
    expect(board.status.flow.dialog.value?.error).toBe('请填写原因')
    expect(updateCalls(spy)).toHaveLength(1)
  })

  it('选取消并填原因：场馆关闭，2 个预约被管理员取消，提示显示数量', async () => {
    const { ctx, board } = await openBoard()
    await board.status.askClose(1)
    board.status.flow.choose('CANCEL')
    board.status.flow.setReason('场馆装修')
    await board.status.flow.confirm()

    expect(board.status.flow.dialog.value).toBeNull()
    expect(board.notice.value).toBe('已保存，并取消 2 个受影响预约')
    expect(board.rows.value[0]).toMatchObject({ statusLabel: '已关闭', open: false })
    const reservations = await ctx.api.adminListReservations({ venueId: 1 })
    expect(reservations.items.map((item) => [item.status, item.adminNote])).toEqual([['ADMIN_CANCELLED', '场馆装修'], ['ADMIN_CANCELLED', '场馆装修']])
  })

  it('选保留：场馆关闭，预约保持有效', async () => {
    const { ctx, board } = await openBoard()
    await board.status.askClose(1)
    board.status.flow.choose('KEEP')
    await board.status.flow.confirm()

    expect(board.rows.value[0]?.statusLabel).toBe('已关闭')
    expect(board.notice.value).toBe('已保存')
    expect((await ctx.api.adminListReservations({ venueId: 1 })).items.map((item) => item.status)).toEqual(['CONFIRMED', 'CONFIRMED'])
  })

  it('没有受影响的预约（游泳馆）：普通确认后直接提交，不带 onExistingReservations', async () => {
    const { spy, board } = await openBoard()
    await board.status.askClose(3)
    expect(board.status.flow.dialog.value?.impact.affectedCount).toBe(0)
    await board.status.flow.confirm()

    expect(updateCalls(spy).map((call) => call.args)).toEqual([
      [3, { operationalStatus: 'CLOSED', dryRun: true }],
      [3, { operationalStatus: 'CLOSED' }],
    ])
    expect(board.rows.value[2]?.statusLabel).toBe('已关闭')
  })

  it('重新开放：直接提交 operationalStatus=OPEN，没有 dryRun 与对话框', async () => {
    const { spy, board } = await openBoard()
    await board.status.askClose(3)
    await board.status.flow.confirm()
    await board.status.reopen(3)

    expect(updateCalls(spy).map((call) => call.args).at(-1)).toEqual([3, { operationalStatus: 'OPEN' }])
    expect(board.status.flow.dialog.value).toBeNull()
    expect(board.notice.value).toBe('场馆已重新开放')
    expect(board.rows.value[2]?.statusLabel).toBe('开放')
  })

  it('开放的场馆“重新开放”、不存在的场馆“关闭”都被忽略', async () => {
    const { spy, board } = await openBoard()
    await board.status.reopen(1)
    await board.status.askClose(99)

    expect(updateCalls(spy)).toEqual([])
  })
})

describe('G1 X1 登录失效', () => {
  it('TOKEN_EXPIRED：回到登录页，不展示错误', async () => {
    const ctx = await loginAdmin('sysadmin')
    const failing = { ...ctx.api, adminListVenues: () => Promise.reject(new ApiError(401, 'TOKEN_EXPIRED', '过期')) }
    const board = createSysVenues({ api: failing, call: ctx.call }, async () => undefined)
    await board.load()

    expect(ctx.h.router.currentRoute.value.path).toBe('/login')
    expect(board.error.value).toBeNull()
  })
})
