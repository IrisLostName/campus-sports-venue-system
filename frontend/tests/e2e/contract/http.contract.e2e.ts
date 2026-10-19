// BE-8 E1：共享契约套件对运行中的真实后端完整运行（库 venue_booking_e2e，每次运行前用 tools/reset-e2e-db.ps1 重置），
// 末尾核对创建类 201、归档与删除类 204（K2）。比较的是接口响应，不比较数据库状态（K7）。
import { contractSuite } from '../../api/contract/suite'
import { makeHttpTarget, type StatusRecord } from '../support/httpTarget'
import { statusCodeContract } from './statusCodes'

const suiteCalls: StatusRecord[] = []

contractSuite('http', () => makeHttpTarget(suiteCalls))
statusCodeContract(suiteCalls)
