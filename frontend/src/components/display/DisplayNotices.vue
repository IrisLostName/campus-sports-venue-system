<script setup lang="ts">
// 系统提示（UI-2a-rulings 第 1 节）：每条带“公告”标签；.item 只放标题文字。
import type { NoticeView } from '../../utils/displayModel'
import UiGlassCard from '../ui/UiGlassCard.vue'

defineProps<{ notices: NoticeView[] }>()
</script>

<template>
  <UiGlassCard
    tag="section"
    class="notices display-panel"
    material="solid"
    radius="sm"
  >
    <h3 class="title display-panel-title">
      系统提示
    </h3>
    <ul
      v-if="notices.length > 0"
      class="list"
    >
      <li
        v-for="notice in notices"
        :key="notice.id"
        class="notice"
      >
        <span class="badge">公告</span>
        <span class="item">{{ notice.title }}</span>
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
.list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.notice {
  display: flex;
  align-items: center;
  gap: 0.6em;
  padding: 0.45em 0;
}

.notice + .notice {
  border-top: 1px dashed var(--color-separator);
}

.badge {
  flex: none;
  padding: 0.05em 0.5em;
  border-radius: var(--radius-sm);
  background: var(--display-soft-accent);
  color: var(--color-accent);
  font-size: 1em;
}

.item {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 1.1em;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty {
  margin: 0;
  color: var(--color-text-secondary);
}
</style>
