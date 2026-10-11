<script setup lang="ts">
import { REASON_MAX_LENGTH } from '../../utils/fieldLimits'
import type { ReservationCard } from '../../utils/reservationDisplay'
import UiButton from '../ui/UiButton.vue'
import UiSheet from '../ui/UiSheet.vue'
import UiTextField from '../ui/UiTextField.vue'

defineProps<{ target: ReservationCard; busy: boolean }>()

const reason = defineModel<string>('reason', { required: true })

defineEmits<{ confirm: []; dismiss: [] }>()
</script>

<template>
  <UiSheet
    open
    title="确认取消预约？"
    :busy="busy"
    @dismiss="$emit('dismiss')"
  >
    <p class="what">
      {{ target.place }}<br>{{ target.dateText }} {{ target.timeText }}
    </p>
    <UiTextField
      v-model="reason"
      label="取消原因（可选）"
      control="textarea"
      rows="3"
      :maxlength="REASON_MAX_LENGTH"
    />
    <div class="buttons">
      <UiButton
        variant="secondary"
        class="button"
        @click="$emit('dismiss')"
      >
        再想想
      </UiButton>
      <UiButton
        variant="destructive"
        class="button"
        :disabled="busy"
        @click="$emit('confirm')"
      >
        确认取消
      </UiButton>
    </div>
  </UiSheet>
</template>

<style scoped>
.what {
  color: var(--color-text-secondary);
  font: var(--font-callout);
}

.buttons {
  display: flex;
  gap: var(--space-2);
}

.button {
  flex: 1;
}
</style>
