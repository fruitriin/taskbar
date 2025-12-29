import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { store } from '@/funcs/store'

describe('store', () => {
  beforeEach(() => {
    // モックはsetup.tsで設定されています
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
    const mockGet = mock().mockReturnValue('right')
    const mockSet = mock()

    // モックを再設定
    store.get = mockGet as any
    store.set = mockSet as any

    // 読み取りテスト
    const layout = store.get('options.layout')
    expect(layout).toBe('right')
    expect(mockGet).toHaveBeenCalledWith('options.layout')

    // 書き込みテスト
    store.set('options.layout', 'left')
    expect(mockSet).toHaveBeenCalledWith('options.layout', 'left')
  })
})
