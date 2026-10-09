// 用户与授权的展示口径（FE-6 G2、G3；docs/12 第 2、5.1、5.9 节，docs/13 app_user 表）。
// 用户名 3–32 位字母数字下划线、密码 8–64 位，与注册一致（沿用 authValidation）；裁决始终在服务端。
import type { CreateUserRequest } from '../api/requests'
import type { AccountStatus, Role, UserProfile, UserType } from '../api/types'
import { validateRegisterFields } from './authValidation'
import { USER_TYPE_LABELS } from './meDisplay'

export { USER_TYPE_LABELS }

export const ROLE_LABELS: Record<Role, string> = {
  USER: '普通用户',
  VENUE_ADMIN: '场馆管理员',
  SYS_ADMIN: '系统管理员',
}

export const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as Role[]).map((value) => ({ value, label: ROLE_LABELS[value] }))

export const USER_TYPE_OPTIONS = (Object.keys(USER_TYPE_LABELS) as UserType[])
  .map((value) => ({ value, label: USER_TYPE_LABELS[value] }))

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  ACTIVE: '正常',
  DISABLED: '已停用',
}

export const NO_SCOPE_TEXT = '未授权任何场馆'
export const NAME_REQUIRED_TEXT = '请填写显示名'
export const CREATED_NOTICE = '账号已创建'
export const RENAMED_NOTICE = '显示名已保存'
export const SCOPE_SAVED_NOTICE = '授权范围已更新'

export function statusNotice(name: string, status: AccountStatus): string {
  return status === 'DISABLED' ? `已停用账号：${name}` : `已启用账号：${name}`
}

export interface UserRowView {
  id: number
  username: string
  displayName: string
  roleLabel: string
  statusLabel: string
  active: boolean
  isSelf: boolean            // 自己的账号不显示停用按钮（后端仍会返回 INVALID_STATE）
  scopeText: string | null   // 仅场馆管理员有授权范围
  isVenueAdmin: boolean
  venueIds: number[]
}

export function buildUserRow(user: UserProfile, venueNames: ReadonlyMap<number, string>, selfId: number | null): UserRowView {
  const ids = user.venueIds ?? []
  const names = ids.map((id) => venueNames.get(id) ?? `场馆 #${id}`)
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    roleLabel: ROLE_LABELS[user.role],
    statusLabel: ACCOUNT_STATUS_LABELS[user.status],
    active: user.status === 'ACTIVE',
    isSelf: user.id === selfId,
    scopeText: user.venueIds === null ? null : (names.length === 0 ? NO_SCOPE_TEXT : names.join('、')),
    isVenueAdmin: user.role === 'VENUE_ADMIN',
    venueIds: ids,
  }
}

export interface UserFormFields {
  username: string
  password: string
  displayName: string
  role: Role
  userType: UserType
  phone: string
  venueIds: number[]
}

export function emptyUserForm(role: Role = 'USER'): UserFormFields {
  return { username: '', password: '', displayName: '', role, userType: 'STUDENT', phone: '', venueIds: [] }
}

export function userFormProblem(fields: UserFormFields): string | null {
  return validateRegisterFields({ username: fields.username, password: fields.password, displayName: fields.displayName })
}

// userType 只在角色为 USER 时发送，venueIds 只在 VENUE_ADMIN 时发送（docs/12 第 5.9 节）；电话为空则不发送。
export function buildCreateUserRequest(fields: UserFormFields): CreateUserRequest {
  const phone = fields.phone.trim()
  return {
    username: fields.username,
    password: fields.password,
    displayName: fields.displayName.trim(),
    role: fields.role,
    ...(fields.role === 'USER' ? { userType: fields.userType } : {}),
    ...(phone === '' ? {} : { phone }),
    ...(fields.role === 'VENUE_ADMIN' ? { venueIds: [...fields.venueIds] } : {}),
  }
}
