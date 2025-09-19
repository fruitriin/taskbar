<template>
  <div class="main-permission-status">
    <!-- 権限が不足している場合のみ表示 -->
    <button v-if="!allPermissionsGranted" class="button permission-warning" @click="openSettings">
      ⚠️ 権限設定
    </button>

    <!-- すべての権限がある場合は何も表示しない -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const accessibilityStatus = ref<boolean>(true)
const screenRecordingStatus = ref<boolean>(true)

const allPermissionsGranted = computed(() => {
  return accessibilityStatus.value && screenRecordingStatus.value
})

const checkPermissions = async (): Promise<void> => {
  try {
    const result = await window.electron.ipcRenderer.invoke('checkPermissions')
    if (result) {
      accessibilityStatus.value = result.accessibility
      screenRecordingStatus.value = result.screenRecording
    }
  } catch (error) {
    console.error('Permission check failed:', error)
  }
}

const openSettings = (): void => {
  window.electron.ipcRenderer.send('openOption')
}

onMounted(() => {
  checkPermissions()

  // 権限が不足している場合のみ定期的にチェック（2分間隔）
  setInterval(() => {
    if (!allPermissionsGranted.value) {
      checkPermissions()
    }
  }, 120000) // 2分間隔に変更
})
</script>

<style scoped>
.main-permission-status {
  display: flex;
  align-items: center;
  justify-content: center;
}

.permission-warning {
  background-color: #f59e0b !important;
  border-color: #d97706 !important;
  color: white !important;
  font-weight: bold;
  font-size: 0.875rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.permission-warning:hover {
  background-color: #d97706 !important;
}
</style>
