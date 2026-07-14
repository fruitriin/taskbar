import { describe, it, expect } from 'bun:test'
import { resolveViewName } from '../src/view-router'

describe('resolveViewName', () => {
  it('各 view 値が対応するビュー名に解決される', () => {
    expect(resolveViewName('?view=taskbar')).toBe('taskbar')
    expect(resolveViewName('?view=option')).toBe('option')
    expect(resolveViewName('?view=menu')).toBe('menu')
    expect(resolveViewName('?view=fullWindowList')).toBe('fullWindowList')
  })

  it('未指定・空・不正値は taskbar にフォールバックする', () => {
    expect(resolveViewName('')).toBe('taskbar')
    expect(resolveViewName('?view=')).toBe('taskbar')
    expect(resolveViewName('?view=unknown')).toBe('taskbar')
    expect(resolveViewName('?view=OPTION')).toBe('taskbar') // 大文字小文字は区別する
    expect(resolveViewName('?other=1')).toBe('taskbar')
  })

  it('他のクエリと併存しても解決できる', () => {
    expect(resolveViewName('?foo=1&view=menu&bar=2')).toBe('menu')
  })
})
