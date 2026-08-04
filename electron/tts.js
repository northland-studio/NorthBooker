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

// ===== 流式分段合成（worker 线程池 + 预合成） =====
const { Worker } = require('worker_threads')

let streamState = null
let workerSeq = 0

// 按句号/逗号/分号/换行切分文本为段落（每段约 20~200 字）
function splitText(text) {
  const segments = []
  let cur = ''
  for (const ch of String(text || '')) {
    cur += ch
    if (/[。！？；，、\n]/.test(ch) && cur.trim().length >= 20) {
      segments.push(cur.trim())
      cur = ''
    } else if (cur.trim().length >= 200) {
      segments.push(cur.trim())
      cur = ''
    }
  }
  if (cur.trim()) segments.push(cur.trim())
  return segments.filter((s) => s.length > 0)
}

function createWorker(config) {
  return new Promise((resolve, reject) => {
    const w = new Worker(path.join(__dirname, 'tts-worker.js'), { workerData: { config } })
    const timer = setTimeout(() => { w.terminate(); reject(new Error('模型加载超时')) }, 60000)
    w.once('message', (m) => {
      clearTimeout(timer)
      if (m && m.ready) resolve(w)
      else reject(new Error((m && m.error) || 'worker 初始化失败'))
    })
    w.once('error', (e) => { clearTimeout(timer); reject(e) })
  })
}

function synthInWorker(worker, text, speed) {
  return new Promise((resolve) => {
    const id = ++workerSeq
    const onMsg = (msg) => {
      if (msg && msg.id === id) {
        worker.off('message', onMsg)
        resolve(msg)
      }
    }
    worker.on('message', onMsg)
    worker.postMessage({ id, text, speed })
  })
}

// 开始流式朗读：切分段落 → 并行预合成 → 按序推送 chunk
async function startStream(text, modelId, speed, handlers) {
  stopStream()
  const segments = splitText(text)
  if (!segments.length) {
    handlers.onState?.({ type: 'done', total: 0 })
    return { count: 0 }
  }
  let config
  try {
    config = buildConfig(modelId)
  } catch (e) {
    handlers.onError?.({ error: e.message || String(e) })
    return { error: e.message || String(e) }
  }
  const workerCount = Math.max(1, Math.min(4, segments.length))
  const workers = []
  for (let i = 0; i < workerCount; i++) {
    try {
      workers.push(await createWorker(config))
    } catch (e) {
      for (const w of workers) w.terminate().catch(() => {})
      handlers.onError?.({ error: '模型加载失败: ' + (e.message || e) })
      return { error: e.message || String(e) }
    }
  }
  const state = {
    segments,
    workers,
    speed: Number(speed) || 1.0,
    handlers,
    expectedIndex: 0,
    results: new Map(),
    stopped: false,
    total: segments.length,
    nextIndex: 0,
  }
  streamState = state
  handlers.onState?.({ type: 'start', total: segments.length })

  function pump() {
    while (state.results.has(state.expectedIndex)) {
      const msg = state.results.get(state.expectedIndex)
      state.results.delete(state.expectedIndex)
      if (msg.ok) state.handlers.onChunk?.({ index: state.expectedIndex, wav: msg.wav })
      else state.handlers.onChunk?.({ index: state.expectedIndex, error: msg.error })
      state.expectedIndex++
      state.handlers.onState?.({ type: 'progress', done: state.expectedIndex, total: state.total })
    }
    if (state.expectedIndex >= state.total) {
      state.handlers.onState?.({ type: 'done', total: state.total })
      cleanupStream(state)
    }
  }

  const launch = async () => {
    if (state.stopped || state.nextIndex >= state.total) return
    const index = state.nextIndex++
    const worker = state.workers[index % state.workers.length]
    const msg = await synthInWorker(worker, state.segments[index], state.speed)
    state.results.set(index, msg)
    pump()
    launch()
  }

  for (let i = 0; i < Math.min(workerCount, segments.length); i++) launch()
  return { count: segments.length }
}

function cleanupStream(state) {
  if (streamState === state) streamState = null
  for (const w of state.workers) w.terminate().catch(() => {})
}

function stopStream() {
  if (streamState) {
    const s = streamState
    streamState = null
    s.stopped = true
    s.handlers.onState?.({ type: 'stopped' })
    for (const w of s.workers) w.terminate().catch(() => {})
  }
}

module.exports = { TTS_MODELS, isModelReady, ensureModel, splitText, startStream, stopStream }
