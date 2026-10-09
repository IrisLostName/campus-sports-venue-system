<script setup lang="ts">
// 影响检查对话框（FE-5 P4；docs/12 第 5.5 节）：所有受影响的变更共用。状态来自 composables/impactFlow。
// 无受影响预约：普通确认。有受影响预约：列出预约，保留 / 取消两个选项都不预选；选“取消”须填原因。
import type { OnExisting } from '../../api/types'
import type { ImpactDialogState } from '../../composables/impactFlow'
import { briefText } from '../../utils/impactDisplay'
import UiTextField from '../ui/UiTextField.vue'
import AdminActionDialog from './AdminActionDialog.vue'
import { REASON_MAX_LENGTH } from '../../utils/fieldLimits'

defineProps<{ state: ImpactDialogState | null }>()

defineEmits<{
  choose: [choice: OnExisting]
  'update:reason': [reason: string]
  confirm: []
  dismiss: []
}>()
</script>

<template>
  <AdminActionDialog
    :open="state !== null"
    :title="state?.title ?? ''"
    :confirm-label="state !== null && state.impact.affectedCount > 0 ? '确认提交' : '确认'"
    :busy="state?.busy ?? false"
    :error="state?.error ?? null"
    @confirm="$emit('confirm')"
    @dismiss="$emit('dismiss')"
  >
    <template v-if="state !== null">
      <p
        v-if="state.impact.affectedCount === 0"
        class="none"
      >
        该操作不影响已有预约。
      </p>
      <template v-else>
        <p class="count">
          该操作会影响 {{ state.impact.affectedCount }} 个未来预约：
        </p>
        <ul class="list">
          <li
            v-for="brief in state.impact.reservations"
            :key="brief.id"
          >
            {{ briefText(brief) }}
          </li>
        </ul>
        <fieldset class="choices">
          <legend>对这些预约：</legend>
          <label class="choice">
            <input
              type="radio"
              name="impact-choice"
              value="KEEP"
              :checked="state.choice === 'KEEP'"
              @change="$emit('choose', 'KEEP')"
            >
            保留（KEEP）：预约保持有效，仅阻止新的预约
          </label>
          <label class="choice">
            <input
              type="radio"
              name="impact-choice"
              value="CANCEL"
              :checked="state.choice === 'CANCEL'"
              @change="$emit('choose', 'CANCEL')"
            >
            取消（CANCEL）：这些预约将被管理员取消
          </label>
        </fieldset>
        <UiTextField
          :model-value="state.reason"
          label="原因（选择取消时必填）"
          :maxlength="REASON_MAX_LENGTH"
          control="textarea"
          rows="2"
          @update:model-value="$emit('update:reason', $event)"
        />
      </template>
    </template>
  </AdminActionDialog>
</template>

<style scoped>
.none,
.count {
  color: var(--color-text-secondary);
}

.list {
  max-height: 200px;
  margin: 0;
  padding-left: var(--space-5);
  overflow-y: auto;
  font: var(--font-footnote);
}

.choices {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  border: 0;
}

.choices legend {
  padding: 0;
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}

.choice {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 44px;
}
</style>
