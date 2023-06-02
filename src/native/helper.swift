import AppKit
import ScreenCaptureKit

// スクリーンキャプチャのアクセス要求
CGRequestScreenCaptureAccess()

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
    let option: CGWindowListOption = CGWindowListOption(arrayLiteral: .excludeDesktopElements, .optionOnScreenOnly)
    let windowsListInfo = CGWindowListCopyWindowInfo(option, kCGNullWindowID) as! [[String: AnyObject]]

    var windowInfoList: [[String: Any]] = []

    for windowInfo in windowsListInfo {
        var formattedWindowInfo: [String: Any] = [:]

        for (key, value) in windowInfo {
            if let stringValue = value as? String {
                formattedWindowInfo[key] = stringValue
            } else if let numberValue = value as? NSNumber {
                formattedWindowInfo[key] = numberValue
            } else if let arrayValue = value as? [AnyObject] {
                formattedWindowInfo[key] = arrayValue
            }
        }
        
        let pid = windowInfo["kCGWindowOwnerPID"] as! Int
        if  let icon = getIcon(pid: pid, size: 32) {
            formattedWindowInfo["appIcon"] = stringify(data: icon)
        }else {
//           print("Could not find app with PID \(pid)")
//           print(formattedWindowInfo)
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






if let data = getWindowInfoListData() {
    let stdOut = FileHandle.standardOutput
    stdOut.write(data)
}
