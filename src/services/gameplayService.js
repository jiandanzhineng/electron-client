import { useDeviceStore } from '@/stores/deviceStore'

/**
 * 设备管理器 - 处理外部玩法与设备的交互
 */
class DeviceManager {
  constructor(gameplayService = null) {
    this.deviceStore = null
    this.deviceMap = new Map()
    this.sensorCallbacks = new Map()
    this.gameplayService = gameplayService
    this.devicePropertyCache = new Map() // 缓存设备属性状态
  }
  
  /**
   * 设置玩法服务引用
   * @param {GameplayService} gameplayService - 玩法服务实例
   */
  setGameplayService(gameplayService) {
    this.gameplayService = gameplayService
  }
  
  /**
   * 发送日志
   * @param {string} message - 日志消息
   * @param {string} level - 日志级别
   */
  sendLog(message, level = 'info') {
    if (this.gameplayService && this.gameplayService.sendLog) {
      this.gameplayService.sendLog(message, level)
    } else {
      console.log(`[DEVICE ${level.toUpperCase()}] ${message}`)
    }
  }
  
  /**
   * 初始化设备store（延迟初始化）
   */
  initDeviceStore() {
    if (!this.deviceStore) {
      this.deviceStore = useDeviceStore()
    }
    return this.deviceStore
  }





  /**
   * 注册传感器数据回调
   * @param {string} logicalId - 逻辑设备ID
   * @param {Function} callback - 回调函数
   */
  registerSensorCallback(logicalId, callback) {
    this.sensorCallbacks.set(logicalId, callback)
  }

  /**
   * 处理传感器数据
   * @param {string} deviceId - 设备ID
   * @param {Object} data - 传感器数据
   */
  handleSensorData(deviceId, data) {
    // 查找对应的逻辑ID
    for (const [logicalId, device] of this.deviceMap) {
      if (device.id === deviceId) {
        // 获取设备的历史属性缓存
        const cacheKey = `${logicalId}`
        const previousData = this.devicePropertyCache.get(cacheKey) || {}
        
        // 合并之前的数据和新数据，确保保留所有属性
        const mergedData = { ...previousData, ...data }
        
        // 检查属性变化并触发相应的回调
        this.checkPropertyChanges(logicalId, previousData, data)
        
        // 更新属性缓存，保留所有历史属性
        this.devicePropertyCache.set(cacheKey, mergedData)
        
        // 触发通用消息回调（listenDeviceMessages）
        const callback = this.sensorCallbacks.get(logicalId)
        if (callback) {
          callback(data)
        }
        break
      }
    }
  }
  
  /**
   * 检查属性变化并触发属性监听回调
   * @param {string} logicalId - 逻辑设备ID
   * @param {Object} previousData - 之前的属性数据
   * @param {Object} newData - 新的属性数据
   */
  checkPropertyChanges(logicalId, previousData, newData) {
    // 检查所有属性监听器
    for (const [callbackKey, callback] of this.sensorCallbacks) {
      // 属性监听器的key格式: logicalId:property
      if (callbackKey.startsWith(`${logicalId}:property:`)) {
        const property = callbackKey.split(':')[2]
        
        // 检查该属性是否存在于新数据中
        if (newData.hasOwnProperty(property)) {
          const oldValue = previousData[property]
          const newValue = newData[property]
          
          // 只有当属性值真正发生变化时才触发回调
          if (oldValue !== newValue) {
            this.sendLog(`设备属性变化: ${logicalId} -> ${property}: ${oldValue} → ${newValue}`, 'debug')
            callback(newValue, newData)
          }
        }
      }
    }
  }

  /**
   * 获取设备列表
   */
  getDevices() {
    const store = this.initDeviceStore()
    return store.devices
  }
  
  /**
   * 根据逻辑ID查找设备
   */
  findDeviceByLogicalId(logicalId) {
    const store = this.initDeviceStore()
    return store.devices.find(device => 
      device.logicalId === logicalId || device.id === logicalId
    )
  }
  
  /**
   * 根据设备类型查找设备
   */
  findDevicesByType(deviceType) {
    const store = this.initDeviceStore()
    return store.devices.filter(device => 
      device.type === deviceType
    )
  }
  
