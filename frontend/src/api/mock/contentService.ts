// 公告（docs/12 第 5.2、5.8 节）与报修（第 5.4 节）；流程见 docs/10 第 7 节。
import type { ApiClient } from '../client'
import type { Announcement, Page, RepairReport } from '../types'
import type {
  AdminAnnouncementsQuery, AdminRepairsQuery, AnnouncementQuery, CreateAnnouncementRequest,
  CreateRepairRequest, UpdateRepairRequest,
} from '../requests'
import { ANNOUNCEMENT_SCOPES, ANNOUNCEMENT_STATUSES, REPAIR_STATUSES } from './enums'
import { fail } from './fail'
import { authenticate, hasScope, manageableVenueIds, requireRole, requireScope } from './guards'
import { appendLog, snapshot } from './logService'
import { getOrFail, userById } from './lookup'
import { pageOf } from './paging'
import { run } from './run'
import { nextId, type AnnouncementRecord, type MockContext, type RepairRecord } from './state'
import { secondsOf } from './timeMath'
import { collect, intProblem, oneOfProblem, optional, pagingChecks, textProblem } from './validate'

function toAnnouncement(ctx: MockContext, record: AnnouncementRecord): Announcement {
  return {
    id: record.id, scope: record.scope, venueId: record.venueId, title: record.title, content: record.content,
    status: record.status, publishedAt: record.publishedAt,
    publishedByName: userById(ctx.state, record.publishedById).displayName, expiresAt: record.expiresAt,
  }
}

function newestPublishedFirst(a: AnnouncementRecord, b: AnnouncementRecord): number {
  return b.publishedAt.localeCompare(a.publishedAt) || b.id - a.id
}

export function isLive(ctx: MockContext, record: AnnouncementRecord): boolean {
  const unexpired = record.expiresAt === null || secondsOf(record.expiresAt) > secondsOf(ctx.clock.now())
  return record.status === 'ACTIVE' && unexpired
}

// 5.2：scope=SYSTEM 返回系统公告；scope=VENUE&venueId= 返回该场馆公告；只返回 ACTIVE 且未过期，按发布时间倒序。
function listAnnouncements(ctx: MockContext, query: AnnouncementQuery): Announcement[] {
  authenticate(ctx)
  collect([
    ['scope', oneOfProblem(query.scope, ANNOUNCEMENT_SCOPES)],
    ['venueId', query.scope === 'VENUE' ? intProblem(query.venueId) : optional(query.venueId, (value) => intProblem(value))],
  ])
  return ctx.state.announcements
    .filter((record) => record.scope === query.scope && isLive(ctx, record)
      && (query.scope === 'SYSTEM' || record.venueId === query.venueId))
    .sort(newestPublishedFirst)
    .map((record) => toAnnouncement(ctx, record))
}

// 5.8：VA 只含授权场馆的场馆公告和系统公告（系统公告只读）。
function adminListAnnouncements(ctx: MockContext, query: AdminAnnouncementsQuery): Page<Announcement> {
  const user = authenticate(ctx)
  collect([
    ['scope', optional(query.scope, (value) => oneOfProblem(value, ANNOUNCEMENT_SCOPES))],
    ['venueId', optional(query.venueId, (value) => intProblem(value))],
    ['status', optional(query.status, (value) => oneOfProblem(value, ANNOUNCEMENT_STATUSES))],
    ...pagingChecks(query.page, undefined),
  ])
  requireRole(user, 'VENUE_ADMIN', 'SYS_ADMIN')
  if (query.venueId !== undefined) {
    requireScope(ctx, user, query.venueId)
  }
  const ids = manageableVenueIds(ctx, user)
  const records = ctx.state.announcements
    .filter((record) => (record.venueId === null || ids.includes(record.venueId))
      && (query.scope === undefined || record.scope === query.scope)
      && (query.venueId === undefined || record.venueId === query.venueId)
      && (query.status === undefined || record.status === query.status))
    .sort(newestPublishedFirst)
  return pageOf(records.map((record) => toAnnouncement(ctx, record)), query.page)
}

