<script setup lang="ts">
// 公告（FE-5 P6）：发布 / 归档所选场馆的公告；系统公告只读。
import { onMounted } from 'vue'

import AdminActionDialog from '../../components/admin/AdminActionDialog.vue'
import AdminPage from '../../components/admin/AdminPage.vue'
import AdminPagination from '../../components/admin/AdminPagination.vue'
import AnnouncementForm from '../../components/admin/announcements/AnnouncementForm.vue'
import AnnouncementTable from '../../components/admin/announcements/AnnouncementTable.vue'
import UiSegmented from '../../components/ui/UiSegmented.vue'
import { useCurrentVenue } from '../../composables/adminVenue'
import { useAdminAnnouncements } from '../../composables/adminAnnouncements'
import type { AnnouncementStatus } from '../../api/types'
import { ANNOUNCEMENT_FILTER_ITEMS } from '../../utils/announcementDisplay'

const { venueId } = useCurrentVenue()
const board = useAdminAnnouncements(venueId)
const {
  status, venueList, systemList, venueRows, systemRows, systemTruncated, notice, form, formError, archive, publishing,
  load, setStatus, publish, askArchive, confirmArchive, dismissArchive, goTo,
} = board

onMounted(load)
</script>

<template>
  <AdminPage
    title="公告"
    :error="venueList.error.value ?? systemList.error.value"
    :notice="notice"
  >
    <AnnouncementForm
      v-model:form="form"
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
    <section aria-label="场馆公告">
      <h2 class="heading">
        场馆公告
      </h2>
      <AnnouncementTable
        :rows="venueRows"
        caption="场馆公告"
        empty-title="暂无场馆公告"
        @archive="askArchive"
      />
      <AdminPagination
        :page="venueList.page.value"
        :page-size="venueList.pageSize.value"
        :total="venueList.total.value"
        :busy="venueList.busy.value"
        @change="goTo"
      />
    </section>
    <section aria-label="系统公告">
      <h2 class="heading">
        系统公告（只读）
      </h2>
      <AnnouncementTable
        :rows="systemRows"
        caption="系统公告"
        empty-title="暂无系统公告"
      />
      <p
        v-if="systemTruncated"
        class="hint"
      >
        仅显示最新 {{ systemRows.length }} 条，共 {{ systemList.total.value }} 条。
      </p>
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

<style scoped>
.heading {
  margin-bottom: var(--space-3);
  font: var(--font-headline);
}
</style>
