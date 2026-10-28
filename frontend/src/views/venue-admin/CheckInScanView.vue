<script setup lang="ts">
// 扫码签到（P2-1c 裁决第 3 节；docs/12 第 5.7 节 POST /admin/check-ins）：场馆管理员端与系统管理员端共用这一页。
// 左侧摄像头预览（点击后才开启）；右侧扫码枪 / 手动输入、结果与最近记录。范围由后端按授权裁决，前端只显示后端错误。
import AdminPage from '../../components/admin/AdminPage.vue'
import ScanCamera from '../../components/admin/checkin/ScanCamera.vue'
import ScanCodeInput from '../../components/admin/checkin/ScanCodeInput.vue'
import ScanHistory from '../../components/admin/checkin/ScanHistory.vue'
import ScanResult from '../../components/admin/checkin/ScanResult.vue'
import UiGlassCard from '../../components/ui/UiGlassCard.vue'
import { useAdminCheckIn } from '../../composables/adminCheckIn'

const { busy, outcome, history, submit } = useAdminCheckIn()
</script>

<template>
  <AdminPage title="扫码签到">
    <div class="layout">
      <UiGlassCard
        tag="section"
        material="solid"
        radius="lg"
        class="panel"
        aria-label="摄像头扫码"
      >
        <h2 class="panel-title">
          对准用户手机上的签到码
        </h2>
        <ScanCamera
          :paused="busy"
          @code="submit"
        />
      </UiGlassCard>

      <div class="side">
        <UiGlassCard
          tag="section"
          material="solid"
          radius="lg"
          class="panel"
          aria-label="扫码枪或手动输入"
        >
          <h2 class="panel-title">
            扫码枪 / 手动输入
          </h2>
          <ScanCodeInput
            :busy="busy"
            @submit="submit"
          />
        </UiGlassCard>
        <UiGlassCard
          tag="section"
          material="solid"
          radius="lg"
          class="panel"
          aria-label="结果"
        >
          <h2 class="panel-title">
            结果
          </h2>
          <ScanResult :outcome="outcome" />
          <p class="note">
            签到码由用户的随机签到标识与预约 id 组成，固定不变、不含个人信息；与预约人对不上一律提示“签到码无效”。
          </p>
        </UiGlassCard>
        <UiGlassCard
          tag="section"
          material="solid"
          radius="lg"
          class="panel"
          aria-label="最近记录"
        >
          <h2 class="panel-title">
            最近记录
          </h2>
          <ScanHistory :entries="history" />
        </UiGlassCard>
      </div>
    </div>
  </AdminPage>
</template>

<style scoped>
.layout {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--space-4);
}

.side {
  display: flex;
  flex: 1 1 360px;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.panel-title {
  font: var(--font-headline);
}

.note {
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}
</style>
