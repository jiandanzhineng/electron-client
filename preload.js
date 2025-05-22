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
  onMqttStatus: (callback) => ipcRenderer.on('mqtt-status', (event, status) => callback(status)),
  onMqttMessage: (callback) => ipcRenderer.on('mqtt-message', (event, message) => callback(message))
});

console.log('预加载脚本已执行');