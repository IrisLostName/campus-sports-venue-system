// 按 id 查找记录；找不到抛 NOT_FOUND（docs/12 第 3 节）。
import { fail } from './fail'
import type { MockState, ResourceRecord, UserRecord, VenueRecord } from './state'

export function getOrFail<T extends { id: number }>(items: readonly T[], id: number): T {
  return items.find((item) => item.id === id) ?? fail('NOT_FOUND')
}

export function venueOfResource(state: MockState, resource: ResourceRecord): VenueRecord {
  return getOrFail(state.venues, resource.venueId)
}

export function userById(state: MockState, id: number): UserRecord {
  return getOrFail(state.users, id)
}

export function resourcesOfVenue(state: MockState, venueId: number): ResourceRecord[] {
  return state.resources
    .filter((resource) => resource.venueId === venueId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
}
