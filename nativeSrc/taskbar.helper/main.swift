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

// MARK: - Extensions

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
        let jsonData = try JSONSerialization.data(withJSONObject: permissionStatus, options: .prettyPrinted)
        return jsonData
    } catch {
        print("Error serializing permission status: \(error)")
        return nil
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
    var windowInfoList: [[String: Any]] = []
    var iconDict: [String: String] = [:]

    // 重複するPIDを削除してアイコン取得を効率化
    var uniquePids = Set<Int>()
    var pidToOwner: [Int: String] = [:]

    for windowInfo in windowsListInfo {
        var formattedWindowInfo: [String: Any] = [:]

        for (key, value) in windowInfo {
            formattedWindowInfo[key] = value
        }

        // PIDとOwnerの情報を収集（重複削除のため）
        if let pid = formattedWindowInfo["kCGWindowOwnerPID"] as? Int,
           let owner = formattedWindowInfo["kCGWindowOwnerName"] as? String,
           !owner.isEmpty {
            uniquePids.insert(pid)
            pidToOwner[pid] = owner
        }
        windowInfoList.append(formattedWindowInfo)
    }
    
    // ユニークなPIDのみからアイコンを取得（並列処理で高速化）
    let iconQueue = DispatchQueue(label: "icon-processing", qos: .utility, attributes: .concurrent)
    let iconGroup = DispatchGroup()
    let iconLock = NSLock()
    
    for pid in uniquePids {
        guard let owner = pidToOwner[pid] else { continue }
        
        iconGroup.enter()
        iconQueue.async {
            defer { iconGroup.leave() }
            
            if let iconBase64 = getIconBase64(pid: pid, owner: owner, windowName: "", size: 32) {
                let safeOwner = owner.replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: " ", with: "")
                iconLock.lock()
                iconDict[safeOwner] = iconBase64
                iconLock.unlock()
            }
        }
    }
    
    // アイコン取得完了を最大1秒まで待機
    if iconGroup.wait(timeout: .now() + 1.0) == .timedOut {
        standardError.write("Icon processing timeout for \(uniquePids.count) processes\n".data(using: .utf8)!)
    }

    // アイコンキャッシュディレクトリの作成（非同期でメインスレッドをブロックしない）
    let fileManager = FileManager.default
    // JSコードと同じApplication Supportディレクトリのtaskbar.fmフォルダを直接使用
    let userDataDir = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!.appendingPathComponent("taskbar.fm")
    if !fileManager.fileExists(atPath: userDataDir.path) {
        try? fileManager.createDirectory(at: userDataDir, withIntermediateDirectories: true, attributes: nil)
    }
    // JSONとして保存
    do {
        let iconJsonData = try JSONSerialization.data(withJSONObject: iconDict, options: .prettyPrinted)
        let iconJsonPath = userDataDir.appendingPathComponent("icons.json")
        try? iconJsonData.write(to: iconJsonPath)
    } catch {
        print("Error serializing icon JSON: \(error)")
    }

    do {
        let jsonData = try JSONSerialization.data(withJSONObject: windowInfoList, options: .prettyPrinted)
        return jsonData
    } catch {
        print("Error serializing JSON: \(error)")
        return nil
    }
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
                    if let data = windowData {
                        let stdOut = FileHandle.standardOutput
                        stdOut.write(data)
                        stdOut.write("\n".data(using: .utf8)!)
                        ProcessManager.shared.recordActivity()
                    }
                }
            }
        }
    }
}

// MARK: - Process Management

class ProcessManager {
    static let shared = ProcessManager()
    private var startTime = Date()
    private var maxRuntime: TimeInterval = 300 // 5分の最大実行時間
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
        let idleTime = currentTime.timeIntervalSince(lastActivity)
        
        // 最大実行時間を超過した場合
        if runtime > maxRuntime {
            print("Maximum runtime exceeded, shutting down gracefully...")
            self.gracefulShutdown(reason: "max_runtime")
        }
        
        // 30秒間アクティビティがない場合
        if idleTime > 30 {
            print("No activity for 30 seconds, shutting down...")
            self.gracefulShutdown(reason: "idle_timeout")
        }
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
    print("  list          - ウィンドウ変更を監視してリアルタイム出力")
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
    if let data = getWindowInfoListData() {
        print(String(data: data, encoding: .utf8) ?? "データの変換に失敗しました")
    } else {
        print("ウィンドウ情報の取得に失敗しました")
    }
    
case "list":
    // シグナルハンドラの設定
    setupSignalHandlers()
    
    // プロセス管理の開始
    ProcessManager.shared.startHeartbeat()
    ProcessManager.shared.recordActivity()
    
    // ウィンドウの変更を監視
    print("ウィンドウ変更の監視を開始しました...")
    WindowObserver.shared.observeWindowChanges()
    
    // 初回のウィンドウ情報を出力
    if let data = getWindowInfoListData() {
        let stdOut = FileHandle.standardOutput
        stdOut.write(data)
        stdOut.write("\n".data(using: .utf8)!)
        ProcessManager.shared.recordActivity()
    }
    
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
