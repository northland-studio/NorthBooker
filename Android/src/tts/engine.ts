// TTS 引擎抽象：系统引擎（系统 TTS）+ 离线引擎（react-native-sherpa-onnx）
// 所有模型文件通过服务器 CDN 代理下载（见 models.ts / update/index.ts）
import { NativeModules, Platform } from 'react-native'
import * as RNFS from '@dr.pogodin/react-native-fs'
import { TtsModel } from './models'

export interface SpeakOptions {
  speed?: number
  sid?: number
  onProgress?: (done: number, total: number, chunk: string) => void
}

export interface TtsEngine {
  readonly kind: 'system' | 'sherpa'
  isReady(): Promise<boolean>
  speak(text: string, opts?: SpeakOptions): Promise<{ count: number; skipped: number }>
  stop(): Promise<void>
  destroy(): Promise<void>
}

// 原生模块：系统 TTS 朗读 / WAV 播放 / APK 安装（Kotlin 实现）
interface NorthBookerNative {
  systemSpeakChunk(text: string, speed: number, utteranceId: string): Promise<void>
  systemStop(): void
  systemTtsAvailable(): Promise<boolean>
  playWav(path: string, token: string): Promise<void>
  stopPlayback(): void
  installApk(filePath: string): Promise<boolean>
}

function native(): NorthBookerNative | null {
  const m = NativeModules.NorthBooker as NorthBookerNative | undefined
  return m ?? null
}

// 按句号/逗号/分号/换行切分文本（与桌面端逻辑一致）
export function splitText(text: string): string[] {
  const segments: string[] = []
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

function hasChinese(text: string): boolean {
  const zh = (text.match(/[\u4e00-\u9fff]/g) || []).length
  return zh >= 10 || zh / Math.max(text.length, 1) >= 0.2
}

const MAX_SEGMENTS = 600

// ===== 系统 TTS 引擎（开箱即用，无需下载模型） =====
export class SystemTtsEngine implements TtsEngine {
  readonly kind = 'system' as const
  private stopped = false

  async isReady(): Promise<boolean> {
    const n = native()
    if (!n) return false
    try {
      return await n.systemTtsAvailable()
    } catch {
      return false
    }
  }

  async speak(text: string, opts: SpeakOptions = {}): Promise<{ count: number; skipped: number }> {
    const n = native()
    if (!n) throw new Error('原生模块不可用')
    this.stopped = false
    const speed = opts.speed ?? 1.0
    const raw = splitText(text)
    // 系统 TTS 不做中文过滤（可朗读英文）
    const segments = raw.slice(0, MAX_SEGMENTS)
    const total = segments.length
    let done = 0
    for (const seg of segments) {
      if (this.stopped) break
      await n.systemSpeakChunk(seg, speed, `nb-${Date.now()}-${done}`)
      done++
      opts.onProgress?.(done, total, seg)
    }
    return { count: done, skipped: raw.length - segments.length }
  }

  async stop(): Promise<void> {
    this.stopped = true
    native()?.systemStop()
  }

  async destroy(): Promise<void> {
    await this.stop()
  }
}

// ===== 离线 sherpa 引擎（需先通过 CDN 下载并解压模型） =====
export class SherpaTtsEngine implements TtsEngine {
  readonly kind = 'sherpa' as const
  private engine: any = null
  private stopped = false
  private wavSeq = 0

  constructor(private modelDir: string, private supportsEnglish: boolean) {}

  private async getSherpa(): Promise<any> {
    if (!this.engine) {
      // 动态引入重型原生模块，加载失败时由上层回退系统引擎
      const mod = require('react-native-sherpa-onnx/tts')
      const { createTTS } = mod
      this.engine = await createTTS({
        modelPath: { type: 'file', path: this.modelDir },
        modelType: 'auto',
        numThreads: 4,
      })
    }
    return this.engine
  }

  async isReady(): Promise<boolean> {
    try {
      await this.getSherpa()
      return true
    } catch {
      return false
    }
  }

  async speak(text: string, opts: SpeakOptions = {}): Promise<{ count: number; skipped: number }> {
    const n = native()
    if (!n) throw new Error('原生模块不可用')
    const sherpa = require('react-native-sherpa-onnx/tts')
    const { createTTS, saveAudioToFile } = sherpa
    const engine = await this.getSherpa()
    this.stopped = false

    const raw = splitText(text)
    const segments = (this.supportsEnglish ? raw : raw.filter(hasChinese)).slice(0, MAX_SEGMENTS)
    const skipped = raw.length - segments.length
    if (!segments.length) {
      return { count: 0, skipped }
    }

    const total = segments.length
    let done = 0
    for (const seg of segments) {
      if (this.stopped) break
      const audio = await engine.generateSpeech(seg, {
        sid: opts.sid ?? 0,
        speed: opts.speed ?? 1.0,
      })
      const wavPath = `${RNFS.CachesDirectoryPath}/nb-tts-${this.wavSeq++}.wav`
      await saveAudioToFile(audio, wavPath)
      if (this.stopped) break
      await n.playWav(wavPath, `nb-play-${done}`)
      done++
      opts.onProgress?.(done, total, seg)
    }
    return { count: done, skipped }
  }

  async stop(): Promise<void> {
    this.stopped = true
    native()?.stopPlayback()
  }

  async destroy(): Promise<void> {
    await this.stop()
    if (this.engine?.destroy) {
      try {
        await this.engine.destroy()
      } catch {}
      this.engine = null
    }
  }
}

// 工厂：按设置创建引擎；sherpa 引擎初始化失败时回退系统引擎
export async function createEngine(
  kind: 'system' | 'sherpa',
  modelDir?: string,
  supportsEnglish?: boolean,
): Promise<TtsEngine> {
  if (kind === 'sherpa' && modelDir && Platform.OS === 'android') {
    try {
      const e = new SherpaTtsEngine(modelDir, supportsEnglish ?? false)
      if (await e.isReady()) return e
    } catch (err) {
      console.warn('[TTS] sherpa 引擎不可用，回退系统引擎:', err)
    }
  }
  return new SystemTtsEngine()
}
