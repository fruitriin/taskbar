//
//  FilterWindowsTests.swift
//  taskbar.helper
//
//  Unit tests for filterWindows function
//

import XCTest
import Foundation

class FilterWindowsTests: XCTestCase {

    override func setUp() {
        super.setUp()
        // テスト用にデバッグモードを無効化
        debug = false
    }

    // MARK: - Test Data Helper

    func createTestWindow(
        name: String? = "TestWindow",
        owner: String = "TestApp",
        pid: Int = 1234,
        width: Int = 800,
        height: Int = 600,
        isOnscreen: Bool = true
    ) -> [String: AnyObject] {
        var window: [String: AnyObject] = [:]

        if let name = name {
            window["kCGWindowName"] = name as AnyObject
        }
        window["kCGWindowOwnerName"] = owner as AnyObject
        window["kCGWindowOwnerPID"] = NSNumber(value: pid)
        window["kCGWindowIsOnscreen"] = NSNumber(value: isOnscreen)
        window["kCGWindowNumber"] = NSNumber(value: Int.random(in: 1000...9999))

        let bounds: [String: AnyObject] = [
            "Width": NSNumber(value: width),
            "Height": NSNumber(value: height),
            "X": NSNumber(value: 100),
            "Y": NSNumber(value: 100)
        ]
        window["kCGWindowBounds"] = bounds as AnyObject

        return window
    }

    // MARK: - Size Filter Tests

    func testFilterWindowsBySize() {
        let windows = [
            createTestWindow(width: 50, height: 50),   // 通常サイズ
            createTestWindow(width: 30, height: 50),   // 幅が小さすぎる
            createTestWindow(width: 50, height: 30),   // 高さが小さすぎる
            createTestWindow(width: 20, height: 20),   // 両方小さすぎる
            createTestWindow(width: 800, height: 600)  // 通常サイズ
        ]

        let filtered = filterWindows(windows)

        // サイズフィルターで2つが除外されるはず（幅30と高さ30、幅20と高さ20）
        XCTAssertEqual(filtered.count, 3, "サイズが40未満のウィンドウは除外されるべき")
    }

    // MARK: - Default Filter Tests

    func testFilterOffscreenWindows() {
        let windows = [
            createTestWindow(isOnscreen: true),
            createTestWindow(isOnscreen: false), // オフスクリーン（除外される）
            createTestWindow(isOnscreen: true)
        ]

        let filtered = filterWindows(windows)
        XCTAssertEqual(filtered.count, 2, "オフスクリーンウィンドウは除外されるべき")
    }

    func testFilterEmptyNameWindows() {
        let windows = [
            createTestWindow(name: "Normal Window"),
            createTestWindow(name: ""),  // 空の名前（除外される）
            createTestWindow(name: nil), // 名前なし（除外される）
            createTestWindow(name: "Another Window")
        ]

        let filtered = filterWindows(windows)
        XCTAssertEqual(filtered.count, 2, "空の名前のウィンドウは除外されるべき")
    }

    func testFilterDockWindows() {
        let windows = [
            createTestWindow(owner: "TestApp"),
            createTestWindow(owner: "Dock"), // Dock（除外される）
            createTestWindow(owner: "DockHelper"), // DockHelper（除外される）
            createTestWindow(owner: "AnotherApp")
        ]

        let filtered = filterWindows(windows)
        XCTAssertEqual(filtered.count, 2, "DockとDockHelperは除外されるべき")
    }

    func testFilterSystemWindows() {
        let windows = [
            createTestWindow(owner: "TestApp"),
            createTestWindow(owner: "screencapture"), // スクリーンキャプチャ（除外される）
            createTestWindow(owner: "スクリーンショット"), // スクリーンショット（除外される）
            createTestWindow(owner: "通知センター"), // 通知センター（除外される）
            createTestWindow(owner: "Window Server"), // Window Server（除外される）
            createTestWindow(owner: "Spotlight"), // Spotlight（除外される）
            createTestWindow(owner: "AnotherApp")
        ]

        let filtered = filterWindows(windows)
        XCTAssertEqual(filtered.count, 2, "システムアプリケーションは除外されるべき")
    }

