<template>
  <div class="option">
    <h1>Taskbar.fm 設定</h1>

    <!-- 権限セクション -->
    <div class="permissions-section">
      <PermissionStatus />
    </div>

    <div class="main-options">
      <div class="field is-horizontal">
        <div class="field-label is-normal">
          <label class="label">表示位置</label>
        </div>
        <div class="field-body">
          <div class="select">
            <select v-model="options.layout">
              <option value="left">left</option>
              <option value="bottom">bottom</option>
              <option value="right">right</option>
            </select>
          </div>
        </div>
      </div>
      <div class="in-app-sort field is-horizontal">
        <div class="field-label is-normal">
          <label class="label">並び順</label>
        </div>
        <div class="field-body">
          <div class="select">
            <select v-model="options.windowSortByPositionInApp">
              <option :value="false">起動順</option>
              <option :value="true">座標順</option>
            </select>
          </div>
        </div>
      </div>
      <div class="sort-rule field is-horizontal">
        <div class="field-label">
          <label class="label">並べ替えルール</label>
        </div>
        <div class="field-body" style="display: block">
          <div v-for="rule in sortRule" :key="rule.name" class="sort-rule">
            <div class="field is-normal">
              <label class="label">{{ rule.name }}</label>
            </div>
            <div class="field-body">
              <draggable
                key="index"
                v-model="options[rule.name]"
                tag="transition-group"
                :component-data="{
                  tag: 'ul',
                  type: 'transition-group',
                  key: '1',
                  name: !drag ? 'flip-list' : null
                }"
                :group="rule.name"
                item-key="id"
                ghost-class=".ghost"
                @start="drag = true"
                @end="drag = false"
              >
                <template #item="{ element }">
                  <li :key="element" class="button" style="cursor: pointer">
                    {{ element }}
                  </li>
                </template>
              </draggable>
            </div>
          </div>
        </div>
      </div>
      <div class="filterRule field is-horizontal">
        <div class="field-label">
          <label class="label">フィルター </label>
        </div>
        <div class="field-body" style="width: 100%;">
          <div style="width: 100%;">
            <!-- フィルターグループの表示（インライン式レイアウト） -->
            <div
              v-for="(filterElements, i) in filters"
              :key="i"
              class="inline-group"
              :style="{
                background: '#2a2a2a',
                padding: '1rem',
                borderRadius: '6px',
                border: filterElements.length > 1 ? '2px solid #4a90e2' : '2px solid #059669',
                marginBottom: '0.75rem',
                width: '100%',
                boxSizing: 'border-box'
              }"
            >
              <!-- グループヘッダー -->
              <div class="group-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <span :style="{
                  color: filterElements.length > 1 ? '#4a90e2' : '#059669',
                  fontWeight: 'bold',
                  fontSize: '0.875rem'
                }">
                  {{ filterElements.length > 1 ? '📁' : '📄' }} フィルターグループ{{ i + 1 }} 
                  ({{ filterElements.length }}条件{{ filterElements.length > 1 ? ' - AND' : '' }})
                </span>
                <button class="button is-small is-danger" @click="removeFilter(i)">
                  グループ削除
                </button>
              </div>

              <!-- フィルター条件のピル表示 -->
              <div class="filter-pills" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;">
                <div
                  v-for="(filter, k) in filterElements"
                  :key="k"
                  class="filter-pill"
                  :style="{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: '#1a1a1a',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '20px',
                    border: filterElements.length > 1 ? '1px solid #4a90e2' : '1px solid #059669'
                  }"
                >
                  <span style="color: #7dd3fc; font-size: 0.8rem; margin-right: 0.3rem;">
                    {{ getPropertyDisplayName(filter.property) }}
                  </span>
                  <span style="color: #888; margin-right: 0.3rem;">=</span>
                  <span style="color: #86efac; font-size: 0.8rem; margin-right: 0.3rem;">
                    {{ filter.is }}
                  </span>
                  <button 
                    style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.8rem;"
                    @click="removeCondition(i, k)"
                  >
                    ×
                  </button>
                </div>
              </div>

              <!-- 条件追加フォーム -->
              <AddFilter :filter-index="i" @add-filter="handleAddFilter" />
            </div>

            <!-- 新規グループ作成 -->
            <div style="margin-top: 1rem;">
              <h5 style="color: #b0b0b0; margin-bottom: 0.5rem; font-size: 0.875rem;">新規フィルターグループを作成</h5>
              <AddFilter @add-filter="handleAddFilter" />
            </div>
          </div>
        </div>
      </div>

      <div class="init field is-horizontal">
        <div class="field-label">
          <label class="label">設定の初期化と終了</label>
        </div>
        <div class="field-body" style="gap: 16px">
          <button class="button is-danger" @click="Electron.send('clearSetting')">初期化</button>
          <button class="button is-primary ml-4" @click="Electron.send('restart')">再起動</button>
          <button class="button ml-4" @click="Electron.send('exit')">終了</button>
        </div>
      </div>
    </div>
    <div class="sort-rule">
      <div class="ghost"></div>
    </div>
  </div>
