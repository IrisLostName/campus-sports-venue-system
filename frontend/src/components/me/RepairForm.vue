<script setup lang="ts">
import type { VenueSummary } from '../../api/types'
import { REPAIR_DESCRIPTION_MAX_LENGTH } from '../../utils/meDisplay'

defineProps<{
  venues: VenueSummary[]
  submitting: boolean
  error: string | null
  notice: string | null
}>()

const venueId = defineModel<number | null>('venueId', { required: true })
const description = defineModel<string>('description', { required: true })

defineEmits<{ submit: [] }>()
</script>

<template>
  <form
    class="form"
    aria-label="提交报修"
    @submit.prevent="$emit('submit')"
  >
    <label>
      场馆
      <select v-model="venueId">
        <option :value="null">
          请选择场馆
        </option>
        <option
          v-for="venue in venues"
          :key="venue.id"
          :value="venue.id"
        >
          {{ venue.name }}
        </option>
      </select>
    </label>

    <label>
      问题描述
      <textarea
        v-model="description"
        rows="3"
        :maxlength="REPAIR_DESCRIPTION_MAX_LENGTH"
        placeholder="例如：灯光损坏、地面积水"
      />
    </label>

    <p
      v-if="error !== null"
      class="error"
      role="alert"
    >
      {{ error }}
    </p>
    <p
      v-if="notice !== null"
      class="notice"
      role="status"
    >
      {{ notice }}
    </p>

    <button
      type="submit"
      :disabled="submitting"
    >
      {{ submitting ? '提交中…' : '提交报修' }}
    </button>
  </form>
</template>

<style scoped>
.form {
  padding: 14px 16px;
  border: 1px solid #dde3ea;
  border-radius: 12px;
  background: #ffffff;
}

label {
  display: block;
  margin-bottom: 12px;
  font-size: 14px;
}

select,
textarea {
  display: block;
  box-sizing: border-box;
  width: 100%;
  margin-top: 6px;
  padding: 8px;
  border: 1px solid #c8d0da;
  border-radius: 8px;
  background: #ffffff;
  font: inherit;
}

select {
  min-height: 44px;
}

textarea {
  resize: vertical;
}

.error {
  margin: 0 0 12px;
  color: #b3261e;
  font-size: 14px;
}

.notice {
  margin: 0 0 12px;
  color: #0b6b4f;
  font-size: 14px;
}

button {
  width: 100%;
  min-height: 44px;
  border: 1px solid #0b6b4f;
  border-radius: 8px;
  background: #0b6b4f;
  color: #ffffff;
  font-size: 16px;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
