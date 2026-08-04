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

// ===== 流式分段合成（主进程同步推理 + 分段让出事件循环） =====
// 说明：sherpa-onnx-node 的 generate() 返回音频依赖 Node-API external buffer，
// Node-API 禁止在 worker 线程创建 external buffer（报 "External buffers are not allowed"），
// 异步 API（createAsync/generateAsync）在 Electron 下 promise 也不 resolve。
// 因此只能在主进程同步 generate：每段合成 1~3 秒阻塞主进程，
// 但播放发生在渲染进程（AudioContext），不受影响；段间 setImmediate 让出事件循环。
const sherpa = require('sherpa-onnx-node')

let streamState = null

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

// 判断文本是否含足够中文（AIShell3 为纯中文模型，英文/数字会被忽略）
function hasChinese(text) {
  const zh = (text.match(/[\u4e00-\u9fff]/g) || []).length
  return zh >= 10 || zh / Math.max(text.length, 1) >= 0.2
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

// 开始流式朗读：切分段落 → 主进程同步逐段合成 → 按序推送 chunk
async function startStream(text, modelId, speed, handlers) {
  stopStream()
  const rawSegments = splitText(text)
  // 过滤掉几乎不含中文的段落（纯中文模型无法朗读英文）
  const segments = rawSegments.filter(hasChinese)
  const skipped = rawSegments.length - segments.length
  if (!segments.length) {
    handlers.onState?.({ type: 'done', total: 0 })
    return {
      count: 0,
      skipped,
      error: '内容主要为英文/数字，当前中文模型无法朗读，请切换 Edge 内置模型',
    }
  }
  // 限制单次朗读的段落数，超长文档截断
  const MAX_SEGMENTS = 60
  const truncated = segments.length > MAX_SEGMENTS
  const active = truncated ? segments.slice(0, MAX_SEGMENTS) : segments
  let tts
  try {
    tts = new sherpa.OfflineTts(buildConfig(modelId))
  } catch (e) {
    handlers.onError?.({ error: '模型加载失败: ' + (e.message || e) })
    return { error: e.message || String(e) }
  }
  const state = {
    segments: active,
    tts,
    speed: Number(speed) || 1.0,
    handlers,
    expectedIndex: 0,
    results: new Map(),
    stopped: false,
    total: active.length,
    t0: Date.now(),
  }
  streamState = state
  console.log(
    `[TTS] 开始流式朗读: ${active.length} 段 | 主进程同步 | 语速 ${state.speed}` +
      (skipped ? ` | 跳过无中文段落 ${skipped} 段` : '') +
      (truncated ? ` | 截断 ${segments.length - MAX_SEGMENTS} 段` : ''),
  )
  handlers.onState?.({ type: 'start', total: active.length })

  // 同步合成单段
  function synthSync(seg, spd) {
    const genCfg = new sherpa.GenerationConfig({
      sid: 0,
      speed: Number(spd) || 1.0,
      silenceScale: 0.2,
    })
    const audio = state.tts.generate({ text: seg, generationConfig: genCfg })
    if (!audio || !audio.samples || !audio.samples.length) {
      return { ok: false, error: '无音频输出' }
    }
    const wav = encodeWav(audio.samples, audio.sampleRate)
    return { ok: true, wav: wav.toString('base64') }
  }

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
      const totalSec = ((Date.now() - state.t0) / 1000).toFixed(1)
      console.log(`[TTS] 全部 ${state.total} 段合成完成，总耗时 ${totalSec}s`)
      state.handlers.onState?.({ type: 'done', total: state.total })
      cleanupStream(state)
    }
  }

  // 逐段同步合成，段间让出事件循环（渲染进程播放不受影响）
  for (let i = 0; i < active.length; i++) {
    if (state.stopped) break
    const t0 = Date.now()
    console.log(`[TTS] 段 ${i + 1}/${state.total} 开始合成`)
    let msg
    try {
      msg = synthSync(active[i], state.speed)
    } catch (e) {
      msg = { ok: false, error: e.message || String(e) }
    }
    const cost = ((Date.now() - t0) / 1000).toFixed(1)
    if (msg.ok) {
      console.log(`[TTS] 段 ${i + 1}/${state.total} 完成 ${(msg.wav.length / 1024).toFixed(0)}KB (${cost}s)`)
    } else {
      console.error(`[TTS] 段 ${i + 1}/${state.total} 失败: ${msg.error}`)
    }
    state.results.set(i, msg)
    pump()
    // 让出事件循环，允许渲染进程刷新与后续 IPC
    await new Promise((r) => setImmediate(r))
  }
  return { count: active.length, skipped, truncated: truncated ? segments.length - MAX_SEGMENTS : 0 }
}

function cleanupStream(state) {
  if (streamState === state) streamState = null
}

function stopStream() {
  if (streamState) {
    const s = streamState
    streamState = null
    s.stopped = true
    console.log('[TTS] 朗读已停止')
    s.handlers.onState?.({ type: 'stopped' })
  }
}

module.exports = { TTS_MODELS, isModelReady, ensureModel, splitText, startStream, stopStream }
