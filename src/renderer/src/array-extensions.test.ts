import { describe, it, expect, beforeAll } from 'vitest'
import './array-extensions'

describe('Array.prototype.columns', () => {
  const testData = [
    { id: 1, name: 'Alice', age: 25, active: true },
    { id: 2, name: 'Bob', age: 30, active: false },
    { id: 3, name: 'Charlie', age: 35, active: true }
  ]

  describe('単一パラメータ（配列を返す）', () => {
    it('列の値を配列として抽出できる', () => {
      const names = testData.columns('name')
      expect(names).toEqual(['Alice', 'Bob', 'Charlie'])
    })

    it('数値列の値を抽出できる', () => {
      const ages = testData.columns('age')
      expect(ages).toEqual([25, 30, 35])
    })

    it('真偽値列の値を抽出できる', () => {
      const activeStates = testData.columns('active')
      expect(activeStates).toEqual([true, false, true])
    })

    it('空配列を処理できる', () => {
      const result = [].columns('name')
      expect(result).toEqual([])
    })

    it('オブジェクト以外のアイテムを処理できる', () => {
      const mixedArray = [{ name: 'Alice' }, null, { name: 'Bob' }, undefined]
      const result = mixedArray.columns('name')
      expect(result).toEqual(['Alice', undefined, 'Bob', undefined])
    })
  })

  describe('2つのパラメータ（Recordを返す）', () => {
    it('文字列キーでインデックス化されたオブジェクトを作成できる', () => {
      const indexed = testData.columns('name', 'id')
      expect(indexed).toEqual({
        '1': 'Alice',
        '2': 'Bob',
        '3': 'Charlie'
      })
    })

    it('複雑な値でインデックス化されたオブジェクトを作成できる', () => {
      const indexed = testData.columns('age', 'name')
      expect(indexed).toEqual({
        Alice: 25,
        Bob: 30,
        Charlie: 35
      })
    })

    it('真偽値のインデックスキーを処理できる', () => {
      const indexed = testData.columns('name', 'active')
      expect(indexed).toEqual({
        true: 'Charlie', // 最後のtrue値で上書き
        false: 'Bob'
      })
    })

    it('空配列を処理できる', () => {
      const result = [].columns('name', 'id')
      expect(result).toEqual({})
    })

    it('インデックスモードでオブジェクト以外のアイテムを処理できる', () => {
      const mixedArray = [{ id: 1, name: 'Alice' }, null, { id: 2, name: 'Bob' }]
      const result = mixedArray.columns('name', 'id')
      expect(result).toEqual({
        '1': 'Alice',
        '2': 'Bob'
      })
    })
  })

  describe('エッジケース', () => {
    it('undefined値を持つオブジェクトを処理できる', () => {
      const dataWithUndefined = [
        { id: 1, name: 'Alice' },
        { id: 2, name: undefined },
        { id: 3, name: 'Charlie' }
      ]
      const names = dataWithUndefined.columns('name')
      expect(names).toEqual(['Alice', undefined, 'Charlie'])
    })

    it('重複するインデックスキーを処理できる（最後の値が優先）', () => {
      const dataWithDuplicates = [
        { id: 1, name: 'Alice', group: 'A' },
        { id: 2, name: 'Bob', group: 'A' },
        { id: 3, name: 'Charlie', group: 'B' }
      ]
      const indexed = dataWithDuplicates.columns('name', 'group')
      expect(indexed).toEqual({
        A: 'Bob', // BobがAliceを上書き
        B: 'Charlie'
      })
    })
  })
})
