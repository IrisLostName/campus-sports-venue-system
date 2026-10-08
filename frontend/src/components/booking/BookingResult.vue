<script setup lang="ts">
import { PATHS } from '../../router/paths'
import type { ReservationSummary } from '../../utils/reservationDisplay'

defineProps<{ result: ReservationSummary }>()

defineEmits<{ again: [] }>()
</script>

<template>
  <section
    class="result"
    aria-label="预约结果"
  >
    <h2>预约成功</h2>
    <dl class="rows">
      <div>
        <dt>地点</dt>
        <dd>{{ result.place }}</dd>
      </div>
      <div>
        <dt>日期</dt>
        <dd>{{ result.dateText }}</dd>
      </div>
      <div>
        <dt>时间</dt>
        <dd>{{ result.timeText }}</dd>
      </div>
      <div>
        <dt>状态</dt>
        <dd>{{ result.statusLabel }}</dd>
      </div>
    </dl>
    <div class="links">
      <RouterLink
        class="primary"
        :to="PATHS.reservation"
      >
        查看预约
      </RouterLink>
      <RouterLink
        class="secondary"
        :to="PATHS.home"
      >
        回到首页
      </RouterLink>
    </div>
    <button
      type="button"
      class="again"
      @click="$emit('again')"
    >
      继续订场
    </button>
  </section>
</template>

<style scoped>
.result {
  padding: 20px 16px;
  border: 1px solid #b7dccd;
  border-radius: 12px;
  background: #e3f2ec;
}

h2 {
  margin: 0 0 12px;
  color: #0b6b4f;
  font-size: 20px;
}

.rows {
  margin: 0 0 16px;
}

.rows div {
  display: flex;
  gap: 12px;
  padding: 4px 0;
  font-size: 15px;
}

dt {
  flex: none;
  width: 3em;
  color: #3d5a4f;
}

dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}

.links {
  display: flex;
  gap: 8px;
}

.links a {
  flex: 1;
  box-sizing: border-box;
  min-height: 44px;
  padding: 10px 0;
  border-radius: 8px;
  font-size: 16px;
  text-align: center;
  text-decoration: none;
}

.primary {
  border: 1px solid #0b6b4f;
  background: #0b6b4f;
  color: #ffffff;
}

.secondary {
  border: 1px solid #0b6b4f;
  background: #ffffff;
  color: #0b6b4f;
}

.again {
  display: block;
  width: 100%;
  min-height: 44px;
  margin-top: 8px;
  border: 0;
  background: transparent;
  color: #0b6b4f;
  font-size: 15px;
  cursor: pointer;
}
</style>
