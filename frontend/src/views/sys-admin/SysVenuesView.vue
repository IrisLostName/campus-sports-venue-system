<script setup lang="ts">
// 场馆资料与开关（FE-6 G1，/sys-admin）：场馆列表、新增、编辑资料、开放预约开关、关闭（影响检查）与重新开放。
import { onMounted } from 'vue'

import AdminPage from '../../components/admin/AdminPage.vue'
import ImpactDialog from '../../components/admin/ImpactDialog.vue'
import VenueCreateForm from '../../components/sys-admin/venues/VenueCreateForm.vue'
import VenueEditDialog from '../../components/sys-admin/venues/VenueEditDialog.vue'
import VenueTable from '../../components/sys-admin/venues/VenueTable.vue'
import UiButton from '../../components/ui/UiButton.vue'
import { useSysVenues } from '../../composables/sysVenues'
import { PATHS } from '../../router/paths'

const {
  error, notice, rows, loaded, form, formError, created, creating, load, submitCreate,
  edit, openEdit, patchEdit, confirmEdit, dismissEdit, status,
} = useSysVenues()
const { flow } = status

onMounted(load)
</script>

<template>
  <AdminPage
    title="场馆资料与开关"
    :error="error"
    :notice="notice"
  >
    <div
      v-if="created"
      class="next"
    >
      <UiButton
        :to="{ path: PATHS.sysAdminResources, query: { venueId: String(created.id) } }"
        variant="secondary"
      >
        前往设定“{{ created.name }}”的场地与开放规则
      </UiButton>
    </div>
    <VenueTable
      v-if="loaded"
      :rows="rows"
      :busy="status.busy.value"
      @toggle="status.toggleBooking"
      @edit="openEdit"
      @close="status.askClose"
      @reopen="status.reopen"
    />
    <VenueCreateForm
      v-model:form="form"
      :error="formError"
      :busy="creating"
      @submit="submitCreate"
    />
    <VenueEditDialog
      :state="edit"
      @patch="patchEdit"
      @confirm="confirmEdit"
      @dismiss="dismissEdit"
    />
    <ImpactDialog
      :state="flow.dialog.value"
      @choose="flow.choose"
      @update:reason="flow.setReason"
      @confirm="flow.confirm"
      @dismiss="flow.dismiss"
    />
  </AdminPage>
</template>
