<template>
  <div class="full-window-list">
    <div class="h1-title">ウィンドウ一覧 - フィルター設定補助</div>
    <div class="controls">
      <div class="control-group">
        <div class="field">
          <div class="control">
            <div class="buttons has-addons filter-buttons">
              <button
                class="button"
                :class="{ 'is-primary': displayMode === 'filtered' }"
                @click="switchDisplayMode('filtered')"
              >
                <span class="icon">
                  <i class="fas fa-filter"></i>
                </span>
                <span class="button-text">フィルター済み</span>
                <span v-if="filteredProcesses" class="tag is-light ml-1">{{
                  filteredProcesses.length
                }}</span>
              </button>
              <button
                class="button"
                :class="{ 'is-info': displayMode === 'all' }"
                @click="switchDisplayMode('all')"
              >
                <span class="icon">
                  <i class="fas fa-list"></i>
                </span>
                <span class="button-text">全ウィンドウ</span>
                <span v-if="allProcesses" class="tag is-light ml-1">{{ allProcesses.length }}</span>
              </button>
              <button
                class="button"
                :class="{ 'is-warning': displayMode === 'excluded' }"
                @click="switchDisplayMode('excluded')"
              >
                <span class="icon">
                  <i class="fas fa-eye-slash"></i>
                </span>
                <span class="button-text">除外済み</span>
                <span v-if="excludedProcess.length > 0" class="tag is-light ml-1">{{
                  excludedProcess.length
                }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="control-group">
        <div class="field has-addons search-field">
          <div class="control search-control">
            <input
              v-model="searchQuery"
              class="input"
              type="text"
              placeholder="ウィンドウ名・アプリ名で検索..."
            />
          </div>
          <div class="control">
            <button class="button is-static search-button">
              <span class="icon">
                <i class="fas fa-search"></i>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="windows-table-container">
      <table class="table is-fullwidth is-striped is-hoverable">
        <thead>
          <tr>
            <th class="sortable" @click="setSortField('owner')">
              アプリ名
              <span v-if="sortField === 'owner'" class="sort-indicator">
                {{ sortDirection === 'asc' ? '↑' : '↓' }}
              </span>
            </th>
            <th class="sortable" @click="setSortField('name')">
              ウィンドウ名
              <span v-if="sortField === 'name'" class="sort-indicator">
                {{ sortDirection === 'asc' ? '↑' : '↓' }}
              </span>
            </th>
            <th class="sortable" @click="setSortField('pid')">
              PID
              <span v-if="sortField === 'pid'" class="sort-indicator">
                {{ sortDirection === 'asc' ? '↑' : '↓' }}
              </span>
            </th>
            <th class="sortable" @click="setSortField('layer')">
              レイヤー
              <span v-if="sortField === 'layer'" class="sort-indicator">
                {{ sortDirection === 'asc' ? '↑' : '↓' }}
              </span>
            </th>
            <th class="sortable" @click="setSortField('status')">
              状態
              <span v-if="sortField === 'status'" class="sort-indicator">
                {{ sortDirection === 'asc' ? '↑' : '↓' }}
              </span>
            </th>
            <th>フィルター作成</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredWindows.length === 0">
            <td colspan="6" class="has-text-centered has-text-grey">
              {{ searchQuery ? '検索結果がありません' : 'ウィンドウデータがありません' }}
            </td>
          </tr>
          <tr v-for="window in paginatedWindows" :key="window.id" class="window-row">
            <td>
              <div class="app-info">
                <img
                  v-if="window.appIcon"
                  :src="window.appIcon"
                  class="app-icon"
                  :alt="window.owner"
                  @error="handleImageError"
                />
                <div v-else class="app-icon-placeholder">
                  <i class="fas fa-window-maximize"></i>
                </div>
                <span class="app-name" :title="window.owner">
                  {{ window.owner }}
                </span>
              </div>
            </td>
            <td>
              <div class="window-name">
                <span class="window-title" :title="window.name">
                  {{ window.name || '(無題)' }}
                </span>
              </div>
            </td>
            <td>
              <code class="pid">{{ window.pid }}</code>
            </td>
            <td>
              <code class="layer">{{ window.layer }}</code>
            </td>
            <td>
              <span
                class="tag"
                :class="getWindowStatus(window.id).class"
                :title="getWindowStatus(window.id).tooltip"
              >
                {{ getWindowStatus(window.id).label }}
              </span>
            </td>
            <td>
              <div v-if="getWindowStatus(window.id).label !== 'フィルター除外'" class="filter-actions">
                <div class="dropdown" :class="{ 'is-active': activeDropdown === window.id }">
                  <div class="dropdown-trigger">
                    <button class="button is-small is-primary" @click="toggleDropdown(window.id)">
                      <span>フィルター作成</span>
                      <span class="icon is-small">
                        <i class="fas fa-angle-down"></i>
                      </span>
                    </button>
                  </div>
                  <div class="dropdown-menu">
                    <div class="dropdown-content">
                      <a
                        class="dropdown-item"
                        @click="createFilter('kCGWindowName', window.name, window)"
                      >
                        ウィンドウ名でフィルター
                      </a>
                      <a
                        class="dropdown-item"
                        @click="createFilter('kCGWindowOwnerName', window.owner, window)"
                      >
                        アプリ名でフィルター
                      </a>
                      <a
                        class="dropdown-item"
                        @click="createFilter('kCGWindowOwnerPID', window.pid, window)"
                      >
                        PIDでフィルター
                      </a>
                      <a
                        class="dropdown-item"
                        @click="createFilter('kCGWindowLayer', window.layer, window)"
                      >
                        レイヤーでフィルター
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="totalPages > 1" class="pagination-container">
      <nav class="pagination is-centered">
        <button class="pagination-previous" :disabled="currentPage === 1" @click="currentPage--">
          前のページ
        </button>
        <button
          class="pagination-next"
          :disabled="currentPage === totalPages"
          @click="currentPage++"
        >
          次のページ
        </button>
        <ul class="pagination-list">
          <li v-for="(page, index) in visiblePages" :key="`page-${index}`">
            <button
              v-if="typeof page === 'number'"
              class="pagination-link"
              :class="{ 'is-current': page === currentPage }"
              @click="currentPage = page"
            >
              {{ page }}
            </button>
            <span v-else class="pagination-ellipsis">
              {{ page }}
            </span>
          </li>
        </ul>
      </nav>
    </div>

    <!-- フィルター作成通知 -->
    <div v-if="notification" class="notification is-success notification-toast">
      <button class="delete" @click="notification = null"></button>
      {{ notification }}
    </div>
  </div>
</template>

<script lang="ts">
import { Electron } from '../utils'

interface WindowInfo {
  id: number
  name: string
  owner: string
  pid: number
  layer: number
  isOnscreen: boolean
  appIcon?: string
  bounds?: {
    x: number
    y: number
    width: number
    height: number
  }
}

// MacWindow型をインポート
type MacWindow = {
  kCGWindowLayer: number
  kCGWindowName: string
  kCGWindowMemoryUsage: number
  kCGWindowIsOnscreen: number
  kCGWindowSharingState: number
  kCGWindowOwnerPID: number
  kCGWindowOwnerName: string
  kCGWindowNumber: number
  kCGWindowStoreType: number
  kCGWindowBounds: {
    X: number
    Height: number
    Y: number
    Width: number
  }
  appIcon: string
}

export default {
  data(): {
    filteredProcesses: WindowInfo[]
    excludedProcess: WindowInfo[]
    displayMode: 'filtered' | 'all' | 'excluded'
    searchQuery: string
    sortField: string
    sortDirection: 'asc' | 'desc'
    currentPage: number
    itemsPerPage: number
    activeDropdown: number | null
    notification: string | null
  } {
    return {
      filteredProcesses: [],
      excludedProcess: [],
      displayMode: 'filtered',
      searchQuery: '',
      sortField: 'owner',
      sortDirection: 'asc',
      currentPage: 1,
      itemsPerPage: 50,
      activeDropdown: null,
      notification: null
    }
  },
  computed: {
    allProcesses(): WindowInfo[] {
      // フィルター済みと除外を合成して全プロセスを作成
      return [...this.filteredProcesses, ...this.excludedProcess]
    },
    displayWindowsList(): WindowInfo[] {
      // 表示モードに応じてデータを切り替え
      switch (this.displayMode) {
        case 'all':
          console.log('全プロセス表示モード:', this.allProcesses.length)
          return this.allProcesses
        case 'excluded':
          console.log('除外プロセス表示モード:', this.excludedProcess.length)
          return this.excludedProcess
        case 'filtered':
        default:
          console.log('フィルター済み表示モード:', this.filteredProcesses.length)
          return this.filteredProcesses
      }
    },
    filteredWindows(): WindowInfo[] {
      let filtered = [...this.displayWindowsList]

      // 検索フィルター
      if (this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase()
        filtered = filtered.filter(
          (window) =>
            window.name?.toLowerCase().includes(query) ||
            window.owner?.toLowerCase().includes(query)
        )
      }

      // ソート
      filtered.sort((a, b) => {
        let aVal: any
        let bVal: any

        // 特殊な'status'フィールドの処理
        if (this.sortField === 'status') {
          aVal = this.getWindowStatus(a.id).label
          bVal = this.getWindowStatus(b.id).label
        } else {
          aVal = a[this.sortField as keyof WindowInfo]
          bVal = b[this.sortField as keyof WindowInfo]
        }

        // 文字列の場合は小文字で比較
        if (typeof aVal === 'string') aVal = aVal.toLowerCase()
        if (typeof bVal === 'string') bVal = bVal.toLowerCase()

        if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1
        return 0
      })

      return filtered
    },
    paginatedWindows(): WindowInfo[] {
      const start = (this.currentPage - 1) * this.itemsPerPage
      const end = start + this.itemsPerPage
      return this.filteredWindows.slice(start, end)
    },
    totalPages(): number {
      return Math.ceil(this.filteredWindows.length / this.itemsPerPage)
    },
    visiblePages(): (number | string)[] {
      const pages: (number | string)[] = []
      const total = this.totalPages
      const current = this.currentPage

      // 総ページ数が7以下の場合はすべて表示
      if (total <= 7) {
        for (let i = 1; i <= total; i++) {
          pages.push(i)
        }
        return pages
      }

      // 1ページ目は常に表示
      pages.push(1)

      // 現在のページが1から遠い場合は省略記号
      if (current > 4) {
        pages.push('...')
      }

      // 現在のページ周辺を表示
      const start = Math.max(2, current - 1)
      const end = Math.min(total - 1, current + 1)

      for (let i = start; i <= end; i++) {
        // 1ページ目の重複を避ける
        if (i > 1) {
          pages.push(i)
        }
      }

      // 最後のページから遠い場合は省略記号
      if (current < total - 3) {
        pages.push('...')
      }

      // 最後のページは常に表示（重複を避ける）
      if (total > 1 && !pages.includes(total)) {
        pages.push(total)
      }

      return pages
    }
  },
  mounted(): void {
    // IPCイベントリスナーを追加
    Electron.listen('allProcesses', this.handleAllProcessesData)

    // 外部クリックでドロップダウンを閉じる
    document.addEventListener('click', this.handleOutsideClick)

    Electron.listen('catchExcludeWindow', (_event: any, res: MacWindow[]) => {
      console.log('Received excluded processes:', res)
      this.excludedProcess = res.map((macWindow, index) =>
        this.convertMacWindowToWindowInfo(macWindow, index)
      )
    })

    // 初期読み込み時に除外プロセスを取得
    Electron.send('getExcludeWindows')
  },
  beforeUnmount(): void {
    document.removeEventListener('click', this.handleOutsideClick)
    // IPCイベントリスナーを削除
    window.electron.ipcRenderer.removeAllListeners('allProcesses')
    window.electron.ipcRenderer.removeAllListeners('catchExcludeWindow')
  },
  watch: {
    currentPage(): void {
      // ページ変更時にスクロールを一番上に戻す
      window.scrollTo({ top: 0 })
    }
  },
  methods: {
    handleAllProcessesData(_event: any, data: MacWindow[]): void {
      // フィルター済みプロセスデータを変換して保存
      this.filteredProcesses = data.map((macWindow, index) =>
        this.convertMacWindowToWindowInfo(macWindow, index)
      )
    },
    convertMacWindowToWindowInfo(macWindow: MacWindow, index: number): WindowInfo {
      return {
        id: macWindow.kCGWindowNumber || index,
        name: macWindow.kCGWindowName || '(無題)',
        owner: macWindow.kCGWindowOwnerName || '不明',
        pid: macWindow.kCGWindowOwnerPID,
        layer: macWindow.kCGWindowLayer,
        isOnscreen: macWindow.kCGWindowIsOnscreen > 0,
        appIcon: macWindow.appIcon || undefined,
        bounds: macWindow.kCGWindowBounds
          ? {
              x: macWindow.kCGWindowBounds.X,
              y: macWindow.kCGWindowBounds.Y,
              width: macWindow.kCGWindowBounds.Width,
              height: macWindow.kCGWindowBounds.Height
            }
          : undefined
      }
    },
    handleImageError(event: Event): void {
      // アイコン読み込みエラー時の処理
      const target = event.target as HTMLImageElement
      target.style.display = 'none'
    },
    getWindowStatus(windowId: number): { label: string; class: string; tooltip: string } {
      // フィルター済みリストに含まれているかで判定
      const isInFiltered = this.filteredProcesses.some((w) => w.id === windowId)

      if (isInFiltered) {
        return {
          label: 'フィルター通過',
          class: 'is-success',
          tooltip: 'このウィンドウはフィルターを通過し、タスクバーに表示されます'
        }
      } else {
        // 除外された理由を特定
        const isInAll = this.allProcesses.some((w) => w.id === windowId)
        const isInExcluded = this.excludedProcess.some((w) => w.id === windowId)

        if (isInExcluded) {
          return {
            label: 'フィルター除外',
            class: 'is-warning',
            tooltip:
              'このウィンドウはフィルターにより除外されています（サイズ不足、除外アプリなど）'
          }
        } else if (isInAll) {
          return {
            label: '不明',
            class: 'is-light',
            tooltip: '全ウィンドウリストにはあるが、分類が不明'
          }
        } else {
          return {
            label: 'データなし',
            class: 'is-light',
            tooltip: 'ウィンドウデータが見つかりません'
          }
        }
      }
    },
    switchDisplayMode(mode: 'filtered' | 'all' | 'excluded'): void {
      this.displayMode = mode
      this.currentPage = 1 // ページをリセット
      this.activeDropdown = null // ドロップダウンを閉じる
      console.log(`表示モード切り替え: ${mode}`)
    },
    setSortField(field: string): void {
      if (this.sortField === field) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc'
      } else {
        this.sortField = field
        this.sortDirection = 'asc'
      }
      this.currentPage = 1
    },
    toggleDropdown(windowId: number): void {
      this.activeDropdown = this.activeDropdown === windowId ? null : windowId
    },
    handleOutsideClick(event: Event): void {
      const target = event.target as Element
      if (!target.closest('.dropdown')) {
        this.activeDropdown = null
      }
    },
    createFilter(property: string, value: string | number, _window: WindowInfo): void {
      // フィルター作成ロジック（設定ウィンドウにフィルターを追加）
      const filterData = {
        property,
        is: value
      }

      // 新しいフィルターグループを作成（option.vueと同じラベル形式）
      const propertyName = this.getPropertyDisplayName(property)
      const label = `${propertyName}:${value}を除外`

      Electron.send('addFilter', {
        filter: filterData,
        label: label
      })

      this.showNotification(`フィルターを作成しました: ${label}`)
      this.activeDropdown = null
    },
    getPropertyDisplayName(property: string): string {
      const displayNames: Record<string, string> = {
        kCGWindowName: 'ウィンドウ名',
        kCGWindowOwnerName: 'アプリ名',
        kCGWindowOwnerPID: 'プロセスID',
        kCGWindowLayer: 'レイヤー'
      }
      return displayNames[property] || property
    },
    showNotification(message: string): void {
      this.notification = message
      setTimeout(() => {
        this.notification = null
      }, 3000)
    }
  }
}
</script>