// 5.8：scope=VENUE 必须带 venueId；scope=SYSTEM 不带。VA 仅可发 VENUE 且在范围内，SA 两种都可。
function createAnnouncement(ctx: MockContext, request: CreateAnnouncementRequest): Announcement {
  const user = authenticate(ctx)
  const venueScoped = request.scope === 'VENUE'
  collect([
    ['scope', oneOfProblem(request.scope, ANNOUNCEMENT_SCOPES)],
    ['venueId', venueScoped ? intProblem(request.venueId) : (request.venueId === undefined ? null : 'SYSTEM 公告不应带 venueId')],
    ['title', textProblem(request.title, 100)],
    ['content', textProblem(request.content, 2000)],
    ['expiresAt', optional(request.expiresAt, (value) => textProblem(value, 19))],
  ])
  requireRole(user, 'VENUE_ADMIN', 'SYS_ADMIN')
  if (!venueScoped && user.role !== 'SYS_ADMIN') {
    fail('FORBIDDEN')
  }
  const venueId = venueScoped ? getOrFail(ctx.state.venues, request.venueId ?? 0).id : null
  if (venueId !== null) {
    requireScope(ctx, user, venueId)
  }
  const record: AnnouncementRecord = {
    id: nextId(ctx.state, 'announcement'), scope: request.scope, venueId, title: request.title,
    content: request.content, status: 'ACTIVE', publishedById: user.id, publishedAt: ctx.clock.now(),
    expiresAt: request.expiresAt ?? null,
  }
  ctx.state.announcements.push(record)
  const created = toAnnouncement(ctx, record)
  appendLog(ctx, user, {
    venueId, action: 'ANNOUNCEMENT_PUBLISH', targetId: record.id, before: null, after: snapshot(created),
  })
  return created
}

// 5.8：归档（ARCHIVED），返回 204；发布权限同上。
function archiveAnnouncement(ctx: MockContext, id: number): void {
  const user = authenticate(ctx)
  requireRole(user, 'VENUE_ADMIN', 'SYS_ADMIN')
  const record = getOrFail(ctx.state.announcements, id)
  if (record.venueId === null && user.role !== 'SYS_ADMIN') {
    fail('FORBIDDEN')
  }
  if (record.venueId !== null) {
    requireScope(ctx, user, record.venueId)
  }
  const before = toAnnouncement(ctx, record)
  record.status = 'ARCHIVED'
  appendLog(ctx, user, {
    venueId: record.venueId, action: 'ANNOUNCEMENT_ARCHIVE', targetId: record.id,
    before: snapshot(before), after: snapshot(toAnnouncement(ctx, record)),
  })
}

function toRepair(ctx: MockContext, record: RepairRecord): RepairReport {
  const venue = getOrFail(ctx.state.venues, record.venueId)
  const resource = record.resourceId === null ? null : getOrFail(ctx.state.resources, record.resourceId)
  return {
    id: record.id, venueId: venue.id, venueName: venue.name,
    resourceId: resource === null ? null : resource.id, resourceName: resource === null ? null : resource.name,
    reporterId: record.reporterId, reporterName: userById(ctx.state, record.reporterId).displayName,
    description: record.description, status: record.status, resultNote: record.resultNote,
    createdAt: record.createdAt, updatedAt: record.updatedAt,
  }
}

function createRepair(ctx: MockContext, request: CreateRepairRequest): RepairReport {
  const user = authenticate(ctx)
  collect([
    ['venueId', intProblem(request.venueId)],
    ['resourceId', optional(request.resourceId, (value) => intProblem(value))],
    ['description', textProblem(request.description, 500)],
  ])
  requireRole(user, 'USER')
  const venue = getOrFail(ctx.state.venues, request.venueId)
  if (request.resourceId !== undefined) {
    const resource = getOrFail(ctx.state.resources, request.resourceId)
    if (resource.venueId !== venue.id) {
      fail('VALIDATION_ERROR', { fields: { resourceId: '场地不属于该场馆' } })
    }
  }
  const now = ctx.clock.now()
  const record: RepairRecord = {
    id: nextId(ctx.state, 'repair'), venueId: venue.id, resourceId: request.resourceId ?? null,
    reporterId: user.id, description: request.description, status: 'SUBMITTED', resultNote: null,
    handledBy: null, createdAt: now, updatedAt: now,
  }
  ctx.state.repairs.push(record)
  return toRepair(ctx, record)
}

