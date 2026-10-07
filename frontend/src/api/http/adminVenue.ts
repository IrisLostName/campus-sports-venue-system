// http 实现：docs/12 第 5.5–5.6 节（管理端场馆、场地、开放规则）。
import type { ApiClient } from '../client'
import type { Transport } from './transport'

export type AdminVenueApi = Pick<ApiClient,
  | 'adminListVenues' | 'adminCreateVenue' | 'adminUpdateVenue' | 'adminListResources'
  | 'adminSetResourceCount' | 'adminUpdateResource' | 'adminGetOccupancy'
  | 'adminGetAvailabilityRules' | 'adminReplaceWeeklyRules' | 'adminAddClosure' | 'adminRemoveClosure'>

export function adminVenueApi(t: Transport): AdminVenueApi {
  return {
    // 5.5
    adminListVenues: () => t.request({ method: 'GET', path: '/admin/venues' }),
    adminCreateVenue: (body) => t.request({ method: 'POST', path: '/admin/venues', body }),
    adminUpdateVenue: (id, body) => t.request({ method: 'PATCH', path: `/admin/venues/${id}`, body }),
    adminListResources: (venueId) =>
      t.request({ method: 'GET', path: `/admin/venues/${venueId}/resources` }),
    adminSetResourceCount: (venueId, body) =>
      t.request({ method: 'PUT', path: `/admin/venues/${venueId}/resource-count`, body }),
    adminUpdateResource: (id, body) =>
      t.request({ method: 'PATCH', path: `/admin/resources/${id}`, body }),
    adminGetOccupancy: (venueId, date) =>
      t.request({ method: 'GET', path: `/admin/venues/${venueId}/occupancy`, query: { date } }),
    // 5.6
    adminGetAvailabilityRules: (venueId) =>
      t.request({ method: 'GET', path: `/admin/venues/${venueId}/availability-rules` }),
    adminReplaceWeeklyRules: (venueId, body) =>
      t.request({ method: 'PUT', path: `/admin/venues/${venueId}/availability-rules/weekly`, body }),
    adminAddClosure: (venueId, body) =>
      t.request({ method: 'POST', path: `/admin/venues/${venueId}/closures`, body }),
    adminRemoveClosure: (id) => t.request({ method: 'DELETE', path: `/admin/closures/${id}` }),
  }
}
