//
//  main.swift
//  taskbar.helper
//

import AppKit
import ScreenCaptureKit
import Foundation
import ApplicationServices
import Cocoa
import CoreGraphics

var debug = false
var verboseLogging = ProcessInfo.processInfo.environment["TASKBAR_VERBOSE"] != nil

// MARK: - Debug Logging & Watchdog

// 処理の直前にログを出力（ハング時の最後のログで場所を特定）
func logBefore(_ operation: String, function: String = #function, line: Int = #line) {
    guard verboseLogging else { return }
    let timestamp = ISO8601DateFormatter().string(from: Date())
    let threadId = pthread_mach_thread_np(pthread_self())
    let message = "[\(timestamp)] [T:\(threadId)] >>> ENTERING: \(operation) at \(function):\(line)\n"
    FileHandle.standardError.write(message.data(using: .utf8)!)
}

// ウォッチドッグタイマー：指定時間内に完了しない場合に警告
class WatchdogTimer {
    private var timer: DispatchSourceTimer?
    private let queue = DispatchQueue(label: "watchdog-timer")
    private let operation: String

    init(operation: String, timeout: TimeInterval) {
        self.operation = operation

        timer = DispatchSource.makeTimerSource(queue: queue)
        timer?.schedule(deadline: .now() + timeout)
        timer?.setEventHandler { [weak self] in
            guard let self = self else { return }
            let message = "⚠️⚠️⚠️ WATCHDOG TIMEOUT: \(self.operation) exceeded \(timeout)s - possible hang!\n"
            FileHandle.standardError.write(message.data(using: .utf8)!)

            // スレッドダンプを取得
            self.dumpAllThreads()
        }
        timer?.resume()
    }

    func cancel() {
        timer?.cancel()
        timer = nil
    }

    private func dumpAllThreads() {
        let message = "=== Thread Dump for hung operation: \(operation) ===\n"
        FileHandle.standardError.write(message.data(using: .utf8)!)

        // 主要スレッドの状態を出力
        Thread.callStackSymbols.forEach { symbol in
            FileHandle.standardError.write("  \(symbol)\n".data(using: .utf8)!)
        }
        FileHandle.standardError.write("=== End Thread Dump ===\n".data(using: .utf8)!)
    }

    deinit {
        cancel()
    }
}

// データ型についての extention
extension NSBitmapImageRep {
    func png() -> Data? {
        return representation(using: .png, properties: [:])
    }
}

extension Data {
    var bitmap: NSBitmapImageRep? {
        return NSBitmapImageRep(data: self)
    }
}

extension NSImage {
    func png() -> Data? {
        return tiffRepresentation?.bitmap?.png()
    }

    func resized(to size: Int) -> NSImage {
        let newSize = CGSize(width: size, height: size)
        let image = NSImage(size: newSize)
        
        image.lockFocus()
        NSGraphicsContext.current?.imageInterpolation = .high
        
        draw(
            in: CGRect(origin: .zero, size: newSize),
            from: .zero,
            operation: .copy,
            fraction: 1
        )
        
        image.unlockFocus()
        return image
    }
}

// MARK: - Filter Management

// フィルター設定の構造体
struct FilterRule: Codable {
    let property: String
    let isValue: FilterValue

    enum CodingKeys: String, CodingKey {
        case property
        case isValue = "is"
    }
}

enum FilterValue: Codable {
    case string(String)
    case int(Int)
    case bool(Bool)

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let stringValue = try? container.decode(String.self) {
            self = .string(stringValue)
        } else if let intValue = try? container.decode(Int.self) {
            self = .int(intValue)
        } else if let boolValue = try? container.decode(Bool.self) {
            self = .bool(boolValue)
        } else {
            throw DecodingError.dataCorrupted(DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "FilterValue type not supported"))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value):
            try container.encode(value)
        case .int(let value):
            try container.encode(value)
        case .bool(let value):
            try container.encode(value)
        }
    }
}

struct LabeledFilter: Codable {
    let label: String
    let filters: [FilterRule]
}

struct ConfigFile: Codable {
    let labeledFilters: [LabeledFilter]
}

// フィルター監視とキャッシュ管理
class FilterManager {
    static let shared = FilterManager()
    private var cachedFilters: [LabeledFilter] = []
    private var fileMonitor: DispatchSourceFileSystemObject?
    private var lastModificationTime: Date?
    private let filtersJsonPath: URL?

    private init() {
        // Application Support/taskbar.fm/config.json のパスを構築
        guard let appSupportDir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            // print("Warning: Could not access Application Support directory, using default filters")
            filtersJsonPath = nil
            cachedFilters = getDefaultFilters()
            return
        }

        let taskbarDir = appSupportDir.appendingPathComponent("taskbar.fm")
        filtersJsonPath = taskbarDir.appendingPathComponent("filter.json")

