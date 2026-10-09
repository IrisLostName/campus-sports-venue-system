// 用户与管理员账号（FE-6 G2、G3；docs/12 第 5.9 节）：adminListUsers（角色、关键字、分页）；
// 新建 / 改名 / 停用 / 启用见 sysUserAccounts，授权范围见 sysUserScope。
import { computed, reactive, ref } from 'vue'

import { api } from '../api/index'
import type { AdminUsersQuery } from '../api/requests'
import type { Role, UserProfile, VenueSummary } from '../api/types'
import { useAuthStore } from '../stores/auth'
import { buildUserRow } from '../utils/sysUserDisplay'
import { createPagedList } from './adminPaged'
import { createAdminRunner, type AdminDeps } from './adminRunner'
import { useVenueOptions } from './adminVenue'
import { useSession } from './session'
import { createUserAccounts } from './sysUserAccounts'
import { createUserScope } from './sysUserScope'

export type { CreateUserState, DisableUserState, RenameUserState } from './sysUserAccounts'

export interface UserFilters {
  role: Role | ''
  keyword: string
}

export interface SysUsersOptions {
  fixedRole?: Role                          // 管理员与授权页固定为 VENUE_ADMIN
  venues: () => readonly VenueSummary[]     // 授权范围显示场馆名
  selfId: () => number | null
}

export function createSysUsers(deps: AdminDeps, options: SysUsersOptions) {
  const filters = reactive<UserFilters>({ role: options.fixedRole ?? '', keyword: '' })
  const notice = ref<string | null>(null)
  const runner = createAdminRunner(deps.call)

  function queryFor(page: number): AdminUsersQuery {
    const keyword = filters.keyword.trim()
    return { page, ...(filters.role === '' ? {} : { role: filters.role }), ...(keyword === '' ? {} : { keyword }) }
  }

  const list = createPagedList(deps.call, (page) => deps.api.adminListUsers(queryFor(page)))
  const rows = computed(() => {
    const names = new Map(options.venues().map((venue) => [venue.id, venue.name]))
    return list.items.value.map((user) => buildUserRow(user, names, options.selfId()))
  })
  const find = (id: number): UserProfile | undefined => list.items.value.find((user) => user.id === id)
  const notify = (text: string | null): void => { notice.value = text }
  const reload = (page?: number): Promise<void> => list.load(page)
  const accounts = createUserAccounts(deps, { find, selfId: options.selfId, fixedRole: options.fixedRole, notify, reload, run: runner.run })
  const scope = createUserScope(deps, { find, notify, refresh: reload })

  return {
    filters, notice, rows, list, busy: runner.busy,
    error: computed(() => runner.error.value ?? list.error.value),
    load: () => list.load(1),
    search: async (): Promise<void> => { notice.value = null; await list.load(1) },
    goTo: async (page: number): Promise<void> => { notice.value = null; await list.load(page) },
    create: accounts.create.state, openCreate: accounts.create.open, patchCreate: accounts.create.patch,
    confirmCreate: accounts.create.confirm, dismissCreate: accounts.create.dismiss,
    rename: accounts.rename.state, openRename: accounts.rename.open, patchRename: accounts.rename.patch,
    confirmRename: accounts.rename.confirm, dismissRename: accounts.rename.dismiss,
    disable: accounts.status.state, askDisable: accounts.status.askDisable, confirmDisable: accounts.status.confirmDisable,
    dismissDisable: accounts.status.dismiss, enable: accounts.status.enable,
    scope: scope.state, openScope: scope.open, patchScope: scope.patch, confirmScope: scope.confirm, dismissScope: scope.dismiss,
  }
}

export function useSysUsers(fixedRole?: Role) {
  const { venues } = useVenueOptions()
  const auth = useAuthStore()
  return createSysUsers(
    { api, call: useSession().caller() },
    { venues: () => venues.value, selfId: () => auth.user?.id ?? null, ...(fixedRole === undefined ? {} : { fixedRole }) },
  )
}
