// TTS 段落分割 + worker 多线程流式合成测试脚本
// 运行: node test-tts-stream.js
// 说明: 通过 mock electron.app 使 tts.js 可在纯 Node 环境加载（模型读取真实 userData 目录）
const path = require('path')

// mock electron（仅提供 app.getPath('userData')）
const electronMock = {
  app: { getPath: () => path.join(process.env.APPDATA || '', 'northbooker-desktop') },
}
require.cache[require.resolve('electron')] = {
  id: require.resolve('electron'),
  filename: require.resolve('electron'),
  loaded: true,
  exports: electronMock,
}

const tts = require('./tts.js')

let failed = 0
function assert(cond, msg) {
  if (cond) console.log('  PASS:', msg)
  else { console.error('  FAIL:', msg); failed++ }
}

async function main() {
  // ===== 1. 段落切分单元测试 =====
  console.log('===== 1. 段落切分 =====')
  const text =
    '这是第一句。这是第二句！第三句？还有分号；以及逗号，最后句号。\n' +
    '新段落第一行\n新段落第二行，带逗号继续写下去。\n' +
    '超长无标点文本'.repeat(40) +
    '最后一段。'
  const segs = tts.splitText(text)
  console.log('  段落数:', segs.length)
  segs.forEach((s, i) => console.log(`  [${i}] ${s.slice(0, 24)}${s.length > 24 ? '...' : ''} (${s.length}字)`))
  assert(segs.length >= 3, '长文本切分为多段')
  assert(segs.every((s) => s.trim().length > 0), '无空段落')
  assert(segs.every((s) => s.length <= 210), '每段不超过约 200 字')
  assert(segs.slice(0, -1).every((s) => /[。！？；，、\n]$/.test(s) || s.length >= 190), '段落切分点在标点/换行或长度上限处')
  assert(segs[segs.length - 1].length > 0, '末尾段落保留')

  // ===== 2. 模型就绪 =====
  console.log('\n===== 2. 模型就绪 =====')
  const ready = tts.isModelReady('aishell3')
  assert(ready, 'AIShell3 模型已下载并解压')
  if (!ready) { console.error('模型未就绪，无法继续'); process.exit(1) }

  // ===== 3. 流式合成（worker 线程池） =====
  console.log('\n===== 3. 流式合成 =====')
  const chunks = []
  const states = []
  const t0 = Date.now()
  const res = await tts.startStream(text, 'aishell3', 1.0, 5, {
    onChunk: (c) => {
      chunks.push(c)
      console.log(`  chunk[${c.index}] ${c.wav ? 'wav ' + (c.wav.length / 1024).toFixed(0) + 'KB' : 'err: ' + c.error}`)
    },
    onState: (s) => {
      states.push(s)
      if (s.type !== 'start') console.log(`  state: ${s.type}${s.done !== undefined ? ' ' + s.done + '/' + s.total : ''}`)
    },
    onError: (e) => { console.error('  ERROR:', e.error) },
  })
  console.log('  startStream 返回:', JSON.stringify(res))

  // 等待 done / stopped
  await new Promise((resolve) => {
    const timer = setInterval(() => {
      if (states.some((s) => s.type === 'done') || states.some((s) => s.type === 'stopped')) {
        clearInterval(timer); resolve()
      }
    }, 200)
    setTimeout(() => { clearInterval(timer); resolve() }, 90000)
  })

  // ===== 4. 结果验证 =====
  console.log('\n===== 4. 结果验证 =====')
  const totalMs = Date.now() - t0
  console.log('  总耗时:', totalMs, 'ms | 段落数:', segs.length, '| 工作线程: up to 4')
  const idxs = chunks.map((c) => c.index)
  assert(idxs.every((v, i) => v === i), 'chunk 按段落顺序保序输出')
  assert(chunks.every((c) => c.wav && c.wav.length > 88), '每段均返回有效 wav')
  assert(chunks.length === segs.length, `chunk 数(${chunks.length})与段落数(${segs.length})一致`)
  assert(states.some((s) => s.type === 'done'), '收到 done 完成事件')
  console.log('  状态序列:', states.map((s) => s.type).join(' -> '))
  const audioSecs = chunks.reduce((sum, c) => sum + (c.wav ? (c.wav.length - 44) / 2 / 8000 : 0), 0)
  console.log('  合成音频总时长:', audioSecs.toFixed(1), '秒 @8000Hz')

  console.log('\n===== 结论 =====')
  if (failed === 0) console.log('  全部通过 ✓')
  else { console.error(`  有 ${failed} 项失败 ✗`); process.exit(1) }
}

main().catch((e) => { console.error('脚本异常:', e); process.exit(1) })