        // print("Filter config path: \(filtersJsonPath?.path ?? "none")")
        cachedFilters = loadFiltersFromFile()
        startFileMonitoring()
    }

    deinit {
        stopFileMonitoring()
    }

    func getFilters() -> [LabeledFilter] {
        return cachedFilters
    }

    private func loadFiltersFromFile() -> [LabeledFilter] {
        guard let filtersJsonPath = filtersJsonPath else {
            return getDefaultFilters()
        }

        guard FileManager.default.fileExists(atPath: filtersJsonPath.path) else {
            // print("Warning: config.json not found, using default filters")
            return getDefaultFilters()
        }

        do {
            // ⚠️ UE RISK (LOW-MEDIUM): FileManager.attributesOfItem
            // 🔍 調査結果:
            //    - ネットワークファイルシステム（NFS, SMB等）でブロックする可能性
            //    - ディスクI/O障害時にカーネルレベルでブロック
            // 🧪 UEを起こす可能性のある操作:
            //    1. filter.jsonをネットワークドライブに配置してファイル監視を開始
            //    2. ディスクが故障している状態でfilter.jsonの属性を取得
            // 💡 推奨対策:
            //    - ローカルファイルシステム限定で使用（Application Supportは通常ローカル）
            //    - エラー時はデフォルト値を返す（既に実装済み）
            let attributes = try FileManager.default.attributesOfItem(atPath: filtersJsonPath.path)
            let modificationTime = attributes[.modificationDate] as? Date

            // ファイルが変更されていない場合はキャッシュを返す
            if let lastTime = lastModificationTime, let currentTime = modificationTime, lastTime >= currentTime {
                return cachedFilters
            }

            // ⚠️ UE RISK (LOW-MEDIUM): Data(contentsOf:)
            // 🔍 調査結果:
            //    - 同期的ファイル読み込み、大きなファイルでブロックする可能性
            //    - ネットワークファイルシステムやディスクI/O障害時に危険
            // 🧪 UEを起こす可能性のある操作:
            //    1. filter.jsonをネットワークドライブ（NFS/SMB）に配置して読み込み
            //    2. ディスクが故障している状態（I/Oエラー頻発）でfilter.jsonを読み込み
            //    3. filter.jsonを巨大なファイル（数MB以上）にして読み込み
            //    4. 他プロセスがfilter.jsonをロックしている状態で読み込み
            // 💡 推奨対策:
            //    - Application Supportのファイルは通常小さいので許容範囲
            //    - エラーハンドリング済み（デフォルト値を返す）
            let data = try Data(contentsOf: filtersJsonPath)
            let configFile = try JSONDecoder().decode(ConfigFile.self, from: data)
            let filters = configFile.labeledFilters

            lastModificationTime = modificationTime
            // print("Loaded \(filters.count) filter groups from \(filtersJsonPath.path)")

            return filters
        } catch {
            // print("Error loading filters: \(error), using default filters")
            return getDefaultFilters()
        }
    }

    private func startFileMonitoring() {
        guard let filtersJsonPath = filtersJsonPath else { return }

        // ⚠️ UE RISK (LOW): open() system call
        // 🔍 調査結果:
        //    - ファイルを読み取り専用（O_EVTONLY）で開くだけなので通常は問題なし
        //    - ネットワークファイルシステムでは稀にブロックする可能性
        // 🧪 UEを起こす可能性のある操作:
        //    1. filter.jsonをネットワークドライブ（NFS/SMB）に配置してファイル監視を開始
        //    2. ディスクI/O障害がある状態でファイル監視を開始
        // 💡 推奨対策:
        //    - Application Supportは通常ローカルなので許容範囲
        //    - エラーハンドリング済み（失敗時は監視なしで続行）
        let fileDescriptor = open(filtersJsonPath.path, O_EVTONLY)
        guard fileDescriptor >= 0 else {
            // print("Warning: Could not open config.json for monitoring")
            return
        }

        fileMonitor = DispatchSource.makeFileSystemObjectSource(
            fileDescriptor: fileDescriptor,
            eventMask: .write,
            queue: DispatchQueue.global(qos: .utility)
        )

        fileMonitor?.setEventHandler { [weak self] in
            DispatchQueue.main.async {
                self?.reloadFilters()
            }
        }

        fileMonitor?.setCancelHandler {
            close(fileDescriptor)
        }

        fileMonitor?.resume()
        // print("Started monitoring config.json for changes")
    }

    private func stopFileMonitoring() {
        fileMonitor?.cancel()
        fileMonitor = nil
    }

    private func reloadFilters() {
        let newFilters = loadFiltersFromFile()
        if !filtersEqual(cachedFilters, newFilters) {
            cachedFilters = newFilters
            // print("Filter settings updated: \(cachedFilters.count) filter groups loaded")

            // フィルター変更時にウィンドウリストを更新
            NotificationCenter.default.post(name: NSNotification.Name("FiltersChanged"), object: nil)
        }
    }

    private func filtersEqual(_ lhs: [LabeledFilter], _ rhs: [LabeledFilter]) -> Bool {
        guard lhs.count == rhs.count else { return false }

        for (index, leftFilter) in lhs.enumerated() {
            let rightFilter = rhs[index]
            if leftFilter.label != rightFilter.label || leftFilter.filters.count != rightFilter.filters.count {
                return false
            }
        }
        return true
    }
}

// フィルター設定をロードする関数（後方互換性のため）
func loadFilterSettings() -> [LabeledFilter] {
    return FilterManager.shared.getFilters()
}

