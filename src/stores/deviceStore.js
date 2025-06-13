import { defineStore } from 'pinia'

export const useDeviceStore = defineStore('device', {
  state: () => ({
    devices: [],
    selectedDeviceId: null,
    deviceTimeouts: new Map(),
    DEVICE_OFFLINE_TIMEOUT: 60000, // 60秒
    deviceTypeMap: {
      'light': '智能灯',
      'switch': '智能开关',
      'sensor': '传感器',
      'camera': '摄像头',
      'QTZ': 'QTZ设备',
      'ZIDONGSUO': '自动锁',
      'TD01': 'TD01设备',
      'DIANJI': '电机设备',
      'other': '其他'
    }
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
          // 重新启动在线设备的离线检测定时器
          this.devices.forEach(device => {
            if (device.connected && device.lastReport) {
              const timeSinceLastReport = Date.now() - device.lastReport
              if (timeSinceLastReport < this.DEVICE_OFFLINE_TIMEOUT) {
                const remainingTime = this.DEVICE_OFFLINE_TIMEOUT - timeSinceLastReport
                const timeoutId = setTimeout(() => {
                  this.markDeviceOffline(device.id)
                }, remainingTime)
                this.deviceTimeouts.set(device.id, timeoutId)
              } else {
                device.connected = false
              }
            }
          })
          this.updateDeviceTable()
        } catch (error) {
          console.error('Failed to load devices from localStorage:', error)
          this.devices = []
        }
      }
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
        // 清除定时器
        if (this.deviceTimeouts.has(deviceId)) {
          clearTimeout(this.deviceTimeouts.get(deviceId))
          this.deviceTimeouts.delete(deviceId)
        }
        
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
        
        // 重置离线检测定时器
        if (this.deviceTimeouts.has(deviceId)) {
          clearTimeout(this.deviceTimeouts.get(deviceId))
        }
        
        const timeoutId = setTimeout(() => {
          this.markDeviceOffline(deviceId)
        }, this.DEVICE_OFFLINE_TIMEOUT)
        
        this.deviceTimeouts.set(deviceId, timeoutId)
        this.saveDevices()
        this.updateDeviceTable()
      }
    },

    // 标记设备离线并删除设备（1分钟未收到消息则删除）
    markDeviceOffline(deviceId) {
      const device = this.getDeviceById(deviceId)
      if (device) {
        // 1分钟未收到消息则删除设备
        this.removeDevice(deviceId)
        console.log(`设备 ${deviceId} 超过1分钟未上报，已自动删除`)
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
    }
  }
})