import XCTest
@testable import taskbar_helper // ←プロジェクト名に合わせて修正

final class GetWindowInfoListDataTests: XCTestCase {
    override func setUp() {
        super.setUp()
        windowListProvider = {
            return [
                [
                    "kCGWindowOwnerPID": 123 as AnyObject,
                    "kCGWindowOwnerName": "TestApp1" as AnyObject,
                    "kCGWindowNumber": 1 as AnyObject
                ],
                [
                    "kCGWindowOwnerPID": 456 as AnyObject,
                    "kCGWindowOwnerName": "TestApp2" as AnyObject,
                    "kCGWindowNumber": 2 as AnyObject
                ]
            ]
        }
    }

    func testGetWindowInfoListDataReturnsDummyJSON() {
        guard let data = getWindowInfoListData() else {
            XCTFail("getWindowInfoListData() returned nil")
            return
        }
        do {
            let obj = try JSONSerialization.jsonObject(with: data, options: [])
            guard let arr = obj as? [[String: Any]] else {
                XCTFail("Result should be an array of dictionaries")
                return
            }
            XCTAssertEqual(arr.count, 2)
            XCTAssertEqual(arr[0]["kCGWindowOwnerName"] as? String, "TestApp1")
            XCTAssertEqual(arr[1]["kCGWindowOwnerPID"] as? Int, 456)
        } catch {
            XCTFail("Returned data is not valid JSON: \(error)")
        }
    }
} 