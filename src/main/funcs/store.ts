import Store from 'electron-store'

export const store = new Store({
  defaults: {
    layout: 'bottom',
    filters: [
      [{ property: 'kCGWindowIsOnscreen', is: false }],
      [{ property: 'kCGWindowOwnerName', is: 'Dock' }],
      [{ property: 'kCGWindowOwnerName', is: 'DockHelper' }],
      [{ property: 'kCGWindowOwnerName', is: 'screencapture' }],
      [{ property: 'kCGWindowOwnerName', is: 'スクリーンショット' }],
      [{ property: 'kCGWindowName', is: 'Notification Center' }],
      [{ property: 'kCGWindowName', is: 'Item-0' }],
      [{ property: 'kCGWindowOwnerName', is: 'Window Server' }],
      [{ property: 'kCGWindowOwnerName', is: 'コントロールセンター' }],
      [
        { property: 'kCGWindowOwnerName', is: 'Finder' },
        { property: 'kCGWindowName', is: '' }
      ],
      [{ property: 'kCGWindowName', is: 'Spotlight' }],
      [{ property: 'kCGWindowOwnerName', is: 'GoogleJapaneseInputRenderer' }],
      [{ property: 'kCGWindowOwnerName', is: 'taskbar.fm' }],
      [{ property: 'kCGWindowName', is: 'taskbar.fm' }]
    ]
  }
})
