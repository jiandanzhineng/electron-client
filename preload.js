/**
 * preload.js
 * 预加载脚本，在渲染进程中提供安全的API
 * 用于在渲染进程和主进程之间建立通信桥梁
 */

const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 发送键盘事件到主进程
   * @param {string} type - 事件类型 ('keydown' 或 'keyup')
   * @param {Object} keyEvent - 键盘事件数据
   */
  sendKeyEvent: (type, keyEvent) => {
    ipcRenderer.send('keyboard-event', type, keyEvent);
  },
  // Expose IPC methods for MQTT communication
  mqttConnect: (url, options) => ipcRenderer.send('mqtt-connect', url, options),
  connectMqtt: (config) => ipcRenderer.invoke('connect-mqtt', config),
  disconnectMqtt: () => ipcRenderer.invoke('disconnect-mqtt'),
  onMqttStatus: (callback) => ipcRenderer.on('mqtt-status', (event, status) => callback(status)),
  onMqttMessage: (callback) => ipcRenderer.on('mqtt-message', (event, message) => callback(message)),
  sendMqttMessage: (topic, payload) => ipcRenderer.send('mqtt-send-message', topic, payload),
  publishMqttMessage: (topic, payload) => ipcRenderer.invoke('publish-mqtt-message', topic, payload),
  
  // Expose IPC methods for mDNS publishing
  publishMDNS: (port) => ipcRenderer.invoke('publish-mdns', port),
  runMDNSTool: (port) => ipcRenderer.invoke('run-mdns-tool', port),
  stopMDNSTool: () => ipcRenderer.invoke('stop-mdns-tool'),
  getMDNSToolStatus: () => ipcRenderer.invoke('get-mdns-tool-status'),
  onMDNSStatusChange: (callback) => ipcRenderer.on('mdns-status-change', (event, status) => callback(status)),
  onMDNSOutput: (callback) => ipcRenderer.on('mdns-output', (event, output) => callback(output)),
  onMDNSError: (callback) => ipcRenderer.on('mdns-error', (event, error) => callback(error)),
  
  // Expose IPC methods for local server management
  startLocalServer: (config) => ipcRenderer.invoke('start-local-server', config),
  stopLocalServer: (processId) => ipcRenderer.invoke('stop-local-server', processId),
  forceStopLocalServer: (processId) => ipcRenderer.invoke('force-stop-local-server', processId),
  checkLocalServerStatus: () => ipcRenderer.invoke('check-local-server-status'),
  onServerLog: (callback) => ipcRenderer.on('server-log', (event, log) => callback(log)),
  onServerStatusChange: (callback) => ipcRenderer.on('server-status-change', (event, status) => callback(status)),
  
  // Expose IPC methods for MQTT Broker (EMQX) management
  startMqttBroker: () => ipcRenderer.invoke('start-mqtt-broker'),
  stopMqttBroker: () => ipcRenderer.invoke('stop-mqtt-broker'),
  restartMqttBroker: () => ipcRenderer.invoke('restart-mqtt-broker'),
  checkMqttBrokerStatus: () => ipcRenderer.invoke('check-mqtt-broker-status'),
  
  // 读取文件
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  
  // 日志相关API
  getAppLogs: (lines) => ipcRenderer.invoke('get-app-logs', lines),
  cleanOldLogs: () => ipcRenderer.invoke('clean-old-logs'),
  openLogDirectory: () => ipcRenderer.invoke('open-log-directory'),
  
  // 打开外部浏览器
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  
  // 通用IPC调用方法
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  
  // Expose IPC methods for system information
  getSystemUptime: () => ipcRenderer.invoke('get-system-uptime'),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  
  // 自动更新相关API
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  onAutoUpdaterStatus: (callback) => ipcRenderer.on('auto-updater-status', (event, status) => callback(status)),
  
  // 玩法文件管理相关API
  scanGameplayDirectory: (directoryPath) => ipcRenderer.invoke('scan-gameplay-directory', directoryPath),
  copyGameplayFile: (sourcePath, targetPath) => ipcRenderer.invoke('copy-gameplay-file', sourcePath, targetPath),
  
  // 文件选择对话框
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options)
});

console.log('Preload script executed');