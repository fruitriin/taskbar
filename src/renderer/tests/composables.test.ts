import { describe, it, expect, beforeEach } from 'bun:test'
import { ipcInvoke, ipcListen, ipcSend } from '../src/composables/ipc'
import { useOptions, __resetOptionsForTest } from '../src/composables/useOptions'
import { useWindows, __resetWindowsForTest } from '../src/composables/useWindows'
import type { Options } from '../src/composables/useOptions'

// テストごとに差し替えるローカルな window.electron モック
type Listener = (...args: unknown[]) => void
function installIpcMock(): {
  listeners: Map<string, Listener[]>
  sent: [string, ...unknown[]][]
  emit: (channel: string, payload: unknown) => void
} {
  const listeners = new Map<string, Listener[]>()
  const sent: [string, ...unknown[]][] = []
  // setup.ts が writable で定義済みのため、defineProperty ではなく代入で差し替える
  ;(window as unknown as Record<string, unknown>).electron = {
    ipcRenderer: {
      on: (channel: string, listener: Listener): void => {
        listeners.set(channel, [...(listeners.get(channel) ?? []), listener])
      },
      removeListener: (channel: string, listener: Listener): void => {
        listeners.set(
          channel,
          (listeners.get(channel) ?? []).filter((l) => l !== listener)
        )
      },
      send: (channel: string, ...args: unknown[]): void => {
        sent.push([channel, ...args])
      },
      invoke: async (channel: string, ...args: unknown[]): Promise<unknown> => {
        sent.push([`invoke:${channel}`, ...args])
        return 'invoke-result'
      }
    }
  }
  return {
    listeners,
    sent,
    emit: (channel, payload): void => {
      for (const listener of listeners.get(channel) ?? []) listener({}, payload)
    }
  }
}

describe('ipc ラッパー', () => {
  it('ipcListen はペイロードだけをハンドラに渡し、解除関数でリスナーが外れる', () => {
    const mock = installIpcMock()
    const received: unknown[] = []
    const unlisten = ipcListen<string>('greet', (payload) => received.push(payload))

    mock.emit('greet', 'hello')
    expect(received).toEqual(['hello'])

    unlisten()
    mock.emit('greet', 'again')
    expect(received).toEqual(['hello']) // 解除後は届かない
    expect(mock.listeners.get('greet')).toEqual([])
  })

  it('ipcSend は引数を JSON クローンして送る（reactivity proxy を剥がす）', () => {
    const mock = installIpcMock()
    const original = { nested: { value: 1 } }
    ipcSend('save', original)
    const [channel, sentArg] = mock.sent[0]
    expect(channel).toBe('save')
    expect(sentArg).toEqual(original)
    expect(sentArg).not.toBe(original) // 参照が切れている
  })

  it('ipcInvoke はチャンネルと引数をそのまま委譲し結果を返す', async () => {
    const mock = installIpcMock()
    const result = await ipcInvoke<string>('query', 1, 'a')
    expect(result).toBe('invoke-result')
    expect(mock.sent[0]).toEqual(['invoke:query', 1, 'a'])
  })
})

describe('useWindows', () => {
  beforeEach(() => {
    __resetWindowsForTest()
  })

  it('初回呼び出しで windowReady を1回だけ送り、process イベントで更新される', () => {
    const mock = installIpcMock()
    const { windows } = useWindows()
    useWindows() // 2回目
    const readyCount = mock.sent.filter(([ch]) => ch === 'windowReady').length
    expect(readyCount).toBe(1) // 多重送信しない（main 側のグローバル副作用防止）
    expect(mock.listeners.get('process')?.length).toBe(1)

    mock.emit('process', [{ kCGWindowOwnerName: 'A', kCGWindowNumber: 1 }])
    expect(windows.value).toHaveLength(1)
  })

  it('シングルトン: 複数回呼んでも同じ ref が返る', () => {
    installIpcMock()
    const first = useWindows()
    const second = useWindows()
    expect(first.windows).toBe(second.windows)
  })
})

describe('useOptions', () => {
  beforeEach(() => {
    __resetOptionsForTest()
  })

  it('window.store.options から初期化され、旧ストアに無いキーは default で補完される', () => {
    installIpcMock()
    // appOrder を持たない旧ストアを模す（setup.ts が writable で定義済みのため代入で差し替え）
    ;(window as unknown as Record<string, unknown>).store = {
      granted: true,
      options: { layout: 'left', windowSortByPositionInApp: true, headers: [], footers: [] },
      labeledFilters: []
    }
    const { options } = useOptions()
    expect(options.value.layout).toBe('left')
    expect(options.value.windowSortByPositionInApp).toBe(true)
    expect(options.value.appOrder).toEqual([]) // default 補完
  })

  it('updateOptions は楽観反映して setOptions を送る', () => {
    const mock = installIpcMock()
    const { options, updateOptions } = useOptions()
    updateOptions({ appOrder: ['A', 'B'] })

    expect(options.value.appOrder).toEqual(['A', 'B']) // 即時反映
    const [channel, payload] = mock.sent[0]
    expect(channel).toBe('setOptions')
    expect((payload as Options).appOrder).toEqual(['A', 'B'])
    // 部分更新でも全体がマージされて送られる
    expect(payload as Options).toHaveProperty('layout')
  })

  it('updateOptions イベント受信で options が更新される', () => {
    const mock = installIpcMock()
    const { options } = useOptions()
    mock.emit('updateOptions', {
      layout: 'right',
      windowSortByPositionInApp: false,
      appOrder: ['X'],
      headers: [],
      footers: []
    })
    expect(options.value.layout).toBe('right')
    expect(options.value.appOrder).toEqual(['X'])
  })

  it('シングルトン: 2回呼んでも同じ ref が返り、リスナーは重複登録されない', () => {
    const mock = installIpcMock()
    const first = useOptions()
    const second = useOptions()
    expect(first.options).toBe(second.options)
    expect(mock.listeners.get('updateOptions')?.length).toBe(1)
  })
})
