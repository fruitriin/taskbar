// TaskbarHelper debug出力からのサンプルフィクスチャデータ
// 実際のmacOSウィンドウ情報をテスト用に使用

const sampleWindowData = [
  {"kCGWindowSharingState":1,"kCGWindowOwnerName":"ターミナル","kCGWindowNumber":14444,"kCGWindowBounds":{"X":0,"Height":24,"Y":0,"Width":3440},"kCGWindowName":"","kCGWindowStoreType":1,"kCGWindowLayer":0,"kCGWindowOwnerPID":56463,"kCGWindowMemoryUsage":2288,"kCGWindowAlpha":1},
  {"kCGWindowLayer":0,"kCGWindowOwnerName":"ターミナル","kCGWindowAlpha":1,"kCGWindowBounds":{"X":567,"Height":262,"Y":848,"Width":260},"kCGWindowStoreType":1,"kCGWindowNumber":10888,"kCGWindowOwnerPID":56463,"kCGWindowMemoryUsage":2288,"kCGWindowSharingState":1,"kCGWindowName":"Terminal — zsh — 80×24"},
  {"kCGWindowLayer":3,"kCGWindowName":"","kCGWindowOwnerName":"ターミナル","kCGWindowSharingState":1,"kCGWindowStoreType":1,"kCGWindowBounds":{"X":2268,"Height":77,"Y":1094,"Width":84},"kCGWindowMemoryUsage":2288,"kCGWindowOwnerPID":56463,"kCGWindowNumber":10767,"kCGWindowAlpha":1},
  {"kCGWindowSharingState":1,"kCGWindowOwnerName":"ターミナル","kCGWindowNumber":14443,"kCGWindowBounds":{"X":0,"Height":24,"Y":0,"Width":3440},"kCGWindowName":"","kCGWindowStoreType":1,"kCGWindowLayer":0,"kCGWindowOwnerPID":56463,"kCGWindowMemoryUsage":2288,"kCGWindowAlpha":1},
  {"kCGWindowLayer":0,"kCGWindowSharingState":1,"kCGWindowOwnerName":"ターミナル","kCGWindowMemoryUsage":2288,"kCGWindowNumber":14442,"kCGWindowName":"","kCGWindowAlpha":1,"kCGWindowBounds":{"X":0,"Height":24,"Y":0,"Width":3440},"kCGWindowStoreType":1,"kCGWindowOwnerPID":56463},
  {"kCGWindowStoreType":1,"kCGWindowLayer":0,"kCGWindowBounds":{"X":0,"Height":24,"Y":0,"Width":3440},"kCGWindowNumber":14441,"kCGWindowSharingState":1,"kCGWindowName":"","kCGWindowOwnerPID":56463,"kCGWindowAlpha":1,"kCGWindowOwnerName":"ターミナル","kCGWindowMemoryUsage":2288}
];

// テスト用のヘルパー関数
function getVisibleWindows() {
  return sampleWindowData.filter(window => window.kCGWindowIsOnscreen === true);
}

function getWindowsByOwner(ownerName) {
  return sampleWindowData.filter(window => window.kCGWindowOwnerName === ownerName);
}

function getTaskbarWindow() {
  return sampleWindowData.find(window => window.kCGWindowName === "taskbar.fm");
}

function getDesktopWindows() {
  return sampleWindowData.filter(window => window.kCGWindowName === "Desktop");
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sampleWindowData,
    getVisibleWindows,
    getWindowsByOwner,
    getTaskbarWindow,
    getDesktopWindows
  };
}