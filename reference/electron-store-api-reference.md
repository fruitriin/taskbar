# Electron Store API Reference

## Overview

Electron-store is a simple data persistence solution for Electron applications that saves and loads user preferences, app state, cache, and other data. The data is stored in a JSON file in the app's user data directory.

## Requirements (2025)

- **Electron**: Version 30 or later
- **Module Type**: Native ESM only (no CommonJS support)
- **Node**: Node.js 18+

## Installation

```bash
npm install electron-store
```

## Basic Usage

```javascript
import Store from 'electron-store';

const store = new Store();
store.set('unicorn', '🦄');
console.log(store.get('unicorn')); //=> '🦄'
```

## Constructor Options

### `new Store(options?)`

```javascript
const store = new Store({
  defaults: {
    foo: 'bar',
    unicorn: '🦄'
  },
  schema: {
    foo: {
      type: 'number',
      maximum: 100,
      minimum: 1,
      default: 50
    }
  },
  name: 'config',
  cwd: app.getPath('userData'),
  encryptionKey: 'optional-key',
  watch: true,
  clearInvalidConfig: true
});
```

#### Options

- **`defaults`** (object): Default values for store items
- **`schema`** (object): JSON Schema to validate config data
- **`name`** (string): Storage file name (default: 'config')
- **`cwd`** (string): Custom storage file location
- **`encryptionKey`** (string): Optional obfuscation key (not secure encryption)
- **`watch`** (boolean): Enable file change monitoring (default: true)
- **`clearInvalidConfig`** (boolean): Clear invalid config instead of throwing error

## Instance Methods

### Data Operations

#### `set(key, value)` / `set(object)`

Set a single item or multiple items:

```javascript
store.set('foo', 'bar');
store.set({
  foo: 'bar',
  hello: 'world'
});

// Dot notation for nested properties
store.set('foo.bar', 'baz');
```

#### `get(key, defaultValue?)`

Retrieve an item:

```javascript
store.get('foo'); //=> 'bar'
store.get('foo.bar'); //=> 'baz'
store.get('nonexistent', 'default'); //=> 'default'

// Get entire store
store.get(); //=> {foo: {bar: 'baz'}, hello: 'world'}
```

#### `delete(key)`

Remove a specific item:

```javascript
store.delete('foo');
store.delete('foo.bar'); // Delete nested property
```

#### `clear()`

Delete all items:

```javascript
store.clear();
```

#### `reset(...keys)`

Reset items to their default values:

```javascript
store.reset('foo', 'bar');
store.reset(); // Reset all to defaults
```

#### `has(key)`

Check if an item exists:

```javascript
store.has('foo'); //=> true
store.has('foo.bar'); //=> false
```

### Store Information

#### `size`

Get the number of items:

```javascript
console.log(store.size); //=> 2
```

#### `store`

Access the entire store object:

```javascript
console.log(store.store); //=> {foo: 'bar', hello: 'world'}
```

#### `path`

Get the storage file path:

```javascript
console.log(store.path); //=> '/Users/username/Library/Application Support/MyApp/config.json'
```

## Change Watching

### `onDidChange(key, callback)`

Watch a specific key for changes:

```javascript
const unsubscribe = store.onDidChange('foo', (newValue, oldValue) => {
  console.log('foo changed from', oldValue, 'to', newValue);
});

// Unsubscribe
unsubscribe();
```

### `onDidAnyChange(callback)`

Watch the entire config object:

```javascript
const unsubscribe = store.onDidAnyChange((newValue, oldValue) => {
  console.log('Store changed');
});
```

## Migrations

Support for data migrations when app versions change:

```javascript
const store = new Store({
  migrations: {
    '>=1.0.0': store => {
      store.set('debugPhase', true);
    },
    '1.0.2': store => {
      store.delete('debugPhase');
      store.set('phase', '1.0.2');
    },
    '>=2.0.0': store => {
      store.clear();
    }
  }
});
```

## Process Usage

### Main Process

```javascript
import Store from 'electron-store';

const store = new Store();
// Use directly in main process
```

### Renderer Process

For renderer process usage, initialize in main process first:

```javascript
// In main process
Store.initRenderer();

// In renderer process
import Store from 'electron-store';
const store = new Store();
```

## IPC Integration Example

```javascript
// main.js
import { ipcMain } from 'electron';
import Store from 'electron-store';

const store = new Store();

ipcMain.handle('store-get', (event, key) => store.get(key));
ipcMain.handle('store-set', (event, key, value) => store.set(key, value));

// renderer.js (with context isolation)
const { ipcRenderer } = require('electron');

async function getStoreValue(key) {
  return await ipcRenderer.invoke('store-get', key);
}

async function setStoreValue(key, value) {
  return await ipcRenderer.invoke('store-set', key, value);
}
```

## Schema Validation

Use JSON Schema to validate data:

```javascript
const store = new Store({
  schema: {
    foo: {
      type: 'number',
      maximum: 100,
      minimum: 1,
      default: 50
    },
    bar: {
      type: 'string',
      format: 'url'
    }
  }
});

store.set('foo', '🦄'); // Throws validation error
```

## Best Practices

1. **Small Data Only**: Use for settings, preferences, and small state data
2. **Large Data**: Store file paths instead of large blobs
3. **Security**: Don't store sensitive data (encryptionKey is just obfuscation)
4. **Validation**: Use schema validation for data integrity
5. **Migrations**: Handle version upgrades gracefully
6. **IPC**: Use proper IPC for renderer process communication

## Storage Location

Data is stored in:
- **macOS**: `~/Library/Application Support/<app name>`
- **Windows**: `%APPDATA%\<app name>`
- **Linux**: `~/.config/<app name>`

File name: `config.json` (or custom name specified in options)