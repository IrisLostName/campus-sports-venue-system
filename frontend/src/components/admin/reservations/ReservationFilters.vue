<script setup lang="ts">
// 预约筛选（FE-5 P2）：日期区间、状态、关键字（匹配用户名 / 姓名 / 场地名）。点“查询”才发请求。
import type { ReservationFilters } from '../../../composables/adminReservations'
import { RESERVATION_FILTER_OPTIONS } from '../../../utils/adminReservationDisplay'
import UiButton from '../../ui/UiButton.vue'
import UiTextField from '../../ui/UiTextField.vue'

const filters = defineModel<ReservationFilters>('filters', { required: true })

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
    <UiTextField
      v-model="filters.status"
      label="状态"
      control="select"
    >
      <option value="">
        全部
      </option>
      <option
        v-for="option in RESERVATION_FILTER_OPTIONS"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </UiTextField>
    <UiTextField
      v-model="filters.keyword"
      label="关键字"
      placeholder="用户名 / 姓名 / 场地名"
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
