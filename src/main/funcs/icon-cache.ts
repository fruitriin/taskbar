import { app } from 'electron'
import path from 'path'
import fs from 'fs'

class IconCacheStore {
  private iconCacheDir: string
  private iconJsonPath: string

  constructor() {
    // Electronの標準userData pathを使用
    this.iconCacheDir = path.join(app.getPath('userData'), 'icon_cache')
    this.iconJsonPath = path.join(this.iconCacheDir, 'icons.json')
    
    // ディレクトリが存在しない場合は作成
    this.ensureCacheDir()
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.iconCacheDir)) {
      fs.mkdirSync(this.iconCacheDir, { recursive: true })
    }
  }

  get cacheDirPath(): string {
    return this.iconCacheDir
  }

  get jsonPath(): string {
    return this.iconJsonPath
  }

  // icons.jsonを読み込み
  loadIcons(): Record<string, string> {
    try {
      if (fs.existsSync(this.iconJsonPath)) {
        const data = fs.readFileSync(this.iconJsonPath, 'utf8')
        return JSON.parse(data)
      }
    } catch (error) {
      console.error('Failed to load icons.json:', error)
    }
    return {}
  }

  // icons.jsonに保存
  saveIcons(icons: Record<string, string>): void {
    try {
      this.ensureCacheDir()
      fs.writeFileSync(this.iconJsonPath, JSON.stringify(icons, null, 2))
    } catch (error) {
      console.error('Failed to save icons.json:', error)
    }
  }

  // icons.jsonを監視
  watchIcons(callback: (eventType: string) => void): fs.FSWatcher | null {
    try {
      if (fs.existsSync(this.iconJsonPath)) {
        return fs.watch(this.iconJsonPath, callback)
      }
    } catch (error) {
      console.error('Failed to watch icons.json:', error)
    }
    return null
  }

  // Swift側で使用するためのキャッシュディレクトリパスを取得
  getCacheDirForSwift(): string {
    return this.iconCacheDir
  }
}

// シングルトンインスタンス
export const iconCache = new IconCacheStore()