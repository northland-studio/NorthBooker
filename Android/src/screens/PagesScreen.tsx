// 在线文档（页面树）：原生树列表 + 编辑页 WebView
import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Switch,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { fetchPageTree, PageNode } from '../api/documents'
import { useAuth } from '../store/auth'
import { useSettings } from '../store/settings'
import { getColors } from '../theme'

interface Row {
  id: string
  title: string
  depth: number
  hasChildren: boolean
}

function flatten(nodes: PageNode[], depth: number, out: Row[] = []): Row[] {
  for (const n of nodes) {
    out.push({ id: n.id, title: n.title, depth, hasChildren: !!n.children?.length })
    if (n.children?.length) flatten(n.children, depth + 1, out)
  }
  return out
}

export default function PagesScreen() {
  const navigation = useNavigation<any>()
  const { token } = useAuth()
  const { mode } = useSettings()
  const c = getColors(mode)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [myOnly, setMyOnly] = useState(false)

  const load = useCallback(async () => {
    try {
      const tree = await fetchPageTree(myOnly)
      setRows(flatten(tree, 0))
    } catch (e: any) {
      // 保持现状
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [myOnly])

  useEffect(() => {
    if (token) load()
    else setLoading(false)
  }, [token, load])

  const onRefresh = () => {
    setRefreshing(true)
    load()
  }

  if (!token) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Text style={[styles.emptyTitle, { color: c.text }]}>需要登录</Text>
        <Text style={[styles.emptySub, { color: c.subText }]}>登录后可浏览在线文档</Text>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: c.primary }]}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.primaryBtnText}>去登录</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: c.text }]}>在线文档</Text>
        <View style={styles.myRow}>
          <Text style={[styles.myLabel, { color: c.subText }]}>只看我的</Text>
          <Switch
            value={myOnly}
            onValueChange={(v) => {
              setMyOnly(v)
              setLoading(true)
            }}
            trackColor={{ true: c.primary, false: c.border }}
            thumbColor="#fff"
          />
        </View>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={rows.length === 0 ? styles.emptyContainer : undefined}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={c.primary} />
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={[styles.emptySub, { color: c.subText }]}>暂无文档</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, { paddingLeft: 16 + item.depth * 18, borderBottomColor: c.border }]}
            onPress={() => navigation.navigate('PageEditor', { id: item.id, title: item.title })}
          >
            {item.hasChildren && <View style={[styles.branch, { borderColor: c.primary }]} />}
            <Text style={[styles.rowTitle, { color: c.text }]} numberOfLines={1}>
              {item.title}
            </Text>
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
  header: { padding: 20, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 26, fontWeight: '700' },
  myRow: { flexDirection: 'row', alignItems: 'center' },
  myLabel: { fontSize: 13, marginRight: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  branch: { width: 6, height: 6, borderRadius: 3, borderWidth: 1, marginRight: 10 },
  rowTitle: { fontSize: 15 },
  primaryBtn: { marginTop: 16, paddingHorizontal: 28, paddingVertical: 10, borderRadius: 8 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 13, marginTop: 6, textAlign: 'center' },
})
