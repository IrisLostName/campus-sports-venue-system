// docs/12 第 5.5 节：修改场馆、设定场地数量、修改场地；均经影响检查（impact.ts）。
import type { ApiClient } from '../client'
import type { ImpactChangeResponse, Resource, VenueSummary } from '../types'
import type { SetResourceCountRequest, UpdateResourceRequest, UpdateVenueRequest } from '../requests'
import { RESOURCE_STATUSES, RESOURCE_TYPES, VENUE_STATUSES, VENUE_TYPES } from './enums'
import { fail } from './fail'
import { authenticate, requireRole, requireScope } from './guards'
import {
  affectedByResources, affectedByVenue, applyImpactChange, impactControlChecks, requireCancelReason,
} from './impact'
import { getOrFail, resourcesOfVenue, venueOfResource } from './lookup'
import { run } from './run'
import { nextId, type MockContext, type ResourceRecord, type VenueRecord } from './state'
import { toResource, toVenueSummary } from './venueService'
import { collect, intProblem, isAbsent, oneOfProblem, optional, textProblem } from './validate'

const SA_ONLY_VENUE_FIELDS = ['name', 'venueType', 'location', 'operationalStatus', 'userBookingEnabled'] as const
const MAX_RESOURCE_COUNT = 50
// 与后端 ResourceCountPlanner 一致（台账 S-045）：场地名上限 50 个字符，sortOrder 为 INTEGER。
const RESOURCE_NAME_MAX = 50
const SORT_ORDER_MAX = 2147483647

function booleanProblem(value: unknown): string | null {
  return typeof value === 'boolean' ? null : '应为布尔值'
}

// 12 第 5.5 节：VA 只能改 description；提交 SA 才能改的字段返回 FORBIDDEN。
function updateVenue(ctx: MockContext, id: number, request: UpdateVenueRequest): ImpactChangeResponse<VenueSummary> {
  const user = authenticate(ctx)
  collect([
    ['name', optional(request.name, (value) => textProblem(value, 50))],
    ['venueType', optional(request.venueType, (value) => oneOfProblem(value, VENUE_TYPES))],
    ['location', optional(request.location, (value) => textProblem(value, 100))],
    ['description', optional(request.description, (value) => textProblem(value, 500))],
    ['operationalStatus', optional(request.operationalStatus, (value) => oneOfProblem(value, VENUE_STATUSES))],
    ['userBookingEnabled', optional(request.userBookingEnabled, booleanProblem)],
    ...impactControlChecks(request),
  ])
  requireCancelReason(request)
  requireRole(user, 'VENUE_ADMIN', 'SYS_ADMIN')
  if (user.role === 'VENUE_ADMIN' && SA_ONLY_VENUE_FIELDS.some((field) => !isAbsent(request[field]))) {
    fail('FORBIDDEN')
  }
  const venue = getOrFail(ctx.state.venues, id)
  requireScope(ctx, user, venue.id)
  if (!isAbsent(request.name) && ctx.state.venues.some((other) => other.id !== id && other.name === request.name)) {
    fail('VALIDATION_ERROR', { fields: { name: '场馆名已存在' } })
  }
  // userBookingEnabled 的变化不触发影响检查，既有预约不变（规划裁决 A9）。
  const closing = request.operationalStatus === 'CLOSED' && venue.operationalStatus !== 'CLOSED'
  return applyImpactChange(ctx, user, request, {
    affected: closing ? affectedByVenue(ctx, venue.id) : [],
    before: toVenueSummary(ctx, venue), venueId: venue.id, action: 'VENUE_UPDATE', targetId: venue.id,
    commit: () => {
      applyVenueFields(venue, request)
      return toVenueSummary(ctx, venue)
    },
  })
}

function applyVenueFields(venue: VenueRecord, request: UpdateVenueRequest): void {
  venue.name = request.name ?? venue.name
  venue.venueType = request.venueType ?? venue.venueType
  venue.location = request.location ?? venue.location
  venue.description = request.description ?? venue.description
  venue.operationalStatus = request.operationalStatus ?? venue.operationalStatus
  venue.userBookingEnabled = request.userBookingEnabled ?? venue.userBookingEnabled
}

