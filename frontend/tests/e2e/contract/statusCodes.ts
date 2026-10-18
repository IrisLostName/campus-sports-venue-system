// BE-8 K2（FE-1 N-10/O-7）：创建类接口返回 201，归档与删除类返回 204（docs/12 第 1、5 节）。只在 http 运行中核对。
import { describe, expect, it } from 'vitest'

import { addDays } from '../../../src/api/mock/timeMath'
import { serverDates } from '../../api/contract/suite'
import { makeHttpTarget, type StatusRecord } from '../support/httpTarget'

const V1 = '/api/v1'

function successStatuses(calls: StatusRecord[], method: string, path: string): number[] {
  return calls.filter((call) => call.method === method && call.path === `${V1}${path}` && call.status < 400)
    .map((call) => call.status)
}

export function statusCodeContract(suiteCalls: StatusRecord[]): void {
  describe('http：创建类 201、归档与删除类 204（K2）', () => {
    it('套件中成功的注册与创建预约各一次，均为 201', () => {
      expect(successStatuses(suiteCalls, 'POST', '/auth/register')).toEqual([201])
      expect(successStatuses(suiteCalls, 'POST', '/reservations')).toEqual([201])
    })

    it('报修、新建场馆、新建账号、发布公告返回 201；归档公告返回 204', async () => {
      const calls: StatusRecord[] = []
      const target = makeHttpTarget(calls)
      await target.loginAs('zhangsan')
      await target.api.createRepair({ venueId: 1, description: 'BE-8 状态码核对：网球场1 球网松了' })
      await target.loginAs('sysadmin')
      await target.api.adminCreateVenue({ name: 'BE-8 状态码核对场馆', venueType: 'OTHER' })
      await target.api.adminCreateUser({ username: 'be8_status', password: 'Passw0rd!', displayName: '状态码核对', role: 'USER' })
      const notice = await target.api.adminCreateAnnouncement({ scope: 'SYSTEM', title: 'BE-8 状态码核对公告', content: '核对后即归档' })
      await target.api.adminArchiveAnnouncement(notice.id)
      expect(successStatuses(calls, 'POST', '/repairs')).toEqual([201])
      expect(successStatuses(calls, 'POST', '/admin/venues')).toEqual([201])
      expect(successStatuses(calls, 'POST', '/admin/users')).toEqual([201])
      expect(successStatuses(calls, 'POST', '/admin/announcements')).toEqual([201])
      expect(successStatuses(calls, 'DELETE', `/admin/announcements/${notice.id}`)).toEqual([204])
    })

    it('删除关闭规则返回 204', async () => {
      const calls: StatusRecord[] = []
      const target = makeHttpTarget(calls)
      const { today } = await serverDates(target)
      await target.loginAs('sysadmin')
      // 游泳馆未开放预约、没有预约，一个月后的关闭规则不影响任何预约，直接生效。
      const day = addDays(today, 30)
      const added = await target.api.adminAddClosure(3, { startDate: day, endDate: day, reason: 'BE-8 状态码核对' })
      expect(added.applied).toBe(true)
      const closureId = added.data?.id ?? 0
      await target.api.adminRemoveClosure(closureId)
      expect(successStatuses(calls, 'DELETE', `/admin/closures/${closureId}`)).toEqual([204])
    })
  })
}
