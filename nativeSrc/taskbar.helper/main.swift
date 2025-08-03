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

func getIconBase64(pid: Int, owner: String, windowName: String, size: Int) -> String? {
    guard let iconImage = NSRunningApplication(processIdentifier: pid_t(pid))?.icon?.resized(to: size),
          let iconData = iconImage.png() else {
        return nil
    }
    return iconData.base64EncodedString()
}

func stringify(data: Data) -> String {
    return "data:image/png;base64,\(data.base64EncodedString())"
}

// MARK: - Window Information

// グローバルなウィンドウリストプロバイダー（テスト用に差し替え可能）
var windowListProvider: () -> [[String: AnyObject]] = {
    CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as! [[String: AnyObject]]
}

// ウィンドウ情報の一覧を取得してJSONデータとして返す関数
func getWindowInfoListData() -> Data? {
    let windowsListInfo = windowListProvider()
    var windowInfoList: [[String: Any]] = []
    var iconDict: [String: String] = [:]

    for windowInfo in windowsListInfo {
        var formattedWindowInfo: [String: Any] = [:]

        for (key, value) in windowInfo {
            formattedWindowInfo[key] = value
        }

        // アイコンのbase64を収集
        if let pid = formattedWindowInfo["kCGWindowOwnerPID"] as? Int,
           let owner = formattedWindowInfo["kCGWindowOwnerName"] as? String,
           let windowName = formattedWindowInfo["kCGWindowName"] as? String,
           let iconBase64 = getIconBase64(pid: pid, owner: owner, windowName: windowName, size: 32) {
            let safeOwner = owner.replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: " ", with: "")
            iconDict[safeOwner] = iconBase64
        }
        windowInfoList.append(formattedWindowInfo)
    }

    // アイコンキャッシュディレクトリの作成
    let fileManager = FileManager.default
    // JSコードと同じApplication Supportディレクトリのicon_cacheフォルダを使用
    let userDataDir = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!.appendingPathComponent("taskbar.fm")
    let iconCacheDir = userDataDir.appendingPathComponent("icon_cache").path
    if !fileManager.fileExists(atPath: iconCacheDir) {
        try? fileManager.createDirectory(atPath: iconCacheDir, withIntermediateDirectories: true, attributes: nil)
    }
    // JSONとして保存
    do {
        let iconJsonData = try JSONSerialization.data(withJSONObject: iconDict, options: .prettyPrinted)
        let iconJsonPath = iconCacheDir + "/icons.json"
        try? iconJsonData.write(to: URL(fileURLWithPath: iconJsonPath))
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
        // 非同期処理を開始
        DispatchQueue.global(qos: .background).async {
            // わずかに遅延させて非同期処理を実行
            // これがないと開いたウィンドウの変更が反映されない
            let delayTime = DispatchTime.now() + .milliseconds(500)

            DispatchQueue.global(qos: .background).asyncAfter(deadline: delayTime) {
                DispatchQueue.main.async {
                    if let data = getWindowInfoListData() {
                        let stdOut = FileHandle.standardOutput
                        stdOut.write(data)
                    }
                }
            }
        }
    }
}

// MARK: - Main Entry Point

let arguments = CommandLine.arguments
guard arguments.count > 1 else {
    print("使用方法:")
    print("  grant  - スクリーンキャプチャのアクセス権限を要求")
    print("  debug  - 現在のウィンドウ情報をデバッグ出力")
    print("  list   - ウィンドウ変更を監視してリアルタイム出力")
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
    // ウィンドウの変更を監視
    print("ウィンドウ変更の監視を開始しました...")
    WindowObserver.shared.observeWindowChanges()
    RunLoop.main.run()
    
default:
    print("不明なオプション: \(option)")
    print("使用可能なオプション: grant, debug, list")
    exit(1)
}
