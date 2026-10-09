// 输入长度上限，逐项对应 docs/13（FE-5 N1、N2，FE-6 G1、G3）。
export const VENUE_NAME_MAX_LENGTH = 50          // venue.name
export const VENUE_LOCATION_MAX_LENGTH = 100     // venue.location
export const VENUE_DESCRIPTION_MAX_LENGTH = 500  // venue.description
export const REASON_MAX_LENGTH = 200             // cancel_reason / admin_note / availability_rule.reason / admin_operation_log.reason
export const USERNAME_MAX_LENGTH = 32            // app_user.username
export const PASSWORD_MAX_LENGTH = 64            // docs/12 第 5.1 节：密码 8–64 位
export const DISPLAY_NAME_MAX_LENGTH = 50        // app_user.display_name
export const PHONE_MAX_LENGTH = 20               // app_user.phone
