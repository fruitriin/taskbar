<template>
  <div class="full-window-list">
    <h1>ウィンドウ一覧 - フィルター設定補助</h1>

    <div class="controls">
      <button class="button is-primary mr-2" @click="refreshData">
        <span class="icon">
          <i class="fas fa-refresh"></i>
        </span>
        <span>更新</span>
      </button>
      <button class="button is-info mr-2" @click="exportWindowList">
        <span class="icon">
          <i class="fas fa-download"></i>
        </span>
        <span>エクスポート</span>
      </button>
      <div class="field has-addons ml-4">
        <div class="control">
          <input
            v-model="searchQuery"
            class="input"
            type="text"
            placeholder="ウィンドウ名・アプリ名で検索..."
          />
        </div>
        <div class="control">
          <button class="button is-static">
            <span class="icon">
              <i class="fas fa-search"></i>
            </span>
          </button>
        </div>
      </div>
    </div>

    <div class="stats">
      <div class="stat-item">
        <span class="stat-value">{{ filteredWindows.length }}</span>
        <span class="stat-label">表示中のウィンドウ</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ totalWindows }}</span>
        <span class="stat-label">総ウィンドウ数</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ uniqueApps }}</span>
        <span class="stat-label">アプリ数</span>
      </div>
    </div>

    <div class="windows-table-container">
      <table class="table is-fullwidth is-striped is-hoverable">
        <thead>
          <tr>
            <th @click="setSortField('name')" class="sortable">
              ウィンドウ名
              <span v-if="sortField === 'name'" class="sort-indicator">
                {{ sortDirection === 'asc' ? '↑' : '↓' }}
              </span>
            </th>
            <th @click="setSortField('owner')" class="sortable">
              アプリ名
              <span v-if="sortField === 'owner'" class="sort-indicator">
                {{ sortDirection === 'asc' ? '↑' : '↓' }}
              </span>
            </th>
            <th @click="setSortField('pid')" class="sortable">
              PID
              <span v-if="sortField === 'pid'" class="sort-indicator">
                {{ sortDirection === 'asc' ? '↑' : '↓' }}
              </span>
            </th>
            <th @click="setSortField('layer')" class="sortable">
              レイヤー
              <span v-if="sortField === 'layer'" class="sort-indicator">
                {{ sortDirection === 'asc' ? '↑' : '↓' }}
              </span>
            </th>
            <th>状態</th>
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
              <div class="window-name">
                <span class="window-title" :title="window.name">
                  {{ window.name || '(無題)' }}
                </span>
              </div>
            </td>
            <td>
              <div class="app-info">
                <span class="app-name" :title="window.owner">
                  {{ window.owner }}
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
              <span class="tag" :class="window.isOnscreen ? 'is-success' : 'is-light'">
                {{ window.isOnscreen ? '表示中' : '非表示' }}
              </span>
            </td>
            <td>
              <div class="filter-actions">
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

    <div class="pagination-container" v-if="totalPages > 1">
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
          <li v-for="page in visiblePages" :key="page">
            <button
              class="pagination-link"
              :class="{ 'is-current': page === currentPage }"
              @click="currentPage = page"
            >
              {{ page }}
            </button>
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
  bounds?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export default {
  data(): {
    windowsList: WindowInfo[]
    searchQuery: string
    sortField: string
    sortDirection: 'asc' | 'desc'
    currentPage: number
    itemsPerPage: number
    activeDropdown: number | null
    notification: string | null
    refreshInterval: number | null
  } {
    return {
      windowsList: [],
      searchQuery: '',
      sortField: 'name',
      sortDirection: 'asc',
      currentPage: 1,
      itemsPerPage: 50,
      activeDropdown: null,
      notification: null,
      refreshInterval: null
    }
  },
  computed: {
    filteredWindows(): WindowInfo[] {
      let filtered = [...this.windowsList]

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
        let aVal = a[this.sortField as keyof WindowInfo]
        let bVal = b[this.sortField as keyof WindowInfo]

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
    visiblePages(): number[] {
      const pages = []
      const start = Math.max(1, this.currentPage - 2)
      const end = Math.min(this.totalPages, this.currentPage + 2)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      return pages
    },
    totalWindows(): number {
      return this.windowsList.length
    },
    uniqueApps(): number {
      const apps = new Set(this.windowsList.map((w) => w.owner))
      return apps.size
    }
  },
  mounted() {
    this.refreshData()
    this.startAutoRefresh()
    // 外部クリックでドロップダウンを閉じる
    document.addEventListener('click', this.handleOutsideClick)
  },
  beforeUnmount() {
    this.stopAutoRefresh()
    document.removeEventListener('click', this.handleOutsideClick)
  },
  methods: {
    refreshData() {
      // 実際の実装ではhelperプロセスからウィンドウリストを取得
      // 現在はモックデータを使用
      this.generateMockData()
    },
    generateMockData() {
      // モックデータの生成（実際の実装では削除）
      const mockApps = [
        'Safari',
        'Chrome',
        'VSCode',
        'Terminal',
        'Finder',
        'Spotify',
        'Slack',
        'Discord'
      ]
      const mockWindows = []

      for (let i = 0; i < 120; i++) {
        const app = mockApps[Math.floor(Math.random() * mockApps.length)]
        mockWindows.push({
          id: i + 1,
          name: `${app} Window ${i + 1}`,
          owner: app,
          pid: Math.floor(Math.random() * 10000) + 1000,
          layer: Math.floor(Math.random() * 10),
          isOnscreen: Math.random() > 0.3
        })
      }

      this.windowsList = mockWindows
    },
    startAutoRefresh() {
      this.refreshInterval = window.setInterval(() => {
        this.refreshData()
      }, 10000) // 10秒間隔
    },
    stopAutoRefresh() {
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval)
        this.refreshInterval = null
      }
    },
    setSortField(field: string) {
      if (this.sortField === field) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc'
      } else {
        this.sortField = field
        this.sortDirection = 'asc'
      }
      this.currentPage = 1
    },
    toggleDropdown(windowId: number) {
      this.activeDropdown = this.activeDropdown === windowId ? null : windowId
    },
    handleOutsideClick(event: Event) {
      const target = event.target as Element
      if (!target.closest('.dropdown')) {
        this.activeDropdown = null
      }
    },
    createFilter(property: string, value: string | number, window: WindowInfo) {
      // フィルター作成ロジック（設定ウィンドウにフィルターを追加）
      const filterData = {
        property,
        is: value
      }

      // 新しいフィルターグループを作成
      Electron.send('addFilter', {
        filter: filterData,
        label: `${window.owner} - ${this.getPropertyDisplayName(property)}`
      })

      this.showNotification(
        `フィルターを作成しました: ${this.getPropertyDisplayName(property)} = ${value}`
      )
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
    showNotification(message: string) {
      this.notification = message
      setTimeout(() => {
        this.notification = null
      }, 3000)
    },
    exportWindowList() {
      const data = {
        timestamp: new Date().toISOString(),
        totalWindows: this.totalWindows,
        uniqueApps: this.uniqueApps,
        windows: this.windowsList.map((w) => ({
          name: w.name,
          owner: w.owner,
          pid: w.pid,
          layer: w.layer,
          isOnscreen: w.isOnscreen
        }))
      }

      const dataStr = JSON.stringify(data, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = `window-list-${Date.now()}.json`
      a.click()

      URL.revokeObjectURL(url)
      this.showNotification('ウィンドウリストをエクスポートしました')
    }
  }
}
</script>