// デフォルトフィルター（store.tsのデフォルト値に基づく）
func getDefaultFilters() -> [LabeledFilter] {
    return [
        LabeledFilter(label: "オフスクリーンウィンドウを除外", filters: [
            FilterRule(property: "kCGWindowIsOnscreen", isValue: .bool(false))
        ]),
        LabeledFilter(label: "名無しを除外", filters: [
            FilterRule(property: "kCGWindowName", isValue: .string(""))
        ]),
        LabeledFilter(label: "Dockを除外", filters: [
            FilterRule(property: "kCGWindowOwnerName", isValue: .string("Dock"))
        ]),
        LabeledFilter(label: "DockHelperを除外", filters: [
            FilterRule(property: "kCGWindowOwnerName", isValue: .string("DockHelper"))
        ]),
        LabeledFilter(label: "スクリーンキャプチャを除外", filters: [
            FilterRule(property: "kCGWindowOwnerName", isValue: .string("screencapture"))
        ]),
        LabeledFilter(label: "スクリーンショットアプリを除外", filters: [
            FilterRule(property: "kCGWindowOwnerName", isValue: .string("スクリーンショット"))
        ]),
        LabeledFilter(label: "通知センターを除外", filters: [
            FilterRule(property: "kCGWindowName", isValue: .string("Notification Center"))
        ]),
        LabeledFilter(label: "通知センター（日本語）を除外", filters: [
            FilterRule(property: "kCGWindowOwnerName", isValue: .string("通知センター"))
        ]),
        LabeledFilter(label: "Item-0を除外", filters: [
            FilterRule(property: "kCGWindowName", isValue: .string("Item-0"))
        ]),
        LabeledFilter(label: "Window Serverを除外", filters: [
            FilterRule(property: "kCGWindowOwnerName", isValue: .string("Window Server"))
        ]),
        LabeledFilter(label: "コントロールセンターを除外", filters: [
            FilterRule(property: "kCGWindowOwnerName", isValue: .string("コントロールセンター"))
        ]),
        LabeledFilter(label: "Spotlightを除外", filters: [
            FilterRule(property: "kCGWindowOwnerName", isValue: .string("Spotlight"))
        ]),
        LabeledFilter(label: "Google日本語入力を除外", filters: [
            FilterRule(property: "kCGWindowOwnerName", isValue: .string("GoogleJapaneseInputRenderer"))
        ]),
        LabeledFilter(label: "Taskbar.fmアプリを除外", filters: [
            FilterRule(property: "kCGWindowOwnerName", isValue: .string("taskbar.fm"))
        ]),
        LabeledFilter(label: "Taskbar.fmウィンドウを除外", filters: [
            FilterRule(property: "kCGWindowName", isValue: .string("taskbar.fm"))
        ]),
        LabeledFilter(label: "空のFinderウィンドウを除外", filters: [
            FilterRule(property: "kCGWindowOwnerName", isValue: .string("Finder")),
            FilterRule(property: "kCGWindowName", isValue: .string(""))
        ])
    ]
}

// ウィンドウをフィルタリングする関数（helper.tsのfilterProcesses関数に対応）
func filterWindows(_ windows: [[String: AnyObject]]) -> [[String: AnyObject]] {
    let labeledFilters = loadFilterSettings()

    return windows.compactMap { window -> [String: AnyObject]? in
        // サイズフィルター（従来通り）
        if let bounds = window["kCGWindowBounds"] as? [String: AnyObject] {
            if let height = bounds["Height"] as? NSNumber, height.intValue < 40 {
                return nil
            }
            if let width = bounds["Width"] as? NSNumber, width.intValue < 40 {
                return nil
            }
        }

// NEXT PLAN:
// 設定画面でフィルタを追加しても config.tsに書き込んでしまうので、 filter.jsonに書き込むようにする
// ウィンドウ除外用のAPIが動作しているか確認
// ウィンドウ一覧画面では 動作中と除外中のウィンドウを取得できるように
// 権限のウィンドウがちょろちょろでるの辞める
// アプリ再起動ボタンほしいかも


        // ラベル付きフィルターの処理
        for labeledFilter in labeledFilters {
            var matches: [Bool] = []

            for filterRule in labeledFilter.filters {
                // 特別処理：kCGWindowNameが空文字列または存在しない場合
                if filterRule.property == "kCGWindowName" {
                    if case .string(let filterString) = filterRule.isValue, filterString.isEmpty {
                        let windowName = window["kCGWindowName"] as? String ?? ""
                        if windowName.isEmpty {
                            matches.append(true)
                            continue
                        }
                    }
                }

                // ウィンドウのプロパティが存在しない場合はスキップ
                guard let windowValue = window[filterRule.property] else {
                    matches.append(false)
                    continue
                }

                // 値が一致するかチェック
                let isMatch: Bool
                switch filterRule.isValue {
                case .string(let filterString):
                    isMatch = (windowValue as? String) == filterString
                case .int(let filterInt):
                    isMatch = (windowValue as? NSNumber)?.intValue == filterInt
                case .bool(let filterBool):
                    isMatch = (windowValue as? NSNumber)?.boolValue == filterBool
                }

                matches.append(isMatch)
            }

            // すべての条件が一致した場合はフィルタリング対象（除外）
            if !matches.isEmpty && matches.allSatisfy({ $0 }) {
                return nil
            }
        }

        return window
    }
}

// MARK: - Icon Management

// アイコンキャッシュ（プロセス毎にキャッシュしてパフォーマンス向上）
var iconCache: [Int: String] = [:]
var iconCacheLock = NSLock()

func getIconBase64(pid: Int, owner: String, windowName: String, size: Int) -> String? {
    // キャッシュから取得を試行
    iconCacheLock.lock()
    if let cachedIcon = iconCache[pid] {
        iconCacheLock.unlock()
        return cachedIcon
    }
    iconCacheLock.unlock()

    // ⚠️ UE RISK (MEDIUM): NSRunningApplication.icon
    // 🔍 調査結果:
    //    - プロセスがゾンビ状態、異常終了中、権限問題がある場合にブロックする可能性
    //    - AppKitの内部でプロセス情報取得時にカーネル呼び出しが発生
    // ✅ 対策済み:
    //    - バックグラウンドキューで実行
    //    - 50msのタイムアウト設定済み（セマフォ）
    // ⚠️ 注意: セマフォはUE状態では機能しない可能性あり
    // 🧪 UEを起こす可能性のある操作:
    //    1. アプリを強制終了（kill -9）直後にwatchモードでアイコンを取得
    //    2. アプリがクラッシュ中（ゾンビ状態）にwatchモードでアイコンを取得
    //    3. サンドボックス化されたアプリ（権限制限あり）のアイコンを取得
    //    4. システムプロセス（WindowServer等）のアイコンを取得しようとする
    //    5. 大量のアプリを同時起動してwatchモードで全アイコンを一斉取得
    // 💡 追加推奨対策:
    //    - 別プロセスでアイコン取得を行う
    //    - エラー時は空のアイコンを返してクラッシュを防ぐ
    // タイムアウト付きでアイコン取得
    let semaphore = DispatchSemaphore(value: 0)
    var result: String?

    DispatchQueue.global(qos: .utility).async {
        defer { semaphore.signal() }

        guard let runningApp = NSRunningApplication(processIdentifier: pid_t(pid)),
              let iconImage = runningApp.icon?.resized(to: size),
              let iconData = iconImage.png() else {
            return
        }
        result = iconData.base64EncodedString()
    }

    // 50ms以内にアイコンが取得できない場合はタイムアウト
    if semaphore.wait(timeout: .now() + 0.05) == .timedOut {
        return nil
    }
    
    // キャッシュに保存
    if let iconResult = result {
        iconCacheLock.lock()
        iconCache[pid] = iconResult
        iconCacheLock.unlock()
    }
    
    return result
}

