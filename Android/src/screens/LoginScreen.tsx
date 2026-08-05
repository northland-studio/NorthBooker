// OAuth 登录：WebView 打开服务器授权入口，探测回跳 hash 中的 access_token
import React, { useState } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'
import { OAUTH_LOGIN_URL, OAUTH_HASH_PROBE } from '../config'
import { useAuth } from '../store/auth'
import { Colors } from '../theme'

interface Props {
  onDone?: () => void
}

export default function LoginScreen({ onDone }: Props) {
  const { login } = useAuth()
  const [loading, setLoading] = useState(true)

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data)
      if (data.type !== 'oauth' || !data.hash) return
      const params = new URLSearchParams(data.hash.replace(/^#/, ''))
      const token = params.get('access_token')
      if (token) {
        const user = {
          username: params.get('username') || '',
          level: Number(params.get('level') || 0),
        }
        await login(token, user)
        onDone?.()
      }
    } catch (e) {
      // 忽略非 JSON 消息
    }
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      )}
      <WebView
        source={{ uri: OAUTH_LOGIN_URL }}
        style={styles.webview}
        injectedJavaScript={OAUTH_HASH_PROBE}
        onMessage={handleMessage}
        onLoadEnd={() => setLoading(false)}
        startInLoadingState
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  webview: { flex: 1 },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgLight,
  },
})