<style lang="scss" scoped>
.full-window-list {
  padding: 1.5rem;
  min-height: 100vh;
  background: hsl(0, 0%, 21%);
}

h1 {
  color: #ffffff;
  margin-bottom: 1.5rem;
  font-size: 1.8rem;
  font-weight: 600;
}

.controls {
  display: flex;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;

  .field {
    margin-bottom: 0;
  }
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;

  .stat-item {
    background: #2a2a2a;
    padding: 1rem;
    border-radius: 6px;
    border: 1px solid #444;
    text-align: center;

    .stat-value {
      display: block;
      font-size: 2rem;
      font-weight: 700;
      color: #4a90e2;
      margin-bottom: 0.5rem;
    }

    .stat-label {
      color: #b0b0b0;
      font-size: 0.9rem;
    }
  }
}

.windows-table-container {
  background: #2a2a2a;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #444;

  .table {
    background: transparent;
    margin-bottom: 0;

    th {
      background: #1a1a1a;
      color: #b0b0b0;
      border: none;
      padding: 0.5rem 0.8rem;
      font-weight: 600;
      font-size: 0.9rem;

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
      font-size: 0.85rem;
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
      .app-name {
        color: #86efac;
        font-weight: 500;
        display: block;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
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

  .pagination {
    .pagination-link,
    .pagination-previous,
    .pagination-next {
      background: #2a2a2a;
      border-color: #444;
      color: #b0b0b0;

      &:hover {
        background: #333;
        border-color: #4a90e2;
      }

      &.is-current {
        background: #4a90e2;
        border-color: #4a90e2;
        color: white;
      }

      &:disabled {
        background: #1a1a1a;
        color: #666;
        cursor: not-allowed;
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

.mr-2 {
  margin-right: 0.5rem;
}

.ml-4 {
  margin-left: 1rem;
}
</style>

<style lang="sass" scoped>
@import 'bulma/css/bulma.css'
</style>
