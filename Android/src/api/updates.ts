// 更新相关 API（CDN 代理）
import { request } from './client'

// 服务器从七牛 releases/android/latest.json 读取的 Android 更新元数据
export interface AndroidUpdateInfo {
  versionName: string
  versionCode: number
  apkFile: string // 文件名，如 northbooker-1.1.0.apk（七牛 key: releases/android/<apkFile>）
  url: string // 下载地址（服务器 /api/updates/files/... 代理 → 302 到 CDN 签名 URL）
  notes: string[]
  publishAt: string
}

export function fetchAndroidUpdateMeta(): Promise<AndroidUpdateInfo> {
  return request<AndroidUpdateInfo>('/updates/android/latest.json', { auth: false })
}
