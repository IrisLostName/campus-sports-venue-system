<script setup lang="ts">
// 预约管理（FE-5 P2）：所选场馆的预约列表，取消、改派场地、改派人员。系统管理员端可选“全部场馆”（FE-6 G7）。
import { onMounted } from 'vue'

import AdminPage from '../../components/admin/AdminPage.vue'
import AdminPagination from '../../components/admin/AdminPagination.vue'
import CancelReservationDialog from '../../components/admin/reservations/CancelReservationDialog.vue'
import ReassignResourceDialog from '../../components/admin/reservations/ReassignResourceDialog.vue'
import ReassignUserDialog from '../../components/admin/reservations/ReassignUserDialog.vue'
import ReservationFilters from '../../components/admin/reservations/ReservationFilters.vue'
import ReservationTable from '../../components/admin/reservations/ReservationTable.vue'
import { useOptionalVenue } from '../../composables/adminVenue'
import { useAdminReservations } from '../../composables/adminReservations'
import type { ReservationOp } from '../../utils/adminReservationDisplay'

const { venueId } = useOptionalVenue()
const { filters, list, rows, notice, actions, reassign, load, search, goTo } = useAdminReservations(venueId)
const { page, pageSize, total, loaded, busy, error } = list

function onOp(id: number, op: ReservationOp): void {
  if (op === 'CANCEL') {
    actions.openCancel(id)
  } else if (op === 'REASSIGN_USER') {
    actions.openUser(id)
  } else {
    void reassign.open(id)
  }
}

onMounted(load)
</script>

<template>
  <AdminPage
    title="预约管理"
    :error="error"
    :notice="notice"
  >
    <ReservationFilters
      v-model:filters="filters"
      :busy="busy"
      @search="search"
    />
    <template v-if="loaded">
      <ReservationTable
        :rows="rows"
        @op="onOp"
      />
      <AdminPagination
        :page="page"
        :page-size="pageSize"
        :total="total"
        :busy="busy"
        @change="goTo"
      />
    </template>
    <CancelReservationDialog
      :state="actions.cancel.value"
      @patch="actions.patchCancel"
      @confirm="actions.confirmCancel"
      @dismiss="actions.dismissCancel"
    />
    <ReassignUserDialog
      :state="actions.user.value"
      @patch="actions.patchUser"
      @confirm="actions.confirmUser"
      @dismiss="actions.dismissUser"
    />
    <ReassignResourceDialog
      :state="reassign.state.value"
      @patch="reassign.patch"
      @set-date="reassign.setDate"
      @confirm="reassign.confirm"
      @dismiss="reassign.dismiss"
    />
  </AdminPage>
</template>