  /**
   * 检查设备是否在线
   */
  isDeviceOnline(deviceId) {
    const store = this.initDeviceStore()
    const device = store.devices.find(d => d.id === deviceId)
    return device && device.status === 'online'
  }

  /**
   * 设置设备属性
   * @param {string} logicalId - 逻辑设备ID
   * @param {Object} properties - 属性对象，键为属性名，值为属性值
   * @returns {Promise<boolean>} - 设置是否成功
   */
  async setDeviceProperty(logicalId, properties) {
    const device = this.deviceMap.get(logicalId)
    if (!device) {
      this.sendLog(`设备未找到: ${logicalId}`, 'error')
      return false
    }

    try {
      const propertyList = Object.entries(properties).map(([key, value]) => `${key} = ${value}`).join(', ')
      this.sendLog(`设置设备属性: ${device.name} -> ${propertyList}`, 'info')
      
      // 构造属性更新数据
      const updateData = {
        method: 'update',
        ...properties
      }
      
      // 发送到设备的MQTT主题
      const topic = `/drecv/${device.id}`
      const result = await this.sendMqttMessage(topic, updateData)
      
      if (result) {
        this.sendLog(`设备属性设置成功: ${device.name} -> ${propertyList}`, 'success')
        return true
      } else {
        this.sendLog(`设备属性设置失败: ${device.name} -> ${propertyList}`, 'error')
        return false
      }
    } catch (error) {
      this.sendLog(`设备属性设置异常: ${device.name} (${error.message})`, 'error')
      return false
    }
  }

  /**
   * 发送MQTT消息到设备
   * @param {string} topic - MQTT主题
   * @param {Object} message - 消息内容
   */
  async sendMqttMessage(topic, message) {
    try {
      // 使用serviceStore的publishMessage方法
      if (window.electronAPI && window.electronAPI.publishMqttMessage) {
        const payload = typeof message === 'string' ? message : JSON.stringify(message)
        const result = await window.electronAPI.publishMqttMessage(topic, payload)
        
        if (result.success) {
          this.sendLog(`MQTT消息发送成功: ${topic}`, 'success')
          return true
        } else {
          this.sendLog(`MQTT消息发送失败: ${result.error || '未知错误'}`, 'error')
          return false
        }
      } else {
        this.sendLog('MQTT API不可用', 'error')
        return false
      }
    } catch (error) {
      this.sendLog(`MQTT消息发送异常: ${error.message}`, 'error')
      return false
    }
  }

  /**
   * 直接发送MQTT消息到指定设备
   * @param {string} logicalId - 逻辑设备ID
   * @param {Object} message - 消息内容
   */
  async sendDeviceMqttMessage(logicalId, message) {
    const device = this.deviceMap.get(logicalId)
    if (!device) {
      this.sendLog(`设备未找到: ${logicalId}`, 'error')
      return false
    }

    const topic = `/drecv/${device.id}`
    return await this.sendMqttMessage(topic, message)
  }

  /**
   * 获取设备属性
   * @param {string} logicalId - 逻辑设备ID
   * @param {string} property - 属性名称
   */
  getDeviceProperty(logicalId, property) {
    const device = this.deviceMap.get(logicalId)
    if (!device) {
      this.sendLog(`设备未找到: ${logicalId}`, 'error')
      return null
    }

    const store = this.initDeviceStore()
    const actualDevice = store.getDeviceById(device.id)
    
    if (actualDevice && actualDevice.data && actualDevice.data.hasOwnProperty(property)) {
      return actualDevice.data[property]
    }
    
    this.sendLog(`设备属性不存在: ${device.name} -> ${property}`, 'warning')
    return null
  }

  /**
   * 监听设备MQTT消息
   * @param {string} logicalId - 逻辑设备ID
   * @param {Function} callback - 消息回调函数
   */
  listenDeviceMessages(logicalId, callback) {
    const device = this.deviceMap.get(logicalId)
    if (!device) {
      this.sendLog(`设备未找到: ${logicalId}`, 'error')
      return false
    }

    // 注册设备消息监听器
    this.registerSensorCallback(logicalId, callback)
    this.sendLog(`开始监听设备消息: ${device.name}`, 'info')
    return true
  }

