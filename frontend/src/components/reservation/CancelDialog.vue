<script setup lang="ts">
import type { ReservationCard } from '../../utils/reservationDisplay'

defineProps<{ target: ReservationCard; busy: boolean }>()

const reason = defineModel<string>('reason', { required: true })

defineEmits<{ confirm: []; dismiss: [] }>()
</script>

<template>
  <div
    class="backdrop"
    @click.self="$emit('dismiss')"
  >
    <div
      class="sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-title"
    >
      <h2 id="cancel-title">
        确认取消预约？
      </h2>
      <p class="what">
        {{ target.place }}<br>{{ target.dateText }} {{ target.timeText }}
      </p>
      <label>
        取消原因（可选）
        <textarea
          v-model="reason"
          rows="3"
        />
      </label>
      <div class="buttons">
        <button
          type="button"
          class="secondary"
          @click="$emit('dismiss')"
        >
          再想想
        </button>
        <button
          type="button"
          class="danger"
          :disabled="busy"
          @click="$emit('confirm')"
        >
          确认取消
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgb(0 0 0 / 40%);
}

.sheet {
  width: 100%;
  max-width: 393px;
  padding: 20px 16px calc(16px + env(safe-area-inset-bottom));
  border-radius: 16px 16px 0 0;
  background: #ffffff;
}

h2 {
  margin: 0 0 8px;
  font-size: 18px;
}

.what {
  margin: 0 0 12px;
  color: #5f6b7a;
  font-size: 15px;
  line-height: 1.5;
}

label {
  display: block;
  font-size: 14px;
}

textarea {
  display: block;
  width: 100%;
  margin-top: 6px;
  padding: 8px;
  border: 1px solid #c8d0da;
  border-radius: 8px;
  font: inherit;
  resize: vertical;
}

.buttons {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

button {
  flex: 1;
  min-height: 44px;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}

.secondary {
  border: 1px solid #c8d0da;
  background: #ffffff;
  color: #1f2933;
}

.danger {
  border: 1px solid #b3261e;
  background: #b3261e;
  color: #ffffff;
}

.danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
