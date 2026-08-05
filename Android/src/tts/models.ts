// TTS 离线模型清单（与桌面版 tts.js 保持一致）
// 所有模型文件仅通过服务器 CDN 代理下载（七牛私有空间签名 URL），不使用 GitHub。
import { CDN_FILE_PROXY } from '../config'

export interface TtsModel {
  id: string
  name: string
  archive: string // 七牛 releases/<archive> 下的文件名
  dir: string // 解压后的目录名
  speakers: number
  sampleRate: number
  supportsEnglish: boolean
  // 预估下载体积（MB，用于展示；0 表示未知）
  sizeMB: number
}

export const TTS_MODELS: TtsModel[] = [
  {
    id: 'melo-zh-en',
    name: 'MeloTTS 中英双语',
    archive: 'vits-melo-tts-zh_en.tar.bz2',
    dir: 'vits-melo-tts-zh_en',
    speakers: 1,
    sampleRate: 44100,
    supportsEnglish: true,
    sizeMB: 0,
  },
  {
    id: 'theresa',
    name: 'Theresa（804 音色）',
    archive: 'vits-zh-hf-theresa.tar.bz2',
    dir: 'vits-zh-hf-theresa',
    speakers: 804,
    sampleRate: 22050,
    supportsEnglish: false,
    sizeMB: 0,
  },
  {
    id: 'aishell3',
    name: 'AIShell3（中文多音色）',
    archive: 'vits-zh-aishell3.tar.bz2',
    dir: 'vits-zh-aishell3',
    speakers: 174,
    sampleRate: 22050,
    supportsEnglish: false,
    sizeMB: 0,
  },
]

export function modelCdnUrl(model: TtsModel): string {
  return CDN_FILE_PROXY + model.archive
}

export function getModel(id: string): TtsModel | undefined {
  return TTS_MODELS.find((m) => m.id === id)
}