func stringify(data: Data) -> String {
    return "data:image/png;base64,\(data.base64EncodedString())"
}

// MARK: - Permission Management

// 権限チェック関数
func checkAccessibilityPermission() -> Bool {
    return AXIsProcessTrusted()
}

func checkScreenRecordingPermission() -> Bool {
    logBefore("checkScreenRecordingPermission")
    let watchdog = WatchdogTimer(operation: "checkScreenRecordingPermission", timeout: 2.0)
    defer { watchdog.cancel() }

    // ⚠️ UE RISK (HIGH): SCShareableContent API
    // 🔍 調査結果:
    //    - スクリーンレコーディング権限ダイアログが表示中の場合、カーネルレベルでブロックする
    //    - 権限が拒否されている状態でも、システムの状態によってはUE状態になる可能性あり
    //    - ウォッチドッグタイマーやセマフォはUE状態では機能しない（カーネルがブロックしているため）
    // 🧪 UEを起こす可能性のある操作:
    //    1. システム設定でスクリーンレコーディング権限を削除 → check-permissionsコマンド実行
    //    2. 権限ダイアログが表示されている最中に check-permissions を実行
    //    3. アプリ起動直後、権限状態が不安定な状態で check-permissions を連続実行
    //    4. 他のアプリが同時にスクリーンレコーディング権限を要求している状態で実行
    // 🔬 実験結果（2025-12-29）:
    //    ❌ 権限削除 → check-permissions実行: UEにならず（エラーメッセージを返して正常終了）
    //    ❌ 権限ダイアログ表示中に10個のcheck-permissionsを並列実行: UEにならず（全て正常終了）
    //    → 結論: SCShareableContent APIは権限エラー時も適切にエラーを返すため、UEにはなりにくい
    // 💡 推奨対策:
    //    1. 軽量な権限チェック方法に変更（CGWindowListCopyWindowInfoで判定）
    //    2. 権限チェック結果をキャッシュして頻繁な呼び出しを避ける
    //    3. 別プロセスで実行してタイムアウト後にkill
    // 画面録画権限をチェックするため、SCShareableContentを使用
    let semaphore = DispatchSemaphore(value: 0)
    var hasPermission = false
    var callbackCalled = false

    if #available(macOS 12.3, *) {
        logBefore("SCShareableContent.getExcludingDesktopWindows")

        SCShareableContent.getExcludingDesktopWindows(false, onScreenWindowsOnly: true) { content, error in
            callbackCalled = true
            hasPermission = (error == nil)

            if verboseLogging {
                let status = error == nil ? "success" : "error: \(error!.localizedDescription)"
                let message = "SCShareableContent callback: \(status)\n"
                FileHandle.standardError.write(message.data(using: .utf8)!)
            }

            semaphore.signal()
        }

        // タイムアウト設定（100ms）
        if semaphore.wait(timeout: .now() + 0.1) == .timedOut {
            if verboseLogging {
                let message = "⚠️ SCShareableContent callback NOT called (timeout)\n"
                FileHandle.standardError.write(message.data(using: .utf8)!)
            }
            return false
        }
    } else {
        // macOS 12.3未満の場合は簡易的な権限チェック
        // 実際にはSCShareableContentが利用できない古いバージョンでは
        // 完全な権限チェックは困難なため、基本的にtrueを返す
        hasPermission = true
    }

    return hasPermission
}

// 権限状態をJSONで返す関数
func getPermissionStatus() -> Data? {
    let accessibilityPermission = checkAccessibilityPermission()
    let screenRecordingPermission = checkScreenRecordingPermission()
    
    let permissionStatus: [String: Any] = [
        "command": "check-permissions",
        "accessibility": accessibilityPermission,
        "screenRecording": screenRecordingPermission,
        "timestamp": ISO8601DateFormatter().string(from: Date())
    ]
    
    do {
        let jsonData = try JSONSerialization.data(withJSONObject: permissionStatus, options: [])
        return jsonData
    } catch {
        print("Error serializing permission status: \(error)")
        return nil
    }
}

// MARK: - Progressive Icon Loading

class ProgressiveIconLoader {
    private var pendingUpdates: [String: String] = [:]
    private let updateLock = NSLock()
    private var updateTimer: Timer?
    
