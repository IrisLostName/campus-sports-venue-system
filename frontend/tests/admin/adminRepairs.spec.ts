// FE-5 P7：报修处理。按钮只依据 status；标记已解决须填处理结果；其余以接口错误码为准。
import { describe, expect, it } from 'vitest'

import { createAdminRepairs } from '../../src/composables/adminRepairs'
import { buildRepairRow, repairStepsFor } from '../../src/utils/adminRepairDisplay'
import { loginAdmin, spyOn, type AdminContext } from './harness'

async function withRepairs(): Promise<AdminContext> {
  const ctx = await loginAdmin('admin_tennis')
  const user = await ctx.h.clientFor('zhangsan')
  await user.createRepair({ venueId: 1, resourceId: 1, description: '球网破损' })
  await user.createRepair({ venueId: 1, description: '更衣室漏水' })
  const pool = await ctx.h.clientFor('lisi')
  await pool.createRepair({ venueId: 2, description: '羽毛球馆灯坏了' })
  return ctx
}

describe('P7 按钮由 status 决定', () => {
  it('SUBMITTED 可开始处理或直接解决；IN_PROGRESS 只能解决；RESOLVED 没有按钮', () => {
    expect(repairStepsFor('SUBMITTED')).toEqual([
      { label: '开始处理', target: 'IN_PROGRESS' }, { label: '标记已解决', target: 'RESOLVED' },
    ])
    expect(repairStepsFor('IN_PROGRESS')).toEqual([{ label: '标记已解决', target: 'RESOLVED' }])
    expect(repairStepsFor('RESOLVED')).toEqual([])
  })

  it('行：场地为空显示“整个场馆”；状态中文名与色调（SUBMITTED warning、IN_PROGRESS accent、RESOLVED success）', () => {
    const report = {
      id: 1, venueId: 1, venueName: '网球馆', resourceId: null, resourceName: null, reporterId: 1, reporterName: '张三',
      description: '漏水', status: 'SUBMITTED' as const, resultNote: null, createdAt: '2026-10-12T09:00:00', updatedAt: '2026-10-12T09:00:00',
    }

    expect(buildRepairRow(report)).toMatchObject({ place: '整个场馆', statusLabel: '已提交', tone: 'warning', createdText: '2026-10-12 09:00' })
    expect(buildRepairRow({ ...report, status: 'IN_PROGRESS' })).toMatchObject({ statusLabel: '处理中', tone: 'accent' })
    expect(buildRepairRow({ ...report, status: 'RESOLVED', resultNote: '已修复' })).toMatchObject({ statusLabel: '已解决', tone: 'success', resultNote: '已修复', steps: [] })
  })
})

describe('P7 board', () => {
  it('只列出所选场馆的报修，按状态筛选', async () => {
    const ctx = await withRepairs()
    const spy = spyOn(ctx.api)
    const board = createAdminRepairs({ api: spy.client, call: ctx.call }, 1)
    await board.load()

    expect(spy.calls[0]).toEqual({ method: 'adminListRepairs', args: [{ venueId: 1, page: 1 }] })
    expect(board.rows.value.map((row) => row.description).sort()).toEqual(['更衣室漏水', '球网破损'])

    await board.setStatus('RESOLVED')
    expect(spy.calls[1]?.args).toEqual([{ venueId: 1, page: 1, status: 'RESOLVED' }])
    expect(board.rows.value).toEqual([])
  })

  it('开始处理：直接提交 IN_PROGRESS，不带 resultNote，列表刷新', async () => {
    const ctx = await withRepairs()
    const spy = spyOn(ctx.api)
    const board = createAdminRepairs({ api: spy.client, call: ctx.call }, 1)
    await board.load()
    const target = board.rows.value.find((row) => row.description === '球网破损')
    await board.advance(target?.id ?? 0, 'IN_PROGRESS')

    expect(spy.calls.find((call) => call.method === 'adminUpdateRepair')?.args).toEqual([target?.id, { status: 'IN_PROGRESS' }])
    expect(board.rows.value.find((row) => row.id === target?.id)).toMatchObject({ statusLabel: '处理中', steps: [{ label: '标记已解决', target: 'RESOLVED' }] })
    expect(board.notice.value).toBe('报修已更新')
    expect(board.dialog.value).toBeNull()
  })

  it('标记已解决：先打开对话框；处理结果为空不发请求；填写后提交 RESOLVED + resultNote', async () => {
    const ctx = await withRepairs()
    const spy = spyOn(ctx.api)
    const board = createAdminRepairs({ api: spy.client, call: ctx.call }, 1)
    await board.load()
    const id = board.rows.value[0]?.id ?? 0
    await board.advance(id, 'RESOLVED')

    expect(board.dialog.value).toMatchObject({ id, note: '', busy: false, error: null })
    expect(spy.calls.some((call) => call.method === 'adminUpdateRepair')).toBe(false)

    board.setNote('   ')
    await board.confirmResolve()
    expect(board.dialog.value?.error).toBe('请填写处理结果')
    expect(spy.calls.some((call) => call.method === 'adminUpdateRepair')).toBe(false)

    board.setNote(' 已更换球网 ')
    await board.confirmResolve()

    expect(spy.calls.find((call) => call.method === 'adminUpdateRepair')?.args).toEqual([id, { status: 'RESOLVED', resultNote: '已更换球网' }])
    expect(board.dialog.value).toBeNull()
    expect(board.rows.value.find((row) => row.id === id)).toMatchObject({ statusLabel: '已解决', resultNote: '已更换球网', steps: [] })
  })

  it('接口拒绝（逆向转换 INVALID_STATE）：对话框保持并显示文案', async () => {
    const ctx = await withRepairs()
    const board = createAdminRepairs({ api: ctx.api, call: ctx.call }, 1)
    await board.load()
    const id = board.rows.value[0]?.id ?? 0
    await ctx.api.adminUpdateRepair(id, { status: 'RESOLVED', resultNote: '别处已处理' })

    await board.advance(id, 'RESOLVED')
    board.setNote('再次处理')
    await board.confirmResolve()

    expect(board.dialog.value?.error).toBe('当前状态不允许该操作')
    expect(board.dialog.value?.busy).toBe(false)
  })

  it('越权场馆：FORBIDDEN_SCOPE 文案', async () => {
    const ctx = await withRepairs()
    const board = createAdminRepairs({ api: ctx.api, call: ctx.call }, 2)
    await board.load()

    expect(board.list.error.value).toBe('无权操作该场馆')
  })
})
