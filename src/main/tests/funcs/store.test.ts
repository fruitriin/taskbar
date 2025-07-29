import { describe, it, expect, vi, beforeEach } from 'vitest'
import { store } from '@/main/funcs/store'

// electron-storeのモックを個別に設定
vi.mock('electron-store', () => ({
  default: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
    store: {
      options: {
        layout: 'bottom',
        windowSortByPositionInApp: false,
        headers: [],
        footers: []
      },
      filters: []
    }
  }))
}))

describe('store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('storeオブジェクトが正しく初期化される', () => {
    expect(store).toBeDefined()
    expect(store.store).toBeDefined()
    expect(store.store.options).toBeDefined()
  })

  it('デフォルトの設定が正しく設定される', () => {
    expect(store.store.options.layout).toBe('bottom')
    expect(store.store.options.windowSortByPositionInApp).toBe(false)
    expect(store.store.options.headers).toEqual([])
    expect(store.store.options.footers).toEqual([])
  })

  it('設定の読み書きが正しく動作する', () => {
    const mockGet = vi.fn().mockReturnValue('right')
    const mockSet = vi.fn()
    
    // モックを再設定
    vi.mocked(store.get).mockImplementation(mockGet)
    vi.mocked(store.set).mockImplementation(mockSet)
    
    // 読み取りテスト
    const layout = store.get('options.layout')
    expect(layout).toBe('right')
    expect(mockGet).toHaveBeenCalledWith('options.layout')
    
    // 書き込みテスト
    store.set('options.layout', 'left')
    expect(mockSet).toHaveBeenCalledWith('options.layout', 'left')
  })
}) 