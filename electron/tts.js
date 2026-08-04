// TTS 离线语音合成引擎（sherpa-onnx，主进程）
// 模型按需下载到 userData/tts-models，来源 k2-fsa/sherpa-onnx 官方 tts-models release
const { app } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')
const { execFileSync } = require('child_process')

// 可用音色模型（edge 为系统内置，不在此列）
// 主源 GitHub Releases，备源后端代理（七牛私有空间签名下载，国内速度快）
// 注意：官方 release 里 vits-zh-hf-fanchen-C 等部分模型包缺少引擎必需的数据文件
// （phontab/espeak-ng-data），无法直接加载，故只收录已验证可用的模型。
const CDN_PROXY = 'https://northbooker.xuanjian.top/api/updates/files/'
const TTS_MODELS = [
  {
    id: 'aishell3',
    name: 'AIShell3（中文多音色）',
    urls: [
      'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-zh-aishell3.tar.bz2',
      CDN_PROXY + 'vits-zh-aishell3.tar.bz2',
    ],
    archive: 'vits-zh-aishell3.tar.bz2',
    dir: 'vits-zh-aishell3',
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
  if (!dir || !fs.existsSync(dir)) return false
  try {
    return fs.readdirSync(dir).some((f) => f.endsWith('.onnx'))
  } catch {
    return false
  }
}

// 目录内查找 onnx 模型文件（优先主模型，排除 int8 量化版）
function findOnnx(dir) {
  const files = fs.readdirSync(dir)
  return files.find((f) => f.endsWith('.onnx') && !f.includes('int8')) || files.find((f) => f.endsWith('.onnx'))
}

// 下载文件（跟随重定向，临时文件 + 重命名，带进度回调）
function downloadFile(url, destPath, onProgress) {
  const tmpPath = destPath + '.part'
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tmpPath)
    const cleanup = () => {
      try { file.destroy() } catch {}
      try { fs.unlinkSync(tmpPath) } catch {}
    }
    const get = url.startsWith('https') ? https.get : require('http').get
    get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        cleanup()
        downloadFile(res.headers.location, destPath, onProgress).then(resolve, reject)
        return
      }
      if (res.statusCode !== 200) {
        res.resume()
        cleanup()
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
      file.on('finish', () => {
        file.close(() => {
          try {
            fs.renameSync(tmpPath, destPath)
            resolve()
          } catch (e) {
            reject(e)
          }
        })
      })
    }).on('error', (e) => { cleanup(); reject(e) })
    file.on('error', (e) => { cleanup(); reject(e) })
  })
}

// 依次尝试多个下载源
async function downloadFromSources(urls, archivePath, onProgress) {
  let lastErr = null
  for (const u of urls) {
    try {
      await downloadFile(u, archivePath, onProgress)
      return
    } catch (e) {
      lastErr = e
      console.error('[TTS] 下载源失败:', u, e.message)
    }
  }
  throw lastErr || new Error('所有下载源均失败')
}

// 确保模型已下载并解压
async function ensureModel(id, onProgress) {
  const m = TTS_MODELS.find((x) => x.id === id)
  if (!m) throw new Error('未知模型: ' + id)
  const dir = modelsDir()
  fs.mkdirSync(dir, { recursive: true })
  if (isModelReady(id)) return
  const archivePath = path.join(dir, m.archive)
  // 清理损坏的下载残留（0 字节或未完成）
  try {
    if (fs.existsSync(archivePath) && fs.statSync(archivePath).size < 1024 * 1024) {
      fs.unlinkSync(archivePath)
    }
  } catch {}
  if (!fs.existsSync(archivePath)) {
    await downloadFromSources(m.urls, archivePath, onProgress)
  }
  // Windows 自带 bsdtar，支持 .tar.bz2
  execFileSync('tar', ['-xjf', archivePath, '-C', dir])
  try { fs.unlinkSync(archivePath) } catch {}
  if (!isModelReady(id)) throw new Error('模型解压失败，缺少 model.onnx')
}

function ensureSherpa() {
  if (!sherpa) sherpa = require('sherpa-onnx-node')
}

// 构建模型配置（自动探测 onnx 文件名与数据目录）
function buildConfig(id) {
  const dir = getModelDir(id)
  const onnxFile = findOnnx(dir)
  if (!onnxFile) throw new Error('模型目录缺少 onnx 文件')
  const vits = {
    model: path.join(dir, onnxFile),
    tokens: path.join(dir, 'tokens.txt'),
  }
  if (fs.existsSync(path.join(dir, 'lexicon.txt'))) {
    vits.lexicon = path.join(dir, 'lexicon.txt')
  }
  // 数据目录探测：espeak-ng-data → dictDir；dict/data → dataDir
  const espeakDir = path.join(dir, 'espeak-ng-data')
  const dataDir = path.join(dir, 'data')
  const dictDir = path.join(dir, 'dict')
  if (fs.existsSync(espeakDir)) vits.dictDir = espeakDir
  else if (fs.existsSync(dictDir)) vits.dataDir = dictDir
  else if (fs.existsSync(dataDir)) vits.dataDir = dataDir
  return {
    model: { vits, debug: false, numThreads: 2, provider: 'cpu' },
    maxNumSentences: 2,
  }
}

async function initTts(id) {
  const config = buildConfig(id)
  // 异步创建：不阻塞主进程
  tts = await sherpa.OfflineTts.createAsync(config)
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

// 合成文本 → { wav: base64 } 或 { error }（异步，不阻塞主进程）
async function synthesize(text, modelId, speed, onProgress) {
  try {
    ensureSherpa()
    if (!isModelReady(modelId)) {
      return { error: '模型未就绪，请先在设置中下载' }
    }
    if (!tts || ttsModelId !== modelId) await initTts(modelId)
    const genCfg = new sherpa.GenerationConfig({
      sid: 0,
      speed: Number(speed) || 1.0,
      silenceScale: 0.2,
    })
    const audio = await tts.generateAsync({
      text,
      enableExternalBuffer: true,
      generationConfig: genCfg,
      onProgress: (p) => {
        if (onProgress && p && typeof p.progress === 'number') {
          onProgress(Math.max(1, Math.round(p.progress * 100)))
        }
        return 1
      },
    })
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
