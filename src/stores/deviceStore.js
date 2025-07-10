import { defineStore } from 'pinia'
import { deviceTypeMap } from '../config/deviceTypes'

export const useDeviceStore = defineStore('device', {
  state: () => ({
    devices: [],
    selectedDeviceId: null,
    DEVICE_OFFLINE_TIMEOUT: 60000, // 60秒
    deviceTypeMap,
    offlineCheckInterval: null, // 离线检查定时器
    OFFLINE_CHECK_INTERVAL: 3000 // 3秒检查一次
  }),

  getters: {
    getDeviceById: (state) => (id) => {
      return state.devices.find(device => device.id === id)
    },
    
    connectedDevices: (state) => {
      return state.devices.filter(device => device.connected)
    },
    
    disconnectedDevices: (state) => {
      return state.devices.filter(device => !device.connected)
    }
  },

  actions: {
    // 初始化设备列表
    initDeviceList() {
      const savedDevices = localStorage.getItem('devices')
      if (savedDevices) {
        try {
          this.devices = JSON.parse(savedDevices)
          // 检查已保存设备的离线状态
          this.checkDevicesOfflineStatus()
          this.updateDeviceTable()
        } catch (error) {
          console.error('Failed to load devices from localStorage:', error)
          this.devices = []
        }
      }
      
      // 启动离线检查循环
      this.startOfflineCheck()
    },

    // 添加设备
    addDevice(deviceData) {
      const newDevice = {
        id: deviceData.id,
        name: deviceData.name,
        type: deviceData.type,
        connected: false,
        lastReport: null,
        data: {}
      }
      
      this.devices.push(newDevice)
      this.saveDevices()
      this.updateDeviceTable()
    },

    // 删除设备
    removeDevice(deviceId) {
      const index = this.devices.findIndex(device => device.id === deviceId)
      if (index !== -1) {
        this.devices.splice(index, 1)
        this.saveDevices()
        this.updateDeviceTable()
        
        if (this.selectedDeviceId === deviceId) {
          this.selectedDeviceId = null
        }
      }
    },

    // 更新设备数据
    updateDeviceData(deviceId, data) {
      const device = this.getDeviceById(deviceId)
      if (device) {
        device.data = { ...device.data, ...data }
        device.lastReport = Date.now()
        
        if (!device.connected) {
          device.connected = true
        }
        
        this.saveDevices()
        this.updateDeviceTable()
      }
    },

    // 标记设备离线
    markDeviceOffline(deviceId) {
      const device = this.getDeviceById(deviceId)
      if (device && device.connected) {
        device.connected = false
        this.saveDevices()
        this.updateDeviceTable()
        console.log(`设备 ${deviceId} 超过${this.DEVICE_OFFLINE_TIMEOUT/1000}秒未上报，已标记为离线`)
      }
    },

    // 检查所有设备的离线状态
    checkDevicesOfflineStatus() {
      const currentTime = Date.now()
      this.devices.forEach(device => {
        if (device.connected && device.lastReport) {
          const timeSinceLastReport = currentTime - device.lastReport
          if (timeSinceLastReport > this.DEVICE_OFFLINE_TIMEOUT) {
            this.markDeviceOffline(device.id)
          }
        }
      })
    },

    // 启动离线检查循环
    startOfflineCheck() {
      if (this.offlineCheckInterval) {
        return // 已经启动了
      }
      
      this.offlineCheckInterval = setInterval(() => {
        this.checkDevicesOfflineStatus()
      }, this.OFFLINE_CHECK_INTERVAL)
      
      console.log(`离线检查循环已启动，每${this.OFFLINE_CHECK_INTERVAL/1000}秒检查一次`)
    },

    // 停止离线检查循环
    stopOfflineCheck() {
      if (this.offlineCheckInterval) {
        clearInterval(this.offlineCheckInterval)
        this.offlineCheckInterval = null
        console.log('离线检查循环已停止')
      }
    },

    // 选择设备
    selectDevice(deviceId) {
      this.selectedDeviceId = deviceId
    },

    // 保存设备到本地存储
    saveDevices() {
      try {
        localStorage.setItem('devices', JSON.stringify(this.devices))
      } catch (error) {
        console.error('Failed to save devices to localStorage:', error)
      }
    },

    // 更新设备表格（用于触发UI更新）
    updateDeviceTable() {
      // 这个方法主要用于触发响应式更新
      // 在Vue中，直接修改state会自动触发UI更新
    },

    // 刷新设备列表
    refreshDevices() {
      // 可以在这里添加刷新逻辑
      this.updateDeviceTable()
    },

    // 清理资源（应用关闭时调用）
    cleanup() {
      this.stopOfflineCheck()
    }
  }
})