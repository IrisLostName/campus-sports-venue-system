<script setup lang="ts">
// 发布场馆公告表单（FE-5 P6）：标题 ≤100、内容 ≤2000（docs/13），可选过期时间（datetime-local）。长表单用实色表面。
import type { AnnouncementForm } from '../../../composables/adminAnnouncements'
import { CONTENT_MAX_LENGTH, TITLE_MAX_LENGTH } from '../../../utils/announcementDisplay'
import UiBanner from '../../ui/UiBanner.vue'
import UiButton from '../../ui/UiButton.vue'
import UiGlassCard from '../../ui/UiGlassCard.vue'
import UiTextField from '../../ui/UiTextField.vue'

const form = defineModel<AnnouncementForm>('form', { required: true })

defineProps<{ error: string | null; busy: boolean }>()

defineEmits<{ publish: [] }>()
</script>

<template>
  <UiGlassCard
    tag="form"
    material="solid"
    radius="lg"
    class="form"
    aria-label="发布场馆公告"
    @submit.prevent="$emit('publish')"
  >
    <h2 class="heading">
      发布场馆公告
    </h2>
    <UiTextField
      v-model="form.title"
      label="标题"
      :maxlength="TITLE_MAX_LENGTH"
      counter
    />
    <UiTextField
      v-model="form.content"
      label="内容"
      control="textarea"
      rows="4"
      :maxlength="CONTENT_MAX_LENGTH"
      counter
    />
    <UiTextField
      v-model="form.expiresAt"
      label="过期时间（可选）"
      type="datetime-local"
    />
    <UiBanner
      v-if="error"
      tone="danger"
      role="alert"
    >
      {{ error }}
    </UiBanner>
    <div>
      <UiButton
        type="submit"
        :loading="busy"
      >
        发布
      </UiButton>
    </div>
  </UiGlassCard>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.heading {
  font: var(--font-headline);
}
</style>
