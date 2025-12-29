import { describe, it, expect } from 'bun:test'

describe('Renderer Test Sample', () => {
  it('基本的な算術演算が正しく動作する', () => {
    expect(1 + 1).toBe(2)
    expect(2 * 3).toBe(6)
    expect(10 - 5).toBe(5)
  })

  it('文字列操作が正しく動作する', () => {
    expect('hello'.toUpperCase()).toBe('HELLO')
    expect('world'.length).toBe(5)
  })

  it('配列操作が正しく動作する', () => {
    const arr = [1, 2, 3]
    expect(arr.length).toBe(3)
    expect(arr[0]).toBe(1)
    expect(arr).toContain(2)
  })

  it('オブジェクト操作が正しく動作する', () => {
    const obj = { name: 'test', value: 42 }
    expect(obj.name).toBe('test')
    expect(obj.value).toBe(42)
    expect(obj).toHaveProperty('name')
  })
})
