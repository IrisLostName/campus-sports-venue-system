<script setup lang="ts">
// 卡片（docs/17 第 6 节）。material 为 solid 时用实色 --color-surface（管理端表格与长表单）；其余三档是玻璃。
// tag 决定实际元素（section / article / li / form…），其余属性与监听器落到该元素上。
import { computed } from 'vue'

export type CardMaterial = 'thin' | 'regular' | 'thick' | 'solid'
export type CardPadding = 0 | 2 | 3 | 4 | 5 | 6 | 8
export type CardRadius = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

const props = withDefaults(defineProps<{
  tag?: string
  material?: CardMaterial
  padding?: CardPadding
  radius?: CardRadius
}>(), {
  tag: 'div',
  material: 'regular',
  padding: 4,
  radius: 'xl',
})

const classes = computed(() => [
  `ui-glass-card--${props.material}`,
  `ui-glass-card--pad-${props.padding}`,
  `ui-glass-card--radius-${props.radius}`,
  props.material === 'solid' ? [] : ['ui-glass', `ui-glass--${props.material}`],
])
</script>

<template>
  <component
    :is="tag"
    class="ui-glass-card"
    :class="classes"
  >
    <slot />
  </component>
</template>

<style scoped>
.ui-glass-card {
  min-width: 0;
}

.ui-glass-card--solid {
  background: var(--color-surface);
  border: 1px solid var(--color-separator);
}

.ui-glass-card--pad-0 { padding: 0; }
.ui-glass-card--pad-2 { padding: var(--space-2); }
.ui-glass-card--pad-3 { padding: var(--space-3); }
.ui-glass-card--pad-4 { padding: var(--space-4); }
.ui-glass-card--pad-5 { padding: var(--space-5); }
.ui-glass-card--pad-6 { padding: var(--space-6); }
.ui-glass-card--pad-8 { padding: var(--space-8); }

.ui-glass-card--radius-sm { border-radius: var(--radius-sm); }
.ui-glass-card--radius-md { border-radius: var(--radius-md); }
.ui-glass-card--radius-lg { border-radius: var(--radius-lg); }
.ui-glass-card--radius-xl { border-radius: var(--radius-xl); }
.ui-glass-card--radius-2xl { border-radius: var(--radius-2xl); }
</style>
