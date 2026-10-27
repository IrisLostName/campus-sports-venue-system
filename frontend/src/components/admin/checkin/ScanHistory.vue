<script setup lang="ts">
// 最近的扫码记录（P2-1c 裁决第 3 节）：新的在前，至多 HISTORY_LIMIT 条（composables/adminCheckIn）。
import type { ScanHistoryEntry } from '../../../composables/adminCheckIn'

defineProps<{ entries: ScanHistoryEntry[] }>()
</script>

<template>
  <p
    v-if="entries.length === 0"
    class="empty"
  >
    暂无记录
  </p>
  <ol
    v-else
    class="history"
  >
    <li
      v-for="entry in entries"
      :key="entry.seq"
      :data-ok="entry.ok"
    >
      <span class="time">{{ entry.time }}</span>
      <span
        class="mark"
        :class="entry.ok ? 'ok' : 'err'"
      >{{ entry.title }}</span>
      <span class="summary">{{ entry.summary }}</span>
    </li>
  </ol>
</template>

<style scoped>
.empty {
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}

.history {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.history li {
  display: grid;
  grid-template-columns: 5.5em 7em 1fr;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-separator);
  font: var(--font-footnote);
}

.time {
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

.mark {
  font-weight: 600;
}

.mark.ok {
  color: var(--color-text);
}

.mark.err {
  color: var(--color-danger-text);
}

.summary {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
