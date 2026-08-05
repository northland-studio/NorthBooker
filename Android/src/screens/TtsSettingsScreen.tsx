// TTS 设置：引擎选择 + 离线模型管理（仅 CDN 下载）+ 语速/音色
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native'
import * as RNFS from '@dr.pogodin/react-native-fs'
import { listBundledArchives, extractArchive } from 'react-native-sherpa-onnx/extraction'
import { useSettings } from '../store/settings'
import { TTS_MODELS, TtsModel, modelCdnUrl } from '../tts/models'
import { createEngine, TtsEngine } from '../tts/engine'
import { getColors } from '../theme'

const MODELS_ROOT = RNFS.DocumentDirectoryPath + '/tts-models'

function modelDir(m: TtsModel): string {
  return `${MODELS_ROOT}/${m.dir}`
}

async function isModelDownloaded(m: TtsModel): Promise<boolean> {
  try {
    const dir = modelDir(m)
    if (!(await RNFS.exists(dir))) return false
    const files = await RNFS.readDir(dir)
    return files.some((f: { name: string }) => f.name.endsWith('.onnx'))
  } catch {
    return false
  }
}

export default function TtsSettingsScreen() {
  const { mode, tts, setTts } = useSettings()
  const c = getColors(mode)
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({})
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const engineRef = useRef<TtsEngine | null>(null)

  const refreshStatus = useCallback(async () => {
    const map: Record<string, boolean> = {}
    for (const m of TTS_MODELS) {
      map[m.id] = await isModelDownloaded(m)
    }
    setDownloaded(map)
  }, [])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  useEffect(() => {
    return () => {
      engineRef.current?.destroy().catch(() => {})
    }
  }, [])

  const downloadModel = async (m: TtsModel) => {
    setBusy(m.id)
    setProgress((p) => ({ ...p, [m.id]: 0 }))
    try {
      const archivePath = `${MODELS_ROOT}/${m.archive}`
      await RNFS.mkdir(MODELS_ROOT)
      const ret = await RNFS.downloadFile({
        fromUrl: modelCdnUrl(m),
        toFile: archivePath,
        progress: (res) => {
          const pct = res.contentLength > 0 ? Math.min(100, (res.bytesWritten / res.contentLength) * 100) : 0
          setProgress((p) => ({ ...p, [m.id]: pct }))
        },
        progressDivider: 1,
      }).promise
      if (ret.statusCode !== 200) throw new Error(`下载失败 (HTTP ${ret.statusCode})`)
      // 使用 sherpa 内置 libarchive 解压 .tar.bz2（文件仅来自 CDN）
      const archives = await listBundledArchives(MODELS_ROOT)
      const archive = archives.find((a) => a.modelId === m.dir)
      if (!archive) throw new Error('未找到模型压缩包')
      const result = await extractArchive(archive, MODELS_ROOT, {
        force: true,
        onProgress: (e) => setProgress((p) => ({ ...p, [m.id]: e.percent })),
      })
      if (!result.success) throw new Error(result.reason || '模型解压失败')
      await RNFS.unlink(archivePath).catch(() => {})
      await refreshStatus()
      Alert.alert('完成', `已下载并解压 ${m.name}`)
    } catch (e: any) {
      Alert.alert('下载失败', e?.message || '请检查网络后重试')
    } finally {
      setBusy(null)
      setProgress((p) => ({ ...p, [m.id]: 0 }))
    }
  }

  const deleteModel = async (m: TtsModel) => {
    Alert.alert('删除模型', `确定删除 ${m.name}？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await RNFS.unlink(modelDir(m))
          } catch {}
          await refreshStatus()
        },
      },
    ])
  }

  const testSpeak = async () => {
    setTesting(true)
    try {
      let engine: TtsEngine
      if (tts.engine === 'sherpa' && tts.modelId) {
        const m = TTS_MODELS.find((x) => x.id === tts.modelId)
        if (!m || !downloaded[m.id]) throw new Error('请先下载离线模型')
        engine = await createEngine('sherpa', modelDir(m), m.supportsEnglish)
      } else {
        engine = await createEngine('system')
      }
      engineRef.current?.destroy().catch(() => {})
      engineRef.current = engine
      await engine.speak('你好，我是北牖，欢迎使用离线语音朗读。', { speed: tts.speed, sid: tts.sid })
    } catch (e: any) {
      Alert.alert('朗读失败', e?.message || '当前引擎不可用')
    } finally {
      setTesting(false)
    }
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: c.background }]}>
      {/* 引擎选择 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.subText }]}>朗读引擎</Text>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          {(['system', 'sherpa'] as const).map((engine) => (
            <TouchableOpacity
              key={engine}
              style={styles.radioRow}
              onPress={() => setTts({ engine })}
            >
              <View style={[styles.radio, { borderColor: c.primary }]}>
                {tts.engine === engine && <View style={[styles.radioDot, { backgroundColor: c.primary }]} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.radioTitle, { color: c.text }]}>
                  {engine === 'system' ? '系统 TTS' : '离线模型'}
                </Text>
                <Text style={[styles.radioSub, { color: c.subText }]}>
                  {engine === 'system' ? '无需下载，使用设备自带语音' : '需先下载模型，支持多音色'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 离线模型列表 */}
      {tts.engine === 'sherpa' && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.subText }]}>离线模型（仅 CDN 下载）</Text>
          {TTS_MODELS.map((m) => {
            const done = downloaded[m.id]
            const prog = progress[m.id]
            const isBusy = busy === m.id
            return (
              <View key={m.id} style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: c.text }]}>{m.name}</Text>
                    <Text style={[styles.cardSub, { color: c.subText }]}>
                      {m.speakers > 1 ? `${m.speakers} 音色` : '单音色'} · {m.sampleRate / 1000}kHz
                      {m.supportsEnglish ? ' · 中英双语' : ''}
                    </Text>
                    <Text style={[styles.cardSub, { color: c.subText }]}>{m.archive}</Text>
                  </View>
                  {isBusy ? (
                    <View style={styles.busyBox}>
                      <ActivityIndicator color={c.primary} size="small" />
                      {prog > 0 && <Text style={[styles.progText, { color: c.primary }]}>{Math.round(prog)}%</Text>}
                    </View>
                  ) : done ? (
                    <TouchableOpacity
                      style={[styles.smallBtn, { borderColor: c.danger }]}
                      onPress={() => deleteModel(m)}
                    >
                      <Text style={{ color: c.danger, fontSize: 12 }}>已下载</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.smallBtn, { borderColor: c.primary }]}
                      onPress={() => downloadModel(m)}
                    >
                      <Text style={{ color: c.primary, fontSize: 12 }}>下载</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {done && (
                  <TouchableOpacity
                    style={[styles.selectBtn, { borderColor: c.primary }]}
                    onPress={() => setTts({ modelId: m.id })}
                  >
                    <Text style={{ color: c.primary, fontSize: 13 }}>
                      {tts.modelId === m.id ? '当前使用' : '使用此模型'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          })}
        </View>
      )}

      {/* 语速 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.subText }]}>语速：{tts.speed.toFixed(1)}x</Text>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.speedRow}>
            {[0.6, 0.8, 1.0, 1.2, 1.5].map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.speedBtn,
                  tts.speed === s && { backgroundColor: c.primary },
                  { borderColor: tts.speed === s ? c.primary : c.border },
                ]}
                onPress={() => setTts({ speed: s })}
              >
                <Text style={{ color: tts.speed === s ? '#fff' : c.text, fontSize: 13 }}>{s.toFixed(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* 音色（多音色模型） */}
      {tts.engine === 'sherpa' && tts.modelId && (() => {
        const m = TTS_MODELS.find((x) => x.id === tts.modelId)
        if (!m || m.speakers <= 1) return null
        return (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.subText }]}>音色（0 ~ {m.speakers - 1}）</Text>
            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <TextInput
                style={[styles.input, { color: c.text, borderColor: c.border }]}
                value={String(tts.sid)}
                onChangeText={(v) => {
                  const n = parseInt(v, 10)
                  if (!isNaN(n) && n >= 0 && n < m.speakers) setTts({ sid: n })
                }}
                keyboardType="number-pad"
                placeholder={`当前音色 ${tts.sid}`}
                placeholderTextColor={c.subText}
              />
            </View>
          </View>
        )
      })()}

      {/* 试听 */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.testBtn, { backgroundColor: c.primary }]}
          onPress={testSpeak}
          disabled={testing}
        >
          {testing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.testBtnText}>试听一段</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { paddingHorizontal: 16, marginTop: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  card: { borderRadius: 12, padding: 16, borderWidth: StyleSheet.hairlineWidth },
  rowBetween: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardSub: { fontSize: 12, marginTop: 3 },
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  radioTitle: { fontSize: 15, fontWeight: '600' },
  radioSub: { fontSize: 12, marginTop: 2 },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  selectBtn: { marginTop: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  busyBox: { alignItems: 'center' },
  progText: { fontSize: 12, marginTop: 4 },
  speedRow: { flexDirection: 'row', justifyContent: 'space-between' },
  speedBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  testBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  testBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
