// http 实现：docs/12 第 5.1–5.4 节（认证、场馆与时段、预约、报修）。
import type { ApiClient } from '../client'
import type { Transport } from './transport'

export type UserApi = Pick<ApiClient,
  | 'register' | 'login' | 'getMe' | 'getBookingRules'
  | 'listVenues' | 'getVenueSlots' | 'listAnnouncements'
  | 'createReservation' | 'listMyReservations' | 'getReservation'
  | 'cancelReservation' | 'checkIn' | 'checkOut'
  | 'createRepair' | 'listMyRepairs' | 'adminListRepairs' | 'adminUpdateRepair'>

export function userApi(t: Transport): UserApi {
  return {
    // 5.1
    register: (body) => t.request({ method: 'POST', path: '/auth/register', body, auth: false }),
    login: (body) => t.request({ method: 'POST', path: '/auth/login', body, auth: false }),
    getMe: () => t.request({ method: 'GET', path: '/auth/me' }),
    getBookingRules: () => t.request({ method: 'GET', path: '/config/booking-rules', auth: false }),
    // 5.2
    listVenues: () => t.request({ method: 'GET', path: '/venues' }),
    getVenueSlots: (venueId, date) =>
      t.request({ method: 'GET', path: `/venues/${venueId}/slots`, query: { date } }),
    listAnnouncements: (query) => t.request({ method: 'GET', path: '/announcements', query }),
    // 5.3
    createReservation: (body) => t.request({ method: 'POST', path: '/reservations', body }),
    listMyReservations: (query) => t.request({ method: 'GET', path: '/reservations/me', query }),
    getReservation: (id) => t.request({ method: 'GET', path: `/reservations/${id}` }),
    cancelReservation: (id, body) =>
      t.request({ method: 'POST', path: `/reservations/${id}/cancel`, body: body ?? {} }),
    checkIn: (id) => t.request({ method: 'POST', path: `/reservations/${id}/check-in` }),
    checkOut: (id) => t.request({ method: 'POST', path: `/reservations/${id}/check-out` }),
    // 5.4
    createRepair: (body) => t.request({ method: 'POST', path: '/repairs', body }),
    listMyRepairs: () => t.request({ method: 'GET', path: '/repairs/me' }),
    adminListRepairs: (query) => t.request({ method: 'GET', path: '/admin/repairs', query }),
    adminUpdateRepair: (id, body) => t.request({ method: 'PATCH', path: `/admin/repairs/${id}`, body }),
  }
}
