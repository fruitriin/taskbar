<template>
  <div class="add-filter-form" style="margin-top: 16px">
    <div class="field has-addons">
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
          {{ filterIndex !== undefined ? 'ルール追加' : '新規グループ' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
interface Filter {
  property: string
  is: string
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
  data(): { filter: Filter } {
    return {
      filter: {
        property: '',
        is: ''
      }
    }
  },
  methods: {
    handleAddFilter(): void {
      this.$emit('add-filter', {
        filter: { ...this.filter },
        filterIndex: this.filterIndex
      })
      this.filter.property = ''
      this.filter.is = ''
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
