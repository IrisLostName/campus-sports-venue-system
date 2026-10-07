<script setup lang="ts">
import type { NoticeView } from '../../utils/displayModel'

defineProps<{ notices: NoticeView[] }>()
</script>

<template>
  <section class="notices">
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
  </section>
</template>

<style scoped>
.notices {
  padding: 0.8em 1.2em 1em;
  background: var(--display-panel);
  border: 1px solid var(--display-border);
  border-radius: 0.6em;
}

.title {
  margin: 0 0 0.6em;
  font-size: 1.5em;
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
  font-size: 1.1em;
  line-height: 1.4;
  background: var(--display-tile);
  border-radius: 0.3em;
  overflow-wrap: anywhere;
}

.empty {
  margin: 0;
  color: var(--display-muted);
}
</style>
