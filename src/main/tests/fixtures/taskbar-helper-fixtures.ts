/**
 * TaskbarHelperのデバッグ出力データをテスト用フィクスチャーとして提供
 *
 * 実際のTaskbarHelperプロセスから取得したデータを基に作成
 * 使用方法: `TaskbarHelper debug` コマンドの出力をここに格納
 */

export interface MacWindow {
  kCGWindowAlpha: number
  kCGWindowBounds: {
    Height: number
    Width: number
    X: number
    Y: number
  }
  kCGWindowIsOnscreen?: boolean
  kCGWindowLayer: number
  kCGWindowMemoryUsage: number
  kCGWindowName: string
  kCGWindowNumber: number
  kCGWindowOwnerName: string
  kCGWindowOwnerPID: number
  kCGWindowSharingState: number
  kCGWindowStoreType: number
  appIcon?: string
}

/**
 * 一般的なmacOSアプリケーションウィンドウのサンプル
 */
export const sampleAppWindows: MacWindow[] = [
  {
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      Height: 800,
      Width: 1200,
      X: 100,
      Y: 100
    },
    kCGWindowIsOnscreen: true,
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 2048000,
    kCGWindowName: 'Document1.txt',
    kCGWindowNumber: 12345,
    kCGWindowOwnerName: 'TextEdit',
    kCGWindowOwnerPID: 1234,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 2
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      Height: 900,
      Width: 1400,
      X: 200,
      Y: 150
    },
    kCGWindowIsOnscreen: true,
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 5120000,
    kCGWindowName: 'GitHub - Chrome',
    kCGWindowNumber: 12346,
    kCGWindowOwnerName: 'Google Chrome',
    kCGWindowOwnerPID: 2345,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 2
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      Height: 700,
      Width: 1000,
      X: 300,
      Y: 200
    },
    kCGWindowIsOnscreen: true,
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 3072000,
    kCGWindowName: 'Taskbar.fm - Code - Visual Studio Code',
    kCGWindowNumber: 12347,
    kCGWindowOwnerName: 'Code',
    kCGWindowOwnerPID: 3456,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 2
  }
]

/**
 * システムウィンドウ（フィルタリング対象）のサンプル
 */
export const systemWindows: MacWindow[] = [
  {
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      Height: 100,
      Width: 500,
      X: 0,
      Y: 0
    },
    kCGWindowIsOnscreen: true,
    kCGWindowLayer: 25,
    kCGWindowMemoryUsage: 512000,
    kCGWindowName: '',
    kCGWindowNumber: 10001,
    kCGWindowOwnerName: 'Dock',
    kCGWindowOwnerPID: 123,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 1
  },
  {
    kCGWindowAlpha: 0.95,
    kCGWindowBounds: {
      Height: 400,
      Width: 300,
      X: 1620,
      Y: 0
    },
    kCGWindowIsOnscreen: true,
    kCGWindowLayer: 25,
    kCGWindowMemoryUsage: 256000,
    kCGWindowName: 'Notification Center',
    kCGWindowNumber: 10002,
    kCGWindowOwnerName: 'NotificationCenter',
    kCGWindowOwnerPID: 234,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 1
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      Height: 60,
      Width: 600,
      X: 660,
      Y: 0
    },
    kCGWindowIsOnscreen: true,
    kCGWindowLayer: 24,
    kCGWindowMemoryUsage: 128000,
    kCGWindowName: '',
    kCGWindowNumber: 10003,
    kCGWindowOwnerName: 'コントロールセンター',
    kCGWindowOwnerPID: 345,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 1
  },
  {
    kCGWindowAlpha: 0.9,
    kCGWindowBounds: {
      Height: 400,
      Width: 600,
      X: 612,
      Y: 250
    },
    kCGWindowIsOnscreen: true,
    kCGWindowLayer: 101,
    kCGWindowMemoryUsage: 1024000,
    kCGWindowName: 'Spotlight',
    kCGWindowNumber: 10004,
    kCGWindowOwnerName: 'Spotlight',
    kCGWindowOwnerPID: 456,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 1
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      Height: 1,
      Width: 1,
      X: -1,
      Y: -1
    },
    kCGWindowIsOnscreen: false,
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 64000,
    kCGWindowName: 'Item-0',
    kCGWindowNumber: 10005,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowOwnerPID: 567,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 1
  }
]

/**
 * Finderウィンドウ（空のウィンドウを含む）
 */
export const finderWindows: MacWindow[] = [
  {
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      Height: 600,
      Width: 800,
      X: 400,
      Y: 300
    },
    kCGWindowIsOnscreen: true,
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 1536000,
    kCGWindowName: 'Documents',
    kCGWindowNumber: 11001,
    kCGWindowOwnerName: 'Finder',
    kCGWindowOwnerPID: 789,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 2
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      Height: 500,
      Width: 700,
      X: 500,
      Y: 400
    },
    kCGWindowIsOnscreen: true,
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 1024000,
    kCGWindowName: '', // 空のFinderウィンドウ（フィルタリング対象）
    kCGWindowNumber: 11002,
    kCGWindowOwnerName: 'Finder',
    kCGWindowOwnerPID: 789,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 2
  }
]

/**
 * 小さすぎるウィンドウ（サイズフィルタリング対象）
 */
export const tinyWindows: MacWindow[] = [
  {
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      Height: 20, // 40px未満（フィルタリング対象）
      Width: 100,
      X: 100,
      Y: 100
    },
    kCGWindowIsOnscreen: true,
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 32000,
    kCGWindowName: 'Tiny Window',
    kCGWindowNumber: 20001,
    kCGWindowOwnerName: 'TestApp',
    kCGWindowOwnerPID: 9001,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 2
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      Height: 100,
      Width: 30, // 40px未満（フィルタリング対象）
      X: 200,
      Y: 200
    },
    kCGWindowIsOnscreen: true,
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 32000,
    kCGWindowName: 'Narrow Window',
    kCGWindowNumber: 20002,
    kCGWindowOwnerName: 'TestApp',
    kCGWindowOwnerPID: 9002,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 2
  }
]

/**
 * Taskbar.fm関連ウィンドウ（自己除外対象）
 */
export const taskbarWindows: MacWindow[] = [
  {
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      Height: 60,
      Width: 1920,
      X: 0,
      Y: 1020
    },
    kCGWindowIsOnscreen: true,
    kCGWindowLayer: 20,
    kCGWindowMemoryUsage: 256000,
    kCGWindowName: 'taskbar.fm',
    kCGWindowNumber: 30001,
    kCGWindowOwnerName: 'taskbar.fm',
    kCGWindowOwnerPID: 8001,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 2
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      Height: 800,
      Width: 600,
      X: 660,
      Y: 140
    },
    kCGWindowIsOnscreen: true,
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 512000,
    kCGWindowName: 'Taskbar.fm 設定',
    kCGWindowNumber: 30002,
    kCGWindowOwnerName: 'taskbar.fm',
    kCGWindowOwnerPID: 8001,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 2
  }
]

/**
 * 開発者ツール関連（通常は除外したいウィンドウ）
 */
export const developerWindows: MacWindow[] = [
  {
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      Height: 800,
      Width: 1200,
      X: 100,
      Y: 100
    },
    kCGWindowIsOnscreen: true,
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 4096000,
    kCGWindowName: 'Taskbar.fm.xcworkspace',
    kCGWindowNumber: 40001,
    kCGWindowOwnerName: 'Xcode',
    kCGWindowOwnerPID: 7001,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 2
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      Height: 600,
      Width: 800,
      X: 1120,
      Y: 100
    },
    kCGWindowIsOnscreen: true,
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 2048000,
    kCGWindowName: 'Developer Tools - Chrome',
    kCGWindowNumber: 40002,
    kCGWindowOwnerName: 'Google Chrome',
    kCGWindowOwnerPID: 2345,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 2
  }
]

/**
 * 複合テストケース：すべてのウィンドウタイプを含む
 */
export const mixedWindowScenario: MacWindow[] = [
  ...sampleAppWindows,
  ...systemWindows,
  ...finderWindows,
  ...tinyWindows.slice(0, 1), // 1つの小さいウィンドウ
  ...taskbarWindows.slice(0, 1), // メインのタスクバーウィンドウ
  ...developerWindows.slice(0, 1) // 1つの開発者ツール
]

/**
 * フィルタリング後に残るべきウィンドウ（期待値）
 */
export const expectedFilteredWindows: MacWindow[] = [
  ...sampleAppWindows,
  finderWindows[0], // 名前のあるFinderウィンドウのみ
  ...developerWindows
]

/**
 * 空のシナリオ（ウィンドウなし）
 */
export const emptyWindowScenario: MacWindow[] = []

/**
 * 権限チェックの結果サンプル
 */
export const permissionResults = {
  allGranted: {
    accessibility: true,
    screenRecording: true
  },
  accessibilityOnly: {
    accessibility: true,
    screenRecording: false
  },
  screenRecordingOnly: {
    accessibility: false,
    screenRecording: true
  },
  noneGranted: {
    accessibility: false,
    screenRecording: false
  }
}

/**
 * TaskbarHelperのエラーケース
 */
export const errorScenarios = {
  invalidJson: '{"invalid": json}',
  incompleteJson: '{"kCGWindowNumber": 123',
  emptyResponse: '',
  malformedResponse: 'not json at all',
  partialResponse: '[{"kCGWindowNumber": 123}, {"incomplete":'
}

/**
 * 実際のTaskbarHelper debugコマンドの出力例
 * 注意: 実際の環境から取得したデータに置き換えてください
 */
