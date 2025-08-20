# Electron Store Practical Examples

## Common Use Cases

### 1. Application Settings Store

```javascript
import Store from 'electron-store';

const settingsSchema = {
  windowBounds: {
    type: 'object',
    properties: {
      x: { type: 'number' },
      y: { type: 'number' },
      width: { type: 'number', minimum: 400 },
      height: { type: 'number', minimum: 300 }
    },
    default: { x: 100, y: 100, width: 800, height: 600 }
  },
  theme: {
    type: 'string',
    enum: ['light', 'dark', 'auto'],
    default: 'auto'
  },
  language: {
    type: 'string',
    default: 'en'
  },
  autoLaunch: {
    type: 'boolean',
    default: false
  }
};

const settings = new Store({
  name: 'settings',
  schema: settingsSchema
});

// Usage
settings.set('theme', 'dark');
settings.set('windowBounds.width', 1200);
const currentTheme = settings.get('theme');
```

### 2. User Preferences with Validation

```javascript
const userPrefsSchema = {
  notifications: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', default: true },
      sound: { type: 'boolean', default: true },
      position: { 
        type: 'string', 
        enum: ['top-right', 'top-left', 'bottom-right', 'bottom-left'],
        default: 'top-right'
      }
    },
    default: {}
  },
  shortcuts: {
    type: 'object',
    additionalProperties: {
      type: 'string'
    },
    default: {
      'toggle-window': 'CommandOrControl+Shift+T',
      'quit-app': 'CommandOrControl+Q'
    }
  }
};

const userPrefs = new Store({
  name: 'user-preferences',
  schema: userPrefsSchema
});
```

### 3. Cache Store with TTL Pattern

```javascript
class CacheStore {
  constructor() {
    this.store = new Store({
      name: 'cache',
      defaults: {
        data: {},
        timestamps: {}
      }
    });
    this.ttl = 24 * 60 * 60 * 1000; // 24 hours
  }

  set(key, value, customTtl) {
    const now = Date.now();
    this.store.set(`data.${key}`, value);
    this.store.set(`timestamps.${key}`, now + (customTtl || this.ttl));
  }

  get(key) {
    const now = Date.now();
    const expiry = this.store.get(`timestamps.${key}`);
    
    if (!expiry || now > expiry) {
      this.delete(key);
      return undefined;
    }
    
    return this.store.get(`data.${key}`);
  }

  delete(key) {
    this.store.delete(`data.${key}`);
    this.store.delete(`timestamps.${key}`);
  }

  cleanup() {
    const now = Date.now();
    const timestamps = this.store.get('timestamps', {});
    
    Object.keys(timestamps).forEach(key => {
      if (now > timestamps[key]) {
        this.delete(key);
      }
    });
  }
}

const cache = new CacheStore();
```

### 4. Configuration Migrations

```javascript
const store = new Store({
  migrations: {
    '>=1.6.2': (store) => {
      // Add new configuration keys
      store.set('headers', []);
      store.set('footers', []);
    },
    '2.0.0': (store) => {
      // Rename old keys
      const oldFilters = store.get('windowFilters');
      if (oldFilters) {
        store.set('filters', oldFilters);
        store.delete('windowFilters');
      }
    },
    '2.1.0': (store) => {
      // Transform data structure
      const layout = store.get('options.layout');
      if (layout === 'top') {
        // 'top' is no longer supported, convert to 'bottom'
        store.set('options.layout', 'bottom');
      }
    }
  },
  defaults: {
    options: {
      layout: 'bottom',
      windowSortByPositionInApp: false
    }
  }
});
```

### 5. IPC Integration for Renderer Process

```javascript
// main.js
import { ipcMain } from 'electron';
import Store from 'electron-store';

const store = new Store();

// Register IPC handlers for store operations
ipcMain.handle('store:get', (event, key, defaultValue) => {
  return store.get(key, defaultValue);
});

ipcMain.handle('store:set', (event, key, value) => {
  store.set(key, value);
});

ipcMain.handle('store:delete', (event, key) => {
  store.delete(key);
});

ipcMain.handle('store:clear', () => {
  store.clear();
});

ipcMain.handle('store:has', (event, key) => {
  return store.has(key);
});

// Watch for changes and notify renderer
store.onDidAnyChange((newValue, oldValue) => {
  // Broadcast to all renderer processes
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send('store:changed', newValue, oldValue);
  });
});

// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronStore', {
  get: (key, defaultValue) => ipcRenderer.invoke('store:get', key, defaultValue),
  set: (key, value) => ipcRenderer.invoke('store:set', key, value),
  delete: (key) => ipcRenderer.invoke('store:delete', key),
  clear: () => ipcRenderer.invoke('store:clear'),
  has: (key) => ipcRenderer.invoke('store:has', key),
  onChange: (callback) => {
    ipcRenderer.on('store:changed', (event, newValue, oldValue) => {
      callback(newValue, oldValue);
    });
  }
});

// renderer.js
// Now you can use electronStore in renderer process
await window.electronStore.set('theme', 'dark');
const theme = await window.electronStore.get('theme');
```

