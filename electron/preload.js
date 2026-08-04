const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,

  // 窗口控制
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getSiteUrl: () => ipcRenderer.invoke('get-site-url'),
  getVersion: () => ipcRenderer.invoke('get-version'),

  // OAuth
  oauthLogin: () => ipcRenderer.invoke('oauth-login'),

  // 设置
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),

  // 字体
  getCloudFonts: () => ipcRenderer.invoke('get-cloud-fonts'),
  loadCloudFont: (info) => ipcRenderer.invoke('load-cloud-font', info),
  pickLocalFont: () => ipcRenderer.invoke('pick-local-font'),

  // 更新
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_, i) => cb(i)),
  onUpdateProgress: (cb) => ipcRenderer.on('update-progress', (_, p) => cb(p)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', () => cb()),
  onUpdateNotAvailable: (cb) => ipcRenderer.on('update-not-available', () => cb()),
  onUpdateError: (cb) => ipcRenderer.on('update-error', (_, m) => cb(m)),
  onSourceSwitched: (cb) => ipcRenderer.on('update-source-switched', () => cb()),
  getUpdateSource: () => ipcRenderer.invoke('get-update-source'),
  switchUpdateSource: () => ipcRenderer.invoke('switch-update-source'),

  // 获取更新公告
  fetchReleaseNotes: () => {
    return fetch('https://northbooker.xuanjian.top/api/updates/release-notes.json')
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
  },
})
