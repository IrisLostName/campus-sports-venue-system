<script setup lang="ts">
import type { SlotGroup } from '../../utils/bookingDisplay'
import { toneForSlotStatus } from '../../utils/statusTone'
import UiGlassCard from '../ui/UiGlassCard.vue'

defineProps<{ groups: SlotGroup[] }>()

defineEmits<{ select: [resourceId: number, startTime: string] }>()
</script>

<template>
  <UiGlassCard
    v-for="group in groups"
    :key="group.resourceId"
    tag="section"
    class="group"
    :aria-label="group.resourceName"
  >
    <h3>{{ group.resourceName }}</h3>
    <div class="cells">
      <button
        v-for="cell in group.cells"
        :key="cell.startTime"
        type="button"
        class="cell"
        :class="[`tone-${toneForSlotStatus(cell.status)}`, { selected: cell.selected }]"
        :data-status="cell.status"
        :disabled="!cell.selectable"
        :aria-pressed="cell.selected"
        @click="$emit('select', group.resourceId, cell.startTime)"
      >
        <span class="time">{{ cell.timeText }}</span>
        <span class="label">{{ cell.label }}</span>
      </button>
    </div>
  </UiGlassCard>
</template>

<style scoped>
.group {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

h3 {
  font: var(--font-headline);
}

.cells {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

/* 时段按钮：状态色只用在浅色底与边线上，文字一律是 --color-text（docs/17 第 2 节对比度规则）。 */
.cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding: var(--space-2);
  border: 1px solid color-mix(in srgb, var(--cell-tone) 45%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--cell-tone) var(--tint-strength), transparent);
  color: var(--color-text);
  cursor: pointer;
  transition:
    transform var(--motion-fast) var(--ease-standard),
    background var(--motion-fast) var(--ease-standard);
}

.cell:active:not(:disabled) {
  transform: scale(var(--press-scale));
}

.cell:disabled {
  color: var(--color-text-secondary);
  cursor: not-allowed;
}

.cell.selected {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
}

.cell.tone-neutral:disabled {
  border-color: var(--color-separator);
}

.cell[data-status='MINE'] {
  color: var(--color-text);
  font-weight: 600;
}

.tone-accent { --cell-tone: var(--color-accent); }
.tone-success { --cell-tone: var(--color-success); }
.tone-warning { --cell-tone: var(--color-warning); }
.tone-danger { --cell-tone: var(--color-danger); }
.tone-neutral { --cell-tone: var(--color-neutral); }

.time {
  font: var(--font-callout);
  font-weight: 600;
}

.label {
  font: var(--font-footnote);
}
</style>
