// TTS 离线语音合成引擎（sherpa-onnx，主进程）
// 模型按需下载到 userData/tts-models，来源 k2-fsa/sherpa-onnx 官方 tts-models release
const { app } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')
const { execFileSync } = require('child_process')

// 可用音色模型（edge 为系统内置，不在此列）
const TTS_MODELS = [
  {
    id: 'fanchen',
    name: '饭辰（中文女声）',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/sherpa-onnx-vits-zh-hf-fanchen-C.tar.bz2',
    archive: 'sherpa-onnx-vits-zh-hf-fanchen-C.tar.bz2',
    dir: 'sherpa-onnx-vits-zh-hf-fanchen-C',
  },
  {
    id: 'aishell3',
    name: 'AIShell3（中文多音色）',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/sherpa-onnx-vits-zh-llamaindex-aishell3.tar.bz2',
    archive: 'sherpa-onnx-vits-zh-llamaindex-aishell3.tar.bz2',
    dir: 'sherpa-onnx-vits-zh-llamaindex-aishell3',
  },
]

let sherpa = null
let tts = null
let ttsModelId = null

function modelsDir() {
  return path.join(app.getPath('userData'), 'tts-models')
}

function getModelDir(id) {
  const m = TTS_MODELS.find((x) => x.id === id)
  return m ? path.join(modelsDir(), m.dir) : null
}

function isModelReady(id) {
  const dir = getModelDir(id)
  return !!dir && fs.existsSync(path.join(dir, 'model.onnx'))
}

// 下载文件（跟随重定向，带进度回调）
function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath)
    const get = url.startsWith('https') ? https.get : require('http').get
    get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        downloadFile(res.headers.location, destPath, onProgress).then(resolve, reject)
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error('下载失败，HTTP ' + res.statusCode))
        return
      }
      const total = parseInt(res.headers['content-length'] || '0', 10)
      let received = 0
      res.on('data', (chunk) => {
        received += chunk.length
        if (total && onProgress) onProgress(Math.round((received / total) * 100))
      })
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
    }).on('error', (e) => { fs.unlink(destPath, () => {}); reject(e) })
  })
}

// 确保模型已下载并解压
async function ensureModel(id, onProgress) {
  const m = TTS_MODELS.find((x) => x.id === id)
  if (!m) throw new Error('未知模型: ' + id)
  const dir = modelsDir()
  fs.mkdirSync(dir, { recursive: true })
  if (isModelReady(id)) return
  const archivePath = path.join(dir, m.archive)
  if (!fs.existsSync(archivePath)) {
    await downloadFile(m.url, archivePath, onProgress)
  }
  // Windows 自带 bsdtar，支持 .tar.bz2
  execFileSync('tar', ['-xjf', archivePath, '-C', dir])
  fs.unlink(archivePath, () => {})
  if (!isModelReady(id)) throw new Error('模型解压失败，缺少 model.onnx')
}

function ensureSherpa() {
  if (!sherpa) sherpa = require('sherpa-onnx-node')
}

function initTts(id) {
  const dir = getModelDir(id)
  const vits = {
    model: path.join(dir, 'model.onnx'),
    tokens: path.join(dir, 'tokens.txt'),
  }
  if (fs.existsSync(path.join(dir, 'lexicon.txt'))) {
    vits.lexicon = path.join(dir, 'lexicon.txt')
  }
  const espeakDir = path.join(dir, 'espeak-ng-data')
  const dataDir = path.join(dir, 'data')
  if (fs.existsSync(espeakDir)) vits.dictDir = espeakDir
  else if (fs.existsSync(dataDir)) vits.dataDir = dataDir
  const config = {
    model: { vits, debug: false, numThreads: 2, provider: 'cpu' },
    maxNumSentences: 2,
  }
  tts = new sherpa.OfflineTts(config)
  ttsModelId = id
}

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

// 合成文本 → { wav: base64 } 或 { error }
function synthesize(text, modelId, speed) {
  try {
    ensureSherpa()
    if (!isModelReady(modelId)) {
      return { error: '模型未就绪，请先在设置中下载' }
    }
    if (!tts || ttsModelId !== modelId) initTts(modelId)
    const genCfg = new sherpa.GenerationConfig({
      sid: 0,
      speed: Number(speed) || 1.0,
      silenceScale: 0.2,
    })
    const audio = tts.generate({ text, generationConfig: genCfg })
    if (!audio || !audio.samples || audio.samples.length === 0) {
      return { error: '合成失败：无音频输出' }
    }
    const wav = encodeWav(audio.samples, audio.sampleRate)
    return { wav: wav.toString('base64') }
  } catch (e) {
    return { error: e.message || String(e) }
  }
}

module.exports = { TTS_MODELS, isModelReady, ensureModel, synthesize }
