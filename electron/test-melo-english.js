// 验证 Melo 双语模型朗读纯英文（不应被过滤）
const path = require('path')
const electronMock = { app: { getPath: () => path.join(process.env.APPDATA || '', 'northbooker-desktop') } }
require.cache[require.resolve('electron')] = { id: require.resolve('electron'), filename: require.resolve('electron'), loaded: true, exports: electronMock }
const tts = require('./tts.js')

const englishText = 'Hello world, this is a pure English sentence for testing the bilingual model.'

function run(model, text) {
  return new Promise((resolve) => {
    const chunks = []
    tts.startStream(text, model, 1.0, 0, {
      onChunk: (c) => { if (c.wav) chunks.push(c.wav) },
      onState: (s) => { if (s.type === 'done' || s.type === 'stopped') resolve(chunks) },
      onError: (e) => resolve({ err: e.error, chunks }),
    })
  })
}

;(async () => {
  const rMelo = await run('melo-zh-en', englishText)
  const rAis = await run('aishell3', englishText)
  console.log('melo english chunks:', Array.isArray(rMelo) ? rMelo.length + ' wav KB=' + Math.round(rMelo.reduce((s, c) => s + c.length, 0) / 1024) : JSON.stringify(rMelo))
  console.log('aishell3 english:', JSON.stringify(rAis))
  process.exit(0)
})()
