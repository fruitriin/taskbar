import type { LegacyFilter, Filter, LabeledFilters } from '@/funcs/store'

/**
 * Legacy Filter形式のテストデータ
 */
export const legacyFilterFixtures = {
  // 基本的なシングルフィルター
  singleFilters: [
    [{ property: 'kCGWindowIsOnscreen', is: false }],
    [{ property: 'kCGWindowOwnerName', is: 'Dock' }],
    [{ property: 'kCGWindowOwnerName', is: 'DockHelper' }],
    [{ property: 'kCGWindowOwnerName', is: 'screencapture' }],
    [{ property: 'kCGWindowOwnerName', is: 'スクリーンショット' }],
    [{ property: 'kCGWindowName', is: 'Notification Center' }],
    [{ property: 'kCGWindowOwnerName', is: '通知センター' }],
    [{ property: 'kCGWindowName', is: 'Item-0' }],
    [{ property: 'kCGWindowOwnerName', is: 'Window Server' }],
    [{ property: 'kCGWindowOwnerName', is: 'コントロールセンター' }],
    [{ property: 'kCGWindowOwnerName', is: 'Spotlight' }],
    [{ property: 'kCGWindowOwnerName', is: 'GoogleJapaneseInputRenderer' }],
    [{ property: 'kCGWindowOwnerName', is: 'taskbar.fm' }],
    [{ property: 'kCGWindowName', is: 'taskbar.fm' }]
  ] as LegacyFilter[][],

  // 複合フィルター（AND条件）
  complexFilters: [
    [
      { property: 'kCGWindowOwnerName', is: 'Finder' },
      { property: 'kCGWindowName', is: '' }
    ],
    [
      { property: 'kCGWindowOwnerName', is: 'Safari' },
      { property: 'kCGWindowIsOnscreen', is: true },
      { property: 'X', is: 0 }
    ],
    [
      { property: 'kCGWindowOwnerName', is: 'Chrome' },
      { property: 'Height', is: 0 },
      { property: 'Width', is: 0 }
    ]
  ] as LegacyFilter[][],

  // 数値フィルター
  numberFilters: [
    [{ property: 'X', is: 100 }],
    [{ property: 'Y', is: 200 }],
    [{ property: 'Height', is: 300 }],
    [{ property: 'Width', is: 400 }],
    [{ property: 'kCGWindowMemoryUsage', is: 1024 }],
    [{ property: 'kCGWindowOwnerPID', is: 12345 }],
    [{ property: 'kCGWindowNumber', is: 678 }]
  ] as LegacyFilter[][],

  // ブール値フィルター
  booleanFilters: [
    [{ property: 'kCGWindowStoreType', is: true }],
    [{ property: 'kCGWindowStoreType', is: false }],
    [{ property: 'kCGWindowIsOnscreen', is: true }],
    [{ property: 'kCGWindowIsOnscreen', is: false }]
  ] as LegacyFilter[][],

  // 無効なデータ（テスト用）
  invalidFilters: [
    [{ property: '', is: 'value' }], // 空のプロパティ
    [{ property: 'invalidProperty', is: 'value' }], // 存在しないプロパティ
    [{ property: 'kCGWindowOwnerName', is: '' }], // 空の値
    [{ property: 'X', is: 'string' }], // 型不一致
    [{ property: 'kCGWindowIsOnscreen', is: 'true' }], // 文字列のブール値
  ] as any[][],

  // 空・null・undefinedケース
  edgeCases: {
    empty: [] as LegacyFilter[][],
    emptyGroup: [[]] as LegacyFilter[][],
    nullProperty: [{ property: null, is: 'value' }] as any,
    undefinedIs: [{ property: 'kCGWindowOwnerName', is: undefined }] as any,
    missingProperty: [{ is: 'value' }] as any,
    missingIs: [{ property: 'kCGWindowOwnerName' }] as any
  },

  // 実際のデフォルトフィルター（現在のstore.tsから）
  defaultFilters: [
    [{ property: 'kCGWindowIsOnscreen', is: false }],
    [{ property: 'kCGWindowOwnerName', is: 'Dock' }],
    [{ property: 'kCGWindowOwnerName', is: 'DockHelper' }],
    [{ property: 'kCGWindowOwnerName', is: 'screencapture' }],
    [{ property: 'kCGWindowOwnerName', is: 'スクリーンショット' }],
    [{ property: 'kCGWindowName', is: 'Notification Center' }],
    [{ property: 'kCGWindowOwnerName', is: '通知センター' }],
    [{ property: 'kCGWindowName', is: 'Item-0' }],
    [{ property: 'kCGWindowOwnerName', is: 'Window Server' }],
    [{ property: 'kCGWindowOwnerName', is: 'コントロールセンター' }],
    [{ property: 'kCGWindowOwnerName', is: 'Spotlight' }],
    [{ property: 'kCGWindowOwnerName', is: 'GoogleJapaneseInputRenderer' }],
    [{ property: 'kCGWindowOwnerName', is: 'taskbar.fm' }],
    [{ property: 'kCGWindowName', is: 'taskbar.fm' }],
    [
      { property: 'kCGWindowOwnerName', is: 'Finder' },
      { property: 'kCGWindowName', is: '' }
    ]
  ] as LegacyFilter[][]
}

