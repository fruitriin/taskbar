<template>
  <div class="menu-container">
    <div class="menu-list">
      <button class="menu-item" @click="openOption">
        <span class="icon">
          <i class="fas fa-cog"></i>
        </span>
        <span class="label">設定</span>
      </button>

      <button class="menu-item" @click="openWindowManager">
        <span class="icon">
          <i class="fas fa-window-restore"></i>
        </span>
        <span class="label">ウィンドウマネージャー</span>
      </button>

      <div class="divider"></div>

      <button class="menu-item" @click="restart">
        <span class="icon">
          <i class="fas fa-sync-alt"></i>
        </span>
        <span class="label">再起動</span>
      </button>

      <button class="menu-item danger" @click="exit">
        <span class="icon">
          <i class="fas fa-times-circle"></i>
        </span>
        <span class="label">終了</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// Font Awesome は旧 HTML の CDN link から self-host 化（オフライン動作・CSP 緩和不要）
import '@fortawesome/fontawesome-free/css/all.min.css'
import { ipcSend } from '../composables/ipc'

function closeMenu(): void {
  ipcSend('closeMenu')
}

function openOption(): void {
  ipcSend('openOption')
  closeMenu()
}

function openWindowManager(): void {
  ipcSend('openFullWindowList')
  closeMenu()
}

function restart(): void {
  ipcSend('restart')
}

function exit(): void {
  ipcSend('exit')
}
</script>

<style lang="scss" scoped>
.menu-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: hsl(0, 0%, 21%);
  padding: 0.5rem;
  overflow: hidden;
  box-sizing: border-box;
}

.menu-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow: hidden;
}

.menu-item {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 0.75rem;
  padding: 0.875rem 1rem !important;
  background-color: hsl(0, 0%, 21%);
  border: solid 2px hsl(0, 0%, 71%) !important;
  border-radius: 6px;
  color: #ffffff !important;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
  white-space: nowrap;

  &:hover {
    background: hsl(0, 0%, 25%);
    border-color: #4a90e2;
    border-left-width: 6px;
    padding-left: calc(1rem - 4px);
    box-shadow: 0 2px 8px rgba(74, 144, 226, 0.3);
  }

  &:active {
    border-left-width: 5px;
    padding-left: calc(1rem - 3px);
  }

  &.danger {
    &:hover {
      background: #d32f2f;
      border-color: #f44336;
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(244, 67, 54, 0.4);
    }
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    font-size: 1.125rem;
    color: #4a90e2 !important;
    flex-shrink: 0;
  }

  &.danger .icon {
    color: #ff6b6b !important;
  }

  .label {
    flex: 1;
    font-weight: 500;
    letter-spacing: 0.3px;
    color: #ffffff;
    line-height: 1;
  }
}

.divider {
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, #555 50%, transparent 100%);
  margin: 0.5rem 0;
}
</style>

<style>
/* 旧 Menu.vue ラッパーから移設（このビューは bulma を読み込まない） */
* {
  box-sizing: border-box;
}

html,
body,
#app {
  margin: 0;
  padding: 0;
  overflow: hidden !important;
}
</style>