### 6. Multi-Store Architecture

```javascript
// Separate stores for different concerns
const stores = {
  settings: new Store({
    name: 'settings',
    defaults: {
      theme: 'light',
      language: 'en'
    }
  }),
  
  userdata: new Store({
    name: 'userdata',
    defaults: {
      recentFiles: [],
      bookmarks: []
    }
  }),
  
  cache: new Store({
    name: 'cache',
    defaults: {
      lastUpdate: null,
      apiResponses: {}
    }
  })
};

// Export a unified interface
export const storage = {
  // Settings methods
  setSetting: (key, value) => stores.settings.set(key, value),
  getSetting: (key, defaultValue) => stores.settings.get(key, defaultValue),
  
  // User data methods
  addRecentFile: (filepath) => {
    const recent = stores.userdata.get('recentFiles', []);
    const updated = [filepath, ...recent.filter(f => f !== filepath)].slice(0, 10);
    stores.userdata.set('recentFiles', updated);
  },
  
  // Cache methods
  setCacheData: (key, data) => stores.cache.set(`apiResponses.${key}`, data),
  getCacheData: (key) => stores.cache.get(`apiResponses.${key}`)
};
```

### 7. Reactive Store with Events

```javascript
import { EventEmitter } from 'events';

class ReactiveStore extends EventEmitter {
  constructor(options = {}) {
    super();
    this.store = new Store(options);
    
    // Watch all changes and emit events
    this.store.onDidAnyChange((newValue, oldValue) => {
      this.emit('change', newValue, oldValue);
    });
  }

  set(key, value) {
    const oldValue = this.store.get(key);
    this.store.set(key, value);
    this.emit(`change:${key}`, value, oldValue);
    return this;
  }

  get(key, defaultValue) {
    return this.store.get(key, defaultValue);
  }

  // Subscribe to specific key changes
  subscribe(key, callback) {
    this.on(`change:${key}`, callback);
    return () => this.off(`change:${key}`, callback);
  }
}

// Usage
const store = new ReactiveStore({
  defaults: { count: 0 }
});

const unsubscribe = store.subscribe('count', (newValue, oldValue) => {
  console.log(`Count changed from ${oldValue} to ${newValue}`);
});

store.set('count', 1); // Triggers subscription
```

### 8. Encrypted Sensitive Data

```javascript
import { safeStorage } from 'electron';

class SecureStore {
  constructor() {
    this.store = new Store({
      name: 'secure-config'
    });
  }

  setSecure(key, value) {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(JSON.stringify(value));
      this.store.set(key, encrypted.toString('base64'));
    } else {
      // Fallback for development or when encryption isn't available
      console.warn('Encryption not available, storing in plain text');
      this.store.set(key, value);
    }
  }

  getSecure(key) {
    const stored = this.store.get(key);
    if (!stored) return undefined;

    if (safeStorage.isEncryptionAvailable() && typeof stored === 'string') {
      try {
        const encrypted = Buffer.from(stored, 'base64');
        const decrypted = safeStorage.decryptString(encrypted);
        return JSON.parse(decrypted);
      } catch (error) {
        console.error('Failed to decrypt data:', error);
        return undefined;
      }
    }

    return stored;
  }
}

const secureStore = new SecureStore();
secureStore.setSecure('apiKey', 'sensitive-api-key');
```

## Testing with Electron Store

```javascript
// test-utils.js
import Store from 'electron-store';
import { tmpdir } from 'os';
import { join } from 'path';

export function createTestStore(name = 'test-store') {
  return new Store({
    name,
    cwd: join(tmpdir(), 'electron-store-tests'),
    clearInvalidConfig: true
  });
}

// test.js
import { createTestStore } from './test-utils.js';

describe('Store functionality', () => {
  let store;

  beforeEach(() => {
    store = createTestStore();
    store.clear();
  });

  test('should set and get values', () => {
    store.set('test', 'value');
    expect(store.get('test')).toBe('value');
  });
});
```