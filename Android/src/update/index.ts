// 自动更新：仅使用 CDN 下载（服务器 /api/updates/files/:key → 302 到七牛签名 URL）
import { NativeModules } from 'react-native'
import * as RNFS from '@dr.pogodin/react-native-fs'
import { AndroidUpdateInfo, fetchAndroidUpdateMeta } from '../api/updates'
import { APP_VERSION_CODE, ANDROID_APK_PROXY } from '../config'

interface CheckResult {
  hasUpdate: boolean
  info: AndroidUpdateInfo | null
  currentVersionCode: number
  error?: string
}

export async function checkUpdate(): Promise<CheckResult> {
  try {
    const info = await fetchAndroidUpdateMeta()
    const remote = Number(info.versionCode) || 0
    return {
      hasUpdate: remote > APP_VERSION_CODE,
      info: remote > APP_VERSION_CODE ? info : null,
      currentVersionCode: APP_VERSION_CODE,
    }
  } catch (e: any) {
    return { hasUpdate: false, info: null, currentVersionCode: APP_VERSION_CODE, error: e.message || '检查更新失败' }
  }
}

export async function downloadApk(
  info: AndroidUpdateInfo,
  onProgress?: (percent: number, received: number, total: number) => void,
): Promise<string> {
  const url = `${ANDROID_APK_PROXY}${encodeURIComponent(info.apkFile)}`
  // 应用私有目录（避免 Android 10+ scoped storage 对共享 Download 目录的写入限制）
  const dir = `${RNFS.DocumentDirectoryPath}/updates`
  await RNFS.mkdir(dir)
  const destPath = `${dir}/${info.apkFile}`
  const ret = await RNFS.downloadFile({
    fromUrl: url,
    toFile: destPath,
    begin: (res) => {
      if (onProgress) onProgress(0, res.contentLength ? 0 : 0, res.contentLength || 0)
    },
    progress: (res) => {
      const pct = res.contentLength > 0 ? Math.min(100, (res.bytesWritten / res.contentLength) * 100) : 0
      if (onProgress) onProgress(pct, res.bytesWritten, res.contentLength)
    },
    progressDivider: 1,
  }).promise
  if (ret.statusCode !== 200) {
    throw new Error(`下载失败 (HTTP ${ret.statusCode})`)
  }
  return destPath
}

// 调用系统安装器安装 APK（manifest 已声明 REQUEST_INSTALL_PACKAGES + FileProvider）
export async function installApk(path: string): Promise<boolean> {
  const m = NativeModules.NorthBooker
  if (!m?.installApk) throw new Error('安装组件不可用')
  return (await m.installApk(path)) as boolean
}
