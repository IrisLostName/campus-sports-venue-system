// FE-5 P2：预约管理。种子：zhangsan 明天 08:00 网球场1（预约 1），lisi 明天 09:30 网球场2（预约 2）。
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../src/api/errors'
import type { ApiClient } from '../../src/api/client'
import { createAdminReservations } from '../../src/composables/adminReservations'
import { buildReservationRow, opsFor, parseUserId } from '../../src/utils/adminReservationDisplay'
import { loginAdmin, spyOn, TOMORROW } from './harness'

async function open(wrap: (client: ApiClient) => ApiClient = (client) => client) {
  const ctx = await loginAdmin('admin_tennis')
  const spy = spyOn(wrap(ctx.api))
  const board = createAdminReservations({ api: spy.client, call: ctx.call }, 1)
  await board.load()
  return { ctx, board, calls: spy.calls }
}

describe('P2 按钮规则（Q1，只看 status / displayStatus / checkInAt）', () => {
  it.each([
    ['CONFIRMED', 'UPCOMING', null, ['CANCEL', 'REASSIGN_RESOURCE', 'REASSIGN_USER']],
    ['CONFIRMED', 'CHECKIN_OPEN', null, ['CANCEL', 'REASSIGN_RESOURCE', 'REASSIGN_USER']],
    ['CONFIRMED', 'IN_USE', '2026-10-13T08:00:00', ['CANCEL']],
    ['CONFIRMED', 'CHECKED_OUT', '2026-10-13T08:00:00', ['CANCEL']],
    ['CONFIRMED', 'COMPLETED', '2026-10-13T08:00:00', []],
    ['CONFIRMED', 'NO_SHOW', null, []],
    ['COMPLETED', 'COMPLETED', '2026-10-13T08:00:00', []],
    ['CANCELLED', 'CANCELLED', null, []],
    ['ADMIN_CANCELLED', 'ADMIN_CANCELLED', null, []],
    ['NO_SHOW', 'NO_SHOW', null, []],
  ] as const)('%s / %s / checkInAt=%s → %j', (status, displayStatus, checkInAt, ops) => {
    expect(opsFor({ status, displayStatus, checkInAt })).toEqual(ops)
  })

  it('目标用户 ID 只接受正整数', () => {
    expect(parseUserId(' 12 ')).toBe(12)
    for (const bad of ['', '0', '-1', '1.5', 'abc', '01']) {
      expect(parseUserId(bad)).toBeNull()
    }
  })
})

describe('P2 列表与筛选', () => {
  it('按所选场馆查询，行内容与状态来自后端', async () => {
    const { board, calls } = await open()

    expect(calls[0]).toEqual({ method: 'adminListReservations', args: [{ venueId: 1, page: 1 }] })
    const byId = [...board.rows.value].sort((a, b) => a.id - b.id)
    expect(byId.map((row) => [row.id, row.dateText, row.timeText, row.place, row.userName, row.userDetail, row.statusLabel, row.tone]))
      .toEqual([
        [1, TOMORROW, '08:00–09:30', '网球场1', '张三', 'zhangsan', '待使用', 'success'],
        [2, TOMORROW, '09:30–11:00', '网球场2', '李四', 'lisi', '待使用', 'success'],
      ])
    expect(byId[0]?.ops).toEqual(['CANCEL', 'REASSIGN_RESOURCE', 'REASSIGN_USER'])
  })

  it('筛选条件逐项进入查询；空条件不进入；查询回到第一页', async () => {
    const { board, calls } = await open()
    board.filters.dateFrom = TOMORROW
    board.filters.dateTo = '2026-10-14'
    board.filters.status = 'CONFIRMED'
    board.filters.keyword = ' 李四 '
    await board.search()

    expect(calls[1]?.args).toEqual([{ venueId: 1, page: 1, dateFrom: TOMORROW, dateTo: '2026-10-14', status: 'CONFIRMED', keyword: '李四' }])
    expect(board.rows.value.map((row) => row.userName)).toEqual(['李四'])
    expect(board.list.total.value).toBe(1)

    board.filters.status = 'CANCELLED'
    await board.search()
    expect(board.rows.value).toEqual([])
  })

  it('翻页取接口返回的页码', async () => {
    const { board, calls } = await open()
    await board.goTo(2)

    expect(calls[1]?.args).toEqual([{ venueId: 1, page: 2 }])
    expect(board.list.page.value).toBe(2)
  })

  it('越权场馆：FORBIDDEN_SCOPE 文案', async () => {
    const ctx = await loginAdmin('admin_tennis')
    const board = createAdminReservations({ api: ctx.api, call: ctx.call }, 2)
    await board.load()

    expect(board.list.error.value).toBe('无权操作该场馆')
  })
})

