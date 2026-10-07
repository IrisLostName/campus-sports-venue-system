<script setup lang="ts">
import { ACTION_LABELS, type ReservationAction, type ReservationCard } from '../../utils/reservationDisplay'

defineProps<{
  card: ReservationCard
  busy: boolean          // 有任何操作进行中：所有按钮不可点
  working: boolean       // 本卡片的操作进行中
  feedback: string | null
}>()

defineEmits<{ action: [action: ReservationAction] }>()
</script>

<template>
  <article
    class="card"
    :data-status="card.displayStatus"
  >
    <header class="head">
      <h2>{{ card.place }}</h2>
      <span class="badge">{{ card.statusLabel }}</span>
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

    <section
      v-if="card.adminNote !== null"
      class="admin-note"
      aria-label="管理员说明"
    >
      <h3>管理员说明</h3>
      <p>{{ card.adminNote }}</p>
    </section>

    <ul
      v-if="card.checkInNote !== null && card.cancelNote !== null"
      class="notes"
    >
      <li>签到：{{ card.checkInNote }}</li>
      <li>取消：{{ card.cancelNote }}</li>
    </ul>

    <p
      v-if="feedback !== null"
      class="feedback"
      role="alert"
    >
      {{ feedback }}
    </p>

    <div
      v-if="card.actions.length > 0"
      class="actions"
    >
      <button
        v-for="action in card.actions"
        :key="action"
        type="button"
        class="action"
        :class="{ danger: action === 'CANCEL' }"
        :disabled="busy"
        @click="$emit('action', action)"
      >
        {{ working ? '处理中…' : ACTION_LABELS[action] }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.card {
  margin: 0 0 12px;
  padding: 14px 16px;
  border: 1px solid #dde3ea;
  border-radius: 12px;
  background: #ffffff;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

h2 {
  margin: 0;
  font-size: 17px;
  line-height: 1.4;
}

.badge {
  flex: none;
  padding: 2px 10px;
  border-radius: 999px;
  background: #e3f2ec;
  color: #0b6b4f;
  font-size: 13px;
  line-height: 1.6;
}

[data-status='CANCELLED'] .badge,
[data-status='ADMIN_CANCELLED'] .badge,
[data-status='NO_SHOW'] .badge {
  background: #f1f4f8;
  color: #5f6b7a;
}

.rows {
  margin: 10px 0 0;
}

.rows div {
  display: flex;
  gap: 12px;
  padding: 4px 0;
  font-size: 15px;
}

dt {
  flex: none;
  width: 3.5em;
  color: #5f6b7a;
}

dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}

.admin-note {
  margin-top: 10px;
  padding: 10px 12px;
  border-left: 4px solid #d98200;
  border-radius: 6px;
  background: #fff4e0;
}

.admin-note h3 {
  margin: 0 0 4px;
  color: #8a4b00;
  font-size: 14px;
}

.admin-note p {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.notes {
  margin: 10px 0 0;
  padding: 0;
  color: #5f6b7a;
  font-size: 13px;
  line-height: 1.6;
  list-style: none;
}

.feedback {
  margin: 10px 0 0;
  color: #b3261e;
  font-size: 14px;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.action {
  flex: 1;
  min-height: 44px;
  border: 1px solid #0b6b4f;
  border-radius: 8px;
  background: #0b6b4f;
  color: #ffffff;
  font-size: 16px;
  cursor: pointer;
}

.action.danger {
  border-color: #b3261e;
  background: #ffffff;
  color: #b3261e;
}

.action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
