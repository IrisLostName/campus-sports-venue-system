<script setup lang="ts">
import ClientDock from '../../components/ClientDock.vue'
</script>

<template>
  <div class="stage">
    <div class="phone">
      <main class="content">
        <RouterView />
      </main>
      <ClientDock />
    </div>
  </div>
</template>

<style scoped>
/* iPhone 16 竖屏逻辑宽度 393px：窄屏撑满，桌面居中。Dock 悬浮在这一列的底部；
   内容区自己滚动，并在底部留出 Dock 高度 + 悬浮间距 + 安全区，滚到底时最后一项也在 Dock 之上（ACC-M2-10）。 */
.stage {
  display: flex;
  justify-content: center;
  min-height: 100vh;
}

.phone {
  position: relative;
  width: 100%;
  max-width: var(--phone-width);
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

.content {
  height: 100%;
  overflow-y: auto;
  padding-bottom: calc(var(--dock-height) + var(--dock-offset) + env(safe-area-inset-bottom) + var(--space-4));
}

@media (min-width: 394px) {
  .phone {
    border-inline: 1px solid var(--color-separator);
  }
}
</style>
