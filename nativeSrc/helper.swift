import AppKit
import ScreenCaptureKit
import Foundation
import ApplicationServices
import Cocoa
import CoreGraphics

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

func getIcon(pid: Int, size: Int) -> Data? {
    return NSRunningApplication(processIdentifier: pid_t(pid))?.icon?.resized(to: size).png()
}

func stringify(data: Data) -> String {
    return "data:image/png;base64,\(data.base64EncodedString())"
}

// ウィンドウ情報の一覧を取得してJSONデータとして返す関数
func getWindowInfoListData() -> Data? {
//  let option: CGWindowListOption = CGWindowListOption(arrayLiteral: .excludeDesktopElements, .optionOnScreenOnly)
    let windowsListInfo = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as! [[String: AnyObject]]

    var windowInfoList: [[String: Any]] = []

    for windowInfo in windowsListInfo {
        var formattedWindowInfo: [String: Any] = [:]

        for (key, value) in windowInfo {
            formattedWindowInfo[key] = value
        }

        let pid = windowInfo["kCGWindowOwnerPID"] as! Int
        if  let icon = getIcon(pid: pid, size: 32) {
            formattedWindowInfo["appIcon"] = stringify(data: icon)
        }

        windowInfoList.append(formattedWindowInfo)
    }

    do {
        let jsonData = try JSONSerialization.data(withJSONObject: windowInfoList, options: .prettyPrinted)
        return jsonData
    } catch {
        print("Error serializing JSON: \(error)")
        return nil
    }
}


class WindowObserver {
    static let shared = WindowObserver()

    private init() {}

    func observeWindowChanges() {
        let notificationCenter = NSWorkspace.shared.notificationCenter
        notificationCenter.addObserver(
            self,
            selector: #selector(windowDidChange(notification:)),
            name: NSWorkspace.didActivateApplicationNotification,
            object: nil
        )
    }

    @objc func windowDidChange(notification: NSNotification) {
        if let data = getWindowInfoListData() {
            let stdOut = FileHandle.standardOutput
            stdOut.write(data)
        }
    }
}



let arguments = CommandLine.arguments
guard arguments.count > 1 else {
    print("引数が必要です")
    exit(0)
}
// 第1引数の値によって処理を分岐
let option = arguments[1]
switch option {
case "grant":
    // スクリーンキャプチャのアクセス要求
    CGRequestScreenCaptureAccess()
case "list":

    WindowObserver.shared.observeWindowChanges()
    RunLoop.main.run()
default:
    print("default")
}
