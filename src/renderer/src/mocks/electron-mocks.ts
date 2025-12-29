/**
 * Electron API mocks for browser testing and development
 * ブラウザでの開発・テスト用のElectron APIモック
 */

import { sampleWindows, sampleIcons, sampleDisplayInfo } from './sample-fixture'

// リスナーを管理するためのストレージ
type Listener = (...args: unknown[]) => void
const listeners = new Map<string, Set<Listener>>()

/**
 * イベントリスナーを追加
 */
const addListener = (channel: string, listener: Listener) => {
  if (!listeners.has(channel)) {
    listeners.set(channel, new Set())
  }
  listeners.get(channel)!.add(listener)
}

/**
 * イベントリスナーを削除
 */
const removeListener = (channel: string, listener: Listener) => {
  listeners.get(channel)?.delete(listener)
}

/**
 * イベントを発火
 */
const emit = (channel: string, ...args: unknown[]) => {
  const channelListeners = listeners.get(channel)
  if (channelListeners) {
    // IpcRendererEventのモック（最小限の実装）
    const event = { sender: {}, senderId: 0 }
    channelListeners.forEach((listener) => {
      try {
        listener(event, ...args)
      } catch (error) {
        console.error(`[Mock] Error in listener for ${channel}:`, error)
      }
    })
  }
}

/**
 * windowReady送信後に自動的にイベントを発火
 */
const handleWindowReady = () => {
  console.log('[Mock] Triggering initial events after windowReady')

  // 少し遅延させてから発火（実際のIPCを模倣）
  setTimeout(() => {
    emit('process', sampleWindows)
  }, 100)

  setTimeout(() => {
    emit('iconUpdate', sampleIcons)
  }, 200)

  setTimeout(() => {
    emit('displayInfo', sampleDisplayInfo)
  }, 300)

  setTimeout(() => {
    emit('updateOptions', {
      layout: 'bottom',
      windowSortByPositionInApp: false,
      headers: [],
      footers: []
    })
  }, 400)
}

export const createElectronMock = () => ({
  ipcRenderer: {
    on: (channel: string, listener: Listener) => {
      console.log(`[Mock] ipcRenderer.on: ${channel}`)
      addListener(channel, listener)
      return () => removeListener(channel, listener) // cleanup function
    },
    send: (channel: string, ...args: unknown[]) => {
      console.log(`[Mock] ipcRenderer.send: ${channel}`, args)

      // windowReadyが送信されたら、自動的にイベントを発火
      if (channel === 'windowReady') {
        handleWindowReady()
      }

      // getExcludeWindowsが送信されたら、除外ウィンドウデータを返す
      if (channel === 'getExcludeWindows') {
        setTimeout(() => {
          emit('allProcesses', sampleWindows)
          emit('catchExcludeWindow', [])
        }, 100)
      }

      // その他のコマンドは単にログを出力（必要に応じて拡張可能）
      const noOpCommands = [
        'activeWindow',
        'contextTask',
        'contextLogo',
        'openOption',
        'openFullWindowList',
        'closeMenu',
        'restartHelper',
        'grantPermission',
        'clearSetting',
        'restart',
        'exit',
        'dumpTaskbarInfo',
        'setOptions',
        'setLabeledFilters',
        'addFilter'
      ]

      if (noOpCommands.includes(channel)) {
        console.log(`[Mock] ${channel} command executed (no-op in mock mode)`)
      }
    },
    removeListener: (channel: string, listener: Listener) => {
      console.log(`[Mock] ipcRenderer.removeListener: ${channel}`)
      removeListener(channel, listener)
    },
    invoke: async (channel: string, ...args: unknown[]) => {
      console.log(`[Mock] ipcRenderer.invoke: ${channel}`, args)
      return null
    }
  }
})

