// 设定场地数量（docs/12 第 5.5 节 resource-count；规划裁决 A11）：count 指状态非 DISABLED 的场地数。
import { describe, expect, it } from 'vitest'

import { createHarness, expectApiError, type Harness } from '../support/harness'

async function asSysAdmin(): Promise<Harness> {
  const h = createHarness()
  await h.loginAs('sysadmin')
  return h
}

const names = async (h: Harness, venueId = 1) =>
  (await h.api.adminListResources(venueId)).map((r) => `${r.name}:${r.operationalStatus}`)

describe('缩小：把编号最大的多余场地置 DISABLED', () => {
  it('4 → 2：网球场4、网球场3 被停用，data 为变更后全部场地（含 DISABLED）', async () => {
    const h = await asSysAdmin()
    const result = await h.api.adminSetResourceCount(1, { count: 2 })
    expect(result.applied).toBe(true)
    expect(result.data?.map((r) => `${r.name}:${r.operationalStatus}`)).toEqual([
      '网球场1:OPEN', '网球场2:OPEN', '网球场3:DISABLED', '网球场4:DISABLED',
    ])
    await h.loginAs('lisi')
    expect((await h.api.listVenues())[0]?.resourceCount).toBe(2)
  })

  it('count = 0 全部停用；停用的场地仍在管理端列表里', async () => {
    const h = await asSysAdmin()
    await h.api.adminSetResourceCount(1, { count: 0, onExistingReservations: 'KEEP' })
    expect((await names(h)).every((entry) => entry.endsWith(':DISABLED'))).toBe(true)
    expect(await names(h)).toHaveLength(4)
  })
})

describe('增大：先按编号从小到大重新启用，不足再追加', () => {
  it('先启用被停用的最小编号，再追加 前缀N（N = 现有最大编号 + 1），sortOrder = 现有最大 + 1', async () => {
    const h = await asSysAdmin()
    await h.api.adminSetResourceCount(1, { count: 1, onExistingReservations: 'KEEP' })
    const two = await h.api.adminSetResourceCount(1, { count: 2 })
    expect(two.data?.filter((r) => r.operationalStatus === 'OPEN').map((r) => r.name)).toEqual(['网球场1', '网球场2'])
    const six = await h.api.adminSetResourceCount(1, { count: 6 })
    expect(six.data?.map((r) => [r.name, r.sortOrder, r.operationalStatus])).toEqual([
      ['网球场1', 1, 'OPEN'], ['网球场2', 2, 'OPEN'], ['网球场3', 3, 'OPEN'], ['网球场4', 4, 'OPEN'],
      ['网球场5', 5, 'OPEN'], ['网球场6', 6, 'OPEN'],
    ])
  })

  it('前缀与类型缺省：沿用现有场地名去掉末尾数字后的前缀与现有类型', async () => {
    const h = await asSysAdmin()
    const result = await h.api.adminSetResourceCount(3, { count: 7 })
    expect(result.data?.at(-1)).toMatchObject({ name: '泳道7', resourceType: 'LANE', sortOrder: 7 })
  })

  it('显式给出 namePrefix 与 resourceType 时按给定值追加', async () => {
    const h = await asSysAdmin()
    const result = await h.api.adminSetResourceCount(1, { count: 6, namePrefix: '训练场', resourceType: 'OTHER' })
    expect(result.data?.slice(4).map((r) => [r.name, r.resourceType])).toEqual([['训练场1', 'OTHER'], ['训练场2', 'OTHER']])
  })

  it('编号取匹配前缀且其余全为数字的名称的最大值 + 1，不匹配的名称被忽略', async () => {
    const h = await asSysAdmin()
    await h.api.adminUpdateResource(2, { name: '网球场VIP' })
    await h.api.adminUpdateResource(4, { name: '网球场9' })
    const result = await h.api.adminSetResourceCount(1, { count: 5 })
    expect(result.data?.at(-1)?.name).toBe('网球场10')
  })

  it('MAINTENANCE 的场地算作非 DISABLED：数量不变时不增不减', async () => {
    const h = await asSysAdmin()
    await h.api.adminUpdateResource(3, { operationalStatus: 'MAINTENANCE' })
    const result = await h.api.adminSetResourceCount(1, { count: 4 })
    expect(result.data).toHaveLength(4)
    expect(await names(h)).toContain('网球场3:MAINTENANCE')
  })

  it('场馆没有任何场地且未给出前缀或类型 → VALIDATION_ERROR，details.fields 指出字段', async () => {
    const h = await asSysAdmin()
    const venue = await h.api.adminCreateVenue({ name: '篮球馆', venueType: 'BASKETBALL' })
    const error = await expectApiError(h.api.adminSetResourceCount(venue.id, { count: 3 }), 'VALIDATION_ERROR')
    expect(Object.keys((error.details?.fields ?? {}) as object).sort()).toEqual(['namePrefix', 'resourceType'])
    const created = await h.api.adminSetResourceCount(venue.id, { count: 3, namePrefix: '篮球场', resourceType: 'COURT' })
    expect(created.data?.map((r) => [r.name, r.sortOrder])).toEqual([['篮球场1', 1], ['篮球场2', 2], ['篮球场3', 3]])
  })
})

