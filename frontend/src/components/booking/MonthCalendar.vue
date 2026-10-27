<script setup lang="ts">
// 订场第二层的月历（UI-3 裁决第 1 节第二层、第 4 节第 1 条）：从今天起滚动 31 天，周一为每周第一天，不翻页。
// 只有 days 里 bookable 的日期可选（由 advanceDays 决定）；其余置灰（aria-disabled，仍可聚焦），并以 aria-describedby 指向简短说明。
// 键盘：漫游焦点（同一时刻只有一个日期格 tabindex=0），方向键、Home/End、PageUp/PageDown 移动（composables/calendarKeys），
// Enter/空格选择。漫游焦点所在的格带 data-autofocus，BookingLayer 打开或重新露出时聚焦它。
import { computed, ref, useId, watch } from 'vue'

import { nextFocusIndex, useGridFocus } from '../../composables/calendarKeys'
import {
  bookableHint, calendarWeeks, mondayIndex, rangeText, WEEKDAY_HEADERS, type CalendarDay,
} from '../../utils/bookingCalendar'

const props = defineProps<{ days: CalendarDay[]; selected: string | null; advanceDays: number }>()

const emit = defineEmits<{ select: [date: string] }>()

const hintId = useId()
const { bindRoot, focusAt } = useGridFocus()

const indexByValue = computed(() => new Map(props.days.map((day, index) => [day.value, index])))
const weeks = computed(() => calendarWeeks(props.days))

function initialIndex(): number {
  const selected = props.selected === null ? undefined : indexByValue.value.get(props.selected)
  if (selected !== undefined) {
    return selected
  }
  return Math.max(props.days.findIndex((day) => day.bookable), 0)
}

const focusIndex = ref(initialIndex())

watch(() => props.days, () => {
  focusIndex.value = initialIndex()
})

watch(() => props.selected, (value) => {
  const index = value === null ? undefined : indexByValue.value.get(value)
  if (index !== undefined) {
    focusIndex.value = index
  }
})

function indexOf(day: CalendarDay): number {
  return indexByValue.value.get(day.value) ?? -1
}

function choose(day: CalendarDay): void {
  focusIndex.value = indexOf(day)
  if (day.bookable) {
    emit('select', day.value)
  }
}

async function onKeydown(event: { key: string; preventDefault: () => void }): Promise<void> {
  const current = props.days[focusIndex.value]
  if (current === undefined) {
    return
  }
  const next = nextFocusIndex(focusIndex.value, event.key, props.days.length, mondayIndex(current.value))
  if (next === null) {
    return
  }
  event.preventDefault()
  focusIndex.value = next
  await focusAt(next)
}
</script>

<template>
  <div
    :ref="bindRoot"
    class="calendar"
  >
    <p class="range">
      {{ rangeText(days) }}
    </p>
    <div
      role="grid"
      class="grid"
      aria-label="日期"
      @keydown="onKeydown"
    >
      <div
        role="row"
        class="row"
      >
        <span
          v-for="header in WEEKDAY_HEADERS"
          :key="header"
          role="columnheader"
          class="weekday"
        >{{ header }}</span>
      </div>
      <div
        v-for="(week, row) in weeks"
        :key="row"
        role="row"
        class="row"
      >
        <span
          v-for="(day, column) in week"
          :key="day?.value ?? `blank-${row}-${column}`"
          role="gridcell"
          class="slot"
          :aria-selected="day !== null && day.value === selected ? 'true' : undefined"
        >
          <button
            v-if="day !== null"
            type="button"
            class="day"
            :class="{ off: !day.bookable, selected: day.value === selected }"
            :data-date="day.value"
            :data-index="indexOf(day)"
            :data-autofocus="indexOf(day) === focusIndex ? '' : undefined"
            :tabindex="indexOf(day) === focusIndex ? 0 : -1"
            :aria-label="day.ariaLabel"
            :aria-disabled="day.bookable ? undefined : 'true'"
            :aria-describedby="day.bookable ? undefined : hintId"
            @click="choose(day)"
            @focus="focusIndex = indexOf(day)"
          >
            <span
              v-if="day.monthLabel !== null"
              class="month"
            >{{ day.monthLabel }}</span>
            <span class="number">{{ day.dayOfMonth }}</span>
          </button>
        </span>
      </div>
    </div>
    <p
      :id="hintId"
      class="legend"
    >
      <span
        class="swatch"
        aria-hidden="true"
      />
      {{ bookableHint(advanceDays) }}
    </p>
  </div>
</template>

<style scoped>
.calendar {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.range {
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}

.grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--space-1);
}

.weekday {
  color: var(--color-text-secondary);
  font: var(--font-caption);
  text-align: center;
}

.slot {
  display: flex;
  justify-content: center;
}

/* 日期格：至少 44×44（docs/17 第 4 节触控）。可选的日期用成功色浅底，置灰的只用分隔线色与次要文字。 */
.day {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--color-success) 45%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-success) var(--tint-strength), transparent);
  color: var(--color-text);
  cursor: pointer;
  transition:
    transform var(--motion-fast) var(--ease-standard),
    background var(--motion-fast) var(--ease-standard);
}

.day:active:not(.off) {
  transform: scale(var(--press-scale));
}

.day.off {
  border-color: transparent;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: not-allowed;
}

.day.selected {
  border-color: var(--color-accent-fill);
  background: var(--color-accent-fill);
  color: var(--on-accent);
}

.month {
  font: var(--font-caption);
  line-height: 1;
}

.number {
  font: var(--font-callout);
  font-weight: 600;
}

.day.off .number {
  font-weight: 400;
}

.legend {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}

.swatch {
  flex: none;
  width: 14px;
  height: 14px;
  border: 1px solid color-mix(in srgb, var(--color-success) 45%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--color-success) var(--tint-strength), transparent);
}
</style>