  /**
   * 监听设备属性变化
   * @param {string} logicalId - 逻辑设备ID
   * @param {string} property - 属性名称
   * @param {Function} callback - 属性变化回调函数
   */
  listenDeviceProperty(logicalId, property, callback) {
    const device = this.deviceMap.get(logicalId)
    if (!device) {
      this.sendLog(`设备未找到: ${logicalId}`, 'error')
      return false
    }

    // 使用特殊的key格式来标识属性监听器
    const propertyKey = `${logicalId}:property:${property}`
    this.sensorCallbacks.set(propertyKey, callback)
    
    this.sendLog(`开始监听设备属性: ${device.name} -> ${property}`, 'info')
    return true
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.deviceMap.clear()
    this.sensorCallbacks.clear()
    this.devicePropertyCache.clear()
  }
  
  /**
   * 清理GameplayService资源
   */
  cleanupGameplayService() {
    // 重置统计信息
    this.messageStats = {
      received: 0,
      processed: 0,
      avgProcessingTime: 0,
      maxProcessingTime: 0
    }
    
    // 清理设备管理器
    if (this.deviceManager) {
      this.deviceManager.cleanup()
    }
  }
}

/**
 * 玩法服务类 - 管理外部玩法的加载和执行
 */
class GameplayService {
  constructor() {
    this.currentGameplay = null
    this.gameplayConfig = null
    this.gameplayParameters = {}
    this.isRunning = false
    this.gameLoopInterval = null
    this.startTime = Date.now()
    this.deviceManager = new DeviceManager(this)
    this.logCallback = null
    
    // MQTT消息处理统计
    this.messageStats = {
      received: 0,
      processed: 0,
      avgProcessingTime: 0,
      maxProcessingTime: 0
    }
    
    // 绑定方法上下文
    this.executeLoop = this.executeLoop.bind(this)
    
    // 初始化MQTT消息监听
    this.initMqttListener()
  }
  
  /**
   * 初始化MQTT消息监听
   */
  initMqttListener() {
    if (window.electronAPI && window.electronAPI.onMqttMessage) {
      window.electronAPI.onMqttMessage((message) => {
        this.handleMqttMessageDirect(message)
      })
      
      this.sendLog('MQTT消息监听已初始化，启用直接处理模式', 'info')
    }
  }
  
  /**
   * 直接处理MQTT消息
   * @param {Object} message - MQTT消息对象
   */
  handleMqttMessageDirect(message) {
    const startTime = performance.now()
    this.messageStats.received++
    
    try {
      const result = this.handleMqttMessage(message)
      this.messageStats.processed++
      
      // 计算处理时间
      const processingTime = performance.now() - startTime
      this.updateProcessingStats(processingTime)
      
      // 解析消息内容以检查method字段
      let logMessage = `MQTT消息: ${processingTime.toFixed(2)}ms - ${message.topic} - ${result}`
      try {
        const payload = JSON.parse(message.payload)
        if (payload.method && payload.method !== 'report') {
          logMessage += ` - 消息内容: ${message.payload}`
        }
      } catch (e) {
        // 解析失败时不添加消息内容
      }
      
      // 记录处理时间日志
      this.sendLog(logMessage, 'debug')
      
      // 如果处理时间过长，记录警告
      if (processingTime > 10) {
        this.sendLog(`MQTT消息处理耗时较长: ${processingTime.toFixed(2)}ms - ${message.topic}`, 'warning')
      }
      
    } catch (error) {
      this.sendLog(`处理MQTT消息失败: ${error.message} - ${message.topic}`, 'error')
    }
  }
  

  
  /**
   * 更新处理性能统计
   */
  updateProcessingStats(processingTime) {
    this.messageStats.maxProcessingTime = Math.max(this.messageStats.maxProcessingTime, processingTime)
    
    // 计算移动平均值
    const alpha = 0.1 // 平滑因子
    this.messageStats.avgProcessingTime = 
      this.messageStats.avgProcessingTime * (1 - alpha) + processingTime * alpha
  }
  
