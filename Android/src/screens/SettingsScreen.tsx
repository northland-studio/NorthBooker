// 设置页：登录状态 / TTS 设置 / 检查更新 / 主题 / 关于
import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../store/auth'
import { useSettings } from '../store/settings'
import { APP_VERSION_NAME } from '../config'
import { getColors } from '../theme'

export default function SettingsScreen() {
  const navigation = useNavigation<any>()
  const { user, logout } = useAuth()
  const { mode, toggleTheme, tts } = useSettings()
  const c = getColors(mode)

  const engineLabel = tts.engine === 'sherpa' && tts.modelId ? tts.modelId : '系统 TTS'

  return (
    <ScrollView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.subText }]}>账户</Text>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          {user ? (
            <>
              <Text style={[styles.cardTitle, { color: c.text }]}>{user.username || '已登录'}</Text>
              <Text style={[styles.cardSub, { color: c.subText }]}>等级 {user.level ?? 0}</Text>
              <TouchableOpacity style={[styles.btn, { borderColor: c.danger }]} onPress={logout}>
                <Text style={{ color: c.danger }}>退出登录</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.cardSub, { color: c.subText }]}>尚未登录</Text>
              <TouchableOpacity
                style={[styles.btn, { borderColor: c.primary }]}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={{ color: c.primary }}>去登录</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.subText }]}>朗读</Text>
        <TouchableOpacity
          style={[styles.card, styles.row, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={() => navigation.navigate('TtsSettings')}
        >
          <View>
            <Text style={[styles.cardTitle, { color: c.text }]}>语音朗读</Text>
            <Text style={[styles.cardSub, { color: c.subText }]}>引擎：{engineLabel}</Text>
          </View>
          <Text style={[styles.chevron, { color: c.subText }]}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.subText }]}>更新</Text>
        <TouchableOpacity
          style={[styles.card, styles.row, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={() => navigation.navigate('Update')}
        >
          <View>
            <Text style={[styles.cardTitle, { color: c.text }]}>检查更新</Text>
            <Text style={[styles.cardSub, { color: c.subText }]}>仅使用 CDN 下载新版本</Text>
          </View>
          <Text style={[styles.chevron, { color: c.subText }]}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.subText }]}>外观</Text>
        <View style={[styles.card, styles.row, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>深色模式</Text>
          <Switch
            value={mode === 'dark'}
            onValueChange={toggleTheme}
            trackColor={{ true: c.primary, false: c.border }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.subText }]}>关于</Text>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>北牖 NorthBooker</Text>
          <Text style={[styles.cardSub, { color: c.subText }]}>版本 {APP_VERSION_NAME}（Android）</Text>
          <Text style={[styles.cardSub, { color: c.subText }]}>northbooker.xuanjian.top</Text>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { paddingHorizontal: 16, marginTop: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  card: { borderRadius: 12, padding: 16, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardSub: { fontSize: 12, marginTop: 4 },
  btn: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  chevron: { fontSize: 22, fontWeight: '300' },
})
