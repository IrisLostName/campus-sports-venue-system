<script setup lang="ts">
// 系统公告（FE-6 G4，/sys-admin/announcements）：发布、按状态筛选、归档。表单与表格沿用 FE-5 的公告组件。
import { onMounted } from 'vue'

import AdminActionDialog from '../../components/admin/AdminActionDialog.vue'
import AdminPage from '../../components/admin/AdminPage.vue'
import AdminPagination from '../../components/admin/AdminPagination.vue'
import AnnouncementForm from '../../components/admin/announcements/AnnouncementForm.vue'
import AnnouncementTable from '../../components/admin/announcements/AnnouncementTable.vue'
import UiSegmented from '../../components/ui/UiSegmented.vue'
import { useSysAnnouncements } from '../../composables/sysAnnouncements'
import type { AnnouncementStatus } from '../../api/types'
import { ANNOUNCEMENT_FILTER_ITEMS } from '../../utils/announcementDisplay'

const {
  status, list, rows, notice, form, formError, publishing, error, archive,
  load, setStatus, publish, askArchive, confirmArchive, dismissArchive, goTo,
} = useSysAnnouncements()

onMounted(load)
</script>

<template>
  <AdminPage
    title="系统公告"
    :error="error"
    :notice="notice"
  >
    <AnnouncementForm
      v-model:form="form"
      heading="发布系统公告"
      :error="formError"
      :busy="publishing"
      @publish="publish"
    />
    <UiSegmented
      :items="ANNOUNCEMENT_FILTER_ITEMS"
      :model-value="status"
      label="按状态筛选"
      @update:model-value="setStatus($event as AnnouncementStatus | '')"
    />
    <section aria-label="系统公告列表">
      <AnnouncementTable
        :rows="rows"
        caption="系统公告"
        empty-title="暂无系统公告"
        @archive="askArchive"
      />
      <AdminPagination
        :page="list.page.value"
        :page-size="list.pageSize.value"
        :total="list.total.value"
        :busy="list.busy.value"
        @change="goTo"
      />
    </section>
    <AdminActionDialog
      :open="archive !== null"
      title="确认归档公告？"
      confirm-label="归档"
      confirm-variant="destructive"
      :busy="archive?.busy ?? false"
      :error="archive?.error ?? null"
      @confirm="confirmArchive"
      @dismiss="dismissArchive"
    >
      <p>归档后用户端不再显示：{{ archive?.title }}</p>
    </AdminActionDialog>
  </AdminPage>
</template>