interface CountChange {
  toEnable: ResourceRecord[]
  toDisable: ResourceRecord[]
  toCreate: { name: string; sortOrder: number; resourceType: ResourceRecord['resourceType'] }[]
}

// 规划裁决 A11：前缀缺省取现有场地名去掉末尾数字后的部分，类型缺省取现有场地类型；
// 编号 N = 以该前缀开头且其余部分全为数字的名称中的最大数字 + 1，不匹配的名称忽略。
// 编号用 BigInt 精确计算，超过 2^53 也不失真（台账 S-045）。
function nextNumber(existing: ResourceRecord[], prefix: string): bigint {
  return existing
    .filter((resource) => resource.name.startsWith(prefix) && /^\d+$/.test(resource.name.slice(prefix.length)))
    .map((resource) => BigInt(resource.name.slice(prefix.length)))
    .reduce((max, value) => (value > max ? value : max), 0n) + 1n
}

function planCreation(
  existing: ResourceRecord[], request: SetResourceCountRequest, needed: number,
): CountChange['toCreate'] {
  const first = existing[0]
  const prefix = request.namePrefix ?? first?.name.replace(/\d+$/, '')
  const resourceType = request.resourceType ?? first?.resourceType
  if (prefix === undefined || resourceType === undefined) {
    const fields = { ...(prefix === undefined ? { namePrefix: '场馆没有场地时必须提供' } : {}), ...(resourceType === undefined ? { resourceType: '场馆没有场地时必须提供' } : {}) }
    return fail('VALIDATION_ERROR', { fields })
  }
  const start = nextNumber(existing, prefix)
  const top = Math.max(0, ...existing.map((resource) => resource.sortOrder))
  return Array.from({ length: needed }, (_, index) => {
    const name = `${prefix}${start + BigInt(index)}`
    if (name.length > RESOURCE_NAME_MAX) {
      return fail('VALIDATION_ERROR', { fields: { namePrefix: `生成的场地名超过 ${RESOURCE_NAME_MAX} 个字符` } })
    }
    if (top + index + 1 > SORT_ORDER_MAX) {
      return fail('VALIDATION_ERROR', { fields: { count: '排序值已达上限，无法追加场地' } })
    }
    return { name, sortOrder: top + index + 1, resourceType }
  })
}

// 12 第 5.5 节的“编号”= 名称“前缀N”中末尾的数字 N（规划裁决 N-12），不看 sortOrder。
function nameNumber(resource: ResourceRecord): bigint | null {
  const digits = /\d+$/.exec(resource.name)
  return digits === null ? null : BigInt(digits[0])
}

// 编号从小到大；名称不是“前缀 + 数字”的场地排在最后，彼此按 id 排序；编号相同按 id。
function byNameNumber(a: ResourceRecord, b: ResourceRecord): number {
  const left = nameNumber(a)
  const right = nameNumber(b)
  if (left !== null && right !== null) {
    return left === right ? a.id - b.id : (left < right ? -1 : 1)
  }
  if (left !== null || right !== null) {
    return left === null ? 1 : -1
  }
  return a.id - b.id
}

// 12 第 5.5 节：count 指状态非 DISABLED 的场地数。增大：先按编号从小到大重新启用被停用的场地，不足再追加；
// 缩小：把编号最大的多余场地置 DISABLED。
function planCount(existing: ResourceRecord[], request: SetResourceCountRequest): CountChange {
  const active = existing.filter((resource) => resource.operationalStatus !== 'DISABLED')
  const change: CountChange = { toEnable: [], toDisable: [], toCreate: [] }
  if (request.count < active.length) {
    change.toDisable = [...active].sort((a, b) => byNameNumber(b, a)).slice(0, active.length - request.count)
    return change
  }
  const needed = request.count - active.length
  change.toEnable = existing.filter((resource) => resource.operationalStatus === 'DISABLED').sort(byNameNumber).slice(0, needed)
  const remaining = needed - change.toEnable.length
  change.toCreate = remaining > 0 ? planCreation(existing, request, remaining) : []
  return change
}

