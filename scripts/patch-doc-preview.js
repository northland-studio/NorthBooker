// 修正 @doc-preview/core 发布产物中 worker 以 .ts 路径引用（实际为 .js）
// 在 npm install 后自动执行，保证 patch 持久化
import fs from 'node:fs'
import path from 'node:path'

const file = path.resolve('node_modules/@doc-preview/core/dist/split-diff-native.js')

if (fs.existsSync(file)) {
  let src = fs.readFileSync(file, 'utf8')
  if (src.includes('workers/diff-worker.ts')) {
    src = src.replace('workers/diff-worker.ts', 'workers/diff-worker.js')
    fs.writeFileSync(file, src)
    console.log('[patch] doc-preview: diff-worker.ts -> diff-worker.js')
  } else {
    console.log('[patch] doc-preview: already patched')
  }
} else {
  console.log('[patch] doc-preview: target file not found, skip')
}
