<script setup lang="ts">
// 每周开放窗口编辑（FE-5 P3）：整体替换。一个星期可以有多个窗口；没有窗口的星期不开放。
// 90 分钟整数倍、同日不重叠由接口校验，失败时页面显示 RULE_INVALID 文案。
import { WEEKDAY_OPTIONS } from '../../../utils/adminResourceDisplay'
import type { WeeklyDraftRow } from '../../../utils/adminRuleDisplay'
import UiButton from '../../ui/UiButton.vue'
import UiGlassCard from '../../ui/UiGlassCard.vue'
import UiTextField from '../../ui/UiTextField.vue'

const rows = defineModel<WeeklyDraftRow[]>('rows', { required: true })

defineProps<{ busy: boolean }>()

defineEmits<{ add: []; remove: [key: number]; save: [] }>()
</script>

<template>
  <UiGlassCard
    tag="section"
    material="solid"
    radius="lg"
    class="editor"
    aria-label="每周开放窗口"
  >
    <h2 class="heading">
      每周开放窗口
    </h2>
    <p
      v-if="rows.length === 0"
      class="hint"
    >
      当前没有任何开放窗口，所有星期都不开放。
    </p>
    <ul class="rows">
      <li
        v-for="row in rows"
        :key="row.key"
        class="row"
      >
        <UiTextField
          v-model="row.weekday"
          label="星期"
          control="select"
        >
          <option
            v-for="option in WEEKDAY_OPTIONS"
            :key="option.value"
            :value="String(option.value)"
          >
            {{ option.label }}
          </option>
        </UiTextField>
        <UiTextField
          v-model="row.openTime"
          label="开放时间"
          type="time"
        />
        <UiTextField
          v-model="row.closeTime"
          label="关闭时间"
          type="time"
        />
        <UiButton
          variant="plain"
          @click="$emit('remove', row.key)"
        >
          删除窗口
        </UiButton>
      </li>
    </ul>
    <div class="buttons">
      <UiButton
        variant="secondary"
        @click="$emit('add')"
      >
        添加窗口
      </UiButton>
      <UiButton
        :loading="busy"
        @click="$emit('save')"
      >
        保存每周窗口
      </UiButton>
    </div>
  </UiGlassCard>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.heading {
  font: var(--font-headline);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-3);
}

.buttons {
  display: flex;
  gap: var(--space-2);
}
</style>
