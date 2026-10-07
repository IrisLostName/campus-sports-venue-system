<script setup lang="ts">
import type { AnnouncementItem } from '../../utils/reservationDisplay'

defineProps<{ items: AnnouncementItem[]; loaded: boolean; error: string | null }>()
</script>

<template>
  <section
    class="announcements"
    aria-label="系统公告"
  >
    <h2>系统公告</h2>
    <p
      v-if="error !== null"
      class="error"
      role="alert"
    >
      公告加载失败：{{ error }}
    </p>
    <p
      v-else-if="loaded && items.length === 0"
      class="none"
    >
      暂无公告
    </p>
    <article
      v-for="item in items"
      :key="item.id"
    >
      <h3>{{ item.title }}</h3>
      <p
        v-if="item.content !== null"
        class="content"
      >
        {{ item.content }}
      </p>
      <p class="time">
        {{ item.publishedText }}
      </p>
    </article>
  </section>
</template>

<style scoped>
.announcements {
  margin-top: 20px;
}

h2 {
  margin: 0 0 8px;
  font-size: 17px;
}

article {
  margin-bottom: 8px;
  padding: 12px 14px;
  border: 1px solid #dde3ea;
  border-radius: 10px;
  background: #ffffff;
}

h3 {
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
}

p {
  margin: 4px 0 0;
}

.content {
  color: #1f2933;
  font-size: 14px;
  overflow-wrap: anywhere;
}

.time {
  color: #5f6b7a;
  font-size: 12px;
}

.none,
.error {
  font-size: 14px;
}

.none {
  color: #5f6b7a;
}

.error {
  color: #b3261e;
}
</style>
