<script setup lang="ts">
import type { VenueSummary } from '../../api/types'
import { REPAIR_DESCRIPTION_MAX_LENGTH } from '../../utils/meDisplay'
import UiBanner from '../ui/UiBanner.vue'
import UiButton from '../ui/UiButton.vue'
import UiGlassCard from '../ui/UiGlassCard.vue'
import UiTextField from '../ui/UiTextField.vue'

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
  <UiGlassCard
    tag="form"
    class="form"
    aria-label="提交报修"
    @submit.prevent="$emit('submit')"
  >
    <UiTextField
      v-model="venueId"
      label="场馆"
      control="select"
    >
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
    </UiTextField>

    <UiTextField
      v-model="description"
      label="问题描述"
      control="textarea"
      rows="3"
      :maxlength="REPAIR_DESCRIPTION_MAX_LENGTH"
      placeholder="例如：灯光损坏、地面积水"
    />

    <UiBanner
      v-if="error !== null"
      class="error"
      tone="danger"
      role="alert"
    >
      {{ error }}
    </UiBanner>
    <UiBanner
      v-if="notice !== null"
      class="notice"
      tone="success"
      role="status"
    >
      {{ notice }}
    </UiBanner>

    <UiButton
      type="submit"
      block
      :loading="submitting"
    >
      {{ submitting ? '提交中…' : '提交报修' }}
    </UiButton>
  </UiGlassCard>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
</style>