describe('P2 取消', () => {
  it('原因必填：为空不发请求；填写后调用 adminCancelReservation，列表刷新，预约人能看到说明', async () => {
    const { ctx, board, calls } = await open()
    board.actions.openCancel(1)
    expect(board.actions.cancel.value).toMatchObject({ id: 1, reason: '' })
    expect(board.actions.cancel.value?.summary).toBe('网球馆 · 网球场1 · 2026-10-13 08:00–09:30 · 张三')

    await board.actions.confirmCancel()
    expect(board.actions.cancel.value?.error).toBe('请填写原因')
    expect(calls.some((call) => call.method === 'adminCancelReservation')).toBe(false)

    board.actions.patchCancel({ reason: ' 场地检修 ' })
    await board.actions.confirmCancel()

    expect(calls.find((call) => call.method === 'adminCancelReservation')?.args).toEqual([1, { reason: '场地检修' }])
    expect(board.actions.cancel.value).toBeNull()
    expect(board.notice.value).toBe('预约已取消')
    expect(board.rows.value.find((row) => row.id === 1)).toMatchObject({ statusLabel: '管理员已取消', tone: 'danger', ops: [], adminNote: '场地检修' })
    const owner = await ctx.h.clientFor('zhangsan')
    expect(await owner.getReservation(1)).toMatchObject({ status: 'ADMIN_CANCELLED', adminNote: '场地检修' })
  })

  it('没有“取消”按钮的预约不会打开对话框', async () => {
    const { board } = await open()
    await board.actions.confirmCancel()
    board.actions.openCancel(999)

    expect(board.actions.cancel.value).toBeNull()
  })

  it('列表已过期（别处已取消）：INVALID_STATE 文案，对话框保持，列表刷新后按钮消失', async () => {
    const { ctx, board } = await open()
    board.actions.openCancel(1)
    await ctx.api.adminCancelReservation(1, { reason: '别处已处理' })
    board.actions.patchCancel({ reason: '重复取消' })
    await board.actions.confirmCancel()

    expect(board.actions.cancel.value?.error).toBe('当前状态不允许该操作')
    expect(board.actions.cancel.value?.busy).toBe(false)
    expect(board.rows.value.find((row) => row.id === 1)?.ops).toEqual([])
  })

  it('FORBIDDEN_SCOPE 与 FORBIDDEN 都显示后端错误码对应的文案', async () => {
    for (const [code, text] of [['FORBIDDEN_SCOPE', '无权操作该场馆'], ['FORBIDDEN', '无权执行此操作']] as const) {
      const { board } = await open((client) => ({
        ...client, adminCancelReservation: () => Promise.reject(new ApiError(403, code, '后端文案')),
      }))
      board.actions.openCancel(1)
      board.actions.patchCancel({ reason: 'x' })
      await board.actions.confirmCancel()

      expect(board.actions.cancel.value?.error).toBe(text)
    }
  })

  it('进行中不重复提交', async () => {
    const { board, calls } = await open()
    board.actions.openCancel(1)
    board.actions.patchCancel({ reason: 'x' })
    await Promise.all([board.actions.confirmCancel(), board.actions.confirmCancel()])

    expect(calls.filter((call) => call.method === 'adminCancelReservation')).toHaveLength(1)
  })
})

