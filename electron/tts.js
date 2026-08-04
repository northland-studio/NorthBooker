// TTS 离线语音合成引擎（sherpa-onnx，主进程）
// 模型按需下载到 userData/tts-models，来源 k2-fsa/sherpa-onnx 官方 tts-models release
const { app } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')
const { execFileSync } = require('child_process')

// 可用音色模型（edge 为系统内置，不在此列）
// 主源 GitHub Releases，备源后端代理（七牛私有空间签名下载，国内速度快）
// 注意：官方 release 里部分模型包缺少引擎必需的数据文件
// （phontab/espeak-ng-data），无法直接加载，故只收录已验证可用的模型。
const CDN_PROXY = 'https://northbooker.xuanjian.top/api/updates/files/'
const TTS_MODELS = [
  {
    id: 'melo-zh-en',
    name: 'MeloTTS 中英双语',
    speakers: 1,
    urls: [
      'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-melo-tts-zh_en.tar.bz2',
      CDN_PROXY + 'vits-melo-tts-zh_en.tar.bz2',
    ],
    archive: 'vits-melo-tts-zh_en.tar.bz2',
    dir: 'vits-melo-tts-zh_en',
  },
  {
    id: 'theresa',
    name: 'Theresa（804 音色）',
    speakers: 804,
    urls: [
      'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-zh-hf-theresa.tar.bz2',
      CDN_PROXY + 'vits-zh-hf-theresa.tar.bz2',
    ],
    archive: 'vits-zh-hf-theresa.tar.bz2',
    dir: 'vits-zh-hf-theresa',
  },
  {
    id: 'aishell3',
    name: 'AIShell3（中文多音色）',
    speakers: 174,
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

// 构建模型配置（自动探测 onnx 模型文件）
// 说明：sherpa-onnx 的 vits 模型只需 model/tokens/lexicon 即可加载；
// 不要设置 dataDir/dictDir——那需要 espeak-ng-data 格式数据，而 jieba 的 dict/ 目录不是该格式，
// 误设会导致加载失败（如 vits-zh-hf-fanchen-C 缺 phontab 报错的根因）。
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
  return {
    model: { vits, debug: false, numThreads: 2, provider: 'cpu' },
    maxNumSentences: 2,
  }
}

// ===== 流式分段合成（child_process.fork 子进程池 + 并行预合成） =====
// 说明：sherpa-onnx-node 的 generate() 返回音频依赖 Node-API external buffer，
// Electron 内置 V8 禁止创建 external buffer（主进程 / worker / ELECTRON_RUN_AS_NODE 均受限），
// 只有真正的 node.exe 才允许。因此 fork 时必须显式指定 execPath 为 node.exe，
// 子进程在纯 Node 环境执行推理，通过 IPC 回传 wav；多个子进程并行，主进程不阻塞。
const { fork } = require('child_process')

let streamState = null
let workerSeq = 0

// 定位可用的 node.exe：优先打包附带的 resources/node/node(.exe)，其次系统 PATH 中的 node
function findNodeExe() {
  const bundled =
    process.resourcesPath &&
    path.join(process.resourcesPath, 'node', process.platform === 'win32' ? 'node.exe' : 'node')
  if (bundled && fs.existsSync(bundled)) return bundled
  try {
    const out = execFileSync(process.platform === 'win32' ? 'where' : 'which', ['node'], { encoding: 'utf8' })
    const exe = out.trim().split(/\r?\n/)[0]
    if (exe && fs.existsSync(exe)) return exe
  } catch {}
  return process.execPath // 兜底（Electron 下会失败，但至少不崩）
}

// worker 脚本路径：dev 在 __dirname；打包后 tts-worker.js 被 asarUnpack 到 app.asar.unpacked
function workerScriptPath() {
  if (app.isPackaged && process.resourcesPath) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'tts-worker.js')
  }
  return path.join(__dirname, 'tts-worker.js')
}

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

// 判断文本是否含足够中文（纯中文模型无法朗读英文，AIShell3/Theresa 适用）
function hasChinese(text) {
  const zh = (text.match(/[\u4e00-\u9fff]/g) || []).length
  return zh >= 10 || zh / Math.max(text.length, 1) >= 0.2
}

// 模型是否支持英文（中英双语模型无需中文过滤）
function supportsEnglish(modelId) {
  return modelId === 'melo-zh-en'
}

function createWorker(config) {
  return new Promise((resolve, reject) => {
    const child = fork(workerScriptPath(), [], {
      execPath: findNodeExe(),
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    })
    const timer = setTimeout(() => { child.kill(); reject(new Error('模型加载超时')) }, 60000)
    child.on('message', (m) => {
      if (m && m.type === 'ready') {
        clearTimeout(timer)
        if (m.error) reject(new Error(m.error))
        else resolve(child)
      }
    })
    child.on('error', (e) => { clearTimeout(timer); reject(e) })
    child.send({ type: 'init', config })
  })
}

function synthInWorker(child, text, speed, sid) {
  return new Promise((resolve) => {
    const id = ++workerSeq
    const onMsg = (m) => {
      if (m && m.type === 'result' && m.id === id) {
        child.off('message', onMsg)
        resolve({ ok: !!m.ok, wav: m.wav, error: m.error })
      }
    }
    child.on('message', onMsg)
    child.send({ type: 'synth', id, text, speed, sid })
  })
}

