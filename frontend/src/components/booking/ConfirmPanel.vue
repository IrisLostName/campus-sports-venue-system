<script setup lang="ts">
import { PURPOSE_MAX_LENGTH } from '../../utils/bookingDisplay'

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
  <section
    class="confirm"
    aria-label="确认预约"
  >
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

    <label class="purpose">
      用途（可选）
      <input
        v-model="purpose"
        type="text"
        :maxlength="PURPOSE_MAX_LENGTH"
        placeholder="例如：朋友约练"
      >
    </label>

    <p
      v-if="error !== null"
      class="error"
      role="alert"
    >
      {{ error }}
    </p>

    <div class="buttons">
      <button
        type="button"
        class="secondary"
        :disabled="submitting"
        @click="$emit('back')"
      >
        返回
      </button>
      <button
        type="button"
        class="primary"
        :disabled="submitting"
        @click="$emit('submit')"
      >
        {{ submitting ? '提交中…' : '确认预约' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.confirm {
  padding: 16px;
  border: 1px solid #dde3ea;
  border-radius: 12px;
  background: #ffffff;
}

h2 {
  margin: 0 0 8px;
  font-size: 18px;
}

.rows {
  margin: 0 0 12px;
}

.rows div {
  display: flex;
  gap: 12px;
  padding: 4px 0;
  font-size: 15px;
}

dt {
  flex: none;
  width: 3.5em;
  color: #5f6b7a;
}

dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}

.purpose {
  display: block;
  font-size: 14px;
}

input {
  display: block;
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  margin-top: 6px;
  padding: 8px;
  border: 1px solid #c8d0da;
  border-radius: 8px;
  font: inherit;
}

.error {
  margin: 12px 0 0;
  color: #b3261e;
  font-size: 14px;
}

.buttons {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

button {
  flex: 1;
  min-height: 44px;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}

.secondary {
  border: 1px solid #c8d0da;
  background: #ffffff;
  color: #1f2933;
}

.primary {
  border: 1px solid #0b6b4f;
  background: #0b6b4f;
  color: #ffffff;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