describe('P2 资源改派', () => {
  it('打开后取该预约日期的占用总览；目标场地可选，时间只列 AVAILABLE 的格子', async () => {
    const { board, calls } = await open()
    await board.reassign.open(1)

    expect(calls.find((call) => call.method === 'adminGetOccupancy')?.args).toEqual([1, TOMORROW])
    const state = board.reassign.state.value
    expect(state?.loading).toBe(false)
    expect(state?.options.map((option) => option.name)).toEqual(['网球场1', '网球场2', '网球场3', '网球场4'])
    expect(state?.options[0]?.slots.map((slot) => slot.startTime)).not.toContain('08:00')
    expect(state?.options[1]?.slots.map((slot) => slot.startTime)).not.toContain('09:30')
    expect(state?.options[2]?.slots[0]).toEqual({ startTime: '08:00', timeText: '08:00–09:30' })
  })

  it('校验顺序：场地 → 开始时间 → 原因，缺任何一项都不发请求', async () => {
    const { board, calls } = await open()
    await board.reassign.open(1)
    await board.reassign.confirm()
    expect(board.reassign.state.value?.error).toBe('请选择目标场地')
    board.reassign.patch({ resourceId: '3', error: null })
    await board.reassign.confirm()
    expect(board.reassign.state.value?.error).toBe('请选择开始时间')
    board.reassign.patch({ startTime: '11:00', error: null })
    await board.reassign.confirm()
    expect(board.reassign.state.value?.error).toBe('请填写原因')

    expect(calls.some((call) => call.method === 'adminReassignResource')).toBe(false)
  })

  it('改派到本馆另一个场地：原预约原地更新，列表刷新', async () => {
    const { ctx, board, calls } = await open()
    await board.reassign.open(1)
    board.reassign.patch({ resourceId: '3', startTime: '11:00', reason: ' 球场翻新 ' })
    await board.reassign.confirm()

    expect(calls.find((call) => call.method === 'adminReassignResource')?.args).toEqual([
      1, { resourceId: 3, serviceDate: TOMORROW, startTime: '11:00', reason: '球场翻新' },
    ])
    expect(board.reassign.state.value).toBeNull()
    expect(board.notice.value).toBe('已改派场地')
    expect(board.rows.value.find((row) => row.id === 1)).toMatchObject({ place: '网球场3', timeText: '11:00–12:30' })
    expect((await ctx.api.getReservation(1)).status).toBe('CONFIRMED')
  })

  it('日期不限于未来 7 天：换到一个月后的日期也能改派（不受 advanceDays 限制）', async () => {
    const { ctx, board, calls } = await open()
    await board.reassign.open(1)
    await board.reassign.setDate('2026-11-16')

    expect(calls.filter((call) => call.method === 'adminGetOccupancy').map((call) => call.args[1])).toEqual([TOMORROW, '2026-11-16'])
    expect(board.reassign.state.value).toMatchObject({ date: '2026-11-16', resourceId: '', startTime: '' })
    board.reassign.patch({ resourceId: '1', startTime: '08:00', reason: '延期' })
    await board.reassign.confirm()

    expect(board.reassign.state.value).toBeNull()
    expect((await ctx.api.getReservation(1)).serviceDate).toBe('2026-11-16')
  })

  it('连续换日期：以最后一次为准，清空日期被忽略', async () => {
    const { board } = await open()
    await board.reassign.open(1)
    await Promise.all([board.reassign.setDate('2026-10-14'), board.reassign.setDate('2026-10-15')])
    await board.reassign.setDate('')

    expect(board.reassign.state.value).toMatchObject({ date: '2026-10-15', loading: false })
    expect(board.reassign.state.value?.options).toHaveLength(4)
  })

  it('提交时时段被别人抢先：SLOT_TAKEN 文案，对话框保持', async () => {
    const { ctx, board } = await open()
    await board.reassign.open(1)
    board.reassign.patch({ resourceId: '3', startTime: '11:00', reason: '换场' })
    const other = await ctx.h.clientFor('wangwu')
    await other.createReservation({ resourceId: 3, serviceDate: TOMORROW, startTime: '11:00' })
    await board.reassign.confirm()

    expect(board.reassign.state.value?.error).toBe('该时段刚刚被别人预约了，请重新选择')
    expect((await ctx.api.getReservation(1)).resourceName).toBe('网球场1')
  })

  it('已签到的预约没有改派按钮', async () => {
    const { board } = await open((client) => ({
      ...client,
      adminListReservations: async (query) => {
        const page = await client.adminListReservations(query)
        return { ...page, items: page.items.map((item) => ({ ...item, checkInAt: '2026-10-13T07:50:00', displayStatus: 'IN_USE' as const })) }
      },
    }))
    await board.reassign.open(1)

    expect(board.reassign.state.value).toBeNull()
    expect(board.rows.value[0]?.ops).toEqual(['CANCEL'])
  })
})

describe('P2 人员改派', () => {
  it('目标用户 ID 与原因都必填；ID 不是正整数时给出提示', async () => {
    const { board, calls } = await open()
    board.actions.openUser(1)
    await board.actions.confirmUser()
    expect(board.actions.user.value?.error).toBe('请输入有效的用户 ID（正整数）')
    board.actions.patchUser({ userId: 'abc' })
    await board.actions.confirmUser()
    expect(board.actions.user.value?.error).toBe('请输入有效的用户 ID（正整数）')
    board.actions.patchUser({ userId: '3', error: null })
    await board.actions.confirmUser()
    expect(board.actions.user.value?.error).toBe('请填写原因')

    expect(calls.some((call) => call.method === 'adminReassignUser')).toBe(false)
  })

  it('提交 userId + reason；成功后预约人改变', async () => {
    const { ctx, board, calls } = await open()
    board.actions.openUser(1)
    board.actions.patchUser({ userId: ' 3 ', reason: '本人委托' })
    await board.actions.confirmUser()

    expect(calls.find((call) => call.method === 'adminReassignUser')?.args).toEqual([1, { userId: 3, reason: '本人委托' }])
    expect(board.actions.user.value).toBeNull()
    expect(board.notice.value).toBe('已改派预约人')
    expect(board.rows.value.find((row) => row.id === 1)).toMatchObject({ userName: '王五', adminNote: '本人委托' })
    expect((await ctx.api.getReservation(1)).userId).toBe(3)
  })

  it('目标用户不存在 / 不是普通用户：USER_NOT_ELIGIBLE 文案，对话框保持', async () => {
    const { board } = await open()
    for (const userId of ['999', '5']) {
      board.actions.openUser(1)
      board.actions.patchUser({ userId, reason: 'x' })
      await board.actions.confirmUser()

      expect(board.actions.user.value?.error).toBe('目标用户不可被分配预约')
      board.actions.dismissUser()
    }
  })
})
