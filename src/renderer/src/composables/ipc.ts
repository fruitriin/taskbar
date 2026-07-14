// IPC の薄い抽象化レイヤー（Phase 1 で導入、Phase 3.4 で Tauri 対応）
// 実行環境で backend を自動選択する:
//   1. Tauri（__TAURI_INTERNALS__ あり）— 本命。チャンネル名を snake_case コマンドへ変換
//   2. モック（window.electron）— ブラウザ開発・テスト時に mocks/electron-mocks.ts が
//      注入する（Electron 本体は Phase 3 で全廃。命名は互換 API 形状のため意図的に残置）
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// Electron チャンネル名（camelCase）→ Tauri コマンド名（snake_case）
// モック経路のブリッジ取得。Tauri でもなくモックも無い環境（本番 Web 等）では
// 明示的に throw して原因を分かりやすくする（window.electron は optional 型）
function mockIpc(): NonNullable<Window['electron']>['ipcRenderer'] {
  const bridge = window.electron
  if (!bridge) {
    throw new Error('[ipc] no backend: not running under Tauri and no mock injected')
  }
  return bridge.ipcRenderer
}

function toCommand(channel: string): string {
  return channel.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

// 位置引数 → Tauri の名前付き引数への変換表。
// キー名の真実源は src-tauri/src/commands.rs の関数シグネチャ（Tauri が camelCase 化する）
const ARG_KEYS: Record<string, string> = {
  setOptions: 'options',
  setLabeledFilters: 'filters',
  addFilter: 'payload',
  activeWindow: 'win',
  closeWindow: 'win',
  contextTask: 'win'
}

function toArgs(channel: string, args: unknown[]): Record<string, unknown> | undefined {
  const key = ARG_KEYS[channel]
  return key !== undefined && args.length > 0 ? { [key]: args[0] } : undefined
}

export async function ipcInvoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  if (isTauri) {
    return invoke<T>(toCommand(channel), toArgs(channel, args))
  }
  return mockIpc().invoke(channel, ...args) as Promise<T>
}

// 解除関数を返す。コンポーネントの onUnmounted で必ず呼ぶこと
export function ipcListen<T>(channel: string, handler: (payload: T) => void): () => void {
  if (isTauri) {
    // Tauri の listen は Promise を返すため、解除関数は解決後に有効化される
    let unlisten: (() => void) | undefined
    let cancelled = false
    listen<T>(channel, (event) => handler(event.payload)).then((fn) => {
      if (cancelled) fn()
      else unlisten = fn
    })
    return (): void => {
      cancelled = true
      unlisten?.()
    }
  }
  // 第1引数はモックが渡す IpcRendererEvent 相当（型は unknown で十分）
  const listener = (_event: unknown, ...args: unknown[]): void => {
    handler(args[0] as T)
  }
  const ipc = mockIpc()
  ipc.on(channel, listener)
  return (): void => {
    ipc.removeListener(channel, listener)
  }
}

export function ipcSend(channel: string, ...args: unknown[]): void {
  if (isTauri) {
    // Tauri に fire-and-forget は無いため、戻り値を待たない invoke で代替。
    // 失敗はログに残す（送りっぱなし前提のチャンネルのため UI には返さない）
    void invoke(toCommand(channel), toArgs(channel, args)).catch((e) =>
      console.error(`[ipc] ${channel} failed:`, e)
    )
    return
  }
  // Vue の reactivity proxy を IPC 境界で剥がす（utils.ts の Electron.send と同じ理由）
  mockIpc().send(channel, ...JSON.parse(JSON.stringify(args)))
}
