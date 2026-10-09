// FE-6 G2 / G3 测试脚手架：系统管理员登录后组装用户面板的 board。
import type { Role, VenueSummary } from '../../src/api/types'
import { createSysUsers } from '../../src/composables/sysUsers'
import { loginAdmin, spyOn } from '../admin/harness'

export const SYSADMIN_ID = 7
export const SECRET = 'S3cret-Pass-9'

export async function openBoard(fixedRole?: Role) {
  const ctx = await loginAdmin('sysadmin')
  const spy = spyOn(ctx.api)
  const venues: VenueSummary[] = await ctx.api.adminListVenues()
  const board = createSysUsers(
    { api: spy.client, call: ctx.call },
    { venues: () => venues, selfId: () => SYSADMIN_ID, ...(fixedRole === undefined ? {} : { fixedRole }) },
  )
  await board.load()
  return { ctx, spy, board }
}

export function callsOf(spy: ReturnType<typeof spyOn>, method: string) {
  return spy.calls.filter((call) => call.method === method).map((call) => call.args)
}

export async function fillAndCreate(board: Awaited<ReturnType<typeof openBoard>>['board'], fields: Record<string, unknown>) {
  board.openCreate()
  board.patchCreate({ username: 'new_admin', password: SECRET, displayName: '新管理员', ...fields })
  await board.confirmCreate()
}