describe('编号 = 名称末尾的数字，不看 sortOrder（规划裁决 N-12）', () => {
  const stateOf = async (h: Harness) =>
    (await h.api.adminListResources(1)).map((r) => [r.name, r.operationalStatus] as const)

  it('缩小：sortOrder 与名称编号不一致时，停用名称编号最大的场地', async () => {
    const h = await asSysAdmin()
    await h.api.adminUpdateResource(1, { sortOrder: 9 })   // 网球场1 的 sortOrder 最大，但名称编号最小
    await h.api.adminSetResourceCount(1, { count: 3 })
    expect(await stateOf(h)).toEqual([
      ['网球场2', 'OPEN'], ['网球场3', 'OPEN'], ['网球场4', 'DISABLED'], ['网球场1', 'OPEN'],
    ])
  })

  it('增大：按名称编号从小到大重新启用，不按 sortOrder', async () => {
    const h = await asSysAdmin()
    await h.api.adminSetResourceCount(1, { count: 0, onExistingReservations: 'KEEP' })
    await h.api.adminUpdateResource(4, { sortOrder: 1 })   // 网球场4 排在最前，但名称编号最大
    await h.api.adminUpdateResource(1, { sortOrder: 4 })
    await h.api.adminSetResourceCount(1, { count: 2 })
    expect((await stateOf(h)).filter(([, status]) => status === 'OPEN').map(([name]) => name).sort()).toEqual(['网球场1', '网球场2'])
  })

  it('名称不匹配“前缀 + 数字”的场地排在最后并按 id 排序：缩小时先被停用，增大时最后被启用', async () => {
    const h = await asSysAdmin()
    await h.api.adminUpdateResource(2, { name: '备用场' })   // id 2
    await h.api.adminUpdateResource(3, { name: '看台场' })   // id 3
    // 次序：网球场1、网球场4、备用场（id 2）、看台场（id 3）
    await h.api.adminSetResourceCount(1, { count: 3, onExistingReservations: 'KEEP' })
    expect(await stateOf(h)).toEqual([
      ['网球场1', 'OPEN'], ['备用场', 'OPEN'], ['看台场', 'DISABLED'], ['网球场4', 'OPEN'],
    ])
    await h.api.adminSetResourceCount(1, { count: 2, onExistingReservations: 'KEEP' })
    expect(await stateOf(h)).toEqual([
      ['网球场1', 'OPEN'], ['备用场', 'DISABLED'], ['看台场', 'DISABLED'], ['网球场4', 'OPEN'],
    ])
    await h.api.adminSetResourceCount(1, { count: 3 })
    expect(await stateOf(h)).toEqual([
      ['网球场1', 'OPEN'], ['备用场', 'OPEN'], ['看台场', 'DISABLED'], ['网球场4', 'OPEN'],
    ])
  })
})

describe('校验、预检与留痕', () => {
  it.each([[-1], [51], [1.5]])('count = %s → VALIDATION_ERROR；0 与 50 合法', async (count) => {
    const h = await asSysAdmin()
    await expectApiError(h.api.adminSetResourceCount(1, { count }), 'VALIDATION_ERROR')
  })

  it('count 上限 50 可设置', async () => {
    const h = await asSysAdmin()
    expect((await h.api.adminSetResourceCount(1, { count: 50 })).data).toHaveLength(50)
  })

  it('dryRun 不改变场地，data 为 null', async () => {
    const h = await asSysAdmin()
    const result = await h.api.adminSetResourceCount(1, { count: 1, dryRun: true })
    expect(result).toMatchObject({ applied: false, data: null, impact: { affectedCount: 1 } })
    expect((await h.api.adminListResources(1)).every((r) => r.operationalStatus === 'OPEN')).toBe(true)
  })

  it('写日志 RESOURCE_COUNT_CHANGE，目标为场馆', async () => {
    const h = await asSysAdmin()
    await h.api.adminSetResourceCount(1, { count: 3 })
    const [log] = (await h.api.adminListLogs({ action: 'RESOURCE_COUNT_CHANGE' })).items
    expect(log).toMatchObject({ targetType: 'VENUE', targetId: 1, venueId: 1 })
  })

  it('场馆管理员只能设自己授权的场馆；普通用户 FORBIDDEN；场馆不存在 NOT_FOUND', async () => {
    const h = createHarness()
    await h.loginAs('admin_tennis')
    await expect(h.api.adminSetResourceCount(1, { count: 3 })).resolves.toMatchObject({ applied: true })
    await expectApiError(h.api.adminSetResourceCount(2, { count: 3 }), 'FORBIDDEN_SCOPE')
    await h.loginAs('zhangsan')
    await expectApiError(h.api.adminSetResourceCount(1, { count: 3 }), 'FORBIDDEN')
    await h.loginAs('sysadmin')
    await expectApiError(h.api.adminSetResourceCount(99, { count: 3 }), 'NOT_FOUND')
  })

  it('新增场馆后可设定场地数量，新场馆默认 OPEN 且不对用户开放预约', async () => {
    const h = await asSysAdmin()
    const venue = await h.api.adminCreateVenue({ name: '篮球馆', venueType: 'BASKETBALL', location: '东区' })
    expect(venue).toMatchObject({ operationalStatus: 'OPEN', userBookingEnabled: false, bookable: false, resourceCount: 0, location: '东区' })
    await expectApiError(h.api.adminCreateVenue({ name: '篮球馆', venueType: 'OTHER' }), 'VALIDATION_ERROR')
    await h.loginAs('admin_tennis')
    await expectApiError(h.api.adminCreateVenue({ name: '另一个馆', venueType: 'OTHER' }), 'FORBIDDEN')
  })
})
