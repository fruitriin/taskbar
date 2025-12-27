<template>
  <div class="add-filter-form" style="margin-top: 0.5rem; max-width: 100%">
    <!-- プラスボタン（フォーム非表示時） -->
    <div v-if="!isExpanded" class="add-button-container">
      <button
        class="button is-small is-rounded"
        :style="{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          width: filterIndex !== undefined ? '100%' : 'auto',
          background: '#059669',
          borderColor: '#059669',
          color: 'white',
          fontWeight: '600',
          transition: 'all 0.2s'
        }"
        @click="isExpanded = true"
        @mouseenter="(e) => (e.currentTarget.style.background = '#047857')"
        @mouseleave="(e) => (e.currentTarget.style.background = '#059669')"
      >
        <span style="font-size: 1.1rem; line-height: 1">+</span>
        <span v-if="filterIndex === undefined">新しいグループを作成</span>
        <span v-else>条件を追加</span>
      </button>
    </div>

    <!-- フォーム（展開時） -->
    <div
      v-if="isExpanded"
      style="
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-width: 100%;
        background: #2a2a2a;
        padding: 0.75rem;
        border-radius: 6px;
        border: 1px solid #444;
      "
    >
      <div style="display: flex; flex-direction: column; gap: 0.5rem">
        <div class="control">
          <div class="select is-small" style="width: 100%">
            <select
              v-model="filter.property"
              style="
                width: 100%;
                background: #1a1a1a;
                border-color: #444;
                color: #e0e0e0;
                font-size: 0.8rem;
              "
            >
              <option value="" style="background: #1a1a1a; color: #888">
                プロパティを選択
              </option>
              <option value="kCGWindowName" style="background: #1a1a1a; color: #e0e0e0">
                ウィンドウ名
              </option>
              <option value="kCGWindowOwnerName" style="background: #1a1a1a; color: #e0e0e0">
                アプリケーション名
              </option>
              <option value="kCGWindowOwnerPID" style="background: #1a1a1a; color: #e0e0e0">
                プロセスID
              </option>
              <option value="kCGWindowNumber" style="background: #1a1a1a; color: #e0e0e0">
                ウィンドウ番号
              </option>
              <option value="kCGWindowLayer" style="background: #1a1a1a; color: #e0e0e0">
                ウィンドウレイヤー
              </option>
              <option value="kCGWindowIsOnscreen" style="background: #1a1a1a; color: #e0e0e0">
                画面表示状態
              </option>
              <option value="kCGWindowSharingState" style="background: #1a1a1a; color: #e0e0e0">
                共有状態
              </option>
              <option value="kCGWindowStoreType" style="background: #1a1a1a; color: #e0e0e0">
                ストアタイプ
              </option>
            </select>
          </div>
        </div>
        <div class="control">
          <input
            v-model="filter.is"
            class="input is-small"
            :type="getInputType(filter.property)"
            :placeholder="getPlaceholder(filter.property)"
            style="
              width: 100%;
              background: #1a1a1a;
              border-color: #444;
              color: #e0e0e0;
              font-size: 0.8rem;
            "
          />
        </div>
      </div>
      <div style="display: flex; gap: 0.5rem; margin-top: 0.25rem">
        <button
          class="button is-small"
          :disabled="!filter.property"
          :style="{
            flex: 1,
            background: filter.property ? '#059669' : '#333',
            borderColor: filter.property ? '#059669' : '#444',
            color: filter.property ? 'white' : '#888',
            fontWeight: '600',
            cursor: filter.property ? 'pointer' : 'not-allowed'
          }"
          @click="handleAddFilter"
        >
          {{ filterIndex !== undefined ? '追加' : '作成' }}
        </button>
        <button
          class="button is-small"
          style="flex: 1; background: #2a2a2a; border-color: #444; color: #b0b0b0"
          @click="cancelAdd"
        >
          キャンセル
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export type Filter = {
  property: string
  is: string | number | boolean
}

export default {
  name: 'AddFilter',
  props: {
    filterIndex: {
      type: Number,
      required: false,
      default: undefined
    }
  },
  emits: ['add-filter'],
  data(): { filter: Filter; isExpanded: boolean } {
    return {
      filter: {
        property: '',
        is: ''
      },
      isExpanded: false
    }
  },
  methods: {
    handleAddFilter(): void {
      const convertedFilter = { ...this.filter }

      // 型変換を行う
      if (this.getInputType(this.filter.property) === 'number') {
        const numValue = Number(this.filter.is)
        convertedFilter.is = isNaN(numValue) ? this.filter.is : numValue
      } else if (
        this.filter.property === 'kCGWindowIsOnscreen' &&
        typeof this.filter.is === 'string'
      ) {
        // booleanの場合
        convertedFilter.is = this.filter.is === 'true' || this.filter.is === '1'
      }

      this.$emit('add-filter', {
        filter: convertedFilter,
        filterIndex: this.filterIndex
      })
      this.filter.property = ''
      this.filter.is = ''
      this.isExpanded = false
    },
    cancelAdd(): void {
      this.filter.property = ''
      this.filter.is = ''
      this.isExpanded = false
    },
    getInputType(property: string): string {
      const numericProperties = [
        'kCGWindowLayer',
        'kCGWindowOwnerPID',
        'kCGWindowNumber',
        'kCGWindowIsOnscreen',
        'kCGWindowSharingState',
        'kCGWindowStoreType'
      ]
      return numericProperties.includes(property) ? 'number' : 'text'
    },
    getPlaceholder(property: string): string {
      const placeholders: Record<string, string> = {
        kCGWindowName: 'ウィンドウ名を入力...',
        kCGWindowOwnerName: 'アプリケーション名を入力...',
        kCGWindowOwnerPID: 'プロセスIDを入力...',
        kCGWindowNumber: 'ウィンドウ番号を入力...',
        kCGWindowLayer: 'レイヤー番号を入力...',
        kCGWindowIsOnscreen: '0または1を入力...',
        kCGWindowSharingState: '共有状態番号を入力...',
        kCGWindowStoreType: 'ストアタイプ番号を入力...'
      }
      return placeholders[property] || '値を入力...'
    }
  }
}
</script>

<style lang="sass" scoped>
@import 'bulma/css/bulma.css'
</style>
