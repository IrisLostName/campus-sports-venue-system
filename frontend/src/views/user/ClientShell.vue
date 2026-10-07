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
/* iPhone 16 竖屏逻辑宽度 393px：窄屏撑满，桌面居中。内容区滚动，Dock 是同一列里的固定一行，不会遮挡内容。 */
.stage {
  display: flex;
  justify-content: center;
  min-height: 100vh;
  background: #e8ecf1;
}

.phone {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 393px;
  height: 100vh;
  height: 100dvh;
  background: #f7f9fb;
}

.content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
</style>
