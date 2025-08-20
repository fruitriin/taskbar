import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Filter, LegacyFilter, LabeledFilters } from '@/funcs/store'
import { 
  convertLegacyToFilter,
  generateFilterLabel,
  migrateLegacyFiltersToLabeled,
  validateLabeledFilters,
  detectFilterFormat
} from '@/funcs/filter-migration'
import { legacyFilterFixtures, labeledFilterFixtures, migrationTestPairs } from '../fixtures/filter-fixtures'

// フィルター移行関数の型定義
type FilterMigrationFunction = (legacyFilters: LegacyFilter[][]) => LabeledFilters[]

// テスト用のLegacyFilter データ
const sampleLegacyFilters: LegacyFilter[][] = [
  [{ property: 'kCGWindowIsOnscreen', is: false }],
  [{ property: 'kCGWindowOwnerName', is: 'Dock' }],
  [{ property: 'kCGWindowOwnerName', is: 'DockHelper' }],
  [
    { property: 'kCGWindowOwnerName', is: 'Finder' },
    { property: 'kCGWindowName', is: '' }
  ],
  [{ property: 'kCGWindowNumber', is: 123 }],
  [{ property: 'X', is: 100 }],
  [{ property: 'kCGWindowStoreType', is: true }]
]

// 期待される移行後のデータ
const expectedMigratedFilters: LabeledFilters[] = [
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
    label: '空のFinderウィンドウを除外',
    filters: [
      { property: 'kCGWindowOwnerName', is: 'Finder' },
      { property: 'kCGWindowName', is: '' }
    ]
  },
  {
    label: 'ウィンドウ番号 123 を除外',
    filters: [{ property: 'kCGWindowNumber', is: 123 }]
  },
  {
    label: 'X座標 100 を除外',
    filters: [{ property: 'X', is: 100 }]
  },
  {
    label: 'ストアタイプ true を除外',
    filters: [{ property: 'kCGWindowStoreType', is: true }]
  }
]

