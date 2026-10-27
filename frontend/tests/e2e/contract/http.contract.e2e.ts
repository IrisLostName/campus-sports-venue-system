// BE-8 E1：共享契约套件对运行中的真实后端完整运行（库 venue_booking_e2e，每次运行前用 tools/reset-e2e-db.ps1 重置），
// 末尾核对创建类 201、归档与删除类 204（K2）。比较的是接口响应，不比较数据库状态（K7）。
// P2-1c：契约 v1.1 删除了用户自助签到接口，ApiClient 不再有该方法，这里直接发请求核对它按不存在处理（NOT_FOUND）。
import { describe, expect, it } from 'vitest'

import { DEMO_PASSWORD } from '../../../src/api/mock/seed'
import { contractSuite } from '../../api/contract/suite'
import { E2E } from '../support/e2eEnv'
import { makeHttpTarget, type StatusRecord } from '../support/httpTarget'
import { statusCodeContract } from './statusCodes'

const suiteCalls: StatusRecord[] = []

contractSuite('http', () => makeHttpTarget(suiteCalls))
statusCodeContract(suiteCalls)

describe('http：v1.1 删除的自助签到接口', () => {
  it('POST /reservations/{id}/check-in → 404 NOT_FOUND', async () => {
    const { token } = await makeHttpTarget().api.login({ username: 'zhangsan', password: DEMO_PASSWORD })
    const response = await fetch(`${E2E.apiBaseUrl}/api/v1/reservations/1/check-in`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.status).toBe(404)
    expect(((await response.json()) as { code: string }).code).toBe('NOT_FOUND')
  })
})
