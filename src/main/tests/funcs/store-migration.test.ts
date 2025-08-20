import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ElectronStore from 'electron-store'
import type { LegacyFilter, LabeledFilters } from '@/funcs/store'

// テスト用のモックストア
const createMockStore = (initialData: any = {}) => {
  let storeData = { ...initialData }
  
  return {
    get: vi.fn((key: string, defaultValue?: any) => {
      const keys = key.split('.')
      let current = storeData
      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k]
        } else {
          return defaultValue
        }
      }
      return current
    }),
    set: vi.fn((key: string, value: any) => {
      const keys = key.split('.')
      let current = storeData
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i]
        if (!(k in current) || typeof current[k] !== 'object') {
          current[k] = {}
        }
        current = current[k]
      }
      current[keys[keys.length - 1]] = value
    }),
    delete: vi.fn((key: string) => {
      const keys = key.split('.')
      let current = storeData
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i]
        if (!(k in current) || typeof current[k] !== 'object') {
          return
        }
        current = current[k]
      }
      delete current[keys[keys.length - 1]]
    }),
    has: vi.fn((key: string) => {
      const keys = key.split('.')
      let current = storeData
      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k]
        } else {
          return false
        }
      }
      return true
    }),
    clear: vi.fn(() => {
      storeData = {}
    }),
    store: storeData
  }
}