  /**
   * 获取MQTT处理统计信息
   */
  getMqttStats() {
    return {
      ...this.messageStats,
      queueLength: this.messageQueue.length,
      processingRate: this.messageStats.processed / Math.max((Date.now() - this.startTime) / 1000, 1)
    }
  }
  
  /**
   * 处理MQTT消息
   * @param {Object} message - MQTT消息对象
   * @returns {string} 处理结果状态
   */
  handleMqttMessage(message) {
    try {
      // 检查是否是设备上报消息 (dpub topic)
      const topicMatch = message.topic.match(/^\/dpub\/(.+)$/)
      if (!topicMatch) {
        return '非设备上报主题过滤' // 不是设备上报topic，忽略
      }
      
      const deviceId = topicMatch[1]
      
      // 检查设备是否已映射到当前玩法
      const isMappedDevice = Array.from(this.deviceManager.deviceMap.values())
        .some(device => device.id === deviceId)
      
      if (!isMappedDevice) {
        return '设备未映射过滤' // 设备未映射到当前玩法，忽略消息
      }
      
      // 解析消息内容
      let payload
      try {
        payload = JSON.parse(message.payload)
      } catch (e) {
        return '消息解析失败' // 解析失败，忽略
      }
      
      // 检查是否存在method字段
      if (!payload.hasOwnProperty('method')) {
        return '缺少method字段过滤' // 没有method字段，忽略
      }
      
      // 处理不同格式的消息
      let deviceData
      
      if (payload.method === 'update' && payload.hasOwnProperty('key') && payload.hasOwnProperty('value')) {
        // 处理 key-value 格式的消息: {"method":"update","key":"button1","value":0}
        deviceData = {
          [payload.key]: payload.value
        }
        this.sendLog(`转换key-value格式消息: ${payload.key} = ${payload.value}`, 'debug')
      } else {
        deviceData = { ...payload }
      }
      
      // 将消息传递给DeviceManager处理
      this.deviceManager.handleSensorData(deviceId, deviceData)
      
      return '处理成功'
      
    } catch (error) {
      this.sendLog(`处理MQTT消息失败: ${error.message}`, 'error')
      return `处理异常: ${error.message}`
    }
  }
  
  /**
   * 设置日志回调函数
   * @param {Function} callback - 日志回调函数
   */
  setLogCallback(callback) {
    this.logCallback = callback
  }
  
  /**
   * 发送日志到前端界面
   * @param {string} message - 日志消息
   * @param {string} level - 日志级别 (info, success, warning, error)
   */
  sendLog(message, level = 'info') {
    if (this.logCallback) {
      this.logCallback({
        timestamp: Date.now(),
        level: level,
        message: message,
        source: 'gameplay'
      })
    }
    console.log(`[${level.toUpperCase()}] ${message}`)
  }

