<script setup lang="ts">
// 场地与开放规则（FE-5 P3、P4）：场地列表 / 改名 / 状态 / 设定数量、每周窗口、特殊关闭、场馆简介。
// 受影响的变更共用一个 ImpactDialog。
import { onMounted } from 'vue'

import AdminActionDialog from '../../components/admin/AdminActionDialog.vue'
import AdminPage from '../../components/admin/AdminPage.vue'
import ImpactDialog from '../../components/admin/ImpactDialog.vue'
import ClosureSection from '../../components/admin/resources/ClosureSection.vue'
import ResourceCountForm from '../../components/admin/resources/ResourceCountForm.vue'
import ResourceRenameDialog from '../../components/admin/resources/ResourceRenameDialog.vue'
import ResourceTable from '../../components/admin/resources/ResourceTable.vue'
import VenueDescriptionForm from '../../components/admin/resources/VenueDescriptionForm.vue'
import WeeklyRulesEditor from '../../components/admin/resources/WeeklyRulesEditor.vue'
import { useCurrentVenue } from '../../composables/adminVenue'
import { useAdminResourcesPage } from '../../composables/adminResourcesPage'

const { venueId } = useCurrentVenue()
const { error, notice, flow, resources, rules, profile, load } = useAdminResourcesPage(venueId)
const { dialog } = flow

onMounted(load)
</script>

<template>
  <AdminPage
    title="场地与开放规则"
    :error="error"
    :notice="notice"
  >
    <section aria-label="场地">
      <h2 class="heading">
        场地
      </h2>
      <ResourceTable
        :rows="resources.rows.value"
        @rename="resources.openRename"
        @status="resources.changeStatus"
      />
    </section>
    <ResourceCountForm
      v-model:form="resources.form"
      :empty="resources.loaded.value && resources.items.value.length === 0"
      :busy="flow.checking.value"
      @submit="resources.submitCount"
    />
    <WeeklyRulesEditor
      v-model:rows="rules.draft.value"
      :busy="flow.checking.value"
      @add="rules.addRow"
      @remove="rules.removeRow"
      @save="rules.saveWeekly"
    />
    <ClosureSection
      v-model:form="rules.closureForm"
      :rows="rules.closureRows.value"
      :resources="resources.items.value"
      :busy="flow.checking.value"
      @submit="rules.submitClosure"
      @remove="rules.askRemove"
    />
    <VenueDescriptionForm
      v-model:description="profile.form.description"
      :busy="profile.busy.value"
      @save="profile.save"
    />
    <ResourceRenameDialog
      :state="resources.rename.value"
      @patch="resources.patchRename"
      @confirm="resources.confirmRename"
      @dismiss="resources.dismissRename"
    />
    <AdminActionDialog
      :open="rules.remove.value !== null"
      title="确认删除特殊关闭？"
      confirm-label="删除"
      confirm-variant="destructive"
      :busy="rules.remove.value?.busy ?? false"
      :error="rules.remove.value?.error ?? null"
      @confirm="rules.confirmRemove"
      @dismiss="rules.dismissRemove"
    >
      <p>{{ rules.remove.value?.summary }}</p>
    </AdminActionDialog>
    <ImpactDialog
      :state="dialog"
      @choose="flow.choose"
      @update:reason="flow.setReason"
      @confirm="flow.confirm"
      @dismiss="flow.dismiss"
    />
  </AdminPage>
</template>

<style scoped>
.heading {
  margin-bottom: var(--space-3);
  font: var(--font-headline);
}
</style>
