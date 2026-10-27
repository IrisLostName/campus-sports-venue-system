<script setup lang="ts">
// 品牌图形（P2-1 已定事项第 5 条，A2）：蓝底 + 黄绿网球，与 public/favicon.svg 同一图形。装饰用，aria-hidden，名称由旁边的文字提供。
// 颜色取品牌令牌（--brand-*，固定不随深浅色变化）；尺寸随容器（100%）。
</script>

<template>
  <svg
    class="brand-mark"
    viewBox="0 0 32 32"
    aria-hidden="true"
    focusable="false"
  >
    <rect
      width="32"
      height="32"
      rx="7"
      class="tile"
    />
    <circle
      cx="16"
      cy="16"
      r="9.5"
      class="ball"
    />
    <path
      d="M9.3 9.3c3.6 3.6 3.6 9.8 0 13.4M22.7 9.3c-3.6 3.6-3.6 9.8 0 13.4"
      class="seam"
      fill="none"
      stroke-width="2"
      stroke-linecap="round"
    />
  </svg>
</template>

<style scoped>
.brand-mark {
  display: block;
  width: 100%;
  height: 100%;
}

.tile {
  fill: var(--brand-tile);
}

.ball {
  fill: var(--brand-ball);
}

.seam {
  stroke: var(--brand-tile);
}
</style>
