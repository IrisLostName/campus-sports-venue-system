// 路由路径常量的唯一出处（FE-2 审计 N-3）。routes.ts、dock.ts、access.ts 与页面链接都引用这里，不再各自写字面量。
export const PATHS = {
  login: '/login',
  home: '/',
  reservation: '/reservation',
  booking: '/booking',
  me: '/me',
  venueAdmin: '/venue-admin',
  venueAdminReservations: '/venue-admin/reservations',
  venueAdminResources: '/venue-admin/resources',
  venueAdminOccupancy: '/venue-admin/occupancy',
  venueAdminAnnouncements: '/venue-admin/announcements',
  venueAdminRepairs: '/venue-admin/repairs',
  venueAdminLogs: '/venue-admin/logs',
  sysAdmin: '/sys-admin',
  display: '/display',
} as const
