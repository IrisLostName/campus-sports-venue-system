// http 实现：docs/12 第 5.7–5.10 节（预约管理、公告、用户、统计与大屏）。
import type { ApiClient } from '../client'
import type { Transport } from './transport'

export type AdminOpsApi = Pick<ApiClient,
  | 'adminListReservations' | 'adminCancelReservation' | 'adminReassignResource' | 'adminReassignUser'
  | 'adminListAnnouncements' | 'adminCreateAnnouncement' | 'adminArchiveAnnouncement'
  | 'adminListUsers' | 'adminCreateUser' | 'adminUpdateUser' | 'adminSetVenueScope'
  | 'adminGetStatsOverview' | 'adminListLogs' | 'getDisplaySummary'>

export function adminOpsApi(t: Transport): AdminOpsApi {
  return {
    // 5.7
    adminListReservations: (query) => t.request({ method: 'GET', path: '/admin/reservations', query }),
    adminCancelReservation: (id, body) =>
      t.request({ method: 'POST', path: `/admin/reservations/${id}/cancel`, body }),
    adminReassignResource: (id, body) =>
      t.request({ method: 'POST', path: `/admin/reservations/${id}/reassign-resource`, body }),
    adminReassignUser: (id, body) =>
      t.request({ method: 'POST', path: `/admin/reservations/${id}/reassign-user`, body }),
    // 5.8
    adminListAnnouncements: (query) => t.request({ method: 'GET', path: '/admin/announcements', query }),
    adminCreateAnnouncement: (body) => t.request({ method: 'POST', path: '/admin/announcements', body }),
    adminArchiveAnnouncement: (id) => t.request({ method: 'DELETE', path: `/admin/announcements/${id}` }),
    // 5.9
    adminListUsers: (query) => t.request({ method: 'GET', path: '/admin/users', query }),
    adminCreateUser: (body) => t.request({ method: 'POST', path: '/admin/users', body }),
    adminUpdateUser: (id, body) => t.request({ method: 'PATCH', path: `/admin/users/${id}`, body }),
    adminSetVenueScope: (id, body) =>
      t.request({ method: 'PUT', path: `/admin/users/${id}/venue-scope`, body }),
    // 5.10
    adminGetStatsOverview: (query) => t.request({ method: 'GET', path: '/admin/stats/overview', query }),
    adminListLogs: (query) => t.request({ method: 'GET', path: '/admin/logs', query }),
    getDisplaySummary: () => t.request({ method: 'GET', path: '/display/summary', auth: false }),
  }
}
