// 北牖 Android：导航根组件
import React, { useEffect } from 'react'
import { StatusBar, StyleSheet, View } from 'react-native'
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import Svg, { Path, Rect } from 'react-native-svg'

import { AuthProvider, useAuth } from './src/store/auth'
import { SettingsProvider, useSettings } from './src/store/settings'
import { getColors } from './src/theme'
import DocumentsScreen from './src/screens/DocumentsScreen'
import PagesScreen from './src/screens/PagesScreen'
import SettingsScreen from './src/screens/SettingsScreen'
import ViewerScreen from './src/screens/ViewerScreen'
import PageEditorScreen from './src/screens/PageEditorScreen'
import LoginScreen from './src/screens/LoginScreen'
import TtsSettingsScreen from './src/screens/TtsSettingsScreen'
import UpdateScreen from './src/screens/UpdateScreen'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

// 极简 SVG 图标（日间/夜间由 tabBarActiveTintColor 控制）
function DocIcon({ color }: { color: string }) {
  return (
    <Svg width="22" height="22" viewBox="0 0 22 22">
      <Rect x="3" y="2" width="16" height="18" rx="3" stroke={color} strokeWidth="1.6" fill="none" />
      <Path d="M7 8 H15 M7 12 H15 M7 16 H12" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  )
}

function PageIcon({ color }: { color: string }) {
  return (
    <Svg width="22" height="22" viewBox="0 0 22 22">
      <Path
        d="M6 3 H14 L18 7 V19 H6 Z"
        stroke={color}
        strokeWidth="1.6"
        fill="none"
        strokeLinejoin="round"
      />
      <Path d="M14 3 V7 H18" stroke={color} strokeWidth="1.6" fill="none" strokeLinejoin="round" />
      <Path d="M9 12 H15 M9 16 H15" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  )
}

function GearIcon({ color }: { color: string }) {
  return (
    <Svg width="22" height="22" viewBox="0 0 22 22">
      <Path
        d="M11 8 A3 3 0 1 0 11 14 A3 3 0 1 0 11 8 Z"
        stroke={color}
        strokeWidth="1.6"
        fill="none"
      />
      <Path
        d="M19 13.5 L20.3 11 L19 8.5 L20.8 6.4 L18.9 4.6 L16.7 5.8 L14.4 4.5 L13.8 2 H9.8 L9.2 4.5 L6.9 5.8 L4.7 4.6 L2.8 6.4 L4.6 8.5 L3.3 11 L4.6 13.5 L2.8 15.6 L4.7 17.4 L6.9 16.2 L9.2 17.5 L9.8 20 H13.8 L14.4 17.5 L16.7 16.2 L18.9 17.4 L20.8 15.6 Z"
        stroke={color}
        strokeWidth="1.3"
        fill="none"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function MainTabs() {
  const { mode } = useSettings()
  const c = getColors(mode)
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.subText,
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopColor: c.border,
        },
      }}
    >
      <Tab.Screen
        name="Documents"
        component={DocumentsScreen}
        options={{ title: '文档', tabBarIcon: ({ color }) => <DocIcon color={color} /> }}
      />
      <Tab.Screen
        name="Pages"
        component={PagesScreen}
        options={{ title: '在线文档', tabBarIcon: ({ color }) => <PageIcon color={color} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: '设置', tabBarIcon: ({ color }) => <GearIcon color={color} /> }}
      />
    </Tab.Navigator>
  )
}

function LoginGate() {
  const { token } = useAuth()
  const { mode } = useSettings()
  const c = getColors(mode)
  const [open, setOpen] = React.useState(false)

  useEffect(() => {
    if (!token && !open) setOpen(true)
    if (token) setOpen(false)
  }, [token, open])

  // 未登录时全屏展示登录页
  if (!token) {
    return (
      <>
        <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={styles.full}>
          <LoginScreen onDone={() => setOpen(false)} />
        </View>
      </>
    )
  }
  return null
}

function RootNavigator() {
  const { mode } = useSettings()
  const { token } = useAuth()
  const c = getColors(mode)
  const navTheme = {
    ...(mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === 'dark' ? DarkTheme : DefaultTheme).colors,
      primary: c.primary,
      background: c.background,
      card: c.card,
      text: c.text,
      border: c.border,
    },
  }

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: c.card },
          headerTintColor: c.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: c.background },
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ title: '登录', presentation: 'modal' }}
        />
        <Stack.Screen
          name="Viewer"
          component={ViewerScreen}
          options={({ route }: any) => ({ title: route.params?.title || '查看' })}
        />
        <Stack.Screen
          name="PageEditor"
          component={PageEditorScreen}
          options={({ route }: any) => ({ title: route.params?.title || '在线文档' })}
        />
        <Stack.Screen name="TtsSettings" component={TtsSettingsScreen} options={{ title: '语音朗读' }} />
        <Stack.Screen name="Update" component={UpdateScreen} options={{ title: '检查更新' }} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <RootNavigator />
        <LoginGate />
      </AuthProvider>
    </SettingsProvider>
  )
}

const styles = StyleSheet.create({
  full: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 },
})
