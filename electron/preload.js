const { contextBridge, ipcRenderer } = require('electron')

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('northbookerDesktop', {
  getSiteUrl: () => ipcRenderer.invoke('get-site-url'),
  platform: process.platform,
})
