// TTS 合成 worker 线程：每个 worker 持有独立 OfflineTts 实例
// 注意：必须用同步 API（new OfflineTts + generate）——
// sherpa-onnx-node 的异步 API（createAsync/generateAsync）在 Electron 环境下 promise 不会 resolve，
// 同步阻塞只在 worker 线程内，不影响主进程。
const { parentPort, workerData } = require('worker_threads')
const sherpa = require('sherpa-onnx-node')

// Float32 PCM → WAV Buffer
function encodeWav(samples, sampleRate) {
  const pcm = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  const dataSize = pcm.length * 2
  const wav = Buffer.alloc(44 + dataSize)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(36 + dataSize, 4)
  wav.write('WAVE', 8)
  wav.write('fmt ', 12)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(sampleRate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(dataSize, 40)
  Buffer.from(pcm.buffer).copy(wav, 44)
  return wav
}

// 同步加载模型（阻塞当前 worker 线程，完成后通知主进程）
const tts = new sherpa.OfflineTts(workerData.config)
parentPort.postMessage({ ready: true })

parentPort.on('message', (req) => {
  if (!req || typeof req.id !== 'number') return
  try {
    const genCfg = new sherpa.GenerationConfig({
      sid: 0,
      speed: Number(req.speed) || 1.0,
      silenceScale: 0.2,
    })
    const audio = tts.generate({ text: req.text, generationConfig: genCfg })
    if (!audio || !audio.samples || !audio.samples.length) {
      parentPort.postMessage({ id: req.id, ok: false, error: '无音频输出' })
      return
    }
    const wav = encodeWav(audio.samples, audio.sampleRate)
    parentPort.postMessage({ id: req.id, ok: true, wav: wav.toString('base64') })
  } catch (e) {
    parentPort.postMessage({ id: req.id, ok: false, error: e.message || String(e) })
  }
})
