const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('northbookerDesktop', {
  // 基础信息
  getSiteUrl: () => ipcRenderer.invoke('get-site-url'),
  platform: process.platform,
  isElectron: true,

  // 窗口控制
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowStateChange: (callback) => {
    ipcRenderer.on('window-state-change', (_, isMaximized) => callback(isMaximized))
  },

  // 自动更新
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (_, info) => callback(info))
  },
  onUpdateNotAvailable: (callback) => {
    ipcRenderer.on('update-not-available', () => callback())
  },
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-progress', (_, percent) => callback(percent))
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', () => callback())
  },
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (_, msg) => callback(msg))
  },
})
