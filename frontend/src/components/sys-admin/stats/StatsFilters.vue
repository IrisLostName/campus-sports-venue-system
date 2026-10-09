<script setup lang="ts">
// 全局统计的日期区间（FE-6 G5）：可选，缺省由接口决定；点“查询”才发请求。
import type { StatsFilters } from '../../../composables/sysStats'
import UiButton from '../../ui/UiButton.vue'
import UiTextField from '../../ui/UiTextField.vue'

const filters = defineModel<StatsFilters>('filters', { required: true })

defineProps<{ busy: boolean }>()

defineEmits<{ search: [] }>()
</script>

<template>
  <form
    class="filters"
    @submit.prevent="$emit('search')"
  >
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