</template>

<script lang="ts">
import { Electron } from '../utils'
import draggable from 'vuedraggable'
import AddFilter from '../components/AddFilter.vue'
import PermissionStatus from '../components/PermissionStatus.vue'

export default {
  components: {
    draggable,
    AddFilter,
    PermissionStatus
  },
  data(): {
    drag: boolean
    options: any
    sortRule: Array<{ name: string; label: string }>
    filters: Array<Array<{ property: string; is: string }>>
    newFilter: { property: string; is: string }
  } {
    return {
      drag: false,
      options: {
        ...window.store.options
      },
      sortRule: [
        { name: 'headers', label: '先頭' },
        { name: 'footers', label: '末尾' }
      ],
      filters: [...window.store.filters],
      newFilter: {
        property: '',
        is: ''
      }
    }
  },
  computed: {
    Electron(): typeof Electron {
      return Electron
    }
  },
  watch: {
    options: {
      deep: true,
      handler(value: any): void {
        Electron.send('setOptions', value)
      }
    }
  },
  methods: {
    removeFilter(index: number): void {
      const newFilters = [...this.filters]
      newFilters.splice(index, 1)
      this.filters = newFilters
      Electron.send('setFilters', this.filters)
    },
    removeCondition(groupIndex: number, conditionIndex: number): void {
      const newFilters = [...this.filters]
      newFilters[groupIndex].splice(conditionIndex, 1)
      
      // グループが空になったら、グループ自体を削除
      if (newFilters[groupIndex].length === 0) {
        newFilters.splice(groupIndex, 1)
      }
      
      this.filters = newFilters
      Electron.send('setFilters', this.filters)
    },
    getPropertyDisplayName(property: string): string {
      const displayNames: Record<string, string> = {
        kCGWindowName: 'ウィンドウ名',
        kCGWindowOwnerName: 'アプリ名',
        kCGWindowOwnerPID: 'プロセスID',
        kCGWindowNumber: 'ウィンドウ番号',
        kCGWindowLayer: 'レイヤー',
        kCGWindowIsOnscreen: '画面表示',
        kCGWindowSharingState: '共有状態',
        kCGWindowStoreType: 'ストア'
      }
      return displayNames[property] || property
    },
    handleAddFilter(data: {
      filter: { property: string; is: string }
      filterIndex?: number
    }): void {
      const newFilters = [...this.filters]
      if (data.filterIndex !== undefined) {
        // 既存のフィルターグループにルールを追加
        newFilters[data.filterIndex].push(data.filter)
      } else {
        // 新しいフィルターグループを作成
        newFilters.push([data.filter])
      }
      this.filters = newFilters
      Electron.send('setFilters', this.filters)
    }
  }
}
</script>
<style>
#app {
  overflow-y: auto !important;
  padding-bottom: 24px;
}
</style>

<style lang="scss" scoped>
.option {
  padding: 24px;
}

.permissions-section {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  // border-bottom: 1px solid #e5e7eb;
}

.label {
  color: white !important;
}

.sort-rule li {
  margin-left: 12px;
}

.sort-rule li:first-of-type {
  margin-left: 0;
}

.flip-list-move {
  transition: transform 0.5s;
}

.no-move {
  transition: transform 0s;
}

.ghost {
  opacity: 0.5;
  background: #c8ebfb;
}

.list-group {
  min-height: 20px;
}

.list-group-item {
  cursor: move;
}

.list-group-item i {
  cursor: pointer;
}
</style>

<style lang="sass" scoped>
@import 'bulma/css/bulma.css'
</style>
