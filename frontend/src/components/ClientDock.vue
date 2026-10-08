<script setup lang="ts">
import { useRoute } from 'vue-router'

import { DOCK_ITEMS } from '../router/dock'
import { PATHS } from '../router/paths'
import UiDock from './ui/UiDock.vue'

const route = useRoute()

// 四个内联 SVG 图标（描边 24×24），按路径对应；只借鉴风格，不使用任何第三方图标。
const ICONS: Record<string, string> = {
  [PATHS.home]: 'M4 11l8-7 8 7v9H4z',
  [PATHS.reservation]: 'M8 3v4M16 3v4M4 10h16M7 5h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z',
  [PATHS.booking]: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 2',
  [PATHS.me]: 'M12 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 20c1.5-4 4.5-6 8-6s6.5 2 8 6',
}

function isActive(path: string): boolean {
  return path === PATHS.home ? route.path === PATHS.home : route.path === path || route.path.startsWith(`${path}/`)
}
</script>

<template>
  <UiDock label="主导航">
    <RouterLink
      v-for="item in DOCK_ITEMS"
      :key="item.path"
      :to="item.path"
      class="dock-item"
      :class="{ active: isActive(item.path) }"
    >
      <svg
        class="icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path :d="ICONS[item.path]" />
      </svg>
      <span>{{ item.label }}</span>
    </RouterLink>
  </UiDock>
</template>

<style scoped>
.icon {
  width: 22px;
  height: 22px;
}

/* 当前项：文字用主文字色（对比度），图标用强调色。 */
.dock-item.active .icon {
  color: var(--color-accent);
}
</style>
