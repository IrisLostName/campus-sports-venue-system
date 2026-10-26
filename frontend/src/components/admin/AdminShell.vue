<script setup lang="ts">
// 管理端共用外壳（FE-5 S1、S4；docs/08 第 5 节；UI-2b Arco Design Pro 观感）：左侧边栏 + 顶栏，内容区由插槽提供。
// 侧栏顶部是图标方块、端名与项目名；导航项前有线性图标（aria-hidden，名称由文字提供），选中项浅主色底 + 主色文字与图标。
// 顶栏显示当前页面名（与标签页标题同取路由的 meta.title），其后是工具栏插槽、当前登录人与退出登录。
// 导航项由调用方传入：场馆管理员端传七项，FE-6 传自己的一组。外壳不调接口。
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { APP_NAME, pageTitleOf } from '../../router/titles'
import { useAuthStore } from '../../stores/auth'
import type { AdminNavItem } from '../../utils/adminNav'
import LogoutButton from '../LogoutButton.vue'
import UiIcon from '../ui/UiIcon.vue'

defineProps<{ brand: string; items: AdminNavItem[] }>()

// 分组标题（FE-6 S2）：条目带 group 且与前一条不同组时，在它前面显示一次标题；不带 group 的导航没有标题。
function headingBefore(items: AdminNavItem[], index: number): string | null {
  const group = items[index]?.group
  return group !== undefined && group !== items[index - 1]?.group ? group : null
}

const auth = useAuthStore()
const route = useRoute()
const userName = computed(() => auth.user?.displayName ?? '')
const pageTitle = computed(() => pageTitleOf(route))
</script>

<template>
  <div
    class="admin-shell"
    data-surface="admin"
  >
    <aside class="sidebar ui-glass">
      <div class="brand-block">
        <span class="logo">
          <UiIcon name="court" />
        </span>
        <div class="brand-text">
          <p class="brand">
            {{ brand }}
          </p>
          <p class="app-name">
            {{ APP_NAME }}
          </p>
        </div>
      </div>
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
            <UiIcon
              v-if="item.icon !== undefined"
              class="nav-icon"
              :name="item.icon"
            />
            <span class="nav-label">{{ item.label }}</span>
          </RouterLink>
        </template>
      </nav>
    </aside>
    <div class="main">
      <header class="topbar ui-glass">
        <p
          v-if="pageTitle !== null"
          class="page-name"
        >
          {{ pageTitle }}
        </p>
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
  grid-template-columns: var(--admin-sidebar-width) minmax(0, 1fr);
  min-height: 100vh;
  background: var(--color-canvas);
  color: var(--color-text);
}

/* 侧栏与顶栏是实色表面（令牌把 .ui-glass 变为实色、无模糊），只留一条分隔线，不要阴影。 */
.sidebar {
  position: sticky;
  top: 0;
  align-self: start;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow-y: auto;
  border-radius: 0;
  border-block: 0;
  border-inline-start: 0;
  box-shadow: none;
}

.brand-block {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--admin-header-height);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-separator);
}

.logo {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--color-accent-fill);
  color: var(--on-accent);
  font-size: 18px;
}

.brand-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.brand {
  font: var(--font-headline);
}

.app-name {
  overflow: hidden;
  color: var(--color-text-secondary);
  font: var(--font-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-2) var(--space-4);
}

.group {
  padding: var(--space-3) var(--space-3) var(--space-1);
  color: var(--color-text-secondary);
  font: var(--font-caption);
  font-weight: 600;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 40px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font: var(--font-callout);
  text-decoration: none;
  transition:
    background var(--motion-fast) var(--ease-standard),
    color var(--motion-fast) var(--ease-standard);
}

.nav-icon {
  font-size: 18px;
}

.nav-item:hover {
  background: var(--admin-fill-2);
  color: var(--color-text);
}

.nav-item.active {
  background: var(--admin-soft-accent);
  color: var(--color-accent);
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
  gap: var(--space-5);
  min-height: var(--admin-header-height);
  padding: var(--space-2) var(--space-5);
  border-radius: 0;
  border-block-start: 0;
  border-inline: 0;
  box-shadow: none;
}

.page-name {
  flex: none;
  font: var(--font-headline);
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
  padding: var(--space-5);
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
