// FE-5 P4：影响检查流程（docs/12 第 5.5 节）。用真实 mock：种子里 zhangsan 在明天 08:00 预订了网球场1（场地 id 1）。
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../src/api/errors'
import type { Resource, ResourceStatus } from '../../src/api/types'
import { createImpactFlow, type ImpactChange, type ImpactControl } from '../../src/composables/impactFlow'
import { loginAdmin, TOMORROW, type AdminContext } from './harness'

interface Setup {
  ctx: AdminContext
  sent: ImpactControl[]
  applied: number[]
  change(resourceId: number, status: ResourceStatus, initialReason?: string): ImpactChange<Resource>
}

async function setup(): Promise<Setup & { flow: ReturnType<typeof createImpactFlow> }> {
  const ctx = await loginAdmin()
  const sent: ImpactControl[] = []
  const applied: number[] = []
  return {
    ctx, sent, applied, flow: createImpactFlow({ call: ctx.call }),
    change: (resourceId, status, initialReason) => ({
      title: `将场地 ${resourceId} 设为 ${status}`,
      initialReason,
      send: (control) => {
        sent.push(control)
        return ctx.api.adminUpdateResource(resourceId, { operationalStatus: status, ...control })
      },
      applied: (response) => { applied.push(response.impact.affectedCount) },
    }),
  }
}

async function statusOf(ctx: AdminContext, resourceId: number): Promise<ResourceStatus | undefined> {
  return (await ctx.api.adminListResources(1)).find((resource) => resource.id === resourceId)?.operationalStatus
}

describe('P4 没有受影响预约', () => {
  it('预检后普通确认，提交请求不带 onExistingReservations 也不带 dryRun', async () => {
    const { ctx, flow, change, sent, applied } = await setup()
    await flow.start(change(4, 'MAINTENANCE'))

    expect(flow.dialog.value?.impact.affectedCount).toBe(0)
    expect(sent).toEqual([{ dryRun: true }])
    expect(await statusOf(ctx, 4)).toBe('OPEN')

    await flow.confirm()

    expect(sent).toEqual([{ dryRun: true }, {}])
    expect(await statusOf(ctx, 4)).toBe('MAINTENANCE')
    expect(applied).toEqual([0])
    expect(flow.dialog.value).toBeNull()
    expect(flow.notice.value).toBe('已保存')
  })
})

describe('P4 有受影响预约', () => {
  it('对话框打开时没有默认选项，列出受影响预约', async () => {
    const { flow, change } = await setup()
    await flow.start(change(1, 'MAINTENANCE'))

    const state = flow.dialog.value
    expect(state?.choice).toBeNull()
    expect(state?.impact.affectedCount).toBe(1)
    expect(state?.impact.reservations.map((brief) => [brief.resourceName, brief.serviceDate, brief.startTime, brief.userDisplayName]))
      .toEqual([['网球场1', TOMORROW, '08:00', '张三']])
  })

  it('没有选择就确认：提示请选择，不发请求，场地不变', async () => {
    const { ctx, flow, change, sent } = await setup()
    await flow.start(change(1, 'MAINTENANCE'))
    await flow.confirm()

    expect(flow.dialog.value?.error).toBe('请选择保留或取消')
    expect(sent).toEqual([{ dryRun: true }])
    expect(await statusOf(ctx, 1)).toBe('OPEN')
  })

  it('选择取消但原因为空：提示请填写原因，不发请求', async () => {
    const { flow, change, sent } = await setup()
    await flow.start(change(1, 'MAINTENANCE'))
    flow.choose('CANCEL')
    flow.setReason('   ')
    await flow.confirm()

    expect(flow.dialog.value?.error).toBe('请填写原因')
    expect(sent).toEqual([{ dryRun: true }])
  })

  it('选择取消并填原因：受影响预约变为 ADMIN_CANCELLED，提示取消数量', async () => {
    const { ctx, flow, change, sent } = await setup()
    await flow.start(change(1, 'MAINTENANCE'))
    flow.choose('CANCEL')
    flow.setReason('  场地检修  ')
    await flow.confirm()

    expect(sent).toEqual([{ dryRun: true }, { onExistingReservations: 'CANCEL', reason: '场地检修' }])
    expect(await statusOf(ctx, 1)).toBe('MAINTENANCE')
    const reservation = await ctx.api.adminListReservations({ venueId: 1, keyword: '张三' })
    expect(reservation.items.map((item) => [item.status, item.adminNote])).toEqual([['ADMIN_CANCELLED', '场地检修']])
    expect(flow.notice.value).toBe('已保存，并取消 1 个受影响预约')
    expect(flow.dialog.value).toBeNull()
  })

  it('选择保留且不填原因：预约保持有效', async () => {
    const { ctx, flow, change, sent } = await setup()
    await flow.start(change(1, 'MAINTENANCE'))
    flow.choose('KEEP')
    await flow.confirm()

    expect(sent).toEqual([{ dryRun: true }, { onExistingReservations: 'KEEP' }])
    const reservation = await ctx.api.adminListReservations({ venueId: 1, keyword: '张三' })
    expect(reservation.items.map((item) => item.status)).toEqual(['CONFIRMED'])
    expect(flow.notice.value).toBe('已保存')
  })

  it('initialReason 预填对话框的原因（可修改），最终只发送一个 reason', async () => {
    const { flow, change, sent } = await setup()
    await flow.start(change(1, 'MAINTENANCE', '暑期整修'))

    expect(flow.dialog.value?.reason).toBe('暑期整修')
    flow.choose('CANCEL')
    flow.setReason('暑期整修，请改约')
    await flow.confirm()

    expect(sent[1]).toEqual({ onExistingReservations: 'CANCEL', reason: '暑期整修，请改约' })
  })
})