    func loadIconsProgressively(for windowList: [[String: AnyObject]], uniquePids: Set<Int>, pidToOwner: [Int: String]) {
        // 1. 即座にアイコンなしでウィンドウリストを送信
        let initialData = createWindowListJSON(windowList, icons: [:])
        sendToStdout(initialData)
        
        // 2. アイコン更新タイマーを開始（100ms間隔）
        startUpdateTimer()
        
        // 3. 並列でアイコンを取得
        let iconQueue = DispatchQueue(label: "icon-processing", qos: .utility, attributes: .concurrent)
        let iconGroup = DispatchGroup()
        
        for pid in uniquePids {
            guard let owner = pidToOwner[pid] else { continue }
            
            iconGroup.enter()
            iconQueue.async {
                defer { iconGroup.leave() }
                
                if let iconBase64 = getIconBase64(pid: pid, owner: owner, windowName: "", size: 32) {
                    self.queueIconUpdate(owner: owner, icon: iconBase64)
                }
            }
        }
        
        // 4. 全アイコン取得完了後にタイマー停止
        iconGroup.notify(queue: .main) {
            self.stopUpdateTimer()
            self.flushPendingUpdates() // 最終更新
        }
    }
    
    private func queueIconUpdate(owner: String, icon: String) {
        updateLock.lock()
        let safeOwner = owner.replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: " ", with: "")
        pendingUpdates[safeOwner] = icon
        updateLock.unlock()
    }
    
    private func startUpdateTimer() {
        updateTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
            self.flushPendingUpdates()
        }
    }
    
    private func stopUpdateTimer() {
        updateTimer?.invalidate()
        updateTimer = nil
    }
    
    private func flushPendingUpdates() {
        updateLock.lock()
        guard !pendingUpdates.isEmpty else {
            updateLock.unlock()
            return
        }
        
        let updates = pendingUpdates
        pendingUpdates.removeAll()
        updateLock.unlock()
        
        // アイコン更新通知を送信
        let iconUpdateNotification: [String: Any] = [
            "type": "iconUpdate",
            "icons": updates,
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ]
        
        if let jsonData = try? JSONSerialization.data(withJSONObject: iconUpdateNotification, options: []) {
            sendToStdout(jsonData)
        }
        
        // アイコンキャッシュファイルも更新
        saveIconsToCache(updates)
    }
    
    private func createWindowListJSON(_ windowList: [[String: AnyObject]], icons: [String: String]) -> Data? {
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: windowList, options: [])
            return jsonData
        } catch {
            print("Error serializing window list JSON: \(error)")
            return nil
        }
    }
    
    private func sendToStdout(_ data: Data?) {
        guard let data = data else { return }

        logBefore("FileHandle.standardOutput.write (\(data.count) bytes)")
        let watchdog = WatchdogTimer(operation: "stdout.write", timeout: 3.0)
        defer { watchdog.cancel() }

        // ⚠️ UE RISK (HIGH): FileHandle.standardOutput.write
        // 🔍 調査結果:
        //    - stdoutパイプバッファがフル（親プロセスが読み取っていない）場合、カーネルレベルでブロック
        //    - 大量データ（アイコンデータなど）送信時に特に危険
        //    - パイプのデフォルトバッファサイズは通常64KB、それを超えるとブロック
        //    - ウォッチドッグタイマーはUE状態では機能しない
        // 🧪 UEを起こす可能性のある操作:
        //    1. 親プロセス（Electron）がstdoutを読み取っていない状態でwatchモードを開始
        //    2. 親プロセスがクラッシュ/フリーズした状態でTaskbarHelperが送信を続ける
        //    3. 大量のウィンドウ（100個以上）を開いた状態でlist/debugコマンドを実行
        //    4. アイコン更新が高頻度（100ms間隔）で発生する状態でwatchモードを長時間実行
        //    5. パイプバッファを故意にフルにする（親プロセス側でsleep挿入など）
        // 💡 推奨対策:
        //    1. 非ブロッキングI/O（O_NONBLOCK）に設定してEAGAINをハンドリング
        //    2. データを分割して送信（チャンク送信）
        //    3. タイムアウト付きwrite実装（POSIXのselectまたはpoll使用）
        let stdOut = FileHandle.standardOutput
        stdOut.write(data)
        stdOut.write("\n".data(using: .utf8)!)

        if verboseLogging {
            let message = "Successfully wrote \(data.count) bytes to stdout\n"
            FileHandle.standardError.write(message.data(using: .utf8)!)
        }
    }
    
    private func saveIconsToCache(_ icons: [String: String]) {
        let fileManager = FileManager.default
        let userDataDir = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!.appendingPathComponent("taskbar.fm")

        if !fileManager.fileExists(atPath: userDataDir.path) {
            try? fileManager.createDirectory(at: userDataDir, withIntermediateDirectories: true, attributes: nil)
        }

        // 既存のアイコンキャッシュを読み込んで更新
        let iconJsonPath = userDataDir.appendingPathComponent("icons.json")
        var existingIcons: [String: String] = [:]

        if fileManager.fileExists(atPath: iconJsonPath.path) {
            if let existingData = try? Data(contentsOf: iconJsonPath),
               let existing = try? JSONSerialization.jsonObject(with: existingData) as? [String: String] {
                existingIcons = existing
            }
        }

        // 新しいアイコンをマージ
        existingIcons.merge(icons) { _, new in new }

        // ⚠️ UE RISK (LOW-MEDIUM): Data.write(to:options:)
        // 🔍 調査結果:
        //    - .atomicオプションは一時ファイル作成→rename操作が必要
        //    - ディスク容量不足、I/O障害、ファイルロック競合でブロックする可能性
        //    - ネットワークファイルシステムでは特に危険
        // 🧪 UEを起こす可能性のある操作:
        //    1. ディスク容量を完全に使い切った状態でwatchモードを実行（icons.json書き込み失敗）
        //    2. icons.jsonをネットワークドライブに配置してwatchモードを実行
        //    3. 他プロセスがicons.jsonをロックしている状態でwatchモードを実行
        //    4. アイコン更新が高頻度（100ms間隔）で発生して書き込みが競合
        // 💡 推奨対策:
        //    - try?でエラーを無視している（既に実装済み）
        //    - アイコンキャッシュは失われても再取得可能なので許容範囲
        //    - バックグラウンドキューで実行することを検討
        // JSONとして保存（アトミックに書き込みしないと書き出したjsonファイルが破損することがある）
        // 書き出しが重複すると片方は失われるが許容する
        if let iconJsonData = try? JSONSerialization.data(withJSONObject: existingIcons, options: []) {
            try? iconJsonData.write(to: iconJsonPath, options: .atomic)
        }
    }
}

