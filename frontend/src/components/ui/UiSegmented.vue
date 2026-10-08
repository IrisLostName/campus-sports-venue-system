<script setup lang="ts">
// 分段控件（docs/17 第 6 节）：登录/注册切换、日期条、管理端标签。
// mode=tabs 时是 tablist + role=tab + aria-selected；mode=pressed 时是 group + aria-pressed。
// itemClass 与 valueAttribute 让页面保留原有的选择器（例如日期条的 .day 与 data-date）。
export interface SegmentedItem {
  value: string
  label: string
  sub?: string
}

withDefaults(defineProps<{
  items: SegmentedItem[]
  label: string
  mode?: 'tabs' | 'pressed'
  layout?: 'capsule' | 'scroll'
  itemClass?: string
  valueAttribute?: string
}>(), {
  mode: 'pressed',
  layout: 'capsule',
  itemClass: undefined,
  valueAttribute: 'data-value',
})

const model = defineModel<string | null>({ required: true })
</script>

<template>
  <div
    class="ui-segmented"
    :class="[`ui-segmented--${layout}`, layout === 'capsule' ? ['ui-glass', 'ui-glass--thin'] : []]"
    :role="mode === 'tabs' ? 'tablist' : 'group'"
    :aria-label="label"
  >
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      class="item"
      :class="[itemClass, { active: item.value === model }]"
      :role="mode === 'tabs' ? 'tab' : undefined"
      :aria-selected="mode === 'tabs' ? item.value === model : undefined"
      :aria-pressed="mode === 'pressed' ? item.value === model : undefined"
      :[valueAttribute]="item.value"
      @click="model = item.value"
    >
      <span class="label">{{ item.label }}</span>
      <span
        v-if="item.sub !== undefined"
        class="sub"
      >{{ item.sub }}</span>
    </button>
  </div>
</template>

<style scoped>
.ui-segmented {
  display: flex;
  gap: var(--space-1);
}

.ui-segmented--capsule {
  padding: var(--space-1);
  border-radius: var(--radius-capsule);
}

.ui-segmented--scroll {
  gap: var(--space-2);
  padding-bottom: var(--space-1);
  overflow-x: auto;
}

.item {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: var(--space-2) var(--space-4);
  border: 0;
  background: transparent;
  color: var(--color-text);
  font: var(--font-callout);
  font-weight: 500;
  cursor: pointer;
  transition:
    background var(--motion-fast) var(--ease-standard),
    transform var(--motion-fast) var(--ease-standard);
}

.item:active {
  transform: scale(var(--press-scale));
}

.ui-segmented--capsule .item {
  border-radius: var(--radius-capsule);
}

.ui-segmented--capsule .item.active {
  background: var(--color-surface);
  box-shadow: var(--glass-shadow);
  font-weight: 600;
}

/* 卡片式的日期条：每项自带玻璃底，选中时换成强调色。 */
.ui-segmented--scroll .item {
  flex: none;
  min-width: 64px;
  min-height: 56px;
  border-radius: var(--radius-lg);
  background: var(--glass-thin);
  border: var(--glass-border);
}

.ui-segmented--scroll .item.active {
  background: var(--color-accent-fill);
  border-color: transparent;
  color: var(--on-accent);
}

.label {
  font-weight: 600;
}

.sub {
  font: var(--font-footnote);
}
</style>