describe('P4 提交时数据又变了（IMPACT_CONFIRMATION_REQUIRED）', () => {
  it('用 details.impact 重新打开对话框，选择被清空，之后可以保留并提交', async () => {
    const { ctx, flow, change, sent } = await setup()
    await flow.start(change(3, 'MAINTENANCE'))
    expect(flow.dialog.value?.impact.affectedCount).toBe(0)

    const zhangsan = await ctx.h.clientFor('zhangsan')
    await zhangsan.createReservation({ resourceId: 3, serviceDate: TOMORROW, startTime: '11:00' })
    await flow.confirm()

    expect(sent).toEqual([{ dryRun: true }, {}])
    const state = flow.dialog.value
    expect(state?.impact.affectedCount).toBe(1)
    expect(state?.impact.reservations[0]?.startTime).toBe('11:00')
    expect(state?.choice).toBeNull()
    expect(state?.error).toBe('该操作会影响已有预约，请先选择保留或取消')
    expect(await statusOf(ctx, 3)).toBe('OPEN')

    flow.choose('KEEP')
    await flow.confirm()

    expect(sent[2]).toEqual({ onExistingReservations: 'KEEP' })
    expect(await statusOf(ctx, 3)).toBe('MAINTENANCE')
    expect(flow.dialog.value).toBeNull()
  })

  it('details.impact 格式不对：按普通错误显示，对话框保持', async () => {
    const { ctx, flow } = await setup()
    const broken: ImpactChange<Resource> = {
      title: '坏数据',
      send: (control) => (control.dryRun === true
        ? ctx.api.adminUpdateResource(4, { operationalStatus: 'MAINTENANCE', dryRun: true })
        : Promise.reject(new ApiError(409, 'IMPACT_CONFIRMATION_REQUIRED', '要选择', { impact: { affectedCount: 'x' } }))),
      applied: () => undefined,
    }
    await flow.start(broken)
    await flow.confirm()

    expect(flow.dialog.value?.error).toBe('该操作会影响已有预约，请先选择保留或取消')
    expect(flow.dialog.value?.impact.affectedCount).toBe(0)
  })
})

describe('P4 其他路径', () => {
  it('预检失败：不打开对话框，错误显示在 flow.error', async () => {
    const { ctx, flow } = await setup()
    await flow.start({
      title: 't',
      send: (control) => ctx.api.adminUpdateResource(9999, { operationalStatus: 'MAINTENANCE', ...control }),
      applied: () => undefined,
    })

    expect(flow.dialog.value).toBeNull()
    expect(flow.error.value).toBe('资源不存在')
  })

  it('越权场馆：预检的 FORBIDDEN_SCOPE 显示文案', async () => {
    const { ctx, flow } = await setup()
    await flow.start({
      title: 't',
      send: (control) => ctx.api.adminSetResourceCount(2, { count: 3, ...control }),
      applied: () => undefined,
    })

    expect(flow.error.value).toBe('无权操作该场馆')
  })

  it('取消对话框：不再发请求，场地不变；可以重新开始', async () => {
    const { ctx, flow, change, sent } = await setup()
    await flow.start(change(1, 'MAINTENANCE'))
    flow.dismiss()

    expect(flow.dialog.value).toBeNull()
    expect(sent).toEqual([{ dryRun: true }])
    expect(await statusOf(ctx, 1)).toBe('OPEN')

    await flow.start(change(4, 'MAINTENANCE'))
    expect(flow.dialog.value?.impact.affectedCount).toBe(0)
  })

  it('对话框打开期间再次 start 被忽略；进行中重复 confirm 只提交一次', async () => {
    const { flow, change, sent } = await setup()
    await flow.start(change(4, 'MAINTENANCE'))
    await flow.start(change(1, 'MAINTENANCE'))

    expect(sent).toEqual([{ dryRun: true }])
    await Promise.all([flow.confirm(), flow.confirm()])

    expect(sent).toEqual([{ dryRun: true }, {}])
  })

  it('登录失效（TOKEN_EXPIRED）：对话框关闭，不显示错误，回到登录页', async () => {
    const { ctx, flow } = await setup()
    await flow.start({
      title: 't',
      send: (control) => (control.dryRun === true
        ? ctx.api.adminUpdateResource(4, { operationalStatus: 'MAINTENANCE', dryRun: true })
        : Promise.reject(new ApiError(401, 'TOKEN_EXPIRED', '过期'))),
      applied: () => undefined,
    })
    await flow.confirm()

    expect(flow.dialog.value).toBeNull()
    expect(flow.error.value).toBeNull()
    expect(ctx.h.router.currentRoute.value.path).toBe('/login')
  })
})