// MARK: - Window Information

// エラー出力用
var standardError = FileHandle.standardError

// グローバルなウィンドウリストプロバイダー（テスト用に差し替え可能）
var windowListProvider: () -> [[String: AnyObject]] = {
    logBefore("CGWindowListCopyWindowInfo")
    let watchdog = WatchdogTimer(operation: "CGWindowListCopyWindowInfo", timeout: 5.0)
    defer { watchdog.cancel() }

    // ⚠️ UE RISK (CRITICAL): CGWindowListCopyWindowInfo
    // 🔍 調査結果:
    //    - WindowServerとの同期通信が必要で、WindowServerが過負荷の場合にカーネルレベルでブロック
    //    - 権限問題（スクリーンレコーディング権限など）がある場合もUE状態になる可能性あり
    //    - ウォッチドッグタイマーはUE状態では機能しない
    //    - 一度UE状態になると、以降の全てのTaskbarHelper実行もUE状態になる（カスケード効果）
    // 🧪 UEを起こす可能性のある操作:
    //    1. 大量のウィンドウ（50個以上）を開いた状態でlist/debug/watchコマンドを実行
    //    2. 画面共有中・画面録画中にlist/debug/watchコマンドを実行
    //    3. Mission Control（F3）を表示中にlist/debug/watchコマンドを実行
    //    4. 複数ディスプレイの接続/切断直後にlist/debug/watchコマンドを実行
    //    5. システムが高負荷（CPU 90%以上）の状態でlist/debug/watchコマンドを連続実行
    //    6. スクリーンセーバーから復帰直後にlist/debug/watchコマンドを実行
    //    7. 複数のTaskbarHelperプロセスを並列実行（5個以上同時に起動）
    // 🔬 実験結果（2025-12-29）:
    //    ❌ 10個のlistコマンドを並列実行（100個のウィンドウ存在時）: UEにならず（全て正常終了）
    //    ❌ 20個のlistコマンドを並列実行（100個のウィンドウ存在時）: UEにならず（全て正常終了）
    //    ❌ Mission Control表示中に10個のlistコマンドを並列実行（122個のウィンドウ検出）: UEにならず（全て正常終了）
    //    → 結論: 通常の負荷（並列20個、100+ウィンドウ）ではUEにならない。より極端な条件が必要
    // 💡 推奨対策:
    //    1. 別プロセスで実行してタイムアウト後にSIGKILL（最も効果的）
    //    2. XPCサービスとして分離して実行
    //    3. エラー発生時のフォールバック処理を実装
    let result = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as! [[String: AnyObject]]

    if verboseLogging {
        let message = "CGWindowListCopyWindowInfo returned \(result.count) windows\n"
        FileHandle.standardError.write(message.data(using: .utf8)!)
    }

    return result
}

// ウィンドウ情報の一覧を取得してJSONデータとして返す関数
func getWindowInfoListData() -> Data? {
    let windowsListInfo = windowListProvider()

    // フィルタリングを適用
    let filteredWindows = filterWindows(windowsListInfo)

    // 重複するPIDを削除してアイコン取得を効率化
    var uniquePids = Set<Int>()
    var pidToOwner: [Int: String] = [:]

    for windowInfo in filteredWindows {
        // PIDとOwnerの情報を収集（重複削除のため）
        if let pid = windowInfo["kCGWindowOwnerPID"] as? Int,
           let owner = windowInfo["kCGWindowOwnerName"] as? String,
           !owner.isEmpty {
            uniquePids.insert(pid)
            pidToOwner[pid] = owner
        }
    }
    
    // ProgressiveIconLoaderを使用してアイコンを順次取得・送信
    let iconLoader = ProgressiveIconLoader()
    iconLoader.loadIconsProgressively(for: filteredWindows, uniquePids: uniquePids, pidToOwner: pidToOwner)
    
    // この関数は最初のウィンドウリスト（アイコンなし）を返すだけ
    // アイコンは後で順次更新される
    return nil // ProgressiveIconLoaderが直接stdout に送信するため、ここではnilを返す
}

// MARK: - Window Observer

class WindowObserver {
    static let shared = WindowObserver()
    private init() {}

