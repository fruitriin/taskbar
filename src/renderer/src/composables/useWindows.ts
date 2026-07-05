// ウィンドウリストの composable（リアーキ Phase 1 スライス 1-A）
// モジュールシングルトン: 同一ウィンドウ内で複数コンポーネントが呼んでも
// リスナー登録と windowReady 送信は1回だけ行う。
// windowReady はメインプロセス側で macWindowProcesses のリセットという
// グローバル副作用を持つため、二重送信してはならない（計画整合レビュー指摘 W#1）。
import { ref } from 'vue'
import type { Ref } from 'vue'
import { ipcListen, ipcSend } from './ipc'

const windows: Ref<MacWindow[]> = ref([])
let initialized = false
let unlisten: (() => void) | null = null

export function useWindows(): { windows: Ref<MacWindow[]> } {
  if (!initialized) {
    initialized = true
    unlisten = ipcListen<MacWindow[]>('process', (payload) => {
      windows.value = payload
    })
    // windowReady プロトコル: メインプロセスが初期データ一式を送ってくる
    ipcSend('windowReady')
  }
  return { windows }
}

// テスト専用: モジュールシングルトンを初期状態に戻す
export function __resetWindowsForTest(): void {
  unlisten?.()
  unlisten = null
  initialized = false
  windows.value = []
}
