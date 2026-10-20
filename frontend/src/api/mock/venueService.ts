// docs/12 第 5.2、5.5 节：场馆、时段、管理端场馆与场地列表、占用总览（规划裁决 A7）。
import type { ApiClient } from '../client'
import type { Occupancy, OccupancySlot } from '../typesSection5'
import type { CreateVenueRequest } from '../requests'
import type { Resource, SlotStatus, VenueSlots, VenueSummary } from '../types'
import { VENUE_TYPES } from './enums'
import { fail } from './fail'
import { authenticate, manageableVenueIds, requireRole, requireScope } from './guards'
import { getOrFail, resourcesOfVenue } from './lookup'
import { run } from './run'
import { displayStatusOf, nowSeconds } from './reservationView'
import { findActiveReservation, isClosedByRule, isUnavailable, resolveSlotStatus, deriveSlots, type DerivedSlot, type SlotFacts } from './slotDerivation'
import { nextId, type MockContext, type ResourceRecord, type VenueRecord } from './state'
import { dateOf, isWithinAdvance, slotSeconds } from './timeMath'
import { blankToNull, collect, dateProblem, oneOfProblem, optionalText, textProblem } from './validate'

export function toVenueSummary(ctx: MockContext, venue: VenueRecord): VenueSummary {
  return {
    id: venue.id, name: venue.name, venueType: venue.venueType, location: venue.location,
    description: venue.description, operationalStatus: venue.operationalStatus,
    userBookingEnabled: venue.userBookingEnabled,
    bookable: venue.operationalStatus === 'OPEN' && venue.userBookingEnabled,
    resourceCount: resourcesOfVenue(ctx.state, venue.id).filter((r) => r.operationalStatus !== 'DISABLED').length,
  }
}

export function toResource(record: ResourceRecord): Resource {
  return {
    id: record.id, venueId: record.venueId, name: record.name, resourceType: record.resourceType,
    sortOrder: record.sortOrder, operationalStatus: record.operationalStatus,
  }
}

function slotFacts(ctx: MockContext, venue: VenueRecord, resource: ResourceRecord, date: string, slot: DerivedSlot): SlotFacts {
  const { state } = ctx
  return {
    isPast: slotSeconds(date, slot.startTime) <= nowSeconds(ctx),
    reservation: findActiveReservation(state, resource.id, date, slot.startTime),
    unavailable: isUnavailable(venue, resource, isClosedByRule(state, venue.id, resource.id, date)),
  }
}

function listVenues(ctx: MockContext): VenueSummary[] {
  authenticate(ctx)
  return [...ctx.state.venues].sort((a, b) => a.id - b.id).map((venue) => toVenueSummary(ctx, venue))
}

// 12 第 5.2 节：仅 bookable 场馆可查询；DISABLED 的场地不出现；MAINTENANCE 的场地出现但时段为 CLOSED。
function getVenueSlots(ctx: MockContext, venueId: number, date: string): VenueSlots {
  const user = authenticate(ctx)
  collect([['date', dateProblem(date)]])
  const venue = getOrFail(ctx.state.venues, venueId)
  if (venue.operationalStatus !== 'OPEN' || !venue.userBookingEnabled) {
    fail('VENUE_NOT_BOOKABLE')
  }
  if (!isWithinAdvance(dateOf(ctx.clock.now()), ctx.rules.advanceDays, date)) {
    fail('DATE_OUT_OF_RANGE', { advanceDays: ctx.rules.advanceDays })
  }
  const slots = deriveSlots(ctx.state, venue.id, date)
  const resources = resourcesOfVenue(ctx.state, venue.id).filter((r) => r.operationalStatus !== 'DISABLED')
  return {
    venueId: venue.id, venueName: venue.name, date,
    resources: resources.map((resource) => ({
      resourceId: resource.id, resourceName: resource.name, operationalStatus: resource.operationalStatus,
      slots: slots.map((slot) => ({
        startTime: slot.startTime, endTime: slot.endTime,
        status: resolveSlotStatus(slotFacts(ctx, venue, resource, date, slot), user.id),
      })),
    })),
  }
}

function adminListVenues(ctx: MockContext): VenueSummary[] {
  const user = authenticate(ctx)
  requireRole(user, 'VENUE_ADMIN', 'SYS_ADMIN')
  const ids = manageableVenueIds(ctx, user)
  return ctx.state.venues
    .filter((venue) => ids.includes(venue.id))
    .sort((a, b) => a.id - b.id)
    .map((venue) => toVenueSummary(ctx, venue))
}

