<template>
  <div class="option">
    <h1>Taskbar.fm 設定</h1>

    <div class="main-options">
      <div class="field is-horizontal">
        <div class="field-label is-normal">
          <label class="label">システム権限</label>
        </div>
        <div class="field-body">
          <PermissionStatus />
        </div>
      </div>
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
          <label class="label">フィルター</label>
        </div>
        <div class="field-body" style="width: 100%">
          <!-- メインエリア：フィルターピル -->
          <div
            style="display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: flex-start"
          >
            <div
              v-for="(filterGroup, i) in labeledFilters"
              :key="i"
              style="
                display: inline-flex;
                align-items: center;
                background: #2a2a2a;
                border: 1px solid #444;
                border-radius: 20px;
                padding: 0.3rem 0.6rem;
                font-size: 0.8rem;
                margin: 0.1rem;
                cursor: pointer;
                transition: all 0.2s;
              "
              :style="{
                borderColor: selectedFilterIndex === i ? '#4a90e2' : '#444',
                background: selectedFilterIndex === i ? '#1a3a5a' : '#2a2a2a'
              }"
              @click="selectFilter(i, $event)"
            >
              <span
                :style="{
                  color: filterGroup.filters.length > 1 ? '#4a90e2' : '#059669',
                  fontWeight: '600'
                }"
                style="margin-right: 0.3rem"
              >
                {{ filterGroup.label }}
              </span>
              <span style="color: #888; margin-right: 0.3rem"
                >({{ filterGroup.filters.length }})</span
              >
              <button
                style="
                  background: none;
                  border: none;
                  color: #ef4444;
                  cursor: pointer;
                  font-size: 0.7rem;
                "
                @click.stop="removeFilter(i)"
              >
                ×
              </button>
            </div>
            <div style="display: inline-flex; margin-left: 0.5rem">
              <AddFilter @add-filter="handleAddFilter" />
            </div>
          </div>
        </div>
      </div>

      <!-- フローティング編集パネル -->
      <div
        v-if="selectedFilterIndex !== null && panelPosition"
        class="floating-edit-panel"
        :style="{
          position: 'fixed',
          top: panelPosition.top,
          left: panelPosition.left,
          width: '320px',
          background: '#1a1a1a',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid #4a90e2',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          maxHeight: '80vh',
          overflowY: 'auto'
        }"
      >
        <div
          style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 0.8rem;
          "
        >
          <span style="color: #4a90e2; font-weight: 600; font-size: 0.9rem">編集中</span>
          <button
            style="
              background: none;
              border: none;
              color: #888;
              cursor: pointer;
              font-size: 1.2rem;
              padding: 0.5rem 0.5rem 0.5rem 1rem;
              margin: -0.5rem -0.5rem -0.5rem -1rem;
              line-height: 1;
            "
            @click="
              selectedFilterIndex = null;
              panelPosition = null;
            "
          >
            ✕
          </button>
        </div>

        <!-- ラベル編集（コンパクト） -->
        <div style="margin-bottom: 0.6rem">
          <label
            style="color: #b0b0b0; font-size: 0.75rem; display: block; margin-bottom: 0.2rem"
            >ラベル</label
          >
          <input
            v-model="editingLabel"
            class="input is-small"
            style="width: 100%; font-size: 0.8rem"
            @input="updateLabel(selectedFilterIndex, editingLabel)"
          />
        </div>

        <!-- フィルター条件（コンパクト） -->
        <div>
          <label
            style="color: #b0b0b0; font-size: 0.75rem; display: block; margin-bottom: 0.3rem"
          >
            条件 ({{ labeledFilters[selectedFilterIndex].filters.length }}件)
          </label>
          <div
            style="display: flex; flex-direction: column; gap: 0.2rem; margin-bottom: 0.4rem"
          >
            <div
              v-for="(filter, k) in labeledFilters[selectedFilterIndex].filters"
              :key="k"
              style="
                font-size: 0.7rem;
                background: #2a2a2a;
                padding: 0.3rem 0.4rem;
                border-radius: 4px;
                display: flex;
                justify-content: space-between;
                align-items: center;
              "
            >
              <span style="color: #ccc"
                >{{ getPropertyDisplayName(filter.property) }}={{ filter.is }}</span
              >
              <button
                style="
                  background: none;
                  border: none;
                  color: #ef4444;
                  cursor: pointer;
                  font-size: 0.7rem;
                "
                @click="removeCondition(selectedFilterIndex, k)"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        <AddFilter :filter-index="selectedFilterIndex" @add-filter="handleAddFilter" />
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
    labeledFilters: Array<{
      label: string
      filters: Array<{ property: string; is: string | number | boolean }>
    }>
    newFilter: { property: string; is: string }
    editingLabel: string
    editingLabelIndex: number | null
    selectedFilterIndex: number | null
    panelPosition: { top: string; left: string } | null
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
      labeledFilters: [...JSON.parse(JSON.stringify(window.store.labeledFilters))],
      newFilter: {
        property: '',
        is: ''
      },
      editingLabel: '',
      editingLabelIndex: null,
      selectedFilterIndex: null,
      panelPosition: null
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
      this.labeledFilters.splice(index, 1)

      // 選択中のフィルターインデックスを調整
      if (this.selectedFilterIndex === index) {
        // 削除したグループが選択中だった場合、選択を解除
        this.selectedFilterIndex = null
      } else if (this.selectedFilterIndex !== null && this.selectedFilterIndex > index) {
        // 削除したグループより後ろが選択されていた場合、インデックスを調整
        this.selectedFilterIndex -= 1
      }

      Electron.send('setLabeledFilters', this.labeledFilters)
    },
    removeCondition(groupIndex: number, conditionIndex: number): void {
      this.labeledFilters[groupIndex].filters.splice(conditionIndex, 1)
      // condition が0件になったらグループごと削除
      if (this.labeledFilters[groupIndex].filters.length === 0) {
        this.labeledFilters.splice(groupIndex, 1)
        this.selectedFilterIndex = null
      }

      Electron.send('setLabeledFilters', this.labeledFilters)
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
      const newFilters = [...this.labeledFilters]
      if (data.filterIndex !== undefined) {
        // 既存のフィルターグループにルールを追加
        this.labeledFilters[data.filterIndex].filters.push(data.filter)
      } else {
        // 新しいフィルターグループを作成
        const propertyName = this.getPropertyDisplayName(data.filter.property)
        const newGroupLabel = `${propertyName}:${data.filter.is}を除外`
        this.labeledFilters.push({
          label: newGroupLabel,
          filters: [data.filter]
        })
        this.selectedFilterIndex = null
      }
      Electron.send('setLabeledFilters', this.labeledFilters)
    },
    updateLabel(_index: number, newLabel: string): void {
      if (this.selectedFilterIndex === null) return

      this.labeledFilters[this.selectedFilterIndex].label = newLabel

      Electron.send('setLabeledFilters', this.labeledFilters)
    },
    startEditLabel(index: number): void {
      this.editingLabelIndex = index
    },
    finishEditLabel(): void {
      if (this.editingLabelIndex !== null) {
        Electron.send('setLabeledFilters', this.labeledFilters)
        this.editingLabelIndex = null
      }
    },
    selectFilter(index: number, event: MouseEvent): void {
      this.selectedFilterIndex = index
      this.editingLabel = this.labeledFilters[this.selectedFilterIndex].label

      // クリックされたボタン要素の位置を取得
      const button = event.currentTarget as HTMLElement
      const buttonRect = button.getBoundingClientRect()

      // パネルのサイズ（概算）
      const panelWidth = 320
      const panelHeight = 300 // 最大高さの概算（max-height: 80vhも考慮）

      // ビューポートのサイズ
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      const offset = 8 // ボタンとパネルの間のマージン
      let left = buttonRect.left
      let top: number

      // 第一候補：パネルの上端をボタンの下端に配置
      top = buttonRect.bottom + offset

      // ボタンの下に表示するスペースがあるかチェック
      const spaceBelow = viewportHeight - buttonRect.bottom - offset - 20 // 20pxはマージン

      // はみ出る場合：パネルの下端をボタンの上端に配置
      if (spaceBelow < panelHeight) {
        // パネルの下端がボタンの上端に来るように計算
        top = buttonRect.top - panelHeight - offset
      }

      // 右端のチェック：パネルが画面からはみ出る場合は左にずらす
      if (left + panelWidth > viewportWidth - 10) {
        left = viewportWidth - panelWidth - 10
      }

      // 左端のチェック
      if (left < 10) {
        left = 10
      }

      // 上端のチェック（ボタンの上に表示した場合でもはみ出る場合）
      if (top < 10) {
        top = 10
      }

      this.panelPosition = {
        top: `${top}px`,
        left: `${left}px`
      }
    }
  },
  mounted(): void {
    // fullWindowListからのフィルター追加を受け取る
    Electron.listen('labeledFiltersUpdated', (_event: any, updatedFilters: any) => {
      this.labeledFilters = [...updatedFilters]
    })
  },
  beforeUnmount(): void {
    // リスナーをクリーンアップ
    window.electron.ipcRenderer.removeAllListeners('labeledFiltersUpdated')
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

/* フィルターピルのホバーエフェクト */
.filterRule [style*='border-radius: 20px']:hover {
  transform: scale(1.02);
  border-color: #4a90e2 !important;
}
</style>

<style lang="sass" scoped>
@import 'bulma/css/bulma.css'
</style>