/**
 * Labeled Filter形式のテストデータ
 */
export const labeledFilterFixtures = {
  // 基本的なシングルフィルター
  singleFilters: [
    {
      label: 'オフスクリーンウィンドウを除外',
      filters: [{ property: 'kCGWindowIsOnscreen', is: false }]
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
      label: 'Spotlightを除外',
      filters: [{ property: 'kCGWindowOwnerName', is: 'Spotlight' }]
    },
    {
      label: 'Taskbar.fmを除外',
      filters: [{ property: 'kCGWindowOwnerName', is: 'taskbar.fm' }]
    }
  ] as LabeledFilters[],

  // 複合フィルター（AND条件）
  complexFilters: [
    {
      label: '空のFinderウィンドウを除外',
      filters: [
        { property: 'kCGWindowOwnerName', is: 'Finder' },
        { property: 'kCGWindowName', is: '' }
      ]
    },
    {
      label: 'オンスクリーンのSafariウィンドウ（左上原点）を除外',
      filters: [
        { property: 'kCGWindowOwnerName', is: 'Safari' },
        { property: 'kCGWindowIsOnscreen', is: true },
        { property: 'X', is: 0 }
      ]
    },
    {
      label: 'サイズが0のChromeウィンドウを除外',
      filters: [
        { property: 'kCGWindowOwnerName', is: 'Chrome' },
        { property: 'Height', is: 0 },
        { property: 'Width', is: 0 }
      ]
    }
  ] as LabeledFilters[],

  // 数値フィルター
  numberFilters: [
    {
      label: 'X座標100の位置を除外',
      filters: [{ property: 'X', is: 100 }]
    },
    {
      label: 'Y座標200の位置を除外',
      filters: [{ property: 'Y', is: 200 }]
    },
    {
      label: '高さ300のウィンドウを除外',
      filters: [{ property: 'Height', is: 300 }]
    },
    {
      label: '幅400のウィンドウを除外',
      filters: [{ property: 'Width', is: 400 }]
    },
    {
      label: 'メモリ使用量1024のウィンドウを除外',
      filters: [{ property: 'kCGWindowMemoryUsage', is: 1024 }]
    },
    {
      label: 'プロセスID 12345を除外',
      filters: [{ property: 'kCGWindowOwnerPID', is: 12345 }]
    },
    {
      label: 'ウィンドウ番号678を除外',
      filters: [{ property: 'kCGWindowNumber', is: 678 }]
    }
  ] as LabeledFilters[],

  // ブール値フィルター
  booleanFilters: [
    {
      label: 'ストアタイプTrueを除外',
      filters: [{ property: 'kCGWindowStoreType', is: true }]
    },
    {
      label: 'ストアタイプFalseを除外',
      filters: [{ property: 'kCGWindowStoreType', is: false }]
    },
    {
      label: 'オンスクリーンウィンドウを除外',
      filters: [{ property: 'kCGWindowIsOnscreen', is: true }]
    },
    {
      label: 'オフスクリーンウィンドウを除外',
      filters: [{ property: 'kCGWindowIsOnscreen', is: false }]
    }
  ] as LabeledFilters[],

  // カスタムラベル
  customLabels: [
    {
      label: '開発用フィルター',
      filters: [{ property: 'kCGWindowOwnerName', is: 'Xcode' }]
    },
    {
      label: 'ゲームウィンドウを除外',
      filters: [{ property: 'kCGWindowOwnerName', is: 'Steam' }]
    },
    {
      label: '作業用ブラウザタブ',
      filters: [
        { property: 'kCGWindowOwnerName', is: 'Chrome' },
        { property: 'kCGWindowName', is: 'GitHub' }
      ]
    }
  ] as LabeledFilters[],

  // デフォルトフィルターのLabeled版
  defaultLabeledFilters: [
    {
      label: 'オフスクリーンウィンドウを除外',
      filters: [{ property: 'kCGWindowIsOnscreen', is: false }]
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
  ] as LabeledFilters[]
}

/**
 * Type-safe Filter形式のテストデータ
 */
export const typeSafeFilterFixtures = {
  stringFilters: [
    { property: 'kCGWindowOwnerName', is: 'Dock' },
    { property: 'kCGWindowOwnerName', is: 'Safari' },
    { property: 'kCGWindowName', is: 'Untitled' },
    { property: 'kCGWindowName', is: '' }
  ] as Filter[],

  numberFilters: [
    { property: 'X', is: 100 },
    { property: 'Y', is: 200 },
    { property: 'Height', is: 600 },
    { property: 'Width', is: 800 },
    { property: 'kCGWindowMemoryUsage', is: 2048 },
    { property: 'kCGWindowOwnerPID', is: 54321 },
    { property: 'kCGWindowNumber', is: 999 }
  ] as Filter[],

  booleanFilters: [
    { property: 'kCGWindowStoreType', is: true },
    { property: 'kCGWindowStoreType', is: false },
    { property: 'kCGWindowIsOnscreen', is: true },
    { property: 'kCGWindowIsOnscreen', is: false }
  ] as Filter[]
}

/**
 * マイグレーション前後の対応テストデータ
 */
export const migrationTestPairs = {
  pairs: [
    {
      legacy: [[{ property: 'kCGWindowOwnerName', is: 'Dock' }]],
      labeled: [{
        label: 'Dockを除外',
        filters: [{ property: 'kCGWindowOwnerName', is: 'Dock' }]
      }]
    },
    {
      legacy: [
        [
          { property: 'kCGWindowOwnerName', is: 'Finder' },
          { property: 'kCGWindowName', is: '' }
        ]
      ],
      labeled: [{
        label: '空のFinderウィンドウを除外',
        filters: [
          { property: 'kCGWindowOwnerName', is: 'Finder' },
          { property: 'kCGWindowName', is: '' }
        ]
      }]
    },
    {
      legacy: [
        [{ property: 'kCGWindowIsOnscreen', is: false }],
        [{ property: 'X', is: 0 }],
        [{ property: 'kCGWindowStoreType', is: true }]
      ],
      labeled: [
        {
          label: 'オフスクリーンウィンドウを除外',
          filters: [{ property: 'kCGWindowIsOnscreen', is: false }]
        },
        {
          label: 'X座標0の位置を除外',
          filters: [{ property: 'X', is: 0 }]
        },
        {
          label: 'ストアタイプTrueを除外',
          filters: [{ property: 'kCGWindowStoreType', is: true }]
        }
      ]
    }
  ] as { legacy: LegacyFilter[][], labeled: LabeledFilters[] }[]
}

/**
 * バリデーション用のテストケース
 */
export const validationTestCases = {
  validLegacyFilters: legacyFilterFixtures.defaultFilters,
  invalidLegacyFilters: legacyFilterFixtures.invalidFilters,
  validLabeledFilters: labeledFilterFixtures.defaultLabeledFilters,
  invalidLabeledFilters: [
    { label: '', filters: [] }, // 空のラベル
    { label: 'Valid Label', filters: [] }, // 空のフィルター配列
    { filters: [{ property: 'kCGWindowOwnerName', is: 'Test' }] }, // ラベル欠如
    { label: 'Test', filters: [{ property: 'invalid', is: 'test' }] } // 無効なプロパティ
  ] as any[]
}