// 12 第 5.5 节：新场馆默认 OPEN、userBookingEnabled=false，无场地无规则。不写操作日志（规划裁决 §7-7）。
function adminCreateVenue(ctx: MockContext, request: CreateVenueRequest): VenueSummary {
  const user = authenticate(ctx)
  collect([
    ['name', textProblem(request.name, 50)],
    ['venueType', oneOfProblem(request.venueType, VENUE_TYPES)],
    ['location', optionalText(request.location, 100)],
    ['description', optionalText(request.description, 500)],
  ])
  requireRole(user, 'SYS_ADMIN')
  if (ctx.state.venues.some((venue) => venue.name === request.name)) {
    fail('VALIDATION_ERROR', { fields: { name: '场馆名已存在' } })
  }
  const venue: VenueRecord = {
    id: nextId(ctx.state, 'venue'), name: request.name, venueType: request.venueType,
    location: blankToNull(request.location), description: blankToNull(request.description),
    operationalStatus: 'OPEN', userBookingEnabled: false,
  }
  ctx.state.venues.push(venue)
  return toVenueSummary(ctx, venue)
}

function adminListResources(ctx: MockContext, venueId: number): Resource[] {
  const user = authenticate(ctx)
  requireRole(user, 'VENUE_ADMIN', 'SYS_ADMIN')
  const venue = getOrFail(ctx.state.venues, venueId)
  requireScope(ctx, user, venue.id)
  return resourcesOfVenue(ctx.state, venue.id).map(toResource)
}

function occupancyStatus(status: SlotStatus): OccupancySlot['status'] {
  return status === 'MINE' ? 'BOOKED' : status
}

function occupancySlot(ctx: MockContext, venue: VenueRecord, resource: ResourceRecord, date: string, slot: DerivedSlot): OccupancySlot {
  const facts = slotFacts(ctx, venue, resource, date, slot)
  const reservation = facts.reservation
  return {
    startTime: slot.startTime, endTime: slot.endTime,
    status: occupancyStatus(resolveSlotStatus(facts, null)),
    reservation: reservation === undefined ? null : {
      id: reservation.id,
      userDisplayName: getOrFail(ctx.state.users, reservation.userId).displayName,
      displayStatus: displayStatusOf(ctx, reservation),
    },
  }
}

// 规划裁决 A7：总览列出全部场地（含 DISABLED，其时段为 CLOSED）；resourceCount = 非 DISABLED 的场地数；
// 只要存在有效预约，reservation 字段就填充。
function adminGetOccupancy(ctx: MockContext, venueId: number, date: string): Occupancy {
  const user = authenticate(ctx)
  collect([['date', dateProblem(date)]])
  requireRole(user, 'VENUE_ADMIN', 'SYS_ADMIN')
  const venue = getOrFail(ctx.state.venues, venueId)
  requireScope(ctx, user, venue.id)
  const slots = deriveSlots(ctx.state, venue.id, date)
  const resources = resourcesOfVenue(ctx.state, venue.id)
  return {
    venueId: venue.id, venueName: venue.name, date,
    resourceCount: resources.filter((r) => r.operationalStatus !== 'DISABLED').length,
    resources: resources.map((resource) => ({
      resourceId: resource.id, resourceName: resource.name, operationalStatus: resource.operationalStatus,
      slots: slots.map((slot) => occupancySlot(ctx, venue, resource, date, slot)),
    })),
  }
}

export type VenueApi = Pick<ApiClient,
  'listVenues' | 'getVenueSlots' | 'adminListVenues' | 'adminCreateVenue' | 'adminListResources' | 'adminGetOccupancy'>

export function venueApi(ctx: MockContext): VenueApi {
  return {
    listVenues: () => run(ctx, () => listVenues(ctx)),
    getVenueSlots: (venueId, date) => run(ctx, () => getVenueSlots(ctx, venueId, date)),
    adminListVenues: () => run(ctx, () => adminListVenues(ctx)),
    adminCreateVenue: (request) => run(ctx, () => adminCreateVenue(ctx, request)),
    adminListResources: (venueId) => run(ctx, () => adminListResources(ctx, venueId)),
    adminGetOccupancy: (venueId, date) => run(ctx, () => adminGetOccupancy(ctx, venueId, date)),
  }
}
