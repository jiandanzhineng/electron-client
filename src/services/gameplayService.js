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
   * 映射逻辑设备到实际设备
   * @param {Array} requiredDevices - 需要的设备列表
   */
  mapDevices(requiredDevices) {
    const store = this.initDeviceStore()
    this.deviceMap.clear()
    
    this.sendLog('开始设备映射...', 'info')
    
    for (const deviceReq of requiredDevices) {
      const actualDevice = this.findBestMatchDevice(deviceReq)
      if (actualDevice) {
        this.deviceMap.set(deviceReq.logicalId, actualDevice)
        this.sendLog(`设备映射成功: ${deviceReq.name || deviceReq.logicalId} -> ${actualDevice.name}`, 'success')
      } else if (deviceReq.required) {
        const errorMsg = `找不到必需的设备: ${deviceReq.name || deviceReq.type}`
        this.sendLog(errorMsg, 'error')
        throw new Error(errorMsg)
      } else {
        this.sendLog(`可选设备未找到: ${deviceReq.name || deviceReq.logicalId}`, 'warning')
      }
    }
    
    this.sendLog(`设备映射完成，共映射 ${this.deviceMap.size} 个设备`, 'success')
  }

  /**
   * 查找最佳匹配的设备
   * @param {Object} deviceReq - 设备需求
   */
  findBestMatchDevice(deviceReq) {
    const store = this.initDeviceStore()
    
    // 首先按类型查找
    const devicesByType = store.devices.filter(device => 
      device.type === deviceReq.type && device.connected === true
    )
    
    if (devicesByType.length === 0) {
      return null
    }
    
    // 如果有多个同类型设备，选择第一个在线的
    return devicesByType[0]
  }

  /**
   * 执行设备动作
   * @param {string} logicalId - 逻辑设备ID
   * @param {string} action - 动作名称
   * @param {Object} params - 动作参数
   */
  async executeDeviceAction(logicalId, action, params = {}) {
    const device = this.deviceMap.get(logicalId)
    if (!device) {
      this.sendLog(`设备未找到: ${logicalId}`, 'error')
      return false
    }

    try {
      this.sendLog(`执行设备动作: ${device.name} -> ${action}`, 'info')
      
      // 这里应该通过IPC调用主进程的设备控制方法
      // 暂时使用模拟实现
      const result = await this.sendDeviceCommand(device, action, params)
      
      this.sendLog(`设备动作执行成功: ${device.name} -> ${action}`, 'success')
      return result
    } catch (error) {
      this.sendLog(`设备动作执行失败: ${device.name} -> ${action} (${error.message})`, 'error')
      return false
    }
  }

  /**
   * 发送设备命令（通过IPC）
   * @param {Object} device - 设备对象
   * @param {string} action - 动作名称
   * @param {Object} params - 参数
   */
  async sendDeviceCommand(device, action, params) {
    // 这里应该调用Electron的IPC通信
    // 暂时返回模拟结果
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, action, params, deviceId: device.id })
      }, 100)
    })
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
        const callback = this.sensorCallbacks.get(logicalId)
        if (callback) {
          callback(data)
        }
        break
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
   * 清理资源
   */
  cleanup() {
    this.deviceMap.clear()
    this.sensorCallbacks.clear()
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
    this.isPaused = false
    this.gameLoopInterval = null
    this.startTime = 0
    this.deviceManager = new DeviceManager(this)
    this.logCallback = null
    
    // 绑定方法上下文
    this.executeLoop = this.executeLoop.bind(this)
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
      // 映射设备
      this.deviceManager.mapDevices(requiredDevices)
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
      // 为外部玩法提供日志接口
      if (this.currentGameplay) {
        this.currentGameplay.log = (message, level = 'info') => {
          this.sendLog(`[${this.currentGameplay.title}] ${message}`, level)
        }
      }
      
      // 调用玩法的start方法
      if (typeof this.currentGameplay.start === 'function') {
        await this.currentGameplay.start(this.deviceManager, this.gameplayParameters)
      }
      
      this.isRunning = true
      this.isPaused = false
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
      if (!this.isRunning || this.isPaused) {
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
    if (!this.isRunning || this.isPaused || !this.currentGameplay) {
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
   * 暂停玩法
   */
  async pauseGameplay() {
    if (!this.isRunning) {
      throw new Error('玩法未在运行')
    }
    
    this.isPaused = true
    
    // 调用玩法的暂停方法（如果存在）
    if (typeof this.currentGameplay.pause === 'function') {
      await this.currentGameplay.pause(this.deviceManager)
    }
    
    this.sendLog(`玩法 "${this.currentGameplay.title}" 已暂停`, 'info')
  }
  
  /**
   * 恢复玩法
   */
  async resumeGameplay() {
    if (!this.isRunning) {
      throw new Error('玩法未在运行')
    }
    
    if (!this.isPaused) {
      throw new Error('玩法未暂停')
    }
    
    this.isPaused = false
    
    // 调用玩法的恢复方法（如果存在）
    if (typeof this.currentGameplay.resume === 'function') {
      await this.currentGameplay.resume(this.deviceManager)
    }
    
    this.sendLog(`玩法 "${this.currentGameplay.title}" 已恢复`, 'info')
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
      this.isPaused = false
      
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
      
      this.isRunning = false
      this.isPaused = false
      
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
      isPaused: this.isPaused,
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