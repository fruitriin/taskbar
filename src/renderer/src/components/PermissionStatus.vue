<template>
  <div class="permission-status">
    <h3 class="title is-5">システム権限</h3>
    
    <div class="field">
      <div class="columns is-mobile">
        <div class="column">
          <div class="permission-item">
            <div class="permission-name">
              <strong>アクセシビリティ権限</strong>
              <p class="help">ウィンドウの操作に必要です</p>
            </div>
            <div class="permission-status-badge">
              <span class="tag" :class="accessibilityStatus ? 'is-success' : 'is-danger'">
                {{ accessibilityStatus ? '許可済み' : '未許可' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="field">
      <div class="columns is-mobile">
        <div class="column">
          <div class="permission-item">
            <div class="permission-name">
              <strong>画面録画権限</strong>
              <p class="help">画面情報の取得に必要です</p>
            </div>
            <div class="permission-status-badge">
              <span class="tag" :class="screenRecordingStatus ? 'is-success' : 'is-danger'">
                {{ screenRecordingStatus ? '許可済み' : '未許可' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="field" v-if="!accessibilityStatus || !screenRecordingStatus">
      <div class="notification is-warning">
        <strong>権限が不足しています</strong>
        <p>アプリが正常に動作するためには、すべての権限が必要です。</p>
      </div>
    </div>

    <div class="field">
      <div class="buttons">
        <button 
          class="button is-primary" 
          @click="checkPermissions"
          :class="{ 'is-loading': isChecking }"
        >
          権限状態を更新
        </button>
        <button 
          class="button is-info" 
          @click="openSystemPreferences"
          v-if="!accessibilityStatus || !screenRecordingStatus"
        >
          システム環境設定を開く
        </button>
      </div>
    </div>

    <div class="field" v-if="!accessibilityStatus || !screenRecordingStatus">
      <div class="content">
        <h4>権限を許可する手順：</h4>
        <ol>
          <li>「システム環境設定を開く」ボタンをクリック</li>
          <li>「プライバシーとセキュリティ」を選択</li>
          <li v-if="!accessibilityStatus">「アクセシビリティ」でTaskbar.fmにチェックを入れる</li>
          <li v-if="!screenRecordingStatus">「画面録画」でTaskbar.fmにチェックを入れる</li>
          <li>「権限状態を更新」ボタンで確認</li>
        </ol>
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
  margin-bottom: 2rem;
}

.permission-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
}

.permission-name {
  flex: 1;
}

.permission-status-badge {
  flex-shrink: 0;
}

.help {
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.buttons {
  margin-top: 1rem;
}

.content ol {
  padding-left: 1.5rem;
}

.content li {
  margin-bottom: 0.5rem;
}
</style>