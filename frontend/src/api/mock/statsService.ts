// docs/12 第 5.10 节：统计总览与大屏聚合；口径见 docs/03 第 8 节，场地实时状态见第 4.5 节（规划裁决 A14）。
import type { ApiClient } from '../client'
import type { ResourceLiveState } from '../types'
import type { StatsOverviewQuery } from '../requests'
import type { DisplaySummary, StatsOverview } from '../typesSection5'
import { fail } from './fail'
import { authenticate, manageableVenueIds, requireRole, requireScope } from './guards'
import { isLive } from './contentService'
import { getOrFail, resourcesOfVenue, venueOfResource } from './lookup'
import { endSeconds, nowSeconds, startSeconds, venueIdOfReservation } from './reservationView'
import { run } from './run'
import { deriveSlots, isActiveStatus, isClosedByRule } from './slotDerivation'
import type { MockContext, ReservationRecord, ResourceRecord, UserRecord, VenueRecord } from './state'
import { addDays, dateOf, dayNumber, slotSeconds } from './timeMath'
import { collect, dateProblem, intProblem, optional } from './validate'

const MAX_RANGE_DAYS = 366
const TREND_DAYS = 7
const NOTICE_LIMIT = 5

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator
}

function datesBetween(from: string, to: string): string[] {
  return Array.from({ length: dayNumber(to) - dayNumber(from) + 1 }, (_, index) => addDays(from, index))
}

// 开放时段数：OPEN 场馆下每个 OPEN 场地，按开放规则切分并扣除关闭规则后的时段总数（03 第 8 节）。
function openSlotCount(ctx: MockContext, venues: VenueRecord[], date: string): number {
  let total = 0
  for (const venue of venues.filter((candidate) => candidate.operationalStatus === 'OPEN')) {
    const slots = deriveSlots(ctx.state, venue.id, date).length
    const openResources = resourcesOfVenue(ctx.state, venue.id)
      .filter((resource) => resource.operationalStatus === 'OPEN' && !isClosedByRule(ctx.state, venue.id, resource.id, date))
    total += slots * openResources.length
  }
  return total
}

function occupiedOn(ctx: MockContext, venues: VenueRecord[], date: string): number {
  const ids = venues.map((venue) => venue.id)
  return ctx.state.reservations.filter((record) =>
    record.serviceDate === date && isActiveStatus(record.status) && ids.includes(venueIdOfReservation(ctx, record))).length
}

function inUseNow(ctx: MockContext, record: ReservationRecord): boolean {
  const now = nowSeconds(ctx)
  return record.status === 'CONFIRMED' && record.checkInAt !== null && record.checkOutAt === null
    && startSeconds(record) <= now && now < endSeconds(record)
}

// 以下三个函数是管理端总览与大屏共用的口径（03 第 8 节末句：同一份统计服务，口径不分叉）。
// 预约量：按创建日期归入区间，含已取消。
function createdIn(ctx: MockContext, venues: VenueRecord[], dates: string[]): ReservationRecord[] {
  const ids = venues.map((venue) => venue.id)
  return ctx.state.reservations.filter((record) =>
    dates.includes(dateOf(record.createdAt)) && ids.includes(venueIdOfReservation(ctx, record)))
}

// 利用率：有效占用时段数 ÷ 开放时段数，按使用日期。
function utilizationOn(ctx: MockContext, venues: VenueRecord[], date: string): number | null {
  return rate(occupiedOn(ctx, venues, date), openSlotCount(ctx, venues, date))
}

// 当前使用：当前时刻落在预约区间内且已签到未签退。
function inUseCount(ctx: MockContext, venues: VenueRecord[]): number {
  const ids = venues.map((venue) => venue.id)
  return ctx.state.reservations.filter((record) =>
    inUseNow(ctx, record) && ids.includes(venueIdOfReservation(ctx, record))).length
}

function scopedVenues(ctx: MockContext, query: StatsOverviewQuery, user: UserRecord): VenueRecord[] {
  if (query.venueId !== undefined) {
    requireScope(ctx, user, query.venueId)
    return [getOrFail(ctx.state.venues, query.venueId)]
  }
  const ids = manageableVenueIds(ctx, user)
  return ctx.state.venues.filter((venue) => ids.includes(venue.id))
}

function validateStatsQuery(query: StatsOverviewQuery, from: string, to: string): void {
  collect([
    ['venueId', optional(query.venueId, (value) => intProblem(value))],
    ['dateFrom', optional(query.dateFrom, dateProblem)],
    ['dateTo', optional(query.dateTo, dateProblem)],
  ])
  const days = dayNumber(to) - dayNumber(from) + 1
  if (days < 1 || days > MAX_RANGE_DAYS) {
    fail('VALIDATION_ERROR', { fields: { dateFrom: `日期范围应为 1–${MAX_RANGE_DAYS} 天` } })
  }
}

