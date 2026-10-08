<script setup lang="ts">
import { PURPOSE_MAX_LENGTH } from '../../utils/bookingDisplay'
import UiBanner from '../ui/UiBanner.vue'
import UiButton from '../ui/UiButton.vue'
import UiGlassCard from '../ui/UiGlassCard.vue'
import UiTextField from '../ui/UiTextField.vue'

export interface BookingConfirmation {
  venueName: string
  resourceName: string
  dateText: string
  timeText: string
}

defineProps<{ confirmation: BookingConfirmation; submitting: boolean; error: string | null }>()

const purpose = defineModel<string>('purpose', { required: true })

defineEmits<{ submit: []; back: [] }>()
</script>

<template>
  <!-- 确认是页面步骤（docs/17 第 7 节），做成厚玻璃底部面板样式的卡片，不是浮层。 -->
  <UiGlassCard
    tag="section"
    class="confirm"
    aria-label="确认预约"
    material="thick"
    radius="2xl"
    :padding="5"
  >
    <span
      class="grabber"
      aria-hidden="true"
    />
    <h2>确认预约</h2>
    <dl class="rows">
      <div>
        <dt>场馆</dt>
        <dd>{{ confirmation.venueName }}</dd>
      </div>
      <div>
        <dt>场地</dt>
        <dd>{{ confirmation.resourceName }}</dd>
      </div>
      <div>
        <dt>日期</dt>
        <dd>{{ confirmation.dateText }}</dd>
      </div>
      <div>
        <dt>时间</dt>
        <dd>{{ confirmation.timeText }}</dd>
      </div>
    </dl>

    <UiTextField
      v-model="purpose"
      label="用途（可选）"
      type="text"
      :maxlength="PURPOSE_MAX_LENGTH"
      placeholder="例如：朋友约练"
    />

    <UiBanner
      v-if="error !== null"
      class="error"
      tone="danger"
      role="alert"
    >
      {{ error }}
    </UiBanner>

    <div class="buttons">
      <UiButton
        variant="secondary"
        class="button"
        :disabled="submitting"
        @click="$emit('back')"
      >
        返回
      </UiButton>
      <UiButton
        class="button"
        :loading="submitting"
        @click="$emit('submit')"
      >
        {{ submitting ? '提交中…' : '确认预约' }}
      </UiButton>
    </div>
  </UiGlassCard>
</template>

<style scoped>
.confirm {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.grabber {
  align-self: center;
  width: 36px;
  height: 5px;
  border-radius: var(--radius-capsule);
  background: var(--color-text-tertiary);
}

h2 {
  font: var(--font-headline);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.rows div {
  display: flex;
  gap: var(--space-3);
  font: var(--font-callout);
}

dt {
  flex: none;
  width: 3.5em;
  color: var(--color-text-secondary);
}

dd {
  min-width: 0;
  overflow-wrap: anywhere;
}

.buttons {
  display: flex;
  gap: var(--space-2);
}

.button {
  flex: 1;
}
</style>