function setResourceCount(
  ctx: MockContext, venueId: number, request: SetResourceCountRequest,
): ImpactChangeResponse<Resource[]> {
  const user = authenticate(ctx)
  collect([
    ['count', intProblem(request.count, 0, MAX_RESOURCE_COUNT)],
    ['namePrefix', optional(request.namePrefix, (value) => textProblem(value, 40))],
    ['resourceType', optional(request.resourceType, (value) => oneOfProblem(value, RESOURCE_TYPES))],
    ...impactControlChecks(request),
  ])
  requireCancelReason(request)
  requireRole(user, 'VENUE_ADMIN', 'SYS_ADMIN')
  const venue = getOrFail(ctx.state.venues, venueId)
  requireScope(ctx, user, venue.id)
  const existing = resourcesOfVenue(ctx.state, venue.id)
  const change = planCount(existing, request)
  return applyImpactChange(ctx, user, request, {
    affected: affectedByResources(ctx, change.toDisable.map((resource) => resource.id)),
    before: existing.map(toResource), venueId: venue.id, action: 'RESOURCE_COUNT_CHANGE', targetId: venue.id,
    commit: () => {
      change.toEnable.forEach((resource) => { resource.operationalStatus = 'OPEN' })
      change.toDisable.forEach((resource) => { resource.operationalStatus = 'DISABLED' })
      for (const created of change.toCreate) {
        ctx.state.resources.push({ id: nextId(ctx.state, 'resource'), venueId: venue.id, operationalStatus: 'OPEN', ...created })
      }
      return resourcesOfVenue(ctx.state, venue.id).map(toResource)
    },
  })
}

// 改场地名称或排序没有对应的日志枚举，不写日志（规划裁决 §7-7）；改状态写 RESOURCE_STATUS_CHANGE。
function updateResource(ctx: MockContext, id: number, request: UpdateResourceRequest): ImpactChangeResponse<Resource> {
  const user = authenticate(ctx)
  collect([
    ['name', optional(request.name, (value) => textProblem(value, 50))],
    ['sortOrder', optional(request.sortOrder, (value) => intProblem(value, 0))],
    ['operationalStatus', optional(request.operationalStatus, (value) => oneOfProblem(value, RESOURCE_STATUSES))],
    ...impactControlChecks(request),
  ])
  requireCancelReason(request)
  requireRole(user, 'VENUE_ADMIN', 'SYS_ADMIN')
  const resource = getOrFail(ctx.state.resources, id)
  const venue = venueOfResource(ctx.state, resource)
  requireScope(ctx, user, venue.id)
  if (!isAbsent(request.name) && resourcesOfVenue(ctx.state, venue.id).some((other) => other.id !== id && other.name === request.name)) {
    fail('VALIDATION_ERROR', { fields: { name: '同一场馆内场地名不能重复' } })
  }
  const statusChange = !isAbsent(request.operationalStatus) && request.operationalStatus !== resource.operationalStatus
  const unavailable = request.operationalStatus === 'MAINTENANCE' || request.operationalStatus === 'DISABLED'
  return applyImpactChange(ctx, user, request, {
    affected: statusChange && unavailable ? affectedByResources(ctx, [resource.id]) : [],
    before: toResource(resource), venueId: venue.id,
    action: statusChange ? 'RESOURCE_STATUS_CHANGE' : null, targetId: resource.id,
    commit: () => {
      resource.name = request.name ?? resource.name
      resource.sortOrder = request.sortOrder ?? resource.sortOrder
      resource.operationalStatus = request.operationalStatus ?? resource.operationalStatus
      return toResource(resource)
    },
  })
}

export type ResourceApi = Pick<ApiClient, 'adminUpdateVenue' | 'adminSetResourceCount' | 'adminUpdateResource'>

export function resourceApi(ctx: MockContext): ResourceApi {
  return {
    adminUpdateVenue: (id, request) => run(ctx, () => updateVenue(ctx, id, request)),
    adminSetResourceCount: (venueId, request) => run(ctx, () => setResourceCount(ctx, venueId, request)),
    adminUpdateResource: (id, request) => run(ctx, () => updateResource(ctx, id, request)),
  }
}
