// 在线文档查看器：WebView 复用网页版 Viewer（@doc-preview 渲染 PDF/Office/文本）
import React from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'
import { WEB_BASE, tokenInjectScript } from '../config'
import { useAuth } from '../store/auth'
import { getColors } from '../theme'
import { useSettings } from '../store/settings'

export default function ViewerScreen({ route }: any) {
  const { id } = route.params || {}
  const { token } = useAuth()
  const { mode } = useSettings()
  const c = getColors(mode)

  const url = `${WEB_BASE}/viewer/${id}`
  const injected = token ? tokenInjectScript(token) : 'true;'

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <WebView
        source={{ uri: url }}
        style={styles.webview}
        injectedJavaScriptBeforeContentLoaded={injected}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color={c.primary} size="large" />
          </View>
        )}
        onShouldStartLoadWithRequest={() => true}
        allowFileAccess
        allowUniversalAccessFromFileURLs
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
})