  /**
   * 从JavaScript文件加载玩法配置
   * @param {string} filePath - 玩法文件路径
   */
  async loadGameplayFromJS(filePath) {
    try {
      // 通过IPC读取文件内容
      const result = await window.electronAPI.invoke('read-file', filePath)
      
      if (!result.success) {
        throw new Error(`读取文件失败: ${result.error}`)
      }
      
      // 创建一个安全的执行环境
      const moduleExports = {}
      const module = { exports: moduleExports }
      
      // 处理ES6模块语法，将export转换为CommonJS格式
      let processedContent = result.content
        .replace(/export\s+default\s+/g, 'module.exports = ')
        .replace(/export\s*{([^}]+)}\s*;?/g, (match, exports) => {
          const exportItems = exports.split(',').map(item => item.trim())
          return exportItems.map(item => {
            const [name, alias] = item.split(' as ').map(s => s.trim())
            return `module.exports.${alias || name} = ${name};`
          }).join('\n')
        })
        .replace(/export\s+(const|let|var|function|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, 
          (match, type, name) => {
            return `${type} ${name}`
          })
      
      // 如果还有export语句，添加到module.exports
      if (processedContent.includes('export ')) {
        processedContent = processedContent.replace(/export\s+(const|let|var|function|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, 
          (match, type, name) => {
            return `${type} ${name}; module.exports.${name} = ${name};`
          })
      }
      
      // 执行JavaScript代码
      const func = new Function('module', 'exports', processedContent)
      func(module, moduleExports)
      
      // 获取导出的类或对象
      let gameplayClass = module.exports.default || module.exports
      
      // 如果导出的是类，则实例化
      if (typeof gameplayClass === 'function') {
        this.currentGameplay = new gameplayClass()
      } else {
        this.currentGameplay = gameplayClass
      }
      
      // 验证配置
      if (!this.validateGameplayConfig(this.currentGameplay)) {
        throw new Error('无效的玩法配置文件')
      }
      
      console.log('外部玩法加载成功:', this.currentGameplay.title)
      return this.currentGameplay
    } catch (error) {
      console.error('加载JS玩法文件失败:', error)
      throw error
    }
  }
  
  /**
   * 验证玩法配置
   * @param {Object} config - 配置对象
   */
  validateGameplayConfig(config) {
    const required = ['title', 'description', 'requiredDevices', 'start', 'loop']
    
    for (const field of required) {
      if (!config[field]) {
        console.error(`缺少必需字段: ${field}`)
        return false
      }
    }
    
    if (typeof config.start !== 'function') {
      console.error('start 必须是函数')
      return false
    }
    
    if (typeof config.loop !== 'function') {
      console.error('loop 必须是函数')
      return false
    }
    
    return true
  }
  
  /**
   * 验证设备依赖
   * @param {Array} requiredDevices - 需要的设备列表
   */
  async validateDeviceDependencies(requiredDevices) {
    if (!Array.isArray(requiredDevices)) {
      throw new Error('requiredDevices 必须是数组')
    }
    
    try {
      // 验证用户映射的设备是否满足玩法需求
       for (const deviceReq of requiredDevices) {
         if (deviceReq.required) {
           const mappedDevice = this.deviceManager.deviceMap.get(deviceReq.logicalId)
           if (!mappedDevice) {
             const errorMsg = `必需的设备未映射: ${deviceReq.name || deviceReq.logicalId}`
             this.sendLog(errorMsg, 'error')
             throw new Error(errorMsg)
           }
           
           // 验证设备是否在线
           if (!mappedDevice.connected) {
             const errorMsg = `必需的设备离线: ${mappedDevice.name} (${deviceReq.logicalId})`
             this.sendLog(errorMsg, 'error')
             throw new Error(errorMsg)
           }
           
           this.sendLog(`设备验证通过: ${deviceReq.logicalId} -> ${mappedDevice.name}`, 'success')
         }
       }
      
      console.log('设备依赖验证通过')
    } catch (error) {
      console.error('设备依赖验证失败:', error)
      throw error
    }
  }
  
  /**
   * 启动玩法
   * @param {Object} config - 玩法配置
   * @param {Object} deviceMapping - 设备映射
   * @param {Object} parameters - 参数配置
   */
  async startGameplay(config, deviceMapping, parameters) {
    if (this.isRunning) {
      throw new Error('已有玩法正在运行')
    }
    
    this.gameplayConfig = config
    this.gameplayParameters = parameters
    
    this.sendLog(`准备启动玩法: ${this.currentGameplay.title}`, 'info')
    
    // 应用设备映射
    this.applyDeviceMapping(deviceMapping)
    
    // 验证设备依赖
    const requiredDevices = this.currentGameplay.requiredDevices || []
    this.validateDeviceDependencies(requiredDevices)
    
    this.sendLog(`开始执行玩法启动流程...`, 'info')
    
    try {
      // 为外部玩法提供日志接口和TTS接口
      if (this.currentGameplay) {
        this.currentGameplay.log = (message, level = 'info') => {
          this.sendLog(`[${this.currentGameplay.title}] ${message}`, level)
        }
        
        // 提供TTS方法接口
        this.currentGameplay.tts = {
          speak: (text, options = {}) => this.speakText(text, options),
          stop: () => this.stopTTS(),
          checkSupport: () => this.checkTTSSupport(),
          getVoices: () => this.getTTSVoices()
        }
        
        this.sendLog('已为外部游戏提供TTS接口', 'info')
      }
      
      // 调用玩法的start方法
      if (typeof this.currentGameplay.start === 'function') {
        await this.currentGameplay.start(this.deviceManager, this.gameplayParameters)
      }
      
      this.isRunning = true
      this.startTime = Date.now()
      
      this.sendLog(`玩法 "${this.currentGameplay.title}" 启动成功`, 'success')
      
      // 启动游戏循环
      this.startGameLoop()
      
    } catch (error) {
      this.sendLog(`玩法启动失败: ${error.message}`, 'error')
      throw error
    }
  }
  
  /**
   * 启动游戏循环
   */
  startGameLoop() {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval)
    }
    
