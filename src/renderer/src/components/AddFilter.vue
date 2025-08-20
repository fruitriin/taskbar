<template>
  <div class="add-filter-form" style="margin-top: 16px; max-width: 380px">
    <!-- プラスボタン（フォーム非表示時） -->
    <div v-if="!isExpanded" class="add-button-container">
      <button
        class="button is-small is-primary is-rounded"
        @click="isExpanded = true"
        style="display: flex; align-items: center; gap: 0.5rem"
      >
        <span style="font-size: 1rem">+</span>
        <span>{{ filterIndex !== undefined ? '' : '新しいグループを作成' }}</span>
      </button>
    </div>

    <!-- フォーム（展開時） -->
    <div v-if="isExpanded" class="field has-addons">
      <div class="control">
        <div class="select is-small">
          <select v-model="filter.property">
            <option value="">プロパティを選択</option>
            <option value="kCGWindowName">ウィンドウ名</option>
            <option value="kCGWindowOwnerName">アプリケーション名</option>
            <option value="kCGWindowOwnerPID">プロセスID</option>
            <option value="kCGWindowNumber">ウィンドウ番号</option>
            <option value="kCGWindowLayer">ウィンドウレイヤー</option>
            <option value="kCGWindowIsOnscreen">画面表示状態</option>
            <option value="kCGWindowSharingState">共有状態</option>
            <option value="kCGWindowStoreType">ストアタイプ</option>
          </select>
        </div>
      </div>
      <div class="control">
        <input
          v-model="filter.is"
          class="input is-small"
          :type="getInputType(filter.property)"
          :placeholder="getPlaceholder(filter.property)"
        />
      </div>
      <div class="control">
        <button
          class="button is-small is-primary"
          :disabled="!filter.property"
          @click="handleAddFilter"
        >
          {{ filterIndex !== undefined ? '追加' : '作成' }}
        </button>
      </div>
      <div class="control">
        <button class="button is-small" @click="cancelAdd">キャンセル</button>
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