    // ウィンドウの変更を監視
    func observeWindowChanges() {
        let notificationCenter = NSWorkspace.shared.notificationCenter

        // アクティブになるイベントの監視
        notificationCenter.addObserver(
            self,
            selector: #selector(windowDidChange(notification:)),
            name: NSWorkspace.didActivateApplicationNotification,
            object: nil
        )

        // アプリケーションが起動されたイベントを監視
        notificationCenter.addObserver(
            self,
            selector: #selector(windowDidChange(notification:)),
            name: NSWorkspace.didLaunchApplicationNotification,
            object: nil
        )

        // アプリケーションが終了されたイベントを監視
        notificationCenter.addObserver(
            self,
            selector: #selector(windowDidChange(notification:)),
            name: NSWorkspace.didTerminateApplicationNotification,
            object: nil
        )

        // フィルター変更の監視
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(filtersDidChange(notification:)),
            name: NSNotification.Name("FiltersChanged"),
            object: nil
        )
    }

    @objc func windowDidChange(notification: NSNotification) {
        logBefore("windowDidChange - \(notification.name.rawValue)")

        // アクティビティを記録
        ProcessManager.shared.recordActivity()

        // 非同期処理を開始（タイムアウト付き）
        DispatchQueue.global(qos: .background).async {
            // わずかに遅延させて非同期処理を実行
            // これがないと開いたウィンドウの変更が反映されない
            let delayTime = DispatchTime.now() + .milliseconds(500)

            DispatchQueue.global(qos: .background).asyncAfter(deadline: delayTime) {
                logBefore("windowDidChange delayed execution")
                let watchdog = WatchdogTimer(operation: "windowDidChange.getWindowInfo", timeout: 10.0)

                // getWindowInfoListDataは内部でProgressiveIconLoaderを使用して
                // 自動的にstdoutに送信する
                _ = getWindowInfoListData()
                ProcessManager.shared.recordActivity()

                watchdog.cancel()

                if verboseLogging {
                    let message = "windowDidChange completed successfully\n"
                    FileHandle.standardError.write(message.data(using: .utf8)!)
                }
            }
        }
    }

    @objc func filtersDidChange(notification: NSNotification) {
        logBefore("filtersDidChange")
        print("Filter settings changed, updating window list...")

        // フィルター変更時は即座にウィンドウ情報を更新
        DispatchQueue.global(qos: .utility).async {
            let watchdog = WatchdogTimer(operation: "filtersDidChange.getWindowInfo", timeout: 10.0)
            _ = getWindowInfoListData()
            ProcessManager.shared.recordActivity()
            watchdog.cancel()

            if verboseLogging {
                let message = "filtersDidChange completed successfully\n"
                FileHandle.standardError.write(message.data(using: .utf8)!)
            }
        }
    }
}

// MARK: - Process Management

class ProcessManager {
    static let shared = ProcessManager()
    private var startTime = Date()
    var maxRuntime: TimeInterval = 300 // 5分の最大実行時間
    private var heartbeatTimer: Timer?
    private var lastActivity = Date()
    private var isRunning = false
    private init() {}
    
    func startHeartbeat() {
        isRunning = true
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            self.checkHealth()
        }
    }
    
    func stopHeartbeat() {
        isRunning = false
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
    }
    
    var shouldKeepRunning: Bool {
        return isRunning
    }
    
    func recordActivity() {
        lastActivity = Date()
    }
    
    private func checkHealth() {
        let currentTime = Date()
        let runtime = currentTime.timeIntervalSince(startTime)
        
        // 最大実行時間を超過した場合
        if runtime > maxRuntime {
            print("Maximum runtime exceeded, shutting down gracefully...")
            self.gracefulShutdown(reason: "max_runtime")
        }
        
        // アイドルタイムアウト処理は削除
        // タスクバーは継続して動作する必要があるため
    }
    
    func gracefulShutdown(reason: String) {
        print("Graceful shutdown initiated: \(reason)")
        
        // クリーンアップ処理
        stopHeartbeat()
        iconCache.removeAll()
        
        // 0.1秒後に終了（NSNotificationCenterのクリーンアップ時間を確保）
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            exit(0)
        }
    }
}

// MARK: - Signal Handling

func setupSignalHandlers() {
    // SIGTERM ハンドラ
    signal(SIGTERM) { _ in
        print("Received SIGTERM, shutting down gracefully...")
        ProcessManager.shared.gracefulShutdown(reason: "sigterm")
    }
    
    // SIGINT ハンドラ (Ctrl+C)
    signal(SIGINT) { _ in
        print("Received SIGINT, shutting down gracefully...")
        ProcessManager.shared.gracefulShutdown(reason: "sigint")
    }
    
    // SIGKILL は捕捉できないが、SIGUSR1 で緊急停止
    signal(SIGUSR1) { _ in
        print("Emergency stop requested")
        exit(1)
    }
}

// MARK: - Main Entry Point

let arguments = CommandLine.arguments
guard arguments.count > 1 else {
    print("使用方法:")
    print("  grant         - スクリーンキャプチャのアクセス権限を要求")
    print("  debug         - 現在のウィンドウ情報をデバッグ出力")
    print("  list          - フィルター済みウィンドウ一覧をワンショット出力")
    print("  exclude       - 除外されたウィンドウ一覧をワンショット出力")
    print("  watch         - ウィンドウ変更を監視してリアルタイム出力")
    print("  check-permissions - 権限状態をJSON形式で出力")
    print("  get-config    - 設定ファイル(config.json)の内容を出力")
    exit(1)
}

// 第1引数の値によって処理を分岐
let option = arguments[1]
switch option {
case "grant":
    // スクリーンキャプチャのアクセス要求
    CGRequestScreenCaptureAccess()
    print("スクリーンキャプチャのアクセス権限を要求しました")
    
case "debug":
    // デバッグ用：現在のウィンドウ情報を出力
    let windowsListInfo = windowListProvider()
    do {
        let jsonData = try JSONSerialization.data(withJSONObject: windowsListInfo, options: [])
        // ⚠️ UE RISK (HIGH): stdout.write without timeout/non-blocking
        // 🔍 調査結果: ProgressiveIconLoader.sendToStdout()と同じリスク
        // 🧪 UEを起こす可能性のある操作: sendToStdout()と同じ（main.swift:686-691参照）
        // 💡 推奨対策: 非ブロッキングI/Oまたはタイムアウト付きwrite関数を使用
        let stdOut = FileHandle.standardOutput
        stdOut.write(jsonData)
        stdOut.write("\n".data(using: .utf8)!)
        // 確実にバッファを flush してデータが即座に送信されるようにする
        if #available(macOS 10.15, *) {
            try? stdOut.synchronize()
        }
    } catch {
        print("JSON serialization failed: \(error)")
    }
    
