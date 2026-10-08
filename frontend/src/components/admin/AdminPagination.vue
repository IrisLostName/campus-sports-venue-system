<script setup lang="ts">
// 分页条（FE-5）：只显示接口返回的 page / pageSize / total，翻页时发出目标页码。
import { computed } from 'vue'

import UiButton from '../ui/UiButton.vue'

const props = defineProps<{ page: number; pageSize: number; total: number; busy?: boolean }>()

defineEmits<{ change: [page: number] }>()

const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
</script>

<template>
  <nav
    class="pagination"
    aria-label="分页"
  >
    <UiButton
      variant="secondary"
      :disabled="busy || page <= 1"
      @click="$emit('change', page - 1)"
    >
      上一页
    </UiButton>
    <span class="status">第 {{ page }} / {{ pages }} 页 · 共 {{ total }} 条</span>
    <UiButton
      variant="secondary"
      :disabled="busy || page >= pages"
      @click="$emit('change', page + 1)"
    >
      下一页
    </UiButton>
  </nav>
</template>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
}

.status {
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}
</style>
