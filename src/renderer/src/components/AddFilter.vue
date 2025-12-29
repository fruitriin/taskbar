<template>
  <div class="add-filter-form">
    <!-- プラスボタン（フォーム非表示時） -->
    <div v-if="!isExpanded" class="add-button-container">
      <button
        class="button is-small is-rounded add-button"
        :class="{ 'full-width': filterIndex !== undefined }"
        @click="isExpanded = true"
      >
        <span class="plus-icon">+</span>
        <span v-if="filterIndex === undefined">新しいグループを作成</span>
        <span v-else>条件を追加</span>
      </button>
    </div>

    <!-- フォーム（展開時） -->
    <div v-if="isExpanded" class="form-container">
      <div class="form-fields">
        <div class="control">
          <div class="select is-small select-wrapper">
            <select v-model="filter.property" class="filter-select">
              <option value="" class="placeholder-option">プロパティを選択</option>
              <option value="kCGWindowName" class="filter-option">ウィンドウ名</option>
              <option value="kCGWindowOwnerName" class="filter-option">アプリケーション名</option>
              <option value="kCGWindowOwnerPID" class="filter-option">プロセスID</option>
              <option value="kCGWindowNumber" class="filter-option">ウィンドウ番号</option>
              <option value="kCGWindowLayer" class="filter-option">ウィンドウレイヤー</option>
              <option value="kCGWindowIsOnscreen" class="filter-option">画面表示状態</option>
              <option value="kCGWindowSharingState" class="filter-option">共有状態</option>
              <option value="kCGWindowStoreType" class="filter-option">ストアタイプ</option>
            </select>
          </div>
        </div>
        <div class="control">
          <input
            v-model="filter.is"
            class="input is-small filter-input"
            :type="getInputType(filter.property)"
            :placeholder="getPlaceholder(filter.property)"
          />
        </div>
      </div>
      <div class="action-buttons">
        <button
          class="button is-small submit-button"
          :class="{ disabled: !filter.property }"
          :disabled="!filter.property"
          @click="handleAddFilter"
        >
          {{ filterIndex !== undefined ? '追加' : '作成' }}
        </button>
        <button class="button is-small cancel-button" @click="cancelAdd">
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

<style lang="scss" scoped>
@import 'bulma/css/bulma.css';

.add-filter-form {
  margin-top: 0.5rem;
  max-width: 100%;
}

.add-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: #059669;
  border-color: #059669;
  color: white;
  font-weight: 600;
  transition: all 0.2s;

  &:hover {
    background: #047857;
  }

  &.full-width {
    width: 100%;
  }
}

.plus-icon {
  font-size: 1.1rem;
  line-height: 1;
}

.form-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 100%;
  background: #2a2a2a;
  padding: 0.75rem;
  border-radius: 6px;
  border: 1px solid #444;
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.select-wrapper {
  width: 100%;
}

.filter-select {
  width: 100%;
  background: #1a1a1a;
  border-color: #444;
  color: #e0e0e0;
  font-size: 0.8rem;
}

.placeholder-option {
  background: #1a1a1a;
  color: #888;
}

.filter-option {
  background: #1a1a1a;
  color: #e0e0e0;
}

.filter-input {
  width: 100%;
  background: #1a1a1a;
  border-color: #444;
  color: #e0e0e0;
  font-size: 0.8rem;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.submit-button {
  flex: 1;
  background: #059669;
  border-color: #059669;
  color: white;
  font-weight: 600;
  cursor: pointer;

  &.disabled {
    background: #333;
    border-color: #444;
    color: #888;
    cursor: not-allowed;
  }
}

.cancel-button {
  flex: 1;
  background: #2a2a2a;
  border-color: #444;
  color: #b0b0b0;
}
</style>
