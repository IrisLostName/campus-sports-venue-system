<script setup lang="ts">
import { PATHS } from '../../router/paths'
import UiButton from '../ui/UiButton.vue'
import UiEmptyState from '../ui/UiEmptyState.vue'
import UiGlassCard from '../ui/UiGlassCard.vue'
</script>

<template>
  <UiGlassCard
    tag="section"
    class="empty"
  >
    <UiEmptyState title="你还没有预约">
      <template #action>
        <UiButton :to="PATHS.booking">
          去订场
        </UiButton>
      </template>
    </UiEmptyState>
  </UiGlassCard>
</template>
