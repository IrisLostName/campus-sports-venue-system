// 契约套件：v1.2 同行人名单（docs/12 第 5.3 节 GET /users/lookup、companionUserIds、companions）。由 suite.ts 的 contractSuite 调用。
import { describe, expect, it } from 'vitest'

import { expectCode, loginAs, serverDates, type ContractTarget } from './contractSupport'

// v1.2（P2-2b / P2-2c）：同行人名单。预约人用 zhaoliu（种子里没有预约），时段取明天网球馆第一个空闲时段，
// 核对后由 zhaoliu 取消，不留下有效预约。用户 id 以查找结果为准（mock 与后端种子的 id 不必相同）。
export function companionContract(label: string, makeTarget: () => ContractTarget): void {
  async function lookupId(target: ContractTarget, q: string): Promise<number> {
    return (await target.api.lookupUser(q)).userId
  }

  describe(`${label}：同行人名单（v1.2）`, () => {
    it('查找：精确用户名返回 {userId, displayName}；本人、不存在 NOT_FOUND；空白 VALIDATION_ERROR（fields.q）；管理员 FORBIDDEN', async () => {
      const target = makeTarget()
      await loginAs(target, 'zhaoliu')
      const found = await target.api.lookupUser('lisi')
      expect(Object.keys(found).sort()).toEqual(['displayName', 'userId'])
      expect(found.displayName).toBe('李四')
      await expectCode(target.api.lookupUser('zhaoliu'), 'NOT_FOUND')
      await expectCode(target.api.lookupUser('p22c_no_such_user'), 'NOT_FOUND')
      const blank = await expectCode(target.api.lookupUser('   '), 'VALIDATION_ERROR')
      expect(Object.keys((blank.details?.fields ?? {}) as object)).toEqual(['q'])
      await loginAs(target, 'admin_tennis')
      await expectCode(target.api.lookupUser('lisi'), 'FORBIDDEN')
    })

    it('创建：companions 按提交顺序；重复 id VALIDATION_ERROR（fields.companionUserIds）；管理端列表带名单；同行人看不到', async () => {
      const target = makeTarget()
      const { tomorrow } = await serverDates(target)
      await loginAs(target, 'zhaoliu')
      const [wangwu, lisi] = [await lookupId(target, 'wangwu'), await lookupId(target, 'lisi')]
      const free = (await target.api.getVenueSlots(1, tomorrow)).resources
        .flatMap((resource) => resource.slots.map((slot) => ({ resourceId: resource.resourceId, ...slot })))
        .find((slot) => slot.status === 'AVAILABLE')
      expect(free, '明天应有可预约的时段').toBeDefined()
      const request = { resourceId: free?.resourceId ?? 0, serviceDate: tomorrow, startTime: free?.startTime ?? '' }

      const duplicated = await expectCode(target.api.createReservation({ ...request, companionUserIds: [lisi, lisi] }), 'VALIDATION_ERROR')
      expect(Object.keys((duplicated.details?.fields ?? {}) as object)).toEqual(['companionUserIds'])
      const created = await target.api.createReservation({ ...request, companionUserIds: [wangwu, lisi] })
      const expected = [{ userId: wangwu, displayName: '王五' }, { userId: lisi, displayName: '李四' }]
      expect(created.companions).toEqual(expected)
      expect((await target.api.getReservation(created.id)).companions).toEqual(expected)

      await loginAs(target, 'admin_tennis')
      const rows = (await target.api.adminListReservations({ venueId: 1, dateFrom: tomorrow, dateTo: tomorrow, pageSize: 100 })).items
      expect(rows.find((row) => row.id === created.id)?.companions).toEqual(expected)

      await loginAs(target, 'wangwu')
      expect((await target.api.listMyReservations({ pageSize: 100 })).items.map((item) => item.id)).not.toContain(created.id)
      await expectCode(target.api.getReservation(created.id), 'NOT_OWNER')

      await loginAs(target, 'zhaoliu')
      await target.api.cancelReservation(created.id, { reason: 'P2-2c 契约核对' })
    })
  })
}
