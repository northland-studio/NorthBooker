// 全局设置：主题模式 + TTS 偏好（AsyncStorage 持久化）
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ThemeMode } from '../theme'

const THEME_KEY = 'nb_theme'
const TTS_PREFS_KEY = 'nb_tts_prefs'

export interface TtsPrefs {
  engine: 'system' | 'sherpa'
  modelId: string | null
  speed: number
  sid: number
}

interface SettingsState {
  mode: ThemeMode
  toggleTheme: () => void
  tts: TtsPrefs
  setTts: (patch: Partial<TtsPrefs>) => Promise<void>
}

const SettingsContext = createContext<SettingsState>({
  mode: 'light',
  toggleTheme: () => {},
  tts: { engine: 'system', modelId: null, speed: 1.0, sid: 0 },
  setTts: async () => {},
})

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light')
  const [tts, setTtsState] = useState<TtsPrefs>({ engine: 'system', modelId: null, speed: 1.0, sid: 0 })

  useEffect(() => {
    ;(async () => {
      const m = await AsyncStorage.getItem(THEME_KEY)
      if (m === 'dark' || m === 'light') setMode(m)
      const raw = await AsyncStorage.getItem(TTS_PREFS_KEY)
      if (raw) {
        try {
          setTtsState({ ...tts, ...JSON.parse(raw) })
        } catch {}
      }
    })()
  }, [])

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      AsyncStorage.setItem(THEME_KEY, next).catch(() => {})
      return next
    })
  }, [])

  const setTts = useCallback(async (patch: Partial<TtsPrefs>) => {
    setTtsState((prev) => {
      const next = { ...prev, ...patch }
      AsyncStorage.setItem(TTS_PREFS_KEY, JSON.stringify(next)).catch(() => {})
      return next
    })
  }, [])

  return (
    <SettingsContext.Provider value={{ mode, toggleTheme, tts, setTts }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
