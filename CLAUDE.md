# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
ユーザーへの返事は日本語でお願いします

## Project Overview

Taskbar.fm is an Electron application that brings Windows-like taskbar functionality to macOS. It consists of three main components:

- **Main Process** (src/main/): Node.js-based Electron main process
- **Renderer Process** (src/renderer/): Vue.js-based UI layer
- **Native Helper** (nativeSrc/): Swift application for system integration

## Development Commands

### Essential Commands (use `mise run` prefix)

- `mise run dev` - Start development server (copies helper binary and runs electron-vite dev)
- `mise run build` - Build application for production
- `mise run build:mac` - Create macOS universal binary
- `mise run test` - Run main process tests
- `mise run test:renderer` - Run renderer process tests
- `mise run test:all` - Run all tests

### Code Quality

- `mise run format` - Format code with Prettier
- `mise run lint` - Run ESLint
- `mise run typecheck` - Run TypeScript type checking for both processes
- `mise run typecheck:node` - Type check main process only
- `mise run typecheck:web` - Type check renderer process only

### Native Helper Development

- `mise run helper` - Open Xcode project for Swift helper
- `mise run swiftbuild` - Build Swift helper via command line
- Native helper binary must be built before running `dev` or `build`

### Installation

- `mise run install-app` - Install built app to /Applications

## Architecture

### Main Process Structure

- `src/main/main.ts` - Entry point, handles app lifecycle and power management
- `src/main/funcs/` - Core functionality modules:
  - `windows.ts` - Window management and display event handling
  - `helper.ts` - Communication with native Swift helper
  - `events.ts` - IPC event handlers between main and renderer
  - `store.ts` - Electron-store configuration management
  - `icon-cache.ts` - Application icon caching system

### Renderer Process Structure

- `src/renderer/` - Vue.js application with multiple entry points:
  - `index.html` / `renderer-main.ts` - Main taskbar interface
  - `option.html` / `renderer-option.ts` - Settings/preferences window
- Uses Vue Router with file-based routing (`src/renderer/src/pages/`)
- State management with Pinia
- Styling with Bulma CSS framework and Less preprocessor

### Native Helper

- `nativeSrc/taskbar.helper/` - Swift application for macOS system integration
- Provides window information, screen capture permissions, and system-level taskbar functionality
- Must be built separately and copied to `resources/TaskbarHelper`

## Testing

### Test Structure

- Main process tests: `src/main/tests/`
- Renderer process tests: `src/renderer/src/` (alongside source files)
- Uses Vitest as the test runner
- Separate test configurations for main and renderer processes

### Test Commands

- Single test file: `npx vitest path/to/test.file.ts` (run from appropriate directory)
- UI mode: `mise run test:ui` or `mise run test:ui:renderer`
- Coverage: `mise run test:coverage` or `mise run test:coverage:renderer`

## Key Technical Notes

### Build Dependencies

- The native Swift helper must be compiled before building the Electron app
- Development workflow requires copying the helper binary from DerivedData to resources/
- Universal macOS builds are supported via electron-builder

### Multi-Process Architecture

- Main process handles system integration, window management, and native helper communication
- Renderer processes handle UI for main taskbar and settings windows
- IPC communication managed through `src/main/funcs/events.ts`

### Configuration Management

- Uses electron-store for persistent configuration
- Settings structure managed in `src/main/funcs/store.ts`
- Icon caching system stores app icons in Application Support directory