case "list":
    // ワンショットでフィルター済みウィンドウ一覧を出力
    let windowsListInfo = windowListProvider()
    let filteredWindows = filterWindows(windowsListInfo)

    do {
        let jsonData = try JSONSerialization.data(withJSONObject: filteredWindows, options: [])
        // ⚠️ UE RISK (HIGH): stdout.write without timeout/non-blocking
        // 🔍 調査結果: ProgressiveIconLoader.sendToStdout()と同じリスク
        // 🧪 UEを起こす可能性のある操作: sendToStdout()と同じ（main.swift:686-691参照）
        // 💡 推奨対策: 非ブロッキングI/Oまたはタイムアウト付きwrite関数を使用
        let stdOut = FileHandle.standardOutput
        stdOut.write(jsonData)
        stdOut.write("\n".data(using: .utf8)!)
        // 確実にバッファを flush してデータが即座に送信されるようにする
        if #available(macOS 10.15, *) {
            try? stdOut.synchronize()
        }
    } catch {
        print("JSON serialization failed: \(error)")
    }

case "exclude":
    // ワンショットで除外されたウィンドウ一覧を出力
    let windowsListInfo = windowListProvider()
    let filteredWindows = filterWindows(windowsListInfo)

    // 除外されたウィンドウを特定（filteredWindowsに含まれていないもの）
    let filteredWindowNumbers = Set(filteredWindows.compactMap { $0["kCGWindowNumber"] as? Int })
    let excludedWindows = windowsListInfo.filter { window in
        if let windowNumber = window["kCGWindowNumber"] as? Int {
            return !filteredWindowNumbers.contains(windowNumber)
        }
        return false
    }

    do {
        let jsonData = try JSONSerialization.data(withJSONObject: excludedWindows, options: [])
        // ⚠️ UE RISK (HIGH): stdout.write without timeout/non-blocking
        // 🔍 調査結果: ProgressiveIconLoader.sendToStdout()と同じリスク
        // 🧪 UEを起こす可能性のある操作: sendToStdout()と同じ（main.swift:686-691参照）
        // 💡 推奨対策: 非ブロッキングI/Oまたはタイムアウト付きwrite関数を使用
        let stdOut = FileHandle.standardOutput
        stdOut.write(jsonData)
        stdOut.write("\n".data(using: .utf8)!)
        // 確実にバッファを flush してデータが即座に送信されるようにする
        if #available(macOS 10.15, *) {
            try? stdOut.synchronize()
        }
    } catch {
        print("JSON serialization failed: \(error)")
    }

case "watch":
    // シグナルハンドラの設定
    setupSignalHandlers()

    // プロセス管理の開始（タイムアウトなし）
    ProcessManager.shared.maxRuntime = .infinity
    ProcessManager.shared.startHeartbeat()
    ProcessManager.shared.recordActivity()

    // ウィンドウの変更を監視
    print("ウィンドウ変更の監視を開始しました...")
    WindowObserver.shared.observeWindowChanges()

    // 初回のウィンドウ情報を出力（ProgressiveIconLoader使用）
    _ = getWindowInfoListData()
    ProcessManager.shared.recordActivity()

    // RunLoopを制限時間付きで実行
    let runLoop = RunLoop.main
    while ProcessManager.shared.shouldKeepRunning {
        let nextDate = Date().addingTimeInterval(0.5)
        if !runLoop.run(mode: .default, before: nextDate) {
            break
        }
    }
    
case "check-permissions":
    // 権限状態をJSONで出力
    if let data = getPermissionStatus() {
        if let jsonString = String(data: data, encoding: .utf8) {
            print(jsonString)
        } else {
            print("権限状態の変換に失敗しました")
            exit(1)
        }
    } else {
        print("権限状態の取得に失敗しました")
        exit(1)
    }

case "get-config":
    // 設定ファイル(config.json)の内容を出力
    guard let appSupportDir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
        print("Application Supportディレクトリにアクセスできません")
        exit(1)
    }

    let taskbarDir = appSupportDir.appendingPathComponent("taskbar.fm")
    let configJsonPath = taskbarDir.appendingPathComponent("config.json")

    guard FileManager.default.fileExists(atPath: configJsonPath.path) else {
        print("config.jsonが見つかりません: \(configJsonPath.path)")
        exit(1)
    }

    do {
        // ⚠️ UE RISK (LOW-MEDIUM): Data(contentsOf:)
        // 🔍 調査結果: loadFiltersFromFile()と同じリスク
        // 🧪 UEを起こす可能性のある操作: loadFiltersFromFile()と同じ（main.swift:223-227参照）
        // 💡 推奨対策: Application Supportは通常ローカルファイルシステムなので許容範囲
        let data = try Data(contentsOf: configJsonPath)
        // ⚠️ UE RISK (HIGH): stdout.write without timeout/non-blocking
        // 🔍 調査結果: ProgressiveIconLoader.sendToStdout()と同じリスク
        // 🧪 UEを起こす可能性のある操作: sendToStdout()と同じ（main.swift:686-691参照）
        // 💡 推奨対策: 非ブロッキングI/Oまたはタイムアウト付きwrite関数を使用
        let stdOut = FileHandle.standardOutput
        stdOut.write(data)
        stdOut.write("\n".data(using: .utf8)!)
        // 確実にバッファを flush してデータが即座に送信されるようにする
        if #available(macOS 10.15, *) {
            try? stdOut.synchronize()
        }
    } catch {
        print("config.jsonの読み込みに失敗しました: \(error)")
        exit(1)
    }

default:
    print("不明なオプション: \(option)")
    print("使用可能なオプション: grant, debug, list, exclude, watch, check-permissions, get-config")
    exit(1)
}
