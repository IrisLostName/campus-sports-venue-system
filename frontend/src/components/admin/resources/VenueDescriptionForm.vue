<script setup lang="ts">
// 场馆简介（FE-5 P3）：场馆管理员只能改 description（docs/12 第 5.5 节），这里不出现系统管理员才能改的字段。
import { VENUE_DESCRIPTION_MAX_LENGTH } from '../../../utils/fieldLimits'
import UiButton from '../../ui/UiButton.vue'
import UiGlassCard from '../../ui/UiGlassCard.vue'
import UiTextField from '../../ui/UiTextField.vue'

const description = defineModel<string>('description', { required: true })

defineProps<{ busy: boolean }>()

defineEmits<{ save: [] }>()
</script>

<template>
  <UiGlassCard
    tag="form"
    material="solid"
    radius="lg"
    class="stack-form"
    aria-label="场馆简介"
    @submit.prevent="$emit('save')"
  >
    <h2 class="section-heading">
      场馆简介
    </h2>
    <UiTextField
      v-model="description"
      label="简介"
      control="textarea"
      rows="3"
      :maxlength="VENUE_DESCRIPTION_MAX_LENGTH"
    />
    <div>
      <UiButton
        type="submit"
        :loading="busy"
      >
        保存简介
      </UiButton>
    </div>
  </UiGlassCard>
</template>