// 开始流式朗读：切分段落 → 子进程并行预合成 → 按序推送 chunk
async function startStream(text, modelId, speed, sid, handlers) {
  stopStream()
  const rawSegments = splitText(text)
  // 纯中文模型过滤掉几乎不含中文的段落（否则英文部分静音）；双语模型（Melo）不过滤
  const segments = supportsEnglish(modelId) ? rawSegments : rawSegments.filter(hasChinese)
  const skipped = rawSegments.length - segments.length
  if (!segments.length) {
    handlers.onState?.({ type: 'done', total: 0 })
    return {
      count: 0,
      skipped,
      error: '内容主要为英文/数字，当前中文模型无法朗读，请切换 Edge 内置或 MeloTTS 双语模型',
    }
  }
  // 限制单次朗读的段落数，超长文档截断（多池并行，上限放宽）
  const MAX_SEGMENTS = 600
  const truncated = segments.length > MAX_SEGMENTS
  const active = truncated ? segments.slice(0, MAX_SEGMENTS) : segments
  let config
  try {
    config = buildConfig(modelId)
  } catch (e) {
    handlers.onError?.({ error: e.message || String(e) })
    return { error: e.message || String(e) }
  }
  const workerCount = Math.max(1, Math.min(4, active.length))
  const workers = []
  for (let i = 0; i < workerCount; i++) {
    try {
      workers.push(await createWorker(config))
    } catch (e) {
      for (const w of workers) w.kill()
      handlers.onError?.({ error: '模型加载失败: ' + (e.message || e) })
      return { error: e.message || String(e) }
    }
  }
  // 各池（A/B/C/D）状态：轮询分配段号，每池记录已分配总数、已完成数、当前合成段
  const POOL_NAMES = ['A', 'B', 'C', 'D']
  const pools = workers.map((_, i) => ({
    id: i,
    name: POOL_NAMES[i],
    total: 0,
    done: 0,
    current: null,
  }))
  // 预计算每池分配段数（index % workerCount 分布）
  for (let idx = 0; idx < active.length; idx++) {
    pools[idx % workerCount].total++
  }
  const state = {
    segments: active,
    workers,
    pools,
    speed: Number(speed) || 1.0,
    sid: Number(sid) || 0,
    handlers,
    expectedIndex: 0,
    results: new Map(),
    stopped: false,
    total: active.length,
    nextIndex: 0,
    t0: Date.now(),
  }
  streamState = state
  console.log(
    `[TTS] 开始流式朗读: ${active.length} 段 | ${workerCount} 子进程(池 ${pools.map((p) => p.name).join('')}) | 语速 ${state.speed} | 音色 sid ${state.sid}` +
      (skipped ? ` | 跳过无中文段落 ${skipped} 段` : '') +
      (truncated ? ` | 截断 ${segments.length - MAX_SEGMENTS} 段` : ''),
  )
  handlers.onState?.({ type: 'start', total: active.length, pools })

  function poolState() {
    return state.pools.map((p) => ({ ...p }))
  }

  function pump() {
    while (state.results.has(state.expectedIndex)) {
      const msg = state.results.get(state.expectedIndex)
      state.results.delete(state.expectedIndex)
      if (msg.ok) state.handlers.onChunk?.({ index: state.expectedIndex, wav: msg.wav })
      else state.handlers.onChunk?.({ index: state.expectedIndex, error: msg.error })
      state.expectedIndex++
      state.handlers.onState?.({ type: 'progress', done: state.expectedIndex, total: state.total, pools: poolState() })
    }
    if (state.expectedIndex >= state.total) {
      const totalSec = ((Date.now() - state.t0) / 1000).toFixed(1)
      console.log(`[TTS] 全部 ${state.total} 段合成完成，总耗时 ${totalSec}s`)
      state.handlers.onState?.({ type: 'done', total: state.total, pools: poolState() })
      cleanupStream(state)
    }
  }

  const launch = async () => {
    if (state.stopped || state.nextIndex >= state.total) return
    const index = state.nextIndex++
    const worker = state.workers[index % state.workers.length]
    const pool = state.pools[index % state.pools.length]
    pool.current = index + 1
    const t0 = Date.now()
    console.log(`[TTS] 段 ${index + 1}/${state.total} 开始合成 (池 ${pool.name})`)
    let msg
    try {
      msg = await Promise.race([
        synthInWorker(worker, state.segments[index], state.speed, state.sid),
        new Promise((_, rej) => setTimeout(() => rej(new Error('合成超时')), 30000)),
      ])
    } catch (e) {
      msg = { ok: false, error: e.message || String(e) }
    }
    const cost = ((Date.now() - t0) / 1000).toFixed(1)
    pool.current = null
    pool.done++
    if (msg.ok) {
      console.log(`[TTS] 段 ${index + 1}/${state.total} 完成 ${(msg.wav.length / 1024).toFixed(0)}KB (${cost}s)`)
    } else {
      console.error(`[TTS] 段 ${index + 1}/${state.total} 失败: ${msg.error}`)
    }
    state.results.set(index, msg)
    pump()
    launch()
  }

  for (let i = 0; i < Math.min(workerCount, active.length); i++) launch()
  return { count: active.length, skipped, truncated: truncated ? segments.length - MAX_SEGMENTS : 0 }
}

function cleanupStream(state) {
  if (streamState === state) streamState = null
  for (const w of state.workers) { try { w.kill() } catch {} }
}

function stopStream() {
  if (streamState) {
    const s = streamState
    streamState = null
    s.stopped = true
    console.log('[TTS] 朗读已停止')
    s.handlers.onState?.({ type: 'stopped' })
    for (const w of s.workers) { try { w.kill() } catch {} }
  }
}

module.exports = { TTS_MODELS, isModelReady, ensureModel, splitText, startStream, stopStream }