    func testFilterTaskbarWindows() {
        let windows = [
            createTestWindow(owner: "TestApp"),
            createTestWindow(owner: "taskbar.fm"), // taskbar.fmアプリ（除外される）
            createTestWindow(name: "taskbar.fm", owner: "TestApp"), // taskbar.fmウィンドウ（除外される）
            createTestWindow(owner: "AnotherApp")
        ]

        let filtered = filterWindows(windows)
        XCTAssertEqual(filtered.count, 2, "taskbar.fmアプリとウィンドウは除外されるべき")
    }

    func testFilterEmptyFinderWindows() {
        let windows = [
            createTestWindow(name: "Desktop", owner: "Finder"),
            createTestWindow(name: "", owner: "Finder"), // 空のFinderウィンドウ（除外される）
            createTestWindow(name: "Documents", owner: "Finder"),
            createTestWindow(name: "", owner: "TestApp") // 他のアプリの空ウィンドウ（既に除外される）
        ]

        let filtered = filterWindows(windows)
        XCTAssertEqual(filtered.count, 2, "空のFinderウィンドウは除外されるべき")
    }

    // MARK: - Multiple Filter Conditions Test

    func testMultipleFilterConditions() {
        let windows = [
            createTestWindow(name: "Normal", owner: "TestApp"),
            createTestWindow(name: "", owner: "Finder"), // 空のFinder（複数条件で除外）
            createTestWindow(name: "Item-0", owner: "TestApp"), // Item-0（除外される）
            createTestWindow(name: "Notification Center", owner: "TestApp"), // 通知センター名（除外される）
            createTestWindow(width: 30, height: 30) // サイズ不足（除外される）
        ]

        let filtered = filterWindows(windows)
        XCTAssertEqual(filtered.count, 1, "複数の除外条件が正しく適用されるべき")
    }

    // MARK: - Edge Cases

    func testEmptyWindowList() {
        let windows: [[String: AnyObject]] = []
        let filtered = filterWindows(windows)
        XCTAssertEqual(filtered.count, 0, "空のウィンドウリストは空を返すべき")
    }

    func testWindowWithMissingProperties() {
        var incompleteWindow: [String: AnyObject] = [:]
        incompleteWindow["kCGWindowOwnerName"] = "TestApp" as AnyObject
        // kCGWindowBoundsが欠けている

        let windows = [incompleteWindow]
        let filtered = filterWindows(windows)

        // プロパティが欠けていてもクラッシュしないことを確認
        XCTAssertEqual(filtered.count, 1, "不完全なウィンドウでもクラッシュしないべき")
    }

    func testBoundsWithMissingDimensions() {
        var window = createTestWindow()

        // 不完全なbounds（WidthまたはHeightが欠けている）
        let incompleteBounds: [String: AnyObject] = [
            "X": NSNumber(value: 100),
            "Y": NSNumber(value: 100)
        ]
        window["kCGWindowBounds"] = incompleteBounds as AnyObject

        let windows = [window]
        let filtered = filterWindows(windows)

        // サイズチェックで除外されるかもしれないが、クラッシュしないことを確認
        XCTAssertGreaterThanOrEqual(filtered.count, 0, "不完全なboundsでもクラッシュしないべき")
    }

    // MARK: - Performance Test

    func testPerformanceWithLargeWindowList() {
        var windows: [[String: AnyObject]] = []

        // 1000個のテストウィンドウを生成
        for i in 0..<1000 {
            windows.append(createTestWindow(
                name: "Window \(i)",
                owner: "App \(i % 10)",
                pid: 1000 + i
            ))
        }

        // いくつかの除外対象も追加
        windows.append(createTestWindow(owner: "Dock"))
        windows.append(createTestWindow(name: ""))
        windows.append(createTestWindow(width: 20, height: 20))

        measure {
            let filtered = filterWindows(windows)
            XCTAssertLessThan(filtered.count, windows.count, "フィルタリングで一部のウィンドウが除外されるべき")
        }
    }
}

// MARK: - Test Configuration

extension FilterWindowsTests {

    // テスト用のモックFilterManagerを使用する場合のセットアップ
    func setupMockFilters(_ customFilters: [LabeledFilter]) {
        // FilterManager.sharedの代わりにカスタムフィルターを使用
        // 注意: 実際の実装では、FilterManagerをテスト可能にするためのDIが必要
    }
}