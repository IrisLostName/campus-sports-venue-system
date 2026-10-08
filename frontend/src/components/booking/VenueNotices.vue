<script setup lang="ts">
import type { AnnouncementItem } from '../../utils/reservationDisplay'

defineProps<{ items: AnnouncementItem[]; error: string | null }>()
</script>

<template>
  <section
    v-if="items.length > 0 || error !== null"
    class="notices"
    aria-label="场馆公告"
  >
    <h2>场馆公告</h2>
    <p
      v-if="error !== null"
      class="error"
      role="alert"
    >
      公告加载失败：{{ error }}
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
.notices {
  margin-bottom: 16px;
}

h2 {
  margin: 0 0 8px;
  font-size: 16px;
}

article {
  margin-bottom: 8px;
  padding: 10px 14px;
  border-left: 4px solid #d98200;
  border-radius: 6px;
  background: #fff4e0;
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
  font-size: 14px;
  overflow-wrap: anywhere;
}

.time {
  color: #8a4b00;
  font-size: 12px;
}

.error {
  color: #b3261e;
  font-size: 14px;
}
</style>
