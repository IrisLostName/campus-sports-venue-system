<script setup lang="ts">
// 管理端共用外壳（FE-5 S1、S4；docs/08 第 5 节、docs/17 第 7 节）：侧栏 + 顶栏是玻璃（管理端模糊），内容区由插槽提供。
// 导航项由调用方传入：场馆管理员端传七项，FE-6 传自己的一组。外壳不调接口，只显示当前登录人并提供退出登录。
import { computed } from 'vue'

import { useAuthStore } from '../../stores/auth'
import type { AdminNavItem } from '../../utils/adminNav'
import LogoutButton from '../LogoutButton.vue'

defineProps<{ brand: string; items: AdminNavItem[] }>()

// 分组标题（FE-6 S2）：条目带 group 且与前一条不同组时，在它前面显示一次标题；不带 group 的导航没有标题。
function headingBefore(items: AdminNavItem[], index: number): string | null {
  const group = items[index]?.group
  return group !== undefined && group !== items[index - 1]?.group ? group : null
}

const auth = useAuthStore()
const userName = computed(() => auth.user?.displayName ?? '')
</script>

<template>
  <div
    class="admin-shell"
    data-surface="admin"
  >
    <aside class="sidebar ui-glass">
      <p class="brand">
        {{ brand }}
      </p>
      <nav
        class="nav"
        aria-label="管理端导航"
      >
        <template
          v-for="(item, index) in items"
          :key="item.label"
        >
          <p
            v-if="headingBefore(items, index) !== null"
            class="group"
          >
            {{ headingBefore(items, index) }}
          </p>
          <RouterLink
            :to="item.to"
            class="nav-item"
            exact-active-class="active"
          >
            {{ item.label }}
          </RouterLink>
        </template>
      </nav>
    </aside>
    <div class="main">
      <header class="topbar ui-glass">
        <div class="toolbar">
          <slot name="toolbar" />
        </div>
        <span class="user">{{ userName }}</span>
        <LogoutButton />
      </header>
      <main class="content">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-shell {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  min-height: 100vh;
}

.sidebar {
  position: sticky;
  top: 0;
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  height: 100vh;
  padding: var(--space-5) var(--space-3);
  border-radius: 0;
  border-block: 0;
  border-inline-start: 0;
}

.brand {
  padding-inline: var(--space-3);
  font: var(--font-title);
}

.nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.group {
  padding: var(--space-3) var(--space-3) var(--space-1);
  color: var(--color-text-secondary);
  font: var(--font-footnote);
  font-weight: 600;
}

.nav-item {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font: var(--font-callout);
  text-decoration: none;
  transition: background var(--motion-fast) var(--ease-standard);
}

.nav-item.active {
  background: color-mix(in srgb, var(--color-accent) var(--tint-strength), transparent);
  font-weight: 600;
}

.main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: var(--z-dock);
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-6);
  border-radius: 0;
  border-block-start: 0;
  border-inline: 0;
}

.toolbar {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
}

.user {
  color: var(--color-text-secondary);
}

.content {
  padding: var(--space-6);
}

@media (max-width: 899px) {
  .admin-shell {
    grid-template-columns: minmax(0, 1fr);
  }

  .sidebar {
    position: static;
    height: auto;
  }

  .nav {
    flex-flow: row wrap;
  }
}
</style>
