import ScreenCaptureKit
import AppKit

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

// 使用例
if let data = getWindowInfoListData() {
    let stdOut = FileHandle.standardOutput
    stdOut.write(data)
}
