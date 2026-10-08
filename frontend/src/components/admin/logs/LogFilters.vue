<script setup lang="ts">
// 操作记录筛选（FE-5 P8）：动作、起止日期。改动不自动查询，点“查询”才发请求。
import type { LogFilters } from '../../../composables/adminLogs'
import { LOG_ACTION_OPTIONS } from '../../../utils/adminLogDisplay'
import UiButton from '../../ui/UiButton.vue'
import UiTextField from '../../ui/UiTextField.vue'

const filters = defineModel<LogFilters>('filters', { required: true })

defineProps<{ busy: boolean }>()

defineEmits<{ search: [] }>()
</script>

<template>
  <form
    class="filters"
    @submit.prevent="$emit('search')"
  >
    <UiTextField
      v-model="filters.action"
      label="动作"
      control="select"
    >
      <option value="">
        全部
      </option>
      <option
        v-for="option in LOG_ACTION_OPTIONS"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </UiTextField>
    <UiTextField
      v-model="filters.dateFrom"
      label="起始日期"
      type="date"
    />
    <UiTextField
      v-model="filters.dateTo"
      label="截止日期"
      type="date"
    />
    <UiButton
      type="submit"
      :loading="busy"
    >
      查询
    </UiButton>
  </form>
</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-3);
}
</style>
