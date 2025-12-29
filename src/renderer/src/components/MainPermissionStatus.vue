<template>
  <div class="main-permission-status">
    <!-- ヘルパーがハングしている場合の警告 -->
    <button v-if="isHelperHanging" class="button helper-hanging-warning" @click="openSettings">
      🔴 ヘルパーがハング中 -
      再起動が必要（Taskbarの再起動で解決しない場合はMacを再起動してください）
    </button>

    <!-- 権限が不足している場合のみ表示（ハングしていない場合） -->
    <button
      v-else-if="!allPermissionsGranted"
      class="button permission-warning"
      @click="openSettings"
    >
      ⚠️ 権限設定
    </button>

    <!-- すべての権限がある場合は何も表示しない -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const accessibilityStatus = ref<boolean>(true)
const screenRecordingStatus = ref<boolean>(true)
const isHelperHanging = ref<boolean>(false)

const allPermissionsGranted = computed(() => {
  return accessibilityStatus.value && screenRecordingStatus.value
})

// タイムアウト付きでPromiseを実行する汎用関数
const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    })
  ])
}

const checkPermissions = async (): Promise<void> => {
  try {
    // 5秒のタイムアウトを設定
    const result = await withTimeout(window.electron.ipcRenderer.invoke('checkPermissions'), 5000)

    if (result) {
      accessibilityStatus.value = result.accessibility
      screenRecordingStatus.value = result.screenRecording
      // 正常にレスポンスが返ってきたらハング状態を解除
      isHelperHanging.value = false
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Timeout') {
      console.error('Permission check timed out - helper may be hanging')
      isHelperHanging.value = true
    } else {
      console.error('Permission check failed:', error)
    }
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

.helper-hanging-warning {
  background-color: #dc2626 !important;
  border-color: #b91c1c !important;
  color: white !important;
  font-weight: bold;
  font-size: 0.875rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.helper-hanging-warning:hover {
  background-color: #b91c1c !important;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
</style>
