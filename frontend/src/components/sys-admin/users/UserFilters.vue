<script setup lang="ts">
// 用户筛选（FE-6 G3）：角色（管理员与授权页固定角色，不显示）、关键字（匹配用户名 / 显示名）。点“查询”才发请求。
import type { UserFilters } from '../../../composables/sysUsers'
import { ROLE_OPTIONS } from '../../../utils/sysUserDisplay'
import UiButton from '../../ui/UiButton.vue'
import UiTextField from '../../ui/UiTextField.vue'

const filters = defineModel<UserFilters>('filters', { required: true })

defineProps<{ busy: boolean; showRole: boolean }>()

defineEmits<{ search: [] }>()
</script>

<template>
  <form
    class="filters"
    @submit.prevent="$emit('search')"
  >
    <UiTextField
      v-if="showRole"
      v-model="filters.role"
      label="角色"
      control="select"
    >
      <option value="">
        全部
      </option>
      <option
        v-for="option in ROLE_OPTIONS"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </UiTextField>
    <UiTextField
      v-model="filters.keyword"
      label="关键字"
      placeholder="用户名 / 显示名"
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
