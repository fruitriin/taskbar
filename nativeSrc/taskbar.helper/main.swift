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
            let attributes = try FileManager.default.attributesOfItem(atPath: filtersJsonPath.path)
            let modificationTime = attributes[.modificationDate] as? Date

            // ファイルが変更されていない場合はキャッシュを返す
            if let lastTime = lastModificationTime, let currentTime = modificationTime, lastTime >= currentTime {
                return cachedFilters
            }

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
                            if let ownerName = window["kCGWindowOwnerName"] as? String {
                                // print("\(ownerName) - \(windowName)")
                            }
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
    // 画面録画権限をチェックするため、SCShareableContentを使用
    let semaphore = DispatchSemaphore(value: 0)
    var hasPermission = false
    
    if #available(macOS 12.3, *) {
        SCShareableContent.getExcludingDesktopWindows(false, onScreenWindowsOnly: true) { content, error in
            hasPermission = (error == nil)
            semaphore.signal()
        }
        
        // タイムアウト設定（100ms）
        if semaphore.wait(timeout: .now() + 0.1) == .timedOut {
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
        let stdOut = FileHandle.standardOutput
        stdOut.write(data)
        stdOut.write("\n".data(using: .utf8)!)
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
        
        // JSONとして保存
        if let iconJsonData = try? JSONSerialization.data(withJSONObject: existingIcons, options: []) {
            try? iconJsonData.write(to: iconJsonPath)
        }
    }
}

// MARK: - Window Information

// エラー出力用
var standardError = FileHandle.standardError

// グローバルなウィンドウリストプロバイダー（テスト用に差し替え可能）
var windowListProvider: () -> [[String: AnyObject]] = {
    CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as! [[String: AnyObject]]
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
        // アクティビティを記録
        ProcessManager.shared.recordActivity()

        // 非同期処理を開始（タイムアウト付き）
        DispatchQueue.global(qos: .background).async {
            // わずかに遅延させて非同期処理を実行
            // これがないと開いたウィンドウの変更が反映されない
            let delayTime = DispatchTime.now() + .milliseconds(500)

            DispatchQueue.global(qos: .background).asyncAfter(deadline: delayTime) {
                // タイムアウト付きでウィンドウ情報を取得
                let semaphore = DispatchSemaphore(value: 0)
                var windowData: Data?

                DispatchQueue.global(qos: .utility).async {
                    defer { semaphore.signal() }
                    windowData = getWindowInfoListData()
                }

                // 2秒でタイムアウト
                if semaphore.wait(timeout: .now() + 2.0) == .timedOut {
                    print("Window info retrieval timeout")
                    return
                }

                DispatchQueue.main.async {
                    // getWindowInfoListDataは内部でProgressiveIconLoaderを使用して
                    // 自動的にstdoutに送信するため、ここでは呼び出すだけ
                    _ = getWindowInfoListData()
                    ProcessManager.shared.recordActivity()
                }
            }
        }
    }

    @objc func filtersDidChange(notification: NSNotification) {
        print("Filter settings changed, updating window list...")

        // フィルター変更時は即座にウィンドウ情報を更新
        DispatchQueue.global(qos: .utility).async {
            _ = getWindowInfoListData()
            ProcessManager.shared.recordActivity()
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
    
default:
    print("不明なオプション: \(option)")
    print("使用可能なオプション: grant, debug, list, check-permissions")
    exit(1)
}