export const realWorldSample: MacWindow[] = [
  // ここに `TaskbarHelper debug` の実際の出力をペーストしてください
  // 例:

  {
    kCGWindowStoreType: 1,
    kCGWindowSharingState: 1,
    kCGWindowAlpha: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 1411,
    kCGWindowBounds: {
      X: 136,
      Height: 54,
      Y: 631,
      Width: 54
    },
    kCGWindowName: '',
    kCGWindowOwnerName: 'CursorUIViewService',
    kCGWindowLayer: 0,
    kCGWindowNumber: 17844
  },
  {
    kCGWindowLayer: 0,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowName: '',
    kCGWindowOwnerPID: 68811,
    kCGWindowAlpha: 0,
    kCGWindowBounds: {
      X: 187,
      Height: 22,
      Y: 1118,
      Width: 13
    },
    kCGWindowOwnerName: 'Google Chrome',
    kCGWindowNumber: 17843
  },
  {
    kCGWindowStoreType: 1,
    kCGWindowLayer: 0,
    kCGWindowOwnerPID: 1411,
    kCGWindowSharingState: 1,
    kCGWindowName: '',
    kCGWindowOwnerName: 'CursorUIViewService',
    kCGWindowBounds: {
      X: 362,
      Height: 77,
      Y: 210,
      Width: 54
    },
    kCGWindowNumber: 17842,
    kCGWindowAlpha: 1,
    kCGWindowMemoryUsage: 2288
  },
  {
    kCGWindowIsOnscreen: true,
    kCGWindowStoreType: 1,
    kCGWindowName: 'taskbar — ./resources/TaskbarH ~/w/taskbar — -fish — 80×24',
    kCGWindowLayer: 0,
    kCGWindowNumber: 17840,
    kCGWindowSharingState: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 35544,
    kCGWindowAlpha: 1,
    kCGWindowOwnerName: 'ターミナル',
    kCGWindowBounds: {
      X: 159,
      Height: 371,
      Y: 336,
      Width: 585
    }
  },
  {
    kCGWindowBounds: {
      X: 2112,
      Height: 54,
      Y: 489,
      Width: 54
    },
    kCGWindowNumber: 17838,
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 1411,
    kCGWindowOwnerName: 'CursorUIViewService',
    kCGWindowLayer: 0,
    kCGWindowSharingState: 1,
    kCGWindowAlpha: 1,
    kCGWindowStoreType: 1,
    kCGWindowName: ''
  },
  {
    kCGWindowOwnerPID: 68130,
    kCGWindowOwnerName: 'Electron',
    kCGWindowSharingState: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowAlpha: 1,
    kCGWindowName: '',
    kCGWindowLayer: 0,
    kCGWindowNumber: 17820,
    kCGWindowStoreType: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    }
  },
  {
    kCGWindowName: '',
    kCGWindowOwnerName: 'Electron',
    kCGWindowAlpha: 1,
    kCGWindowSharingState: 1,
    kCGWindowNumber: 17819,
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 68130,
    kCGWindowLayer: 0,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowStoreType: 1
  },
  {
    kCGWindowOwnerPID: 68130,
    kCGWindowOwnerName: 'Electron',
    kCGWindowName: '',
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowNumber: 17818,
    kCGWindowSharingState: 1,
    kCGWindowAlpha: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowLayer: 0,
    kCGWindowStoreType: 1
  },
  {
    kCGWindowOwnerPID: 68130,
    kCGWindowNumber: 17817,
    kCGWindowSharingState: 1,
    kCGWindowOwnerName: 'Electron',
    kCGWindowAlpha: 1,
    kCGWindowName: '',
    kCGWindowLayer: 0,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowStoreType: 1,
    kCGWindowMemoryUsage: 2288
  },
  {
    kCGWindowIsOnscreen: true,
    kCGWindowOwnerPID: 68130,
    kCGWindowBounds: {
      X: 0,
      Height: 60,
      Y: 1380,
      Width: 3440
    },
    kCGWindowAlpha: 1,
    kCGWindowLayer: 3,
    kCGWindowStoreType: 1,
    kCGWindowOwnerName: 'Electron',
    kCGWindowNumber: 17816,
    kCGWindowSharingState: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowName: 'taskbar.fm'
  },
  {
    kCGWindowNumber: 17792,
    kCGWindowOwnerName: 'synergy-core',
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 1,
    kCGWindowIsOnscreen: true,
    kCGWindowBounds: {
      X: 0,
      Height: 3,
      Y: 1437,
      Width: 3
    },
    kCGWindowAlpha: 0.10000000149011612,
    kCGWindowMemoryUsage: 2288,
    kCGWindowLayer: 0,
    kCGWindowName: '',
    kCGWindowOwnerPID: 66599
  },
  {
    kCGWindowSharingState: 1,
    kCGWindowOwnerPID: 1397,
    kCGWindowStoreType: 1,
    kCGWindowIsOnscreen: true,
    kCGWindowOwnerName: 'Finder',
    kCGWindowLayer: 0,
    kCGWindowBounds: {
      X: 236,
      Height: 436,
      Y: 822,
      Width: 920
    },
    kCGWindowName: 'Screenshots',
    kCGWindowMemoryUsage: 2288,
    kCGWindowNumber: 17468,
    kCGWindowAlpha: 1
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowOwnerPID: 968,
    kCGWindowSharingState: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowNumber: 17231,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowName: 'Desktop',
    kCGWindowLayer: -2147483626,
    kCGWindowStoreType: 2,
    kCGWindowMemoryUsage: 18784,
    kCGWindowIsOnscreen: true
  },
  {
    kCGWindowSharingState: 1,
    kCGWindowOwnerPID: 35544,
    kCGWindowMemoryUsage: 2288,
    kCGWindowAlpha: 1,
    kCGWindowName: '',
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowNumber: 17224,
    kCGWindowLayer: 0,
    kCGWindowOwnerName: 'ターミナル',
    kCGWindowStoreType: 1
  },
  {
    kCGWindowStoreType: 1,
    kCGWindowNumber: 17223,
    kCGWindowOwnerPID: 88909,
    kCGWindowOwnerName: 'Code',
    kCGWindowMemoryUsage: 2288,
    kCGWindowLayer: 0,
    kCGWindowName: '',
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowAlpha: 1,
    kCGWindowSharingState: 1
  },
  {
    kCGWindowNumber: 17222,
    kCGWindowMemoryUsage: 2288,
    kCGWindowLayer: 0,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowSharingState: 1,
    kCGWindowOwnerName: 'Code',
    kCGWindowAlpha: 1,
    kCGWindowName: '',
    kCGWindowOwnerPID: 88909,
    kCGWindowStoreType: 1
  },
  {
    kCGWindowLayer: 0,
    kCGWindowOwnerPID: 35544,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowStoreType: 1,
    kCGWindowAlpha: 1,
    kCGWindowOwnerName: 'ターミナル',
    kCGWindowNumber: 17221,
    kCGWindowName: '',
    kCGWindowSharingState: 1,
    kCGWindowMemoryUsage: 2288
  },
  {
    kCGWindowNumber: 17219,
    kCGWindowOwnerName: 'Code',
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 1,
    kCGWindowOwnerPID: 88909,
    kCGWindowAlpha: 1,
    kCGWindowName: '',
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 2288
  },
  {
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowSharingState: 1,
    kCGWindowOwnerPID: 1397,
    kCGWindowOwnerName: 'Finder',
    kCGWindowLayer: 0,
    kCGWindowName: '',
    kCGWindowNumber: 17215,
    kCGWindowMemoryUsage: 2288,
    kCGWindowStoreType: 1,
    kCGWindowAlpha: 1
  },
  {
    kCGWindowNumber: 17213,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowOwnerPID: 1397,
    kCGWindowOwnerName: 'Finder',
    kCGWindowAlpha: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowStoreType: 1,
    kCGWindowLayer: 0,
    kCGWindowName: '',
    kCGWindowSharingState: 1
  },
  {
    kCGWindowNumber: 17212,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowOwnerPID: 1397,
    kCGWindowMemoryUsage: 2288,
    kCGWindowSharingState: 1,
    kCGWindowAlpha: 1,
    kCGWindowLayer: 0,
    kCGWindowOwnerName: 'Finder',
    kCGWindowStoreType: 1,
    kCGWindowName: ''
  },
  {
    kCGWindowLayer: 0,
    kCGWindowName: '',
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerName: 'Finder',
    kCGWindowOwnerPID: 1397,
    kCGWindowSharingState: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowNumber: 17211,
    kCGWindowStoreType: 1,
    kCGWindowAlpha: 1
  },
  {
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 1,
    kCGWindowAlpha: 1,
    kCGWindowName: '',
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerName: 'Discord',
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowNumber: 17209,
    kCGWindowOwnerPID: 1384
  },
  {
    kCGWindowStoreType: 1,
    kCGWindowSharingState: 1,
    kCGWindowNumber: 17208,
    kCGWindowName: '',
    kCGWindowOwnerPID: 1384,
    kCGWindowAlpha: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowLayer: 0,
    kCGWindowOwnerName: 'Discord',
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    }
  },
  {
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 1384,
    kCGWindowName: '',
    kCGWindowStoreType: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowNumber: 17207,
    kCGWindowAlpha: 1,
    kCGWindowOwnerName: 'Discord',
    kCGWindowLayer: 0,
    kCGWindowSharingState: 1
  },
  {
    kCGWindowLayer: 0,
    kCGWindowAlpha: 1,
    kCGWindowName: '',
    kCGWindowOwnerName: 'パスワード',
    kCGWindowStoreType: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowNumber: 17206,
    kCGWindowOwnerPID: 95964,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowSharingState: 1
  },
  {
    kCGWindowOwnerName: 'Discord',
    kCGWindowStoreType: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 1384,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowLayer: 0,
    kCGWindowAlpha: 1,
    kCGWindowSharingState: 1,
    kCGWindowNumber: 17205,
    kCGWindowName: ''
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowLayer: 0,
    kCGWindowOwnerPID: 1393,
    kCGWindowOwnerName: 'アクティビティモニタ',
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowName: '',
    kCGWindowSharingState: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowStoreType: 1,
    kCGWindowNumber: 17204
  },
  {
    kCGWindowOwnerName: 'パスワード',
    kCGWindowMemoryUsage: 2288,
    kCGWindowAlpha: 1,
    kCGWindowSharingState: 1,
    kCGWindowLayer: 0,
    kCGWindowOwnerPID: 95964,
    kCGWindowName: '',
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowNumber: 17203,
    kCGWindowStoreType: 1
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowStoreType: 1,
    kCGWindowName: '',
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowSharingState: 1,
    kCGWindowOwnerName: '1Password',
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 94369,
    kCGWindowNumber: 17202
  },
  {
    kCGWindowLayer: 0,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowStoreType: 1,
    kCGWindowNumber: 17201,
    kCGWindowName: '',
    kCGWindowAlpha: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 95964,
    kCGWindowOwnerName: 'パスワード',
    kCGWindowSharingState: 1
  },
  {
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 2288,
    kCGWindowName: '',
    kCGWindowOwnerName: 'アクティビティモニタ',
    kCGWindowSharingState: 1,
    kCGWindowOwnerPID: 1393,
    kCGWindowAlpha: 1,
    kCGWindowStoreType: 1,
    kCGWindowNumber: 17200
  },
  {
    kCGWindowOwnerName: 'メモ',
    kCGWindowStoreType: 1,
    kCGWindowName: '',
    kCGWindowOwnerPID: 1392,
    kCGWindowSharingState: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowNumber: 17198,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowLayer: 0,
    kCGWindowAlpha: 1
  },
  {
    kCGWindowMemoryUsage: 2288,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowOwnerPID: 1392,
    kCGWindowLayer: 0,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 1,
    kCGWindowAlpha: 1,
    kCGWindowOwnerName: 'メモ',
    kCGWindowNumber: 17197,
    kCGWindowName: ''
  },
  {
    kCGWindowNumber: 17196,
    kCGWindowLayer: 0,
    kCGWindowOwnerName: 'メモ',
    kCGWindowMemoryUsage: 2288,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowAlpha: 1,
    kCGWindowName: '',
    kCGWindowOwnerPID: 1392,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 1
  },
  {
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowLayer: 0,
    kCGWindowOwnerPID: 1392,
    kCGWindowName: '',
    kCGWindowOwnerName: 'メモ',
    kCGWindowStoreType: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowAlpha: 1,
    kCGWindowSharingState: 1,
    kCGWindowNumber: 17195
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowNumber: 17194,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowOwnerPID: 94369,
    kCGWindowStoreType: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerName: '1Password',
    kCGWindowLayer: 0,
    kCGWindowName: '',
    kCGWindowSharingState: 1
  },
  {
    kCGWindowSharingState: 1,
    kCGWindowLayer: 0,
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowStoreType: 1,
    kCGWindowNumber: 17193,
    kCGWindowOwnerPID: 1388,
    kCGWindowName: '',
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerName: 'DBeaver'
  },
  {
    kCGWindowMemoryUsage: 2288,
    kCGWindowStoreType: 1,
    kCGWindowSharingState: 1,
    kCGWindowOwnerPID: 1388,
    kCGWindowOwnerName: 'DBeaver',
    kCGWindowName: '',
    kCGWindowAlpha: 1,
    kCGWindowNumber: 17192,
    kCGWindowLayer: 0,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    }
  },
  {
    kCGWindowName: '',
    kCGWindowOwnerPID: 1388,
    kCGWindowMemoryUsage: 2288,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowStoreType: 1,
    kCGWindowLayer: 0,
    kCGWindowOwnerName: 'DBeaver',
    kCGWindowAlpha: 1,
    kCGWindowNumber: 17191,
    kCGWindowSharingState: 1
  },
  {
    kCGWindowNumber: 17190,
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 94369,
    kCGWindowStoreType: 1,
    kCGWindowAlpha: 1,
    kCGWindowName: '',
    kCGWindowSharingState: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowLayer: 0,
    kCGWindowOwnerName: '1Password'
  },
  {
    kCGWindowLayer: 0,
    kCGWindowOwnerName: 'DBeaver',
    kCGWindowName: '',
    kCGWindowStoreType: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowNumber: 17189,
    kCGWindowMemoryUsage: 2288,
    kCGWindowAlpha: 1,
    kCGWindowOwnerPID: 1388,
    kCGWindowSharingState: 1
  },
  {
    kCGWindowOwnerName: 'アクティビティモニタ',
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowOwnerPID: 1393,
    kCGWindowName: '',
    kCGWindowAlpha: 1,
    kCGWindowNumber: 17188,
    kCGWindowMemoryUsage: 2288,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 1,
    kCGWindowLayer: 0
  },
  {
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowNumber: 17187,
    kCGWindowStoreType: 1,
    kCGWindowSharingState: 1,
    kCGWindowAlpha: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 94369,
    kCGWindowOwnerName: '1Password',
    kCGWindowName: '',
    kCGWindowLayer: 0
  },
  {
    kCGWindowStoreType: 1,
    kCGWindowOwnerPID: 1393,
    kCGWindowOwnerName: 'アクティビティモニタ',
    kCGWindowAlpha: 1,
    kCGWindowName: '',
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowLayer: 0,
    kCGWindowNumber: 17186,
    kCGWindowMemoryUsage: 2288,
    kCGWindowSharingState: 1
  },
  {
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 68811,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowStoreType: 1,
    kCGWindowOwnerName: 'Google Chrome',
    kCGWindowLayer: 0,
    kCGWindowSharingState: 1,
    kCGWindowNumber: 17185,
    kCGWindowAlpha: 1,
    kCGWindowName: ''
  },
  {
    kCGWindowName: '',
    kCGWindowMemoryUsage: 2288,
    kCGWindowAlpha: 1,
    kCGWindowStoreType: 1,
    kCGWindowOwnerName: 'Google Chrome',
    kCGWindowOwnerPID: 68811,
    kCGWindowLayer: 0,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowNumber: 17184,
    kCGWindowSharingState: 1
  },
  {
    kCGWindowOwnerPID: 68811,
    kCGWindowStoreType: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowNumber: 17183,
    kCGWindowName: '',
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowAlpha: 1,
    kCGWindowSharingState: 1,
    kCGWindowOwnerName: 'Google Chrome',
    kCGWindowLayer: 0
  },
  {
    kCGWindowLayer: 0,
    kCGWindowNumber: 17056,
    kCGWindowName: '',
    kCGWindowBounds: {
      X: 1475,
      Height: 54,
      Y: 1318,
      Width: 54
    },
    kCGWindowMemoryUsage: 2288,
    kCGWindowSharingState: 1,
    kCGWindowOwnerName: 'CursorUIViewService',
    kCGWindowAlpha: 1,
    kCGWindowOwnerPID: 1411,
    kCGWindowStoreType: 1
  },
  {
    kCGWindowStoreType: 1,
    kCGWindowOwnerPID: 1411,
    kCGWindowNumber: 17053,
    kCGWindowMemoryUsage: 2288,
    kCGWindowSharingState: 1,
    kCGWindowOwnerName: 'CursorUIViewService',
    kCGWindowLayer: 0,
    kCGWindowName: '',
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 54,
      Y: 940,
      Width: 54
    }
  },
  {
    kCGWindowMemoryUsage: 2288,
    kCGWindowAlpha: 1,
    kCGWindowName: '',
    kCGWindowNumber: 16983,
    kCGWindowStoreType: 1,
    kCGWindowOwnerName: 'Open and Save Panel Service',
    kCGWindowOwnerPID: 89766,
    kCGWindowBounds: {
      X: 0,
      Height: 54,
      Y: 940,
      Width: 54
    },
    kCGWindowLayer: 0,
    kCGWindowSharingState: 1
  },
  {
    kCGWindowOwnerPID: 88909,
    kCGWindowSharingState: 1,
    kCGWindowOwnerName: 'Code',
    kCGWindowName: '',
    kCGWindowNumber: 16967,
    kCGWindowStoreType: 1,
    kCGWindowBounds: {
      X: 2112,
      Height: 77,
      Y: 466,
      Width: 84
    },
    kCGWindowMemoryUsage: 2288,
    kCGWindowLayer: 3,
    kCGWindowAlpha: 1
  },
  {
    kCGWindowOwnerName: 'CursorUIViewService',
    kCGWindowOwnerPID: 1411,
    kCGWindowName: '',
    kCGWindowSharingState: 1,
    kCGWindowAlpha: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowStoreType: 1,
    kCGWindowLayer: 0,
    kCGWindowBounds: {
      X: 1387,
      Height: 54,
      Y: 874,
      Width: 54
    },
    kCGWindowNumber: 16965
  },
  {
    kCGWindowStoreType: 1,
    kCGWindowAlpha: 1,
    kCGWindowOwnerName: 'Code',
    kCGWindowBounds: {
      X: 1114,
      Height: 800,
      Y: 323,
      Width: 1200
    },
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 88909,
    kCGWindowName: '投稿フォームで画像をプレビュー.md — misskey',
    kCGWindowSharingState: 1,
    kCGWindowIsOnscreen: true,
    kCGWindowNumber: 16953
  },
  {
    kCGWindowOwnerName: 'Code',
    kCGWindowName: '改善計画書.md — wasurenainder',
    kCGWindowLayer: 0,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 1,
    kCGWindowBounds: {
      X: 973,
      Height: 841,
      Y: 312,
      Width: 1196
    },
    kCGWindowAlpha: 1,
    kCGWindowIsOnscreen: true,
    kCGWindowMemoryUsage: 2288,
    kCGWindowNumber: 16952,
    kCGWindowOwnerPID: 88909
  },
  {
    kCGWindowNumber: 16951,
    kCGWindowIsOnscreen: true,
    kCGWindowName: 'taskbar-helper-fixtures.ts — taskbar',
    kCGWindowOwnerPID: 88909,
    kCGWindowLayer: 0,
    kCGWindowAlpha: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowSharingState: 1,
    kCGWindowBounds: {
      X: 1750,
      Height: 1010,
      Y: 89,
      Width: 1424
    },
    kCGWindowOwnerName: 'Code',
    kCGWindowStoreType: 1
  },
  {
    kCGWindowLayer: 0,
    kCGWindowOwnerName: 'Open and Save Panel Service',
    kCGWindowNumber: 17043,
    kCGWindowAlpha: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowSharingState: 1,
    kCGWindowName: '',
    kCGWindowBounds: {
      X: 0,
      Height: 54,
      Y: 940,
      Width: 54
    },
    kCGWindowOwnerPID: 90381,
    kCGWindowStoreType: 1
  },
  {
    kCGWindowStoreType: 2,
    kCGWindowAlpha: 1,
    kCGWindowOwnerPID: 968,
    kCGWindowName: 'Desktop',
    kCGWindowMemoryUsage: 18784,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowLayer: -2147483626,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowNumber: 16646,
    kCGWindowSharingState: 1
  },
  {
    kCGWindowNumber: 16275,
    kCGWindowName: '',
    kCGWindowAlpha: 1,
    kCGWindowLayer: 3,
    kCGWindowOwnerPID: 68811,
    kCGWindowSharingState: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerName: 'Google Chrome',
    kCGWindowBounds: {
      X: 362,
      Height: 77,
      Y: 210,
      Width: 84
    },
    kCGWindowStoreType: 1
  },
  {
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 2288,
    kCGWindowNumber: 16268,
    kCGWindowStoreType: 1,
    kCGWindowOwnerName: 'Google Chrome',
    kCGWindowSharingState: 1,
    kCGWindowOwnerPID: 68811,
    kCGWindowAlpha: 1,
    kCGWindowName: '',
    kCGWindowBounds: {
      X: 0,
      Height: 1,
      Y: 0,
      Width: 1
    }
  },
  {
    kCGWindowOwnerPID: 68811,
    kCGWindowOwnerName: 'Google Chrome',
    kCGWindowMemoryUsage: 2288,
    kCGWindowNumber: 16267,
    kCGWindowBounds: {
      X: 0,
      Height: 1,
      Y: 0,
      Width: 1
    },
    kCGWindowAlpha: 1,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 1,
    kCGWindowLayer: 0,
    kCGWindowName: ''
  },
  {
    kCGWindowBounds: {
      X: 0,
      Height: 1,
      Y: 0,
      Width: 1
    },
    kCGWindowAlpha: 1,
    kCGWindowLayer: 0,
    kCGWindowName: '',
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 68811,
    kCGWindowStoreType: 1,
    kCGWindowNumber: 16265,
    kCGWindowSharingState: 1,
    kCGWindowOwnerName: 'Google Chrome'
  },
  {
    kCGWindowSharingState: 1,
    kCGWindowAlpha: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowNumber: 17058,
    kCGWindowOwnerName: 'CursorUIViewService',
    kCGWindowOwnerPID: 1411,
    kCGWindowBounds: {
      X: 1319,
      Height: 77,
      Y: 275,
      Width: 54
    },
    kCGWindowLayer: 0,
    kCGWindowStoreType: 1,
    kCGWindowName: ''
  },
  {
    kCGWindowLayer: 0,
    kCGWindowNumber: 16264,
    kCGWindowSharingState: 1,
    kCGWindowOwnerName: 'Google Chrome',
    kCGWindowAlpha: 1,
    kCGWindowName: '',
    kCGWindowOwnerPID: 68811,
    kCGWindowBounds: {
      X: 0,
      Height: 1,
      Y: 0,
      Width: 1
    },
    kCGWindowStoreType: 1,
    kCGWindowMemoryUsage: 2288
  },
  {
    kCGWindowNumber: 16263,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 1,
    kCGWindowLayer: 0,
    kCGWindowBounds: {
      X: 188,
      Height: 1102,
      Y: 37,
      Width: 904
    },
    kCGWindowName: 'タイムライン | みすてむず　いず　みすきーしすてむず',
    kCGWindowIsOnscreen: true,
    kCGWindowOwnerName: 'Google Chrome',
    kCGWindowOwnerPID: 68811,
    kCGWindowMemoryUsage: 2288,
    kCGWindowAlpha: 1
  },
  {
    kCGWindowName: '',
    kCGWindowBounds: {
      X: 0,
      Height: 54,
      Y: 940,
      Width: 54
    },
    kCGWindowAlpha: 1,
    kCGWindowLayer: 0,
    kCGWindowStoreType: 1,
    kCGWindowSharingState: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowNumber: 16985,
    kCGWindowOwnerPID: 1411,
    kCGWindowOwnerName: 'CursorUIViewService'
  },
  {
    kCGWindowStoreType: 2,
    kCGWindowNumber: 16130,
    kCGWindowMemoryUsage: 18784,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowLayer: -2147483626,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowName: 'Desktop',
    kCGWindowAlpha: 1,
    kCGWindowOwnerPID: 968,
    kCGWindowSharingState: 1
  },
  {
    kCGWindowLayer: -2147483626,
    kCGWindowNumber: 15771,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowName: 'Desktop',
    kCGWindowAlpha: 1,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowMemoryUsage: 18784,
    kCGWindowSharingState: 1,
    kCGWindowOwnerPID: 968,
    kCGWindowStoreType: 2
  },
  {
    kCGWindowNumber: 14076,
    kCGWindowBounds: {
      X: 0,
      Height: 0,
      Y: 0,
      Width: 0
    },
    kCGWindowSharingState: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowAlpha: 1,
    kCGWindowLayer: 0,
    kCGWindowOwnerPID: 16069,
    kCGWindowStoreType: 1,
    kCGWindowOwnerName: 'nsattributedstringagent',
    kCGWindowName: ''
  },
  {
    kCGWindowStoreType: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowNumber: 17217,
    kCGWindowLayer: 0,
    kCGWindowOwnerPID: 35544,
    kCGWindowName: '',
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowOwnerName: 'ターミナル',
    kCGWindowSharingState: 1
  },
  {
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowAlpha: 1,
    kCGWindowMemoryUsage: 18784,
    kCGWindowStoreType: 2,
    kCGWindowLayer: -2147483626,
    kCGWindowOwnerPID: 968,
    kCGWindowNumber: 14041,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowSharingState: 1,
    kCGWindowName: 'Desktop'
  },
  {
    kCGWindowMemoryUsage: 18784,
    kCGWindowAlpha: 1,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowLayer: -2147483626,
    kCGWindowOwnerPID: 968,
    kCGWindowSharingState: 1,
    kCGWindowNumber: 16778,
    kCGWindowName: 'Desktop',
    kCGWindowStoreType: 2
  },
  {
    kCGWindowSharingState: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowLayer: -2147483626,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowNumber: 13936,
    kCGWindowMemoryUsage: 18784,
    kCGWindowStoreType: 2,
    kCGWindowName: 'Desktop',
    kCGWindowOwnerPID: 968,
    kCGWindowAlpha: 1
  },
  {
    kCGWindowMemoryUsage: 2288,
    kCGWindowSharingState: 1,
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 54,
      Y: 1386,
      Width: 54
    },
    kCGWindowStoreType: 1,
    kCGWindowLayer: 0,
    kCGWindowOwnerName: 'CursorUIViewService',
    kCGWindowName: '',
    kCGWindowOwnerPID: 1411,
    kCGWindowNumber: 13718
  },
  {
    kCGWindowBounds: {
      X: 1319,
      Height: 77,
      Y: 275,
      Width: 84
    },
    kCGWindowNumber: 13701,
    kCGWindowLayer: 9,
    kCGWindowAlpha: 1,
    kCGWindowSharingState: 1,
    kCGWindowOwnerPID: 96032,
    kCGWindowStoreType: 1,
    kCGWindowOwnerName: 'Raycast',
    kCGWindowMemoryUsage: 2288,
    kCGWindowName: ''
  },
  {
    kCGWindowOwnerPID: 96032,
    kCGWindowNumber: 13700,
    kCGWindowSharingState: 1,
    kCGWindowLayer: 8,
    kCGWindowAlpha: 1,
    kCGWindowName: '',
    kCGWindowStoreType: 1,
    kCGWindowOwnerName: 'Raycast',
    kCGWindowBounds: {
      X: 1345,
      Height: 474,
      Y: 261,
      Width: 750
    },
    kCGWindowMemoryUsage: 2288
  },
  {
    kCGWindowName: '',
    kCGWindowBounds: {
      X: 0,
      Height: 54,
      Y: 940,
      Width: 54
    },
    kCGWindowStoreType: 1,
    kCGWindowSharingState: 1,
    kCGWindowAlpha: 1,
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerName: 'CursorUIViewService',
    kCGWindowOwnerPID: 1411,
    kCGWindowNumber: 17669
  },
  {
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 38
    },
    kCGWindowOwnerPID: 96032,
    kCGWindowNumber: 13699,
    kCGWindowLayer: 25,
    kCGWindowOwnerName: 'Raycast',
    kCGWindowName: 'raycastIcon',
    kCGWindowSharingState: 1,
    kCGWindowAlpha: 1,
    kCGWindowStoreType: 1,
    kCGWindowMemoryUsage: 2288
  },
  {
    kCGWindowLayer: 0,
    kCGWindowAlpha: 1,
    kCGWindowOwnerPID: 1411,
    kCGWindowStoreType: 1,
    kCGWindowOwnerName: 'CursorUIViewService',
    kCGWindowMemoryUsage: 2288,
    kCGWindowNumber: 13697,
    kCGWindowName: '',
    kCGWindowBounds: {
      X: 0,
      Height: 54,
      Y: 1386,
      Width: 54
    },
    kCGWindowSharingState: 1
  },
  {
    kCGWindowNumber: 13696,
    kCGWindowAlpha: 1,
    kCGWindowStoreType: 1,
    kCGWindowLayer: 0,
    kCGWindowOwnerName: 'パスワード',
    kCGWindowBounds: {
      X: 0,
      Height: 500,
      Y: 940,
      Width: 500
    },
    kCGWindowOwnerPID: 95964,
    kCGWindowName: '',
    kCGWindowSharingState: 1,
    kCGWindowMemoryUsage: 2288
  },
  {
    kCGWindowNumber: 13694,
    kCGWindowStoreType: 1,
    kCGWindowOwnerName: 'LocalAuthenticationRemoteServic',
    kCGWindowLayer: 0,
    kCGWindowName: '',
    kCGWindowBounds: {
      X: 0,
      Height: 500,
      Y: 940,
      Width: 500
    },
    kCGWindowAlpha: 1,
    kCGWindowOwnerPID: 95965,
    kCGWindowSharingState: 1,
    kCGWindowMemoryUsage: 2288
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowOwnerPID: 95964,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 29
    },
    kCGWindowOwnerName: 'パスワード',
    kCGWindowLayer: 25,
    kCGWindowName: 'Item-0',
    kCGWindowStoreType: 1,
    kCGWindowSharingState: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowNumber: 13692
  },
  {
    kCGWindowStoreType: 1,
    kCGWindowNumber: 13666,
    kCGWindowName: '',
    kCGWindowSharingState: 1,
    kCGWindowOwnerName: 'CursorUIViewService',
    kCGWindowBounds: {
      X: 0,
      Height: 54,
      Y: 1386,
      Width: 54
    },
    kCGWindowMemoryUsage: 2288,
    kCGWindowLayer: 0,
    kCGWindowOwnerPID: 1411,
    kCGWindowAlpha: 1
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowOwnerName: '1Password',
    kCGWindowOwnerPID: 94369,
    kCGWindowStoreType: 1,
    kCGWindowNumber: 13603,
    kCGWindowSharingState: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 500,
      Y: 940,
      Width: 500
    },
    kCGWindowName: '',
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 2288
  },
  {
    kCGWindowStoreType: 1,
    kCGWindowLayer: 0,
    kCGWindowName: 'ロックスクリーン — 1Password',
    kCGWindowOwnerPID: 94369,
    kCGWindowIsOnscreen: true,
    kCGWindowNumber: 13588,
    kCGWindowOwnerName: '1Password',
    kCGWindowAlpha: 1,
    kCGWindowSharingState: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowBounds: {
      X: 998,
      Height: 800,
      Y: 359,
      Width: 1227
    }
  },
  {
    kCGWindowOwnerName: 'ターミナル',
    kCGWindowSharingState: 1,
    kCGWindowNumber: 9847,
    kCGWindowAlpha: 1,
    kCGWindowIsOnscreen: true,
    kCGWindowOwnerPID: 35544,
    kCGWindowBounds: {
      X: 2441,
      Height: 371,
      Y: 240,
      Width: 571
    },
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 2288,
    kCGWindowName: 'riin — cat workspace/katalo ~ — less ◂ bat workspace/katalog/CLAUDE.md — 78×24',
    kCGWindowStoreType: 1
  },
  {
    kCGWindowNumber: 9797,
    kCGWindowLayer: 0,
    kCGWindowStoreType: 1,
    kCGWindowOwnerName: 'ターミナル',
    kCGWindowMemoryUsage: 2288,
    kCGWindowBounds: {
      X: 497,
      Height: 234,
      Y: 502,
      Width: 260
    },
    kCGWindowOwnerPID: 35544,
    kCGWindowSharingState: 1,
    kCGWindowAlpha: 1
  },
  {
    kCGWindowOwnerPID: 68811,
    kCGWindowName: '',
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerName: 'Google Chrome',
    kCGWindowNumber: 17182,
    kCGWindowAlpha: 1,
    kCGWindowSharingState: 1,
    kCGWindowLayer: 0,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowStoreType: 1
  },
  {
    kCGWindowMemoryUsage: 18784,
    kCGWindowOwnerPID: 968,
    kCGWindowLayer: -2147483626,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowAlpha: 1,
    kCGWindowStoreType: 2,
    kCGWindowSharingState: 1,
    kCGWindowName: 'Desktop',
    kCGWindowNumber: 9639,
    kCGWindowOwnerName: 'Window Server'
  },
  {
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowName: 'Desktop',
    kCGWindowLayer: -2147483626,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowAlpha: 1,
    kCGWindowStoreType: 2,
    kCGWindowSharingState: 1,
    kCGWindowNumber: 9087,
    kCGWindowMemoryUsage: 18784,
    kCGWindowOwnerPID: 968
  },
  {
    kCGWindowOwnerName: 'Window Server',
    kCGWindowLayer: -2147483626,
    kCGWindowSharingState: 1,
    kCGWindowAlpha: 1,
    kCGWindowStoreType: 2,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowMemoryUsage: 18784,
    kCGWindowNumber: 8947,
    kCGWindowOwnerPID: 968,
    kCGWindowName: 'Desktop'
  },
  {
    kCGWindowStoreType: 2,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowOwnerPID: 968,
    kCGWindowLayer: -2147483626,
    kCGWindowMemoryUsage: 18784,
    kCGWindowSharingState: 1,
    kCGWindowAlpha: 1,
    kCGWindowNumber: 8436,
    kCGWindowName: 'Desktop',
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    }
  },
  {
    kCGWindowMemoryUsage: 18784,
    kCGWindowName: 'Desktop',
    kCGWindowNumber: 8297,
    kCGWindowLayer: -2147483626,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowSharingState: 1,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowAlpha: 1,
    kCGWindowOwnerPID: 968,
    kCGWindowStoreType: 2
  },
  {
    kCGWindowLayer: -2147483626,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowOwnerPID: 968,
    kCGWindowNumber: 8120,
    kCGWindowSharingState: 1,
    kCGWindowAlpha: 1,
    kCGWindowStoreType: 2,
    kCGWindowMemoryUsage: 18784,
    kCGWindowName: 'Desktop',
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    }
  },
  {
    kCGWindowName: 'Desktop',
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowStoreType: 2,
    kCGWindowLayer: -2147483626,
    kCGWindowSharingState: 1,
    kCGWindowNumber: 7803,
    kCGWindowAlpha: 1,
    kCGWindowMemoryUsage: 18784,
    kCGWindowOwnerPID: 968,
    kCGWindowOwnerName: 'Window Server'
  },
  {
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowOwnerPID: 95964,
    kCGWindowLayer: 0,
    kCGWindowStoreType: 1,
    kCGWindowName: '',
    kCGWindowOwnerName: 'パスワード',
    kCGWindowMemoryUsage: 2288,
    kCGWindowSharingState: 1,
    kCGWindowNumber: 17199,
    kCGWindowAlpha: 1
  },
  {
    kCGWindowOwnerName: 'Window Server',
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowSharingState: 1,
    kCGWindowOwnerPID: 968,
    kCGWindowAlpha: 1,
    kCGWindowMemoryUsage: 18784,
    kCGWindowNumber: 7671,
    kCGWindowStoreType: 2,
    kCGWindowName: 'Desktop',
    kCGWindowLayer: -2147483626
  },
  {
    kCGWindowName: 'Desktop',
    kCGWindowMemoryUsage: 18784,
    kCGWindowNumber: 7500,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowAlpha: 1,
    kCGWindowStoreType: 2,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowSharingState: 1,
    kCGWindowOwnerPID: 968,
    kCGWindowLayer: -2147483626
  },
  {
    kCGWindowNumber: 7374,
    kCGWindowOwnerPID: 968,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowSharingState: 1,
    kCGWindowName: 'Desktop',
    kCGWindowOwnerName: 'Window Server',
    kCGWindowLayer: -2147483626,
    kCGWindowAlpha: 1,
    kCGWindowStoreType: 2,
    kCGWindowMemoryUsage: 18784
  },
  {
    kCGWindowNumber: 9293,
    kCGWindowStoreType: 2,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowSharingState: 1,
    kCGWindowAlpha: 1,
    kCGWindowMemoryUsage: 18784,
    kCGWindowLayer: -2147483626,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowOwnerPID: 968,
    kCGWindowName: 'Desktop'
  },
  {
    kCGWindowMemoryUsage: 18784,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowNumber: 7080,
    kCGWindowName: 'Desktop',
    kCGWindowSharingState: 1,
    kCGWindowOwnerPID: 968,
    kCGWindowLayer: -2147483626,
    kCGWindowAlpha: 1,
    kCGWindowStoreType: 2
  },
  {
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowStoreType: 2,
    kCGWindowOwnerPID: 968,
    kCGWindowSharingState: 1,
    kCGWindowName: 'Desktop',
    kCGWindowMemoryUsage: 18784,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowLayer: -2147483626,
    kCGWindowNumber: 6795,
    kCGWindowAlpha: 1
  },
  {
    kCGWindowName: 'Desktop',
    kCGWindowStoreType: 2,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowSharingState: 1,
    kCGWindowMemoryUsage: 18784,
    kCGWindowLayer: -2147483626,
    kCGWindowAlpha: 1,
    kCGWindowOwnerPID: 968,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowNumber: 6639
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowStoreType: 2,
    kCGWindowOwnerPID: 968,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowNumber: 6517,
    kCGWindowMemoryUsage: 18784,
    kCGWindowName: 'Desktop',
    kCGWindowLayer: -2147483626,
    kCGWindowSharingState: 1
  },
  {
    kCGWindowNumber: 9432,
    kCGWindowAlpha: 1,
    kCGWindowStoreType: 2,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowName: 'Desktop',
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowMemoryUsage: 18784,
    kCGWindowLayer: -2147483626,
    kCGWindowSharingState: 1,
    kCGWindowOwnerPID: 968
  },
  {
    kCGWindowName: 'Desktop',
    kCGWindowOwnerPID: 968,
    kCGWindowLayer: -2147483626,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowAlpha: 1,
    kCGWindowStoreType: 2,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowSharingState: 1,
    kCGWindowNumber: 6244,
    kCGWindowMemoryUsage: 18784
  },
  {
    kCGWindowOwnerName: 'Window Server',
    kCGWindowMemoryUsage: 18784,
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowStoreType: 2,
    kCGWindowLayer: -2147483626,
    kCGWindowOwnerPID: 968,
    kCGWindowNumber: 8621,
    kCGWindowName: 'Desktop',
    kCGWindowSharingState: 1
  },
  {
    kCGWindowMemoryUsage: 18784,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowLayer: -2147483626,
    kCGWindowName: 'Desktop',
    kCGWindowNumber: 6918,
    kCGWindowStoreType: 2,
    kCGWindowAlpha: 1,
    kCGWindowSharingState: 1,
    kCGWindowOwnerPID: 968,
    kCGWindowOwnerName: 'Window Server'
  },
  {
    kCGWindowMemoryUsage: 18784,
    kCGWindowSharingState: 1,
    kCGWindowAlpha: 1,
    kCGWindowStoreType: 2,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowNumber: 6124,
    kCGWindowName: 'Desktop',
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowOwnerPID: 968,
    kCGWindowLayer: -2147483626
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowLayer: -2147483626,
    kCGWindowName: 'Desktop',
    kCGWindowOwnerPID: 968,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowStoreType: 2,
    kCGWindowNumber: 5990,
    kCGWindowSharingState: 1,
    kCGWindowMemoryUsage: 18784,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    }
  },
  {
    kCGWindowMemoryUsage: 18784,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowSharingState: 1,
    kCGWindowAlpha: 1,
    kCGWindowLayer: -2147483626,
    kCGWindowStoreType: 2,
    kCGWindowNumber: 5868,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowName: 'Desktop',
    kCGWindowOwnerPID: 968
  },
  {
    kCGWindowOwnerName: 'Window Server',
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowLayer: -2147483626,
    kCGWindowMemoryUsage: 18784,
    kCGWindowAlpha: 1,
    kCGWindowNumber: 5728,
    kCGWindowStoreType: 2,
    kCGWindowSharingState: 1,
    kCGWindowName: 'Desktop',
    kCGWindowOwnerPID: 968
  },
  {
    kCGWindowOwnerPID: 1649,
    kCGWindowAlpha: 1,
    kCGWindowNumber: 107,
    kCGWindowMemoryUsage: 2288,
    kCGWindowSharingState: 1,
    kCGWindowOwnerName: 'Choosy',
    kCGWindowName: '',
    kCGWindowBounds: {
      X: 0,
      Height: 100,
      Y: 1340,
      Width: 100
    },
    kCGWindowStoreType: 1,
    kCGWindowLayer: 25
  },
  {
    kCGWindowLayer: 0,
    kCGWindowNumber: 86,
    kCGWindowSharingState: 1,
    kCGWindowName: "PartRenderingEngine's limbo",
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 574,
      Y: 10522,
      Width: 919
    },
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 1388,
    kCGWindowOwnerName: 'DBeaver',
    kCGWindowStoreType: 1
  },
  {
    kCGWindowIsOnscreen: true,
    kCGWindowAlpha: 1,
    kCGWindowStoreType: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowBounds: {
      X: 2770,
      Height: 24,
      Y: 0,
      Width: 34
    },
    kCGWindowName: 'Item-0',
    kCGWindowOwnerName: 'Clipy',
    kCGWindowSharingState: 1,
    kCGWindowNumber: 84,
    kCGWindowOwnerPID: 1646,
    kCGWindowLayer: 25
  },
  {
    kCGWindowOwnerPID: 1648,
    kCGWindowMemoryUsage: 2288,
    kCGWindowLayer: 25,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 1,
    kCGWindowOwnerName: 'MenuBar Stats',
    kCGWindowName: 'Item-4',
    kCGWindowBounds: {
      X: 3010,
      Height: 24,
      Y: 0,
      Width: 36
    },
    kCGWindowNumber: 83,
    kCGWindowIsOnscreen: true,
    kCGWindowAlpha: 1
  },
  {
    kCGWindowOwnerName: 'ChatGPT',
    kCGWindowNumber: 13579,
    kCGWindowBounds: {
      X: 1475,
      Height: 77,
      Y: 1295,
      Width: 84
    },
    kCGWindowLayer: 9,
    kCGWindowOwnerPID: 94316,
    kCGWindowStoreType: 1,
    kCGWindowSharingState: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowName: '',
    kCGWindowAlpha: 1
  },
  {
    kCGWindowOwnerName: 'MenuBar Stats',
    kCGWindowAlpha: 1,
    kCGWindowLayer: 25,
    kCGWindowOwnerPID: 1648,
    kCGWindowIsOnscreen: true,
    kCGWindowSharingState: 1,
    kCGWindowName: 'Item-3',
    kCGWindowStoreType: 1,
    kCGWindowBounds: {
      X: 3046,
      Height: 24,
      Y: 0,
      Width: 102
    },
    kCGWindowNumber: 81,
    kCGWindowMemoryUsage: 2288
  },
  {
    kCGWindowOwnerPID: 1648,
    kCGWindowNumber: 80,
    kCGWindowOwnerName: 'MenuBar Stats',
    kCGWindowIsOnscreen: true,
    kCGWindowLayer: 25,
    kCGWindowSharingState: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowStoreType: 1,
    kCGWindowBounds: {
      X: 2956,
      Height: 24,
      Y: 0,
      Width: 54
    },
    kCGWindowAlpha: 1,
    kCGWindowName: 'Item-2'
  },
  {
    kCGWindowName: 'vanilla_s1',
    kCGWindowSharingState: 1,
    kCGWindowBounds: {
      X: -2246,
      Height: 24,
      Y: 0,
      Width: 5016
    },
    kCGWindowStoreType: 1,
    kCGWindowLayer: 25,
    kCGWindowNumber: 79,
    kCGWindowOwnerPID: 1645,
    kCGWindowOwnerName: 'Vanilla',
    kCGWindowMemoryUsage: 2288,
    kCGWindowAlpha: 1
  },
  {
    kCGWindowName: '',
    kCGWindowOwnerName: 'Vanilla',
    kCGWindowStoreType: 1,
    kCGWindowLayer: 26,
    kCGWindowBounds: {
      X: 2750,
      Height: 20,
      Y: 2,
      Width: 20
    },
    kCGWindowIsOnscreen: true,
    kCGWindowAlpha: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowSharingState: 1,
    kCGWindowNumber: 78,
    kCGWindowOwnerPID: 1645
  },
  {
    kCGWindowOwnerPID: 1648,
    kCGWindowLayer: 25,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 1,
    kCGWindowNumber: 77,
    kCGWindowOwnerName: 'MenuBar Stats',
    kCGWindowBounds: {
      X: 3209,
      Height: 24,
      Y: 0,
      Width: 34
    },
    kCGWindowAlpha: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowIsOnscreen: true,
    kCGWindowName: 'Item-1'
  },
  {
    kCGWindowOwnerName: 'コントロールセンター',
    kCGWindowSharingState: 1,
    kCGWindowName: 'NowPlaying',
    kCGWindowOwnerPID: 1221,
    kCGWindowNumber: 1664,
    kCGWindowStoreType: 1,
    kCGWindowLayer: 25,
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      X: 2815,
      Height: 24,
      Y: 0,
      Width: 33
    },
    kCGWindowMemoryUsage: 2288
  },
  {
    kCGWindowLayer: 25,
    kCGWindowIsOnscreen: true,
    kCGWindowOwnerPID: 1648,
    kCGWindowOwnerName: 'MenuBar Stats',
    kCGWindowAlpha: 1,
    kCGWindowSharingState: 1,
    kCGWindowNumber: 75,
    kCGWindowStoreType: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowName: 'Item-0',
    kCGWindowBounds: {
      X: 3148,
      Height: 24,
      Y: 0,
      Width: 61
    }
  },
  {
    kCGWindowOwnerName: 'Vanilla',
    kCGWindowAlpha: 0.5,
    kCGWindowBounds: {
      X: 1,
      Height: 1,
      Y: 1438,
      Width: 1
    },
    kCGWindowSharingState: 1,
    kCGWindowNumber: 74,
    kCGWindowLayer: 0,
    kCGWindowName: '',
    kCGWindowMemoryUsage: 2288,
    kCGWindowIsOnscreen: true,
    kCGWindowOwnerPID: 1645,
    kCGWindowStoreType: 1
  },
  {
    kCGWindowNumber: 13571,
    kCGWindowName: 'ChatGPT',
    kCGWindowOwnerPID: 94316,
    kCGWindowBounds: {
      X: 528,
      Height: 1415,
      Y: 25,
      Width: 1081
    },
    kCGWindowAlpha: 1,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerName: 'ChatGPT',
    kCGWindowLayer: 0
  },
  {
    kCGWindowLayer: 0,
    kCGWindowAlpha: 1,
    kCGWindowOwnerName: 'Vanilla',
    kCGWindowNumber: 73,
    kCGWindowBounds: {
      X: 1492,
      Height: 539,
      Y: 319,
      Width: 456
    },
    kCGWindowStoreType: 1,
    kCGWindowSharingState: 1,
    kCGWindowName: 'Preferences',
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 1645
  },
  {
    kCGWindowMemoryUsage: 2288,
    kCGWindowStoreType: 1,
    kCGWindowNumber: 13570,
    kCGWindowOwnerName: 'synergy-tray',
    kCGWindowSharingState: 1,
    kCGWindowOwnerPID: 2289,
    kCGWindowAlpha: 0.10000000149011612,
    kCGWindowBounds: {
      X: 2670,
      Height: 18,
      Y: 35,
      Width: 65
    },
    kCGWindowName: '',
    kCGWindowLayer: 103
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowNumber: 5630,
    kCGWindowOwnerPID: 89750,
    kCGWindowStoreType: 1,
    kCGWindowOwnerName: 'TextInputSwitcher',
    kCGWindowBounds: {
      X: 1596,
      Height: 400,
      Y: 533,
      Width: 247
    },
    kCGWindowName: 'キーボード入力',
    kCGWindowSharingState: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowLayer: 2147483628
  },
  {
    kCGWindowOwnerName: 'Window Server',
    kCGWindowStoreType: 2,
    kCGWindowNumber: 7209,
    kCGWindowSharingState: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowName: 'Desktop',
    kCGWindowOwnerPID: 968,
    kCGWindowLayer: -2147483626,
    kCGWindowAlpha: 1,
    kCGWindowMemoryUsage: 18784
  },
  {
    kCGWindowMemoryUsage: 2288,
    kCGWindowAlpha: 1,
    kCGWindowName: 'アクティビティモニタ',
    kCGWindowOwnerName: 'アクティビティモニタ',
    kCGWindowNumber: 62,
    kCGWindowLayer: 0,
    kCGWindowStoreType: 1,
    kCGWindowOwnerPID: 1393,
    kCGWindowBounds: {
      X: 2140,
      Height: 612,
      Y: 385,
      Width: 960
    },
    kCGWindowSharingState: 1
  },
  {
    kCGWindowStoreType: 2,
    kCGWindowAlpha: 1,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowOwnerPID: 968,
    kCGWindowNumber: 5608,
    kCGWindowLayer: -2147483626,
    kCGWindowMemoryUsage: 18784,
    kCGWindowSharingState: 1,
    kCGWindowName: 'Desktop'
  },
  {
    kCGWindowNumber: 8756,
    kCGWindowOwnerPID: 968,
    kCGWindowMemoryUsage: 18784,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowSharingState: 1,
    kCGWindowLayer: -2147483626,
    kCGWindowAlpha: 1,
    kCGWindowName: 'Desktop',
    kCGWindowStoreType: 2,
    kCGWindowOwnerName: 'Window Server'
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowStoreType: 1,
    kCGWindowOwnerPID: 968,
    kCGWindowSharingState: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowLayer: 0,
    kCGWindowNumber: 22,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    }
  },
  {
    kCGWindowIsOnscreen: true,
    kCGWindowMemoryUsage: 2288,
    kCGWindowLayer: -2147483601,
    kCGWindowSharingState: 1,
    kCGWindowAlpha: 1,
    kCGWindowName: '',
    kCGWindowNumber: 16,
    kCGWindowBounds: {
      X: 1800,
      Height: 360,
      Y: 90,
      Width: 360
    },
    kCGWindowOwnerPID: 1155,
    kCGWindowOwnerName: '通知センター',
    kCGWindowStoreType: 1
  },
  {
    kCGWindowBounds: {
      X: 1449,
      Height: 18,
      Y: 490,
      Width: 64
    },
    kCGWindowStoreType: 1,
    kCGWindowOwnerName: 'Google Chrome',
    kCGWindowSharingState: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowLayer: 103,
    kCGWindowAlpha: 1,
    kCGWindowOwnerPID: 68811,
    kCGWindowName: '',
    kCGWindowNumber: 16292
  },
  {
    kCGWindowSharingState: 1,
    kCGWindowName: 'FocusModes',
    kCGWindowAlpha: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowBounds: {
      X: 2810,
      Height: 24,
      Y: 0,
      Width: 38
    },
    kCGWindowNumber: 15,
    kCGWindowOwnerName: 'コントロールセンター',
    kCGWindowLayer: 25,
    kCGWindowStoreType: 1,
    kCGWindowOwnerPID: 1221
  },
  {
    kCGWindowOwnerPID: 968,
    kCGWindowMemoryUsage: 18784,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowNumber: 6366,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowLayer: -2147483626,
    kCGWindowName: 'Desktop',
    kCGWindowAlpha: 1,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 2
  },
  {
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 1221,
    kCGWindowNumber: 14,
    kCGWindowBounds: {
      X: 2918,
      Height: 24,
      Y: 0,
      Width: 38
    },
    kCGWindowOwnerName: 'コントロールセンター',
    kCGWindowIsOnscreen: true,
    kCGWindowLayer: 25,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 1,
    kCGWindowName: 'Sound',
    kCGWindowAlpha: 1
  },
  {
    kCGWindowSharingState: 1,
    kCGWindowOwnerPID: 1221,
    kCGWindowAlpha: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowIsOnscreen: true,
    kCGWindowStoreType: 1,
    kCGWindowLayer: 25,
    kCGWindowOwnerName: 'コントロールセンター',
    kCGWindowNumber: 13,
    kCGWindowBounds: {
      X: 2886,
      Height: 24,
      Y: 0,
      Width: 32
    },
    kCGWindowName: 'Bluetooth'
  },
  {
    kCGWindowMemoryUsage: 2288,
    kCGWindowLayer: 25,
    kCGWindowOwnerPID: 1221,
    kCGWindowBounds: {
      X: 2848,
      Height: 24,
      Y: 0,
      Width: 38
    },
    kCGWindowStoreType: 1,
    kCGWindowIsOnscreen: true,
    kCGWindowName: 'WiFi',
    kCGWindowSharingState: 1,
    kCGWindowAlpha: 1,
    kCGWindowOwnerName: 'コントロールセンター',
    kCGWindowNumber: 12
  },
  {
    kCGWindowNumber: 11,
    kCGWindowName: 'BentoBox',
    kCGWindowStoreType: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 1221,
    kCGWindowLayer: 25,
    kCGWindowOwnerName: 'コントロールセンター',
    kCGWindowIsOnscreen: true,
    kCGWindowAlpha: 1,
    kCGWindowSharingState: 1,
    kCGWindowBounds: {
      X: 3243,
      Height: 24,
      Y: 0,
      Width: 34
    }
  },
  {
    kCGWindowLayer: 25,
    kCGWindowIsOnscreen: true,
    kCGWindowStoreType: 1,
    kCGWindowNumber: 10,
    kCGWindowAlpha: 1,
    kCGWindowName: 'Clock',
    kCGWindowOwnerPID: 1221,
    kCGWindowOwnerName: 'コントロールセンター',
    kCGWindowMemoryUsage: 2288,
    kCGWindowSharingState: 1,
    kCGWindowBounds: {
      X: 3277,
      Height: 24,
      Y: 0,
      Width: 163
    }
  },
  {
    kCGWindowOwnerName: '通知センター',
    kCGWindowSharingState: 1,
    kCGWindowNumber: 8,
    kCGWindowAlpha: 1,
    kCGWindowOwnerPID: 1155,
    kCGWindowLayer: 23,
    kCGWindowMemoryUsage: 2288,
    kCGWindowName: 'Notification Center',
    kCGWindowStoreType: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    }
  },
  {
    kCGWindowOwnerPID: 968,
    kCGWindowSharingState: 1,
    kCGWindowNumber: 3,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowLayer: 2147483630,
    kCGWindowStoreType: 2,
    kCGWindowBounds: {
      X: 178,
      Height: 18,
      Y: 493,
      Width: 9
    },
    kCGWindowName: 'Cursor',
    kCGWindowMemoryUsage: 18784,
    kCGWindowAlpha: 1
  },
  {
    kCGWindowNumber: 2,
    kCGWindowSharingState: 1,
    kCGWindowLayer: -2147483626,
    kCGWindowOwnerPID: 968,
    kCGWindowStoreType: 2,
    kCGWindowBounds: {
      X: 0,
      Height: 1080,
      Y: 0,
      Width: 1920
    },
    kCGWindowAlpha: 1,
    kCGWindowIsOnscreen: true,
    kCGWindowMemoryUsage: 18784,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowName: 'Desktop'
  },
  {
    kCGWindowStoreType: 1,
    kCGWindowOwnerName: 'Code',
    kCGWindowNumber: 17225,
    kCGWindowMemoryUsage: 2288,
    kCGWindowSharingState: 1,
    kCGWindowAlpha: 1,
    kCGWindowName: '',
    kCGWindowLayer: 0,
    kCGWindowOwnerPID: 88909,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    }
  },
  {
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 2288,
    kCGWindowSharingState: 1,
    kCGWindowNumber: 9682,
    kCGWindowName:
      'katalog — ✳ 言語設定更新 — claude ASDF_INSTALL_PATH=/Users/riin/.asdf/installs/nodejs/20.10.0 — 78×24',
    kCGWindowBounds: {
      X: 2275,
      Height: 371,
      Y: 555,
      Width: 571
    },
    kCGWindowStoreType: 1,
    kCGWindowOwnerPID: 35544,
    kCGWindowAlpha: 1,
    kCGWindowOwnerName: 'ターミナル',
    kCGWindowIsOnscreen: true
  },
  {
    kCGWindowOwnerName: 'Discord',
    kCGWindowOwnerPID: 1384,
    kCGWindowSharingState: 1,
    kCGWindowBounds: {
      X: 1258,
      Height: 32,
      Y: 677,
      Width: 175
    },
    kCGWindowNumber: 5315,
    kCGWindowLayer: 103,
    kCGWindowStoreType: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowName: '',
    kCGWindowAlpha: 1
  },
  {
    kCGWindowName: '最近の項目',
    kCGWindowStoreType: 1,
    kCGWindowOwnerName: 'Finder',
    kCGWindowSharingState: 1,
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      X: 47,
      Height: 436,
      Y: 710,
      Width: 920
    },
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 1397,
    kCGWindowNumber: 5097,
    kCGWindowLayer: 0,
    kCGWindowIsOnscreen: true
  },
  {
    kCGWindowMemoryUsage: 2288,
    kCGWindowStoreType: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 0,
      Y: 0,
      Width: 0
    },
    kCGWindowNumber: 4920,
    kCGWindowSharingState: 1,
    kCGWindowOwnerPID: 59477,
    kCGWindowAlpha: 1,
    kCGWindowLayer: 0
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowSharingState: 1,
    kCGWindowNumber: 13414,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowLayer: -2147483626,
    kCGWindowName: 'Desktop',
    kCGWindowMemoryUsage: 18784,
    kCGWindowOwnerPID: 968,
    kCGWindowStoreType: 2,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    }
  },
  {
    kCGWindowStoreType: 2,
    kCGWindowName: 'Desktop',
    kCGWindowOwnerPID: 968,
    kCGWindowSharingState: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowLayer: -2147483626,
    kCGWindowAlpha: 1,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowMemoryUsage: 18784,
    kCGWindowNumber: 5474
  },
  {
    kCGWindowStoreType: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowName: 'メモ',
    kCGWindowAlpha: 1,
    kCGWindowOwnerPID: 1392,
    kCGWindowOwnerName: 'メモ',
    kCGWindowBounds: {
      X: 1694,
      Height: 656,
      Y: 299,
      Width: 912
    },
    kCGWindowLayer: 0,
    kCGWindowSharingState: 1,
    kCGWindowNumber: 60
  },
  {
    kCGWindowMemoryUsage: 2288,
    kCGWindowAlpha: 1,
    kCGWindowName: '',
    kCGWindowSharingState: 1,
    kCGWindowNumber: 108,
    kCGWindowStoreType: 1,
    kCGWindowOwnerPID: 1623,
    kCGWindowLayer: 25,
    kCGWindowOwnerName: 'Karabiner-NotificationWindow',
    kCGWindowBounds: {
      X: 3030,
      Height: 48,
      Y: 1382,
      Width: 398
    }
  },
  {
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowMemoryUsage: 18784,
    kCGWindowOwnerPID: 968,
    kCGWindowStoreType: 2,
    kCGWindowAlpha: 1,
    kCGWindowLayer: -2147483626,
    kCGWindowName: 'Desktop',
    kCGWindowNumber: 4284,
    kCGWindowSharingState: 1,
    kCGWindowOwnerName: 'Window Server'
  },
  {
    kCGWindowLayer: 0,
    kCGWindowNumber: 4025,
    kCGWindowName: '',
    kCGWindowOwnerName: 'CursorUIViewService',
    kCGWindowSharingState: 1,
    kCGWindowBounds: {
      X: 502,
      Height: 54,
      Y: 1386,
      Width: 54
    },
    kCGWindowAlpha: 1,
    kCGWindowStoreType: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 1411
  },
  {
    kCGWindowName: 'Fluentd 設定検証方法',
    kCGWindowMemoryUsage: 2288,
    kCGWindowStoreType: 1,
    kCGWindowIsOnscreen: true,
    kCGWindowOwnerPID: 68811,
    kCGWindowBounds: {
      X: 343,
      Height: 1102,
      Y: 177,
      Width: 1185
    },
    kCGWindowLayer: 0,
    kCGWindowAlpha: 1,
    kCGWindowOwnerName: 'Google Chrome',
    kCGWindowNumber: 16266,
    kCGWindowSharingState: 1
  },
  {
    kCGWindowLayer: 25,
    kCGWindowOwnerPID: 76062,
    kCGWindowNumber: 2371,
    kCGWindowSharingState: 1,
    kCGWindowOwnerName: 'ChatGPTHelper',
    kCGWindowName: 'Item-0',
    kCGWindowStoreType: 1,
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      X: -2314,
      Height: 24,
      Y: 0,
      Width: 34
    },
    kCGWindowMemoryUsage: 2288
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowNumber: 87,
    kCGWindowOwnerPID: 1388,
    kCGWindowSharingState: 1,
    kCGWindowName: 'DBeaver 23.2.0 - げむすき Secondary',
    kCGWindowBounds: {
      X: 368,
      Height: 781,
      Y: 208,
      Width: 1273
    },
    kCGWindowIsOnscreen: true,
    kCGWindowOwnerName: 'DBeaver',
    kCGWindowMemoryUsage: 2288,
    kCGWindowLayer: 0,
    kCGWindowStoreType: 1
  },
  {
    kCGWindowOwnerName: 'ターミナル',
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowName: '',
    kCGWindowNumber: 17220,
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 35544,
    kCGWindowAlpha: 1,
    kCGWindowLayer: 0
  },
  {
    kCGWindowStoreType: 2,
    kCGWindowAlpha: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowName: 'Desktop',
    kCGWindowOwnerPID: 968,
    kCGWindowNumber: 1737,
    kCGWindowSharingState: 1,
    kCGWindowLayer: -2147483626,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowMemoryUsage: 18784
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowNumber: 15658,
    kCGWindowStoreType: 2,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowOwnerName: 'Window Server',
    kCGWindowName: 'Desktop',
    kCGWindowSharingState: 1,
    kCGWindowOwnerPID: 968,
    kCGWindowMemoryUsage: 18784,
    kCGWindowLayer: -2147483626
  },
  {
    kCGWindowSharingState: 1,
    kCGWindowBounds: {
      X: 881,
      Height: 24,
      Y: 0,
      Width: 48
    },
    kCGWindowStoreType: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 1221,
    kCGWindowAlpha: 1,
    kCGWindowName: 'AudioVideoModule',
    kCGWindowLayer: 25,
    kCGWindowOwnerName: 'コントロールセンター',
    kCGWindowNumber: 230
  },
  {
    kCGWindowBounds: {
      X: 1387,
      Height: 77,
      Y: 851,
      Width: 84
    },
    kCGWindowLayer: 3,
    kCGWindowOwnerPID: 1384,
    kCGWindowMemoryUsage: 2288,
    kCGWindowAlpha: 1,
    kCGWindowOwnerName: 'Discord',
    kCGWindowStoreType: 1,
    kCGWindowSharingState: 1,
    kCGWindowNumber: 227,
    kCGWindowName: ''
  },
  {
    kCGWindowLayer: 8,
    kCGWindowStoreType: 1,
    kCGWindowSharingState: 1,
    kCGWindowOwnerPID: 94316,
    kCGWindowNumber: 13580,
    kCGWindowBounds: {
      X: 1500,
      Height: 89,
      Y: 1287,
      Width: 440
    },
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerName: 'ChatGPT',
    kCGWindowAlpha: 1,
    kCGWindowName: ''
  },
  {
    kCGWindowOwnerPID: 1645,
    kCGWindowLayer: 25,
    kCGWindowOwnerName: 'Vanilla',
    kCGWindowName: 'vanilla_s2',
    kCGWindowMemoryUsage: 2288,
    kCGWindowBounds: {
      X: -7330,
      Height: 24,
      Y: 0,
      Width: 5016
    },
    kCGWindowNumber: 82,
    kCGWindowStoreType: 1,
    kCGWindowAlpha: 1,
    kCGWindowSharingState: 1
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowOwnerName: 'GoogleJapaneseInputRenderer',
    kCGWindowLayer: 100,
    kCGWindowMemoryUsage: 2288,
    kCGWindowSharingState: 1,
    kCGWindowNumber: 299,
    kCGWindowStoreType: 1,
    kCGWindowBounds: {
      X: 927,
      Height: 181,
      Y: 234,
      Width: 300
    },
    kCGWindowOwnerPID: 1181
  },
  {
    kCGWindowNumber: 1656,
    kCGWindowOwnerName: 'loginwindow',
    kCGWindowStoreType: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 500,
      Y: 940,
      Width: 500
    },
    kCGWindowLayer: 0,
    kCGWindowSharingState: 1,
    kCGWindowOwnerPID: 962,
    kCGWindowAlpha: 1,
    kCGWindowName: '',
    kCGWindowMemoryUsage: 2288
  },
  {
    kCGWindowNumber: 4038,
    kCGWindowName: '',
    kCGWindowBounds: {
      X: 528,
      Height: 54,
      Y: 1386,
      Width: 54
    },
    kCGWindowOwnerPID: 1411,
    kCGWindowLayer: 0,
    kCGWindowMemoryUsage: 2288,
    kCGWindowStoreType: 1,
    kCGWindowOwnerName: 'CursorUIViewService',
    kCGWindowAlpha: 1,
    kCGWindowSharingState: 1
  },
  {
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowName: 'Desktop',
    kCGWindowLayer: -2147483626,
    kCGWindowSharingState: 1,
    kCGWindowOwnerPID: 968,
    kCGWindowMemoryUsage: 18784,
    kCGWindowNumber: 1871,
    kCGWindowStoreType: 2,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowAlpha: 1
  },
  {
    kCGWindowStoreType: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerName: 'Dock',
    kCGWindowNumber: 37,
    kCGWindowAlpha: 1,
    kCGWindowOwnerPID: 1395,
    kCGWindowSharingState: 1,
    kCGWindowLayer: 20,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowName: 'Dock'
  },
  {
    kCGWindowMemoryUsage: 2288,
    kCGWindowStoreType: 1,
    kCGWindowName: 'LPSpringboard',
    kCGWindowOwnerName: 'Dock',
    kCGWindowNumber: 36,
    kCGWindowLayer: 20,
    kCGWindowBounds: {
      X: 0,
      Height: 918,
      Y: 0,
      Width: 1470
    },
    kCGWindowAlpha: 1,
    kCGWindowOwnerPID: 1395,
    kCGWindowSharingState: 1
  },
  {
    kCGWindowSharingState: 1,
    kCGWindowBounds: {
      X: 812,
      Height: 37,
      Y: 234,
      Width: 115
    },
    kCGWindowAlpha: 1,
    kCGWindowLayer: 101,
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 1181,
    kCGWindowStoreType: 1,
    kCGWindowOwnerName: 'GoogleJapaneseInputRenderer',
    kCGWindowNumber: 171
  },
  {
    kCGWindowOwnerPID: 1637,
    kCGWindowStoreType: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowAlpha: 1,
    kCGWindowNumber: 70,
    kCGWindowLayer: 25,
    kCGWindowName: 'Item-0',
    kCGWindowOwnerName: 'TextInputMenuAgent',
    kCGWindowIsOnscreen: true,
    kCGWindowBounds: {
      X: 2804,
      Height: 24,
      Y: 0,
      Width: 44
    },
    kCGWindowSharingState: 1
  },
  {
    kCGWindowSharingState: 1,
    kCGWindowOwnerName: 'ターミナル',
    kCGWindowLayer: 0,
    kCGWindowNumber: 4788,
    kCGWindowStoreType: 1,
    kCGWindowBounds: {
      X: 1473,
      Height: 371,
      Y: 603,
      Width: 627
    },
    kCGWindowName:
      'taskbar — ✳ taskbarHelper デバッグ — claude SSH_AUTH_SOCK=/private/tmp/com.apple.launchd.TRTVwpyKGz/Listeners — 86×24',
    kCGWindowOwnerPID: 35544,
    kCGWindowIsOnscreen: true,
    kCGWindowMemoryUsage: 2288,
    kCGWindowAlpha: 1
  },
  {
    kCGWindowAlpha: 1,
    kCGWindowSharingState: 1,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowName: 'Desktop',
    kCGWindowNumber: 7982,
    kCGWindowLayer: -2147483626,
    kCGWindowStoreType: 2,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowOwnerPID: 968,
    kCGWindowMemoryUsage: 18784
  },
  {
    kCGWindowNumber: 42,
    kCGWindowOwnerName: 'Finder',
    kCGWindowOwnerPID: 1397,
    kCGWindowLayer: -2147483603,
    kCGWindowIsOnscreen: true,
    kCGWindowSharingState: 1,
    kCGWindowName: '',
    kCGWindowStoreType: 1,
    kCGWindowAlpha: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    }
  },
  {
    kCGWindowNumber: 4791,
    kCGWindowBounds: {
      X: 136,
      Height: 77,
      Y: 608,
      Width: 84
    },
    kCGWindowStoreType: 1,
    kCGWindowAlpha: 1,
    kCGWindowLayer: 3,
    kCGWindowName: '',
    kCGWindowSharingState: 1,
    kCGWindowOwnerPID: 35544,
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerName: 'ターミナル'
  },
  {
    kCGWindowStoreType: 1,
    kCGWindowBounds: {
      X: 1098,
      Height: 720,
      Y: 191,
      Width: 1279
    },
    kCGWindowNumber: 69,
    kCGWindowLayer: 0,
    kCGWindowAlpha: 1,
    kCGWindowIsOnscreen: true,
    kCGWindowSharingState: 1,
    kCGWindowOwnerName: 'Discord',
    kCGWindowMemoryUsage: 2288,
    kCGWindowOwnerPID: 1384,
    kCGWindowName: '#times_riin | ナマロンゲ - Discord'
  },
  {
    kCGWindowIsOnscreen: true,
    kCGWindowMemoryUsage: 2288,
    kCGWindowName: 'Menubar',
    kCGWindowNumber: 21,
    kCGWindowOwnerPID: 968,
    kCGWindowStoreType: 1,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowSharingState: 1,
    kCGWindowBounds: {
      X: 0,
      Height: 24,
      Y: 0,
      Width: 3440
    },
    kCGWindowAlpha: 1,
    kCGWindowLayer: 24
  },
  {
    kCGWindowMemoryUsage: 2288,
    kCGWindowAlpha: 1,
    kCGWindowLayer: 0,
    kCGWindowNumber: 159,
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 1,
    kCGWindowOwnerName: 'メモ',
    kCGWindowName: '',
    kCGWindowOwnerPID: 1392,
    kCGWindowBounds: {
      X: 0,
      Height: 500,
      Y: 940,
      Width: 500
    }
  },
  {
    kCGWindowBounds: {
      X: 2306,
      Height: 35,
      Y: 686,
      Width: 188
    },
    kCGWindowStoreType: 1,
    kCGWindowAlpha: 1,
    kCGWindowOwnerPID: 1451,
    kCGWindowSharingState: 1,
    kCGWindowOwnerName: 'LocalAuthenticationRemoteServic',
    kCGWindowMemoryUsage: 2288,
    kCGWindowName: '',
    kCGWindowLayer: 0,
    kCGWindowNumber: 61
  },
  {
    kCGWindowMemoryUsage: 2288,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowStoreType: 1,
    kCGWindowAlpha: 1,
    kCGWindowIsOnscreen: true,
    kCGWindowName: 'Wallpaper-',
    kCGWindowLayer: -2147483624,
    kCGWindowOwnerName: 'Dock',
    kCGWindowNumber: 17181,
    kCGWindowOwnerPID: 1395,
    kCGWindowSharingState: 1
  },
  {
    kCGWindowSharingState: 1,
    kCGWindowOwnerName: 'synergy-tray',
    kCGWindowName: 'Item-0',
    kCGWindowNumber: 110,
    kCGWindowMemoryUsage: 2288,
    kCGWindowLayer: 25,
    kCGWindowStoreType: 1,
    kCGWindowAlpha: 1,
    kCGWindowOwnerPID: 2289,
    kCGWindowBounds: {
      X: -2280,
      Height: 24,
      Y: 0,
      Width: 34
    }
  },
  {
    kCGWindowNumber: 109,
    kCGWindowBounds: {
      X: 3022,
      Height: 24,
      Y: 1374,
      Width: 24
    },
    kCGWindowName: '',
    kCGWindowOwnerPID: 1623,
    kCGWindowStoreType: 1,
    kCGWindowAlpha: 1,
    kCGWindowLayer: 25,
    kCGWindowMemoryUsage: 2288,
    kCGWindowSharingState: 1,
    kCGWindowOwnerName: 'Karabiner-NotificationWindow'
  },
  {
    kCGWindowNumber: 4149,
    kCGWindowOwnerName: 'Window Server',
    kCGWindowSharingState: 1,
    kCGWindowStoreType: 2,
    kCGWindowName: 'Desktop',
    kCGWindowLayer: -2147483626,
    kCGWindowMemoryUsage: 18784,
    kCGWindowBounds: {
      X: 0,
      Height: 1440,
      Y: 0,
      Width: 3440
    },
    kCGWindowOwnerPID: 968,
    kCGWindowAlpha: 1
  },
  {
    kCGWindowBounds: {
      X: 0,
      Height: 54,
      Y: 940,
      Width: 54
    },
    kCGWindowStoreType: 1,
    kCGWindowOwnerName: 'Finder',
    kCGWindowOwnerPID: 1397,
    kCGWindowName: '',
    kCGWindowSharingState: 1,
    kCGWindowMemoryUsage: 2288,
    kCGWindowLayer: 0,
    kCGWindowAlpha: 1,
    kCGWindowNumber: 49
  }
]

