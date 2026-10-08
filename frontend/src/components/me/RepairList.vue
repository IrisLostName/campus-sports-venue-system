<script setup lang="ts">
import type { RepairView } from '../../utils/meDisplay'

defineProps<{ items: RepairView[]; loaded: boolean; error: string | null }>()

defineEmits<{ retry: [] }>()
</script>

<template>
  <section
    class="repairs"
    aria-label="我的报修"
  >
    <h3>我的报修</h3>
    <div
      v-if="error !== null"
      class="error"
      role="alert"
    >
      <p>报修记录加载失败：{{ error }}</p>
      <button
        type="button"
        @click="$emit('retry')"
      >
        重试
      </button>
    </div>
    <p
      v-else-if="loaded && items.length === 0"
      class="none"
    >
      暂无报修记录
    </p>
    <article
      v-for="item in items"
      :key="item.id"
      :data-status="item.status"
    >
      <header>
        <span class="venue">{{ item.venueName }}</span>
        <span class="badge">{{ item.statusLabel }}</span>
      </header>
      <p class="description">
        {{ item.description }}
      </p>
      <p
        v-if="item.resultNote !== null"
        class="result"
      >
        处理结果：{{ item.resultNote }}
      </p>
      <p class="time">
        {{ item.createdText }}
      </p>
    </article>
  </section>
</template>

<style scoped>
.repairs {
  margin-top: 16px;
}

h3 {
  margin: 0 0 8px;
  font-size: 16px;
}

article {
  margin-bottom: 8px;
  padding: 12px 14px;
  border: 1px solid #dde3ea;
  border-radius: 10px;
  background: #ffffff;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.venue {
  font-size: 15px;
  font-weight: 600;
}

.badge {
  flex: none;
  padding: 0 10px;
  border-radius: 999px;
  background: #e3f2ec;
  color: #0b6b4f;
  font-size: 13px;
  line-height: 1.6;
}

[data-status='SUBMITTED'] .badge {
  background: #fff4e0;
  color: #8a4b00;
}

p {
  margin: 4px 0 0;
}

.description,
.result {
  font-size: 14px;
  overflow-wrap: anywhere;
}

.result {
  color: #0b6b4f;
}

.time {
  color: #5f6b7a;
  font-size: 12px;
}

.none {
  color: #5f6b7a;
  font-size: 14px;
}

.error {
  color: #b3261e;
  font-size: 14px;
}
</style>
