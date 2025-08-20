import ElectronStore from 'electron-store'
import { migrateLegacyFiltersToLabeled, detectFilterFormat } from './filter-migration'

type NumberFilter = {
  property:
    | 'X'
    | 'Y'
    | 'Height'
    | 'Width'
    | 'kCGWindowMemoryUsage'
    | 'kCGWindowOwnerPID'
    | 'kCGWindowNumber'
  is: number
}
type StringFilter = {
  property: 'kCGWindowOwnerName' | 'kCGWindowName'
  is: string
}
type BooleanFilter = {
  property: 'kCGWindowStoreType' | 'kCGWindowIsOnscreen'
  is: boolean
}

type Filter = NumberFilter | StringFilter | BooleanFilter

type LabeledFilters = {
  label: string
  filters: Filter[]
}

type LegacyFilter = {
  property: string
  is: string | number | boolean
}
type LegacyFilters = LegacyFilter[][]

type LayoutType = 'right' | 'left' | 'bottom'
export const store = new ElectronStore({
  migrations: {
    '>=1.6.2': (store): void => {
      store.set('headers', [])
      store.set('footers', [])
    },
    '>=2.0.0': (store): void => {
      // LegacyFilter形式からLabeledFilters形式への移行
      try {
        const existingFilters = store.get('filters', [])
        const existingLabeledFilters = store.get('labeledFilters', [])

        // すでにLabeledFilters形式が存在する場合はスキップ
        if (existingLabeledFilters.length > 0) {
          console.log('LabeledFilters already exist, skipping migration')
          return
        }

        // フィルター形式を検出
        const filterFormat = detectFilterFormat(existingFilters)

        if (filterFormat === 'legacy' && existingFilters.length > 0) {
          console.log('Migrating legacy filters to labeled format...')

          // バックアップを作成
          store.set('filters_backup_v1', existingFilters)

          // LegacyFilter形式をLabeledFilters形式に変換
          const labeledFilters = migrateLegacyFiltersToLabeled(existingFilters)

          // 新しい形式で保存
          store.set('labeledFilters', labeledFilters)

          // 古い形式を削除
          store.delete('filters')

          console.log(`Successfully migrated ${labeledFilters.length} filter groups`)
        } else if (filterFormat === 'unknown' && existingFilters.length > 0) {
          console.warn('Unknown filter format detected, keeping original data')
        } else {
          console.log('No legacy filters to migrate')
        }
      } catch (error) {
        console.error('Filter migration failed:', error)

        // エラー時はバックアップから復元
        const backup = store.get('filters_backup_v1')
        if (backup) {
          store.set('filters', backup)
          store.delete('filters_backup_v1')
          console.log('Restored filters from backup due to migration failure')
        }

        // エラーでもアプリの起動は継続
      }
    }
  },
  defaults: {
    options: {
      layout: 'bottom' as LayoutType,
      windowSortByPositionInApp: false,
      headers: [] as string[],
      footers: [] as string[]
    },
    // 新しいLabeledFilters形式のデフォルト
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
    ] as LabeledFilters[]
  }
})
export type Options = typeof store.store.options
