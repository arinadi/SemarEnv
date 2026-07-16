const { contextBridge, ipcRenderer, webUtils } = require('electron') // ä½¿ç”¨ require

contextBridge.exposeInMainWorld('SemarEnvNodeAPI', {
  ipcSendToMain: (...args) => ipcRenderer.send('command', ...args),
  ipcReceiveFromMain: (callback) => ipcRenderer.on('command', callback),
  showFilePath: (file) => {
    return webUtils.getPathForFile(file)
  }
})
