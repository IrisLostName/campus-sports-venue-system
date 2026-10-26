<script setup lang="ts">
// 用户端浮动 Dock（docs/17 第 6、7 节）：胶囊形玻璃，悬浮在安全区之上。
// 相对最近的定位祖先摆放（ClientShell 的手机列），所以页面内容必须自己留出 --dock-height + --dock-offset + 安全区的底部空间（ACC-M2-10）。
// 条目由使用处放进插槽，条目需要带 dock-item 类；当前项再加 active 类。
defineProps<{ label: string }>()
</script>

<template>
  <nav
    class="ui-dock ui-glass"
    :aria-label="label"
  >
    <slot />
  </nav>
</template>

<style scoped>
.ui-dock {
  position: absolute;
  bottom: calc(var(--dock-offset) + env(safe-area-inset-bottom));
  left: 50%;
  z-index: var(--z-dock);
  display: flex;
  gap: 2px;
  max-width: calc(100% - 2 * var(--space-4));
  height: var(--dock-height);
  padding: var(--space-1);
  border-radius: var(--radius-capsule);
  transform: translateX(-50%);
}

.ui-dock :slotted(.dock-item) {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 68px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-capsule);
  color: var(--color-text-secondary);
  font: var(--font-caption);
  font-weight: 600;
  text-decoration: none;
  transition: background var(--motion-fast) var(--ease-standard);
}

.ui-dock :slotted(.dock-item.active) {
  background: color-mix(in srgb, var(--color-accent) var(--tint-strength), transparent);
  color: var(--color-text);
}
</style>