<style lang="scss" scoped>
.full-window-list {
  padding: 2rem;
  min-height: 100vh;
  background: hsl(0, 0%, 21%);

  @media (max-width: 768px) {
    padding: 1rem;
  }

  @media (max-width: 480px) {
    padding: 0.75rem;
  }
}

.h1-title {
  color: #fff;
  margin-bottom: 2rem;
  font-size: 1.75rem;
  font-weight: 700;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
  letter-spacing: 0.5px;

  @media (max-width: 768px) {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
  }
}

.controls {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  gap: 2rem;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  @media (max-width: 768px) {
    gap: 1rem;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    .field {
      margin-bottom: 0;
    }

    &:first-child {
      justify-self: start;
    }

    &:last-child {
      justify-self: end;

      @media (max-width: 1024px) {
        justify-self: start;
      }
    }
  }

  // フィルターボタングループ
  .filter-buttons {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    border-radius: 6px;
    overflow: hidden;

    .button {
      color: #b0b0b0;
      background: #2a2a2a;
      border-color: #444;
      border-radius: 0;
      padding: 0.75rem 1rem;
      position: relative;
      margin-bottom: 0;

      // モバイルでは小さなボタン
      @media (max-width: 768px) {
        padding: 0.5rem 0.75rem;

        .button-text {
          display: none;
        }
      }

      // デフォルトのボタンテキストサイズ
      .button-text {
        font-size: 0.95rem;
      }

      // タブレットサイズでもテキストを短縮
      @media (max-width: 1024px) {
        .button-text {
          font-size: 0.9rem;
        }
      }

      &:hover {
        background: #333;
        border-color: #4a90e2;
      }

      &.is-primary {
        background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
        border-color: #4a90e2;
        color: white;
      }

      &.is-info {
        background: linear-gradient(135deg, #17a2b8 0%, #138496 100%);
        border-color: #17a2b8;
        color: white;
      }

      &.is-warning {
        background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%);
        border-color: #ffc107;
        color: #212529;
      }

      .icon {
        margin-right: 0.5rem;

        @media (max-width: 768px) {
          margin-right: 0;
        }
      }

      .tag {
        margin-left: 0.5rem;
        background: rgba(255, 255, 255, 0.2);
        color: inherit;
        border: none;
        font-weight: 600;
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;

        @media (max-width: 768px) {
          margin-left: 0.25rem;
          padding: 0.15rem 0.35rem;
          font-size: 0.7rem;
        }
      }
    }
  }

  // 検索フィールド
  .search-field {
    min-width: 320px;
    max-width: 400px;
    width: 100%;

    @media (max-width: 768px) {
      min-width: auto;
      max-width: none;
    }

    .search-control {
      flex: 1;

      .input {
        background: #2a2a2a;
        border-color: #444;
        color: #e0e0e0;
        border-radius: 6px 0 0 6px;
        padding: 0.75rem 1rem;
        font-size: 0.95rem;
        transition: all 0.2s ease;

        &:focus {
          background: #333;
          border-color: #4a90e2;
          box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
          outline: none;
        }

        &::placeholder {
          color: #888;
          font-style: italic;
        }
      }
    }

    .search-button {
      background: #333;
      border-color: #444;
      color: #b0b0b0;
      border-radius: 0 6px 6px 0;
      padding: 0.75rem 1rem;
      transition: all 0.2s ease;

      &:hover {
        background: #4a90e2;
        border-color: #4a90e2;
        color: white;
      }
    }
  }
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;

  @media (max-width: 768px) {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .stat-item {
    background: linear-gradient(135deg, #2a2a2a 0%, #252525 100%);
    padding: 1.5rem 1.25rem;
    border-radius: 10px;
    border: 1px solid #444;
    text-align: center;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, #4a90e2, #17a2b8, #ffc107);
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    @media (max-width: 768px) {
      padding: 1.25rem 1rem;
    }

    &:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
      border-color: #4a90e2;

      &::before {
        opacity: 1;
      }
    }

    .stat-value {
      display: block;
      font-size: 2.5rem;
      font-weight: 700;
      color: #4a90e2;
      margin-bottom: 0.75rem;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      line-height: 1;

      @media (max-width: 768px) {
        font-size: 2rem;
        margin-bottom: 0.5rem;
      }
    }

    .stat-label {
      color: #c0c0c0;
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      opacity: 0.9;

      @media (max-width: 768px) {
        font-size: 0.85rem;
        letter-spacing: 0.5px;
      }
    }
  }
}

.windows-table-container {
  background: #2a2a2a;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #444;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: box-shadow 0.3s ease;

  .table {
    background: transparent;
    margin-bottom: 0;

    th {
      background: #1a1a1a;
      color: #b0b0b0;
      border: none;
      padding: 0.5rem 0.8rem;
      font-weight: 600;
      font-size: 0.95rem;

      &.sortable {
        cursor: pointer;
        user-select: none;

        &:hover {
          background: #333;
        }
      }

      .sort-indicator {
        margin-left: 0.5rem;
        color: #4a90e2;
      }
    }

    td {
      border: none;
      padding: 0.4rem 0.8rem;
      border-bottom: 1px solid #333;
      background: #2a2a2a;
      font-size: 0.9rem;
    }

    tr:hover td {
      background: #333;
    }

    .window-name {
      .window-title {
        color: #7dd3fc;
        font-weight: 500;
        display: block;
        max-width: 300px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .app-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      .app-icon {
        width: 20px;
        height: 20px;
        object-fit: contain;
        border-radius: 3px;
        flex-shrink: 0;
      }

      .app-icon-placeholder {
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #444;
        border-radius: 3px;
        color: #888;
        font-size: 0.7rem;
        flex-shrink: 0;
      }

      .app-name {
        color: #86efac;
        font-weight: 500;
        display: block;
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
      }
    }

    .pid,
    .layer {
      color: #fbbf24;
      font-size: 0.8rem;
      font-family: monospace;
      background: #1a1a1a;
      padding: 0.15rem 0.3rem;
      border-radius: 3px;
    }

    .tag {
      font-size: 0.8rem;
    }
  }
}

.dropdown {
  .dropdown-menu {
    min-width: 200px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    border: 1px solid #444;
  }

  .dropdown-content {
    background: #2a2a2a;
  }

  .dropdown-item {
    font-size: 0.85rem;
    color: #b0b0b0;

    &:hover {
      background: #333;
      color: #4a90e2;
    }
  }
}

.pagination-container {
  margin-top: 2rem;
  display: flex;
  justify-content: center;
  padding: 1rem 0;

  @media (max-width: 768px) {
    margin-top: 1.5rem;
    padding: 0.5rem 0;
  }

  .pagination {
    gap: 0.25rem;

    .pagination-link,
    .pagination-previous,
    .pagination-next {
      background: #2a2a2a;
      border-color: #444;
      color: #b0b0b0;
      border-radius: 6px;
      margin: 0 0.125rem;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

      @media (max-width: 768px) {
        padding: 0.5rem 0.75rem;
        font-size: 0.85rem;
      }

      &:hover:not(:disabled) {
        background: #333;
        border-color: #4a90e2;
        transform: translateY(-1px);
        box-shadow: 0 2px 6px rgba(74, 144, 226, 0.2);
      }

      &.is-current {
        background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
        border-color: #4a90e2;
        color: white;
        box-shadow: 0 2px 8px rgba(74, 144, 226, 0.3);
        transform: translateY(-1px);
      }

      &:disabled {
        background: #1a1a1a;
        color: #666;
        cursor: not-allowed;
        opacity: 0.5;
      }
    }

    .pagination-ellipsis {
      color: #666;
      padding: 0.5rem 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;

      @media (max-width: 768px) {
        padding: 0.375rem 0.5rem;
        font-size: 0.85rem;
      }
    }

    .pagination-list {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.25rem;

      @media (max-width: 768px) {
        gap: 0.125rem;
      }
    }
  }
}

.notification-toast {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 1000;
  max-width: 400px;
}

.ml-1 {
  margin-left: 0.25rem;
}

.ml-4 {
  margin-left: 1rem;
}
</style>

<style lang="sass" scoped>
@import 'bulma/css/bulma.css'
</style>
