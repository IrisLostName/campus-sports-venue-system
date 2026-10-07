// 请求格式校验用的枚举取值清单，逐一对应 docs/12 第 2 节。
export const ROLES = ['USER', 'VENUE_ADMIN', 'SYS_ADMIN'] as const
export const USER_TYPES = ['STUDENT', 'TEACHER', 'OTHER'] as const
export const ACCOUNT_STATUSES = ['ACTIVE', 'DISABLED'] as const
export const VENUE_TYPES = ['TENNIS', 'BADMINTON', 'SWIMMING', 'BASKETBALL', 'OTHER'] as const
export const VENUE_STATUSES = ['OPEN', 'CLOSED'] as const
export const RESOURCE_TYPES = ['COURT', 'LANE', 'OTHER'] as const
export const RESOURCE_STATUSES = ['OPEN', 'MAINTENANCE', 'DISABLED'] as const
export const RESERVATION_STATUSES = ['CONFIRMED', 'COMPLETED', 'CANCELLED', 'ADMIN_CANCELLED', 'NO_SHOW'] as const
export const RESERVATION_SCOPES = ['CURRENT', 'HISTORY', 'ALL'] as const
export const ANNOUNCEMENT_SCOPES = ['SYSTEM', 'VENUE'] as const
export const ANNOUNCEMENT_STATUSES = ['ACTIVE', 'ARCHIVED'] as const
export const REPAIR_STATUSES = ['SUBMITTED', 'IN_PROGRESS', 'RESOLVED'] as const
export const ON_EXISTING = ['KEEP', 'CANCEL'] as const
