/**
 * just-diff ライブラリ - 包括的テスト・リファレンス
 * 
 * 公式: https://www.npmjs.com/package/just-diff
 * GitHub: https://github.com/angus-c/just
 * Version: 6.0.2
 */

const { diff } = require('just-diff')
const { diffApply } = require('just-diff-apply')

console.log('='.repeat(60))
console.log('JUST-DIFF ライブラリ - 包括的テスト')
console.log('='.repeat(60))

// ===== 基本的な使用例 =====
console.log('\n1. 基本的なオブジェクトの比較')
console.log('-'.repeat(40))

const obj1 = { a: 4, b: 5 }
const obj2 = { a: 3, b: 5 }
const basicDiff = diff(obj1, obj2)
console.log('obj1:', obj1)
console.log('obj2:', obj2)
console.log('diff結果:', JSON.stringify(basicDiff, null, 2))

// ===== 配列での使用例 =====
console.log('\n2. 配列の比較（我々の実際のユースケース）')
console.log('-'.repeat(40))

// MacWindowを模倣したテストデータ
const allWindows = [
  { kCGWindowNumber: 101, kCGWindowName: 'Safari', kCGWindowOwnerName: 'Safari', kCGWindowBounds: { Height: 600, Width: 800 } },
  { kCGWindowNumber: 102, kCGWindowName: 'Dock', kCGWindowOwnerName: 'Dock', kCGWindowBounds: { Height: 30, Width: 1200 } },
  { kCGWindowNumber: 103, kCGWindowName: 'Chrome', kCGWindowOwnerName: 'Chrome', kCGWindowBounds: { Height: 500, Width: 900 } },
  { kCGWindowNumber: 104, kCGWindowName: 'Tiny Window', kCGWindowOwnerName: 'TestApp', kCGWindowBounds: { Height: 20, Width: 30 } }
]

const filteredWindows = allWindows.filter(w => w.kCGWindowBounds.Height >= 40)

console.log('全ウィンドウ数:', allWindows.length)
console.log('フィルター後:', filteredWindows.length)

const arrayDiff = diff(allWindows, filteredWindows)
console.log('配列diff結果:')
console.log(JSON.stringify(arrayDiff, null, 2))

// ===== 逆方向のdiff =====
console.log('\n3. 逆方向のdiff（filtered → all）')
console.log('-'.repeat(40))

const reverseDiff = diff(filteredWindows, allWindows)
console.log('逆方向diff結果:')
console.log(JSON.stringify(reverseDiff, null, 2))

// ===== 除外されたアイテムの抽出テスト =====
console.log('\n4. 除外されたアイテムの抽出方法')
console.log('-'.repeat(40))

// 方法1: 直接フィルタリング（推奨）
const excludedDirect = allWindows.filter(window => 
  !filteredWindows.some(filtered => filtered.kCGWindowNumber === window.kCGWindowNumber)
)
console.log('直接方法で除外されたウィンドウ:')
excludedDirect.forEach((w, i) => {
  console.log(`  ${i + 1}. ${w.kCGWindowName} (${w.kCGWindowOwnerName}) - ${w.kCGWindowBounds.Width}x${w.kCGWindowBounds.Height}`)
})

// 方法2: diffからの復元（複雑）
console.log('\ndiffからの除外ウィンドウ復元（参考）:')
const removeOps = arrayDiff.filter(op => op.op === 'remove')
console.log('remove操作:', removeOps)

// ===== diffApplyのテスト =====
console.log('\n5. diffApply の動作確認')
console.log('-'.repeat(40))

const testArray = [...allWindows] // コピーを作成
console.log('適用前のサイズ:', testArray.length)

diffApply(testArray, arrayDiff)
console.log('適用後のサイズ:', testArray.length)
console.log('適用後の内容が一致:', JSON.stringify(testArray) === JSON.stringify(filteredWindows))

// ===== パフォーマンステスト =====
console.log('\n6. パフォーマンス比較')
console.log('-'.repeat(40))

const largeArray = Array.from({ length: 1000 }, (_, i) => ({
  kCGWindowNumber: i,
  kCGWindowName: `Window ${i}`,
  kCGWindowOwnerName: `App ${i % 10}`,
  kCGWindowBounds: { Height: Math.random() > 0.5 ? 100 : 20, Width: 800 }
}))

const largeFiltered = largeArray.filter(w => w.kCGWindowBounds.Height >= 40)

console.time('diff実行時間')
const largeDiff = diff(largeArray, largeFiltered)
console.timeEnd('diff実行時間')

console.time('直接フィルタリング時間')
const largeExcluded = largeArray.filter(window => 
  !largeFiltered.some(filtered => filtered.kCGWindowNumber === window.kCGWindowNumber)
)
console.timeEnd('直接フィルタリング時間')

console.log(`大規模配列テスト - 元配列: ${largeArray.length}, フィルター後: ${largeFiltered.length}, 除外: ${largeExcluded.length}`)
console.log(`diff操作数: ${largeDiff.length}`)

// ===== 実際のhelper.ts用の推奨実装 =====
console.log('\n7. helper.ts用の推奨実装パターン')
console.log('-'.repeat(40))

function simulateApplyProcessChange(macWindowProcesses, newProcesses) {
  // フィルタリング関数（簡略化）
  const filterProcesses = (processes) => processes.filter(p => p.kCGWindowBounds.Height >= 40)
  
  const filteredProcesses = filterProcesses(newProcesses)
  
  // 除外されたウィンドウを取得（推奨方法）
  const excludedProcesses = newProcesses.filter(window => 
    !filteredProcesses.some(filtered => filtered.kCGWindowNumber === window.kCGWindowNumber)
  )
  
  // diff計算
  const result = diff(macWindowProcesses, filteredProcesses)
  
  return {
    filteredCount: filteredProcesses.length,
    excludedCount: excludedProcesses.length,
    excludedProcesses: excludedProcesses,
    diffOperations: result.length,
    hasChanges: result.length > 0
  }
}

const currentProcesses = []
const simulationResult = simulateApplyProcessChange(currentProcesses, allWindows)
console.log('シミュレーション結果:', simulationResult)

console.log('\n' + '='.repeat(60))
console.log('テスト完了')
console.log('='.repeat(60))

// ===== ドキュメンテーション =====
console.log(`
JUST-DIFF ライブラリ リファレンス
=====================================

## 基本情報
- バージョン: 6.0.2
- 依存関係: なし（zero-dependency）
- 用途: オブジェクトの差分計算とJSONPatchプロトコルサポート

## 主要API
- diff(obj1, obj2, [pathConverter]) : 差分操作の配列を返す
- 操作タイプ: "add", "remove", "replace"
- パス形式: 配列形式 ['a', 'b', 0] または JSON Patch形式 '/a/b/0'

## 結論（helper.tsでの使用について）
1. diff()は配列の変更を追跡するのに適している
2. 除外されたアイテムの取得には直接的なフィルタリングが最適
3. 現在の実装（diff + diffApply）は適切
4. 除外ウィンドウの取得は別ロジックで実装するのが推奨

## 推奨パターン：
\`\`\`javascript
const filteredProcesses = filterProcesses(newProcesses)
const excludedProcesses = newProcesses.filter(window => 
  !filteredProcesses.some(filtered => filtered.kCGWindowNumber === window.kCGWindowNumber)
)
const result = diff(macWindowProcesses, filteredProcesses)
\`\`\`
`)