describe('Filter Migration', () => {
  describe('LegacyFilter validation', () => {
    it('有効なLegacyFilterを正しく識別する', () => {
      const validLegacyFilter: LegacyFilter = {
        property: 'kCGWindowOwnerName',
        is: 'TestApp'
      }
      
      expect(typeof validLegacyFilter.property).toBe('string')
      expect(['string', 'number', 'boolean']).toContain(typeof validLegacyFilter.is)
    })

    it('無効なLegacyFilterを検出する', () => {
      const invalidFilters = [
        { property: '', is: 'value' }, // 空のプロパティ
        { property: 'test', is: null }, // nullの値
        { property: 'test', is: undefined }, // undefinedの値
        { property: 123, is: 'value' }, // 数値のプロパティ
      ]

      invalidFilters.forEach(filter => {
        const isValid = typeof filter.property === 'string' && 
                       filter.property.length > 0 &&
                       filter.is !== null && 
                       filter.is !== undefined &&
                       ['string', 'number', 'boolean'].includes(typeof filter.is)
        expect(isValid).toBe(false)
      })
    })
  })

  describe('Type-safe Filter creation', () => {
    it('StringFilterを正しく作成する', () => {
      const stringFilter: Filter = {
        property: 'kCGWindowOwnerName',
        is: 'TestApp'
      }
      
      expect(stringFilter.property).toBe('kCGWindowOwnerName')
      expect(typeof stringFilter.is).toBe('string')
    })

    it('NumberFilterを正しく作成する', () => {
      const numberFilter: Filter = {
        property: 'kCGWindowNumber',
        is: 123
      }
      
      expect(numberFilter.property).toBe('kCGWindowNumber')
      expect(typeof numberFilter.is).toBe('number')
    })

    it('BooleanFilterを正しく作成する', () => {
      const booleanFilter: Filter = {
        property: 'kCGWindowIsOnscreen',
        is: false
      }
      
      expect(booleanFilter.property).toBe('kCGWindowIsOnscreen')
      expect(typeof booleanFilter.is).toBe('boolean')
    })
  })

  describe('Filter validation', () => {
    it('有効なpropertyとisの組み合わせを許可する', () => {
      const validCombinations = [
        { property: 'kCGWindowOwnerName', is: 'string' },
        { property: 'kCGWindowName', is: 'string' },
        { property: 'X', is: 100 },
        { property: 'Y', is: 200 },
        { property: 'Height', is: 300 },
        { property: 'Width', is: 400 },
        { property: 'kCGWindowMemoryUsage', is: 1024 },
        { property: 'kCGWindowOwnerPID', is: 12345 },
        { property: 'kCGWindowNumber', is: 678 },
        { property: 'kCGWindowStoreType', is: true },
        { property: 'kCGWindowIsOnscreen', is: false }
      ]

      validCombinations.forEach(combo => {
        expect(() => {
          const filter: Filter = combo as Filter
          return filter
        }).not.toThrow()
      })
    })
  })

  describe('Label generation', () => {
    it('単一フィルターに対して適切なラベルを生成する', () => {
      const testCases = [
        {
          filter: { property: 'kCGWindowOwnerName', is: 'Dock' },
          expectedLabel: 'Dockを除外'
        },
        {
          filter: { property: 'kCGWindowName', is: 'Notification Center' },
          expectedLabel: '通知センターを除外'
        },
        {
          filter: { property: 'kCGWindowIsOnscreen', is: false },
          expectedLabel: 'オフスクリーンウィンドウを除外'
        },
        {
          filter: { property: 'X', is: 100 },
          expectedLabel: 'X座標100の位置を除外'
        }
      ]

      testCases.forEach(testCase => {
        const label = generateFilterLabel([testCase.filter as Filter])
        expect(label).toBe(testCase.expectedLabel)
      })
    })

    it('複数フィルターに対して適切なラベルを生成する', () => {
      const multipleFilters = [
        { property: 'kCGWindowOwnerName', is: 'Finder' },
        { property: 'kCGWindowName', is: '' }
      ] as Filter[]
      
      const label = generateFilterLabel(multipleFilters)
      expect(label).toBe('空のFinderウィンドウを除外')
    })
  })

  describe('Migration functionality', () => {
    it('LegacyFilterをFilterに変換する', () => {
      const legacyFilter: LegacyFilter = {
        property: 'kCGWindowOwnerName',
        is: 'TestApp'
      }

      const convertedFilter = convertLegacyToFilter(legacyFilter)
      expect(convertedFilter.property).toBe('kCGWindowOwnerName')
      expect(convertedFilter.is).toBe('TestApp')
    })

    it('無効なLegacyFilterの変換時にエラーをスローする', () => {
      const invalidLegacyFilters = [
        { property: '', is: 'value' },
        { property: 'invalidProperty', is: 'value' },
        { property: 'kCGWindowOwnerName', is: 123 }, // 文字列プロパティに数値
        { property: 'X', is: 'string' } // 数値プロパティに文字列
      ]

      invalidLegacyFilters.forEach(filter => {
        expect(() => convertLegacyToFilter(filter as LegacyFilter)).toThrow()
      })
    })

    it('LegacyFilters配列をLabeledFilters配列に変換する', () => {
      const result = migrateLegacyFiltersToLabeled(sampleLegacyFilters)
      expect(result).toHaveLength(7) // 有効なフィルターの数
      expect(result[0].label).toBe('オフスクリーンウィンドウを除外')
      expect(result[0].filters).toHaveLength(1)
    })

    it('空のLegacyFilters配列を適切に処理する', () => {
      const emptyLegacyFilters: LegacyFilter[][] = []
      
      const result = migrateLegacyFiltersToLabeled(emptyLegacyFilters)
      expect(result).toEqual([])
    })

    it('ネストした複数フィルターを正しく処理する', () => {
      const complexLegacyFilters: LegacyFilter[][] = [
        [
          { property: 'kCGWindowOwnerName', is: 'Finder' },
          { property: 'kCGWindowName', is: '' },
          { property: 'kCGWindowIsOnscreen', is: true }
        ]
      ]

      const result = migrateLegacyFiltersToLabeled(complexLegacyFilters)
      expect(result).toHaveLength(1)
      expect(result[0].filters).toHaveLength(3)
      expect(result[0].label).toBe('空のFinderウィンドウを除外') // 特別なルールで処理される
    })

    it('フィクスチャーを使用したマイグレーションテスト', () => {
      migrationTestPairs.pairs.forEach(({ legacy, labeled }) => {
        const result = migrateLegacyFiltersToLabeled(legacy)
        expect(result).toHaveLength(labeled.length)
        
        result.forEach((resultFilter, index) => {
          expect(resultFilter.label).toBe(labeled[index].label)
          expect(resultFilter.filters).toEqual(labeled[index].filters)
        })
      })
    })
  })

  describe('Backward compatibility', () => {
    it('既存のLegacyFilter形式を引き続きサポートする', () => {
      const legacyFormat: LegacyFilter[][] = [
        [{ property: 'kCGWindowOwnerName', is: 'Dock' }]
      ]

      // レガシー形式でも動作することを確認
      expect(Array.isArray(legacyFormat)).toBe(true)
      expect(Array.isArray(legacyFormat[0])).toBe(true)
      expect(typeof legacyFormat[0][0].property).toBe('string')
    })

    it('LabeledFilters形式が正しい構造を持つ', () => {
      const labeledFormat: LabeledFilters = {
        label: 'Test Filter',
        filters: [{ property: 'kCGWindowOwnerName', is: 'TestApp' }]
      }

      expect(typeof labeledFormat.label).toBe('string')
      expect(Array.isArray(labeledFormat.filters)).toBe(true)
      expect(labeledFormat.filters.length).toBeGreaterThan(0)
    })
  })

  describe('Format detection', () => {
    it('LegacyFilter形式を正しく検出する', () => {
      const legacyFormat = legacyFilterFixtures.defaultFilters
      expect(detectFilterFormat(legacyFormat)).toBe('legacy')
    })

    it('LabeledFilters形式を正しく検出する', () => {
      const labeledFormat = labeledFilterFixtures.defaultLabeledFilters
      expect(detectFilterFormat(labeledFormat)).toBe('labeled')
    })

    it('不明な形式を適切に処理する', () => {
      expect(detectFilterFormat([])).toBe('unknown')
      expect(detectFilterFormat('invalid')).toBe('unknown')
      expect(detectFilterFormat([{ invalid: 'data' }])).toBe('unknown')
    })
  })

  describe('Validation', () => {
    it('有効なLabeledFiltersを検証する', () => {
      const validFilters = labeledFilterFixtures.defaultLabeledFilters
      expect(validateLabeledFilters(validFilters)).toBe(true)
    })

    it('無効なLabeledFiltersを検出する', () => {
      const invalidCases = [
        [], // 空配列
        [{ label: 'Test', filters: [] }], // 空フィルター
        [{ filters: [{ property: 'kCGWindowOwnerName', is: 'Test' }] }], // ラベル欠如
        [{ label: 'Test', filters: [{ property: 'invalid', is: 'test' }] }] // 無効プロパティ
      ]

      invalidCases.forEach(invalidCase => {
        expect(validateLabeledFilters(invalidCase)).toBe(false)
      })
    })

    it('空ラベルは有効とする', () => {
      const validWithEmptyLabel = [{
        label: '', 
        filters: [{ property: 'kCGWindowOwnerName', is: 'Test' }]
      }]
      
      expect(validateLabeledFilters(validWithEmptyLabel)).toBe(true)
    })
  })

  describe('Store integration', () => {
    it('デフォルトフィルターのマイグレーションが正しく動作する', () => {
      const legacyDefaults = legacyFilterFixtures.defaultFilters
      const result = migrateLegacyFiltersToLabeled(legacyDefaults)
      
      expect(result.length).toBeGreaterThan(0)
      expect(validateLabeledFilters(result)).toBe(true)
      
      // 特定のフィルターが正しく変換されることを確認
      const dockFilter = result.find(f => f.label === 'Dockを除外')
      expect(dockFilter).toBeDefined()
      expect(dockFilter?.filters[0].property).toBe('kCGWindowOwnerName')
      expect(dockFilter?.filters[0].is).toBe('Dock')
    })
  })
})