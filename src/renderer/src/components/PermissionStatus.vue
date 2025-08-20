<template>
  <div class="permission-status">
    <div class="permissions-grid">
      <div class="permission-item">
        <div class="permission-content">
          <span class="permission-name">アクセシビリティ権限</span>
          <span class="permission-desc">ウィンドウの操作に必要</span>
        </div>
        <span class="tag" :class="accessibilityStatus ? 'is-success' : 'is-danger'">
          {{ accessibilityStatus ? '許可済み' : '未許可' }}
        </span>
      </div>

      <div class="permission-item">
        <div class="permission-content">
          <span class="permission-name">画面録画権限</span>
          <span class="permission-desc">画面情報の取得に必要</span>
        </div>
        <span class="tag" :class="screenRecordingStatus ? 'is-success' : 'is-danger'">
          {{ screenRecordingStatus ? '許可済み' : '未許可' }}
        </span>
      </div>
    </div>

    <div class="action-section">
      <button
        class="button is-primary is-small"
        @click="checkPermissions"
        :class="{ 'is-loading': isChecking }"
      >
        権限状態を更新
      </button>
      <button
        class="button is-info is-small"
        @click="openSystemPreferences"
        v-if="!accessibilityStatus || !screenRecordingStatus"
      >
        システム環境設定を開く
      </button>
    </div>

    <div class="warning-section" v-if="!accessibilityStatus || !screenRecordingStatus">
      <div class="notification is-warning is-small">
        <strong>権限が不足しています</strong>
        <p>システム環境設定から権限を許可してください。</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const accessibilityStatus = ref<boolean>(false)
const screenRecordingStatus = ref<boolean>(false)
const isChecking = ref<boolean>(false)

const checkPermissions = async () => {
  isChecking.value = true
  try {
    const result = await window.electron.ipcRenderer.invoke('checkPermissions')
    if (result) {
      accessibilityStatus.value = result.accessibility
      screenRecordingStatus.value = result.screenRecording
    }
  } catch (error) {
    console.error('Permission check failed:', error)
  } finally {
    isChecking.value = false
  }
}

const openSystemPreferences = () => {
  window.electron.ipcRenderer.send('openSystemPreferences')
}

onMounted(() => {
  checkPermissions()
})
</script>

<style scoped>
.permission-status {
  margin-bottom: 1.5rem;
}

.title {
  color: #ffffff !important;
  margin-bottom: 1rem !important;
}

.permissions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

@media (max-width: 768px) {
  .permissions-grid {
    grid-template-columns: 1fr;
  }
}

.permission-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.permission-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.permission-name {
  color: #ffffff;
  font-weight: 600;
  font-size: 0.9rem;
}

.permission-desc {
  color: #a0a0a0;
  font-size: 0.8rem;
}

.action-section {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.warning-section {
  margin-top: 0.5rem;
}

.notification.is-small {
  padding: 0.75rem;
  font-size: 0.875rem;
}

.notification.is-small p {
  margin-top: 0.25rem;
  margin-bottom: 0;
}
</style>
