// 文档列表：原生 FlatList，点击进入 WebView 查看器
import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { fetchDocuments, DocumentItem } from '../api/documents'
import { useAuth } from '../store/auth'
import { useSettings } from '../store/settings'
import { getColors } from '../theme'
import FileIcon from '../components/FileIcon'

function formatSize(bytes: number): string {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DocumentsScreen() {
  const navigation = useNavigation<any>()
  const { token, user } = useAuth()
  const { mode } = useSettings()
  const c = getColors(mode)
  const [docs, setDocs] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const list = await fetchDocuments()
      setDocs(list)
      setError('')
    } catch (e: any) {
      setError(e?.message || '加载失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (token) {
      load()
    } else {
      setLoading(false)
      setDocs([])
    }
  }, [token, load])

  const onRefresh = () => {
    setRefreshing(true)
    load()
  }

  if (!token) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Text style={[styles.emptyTitle, { color: c.text }]}>需要登录</Text>
        <Text style={[styles.emptySub, { color: c.subText }]}>登录后即可浏览北牖的文档库</Text>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: c.primary }]}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.primaryBtnText}>去登录</Text>
        </TouchableOpacity>
        {user && <Text style={[styles.emptySub, { color: c.subText }]}>当前：{user.username}</Text>}
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <FlatList
        data={docs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={docs.length === 0 ? styles.emptyContainer : undefined}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: c.text }]}>北牖</Text>
            <Text style={[styles.headerSub, { color: c.subText }]}>
              {user ? `${user.username} 的文档库` : '文档库'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={c.primary} />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={{ color: c.subText }}>{error}</Text>
              <TouchableOpacity onPress={load} style={[styles.secondaryBtn, { borderColor: c.primary }]}>
                <Text style={{ color: c.primary }}>重试</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={[styles.emptySub, { color: c.subText }]}>暂无文档</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
            onPress={() => navigation.navigate('Viewer', { id: item.id, title: item.title })}
          >
            <View style={styles.cardIcon}>
              <FileIcon type={item.type} color={c.primary} />
            </View>
            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={[styles.cardMeta, { color: c.subText }]}>
                {item.fileName} · {formatSize(item.size)}
              </Text>
              <Text style={[styles.cardMeta, { color: c.subText }]}>{formatDate(item.updatedAt)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyContainer: { flexGrow: 1 },
  header: { padding: 20, paddingBottom: 8 },
  headerTitle: { fontSize: 26, fontWeight: '700' },
  headerSub: { fontSize: 13, marginTop: 4 },
  card: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardIcon: { width: 44, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, marginLeft: 12 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardMeta: { fontSize: 12, marginTop: 2 },
  primaryBtn: { marginTop: 16, paddingHorizontal: 28, paddingVertical: 10, borderRadius: 8 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondaryBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 13, marginTop: 6, textAlign: 'center' },
})