describe('Store Migration', () => {
  let mockStore: ReturnType<typeof createMockStore>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Legacy filters detection', () => {
    it('LegacyFilter形式を正しく検出する', () => {
      const legacyFilters: LegacyFilter[][] = [
        [{ property: 'kCGWindowOwnerName', is: 'Dock' }],
        [{ property: 'kCGWindowIsOnscreen', is: false }]
      ]

      mockStore = createMockStore({
        filters: legacyFilters
      })

      const filters = mockStore.get('filters')
      
      // Legacy形式の特徴をチェック
      expect(Array.isArray(filters)).toBe(true)
      expect(Array.isArray(filters[0])).toBe(true)
      expect(typeof filters[0][0].property).toBe('string')
      expect(filters[0][0].hasOwnProperty('is')).toBe(true)
      expect(filters[0][0].hasOwnProperty('label')).toBe(false) // LabeledFiltersにはない
    })

    it('LabeledFilters形式を正しく検出する', () => {
      const labeledFilters: LabeledFilters[] = [
        {
          label: 'Dockを除外',
          filters: [{ property: 'kCGWindowOwnerName', is: 'Dock' }]
        }
      ]

      mockStore = createMockStore({
        labeledFilters: labeledFilters
      })

      const filters = mockStore.get('labeledFilters')
      
      // LabeledFilters形式の特徴をチェック
      expect(Array.isArray(filters)).toBe(true)
      expect(typeof filters[0].label).toBe('string')
      expect(Array.isArray(filters[0].filters)).toBe(true)
    })

    it('空の配列を適切に処理する', () => {
      mockStore = createMockStore({
        filters: []
      })

      const filters = mockStore.get('filters')
      expect(Array.isArray(filters)).toBe(true)
      expect(filters.length).toBe(0)
    })
  })

  describe('Migration version handling', () => {
    it('バージョン2.0.0のマイグレーションを実行する', () => {
      const legacyFilters: LegacyFilter[][] = [
        [{ property: 'kCGWindowOwnerName', is: 'Dock' }],
        [{ property: 'kCGWindowIsOnscreen', is: false }],
        [
          { property: 'kCGWindowOwnerName', is: 'Finder' },
          { property: 'kCGWindowName', is: '' }
        ]
      ]

      mockStore = createMockStore({
        filters: legacyFilters
      })

      // マイグレーション関数をシミュレート
      const migration2_0_0 = (store: any) => {
        const oldFilters = store.get('filters', [])
        if (oldFilters.length > 0 && Array.isArray(oldFilters[0])) {
          // LegacyFilter形式を検出した場合の処理
          const labeledFilters: LabeledFilters[] = []
          
          oldFilters.forEach((filterGroup: LegacyFilter[], index: number) => {
            labeledFilters.push({
              label: `フィルターグループ ${index + 1}`,
              filters: filterGroup as any // 実際の変換は後で実装
            })
          })
          
          store.set('labeledFilters', labeledFilters)
          store.delete('filters')
        }
      }

      migration2_0_0(mockStore)

      // マイグレーション後の状態を確認
      expect(mockStore.has('labeledFilters')).toBe(true)
      expect(mockStore.has('filters')).toBe(false)
      
      const migratedFilters = mockStore.get('labeledFilters')
      expect(migratedFilters).toHaveLength(3)
      expect(migratedFilters[0].label).toBe('フィルターグループ 1')
    })

    it('すでにLabeledFilters形式の場合はマイグレーションをスキップする', () => {
      const labeledFilters: LabeledFilters[] = [
        {
          label: 'Dockを除外',
          filters: [{ property: 'kCGWindowOwnerName', is: 'Dock' }]
        }
      ]

      mockStore = createMockStore({
        labeledFilters: labeledFilters
      })

      const migration2_0_0 = (store: any) => {
        const oldFilters = store.get('filters', [])
        const existingLabeledFilters = store.get('labeledFilters', [])
        
        if (existingLabeledFilters.length > 0) {
          // すでにLabeledFilters形式が存在する場合はスキップ
          return
        }
        
        if (oldFilters.length > 0 && Array.isArray(oldFilters[0])) {
          // マイグレーション処理
        }
      }

      const originalFilters = mockStore.get('labeledFilters')
      migration2_0_0(mockStore)
      const afterMigration = mockStore.get('labeledFilters')

      expect(afterMigration).toEqual(originalFilters)
    })
  })

  describe('Migration data integrity', () => {
    it('マイグレーション後にデータが正しく保持される', () => {
      const originalLegacyFilters: LegacyFilter[][] = [
        [{ property: 'kCGWindowOwnerName', is: 'Dock' }],
        [{ property: 'kCGWindowIsOnscreen', is: false }],
        [
          { property: 'kCGWindowOwnerName', is: 'Finder' },
          { property: 'kCGWindowName', is: '' }
        ]
      ]

      mockStore = createMockStore({
        filters: originalLegacyFilters
      })

      // データの整合性を保つマイグレーション
      const migration2_0_0 = (store: any) => {
        const oldFilters = store.get('filters', [])
        
        if (oldFilters.length > 0 && Array.isArray(oldFilters[0])) {
          const labeledFilters: LabeledFilters[] = oldFilters.map((filterGroup: LegacyFilter[], index: number) => ({
            label: `マイグレーションフィルター ${index + 1}`,
            filters: filterGroup
          }))
          
          store.set('labeledFilters', labeledFilters)
          store.delete('filters')
        }
      }

      migration2_0_0(mockStore)

      const migratedFilters = mockStore.get('labeledFilters')
      
      // 元のデータ数と一致することを確認
      expect(migratedFilters).toHaveLength(originalLegacyFilters.length)
      
      // 各フィルターグループの内容が保持されていることを確認
      migratedFilters.forEach((labeledFilter: LabeledFilters, index: number) => {
        expect(labeledFilter.filters).toEqual(originalLegacyFilters[index])
      })
    })

    it('マイグレーション中にエラーが発生した場合の処理', () => {
      const corruptedData = [
        null,
        undefined,
        [{ property: '', is: null }], // 無効なデータ
        [{ property: 'kCGWindowOwnerName' }] // isプロパティが欠如
      ]

      mockStore = createMockStore({
        filters: corruptedData
      })

      const migration2_0_0 = (store: any) => {
        try {
          const oldFilters = store.get('filters', [])
          const validFilters = oldFilters.filter((filterGroup: any) => {
            return Array.isArray(filterGroup) && 
                   filterGroup.length > 0 &&
                   filterGroup.every((filter: any) => 
                     filter && 
                     typeof filter.property === 'string' && 
                     filter.property.length > 0 &&
                     filter.hasOwnProperty('is') &&
                     filter.is !== null &&
                     filter.is !== undefined
                   )
          })

          if (validFilters.length > 0) {
            const labeledFilters: LabeledFilters[] = validFilters.map((filterGroup: LegacyFilter[], index: number) => ({
              label: `有効フィルター ${index + 1}`,
              filters: filterGroup
            }))
            
            store.set('labeledFilters', labeledFilters)
          } else {
            // 有効なフィルターがない場合はデフォルトを設定
            store.set('labeledFilters', [])
          }
          
          store.delete('filters')
        } catch (error) {
          console.error('Migration failed:', error)
          // エラー時はデフォルト値を設定
          store.set('labeledFilters', [])
        }
      }

      expect(() => migration2_0_0(mockStore)).not.toThrow()
      
      const result = mockStore.get('labeledFilters')
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('Migration rollback scenarios', () => {
    it('マイグレーション失敗時にロールバック可能な状態を維持', () => {
      const originalFilters: LegacyFilter[][] = [
        [{ property: 'kCGWindowOwnerName', is: 'Dock' }]
      ]

      mockStore = createMockStore({
        filters: originalFilters
      })

      // バックアップを作成するマイグレーション
      const safeMigration2_0_0 = (store: any) => {
        const oldFilters = store.get('filters', [])
        
        // バックアップ作成
        store.set('filters_backup', oldFilters)
        
        try {
          if (oldFilters.length > 0 && Array.isArray(oldFilters[0])) {
            const labeledFilters: LabeledFilters[] = oldFilters.map((filterGroup: LegacyFilter[], index: number) => ({
              label: `フィルター ${index + 1}`,
              filters: filterGroup
            }))
            
            store.set('labeledFilters', labeledFilters)
            store.delete('filters')
            store.delete('filters_backup') // 成功時はバックアップ削除
          }
        } catch (error) {
          // 失敗時はバックアップからリストア
          const backup = store.get('filters_backup')
          if (backup) {
            store.set('filters', backup)
            store.delete('filters_backup')
          }
          throw error
        }
      }

      safeMigration2_0_0(mockStore)

      // マイグレーションが成功していることを確認
      expect(mockStore.has('labeledFilters')).toBe(true)
      expect(mockStore.has('filters')).toBe(false)
      expect(mockStore.has('filters_backup')).toBe(false)
    })
  })
})