// 真实 Electron 主进程环境：调用 tts.js 的完整 startStream（fork + node.exe）
// 运行: npx electron test-electron-main.js
const { app } = require('electron')
const path = require('path')

// 模拟真实应用 userData 路径（避免默认 Electron 目录）
app.setPath('userData', path.join(process.env.APPDATA || '', 'northbooker-desktop'))

app.whenReady().then(async () => {
  const tts = require('./tts.js')
  const text =
    '这是北牖桌面版的离线语音合成完整链路测试。第一句结束。' +
    '这是第二句话，验证流式分段合成是否正常。' +
    '第三句继续朗读，检查并行预合成与保序输出。' +
    '最后一句，测试完成。'

  const chunks = []
  const states = []
  const res = await tts.startStream(text, 'aishell3', 1.0, 5, {
    onChunk: (c) => {
      chunks.push(c)
      console.log(`[em] chunk[${c.index}] ${c.wav ? (c.wav.length / 1024).toFixed(0) + 'KB' : 'err:' + c.error}`)
    },
    onState: (s) => {
      states.push(s)
      if (s.type !== 'start') console.log(`[em] state: ${s.type}${s.done !== undefined ? ' ' + s.done + '/' + s.total : ''}`)
    },
    onError: (e) => console.log('[em] ERROR:', e.error),
  })
  console.log('[em] startStream 返回:', JSON.stringify(res))

  await new Promise((resolve) => {
    const timer = setInterval(() => {
      if (states.some((s) => s.type === 'done') || states.some((s) => s.type === 'stopped')) {
        clearInterval(timer); resolve()
      }
    }, 200)
    setTimeout(() => { clearInterval(timer); resolve() }, 120000)
  })

  const ok = chunks.length > 0 && chunks.every((c) => c.wav) && states.some((s) => s.type === 'done')
  console.log('[em]', ok ? '完整链路通过 ✓' : '完整链路失败 ✗')
  console.log('[em] chunks =', chunks.length, '| states =', states.map((s) => s.type).join('->'))
  app.exit(ok ? 0 : 1)
})
