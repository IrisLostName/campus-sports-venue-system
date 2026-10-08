<script setup lang="ts">
import { ACTION_LABELS, type ReservationAction, type ReservationCard } from '../../utils/reservationDisplay'
import { toneForDisplayStatus } from '../../utils/statusTone'
import UiBanner from '../ui/UiBanner.vue'
import UiButton from '../ui/UiButton.vue'
import UiGlassCard from '../ui/UiGlassCard.vue'
import UiStatusPill from '../ui/UiStatusPill.vue'

defineProps<{
  card: ReservationCard
  busy: boolean          // 有任何操作进行中：所有按钮不可点
  working: boolean       // 本卡片的操作进行中
  feedback: string | null
}>()

defineEmits<{ action: [action: ReservationAction] }>()
</script>

<template>
  <UiGlassCard
    tag="article"
    class="card"
    :data-status="card.displayStatus"
  >
    <header class="head">
      <h2>{{ card.place }}</h2>
      <UiStatusPill
        class="badge"
        :tone="toneForDisplayStatus(card.displayStatus)"
      >
        {{ card.statusLabel }}
      </UiStatusPill>
    </header>

    <dl class="rows">
      <div>
        <dt>日期</dt>
        <dd>{{ card.dateText }}</dd>
      </div>
      <div>
        <dt>时间</dt>
        <dd>{{ card.timeText }}</dd>
      </div>
      <div>
        <dt>预约人</dt>
        <dd>{{ card.userDisplayName }}</dd>
      </div>
      <div v-if="card.purpose !== null">
        <dt>用途</dt>
        <dd>{{ card.purpose }}</dd>
      </div>
    </dl>

    <UiBanner
      v-if="card.adminNote !== null"
      tag="section"
      class="admin-note"
      tone="warning"
      aria-label="管理员说明"
    >
      <h3>管理员说明</h3>
      <p>{{ card.adminNote }}</p>
    </UiBanner>

    <ul
      v-if="card.checkInNote !== null && card.cancelNote !== null"
      class="notes"
    >
      <li>签到：{{ card.checkInNote }}</li>
      <li>取消：{{ card.cancelNote }}</li>
    </ul>

    <UiBanner
      v-if="feedback !== null"
      class="feedback"
      tone="danger"
      role="alert"
    >
      {{ feedback }}
    </UiBanner>

    <div
      v-if="card.actions.length > 0"
      class="actions"
    >
      <UiButton
        v-for="action in card.actions"
        :key="action"
        class="action"
        :variant="action === 'CANCEL' ? 'destructive' : 'primary'"
        :disabled="busy"
        @click="$emit('action', action)"
      >
        {{ working ? '处理中…' : ACTION_LABELS[action] }}
      </UiButton>
    </div>
  </UiGlassCard>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

h2 {
  font: var(--font-headline);
}

.badge {
  flex: none;
}

.rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.rows div {
  display: flex;
  gap: var(--space-3);
  font: var(--font-callout);
}

dt {
  flex: none;
  width: 3.5em;
  color: var(--color-text-secondary);
}

dd {
  min-width: 0;
  overflow-wrap: anywhere;
}

.admin-note h3 {
  font: var(--font-footnote);
  font-weight: 600;
}

.admin-note p {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.notes {
  margin: 0;
  padding: 0;
  color: var(--color-text-secondary);
  font: var(--font-footnote);
  list-style: none;
}

.actions {
  display: flex;
  gap: var(--space-2);
}

.action {
  flex: 1;
}
</style>
