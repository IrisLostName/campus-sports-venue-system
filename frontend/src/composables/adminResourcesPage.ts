// “场地与开放规则”页的组装（FE-5 P3）：场地、开放规则、场馆简介三个 board 共用一个影响检查流程和一组提示。
import { reactive, ref } from 'vue'

import { api } from '../api/index'
import { createAdminResources, type PageHooks, type VenueInfo } from './adminResources'
import { createAdminRules } from './adminRules'
import { useCurrentVenue } from './adminVenue'
import { createAdminRunner, type AdminDeps } from './adminRunner'
import { createImpactFlow } from './impactFlow'
import { useSession } from './session'

export const DESCRIPTION_SAVED_NOTICE = '场馆简介已保存'

// 场馆简介：场馆管理员只能改 description（docs/12 第 5.5 节），请求里不带其他字段。
function createVenueProfile(deps: AdminDeps, venueId: number, hooks: PageHooks) {
  const runner = createAdminRunner(deps.call, hooks.error)
  const form = reactive({ description: hooks.venue.description() })

  async function save(): Promise<void> {
    hooks.notice.value = null
    const result = await runner.run(() => deps.api.adminUpdateVenue(venueId, { description: form.description.trim() }))
    if (result.ok) {
      hooks.notice.value = DESCRIPTION_SAVED_NOTICE
      await hooks.venue.reload()
      form.description = hooks.venue.description()
    }
  }

  return { form, busy: runner.busy, save }
}

export function createAdminResourcesPage(deps: AdminDeps, venueId: number, venue: VenueInfo) {
  const error = ref<string | null>(null)
  const notice = ref<string | null>(null)
  const flow = createImpactFlow({ call: deps.call, error, notice })
  const hooks: PageHooks = { flow, error, notice, venue }
  const resources = createAdminResources(deps, venueId, hooks)
  const rules = createAdminRules(deps, venueId, hooks, () => resources.items.value)
  const profile = createVenueProfile(deps, venueId, hooks)

  async function load(): Promise<void> {
    await Promise.all([resources.load(), rules.load()])
    resources.syncCount()
  }

  return { error, notice, flow, resources, rules, profile, load }
}

export function useAdminResourcesPage(venueId: number) {
  const { venue, reloadVenues } = useCurrentVenue()
  const info: VenueInfo = {
    resourceCount: () => venue.value?.resourceCount,
    description: () => venue.value?.description ?? '',
    reload: reloadVenues,
  }
  return createAdminResourcesPage({ api, call: useSession().caller() }, venueId, info)
}
