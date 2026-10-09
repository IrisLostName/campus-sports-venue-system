<script setup lang="ts">
// 报修（FE-5 P7）：所选场馆的报修，按状态筛选，开始处理 / 标记已解决。
import { onMounted } from 'vue'

import AdminPage from '../../components/admin/AdminPage.vue'
import AdminPagination from '../../components/admin/AdminPagination.vue'
import RepairResolveDialog from '../../components/admin/repairs/RepairResolveDialog.vue'
import RepairTable from '../../components/admin/repairs/RepairTable.vue'
import UiSegmented from '../../components/ui/UiSegmented.vue'
import { useCurrentVenue } from '../../composables/adminVenue'
import { useAdminRepairs } from '../../composables/adminRepairs'
import type { RepairStatus } from '../../api/types'
import { REPAIR_FILTER_ITEMS } from '../../utils/adminRepairDisplay'

const { venueId } = useCurrentVenue()
const board = useAdminRepairs(venueId)
const { status, rows, notice, dialog, error, list, load, goTo, setStatus, advance, setNote, confirmResolve, dismissResolve } = board
const { page, pageSize, total, loaded, busy } = list

onMounted(load)
</script>

<template>
  <AdminPage
    title="报修"
    :error="error ?? list.error.value"
    :notice="notice"
  >
    <UiSegmented
      :items="REPAIR_FILTER_ITEMS"
      :model-value="status"
      label="按状态筛选"
      @update:model-value="setStatus($event as RepairStatus | '')"
    />
    <template v-if="loaded">
      <RepairTable
        :rows="rows"
        :busy="busy"
        @step="advance"
      />
      <AdminPagination
        :page="page"
        :page-size="pageSize"
        :total="total"
        :busy="busy"
        @change="goTo"
      />
    </template>
    <RepairResolveDialog
      :state="dialog"
      @update:note="setNote"
      @confirm="confirmResolve"
      @dismiss="dismissResolve"
    />
  </AdminPage>
</template>
