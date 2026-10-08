// 公告（FE-5 P6）：所选场馆的场馆公告（含已归档，状态可筛选，分页）+ 系统公告只读；发布场馆公告、归档场馆公告。
import { computed, reactive, ref } from 'vue'

import { api } from '../api/index'
import type { AnnouncementStatus } from '../api/types'
import type { AdminAnnouncementsQuery } from '../api/requests'
import {
  buildAnnouncementRow, CONTENT_REQUIRED_TEXT, TITLE_REQUIRED_TEXT, toExpiresAt,
} from '../utils/announcementDisplay'
import { createPagedList } from './adminPaged'
import { createAdminRunner, type AdminDeps } from './adminRunner'
import { useSession } from './session'

export interface AnnouncementForm {
  title: string
  content: string
  expiresAt: string
}

export interface ArchiveDialogState {
  id: number
  title: string
  busy: boolean
  error: string | null
}

export const PUBLISHED_NOTICE = '公告已发布'
export const ARCHIVED_NOTICE = '公告已归档'

function emptyForm(): AnnouncementForm {
  return { title: '', content: '', expiresAt: '' }
}

function formProblem(form: AnnouncementForm): string | null {
  if (form.title.trim() === '') {
    return TITLE_REQUIRED_TEXT
  }
  return form.content.trim() === '' ? CONTENT_REQUIRED_TEXT : null
}

export function createAdminAnnouncements(deps: AdminDeps, venueId: number) {
  const status = ref<AnnouncementStatus | ''>('')
  const withStatus = (query: AdminAnnouncementsQuery): AdminAnnouncementsQuery =>
    (status.value === '' ? query : { ...query, status: status.value })
  const venueList = createPagedList(deps.call, (page) => deps.api.adminListAnnouncements(withStatus({ scope: 'VENUE', venueId, page })))
  const systemList = createPagedList(deps.call, (page) => deps.api.adminListAnnouncements(withStatus({ scope: 'SYSTEM', page })))
  const runner = createAdminRunner(deps.call)
  const notice = ref<string | null>(null)
  const form = reactive<AnnouncementForm>(emptyForm())
  const formError = ref<string | null>(null)
  const archive = ref<ArchiveDialogState | null>(null)

  const venueRows = computed(() => venueList.items.value.map(buildAnnouncementRow))
  const systemRows = computed(() => systemList.items.value.map(buildAnnouncementRow))
  // 系统公告只读，只取第一页；超出时提示。
  const systemTruncated = computed(() => systemList.total.value > systemList.items.value.length)

  async function load(): Promise<void> {
    await Promise.all([venueList.load(1), systemList.load(1)])
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
    const body = { scope: 'VENUE' as const, venueId, title: form.title.trim(), content: form.content.trim() }
    const result = await runner.run(() => deps.api.adminCreateAnnouncement(expiresAt === undefined ? body : { ...body, expiresAt }))
    if (result.ok) {
      Object.assign(form, emptyForm())
      notice.value = PUBLISHED_NOTICE
      await load()
    } else if (!result.sessionEnded) {
      formError.value = result.message
    }
  }

  function askArchive(id: number): void {
    const row = venueRows.value.find((item) => item.id === id)
    if (row !== undefined && row.canArchive) {
      archive.value = { id, title: row.title, busy: false, error: null }
    }
  }

  async function confirmArchive(): Promise<void> {
    const state = archive.value
    if (state === null || state.busy) {
      return
    }
    archive.value = { ...state, busy: true, error: null }
    const result = await runner.run(() => deps.api.adminArchiveAnnouncement(state.id))
    if (result.ok) {
      archive.value = null
      notice.value = ARCHIVED_NOTICE
      await load()
    } else {
      archive.value = result.sessionEnded ? null : { ...state, busy: false, error: result.message }
    }
  }

  function dismissArchive(): void {
    archive.value = null
  }

  return {
    status, venueList, systemList, venueRows, systemRows, systemTruncated, notice, form, formError, archive,
    publishing: runner.busy, load, setStatus, publish, askArchive, confirmArchive, dismissArchive,
    goTo: (page: number) => venueList.load(page),
  }
}

export function useAdminAnnouncements(venueId: number) {
  return createAdminAnnouncements({ api, call: useSession().caller() }, venueId)
}