    this.sendLog('启动游戏循环', 'info')
    
    this.gameLoopInterval = setInterval(async () => {
      if (!this.isRunning) {
        return
      }
      
      try {
        // 调用玩法的loop方法
        if (typeof this.currentGameplay.loop === 'function') {
          const shouldContinue = await this.currentGameplay.loop(this.deviceManager)
          if (shouldContinue === false) {
            this.sendLog('玩法循环返回结束信号', 'info')
            await this.endGameplay()
          }
        }
      } catch (error) {
        this.sendLog(`游戏循环执行错误: ${error.message}`, 'error')
        await this.endGameplay()
      }
    }, 1000) // 每秒执行一次
  }
  
  /**
   * 执行游戏循环
   */
  async executeLoop() {
    if (!this.isRunning || !this.currentGameplay) {
      return
    }
    
    try {
      await this.currentGameplay.loop(this.deviceManager)
    } catch (error) {
      console.error('游戏循环执行错误:', error)
      // 可以选择停止游戏或继续运行
    }
  }
  

  
  /**
   * 结束玩法
   */
  async endGameplay() {
    if (!this.isRunning) {
      return
    }
    
    try {
      // 停止循环
      if (this.gameLoopInterval) {
        clearInterval(this.gameLoopInterval)
        this.gameLoopInterval = null
      }
      
      // 调用玩法的结束方法（如果存在）
      if (typeof this.currentGameplay.end === 'function') {
        await this.currentGameplay.end(this.deviceManager)
      }
      
      this.isRunning = false
      
      // 清理设备管理器
      this.deviceManager.cleanup()
      
      console.log('玩法已结束')
    } catch (error) {
      console.error('结束玩法时出错:', error)
      throw error
    }
  }
  
  /**
   * 停止玩法
   */
  async stopGameplay() {
    if (!this.isRunning) {
      return
    }
    
    try {
      this.sendLog(`正在停止玩法: ${this.currentGameplay.title}`, 'info')
      
      // 停止游戏循环
      if (this.gameLoopInterval) {
        clearInterval(this.gameLoopInterval)
        this.gameLoopInterval = null
        this.sendLog('游戏循环已停止', 'info')
      }
      
      // 调用玩法的end方法
      if (typeof this.currentGameplay.end === 'function') {
        await this.currentGameplay.end(this.deviceManager)
      }
      
      // 清理设备管理器监听器
      this.deviceManager.cleanup()
      this.sendLog('设备监听器已清理', 'info')
      
      this.isRunning = false
      
      const duration = Date.now() - this.startTime
      this.sendLog(`玩法 "${this.currentGameplay.title}" 已停止，运行时长: ${Math.floor(duration / 1000)}秒`, 'success')
      
    } catch (error) {
      this.sendLog(`停止玩法时发生错误: ${error.message}`, 'error')
      throw error
    }
  }
  
  /**
   * 应用设备映射
   * @param {Object} deviceMapping - 设备映射配置
   */
  applyDeviceMapping(deviceMapping) {
    this.deviceMapping = deviceMapping
    
    // 清空现有的设备映射
    this.deviceManager.deviceMap.clear()
    
    // 初始化设备存储
    const store = this.deviceManager.initDeviceStore()
    
    this.sendLog('开始应用用户设备映射...', 'info')
    
    // 根据用户映射建立 deviceMap
    for (const [logicalId, deviceId] of Object.entries(deviceMapping)) {
      if (deviceId) {
        // 查找对应的设备
        const device = store.devices.find(d => d.id === deviceId)
        if (device) {
          this.deviceManager.deviceMap.set(logicalId, device)
          this.sendLog(`设备映射成功: ${logicalId} -> ${device.name} (${deviceId})`, 'success')
        } else {
          this.sendLog(`设备映射失败: ${logicalId} -> 设备 ${deviceId} 未找到`, 'error')
        }
      }
    }
    
    this.sendLog(`用户设备映射完成，共映射 ${this.deviceManager.deviceMap.size} 个设备`, 'success')
    console.log('设备映射已应用:', deviceMapping)
  }
  
  /**
   * 应用参数配置
   * @param {Object} parameters - 参数配置
   */
  applyParameters(parameters) {
    if (this.currentGameplay && typeof this.currentGameplay.updateParameters === 'function') {
      this.currentGameplay.updateParameters(parameters)
    }
    this.gameplayParameters = parameters
    console.log('参数配置已应用:', parameters)
  }
  
  /**
   * 获取玩法状态
   */
  getGameplayStatus() {
    return {
      isRunning: this.isRunning,

      currentGameplay: this.currentGameplay ? {
        title: this.currentGameplay.title,
        description: this.currentGameplay.description,
        version: this.currentGameplay.version,
        author: this.currentGameplay.author
      } : null
    }
  }
  
  /**
   * 获取外部玩法状态
   */
  getExternalGameplayStatus() {
    if (!this.currentGameplay) {
      return { status: 'idle' }
    }
    
    return {
      status: this.currentGameplay.state || 'idle',
      title: this.currentGameplay.title,
      description: this.currentGameplay.description
    }
  }
  
  /**
   * 解析文件路径，处理特殊标记
   * @param {string} filePath - 原始文件路径
   * @returns {Promise<string>} 解析后的文件路径
   */
  async resolveFilePath(filePath) {
    if (!filePath) return filePath
    
    // 处理<OUTTER_GAME>标记
    if (filePath.includes('<OUTTER_GAME>')) {
      try {
        // 获取应用路径信息
        const pathInfo = await window.electronAPI?.invoke('get-app-paths')
        let outterGamePath
        
        if (pathInfo) {
          if (import.meta.env.DEV) {
            // 开发环境：直接从项目目录
            outterGamePath = `${pathInfo.appPath}/outter-game`
          } else {
            // 生产环境：从extraResources
            outterGamePath = `${pathInfo.resourcesPath}/outter-game`
          }
        } else {
          // 回退方案
          if (import.meta.env.DEV) {
            outterGamePath = 'e:/develop/electron-client/outter-game'
          } else {
            outterGamePath = './outter-game'
          }
        }
        
        return filePath.replace('<OUTTER_GAME>', outterGamePath)
      } catch (error) {
        this.sendLog(`路径解析失败: ${error.message}`, 'error')
        // 回退到原始路径
        return filePath
      }
    }
    
    return filePath
  }
  
  /**
   * 读取外部文件内容
   * @param {string} filePath - 文件路径（支持<OUTTER_GAME>标记）
   * @returns {Promise<string>} 文件内容
   */
  async readExternalFile(filePath) {
    try {
      // 解析路径标记
      const resolvedPath = await this.resolveFilePath(filePath)
      
      if (resolvedPath !== filePath) {
        this.sendLog(`路径解析: ${filePath} -> ${resolvedPath}`, 'info')
      }
      
      const result = await window.electronAPI.invoke('read-file', resolvedPath)
      if (!result.success) {
        throw new Error(`读取文件失败: ${result.error}`)
      }
      return result.content
    } catch (error) {
      this.sendLog(`读取文件失败: ${error.message}`, 'error')
      throw error
    }
  }

  /**
   * TTS文本转语音
   * @param {string} text - 要转换的文本
   * @param {Object} options - TTS选项（可选）
   * @param {string} options.voice - 语音名称
   * @param {number} options.rate - 语音速度
   * @returns {Promise<boolean>} 是否成功
   */
  async speakText(text, options = {}) {
    try {
      this.sendLog(`TTS播放: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`, 'info')
      
      const result = await window.electronAPI.invoke('tts-speak', text, options)
      if (result.success) {
        this.sendLog('TTS播放成功', 'success')
        return true
      } else {
        this.sendLog(`TTS播放失败: ${result.error}`, 'error')
        return false
      }
    } catch (error) {
      this.sendLog(`TTS调用异常: ${error.message}`, 'error')
      return false
    }
  }

  /**
   * 停止TTS播放
   * @returns {Promise<boolean>} 是否成功
   */
  async stopTTS() {
    try {
      const result = await window.electronAPI.invoke('tts-stop')
      if (result.success) {
        this.sendLog('TTS播放已停止', 'info')
        return true
      } else {
        this.sendLog(`停止TTS失败: ${result.error}`, 'error')
        return false
      }
    } catch (error) {
      this.sendLog(`停止TTS异常: ${error.message}`, 'error')
      return false
    }
  }

  /**
   * 检查TTS支持状态
   * @returns {Promise<boolean>} 是否支持TTS
   */
  async checkTTSSupport() {
    try {
      const result = await window.electronAPI.invoke('tts-check-support')
      if (result.success) {
        this.sendLog(`TTS支持状态: ${result.data ? '支持' : '不支持'}`, 'info')
        return result.data
      } else {
        this.sendLog(`检查TTS支持失败: ${result.error}`, 'error')
        return false
      }
    } catch (error) {
      this.sendLog(`检查TTS支持异常: ${error.message}`, 'error')
      return false
    }
  }

  /**
   * 获取可用的TTS语音列表
   * @returns {Promise<Array>} 语音列表
   */
  async getTTSVoices() {
    try {
      const result = await window.electronAPI.invoke('tts-get-voices')
      if (result.success) {
        this.sendLog(`获取到 ${result.data.length} 个TTS语音`, 'info')
        return result.data
      } else {
        this.sendLog(`获取TTS语音失败: ${result.error}`, 'error')
        return []
      }
    } catch (error) {
      this.sendLog(`获取TTS语音异常: ${error.message}`, 'error')
      return []
    }
  }
  
  /**
   * 保存游戏状态到本地存储
   * @param {string} key - 存储键名
   * @param {Object} state - 状态数据
   */
  saveGameState(key, state) {
    try {
      const stateKey = `gameplay_state_${key}`
      localStorage.setItem(stateKey, JSON.stringify(state))
      this.sendLog(`状态已保存: ${key}`, 'info')
    } catch (error) {
      this.sendLog(`保存状态失败: ${error.message}`, 'error')
      throw error
    }
  }
  
  /**
   * 从本地存储加载游戏状态
   * @param {string} key - 存储键名
   * @returns {Object|null} 状态数据
   */
  loadGameState(key) {
    try {
      const stateKey = `gameplay_state_${key}`
      const stateData = localStorage.getItem(stateKey)
      if (stateData) {
        const state = JSON.parse(stateData)
        this.sendLog(`状态已加载: ${key}`, 'info')
        return state
      }
      return null
    } catch (error) {
      this.sendLog(`加载状态失败: ${error.message}`, 'error')
      return null
    }
  }
  
  /**
   * 清除游戏状态
   * @param {string} key - 存储键名
   */
  clearGameState(key) {
    try {
      const stateKey = `gameplay_state_${key}`
      localStorage.removeItem(stateKey)
      this.sendLog(`状态已清除: ${key}`, 'info')
    } catch (error) {
      this.sendLog(`清除状态失败: ${error.message}`, 'error')
    }
  }
  
  /**
   * 清理资源
   */
  cleanup() {
    if (this.isRunning) {
      this.endGameplay()
    }
    
    this.currentGameplay = null
    this.gameplayConfig = null
    this.deviceManager.cleanup()
  }
}

// 创建并导出服务实例
// 注意：这里不会立即初始化Pinia store，而是在实际使用时才初始化
export const gameplayService = new GameplayService()
export default gameplayService