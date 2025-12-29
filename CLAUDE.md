# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
ユーザーへの返事は日本語でお願いします

## Project Overview

Taskbar.fm is an Electron application that brings Windows-like taskbar functionality to macOS. It consists of three main components:

- **Main Process** (src/main/): Node.js-based Electron main process
- **Renderer Process** (src/renderer/): Vue.js-based UI layer
- **Native Helper** (nativeSrc/): Swift application for system integration

### Development Tools

- **Task Runner**: mise - Used for running all development and build tasks
- **Package Manager**: bun - Used for dependency management and script execution

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

## Debugging TaskbarHelper (Native Swift Helper)

### Handling Hangs and UE (Uninterruptible Sleep) State

**Root Cause:**
UE (Uninterruptible Sleep) state occurs because **there is code in the source that calls uninterruptible kernel-level system calls**. This is not a runtime issue but a code issue that must be identified and fixed.

**Detection:**
1. If a TaskbarHelper command doesn't respond within 30 seconds, check process state:
   ```bash
   ps aux | grep TaskbarHelper | grep -v grep
   ```
2. Look for `UE` or `UE+` in the STAT column - this indicates uninterruptible sleep state

**UE State Characteristics:**
- Once ANY TaskbarHelper process enters UE state, **ALL subsequent executions** (any subcommand) will also enter UE state immediately
- This cascading behavior is expected and self-evident - don't waste time testing other subcommands
- `kill -9` **cannot** terminate processes in UE state
- The only solution is to restart the computer
- **IMPORTANT: "再起動" (restart) means a full OS reboot** - not just restarting the application or TaskbarHelper process. You must restart macOS itself to clear the UE state.

**Investigation Goal:**
The goal is to identify **which code is causing the UE state**, not to test if other commands work.

**When UE State is Detected:**

1. **DO NOT** execute any more TaskbarHelper commands - they will also hang immediately
2. **DO NOT** attempt to test other subcommands to see if they work - this is pointless
3. **Investigate the source code** to find the problematic system call:
   - Check debug logs (stderr output) to identify the last successful operation:
     - Look for `logBefore()` messages to see what was executing
     - Check for watchdog timeout warnings
     - Identify which function/system call didn't complete
   - Review the source code around the last logged operation
   - Identify which system call immediately follows the last successful log entry
   - That system call is likely causing the UE state
4. Report findings to the user:
   - Which operation/subcommand was being attempted
   - Last successful log entry (file:line from `logBefore()`)
   - Which system call or API is suspected to cause UE (e.g., file I/O, CGWindowListCopyWindowInfo, SCShareableContent APIs)
   - Specific code location (file and line number) where the problematic call exists
5. **Inform the user that a system restart is required** to clear the UE state and test fixes

**Common Causes:**
- macOS system calls that require screen recording permissions can hang if permissions are misconfigured
- `CGWindowListCopyWindowInfo` can hang when the WindowServer is overloaded
- `SCShareableContent` APIs can hang when screen recording permission dialogs are pending

**Prevention:**
- All potentially blocking operations in main.swift have watchdog timers
- Verbose logging can be enabled with: `TASKBAR_VERBOSE=1 resources/TaskbarHelper <command>`
- Check permissions before running: `resources/TaskbarHelper check-permissions`

### UE Hunting Procedure

**Systematic approach to identify and fix UE-causing code:**

1. **Reproduce UE State**
   - Perform specific operations that intentionally trigger UE state
   - Document the exact steps that cause the UE state
   - Verify UE state with `ps aux | grep TaskbarHelper | grep -v grep` (look for `UE` or `UE+` in STAT column)
   - Capture verbose logs if possible: `TASKBAR_VERBOSE=1 resources/TaskbarHelper <command> 2>ue-debug.log`
   - Note: Once UE occurs, you must restart macOS before proceeding

2. **Modify Source Code**
   - Based on investigation, apply fixes to the identified problematic system calls in nativeSrc/taskbar.helper/main.swift
   - Rebuild the helper: `mise run swiftbuild`
   - Copy the new binary: `cp nativeSrc/DerivedData/taskbar.helper/Build/Products/Release/taskbar.helper resources/TaskbarHelper`

3. **Verify Fix**
   - After restarting macOS (to clear any UE state)
   - Perform the exact same operation that previously caused UE state
   - Confirm that UE state does NOT occur
   - Check process state remains in `S` or `S+` (normal sleep states)
   - Run for extended period to ensure stability

**Important Notes:**
- Each iteration requires a full macOS restart
- Document all changes and test results
- If UE still occurs, return to step 1 with additional logging/investigation