export const createStoreMock = () => ({
  granted: true,
  options: {
    layout: 'bottom',
    windowSortByPositionInApp: false,
    headers: [],
    footers: []
  },
  filters: [],
  labeledFilters: [
    {
      label: 'オフスクリーンウィンドウを除外',
      filters: [{ property: 'kCGWindowIsOnscreen', is: false }]
    },
    {
      label: '名無しを除外',
      filters: [{ property: 'kCGWindowName', is: '' }]
    },
    {
      label: 'Dockを除外',
      filters: [{ property: 'kCGWindowOwnerName', is: 'Dock' }]
    },
    {
      label: 'DockHelperを除外',
      filters: [{ property: 'kCGWindowOwnerName', is: 'DockHelper' }]
    },
    {
      label: 'スクリーンキャプチャを除外',
      filters: [{ property: 'kCGWindowOwnerName', is: 'screencapture' }]
    },
    {
      label: 'スクリーンショットアプリを除外',
      filters: [{ property: 'kCGWindowOwnerName', is: 'スクリーンショット' }]
    },
    {
      label: '通知センターを除外',
      filters: [{ property: 'kCGWindowName', is: 'Notification Center' }]
    },
    {
      label: '通知センター（日本語）を除外',
      filters: [{ property: 'kCGWindowOwnerName', is: '通知センター' }]
    },
    {
      label: 'Item-0を除外',
      filters: [{ property: 'kCGWindowName', is: 'Item-0' }]
    },
    {
      label: 'Window Serverを除外',
      filters: [{ property: 'kCGWindowOwnerName', is: 'Window Server' }]
    },
    {
      label: 'コントロールセンターを除外',
      filters: [{ property: 'kCGWindowOwnerName', is: 'コントロールセンター' }]
    },
    {
      label: 'Spotlightを除外',
      filters: [{ property: 'kCGWindowOwnerName', is: 'Spotlight' }]
    },
    {
      label: 'Google日本語入力を除外',
      filters: [{ property: 'kCGWindowOwnerName', is: 'GoogleJapaneseInputRenderer' }]
    },
    {
      label: 'Taskbar.fmアプリを除外',
      filters: [{ property: 'kCGWindowOwnerName', is: 'taskbar.fm' }]
    },
    {
      label: 'Taskbar.fmウィンドウを除外',
      filters: [{ property: 'kCGWindowName', is: 'taskbar.fm' }]
    },
    {
      label: '空のFinderウィンドウを除外',
      filters: [
        { property: 'kCGWindowOwnerName', is: 'Finder' },
        { property: 'kCGWindowName', is: '' }
      ]
    }
  ]
})

/**
 * Inject mocks into window object if Electron APIs are not available
 * Electron APIが利用できない場合、windowオブジェクトにモックを注入
 */
export const injectElectronMocks = () => {
  if (typeof window === 'undefined') return

  // window.electron のモック
  if (!window.electron) {
    Object.defineProperty(window, 'electron', {
      value: createElectronMock(),
      writable: true,
      configurable: true
    })
    console.log('[Mock] Injected window.electron mock')
  }

  // window.store のモック
  if (!window.store) {
    Object.defineProperty(window, 'store', {
      value: createStoreMock(),
      writable: true,
      configurable: true
    })
    console.log('[Mock] Injected window.store mock')
  }

  // 開発者向けヘルパー関数（ブラウザコンソールから使用可能）
  if (import.meta.env.DEV) {
    ;(window as any).__mockHelpers = {
      emit,
      triggerWindowReady: handleWindowReady,
      updateWindows: (windows: unknown[]) => emit('process', windows),
      updateIcons: (icons: Record<string, string>) => emit('iconUpdate', icons),
      sampleWindows,
      sampleIcons,
      sampleDisplayInfo
    }
    console.log(
      '[Mock] Development helpers available at window.__mockHelpers\n' +
        'Examples:\n' +
        '  __mockHelpers.emit("process", __mockHelpers.sampleWindows)\n' +
        '  __mockHelpers.updateWindows([...])\n' +
        '  __mockHelpers.triggerWindowReady()'
    )
  }
}
