import { defineConfig, presetUno } from 'unocss'

// bulma 撤去（リアーキ Phase 1 スライス 1-F）:
// 旧 bulma のクラス名を UnoCSS shortcuts として再定義する。
// テンプレートのクラス名は据え置きで、スタイルの実装だけが bulma → Uno に変わる。
// 色は bulma のパレット値を踏襲（見た目維持のため）。
export default defineConfig({
  // Attributify は現状未使用のため導入しない（使う時に preset と型定義をセットで追加する）
  presets: [presetUno()],
  shortcuts: {
    // --- ボタン ---
    button:
      'inline-flex items-center justify-center rounded border border-solid border-[#dbdbdb] bg-white text-[#363636] text-base leading-normal px-4 py-[calc(0.5em-1px)] cursor-pointer whitespace-nowrap align-top hover:border-[#b5b5b5]',
    'is-small': 'text-xs rounded-sm',
    'is-rounded': 'rounded-full',
    'is-primary': 'bg-[#00d1b2] text-white border-transparent hover:bg-[#00c4a7]',
    'is-info': 'bg-[#3e8ed0] text-white border-transparent hover:bg-[#3488ce]',
    'is-danger': 'bg-[#f14668] text-white border-transparent hover:bg-[#f03a5f]',
    'is-success': 'bg-[#48c78e] text-white border-transparent hover:bg-[#3ec487]',
    'is-warning': 'bg-[#ffe08a] text-[rgba(0,0,0,0.7)] border-transparent hover:bg-[#ffdc7d]',
    'is-light': 'bg-[#f5f5f5] text-[#363636] border-transparent',
    'is-static': 'bg-[#f5f5f5] text-[#7a7a7a] border-[#dbdbdb] pointer-events-none',
    buttons: 'flex items-center flex-wrap gap-0',

    // --- フォーム ---
    field: 'mb-3',
    'is-horizontal': 'flex',
    'field-label': 'w-36 shrink-0 mr-6 text-right',
    'is-normal': 'pt-1.5',
    'field-body': 'flex-1 flex items-start gap-2',
    label: 'block font-bold',
    input:
      'rounded border border-solid border-[#dbdbdb] bg-white text-[#363636] px-3 py-1.5 leading-normal',
    control: 'relative',

    // --- タグ ---
    tag: 'inline-flex items-center rounded bg-[#f5f5f5] text-[#363636] text-xs leading-normal px-2 py-1',

    // --- テーブル（fullWindowList） ---
    table: 'w-full border-collapse text-inherit',
    'is-fullwidth': 'w-full',

    // --- アイコンラッパー（Font Awesome の器） ---
    icon: 'inline-flex items-center justify-center w-6 h-6'
  },
  preflights: [
    {
      // クラス単体では表現できない「関係性」のスタイル（旧 bulma の component 相当）
      getCSS: (): string => `
/* select（.select ラッパー内の実 select 要素） */
.select { display: inline-block; position: relative; }
.select select {
  appearance: auto;
  border: 1px solid #dbdbdb;
  border-radius: 4px;
  background: #fff;
  color: #363636;
  font-size: 1rem;
  padding: 0.4em 2em 0.4em 0.75em;
  cursor: pointer;
}
.select.is-small select { font-size: 0.75rem; }

/* buttons has-addons: 隣接ボタンを結合 */
.buttons.has-addons .button:not(:first-child) { border-top-left-radius: 0; border-bottom-left-radius: 0; margin-left: -1px; }
.buttons.has-addons .button:not(:last-child) { border-top-right-radius: 0; border-bottom-right-radius: 0; }
.field.has-addons { display: flex; }
.field.has-addons .control:not(:first-child) .button,
.field.has-addons .control:not(:first-child) .input { border-top-left-radius: 0; border-bottom-left-radius: 0; margin-left: -1px; }
.field.has-addons .control:not(:last-child) .button,
.field.has-addons .control:not(:last-child) .input { border-top-right-radius: 0; border-bottom-right-radius: 0; }

/* テーブル（fullWindowList）: 旧 bulma .table 相当の最小 */
.table td, .table th { padding: 0.5em 0.75em; border-bottom: 1px solid #333; text-align: left; vertical-align: middle; }
.table.is-striped tbody tr:nth-child(even) { background-color: rgba(255, 255, 255, 0.04); }
.table.is-hoverable tbody tr:hover { background-color: rgba(255, 255, 255, 0.08); }
.has-text-centered { text-align: center; }
.has-text-grey { color: #7a7a7a; }

/* dropdown（fullWindowList のフィルター作成メニュー） */
.dropdown { display: inline-flex; position: relative; }
.dropdown-menu { display: none; position: absolute; left: 0; top: 100%; z-index: 20; min-width: 12rem; padding-top: 4px; }
.dropdown.is-active .dropdown-menu { display: block; }
.dropdown.is-up .dropdown-menu { top: auto; bottom: 100%; padding-top: 0; padding-bottom: 4px; }
.dropdown-content { background-color: #2b2b2b; border: 1px solid #555; border-radius: 6px; box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4); padding: 0.25rem 0; }
.dropdown-item { display: block; padding: 0.375rem 1rem; color: #fff; cursor: pointer; font-size: 0.875rem; white-space: nowrap; }
.dropdown-item:hover { background-color: #3f3f3f; }
`
    }
  ]
})
