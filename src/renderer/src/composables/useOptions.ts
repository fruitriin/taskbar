// 永続化オプションの composable（リアーキ Phase 1 スライス 1-A）
// Phase 1 では Electron IPC 経由で electron-store と同期する。
// モジュールシングルトン: 全ビューが同じ options を参照する。
import { ref } from 'vue'
import type { Ref } from 'vue'
import { ipcListen, ipcSend } from './ipc'
import type { Store } from '../utils'

export type Options = Store['options']

const defaultOptions: Options = {
  layout: 'bottom',
  windowSortByPositionInApp: false,
  appOrder: [],
  headers: [],
  footers: []
}

const options: Ref<Options> = ref({ ...defaultOptions })
let initialized = false
let unlisten: (() => void) | null = null

export function useOptions(): {
  options: Ref<Options>
  updateOptions: (partial: Partial<Options>) => void
} {
  if (!initialized) {
    initialized = true
    // preload が注入する window.store から初期値を得る（旧ストアに無いキーは default で補完）
    if (window.store?.options) {
      options.value = { ...defaultOptions, ...window.store.options }
    }
    // メインプロセスからの設定更新を受信（モジュール寿命のリスナーなので解除不要だが、
    // テスト用リセットのために保持する）
    // 注意: Vite HMR でこのモジュールが再評価されると旧リスナーが残留しうる。
    // 開発中に「設定が古い値に戻る」現象が出たらここを疑う（本番ビルドには影響なし）
    unlisten = ipcListen<Options>('updateOptions', (payload) => {
      options.value = { ...defaultOptions, ...payload }
    })
  }

  // 楽観反映してから setOptions を送る（IPC 往復待ちの表示揺れ防止。既存実装の慣習）
  function updateOptions(partial: Partial<Options>): void {
    const merged = { ...options.value, ...partial }
    options.value = merged
    ipcSend('setOptions', merged)
  }

  return { options, updateOptions }
}

// テスト専用: モジュールシングルトンを初期状態に戻す
export function __resetOptionsForTest(): void {
  unlisten?.()
  unlisten = null
  initialized = false
  options.value = { ...defaultOptions }
}
