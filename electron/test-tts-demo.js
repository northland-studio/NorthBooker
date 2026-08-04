// AIShell3 语音合成演示：合成一段中文音频保存到桌面
// 运行: node test-tts-demo.js
const sherpa = require('sherpa-onnx-node')
const path = require('path')
const os = require('os')

async function main() {
  const dir = path.join(process.env.APPDATA, 'northbooker-desktop', 'tts-models', 'vits-zh-aishell3')
  const config = {
    model: {
      vits: {
        model: path.join(dir, 'vits-aishell3.onnx'),
        tokens: path.join(dir, 'tokens.txt'),
        lexicon: path.join(dir, 'lexicon.txt'),
      },
      debug: false,
      numThreads: 2,
      provider: 'cpu',
    },
    maxNumSentences: 2,
  }
  console.log('加载模型...')
  const t0 = Date.now()
  const tts = await sherpa.OfflineTts.createAsync(config)
  console.log('模型加载完成，耗时', Date.now() - t0, 'ms')

  const text = '你好，我是北牖。这是 AIShell3 语音合成模型的演示音频，支持多种中文音色，可以完全离线运行在你的电脑上。'
  const genCfg = new sherpa.GenerationConfig({ sid: 0, speed: 1.0, silenceScale: 0.2 })
  const t1 = Date.now()
  const audio = await tts.generateAsync({
    text,
    generationConfig: genCfg,
    onProgress: () => 1,
  })
  const out = path.join(os.homedir(), 'Desktop', 'tts-demo-aishell3.wav')
  sherpa.writeWave(out, { samples: audio.samples, sampleRate: audio.sampleRate })
  console.log('合成完成，耗时', Date.now() - t1, 'ms')
  console.log('已保存:', out)
  console.log('音频时长:', (audio.samples.length / audio.sampleRate).toFixed(2), '秒 | 采样率:', audio.sampleRate, 'Hz')
}
main().catch((e) => { console.error('错误:', e.message.split('\n')[0]); process.exit(1) })
