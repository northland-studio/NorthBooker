// TTS 合成子进程（由 child_process.fork 启动，env 含 ELECTRON_RUN_AS_NODE=1，纯 Node 环境）
// 说明：sherpa-onnx-node 的 generate() 返回音频依赖 Node-API external buffer，
// Electron 环境（含 worker 线程）禁止创建 external buffer，而纯 Node 环境正常。
// 因此用 fork 起独立 Node 子进程执行推理，通过 IPC 与主进程通信。
const fs = require('fs')
const path = require('path')
const LOG = path.join(process.env.TEMP || '.', 'tts-worker.log')
function log(msg) {
  try { fs.appendFileSync(LOG, new Date().toISOString() + ' ' + msg + '\n') } catch {}
}
log('worker started, pid=' + process.pid + ', execPath=' + process.execPath + ', node=' + process.version)

const sherpa = require('sherpa-onnx-node')
log('sherpa loaded')

let tts = null

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

process.on('message', (msg) => {
  log('got message: ' + (msg && msg.type))
  if (!msg || typeof msg !== 'object') return
  if (msg.type === 'init') {
    try {
      log('building OfflineTts...')
      tts = new sherpa.OfflineTts(msg.config)
      log('OfflineTts OK, numSpeakers=' + tts.numSpeakers)
      process.send({ type: 'ready', numSpeakers: tts.numSpeakers })
    } catch (e) {
      log('OfflineTts failed: ' + (e.message || e))
      process.send({ type: 'ready', error: e.message || String(e) })
    }
    return
  }
  if (msg.type === 'synth' && tts) {
    try {
      const genCfg = new sherpa.GenerationConfig({
        sid: Number(msg.sid) || 0,
        speed: Number(msg.speed) || 1.0,
        silenceScale: 0.2,
      })
      log('generating... text.len=' + String(msg.text || '').length)
      const audio = tts.generate({ text: msg.text, generationConfig: genCfg })
      log('generate done, samples=' + (audio && audio.samples ? audio.samples.length : 'none'))
      if (!audio || !audio.samples || !audio.samples.length) {
        process.send({ type: 'result', id: msg.id, ok: false, error: '无音频输出' })
        return
      }
      const wav = encodeWav(audio.samples, audio.sampleRate)
      process.send({ type: 'result', id: msg.id, ok: true, wav: wav.toString('base64') })
    } catch (e) {
      log('synth failed: ' + (e.message || e))
      process.send({ type: 'result', id: msg.id, ok: false, error: e.message || String(e) })
    }
  }
})
