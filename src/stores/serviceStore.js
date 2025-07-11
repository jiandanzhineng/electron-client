import { defineStore } from 'pinia'

export const useServiceStore = defineStore('service', {
  state: () => ({
    serviceStatus: {
      mdns: 'stopped',
      mqtt: 'stopped',
      api: 'stopped'
    },
    serverConfig: {
      port: 8080,
      mode: 'development'
    },
    serverLogs: [],
    mqttConfig: {
      host: 'easysmart.local',
      port: 1883,
      username: '',
      password: ''
    },
    mqttConnected: false,
    mqttClient: null,
    isInitialized: false
  }),

  getters: {
    isServiceRunning: (state) => (service) => {
      return state.serviceStatus[service] === 'running'
    },
    
    allServicesRunning: (state) => {
      return Object.values(state.serviceStatus).every(status => status === 'running')
    },
    
    getServiceStatusText: (state) => (service) => {
      const status = state.serviceStatus[service]
      switch(status) {
        case 'running': return '运行中'
        case 'stopped': return '已停止'
        case 'starting': return '启动中'
        case 'stopping': return '停止中'
        case 'error': return '错误'
        default: return '未知'
      }
    }
  },

  actions: {
    // 更新服务状态
    updateServiceStatus(service, status) {
      if (this.serviceStatus.hasOwnProperty(service)) {
        this.serviceStatus[service] = status
      }
    },

    // 更新服务器配置
    updateServerConfig(config) {
      this.serverConfig = { ...this.serverConfig, ...config }
    },

    // 添加服务器日志
    addServerLog(log) {
      // 如果log是字符串，转换为对象格式
      if (typeof log === 'string') {
        const timestamp = new Date().toLocaleTimeString()
        this.serverLogs.push({
          timestamp,
          message: log,
          level: 'info',
          service: 'System',
          id: Date.now()
        })
      } else {
        // 如果log已经是对象格式，直接使用
        this.serverLogs.push({
          timestamp: log.timestamp || new Date().toLocaleTimeString(),
          message: log.message || '',
          level: log.level || 'info',
          service: log.service || 'System',
          id: log.id || Date.now()
        })
      }
      
      // 限制日志数量，避免内存溢出
      if (this.serverLogs.length > 1000) {
        this.serverLogs = this.serverLogs.slice(-500)
      }
    },

    // 清空服务器日志
    clearServerLogs() {
      this.serverLogs = []
    },

    // 更新MQTT配置
    updateMqttConfig(config) {
      this.mqttConfig = { ...this.mqttConfig, ...config }
    },

    // 设置MQTT连接状态
    setMqttConnected(connected) {
      this.mqttConnected = connected
    },

    // 设置MQTT客户端
    setMqttClient(client) {
      this.mqttClient = client
    },

    // 启动MDNS服务
    async startMdnsService() {
      try {
        this.updateServiceStatus('mdns', 'starting')
        // 调用IPC处理器启动MDNS服务
        const result = await window.electronAPI.runMDNSTool(this.serverConfig.port)
        if (result.success) {
          this.updateServiceStatus('mdns', 'running')
          this.addServerLog('MDNS服务启动成功')
        } else {
          this.updateServiceStatus('mdns', 'error')
          this.addServerLog(`MDNS服务启动失败: ${result.error}`)
        }
      } catch (error) {
        this.updateServiceStatus('mdns', 'error')
        this.addServerLog(`MDNS服务启动异常: ${error.message}`)
      }
    },

    // 停止MDNS服务
    async stopMdnsService() {
      try {
        this.updateServiceStatus('mdns', 'stopping')
        const result = await window.electronAPI.stopMDNSTool()
        if (result) {
          this.updateServiceStatus('mdns', 'stopped')
          this.addServerLog('MDNS服务停止成功')
        } else {
          this.updateServiceStatus('mdns', 'error')
          this.addServerLog('MDNS服务停止失败: 没有运行中的进程')
        }
      } catch (error) {
        this.updateServiceStatus('mdns', 'error')
        this.addServerLog(`MDNS服务停止异常: ${error.message}`)
      }
    },

    // 启动MQTT服务
    async startMqttService() {
      try {
        this.updateServiceStatus('mqtt', 'starting')
        const result = await window.electronAPI.startMqttBroker()
        if (result.success) {
          this.updateServiceStatus('mqtt', 'running')
          this.addServerLog('MQTT服务启动成功')
        } else {
          this.updateServiceStatus('mqtt', 'error')
          this.addServerLog(`MQTT服务启动失败: ${result.error}`)
        }
      } catch (error) {
        this.updateServiceStatus('mqtt', 'error')
        this.addServerLog(`MQTT服务启动异常: ${error.message}`)
      }
    },

    // 停止MQTT服务
    async stopMqttService() {
      try {
        this.updateServiceStatus('mqtt', 'stopping')
        const result = await window.electronAPI.stopMqttBroker()
        if (result.success) {
          this.updateServiceStatus('mqtt', 'stopped')
          this.addServerLog('MQTT服务停止成功')
        } else {
          this.updateServiceStatus('mqtt', 'error')
          this.addServerLog(`MQTT服务停止失败: ${result.error}`)
        }
      } catch (error) {
        this.updateServiceStatus('mqtt', 'error')
        this.addServerLog(`MQTT服务停止异常: ${error.message}`)
      }
    },

    // 启动API服务
    async startApiService() {
      try {
        this.updateServiceStatus('api', 'starting')
        const result = await window.electronAPI.startLocalServer(this.serverConfig)
        if (result.success) {
          this.updateServiceStatus('api', 'running')
          this.addServerLog(`API服务启动成功，端口: ${this.serverConfig.port}`)
        } else {
          this.updateServiceStatus('api', 'error')
          this.addServerLog(`API服务启动失败: ${result.error}`)
        }
      } catch (error) {
        this.updateServiceStatus('api', 'error')
        this.addServerLog(`API服务启动异常: ${error.message}`)
      }
    },

    // 停止API服务
    async stopApiService() {
      try {
        this.updateServiceStatus('api', 'stopping')
        // 这里需要根据实际情况获取进程ID或使用其他停止方法
        const result = await window.electronAPI.stopLocalServer()
        if (result.success) {
          this.updateServiceStatus('api', 'stopped')
          this.addServerLog('API服务停止成功')
        } else {
          this.updateServiceStatus('api', 'error')
          this.addServerLog(`API服务停止失败: ${result.error}`)
        }
      } catch (error) {
        this.updateServiceStatus('api', 'error')
        this.addServerLog(`API服务停止异常: ${error.message}`)
      }
    },

    // 启动所有服务
    async startAllServices() {
      await this.startMdnsService()
      await this.startMqttService()
      await this.startApiService()
    },

    // 停止所有服务
    async stopAllServices() {
      await this.stopApiService()
      await this.stopMqttService()
      await this.stopMdnsService()
    },

    // 连接MQTT
    async connectMqtt() {
      try {
        // 创建纯对象副本，避免传递响应式代理对象
        const config = {
          host: this.mqttConfig.host,
          port: this.mqttConfig.port,
          username: this.mqttConfig.username,
          password: this.mqttConfig.password
        }
        const result = await window.electronAPI.connectMqtt(config)
        if (result.success) {
          this.setMqttConnected(true)
          this.addServerLog('MQTT连接成功')
        } else {
          this.setMqttConnected(false)
          this.addServerLog(`MQTT连接失败: ${result.error}`)
        }
      } catch (error) {
        this.setMqttConnected(false)
        this.addServerLog(`MQTT连接异常: ${error.message}`)
      }
    },

    // 断开MQTT连接
    async disconnectMqtt() {
      try {
        const result = await window.electronAPI.disconnectMqtt()
        if (result.success) {
          this.setMqttConnected(false)
          this.addServerLog('MQTT连接已断开')
        }
      } catch (error) {
        this.addServerLog(`MQTT断开连接异常: ${error.message}`)
      }
    },

    // 处理设备消息（包括所有来自设备的消息）
    async handleDeviceMessage(message) {
      try {
        // 检查是否是dpub topic格式: /dpub/XXXX (任意设备标识)
        const topicMatch = message.topic.match(/^\/dpub\/(.+)$/)
        if (!topicMatch) {
          return // 不是设备topic，忽略
        }
        
        const deviceId = topicMatch[1]
        
        // 解析消息内容
        let payload
        try {
          payload = JSON.parse(message.payload)
        } catch (e) {
          console.error('解析MQTT消息失败:', e)
          return
        }
        
        // 导入设备store和设备类型配置
        const { useDeviceStore } = await import('./deviceStore')
        const { getDeviceTypeName } = await import('../config/deviceTypes')
        const deviceStore = useDeviceStore()
        
        // 检查设备是否已存在
        let device = deviceStore.getDeviceById(deviceId)
        
        if (!device) {
          // 设备不存在，自动添加（仅在report消息时添加）
          if (payload.method === 'report') {
            const deviceData = {
              id: deviceId,
              name: `${getDeviceTypeName(payload.device_type)}-${deviceId.slice(-4)}`,
              type: payload.device_type || 'other'
            }
            
            deviceStore.addDevice(deviceData)
            this.addServerLog(`自动添加设备: ${deviceData.name} (${deviceId})`)
            device = deviceStore.getDeviceById(deviceId)
          } else {
            // 非report消息但设备不存在，仅更新最后消息时间
            return
          }
        }
        
        // 对于report消息，更新设备数据
        if (payload.method === 'report') {
          const updateData = { ...payload }
          delete updateData.method // 移除method字段
          deviceStore.updateDeviceData(deviceId, updateData)
        } else {
          // 对于非report消息，仅更新最后消息时间和连接状态
          if (device) {
            device.lastReport = Date.now()
            if (!device.connected) {
              device.connected = true
            }
            deviceStore.saveDevices()
            deviceStore.updateDeviceTable()
          }
        }
        
      } catch (error) {
        console.error('处理设备消息失败:', error)
        this.addServerLog(`处理设备消息失败: ${error.message}`)
      }
    },

    // 发布MQTT消息
    async publishMessage(topic, payload) {
      try {
        if (!this.mqttConnected) {
          throw new Error('MQTT未连接')
        }
        
        const result = await window.electronAPI.publishMqttMessage(topic, payload)
        if (result.success) {
          this.addServerLog(`MQTT发布成功: ${topic} - ${payload}`)
          return true
        } else {
          throw new Error(result.error || '发布失败')
        }
      } catch (error) {
        this.addServerLog(`MQTT发布失败: ${error.message}`)
        throw error
      }
    },

    // 初始化服务状态监听器
    init() {
      // 防止重复初始化
      if (this.isInitialized || !window.electronAPI) {
        return
      }
      this.isInitialized = true
      
      if (window.electronAPI) {
        // 监听MDNS状态变化
        window.electronAPI.onMDNSStatusChange((status) => {
          if (status === 'stopped') {
            this.updateServiceStatus('mdns', 'stopped')
            this.addServerLog('MDNS服务已停止')
          }
        })
        
        // 监听MDNS输出
        window.electronAPI.onMDNSOutput((output) => {
          this.addServerLog(`MDNS: ${output}`)
        })
        
        // 监听MQTT状态变化
        window.electronAPI.onMqttStatus((status) => {
          if (status === 'connected') {
            this.setMqttConnected(true)
            this.addServerLog('MQTT连接成功')
          } else if (status === 'disconnected') {
            this.setMqttConnected(false)
            this.addServerLog('MQTT连接已断开')
          }
        })
        
        // 监听MQTT消息
        window.electronAPI.onMqttMessage((message) => {
          this.addServerLog(`MQTT消息: ${message.topic} - ${message.payload}`)
          
          // 处理设备消息
          this.handleDeviceMessage(message)
        })
        
        // 启动后自动尝试连接MQTT
        this.addServerLog('正在自动尝试连接MQTT...')
        this.connectMqtt()
      }
    }
  }
})