// 预约量、取消量按创建日期归入区间；占用、开放时段、利用率、未到场率按使用日期归入区间。
function getStatsOverview(ctx: MockContext, query: StatsOverviewQuery): StatsOverview {
  const user = authenticate(ctx)
  const today = dateOf(ctx.clock.now())
  const dateTo = query.dateTo ?? today
  const dateFrom = query.dateFrom ?? addDays(dateTo, -6)
  validateStatsQuery(query, dateFrom, dateTo)
  requireRole(user, 'VENUE_ADMIN', 'SYS_ADMIN')
  const venues = scopedVenues(ctx, query, user)
  const venueIds = venues.map((venue) => venue.id)
  const dates = datesBetween(dateFrom, dateTo)
  const inScope = ctx.state.reservations.filter((record) => venueIds.includes(venueIdOfReservation(ctx, record)))
  const created = createdIn(ctx, venues, dates)
  const used = inScope.filter((record) => dates.includes(record.serviceDate))
  const openSlots = dates.reduce((sum, date) => sum + openSlotCount(ctx, venues, date), 0)
  const activeOccupiedSlots = used.filter((record) => isActiveStatus(record.status)).length
  const noShow = used.filter((record) => record.status === 'NO_SHOW').length
  const completed = used.filter((record) => record.status === 'COMPLETED').length
  return {
    dateFrom, dateTo,
    reservationCount: created.length,
    activeOccupiedSlots, openSlots,
    utilizationRate: rate(activeOccupiedSlots, openSlots),
    currentInUse: inUseCount(ctx, venues),
    userCancelCount: created.filter((record) => record.status === 'CANCELLED').length,
    adminCancelCount: created.filter((record) => record.status === 'ADMIN_CANCELLED').length,
    noShowRate: rate(noShow, noShow + completed),
    byVenue: venues.map((venue) => venueBreakdown(ctx, venue, dates)),
    daily: dates.map((date) => ({
      date,
      reservationCount: createdIn(ctx, venues, [date]).length,
      utilizationRate: utilizationOn(ctx, venues, date),
    })),
  }
}

function venueBreakdown(ctx: MockContext, venue: VenueRecord, dates: string[]) {
  const open = dates.reduce((sum, date) => sum + openSlotCount(ctx, [venue], date), 0)
  const occupied = dates.reduce((sum, date) => sum + occupiedOn(ctx, [venue], date), 0)
  return {
    venueId: venue.id, venueName: venue.name,
    reservationCount: createdIn(ctx, [venue], dates).length,
    utilizationRate: rate(occupied, open),
  }
}

// 03 第 4.5 节优先级：DISABLED > MAINTENANCE > IN_USE > RESERVED > FREE。
function liveState(ctx: MockContext, venue: VenueRecord, resource: ResourceRecord): ResourceLiveState {
  const today = dateOf(ctx.clock.now())
  if (resource.operationalStatus === 'DISABLED') {
    return 'DISABLED'
  }
  if (resource.operationalStatus === 'MAINTENANCE' || venue.operationalStatus === 'CLOSED'
    || isClosedByRule(ctx.state, venue.id, resource.id, today)) {
    return 'MAINTENANCE'
  }
  const now = nowSeconds(ctx)
  const mine = ctx.state.reservations.filter((record) =>
    record.resourceId === resource.id && record.serviceDate === today && record.status === 'CONFIRMED')
  if (mine.some((record) => inUseNow(ctx, record))) {
    return 'IN_USE'
  }
  // “当前时段或紧接着的下一时段”（规划裁决 F2）：当前时段 = 现在所在的派生时段 [start, end)；
  // 下一时段 = 当日开始时间等于当前时段结束时刻的派生时段。不在任何派生时段内（开馆前、窗口间空档、闭馆后）
  // 时没有当前时段，也就没有下一时段，之后的预约不触发 RESERVED。
  const current = deriveSlots(ctx.state, venue.id, today)
    .find((slot) => slotSeconds(today, slot.startTime) <= now && now < slotSeconds(today, slot.endTime))
  const reserved = mine.some((record) => record.checkInAt === null
    && ((startSeconds(record) <= now && now < endSeconds(record)) || (current !== undefined && record.startTime === current.endTime)))
  return reserved ? 'RESERVED' : 'FREE'
}

function getDisplaySummary(ctx: MockContext): DisplaySummary {
  const today = dateOf(ctx.clock.now())
  const { venues } = ctx.state
  const states = ctx.state.resources.map((resource) => ({
    resource, state: liveState(ctx, venueOfResource(ctx.state, resource), resource),
  }))
  return {
    generatedAt: ctx.clock.now(),
    todayReservationCount: createdIn(ctx, venues, [today]).length,
    currentInUse: inUseCount(ctx, venues),
    todayUtilizationRate: utilizationOn(ctx, venues, today),
    venues: venues.map((venue) => {
      const own = states.filter((entry) => entry.resource.venueId === venue.id)
      return {
        venueId: venue.id, venueName: venue.name, operationalStatus: venue.operationalStatus,
        userBookingEnabled: venue.userBookingEnabled,
        resourceTotal: own.filter((entry) => entry.state !== 'DISABLED').length,
        resourceOpen: own.filter((entry) => entry.resource.operationalStatus === 'OPEN').length,
        resourcesReservedNow: own.filter((entry) => entry.state === 'RESERVED' || entry.state === 'IN_USE').length,
      }
    }),
    resources: states.map(({ resource, state }) => ({
      venueId: resource.venueId, resourceId: resource.id, resourceName: resource.name, state,
    })),
    weekTrend: datesBetween(addDays(today, 1 - TREND_DAYS), today).map((date) => ({
      date, reservationCount: createdIn(ctx, venues, [date]).length,
    })),
    notices: ctx.state.announcements
      .filter((record) => record.scope === 'SYSTEM' && isLive(ctx, record))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id - a.id)
      .slice(0, NOTICE_LIMIT)
      .map((record) => ({ id: record.id, title: record.title })),
  }
}

export type StatsApi = Pick<ApiClient, 'adminGetStatsOverview' | 'getDisplaySummary'>

export function statsApi(ctx: MockContext): StatsApi {
  return {
    adminGetStatsOverview: (query = {}) => run(ctx, () => getStatsOverview(ctx, query)),
    getDisplaySummary: () => run(ctx, () => getDisplaySummary(ctx)),
  }
}
