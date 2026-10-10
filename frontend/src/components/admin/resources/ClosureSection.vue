<script setup lang="ts">
// 特殊关闭（FE-5 P3）：列表 + 新增表单。场地为空 = 整馆。新增走影响检查；删除（停用）确认后直接提交。
import type { Resource } from '../../../api/types'
import type { ClosureForm } from '../../../composables/adminRules'
import { labelFor } from '../../../utils/accessibleLabel'
import { WHOLE_VENUE_TEXT } from '../../../utils/adminResourceDisplay'
import type { ClosureRowView } from '../../../utils/adminRuleDisplay'
import UiButton from '../../ui/UiButton.vue'
import UiGlassCard from '../../ui/UiGlassCard.vue'
import UiTextField from '../../ui/UiTextField.vue'
import AdminDataTable from '../AdminDataTable.vue'
import { REASON_MAX_LENGTH } from '../../../utils/fieldLimits'

const form = defineModel<ClosureForm>('form', { required: true })

defineProps<{ rows: ClosureRowView[]; resources: Resource[]; busy: boolean }>()

defineEmits<{ submit: []; remove: [id: number] }>()

const COLUMNS = [
  { key: 'rangeText', label: '日期' },
  { key: 'scopeText', label: '范围' },
  { key: 'reasonText', label: '原因' },
  { key: 'actions', label: '操作' },
]
</script>

<template>
  <section
    class="closures"
    aria-label="特殊关闭"
  >
    <h2 class="heading">
      特殊关闭
    </h2>
    <AdminDataTable
      :columns="COLUMNS"
      :rows="rows"
      row-key="id"
      caption="特殊关闭列表"
      empty-title="没有特殊关闭"
    >
      <template #cell-actions="{ row }">
        <UiButton
          variant="destructive"
          :aria-label="labelFor('删除', `${row.rangeText} ${row.scopeText}`)"
          @click="$emit('remove', row.id)"
        >
          删除
        </UiButton>
      </template>
    </AdminDataTable>
    <UiGlassCard
      tag="form"
      material="solid"
      radius="lg"
      class="form"
      aria-label="新增特殊关闭"
      @submit.prevent="$emit('submit')"
    >
      <h3 class="sub">
        新增特殊关闭
      </h3>
      <div class="fields">
        <UiTextField
          v-model="form.startDate"
          label="起始日期"
          type="date"
        />
        <UiTextField
          v-model="form.endDate"
          label="截止日期"
          type="date"
        />
        <UiTextField
          v-model="form.resourceId"
          label="范围"
          control="select"
        >
          <option value="">
            {{ WHOLE_VENUE_TEXT }}
          </option>
          <option
            v-for="resource in resources"
            :key="resource.id"
            :value="String(resource.id)"
          >
            {{ resource.name }}
          </option>
        </UiTextField>
        <UiTextField
          v-model="form.reason"
          label="原因（可选）"
          :maxlength="REASON_MAX_LENGTH"
        />
      </div>
      <div>
        <UiButton
          type="submit"
          :loading="busy"
        >
          新增关闭
        </UiButton>
      </div>
    </UiGlassCard>
  </section>
</template>

<style scoped>
.closures {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.heading {
  font: var(--font-headline);
}

.sub {
  font: var(--font-callout);
  font-weight: 600;
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.fields {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
</style>