/**
 * テスト用ヘルパー関数
 */
export const testHelpers = {
  /**
   * ウィンドウ配列からPIDでフィルタリング
   */
  filterByPID: (windows: MacWindow[], pid: number): MacWindow[] => {
    return windows.filter((win) => win.kCGWindowOwnerPID === pid)
  },

  /**
   * ウィンドウ配列からアプリ名でフィルタリング
   */
  filterByAppName: (windows: MacWindow[], appName: string): MacWindow[] => {
    return windows.filter((win) => win.kCGWindowOwnerName === appName)
  },

  /**
   * オンスクリーンウィンドウのみ取得
   */
  getOnscreenWindows: (windows: MacWindow[]): MacWindow[] => {
    return windows.filter((win) => win.kCGWindowIsOnscreen)
  },

  /**
   * 最小サイズ以上のウィンドウのみ取得
   */
  filterByMinSize: (windows: MacWindow[], minWidth = 40, minHeight = 40): MacWindow[] => {
    return windows.filter(
      (win) => win.kCGWindowBounds.Width >= minWidth && win.kCGWindowBounds.Height >= minHeight
    )
  },

  /**
   * テスト用のランダムなウィンドウデータ生成
   */
  generateRandomWindow: (overrides: Partial<MacWindow> = {}): MacWindow => {
    const random = Math.random()
    return {
      kCGWindowAlpha: 1,
      kCGWindowBounds: {
        Height: Math.floor(random * 800) + 200,
        Width: Math.floor(random * 1200) + 300,
        X: Math.floor(random * 1000),
        Y: Math.floor(random * 800)
      },
      kCGWindowIsOnscreen: true,
      kCGWindowLayer: 0,
      kCGWindowMemoryUsage: Math.floor(random * 5000000) + 100000,
      kCGWindowName: `Test Window ${Math.floor(random * 1000)}`,
      kCGWindowNumber: Math.floor(random * 100000) + 10000,
      kCGWindowOwnerName: 'TestApp',
      kCGWindowOwnerPID: Math.floor(random * 10000) + 1000,
      kCGWindowSharingState: 1,
      kCGWindowStoreType: 2,
      ...overrides
    }
  }
}
