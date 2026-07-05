// ?view= パラメータからビュー名を解決する（App.vue から利用。テスト可能な純関数）
export const VIEW_NAMES = ['taskbar', 'option', 'menu', 'fullWindowList'] as const
export type ViewName = (typeof VIEW_NAMES)[number]

// 不正値・未指定はデフォルトの taskbar にフォールバックする
export function resolveViewName(search: string): ViewName {
  const param = new URLSearchParams(search).get('view')
  return param && (VIEW_NAMES as readonly string[]).includes(param)
    ? (param as ViewName)
    : 'taskbar'
}
