<template>
  <div class="option">
    <h1>Taskbar.fm 設定</h1>
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
          <div class="sort-rule" v-for="rule in sortRule" :key="rule.name">
            <div class="field is-normal">
              <label class="label">{{ rule.name }}</label>
            </div>
            <div class="field-body">
              <draggable
                tag="transition-group"
                v-model="options[rule.name]"
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
                key="index"
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
        <div class="field-body">
          <div>
            <div class="filter-item" v-for="(filterElements, i) in filters" :key="i" style=" align-items: center; margin-bottom: 8px; border: 2px solid gray;">
              <div style="display: flex;">
              <div class="filter-content" v-for="(filter, k) in filterElements" :key="k" style="margin-right: 8px;">
                {{ filter.property }} - {{ filter.is }}
              </div>
              <div class="filter-actions">
                <button class="button is-small is-danger" @click="removeFilter(i)">
                  <span class="icon is-small">
                    ✗
                  </span>
                </button>
              </div>
            </div>
              <AddFilter :filter-index="i" @add-filter="handleAddFilter" />
            </div>
            
            <AddFilter @add-filter="handleAddFilter" />
          </div>
        </div>
      </div>
      

      <div class="init field is-horizontal">
        <div class="field-label">
          <label class="label">設定の初期化と終了</label>
        </div>
        <div class="field-body" style="gap: 16px;">
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

export default {
  components: {
    draggable,
    AddFilter
  },
  data(): {
    drag: boolean;
    options: any;
    sortRule: Array<{name: string; label: string}>;
    filters: Array<Array<{property: string; is: string}>>;
    newFilter: {property: string; is: string};
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
    handleAddFilter(data: {filter: {property: string; is: string}, filterIndex?: number}): void {
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
  },
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
/*! bulma.io v0.9.4 | MIT License | github.com/jgthms/bulma */
@import 'bulma/sass/utilities/_all'
@import 'bulma/sass/form/_all'
@import 'bulma/sass/components/_all'
@import "bulma/sass/elements/_all"
</style>
