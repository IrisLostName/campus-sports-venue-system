// FE-5 S3 / ACC-M2-07：场馆上下文。选项来自 adminListVenues()（VA 只得授权场馆），所选场馆写回查询参数 venueId。
import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../src/api/errors'
import { createAdminVenueContext } from '../../src/composables/adminVenue'
import { loginAdmin } from './harness'

async function contextFor(username: string, initial: unknown) {
  const ctx = await loginAdmin(username)
  const raw = ref<unknown>(initial)
  const written: number[] = []
  const venue = createAdminVenueContext({
    api: ctx.api,
    call: ctx.call,
    rawVenueId: () => raw.value,
    writeVenueId: async (id) => { written.push(id); raw.value = String(id) },
  })
  return { ctx, venue, raw, written }
}

describe('S3 场馆选择', () => {
  it('admin_tennis 只有网球馆', async () => {
    const { venue } = await contextFor('admin_tennis', undefined)
    await venue.load()

    expect(venue.venues.value.map((item) => item.name)).toEqual(['网球馆'])
  })

  it('admin_pool 恰好是羽毛球馆和游泳馆', async () => {
    const { venue } = await contextFor('admin_pool', undefined)
    await venue.load()

    expect(venue.venues.value.map((item) => item.name)).toEqual(['羽毛球馆', '游泳馆'])
  })

  it('查询参数缺省：取第一个场馆并写回地址栏', async () => {
    const { venue, written } = await contextFor('admin_pool', undefined)
    await venue.load()

    expect(venue.venueId.value).toBe(2)
    expect(written).toEqual([2])
  })

  it('查询参数在授权范围内：保持，不写回', async () => {
    const { venue, written } = await contextFor('admin_pool', '3')
    await venue.load()

    expect(venue.venueId.value).toBe(3)
    expect(venue.venue.value?.name).toBe('游泳馆')
    expect(written).toEqual([])
  })

  it('查询参数不在授权范围（网球馆 1）：取第一个授权场馆并写回', async () => {
    const { venue, written } = await contextFor('admin_pool', '1')
    await venue.load()

    expect(venue.venueId.value).toBe(2)
    expect(written).toEqual([2])
  })

  it('select 只接受授权场馆', async () => {
    const { venue, written } = await contextFor('admin_pool', '2')
    await venue.load()
    await venue.select(3)
    await venue.select(1)

    expect(written).toEqual([3])
    expect(venue.venueId.value).toBe(3)
  })

  it('X1：令牌过期时经 callApi 回到登录页，不展示错误', async () => {
    const { ctx } = await contextFor('admin_tennis', undefined)
    const failing = createAdminVenueContext({
      api: { ...ctx.api, adminListVenues: () => Promise.reject(new ApiError(401, 'TOKEN_EXPIRED', '过期')) },
      call: ctx.call,
      rawVenueId: () => undefined,
      writeVenueId: async () => undefined,
    })
    await failing.load()

    expect(ctx.h.router.currentRoute.value.path).toBe('/login')
    expect(failing.error.value).toBeNull()
    expect(failing.loaded.value).toBe(false)
  })

  it('其他错误：展示文案，不算已加载', async () => {
    const { ctx } = await contextFor('admin_tennis', undefined)
    const failing = createAdminVenueContext({
      api: { ...ctx.api, adminListVenues: () => Promise.reject(new ApiError(403, 'FORBIDDEN', '无权')) },
      call: ctx.call,
      rawVenueId: () => undefined,
      writeVenueId: async () => undefined,
    })
    await failing.load()

    expect(failing.error.value).toBe('无权执行此操作')
    expect(failing.loaded.value).toBe(false)
  })
})
