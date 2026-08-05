// 检查更新：元数据来自服务器（七牛 CDN 代理），APK 仅通过 CDN 下载
import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { checkUpdate, downloadApk, installApk } from '../update'
import { AndroidUpdateInfo } from '../api/updates'
import { APP_VERSION_NAME, APP_VERSION_CODE } from '../config'
import { useSettings } from '../store/settings'
import { getColors } from '../theme'

type Phase = 'idle' | 'checking' | 'downloading' | 'ready' | 'installing'

export default function UpdateScreen() {
  const { mode } = useSettings()
  const c = getColors(mode)
  const [phase, setPhase] = useState<Phase>('idle')
  const [info, setInfo] = useState<AndroidUpdateInfo | null>(null)
  const [percent, setPercent] = useState(0)
  const [apkPath, setApkPath] = useState('')
  const [error, setError] = useState('')

  const onCheck = async () => {
    setPhase('checking')
    setError('')
    try {
      const res = await checkUpdate()
      if (res.hasUpdate && res.info) {
        setInfo(res.info)
        setPhase('idle')
      } else if (res.error) {
        setError(res.error)
        setPhase('idle')
      } else {
        setInfo(null)
        Alert.alert('已是最新版本', `当前版本 ${APP_VERSION_NAME}（${APP_VERSION_CODE}）`)
        setPhase('idle')
      }
    } catch (e: any) {
      setError(e?.message || '检查失败')
      setPhase('idle')
    }
  }

  const onDownload = async () => {
    if (!info) return
    setPhase('downloading')
    setPercent(0)
    try {
      const path = await downloadApk(info, (p) => setPercent(p))
      setApkPath(path)
      setPhase('ready')
    } catch (e: any) {
      setError(e?.message || '下载失败')
      setPhase('idle')
    }
  }

  const onInstall = async () => {
    if (!apkPath) return
    setPhase('installing')
    try {
      const ok = await installApk(apkPath)
      if (!ok) {
        setError('未能打开安装器，请检查“安装未知应用”权限')
        setPhase('ready')
      }
    } catch (e: any) {
      setError(e?.message || '安装失败')
      setPhase('idle')
    }
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>北牖 Android 更新</Text>
        <Text style={[styles.sub, { color: c.subText }]}>
          当前版本 {APP_VERSION_NAME}（{APP_VERSION_CODE}）· 更新包仅通过 CDN 分发
        </Text>
        <TouchableOpacity style={[styles.btn, { backgroundColor: c.primary }]} onPress={onCheck} disabled={phase === 'checking'}>
          {phase === 'checking' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnText}>检查更新</Text>
          )}
        </TouchableOpacity>
      </View>

      {info && (
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.version, { color: c.text }]}>发现新版本 v{info.versionName}</Text>
          <Text style={[styles.sub, { color: c.subText }]}>发布于 {info.publishAt || '未知'}</Text>
          {(info.notes || []).map((n, i) => (
            <Text key={i} style={[styles.note, { color: c.text }]}>· {n}</Text>
          ))}
          {phase === 'downloading' ? (
            <View style={styles.progressBox}>
              <ActivityIndicator color={c.primary} />
              <Text style={[styles.progText, { color: c.primary }]}>{Math.round(percent)}%</Text>
            </View>
          ) : phase === 'ready' ? (
            <TouchableOpacity style={[styles.btn, { backgroundColor: c.success }]} onPress={onInstall}>
              <Text style={styles.btnText}>立即安装</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.btn, { backgroundColor: c.primary }]} onPress={onDownload}>
              <Text style={styles.btnText}>下载并安装</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {!!error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { margin: 16, borderRadius: 12, padding: 16, borderWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 18, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 6 },
  version: { fontSize: 17, fontWeight: '700' },
  note: { fontSize: 13, marginTop: 6 },
  btn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  progressBox: { marginTop: 16, alignItems: 'center' },
  progText: { fontSize: 13, marginTop: 6 },
  error: { fontSize: 13, marginHorizontal: 16, marginBottom: 16 },
})
