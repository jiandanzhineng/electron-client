import { defineStore } from 'pinia'
import { deviceTypeMap } from '../config/deviceTypes'

export const useDeviceStore = defineStore('device', {
  state: () => ({
    devices: [],
    selectedDeviceId: null,
    DEVICE_OFFLINE_TIMEOUT: 60000, // 60秒
    deviceTypeMap,
    offlineCheckInterval: null, // 离线检查定时器
    OFFLINE_CHECK_INTERVAL: 3000, // 3秒检查一次
    
    // WiFi配置相关
    wifiConfig: {
      ssid: '',
      password: ''
    },
    
    // 配网状态相关
    isConfiguring: false,
    configCountdown: 120,
    configTimer: null,
    configLogs: [],
    configSuccess: false
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
      
      // 初始化WiFi配置
      this.initWifiConfig()
      
      // 启动离线检查循环
      this.startOfflineCheck()
    },

    // 初始化WiFi配置
    initWifiConfig() {
      const savedWifiConfig = localStorage.getItem('wifiConfig')
      if (savedWifiConfig) {
        try {
          this.wifiConfig = JSON.parse(savedWifiConfig)
        } catch (error) {
          console.error('Failed to load WiFi config from localStorage:', error)
          this.wifiConfig = { ssid: '', password: '' }
        }
      }
    },

    // 保存WiFi配置
    saveWifiConfig() {
      try {
        localStorage.setItem('wifiConfig', JSON.stringify(this.wifiConfig))
      } catch (error) {
        console.error('Failed to save WiFi config to localStorage:', error)
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
        this.devices.splice(index, 1)
        this.saveDevices()
        this.updateDeviceTable()
        
        if (this.selectedDeviceId === deviceId) {
          this.selectedDeviceId = null
        }
      }
    },

    // 清空所有设备
    clearAllDevices() {
      this.devices = []
      this.selectedDeviceId = null
      this.saveDevices()
      this.updateDeviceTable()
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

    // 开始设备配网
    async startDeviceConfiguration() {
      if (this.isConfiguring) {
        return
      }

      // 保存WiFi配置
      this.saveWifiConfig()
      
      this.isConfiguring = true
      this.configCountdown = 120
      this.configLogs = []
      
      this.addConfigLog('开始设备配网...')
      this.addConfigLog(`WiFi SSID: ${this.wifiConfig.ssid}`)
      
      // 启动倒计时
      this.startConfigTimer()
      
      try {
        // 调用配网逻辑
        await this.performDeviceConfiguration()
      } catch (error) {
        this.addConfigLog(`配网失败: ${error.message}`)
        console.error('Device configuration failed:', error)
      }
    },

    // 停止设备配网
    stopDeviceConfiguration() {
      if (!this.isConfiguring) {
        return
      }

      this.isConfiguring = false
      this.stopConfigTimer()
      this.addConfigLog('配网已停止')
    },

    // 启动配网倒计时
    startConfigTimer() {
      if (this.configTimer) {
        clearInterval(this.configTimer)
      }
      
      this.configTimer = setInterval(() => {
        this.configCountdown--
        if (this.configCountdown <= 0) {
          this.stopDeviceConfiguration()
          this.addConfigLog('配网超时，已自动停止')
        }
      }, 1000)
    },

    // 停止配网倒计时
    stopConfigTimer() {
      if (this.configTimer) {
        clearInterval(this.configTimer)
        this.configTimer = null
      }
    },

    // 添加配网日志
    addConfigLog(message) {
      const timestamp = new Date().toLocaleTimeString()
      this.configLogs.push(`[${timestamp}] ${message}`)
    },

    // 执行设备配网（参照quick-bluetooth-test.js）
    async performDeviceConfiguration() {
      this.addConfigLog('正在初始化蓝牙...')
      
      try {
        // 扫描BluFi设备
        this.addConfigLog('正在扫描BluFi设备...')
        const scanResult = await window.electronAPI.invoke('blufi-scan-devices')
        
        if (!scanResult.success) {
          throw new Error(scanResult.error)
        }
        
        if (scanResult.devices.length === 0) {
          throw new Error('未找到BluFi设备')
        }
        
        // 连接第一个找到的设备
        const device = scanResult.devices[0]
        this.addConfigLog(`正在连接设备: ${device.name || device.id}`)
        
        const connectResult = await window.electronAPI.invoke('blufi-connect-device', device.id)
        if (!connectResult.success) {
          throw new Error(connectResult.error)
        }
        
        // 配置WiFi
        this.addConfigLog('正在配置WiFi...')
        const configResult = await window.electronAPI.invoke('blufi-configure-wifi', {
          ssid: this.wifiConfig.ssid,
          password: this.wifiConfig.password
        })
        
        if (configResult.success) {
          this.addConfigLog('配网成功完成')
          this.configSuccess = true
        } else {
          throw new Error(configResult.error)
        }
        
      } catch (error) {
        this.addConfigLog(`配网失败: ${error.message}`)
        throw error
      } finally {
        // 断开连接
        try {
          await window.electronAPI.invoke('blufi-disconnect')
        } catch (e) {
          console.error('断开BluFi连接失败:', e)
        }
      }
    },

    // 清理资源（应用关闭时调用）},

    // 重新配网
    restartConfiguration() {
      this.configSuccess = false
      this.configLogs = []
      this.configCountdown = 120
      this.startDeviceConfiguration()
    },

    // 结束配网
    finishConfiguration() {
      this.configSuccess = false
      this.stopDeviceConfiguration()
    },

    cleanup() {
      this.stopOfflineCheck()
      this.stopConfigTimer()
    }
  }
})