function listMyRepairs(ctx: MockContext): RepairReport[] {
  const user = authenticate(ctx)
  requireRole(user, 'USER')
  return ctx.state.repairs
    .filter((record) => record.reporterId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    .map((record) => toRepair(ctx, record))
}

function adminListRepairs(ctx: MockContext, query: AdminRepairsQuery): Page<RepairReport> {
  const user = authenticate(ctx)
  collect([
    ['venueId', optional(query.venueId, (value) => intProblem(value))],
    ['status', optional(query.status, (value) => oneOfProblem(value, REPAIR_STATUSES))],
    ...pagingChecks(query.page, undefined),
  ])
  requireRole(user, 'VENUE_ADMIN', 'SYS_ADMIN')
  if (query.venueId !== undefined) {
    requireScope(ctx, user, query.venueId)
  }
  const records = ctx.state.repairs
    .filter((record) => hasScope(ctx, user, record.venueId)
      && (query.venueId === undefined || record.venueId === query.venueId)
      && (query.status === undefined || record.status === query.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
  return pageOf(records.map((record) => toRepair(ctx, record)), query.page)
}

// 状态只能 SUBMITTED → IN_PROGRESS → RESOLVED（可由 SUBMITTED 直接到 RESOLVED），逆向或重复返回 INVALID_STATE。
function canTransition(from: RepairRecord['status'], to: UpdateRepairRequest['status']): boolean {
  return (from === 'SUBMITTED' && (to === 'IN_PROGRESS' || to === 'RESOLVED')) || (from === 'IN_PROGRESS' && to === 'RESOLVED')
}

function updateRepair(ctx: MockContext, id: number, request: UpdateRepairRequest): RepairReport {
  const user = authenticate(ctx)
  collect([
    ['status', oneOfProblem(request.status, ['IN_PROGRESS', 'RESOLVED'])],
    ['resultNote', request.status === 'RESOLVED' ? textProblem(request.resultNote, 500) : optional(request.resultNote, (value) => textProblem(value, 500))],
  ])
  requireRole(user, 'VENUE_ADMIN', 'SYS_ADMIN')
  const record = getOrFail(ctx.state.repairs, id)
  requireScope(ctx, user, record.venueId)
  if (!canTransition(record.status, request.status)) {
    fail('INVALID_STATE', { status: record.status })
  }
  const before = toRepair(ctx, record)
  record.status = request.status
  record.resultNote = request.resultNote ?? record.resultNote
  record.handledBy = user.id
  record.updatedAt = ctx.clock.now()
  const after = toRepair(ctx, record)
  appendLog(ctx, user, {
    venueId: record.venueId, action: 'REPAIR_UPDATE', targetId: record.id,
    before: snapshot(before), after: snapshot(after),
  })
  return after
}

export type ContentApi = Pick<ApiClient,
  | 'listAnnouncements' | 'adminListAnnouncements' | 'adminCreateAnnouncement' | 'adminArchiveAnnouncement'
  | 'createRepair' | 'listMyRepairs' | 'adminListRepairs' | 'adminUpdateRepair'>

export function contentApi(ctx: MockContext): ContentApi {
  return {
    listAnnouncements: (query) => run(ctx, () => listAnnouncements(ctx, query)),
    adminListAnnouncements: (query = {}) => run(ctx, () => adminListAnnouncements(ctx, query)),
    adminCreateAnnouncement: (request) => run(ctx, () => createAnnouncement(ctx, request)),
    adminArchiveAnnouncement: (id) => run(ctx, () => archiveAnnouncement(ctx, id)),
    createRepair: (request) => run(ctx, () => createRepair(ctx, request)),
    listMyRepairs: () => run(ctx, () => listMyRepairs(ctx)),
    adminListRepairs: (query = {}) => run(ctx, () => adminListRepairs(ctx, query)),
    adminUpdateRepair: (id, request) => run(ctx, () => updateRepair(ctx, id, request)),
  }
}
