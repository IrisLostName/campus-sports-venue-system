<script setup lang="ts">
import type { NoticeView } from '../../utils/displayModel'
import UiGlassCard from '../ui/UiGlassCard.vue'

defineProps<{ notices: NoticeView[] }>()
</script>

<template>
  <UiGlassCard
    tag="section"
    class="notices"
    material="thick"
  >
    <h3 class="title">
      系统提示
    </h3>
    <ul
      v-if="notices.length > 0"
      class="list"
    >
      <li
        v-for="notice in notices"
        :key="notice.id"
        class="item"
      >
        {{ notice.title }}
      </li>
    </ul>
    <p
      v-else
      class="empty"
    >
      暂无系统提示
    </p>
  </UiGlassCard>
</template>

<style scoped>
.notices {
  padding: 0.8em 1.2em 1em;
}

.title {
  margin: 0 0 0.6em;
  font-size: 1.5em;
  font-weight: 600;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  padding: 0.5em 0.8em;
  border-radius: var(--radius-sm);
  background: var(--glass-thin);
  font-size: 1.1em;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.empty {
  color: var(--color-text-secondary);
}
</style>
