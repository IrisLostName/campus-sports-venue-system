// FE-6 S4 / N4：场馆上下文的“全部场馆”模式，以及查询参数变化时的规范化（不只首次加载）。
import { nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { createAdminVenueContext } from '../../src/composables/adminVenue'
import { resolveVenueId } from '../../src/utils/venueSelection'
import { loginAdmin } from '../admin/harness'

async function contextFor(username: string, initial: unknown, allowAll = false) {
  const ctx = await loginAdmin(username)
  const raw = ref<unknown>(initial)
  const all = ref(allowAll)
  const written: number[] = []
  let cleared = 0
  const venue = createAdminVenueContext({
    api: ctx.api,
    call: ctx.call,
    rawVenueId: () => raw.value,
    writeVenueId: async (id) => { written.push(id); raw.value = String(id) },
    allowAll: () => all.value,
    clearVenueId: async () => { cleared += 1; raw.value = undefined },
  })
  return { venue, raw, all, written, cleared: () => cleared }
}

describe('S4 resolveVenueId allowAll', () => {
  const venues = [{ id: 1 }, { id: 2 }]

  it('allowAll：缺省、无效、不在列表里都是 null（全部场馆）', () => {
    for (const raw of [undefined, '', 'abc', '9']) {
      expect(resolveVenueId(raw, venues, true)).toBeNull()
    }
  })

  it('allowAll：有效的场馆照常采用；不开启时仍取第一个场馆', () => {
    expect(resolveVenueId('2', venues, true)).toBe(2)
    expect(resolveVenueId(undefined, venues)).toBe(1)
  })
})

describe('S4 系统管理员的场馆上下文', () => {
  it('sysadmin 的选项是全部三个场馆', async () => {
    const { venue } = await contextFor('sysadmin', undefined, true)
    await venue.load()

    expect(venue.venues.value.map((item) => item.name)).toEqual(['网球馆', '羽毛球馆', '游泳馆'])
  })

  it('“全部场馆”页面：查询参数缺省时不选场馆，也不写回地址栏', async () => {
    const { venue, written } = await contextFor('sysadmin', undefined, true)
    await venue.load()

    expect(venue.venueId.value).toBeNull()
    expect(written).toEqual([])
  })

  it('需要场馆的页面：查询参数缺省时取第一个场馆并写回', async () => {
    const { venue, written } = await contextFor('sysadmin', undefined, false)
    await venue.load()

    expect(venue.venueId.value).toBe(1)
    expect(written).toEqual([1])
  })

  it('select(null) 在允许“全部场馆”时移除查询参数；不允许时忽略', async () => {
    const allowed = await contextFor('sysadmin', '2', true)
    await allowed.venue.load()
    await allowed.venue.select(null)
    expect(allowed.cleared()).toBe(1)
    expect(allowed.venue.venueId.value).toBeNull()

    const denied = await contextFor('sysadmin', '2', false)
    await denied.venue.load()
    await denied.venue.select(null)
    expect(denied.cleared()).toBe(0)
    expect(denied.venue.venueId.value).toBe(2)
  })
})

describe('N4 加载之后查询参数变化也要规范化', () => {
  it('无效的 venueId（abc / 不在授权范围）被改写成第一个授权场馆', async () => {
    const { venue, raw, written } = await contextFor('admin_pool', '3')
    await venue.load()
    expect(written).toEqual([])

    raw.value = 'abc'
    await nextTick()
    await Promise.resolve()
    expect(written).toEqual([2])

    raw.value = '1'
    await nextTick()
    await Promise.resolve()
    expect(written).toEqual([2, 2])
    expect(venue.venueId.value).toBe(2)
  })

  it('有效的变化不写回；加载完成之前的变化不处理', async () => {
    const { venue, raw, written } = await contextFor('admin_pool', '2')
    raw.value = '1'
    await nextTick()
    expect(written).toEqual([])

    await venue.load()
    written.length = 0
    raw.value = '3'
    await nextTick()
    await Promise.resolve()
    expect(written).toEqual([])
    expect(venue.venueId.value).toBe(3)
  })

  it('页面从“全部场馆”变为必须选定场馆时也规范化', async () => {
    const { venue, all, written } = await contextFor('sysadmin', undefined, true)
    await venue.load()
    expect(written).toEqual([])

    all.value = false
    await nextTick()
    await Promise.resolve()
    expect(written).toEqual([1])
  })
})
