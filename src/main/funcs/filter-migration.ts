import type { LegacyFilter, Filter, LabeledFilters } from './store'

/**
 * LegacyFilterがサポートされているプロパティかチェック
 */
function isValidProperty(property: string): boolean {
  const validProperties = [
    // String properties
    'kCGWindowOwnerName',
    'kCGWindowName',
    // Number properties
    'X',
    'Y',
    'Height',
    'Width',
    'kCGWindowMemoryUsage',
    'kCGWindowOwnerPID',
    'kCGWindowNumber',
    // Boolean properties
    'kCGWindowStoreType',
    'kCGWindowIsOnscreen'
  ]
  return validProperties.includes(property)
}

/**
 * プロパティに対して正しい型の値かチェック
 */
function isValidValueForProperty(property: string, value: any): boolean {
  const stringProperties = ['kCGWindowOwnerName', 'kCGWindowName']
  const numberProperties = ['X', 'Y', 'Height', 'Width', 'kCGWindowMemoryUsage', 'kCGWindowOwnerPID', 'kCGWindowNumber']
  const booleanProperties = ['kCGWindowStoreType', 'kCGWindowIsOnscreen']

  if (stringProperties.includes(property)) {
    return typeof value === 'string'
  }
  if (numberProperties.includes(property)) {
    return typeof value === 'number' && !isNaN(value)
  }
  if (booleanProperties.includes(property)) {
    return typeof value === 'boolean'
  }
  
  return false
}

/**
 * LegacyFilterを型安全なFilterに変換
 */
export function convertLegacyToFilter(legacyFilter: LegacyFilter): Filter {
  if (!legacyFilter || typeof legacyFilter !== 'object') {
    throw new Error('Invalid legacy filter: must be an object')
  }

  if (typeof legacyFilter.property !== 'string' || legacyFilter.property.length === 0) {
    throw new Error('Invalid legacy filter: property must be a non-empty string')
  }

  if (legacyFilter.is === null || legacyFilter.is === undefined) {
    throw new Error('Invalid legacy filter: is value cannot be null or undefined')
  }

  if (!isValidProperty(legacyFilter.property)) {
    throw new Error(`Invalid legacy filter: unsupported property "${legacyFilter.property}"`)
  }

  if (!isValidValueForProperty(legacyFilter.property, legacyFilter.is)) {
    throw new Error(`Invalid legacy filter: value type mismatch for property "${legacyFilter.property}"`)
  }

  // 型安全なFilterとして返す（TypeScriptは上記の検証により型が正しいことを保証）
  return legacyFilter as Filter
}

/**
 * プロパティと値から適切なラベルを生成
 */
export function generateFilterLabel(filters: Filter[]): string {
  if (filters.length === 0) {
    return 'フィルター'
  }

  if (filters.length === 1) {
    const filter = filters[0]
    
    // アプリ名によるフィルターの特別処理
    if (filter.property === 'kCGWindowOwnerName') {
      const appName = filter.is as string
      const appLabels: Record<string, string> = {
        'Dock': 'Dockを除外',
        'DockHelper': 'DockHelperを除外',
        'screencapture': 'スクリーンキャプチャを除外',
        'スクリーンショット': 'スクリーンショットアプリを除外',
        '通知センター': '通知センター（日本語）を除外',
        'Window Server': 'Window Serverを除外',
        'コントロールセンター': 'コントロールセンターを除外',
        'Spotlight': 'Spotlightを除外',
        'GoogleJapaneseInputRenderer': 'Google日本語入力を除外',
        'taskbar.fm': 'Taskbar.fmアプリを除外',
        'Finder': 'Finderを除外'
      }
      
      if (appLabels[appName]) {
        return appLabels[appName]
      }
      return `${appName}を除外`
    }

    // ウィンドウ名によるフィルターの特別処理
    if (filter.property === 'kCGWindowName') {
      const windowName = filter.is as string
      const windowLabels: Record<string, string> = {
        'Notification Center': '通知センターを除外',
        'Item-0': 'Item-0を除外',
        'taskbar.fm': 'Taskbar.fmウィンドウを除外',
        '': '名前なしウィンドウを除外'
      }
      
      if (windowLabels[windowName]) {
        return windowLabels[windowName]
      }
      return `"${windowName}"ウィンドウを除外`
    }

    // 座標・サイズによるフィルター
    if (filter.property === 'X') {
      return `X座標${filter.is}の位置を除外`
    }
    if (filter.property === 'Y') {
      return `Y座標${filter.is}の位置を除外`
    }
    if (filter.property === 'Height') {
      return `高さ${filter.is}のウィンドウを除外`
    }
    if (filter.property === 'Width') {
      return `幅${filter.is}のウィンドウを除外`
    }

    // その他の数値プロパティ
    if (filter.property === 'kCGWindowMemoryUsage') {
      return `メモリ使用量${filter.is}のウィンドウを除外`
    }
    if (filter.property === 'kCGWindowOwnerPID') {
      return `プロセスID ${filter.is}を除外`
    }
    if (filter.property === 'kCGWindowNumber') {
      return `ウィンドウ番号${filter.is}を除外`
    }

    // ブール値プロパティ
    if (filter.property === 'kCGWindowIsOnscreen') {
      return filter.is ? 'オンスクリーンウィンドウを除外' : 'オフスクリーンウィンドウを除外'
    }
    if (filter.property === 'kCGWindowStoreType') {
      return `ストアタイプ${filter.is ? 'True' : 'False'}を除外`
    }

    // デフォルト
    return `${filter.property}:${filter.is}を除外`
  }

  // 複合フィルターの特別処理
  const hasFinderAndEmptyName = filters.some(f => f.property === 'kCGWindowOwnerName' && f.is === 'Finder') &&
                                filters.some(f => f.property === 'kCGWindowName' && f.is === '')
  if (hasFinderAndEmptyName) {
    return '空のFinderウィンドウを除外'
  }

  if (filters.length === 2) {

    const appFilter = filters.find(f => f.property === 'kCGWindowOwnerName')
    if (appFilter) {
      const appName = appFilter.is as string
      const otherFilter = filters.find(f => f !== appFilter)
      if (otherFilter) {
        if (otherFilter.property === 'kCGWindowIsOnscreen') {
          const screenStatus = otherFilter.is ? 'オンスクリーン' : 'オフスクリーン'
          return `${screenStatus}の${appName}ウィンドウを除外`
        }
        if (otherFilter.property === 'X' && otherFilter.is === 0) {
          return `${appName}ウィンドウ（左端原点）を除外`
        }
        if (otherFilter.property === 'Height' && otherFilter.is === 0) {
          return `高さ0の${appName}ウィンドウを除外`
        }
        if (otherFilter.property === 'Width' && otherFilter.is === 0) {
          return `幅0の${appName}ウィンドウを除外`
        }
      }
    }
  }

  // 複合フィルターのデフォルト
  const appFilter = filters.find(f => f.property === 'kCGWindowOwnerName')
  if (appFilter) {
    const appName = appFilter.is as string
    return `${appName}の複合フィルター（${filters.length}条件）`
  }

  return `複合フィルター（${filters.length}条件）`
}

