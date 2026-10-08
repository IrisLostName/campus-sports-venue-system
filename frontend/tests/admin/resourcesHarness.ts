// FE-5 P3 测试脚手架：组装“场地与开放规则”页的 board，场馆资料用真实的 adminListVenues 刷新（模拟外壳的场馆上下文）。
import type { ApiClient } from '../../src/api/client'
import { createAdminResourcesPage } from '../../src/composables/adminResourcesPage'
import type { VenueInfo } from '../../src/composables/adminResources'
import type { VenueSummary } from '../../src/api/types'
import { loginAdmin, spyOn } from './harness'

// prepare 可以先在同一份 mock 数据里造数据（例如新建场馆），并返回要打开的场馆 id。
export async function openResourcesPage(username = 'admin_tennis', initialVenueId = 1, prepare?: (api: ApiClient) => Promise<number>) {
  const ctx = await loginAdmin(username)
  const venueId = prepare === undefined ? initialVenueId : await prepare(ctx.api)
  const spy = spyOn(ctx.api)
  let venue: VenueSummary | undefined = (await ctx.api.adminListVenues()).find((item) => item.id === venueId)
  const reloads: number[] = []
  const info: VenueInfo = {
    resourceCount: () => venue?.resourceCount,
    description: () => venue?.description ?? '',
    reload: async () => {
      reloads.push(reloads.length)
      venue = (await ctx.api.adminListVenues()).find((item) => item.id === venueId)
    },
  }
  const page = createAdminResourcesPage({ api: spy.client, call: ctx.call }, venueId, info)
  await page.load()
  return { ctx, page, calls: spy.calls, reloads }
}
