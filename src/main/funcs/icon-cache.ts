import { app as App } from 'electron'
import path from 'path'
import fs from 'fs'
import { appendFileSync } from 'fs'
import { scheduleHelperRestart } from './helper'
// import console from 'riinlogger'
import { is } from '@electron-toolkit/utils'

class IconCacheStore {
  private iconCacheDir: string
  private iconJsonPath: string

  constructor() {
    // taskbar.fmアプリのユーザーデータディレクトリを直接使用
    this.iconCacheDir = path.join(App.getPath('appData'), 'taskbar.fm')
    this.iconJsonPath = path.join(this.iconCacheDir, 'icons.json')

    // ディレクトリが存在しない場合は作成
    this.ensureCacheDir()
  }

  // エラーログをファイルに書き出す関数
  private writeIconLoadErrorLog(error: any, iconsJsonContent: string): void {
    if (!is.dev) return
    const logPath = path.join(__dirname, '../../logs', 'icon-load-errors.log')

    const timestamp = new Date().toISOString()
    const logEntry = `
========================================
Timestamp: ${timestamp}
Error: ${error}
Error Message: ${error.message || 'N/A'}
Error Stack: ${error.stack || 'N/A'}
icons.json Path: ${this.iconJsonPath}
icons.json Content Length: ${iconsJsonContent.length} chars
icons.json Content:
${iconsJsonContent}
========================================

`
    try {
      // logsディレクトリが存在しない場合は作成
      const logsDir = path.dirname(logPath)
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true })
      }

      appendFileSync(logPath, logEntry, 'utf8')
      console.log(`Icon load error logged to ${logPath}`)
    } catch (writeError) {
      console.error('Failed to write icon load error log:', writeError)
    }
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

  // icons.jsonを読み込み（リトライと復旧機能付き）
  loadIcons(): Record<string, string> {
    const maxRetries = 3
    let retryCount = 0

    while (retryCount < maxRetries) {
      try {
        if (fs.existsSync(this.iconJsonPath)) {
          const data = fs.readFileSync(this.iconJsonPath, 'utf8')

          // JSONパースを試行
          const parsed = JSON.parse(data)
          return parsed
        }
        return {}
      } catch (error) {
        retryCount++
        console.error(`Failed to load icons.json (attempt ${retryCount}/${maxRetries}):`, error)

        // icons.jsonの内容を読み取ってログに記録
        let iconsJsonContent = ''
        try {
          if (fs.existsSync(this.iconJsonPath)) {
            iconsJsonContent = fs.readFileSync(this.iconJsonPath, 'utf8')
          } else {
            iconsJsonContent = '[File does not exist]'
          }
        } catch (readError) {
          iconsJsonContent = `[Failed to read file: ${readError}]`
        }

        // エラーログをファイルに書き出し
        this.writeIconLoadErrorLog(error, iconsJsonContent)

        if (retryCount >= maxRetries) {
          // 最大リトライ回数に達した場合、壊れたファイルをバックアップして削除
          try {
            const backupPath = `${this.iconJsonPath}.backup.${Date.now()}`
            if (fs.existsSync(this.iconJsonPath)) {
              fs.copyFileSync(this.iconJsonPath, backupPath)
              fs.unlinkSync(this.iconJsonPath)
              console.log(`Corrupted icons.json backed up to ${backupPath} and removed`)
            }
          } catch (backupError) {
            console.error('Failed to backup/remove corrupted icons.json:', backupError)
          }

          // ヘルパーの再起動をスケジュールして新しいアイコンデータを生成
          console.log('Scheduling helper restart to regenerate icons.json')
          scheduleHelperRestart(2000)

          return {}
        }

        // リトライ前に短い待機とヘルパー再起動
        const waitTime = 500 * retryCount
        console.log(`Retrying icons.json load, triggering helper restart (attempt ${retryCount})`)
        scheduleHelperRestart(waitTime)

        const start = Date.now()
        while (Date.now() - start < waitTime + 1000) {
          // リトライ前により長い待機時間を設定
        }
      }
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
