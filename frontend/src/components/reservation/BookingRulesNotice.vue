<script setup lang="ts">
// UI-5 “预约”页固定的预约规则提醒：原为后端公告，现按负责人决定写死在页面上；样式同 /booking 的场馆公告（UiBanner warning）。
import UiBanner from '../ui/UiBanner.vue'

const rules = [
  '可预约今天起未来 7 天（含当天）的时段，每个时段 90 分钟。',
  '每人同时持有的未结束预约不超过 3 个。',
  '如需取消，请在开始前至少 120 分钟操作；临近开始无法自行取消。',
  '签到时间为开始前 15 分钟至开始后 15 分钟，请按时到场签到；使用结束后 30 分钟内可签退。',
  '请合理安排时间，尽量不要“订而不来”，把场地留给真正需要的同学。',
] as const
</script>

<template>
  <UiBanner
    tag="section"
    tone="warning"
    class="booking-rules"
    aria-label="预约规则提醒"
  >
    <h2>预约规则提醒</h2>
    <ol class="content">
      <li
        v-for="rule in rules"
        :key="rule"
      >
        {{ rule }}
      </li>
    </ol>
  </UiBanner>
</template>

<style scoped>
h2 {
  font: var(--font-callout);
  font-weight: 600;
}

/* 编号在外侧，折行与正文对齐（悬挂缩进）。 */
.content {
  margin: 0;
  padding-inline-start: 1.5em;
  list-style: decimal outside;
  font: var(--font-callout);
  overflow-wrap: anywhere;
}
</style>