/**
 * LegacyFilter配列をLabeledFiltersに変換
 */
export function migrateLegacyFiltersToLabeled(legacyFilters: LegacyFilter[][]): LabeledFilters[] {
  if (!Array.isArray(legacyFilters)) {
    throw new Error('Legacy filters must be an array')
  }

  const labeledFilters: LabeledFilters[] = []

  for (const filterGroup of legacyFilters) {
    if (!Array.isArray(filterGroup)) {
      console.warn('Skipping invalid filter group:', filterGroup)
      continue
    }

    if (filterGroup.length === 0) {
      console.warn('Skipping empty filter group')
      continue
    }

    try {
      // 各フィルターを型安全なFilterに変換
      const convertedFilters: Filter[] = filterGroup
        .filter(filter => filter != null) // null/undefinedを除外
        .map(legacyFilter => {
          try {
            return convertLegacyToFilter(legacyFilter)
          } catch (error) {
            console.warn('Skipping invalid filter:', legacyFilter, error)
            return null
          }
        })
        .filter((filter): filter is Filter => filter !== null) // nullを除外して型を絞り込み

      if (convertedFilters.length === 0) {
        console.warn('No valid filters in group, skipping')
        continue
      }

      // ラベルを生成してLabeledFiltersを作成
      const label = generateFilterLabel(convertedFilters)
      labeledFilters.push({
        label,
        filters: convertedFilters
      })
    } catch (error) {
      console.error('Error processing filter group:', filterGroup, error)
      // エラーが発生してもマイグレーションを続行
    }
  }

  return labeledFilters
}

/**
 * LabeledFiltersが有効かチェック
 */
export function validateLabeledFilters(labeledFilters: any[]): boolean {
  if (!Array.isArray(labeledFilters)) {
    return false
  }

  // 空配列は無効とする
  if (labeledFilters.length === 0) {
    return false
  }

  return labeledFilters.every(item => {
    return (
      item &&
      typeof item === 'object' &&
      typeof item.label === 'string' &&
      // ラベルは空文字でも許可する
      Array.isArray(item.filters) &&
      item.filters.length > 0 &&
      item.filters.every((filter: any) => {
        return (
          filter &&
          typeof filter === 'object' &&
          typeof filter.property === 'string' &&
          isValidProperty(filter.property) &&
          isValidValueForProperty(filter.property, filter.is)
        )
      })
    )
  })
}

/**
 * フィルター形式を自動検出
 */
export function detectFilterFormat(filters: any): 'legacy' | 'labeled' | 'unknown' {
  if (!Array.isArray(filters)) {
    return 'unknown'
  }

  if (filters.length === 0) {
    return 'unknown'
  }

  const firstItem = filters[0]

  // LabeledFilters形式の検出
  if (firstItem && typeof firstItem === 'object' && 'label' in firstItem && 'filters' in firstItem) {
    return 'labeled'
  }

  // LegacyFilter形式の検出
  if (Array.isArray(firstItem)) {
    return 'legacy'
  }

  return 'unknown'
}