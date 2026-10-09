// 系统公告（FE-6 G4；docs/12 第 5.8 节）：adminListAnnouncements({scope:'SYSTEM'})（含已归档，状态筛选，分页）、
// 发布（scope=SYSTEM，不带 venueId）、归档。表单与归档确认沿用 FE-5 公告页的实现。
import { computed, reactive, ref } from 'vue'

import { api } from '../api/index'
import type { AdminAnnouncementsQuery } from '../api/requests'
import type { AnnouncementStatus } from '../api/types'
import { buildAnnouncementRow, toExpiresAt } from '../utils/announcementDisplay'
import {
  ARCHIVED_NOTICE, PUBLISHED_NOTICE, createArchiveDialog, emptyForm, formProblem, type AnnouncementForm,
} from './adminAnnouncements'
import { createPagedList } from './adminPaged'
import { createAdminRunner, type AdminDeps } from './adminRunner'
import { useSession } from './session'

export { ARCHIVED_NOTICE, PUBLISHED_NOTICE }

export function createSysAnnouncements(deps: AdminDeps) {
  const status = ref<AnnouncementStatus | ''>('')
  const list = createPagedList(deps.call, (page) => {
    const query: AdminAnnouncementsQuery = { scope: 'SYSTEM', page }
    return deps.api.adminListAnnouncements(status.value === '' ? query : { ...query, status: status.value })
  })
  const runner = createAdminRunner(deps.call)
  const notice = ref<string | null>(null)
  const form = reactive<AnnouncementForm>(emptyForm())
  const formError = ref<string | null>(null)
  // FE-5 的公告表格只在场馆公告上给归档按钮；系统管理员可以归档系统公告（docs/12 第 5.8 节：发布权限同上）。
  const rows = computed(() => list.items.value.map((item) => ({ ...buildAnnouncementRow(item), canArchive: item.status === 'ACTIVE' })))

  async function load(): Promise<void> {
    await list.load(1)
  }

  async function setStatus(next: AnnouncementStatus | ''): Promise<void> {
    status.value = next
    notice.value = null
    await load()
  }

  async function publish(): Promise<void> {
    if (runner.busy.value) {
      return
    }
    notice.value = null
    formError.value = formProblem(form)
    if (formError.value !== null) {
      return
    }
    const expiresAt = toExpiresAt(form.expiresAt)
    const body = { scope: 'SYSTEM' as const, title: form.title.trim(), content: form.content.trim() }
    const result = await runner.run(() => deps.api.adminCreateAnnouncement(expiresAt === undefined ? body : { ...body, expiresAt }))
    if (result.ok) {
      Object.assign(form, emptyForm())
      notice.value = PUBLISHED_NOTICE
      await load()
    } else if (!result.sessionEnded) {
      formError.value = result.message
    }
  }

  const archiver = createArchiveDialog(deps, runner, { rows: () => rows.value, notify: (text) => { notice.value = text }, reload: load })

  return {
    status, list, rows, notice, form, formError, publishing: runner.busy,
    error: computed(() => list.error.value ?? runner.error.value),
    load, setStatus, publish, goTo: (page: number) => list.load(page), ...archiver,
  }
}

export function useSysAnnouncements() {
  return createSysAnnouncements({ api, call: useSession().caller() })
}
