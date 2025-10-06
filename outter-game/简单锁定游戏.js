/**
 * 简单锁定游戏 - 基础的时间锁定机制
 * 这是一个简单的示例，展示最基本的玩法实现
 */
export class SimpleLockGame {
  constructor() {
    this.title = "简单锁定游戏"
    this.description = "基础的时间锁定机制，设定时间后自动解锁"
    this.version = "1.0.0"
    this.author = "示例作者"
    
    this.state = {
      startTime: 0,
      isLocked: false
    }
  }
  
  /**
   * 设备依赖 - 只需要自动锁
   */
  get requiredDevices() {
    return [
      {
        logicalId: "auto_lock",
        type: "ZIDONGSUO",
        name: "自动锁",
        required: true,
        description: "用于锁定和解锁"
      }
    ]
  }
  
  /**
   * 游戏参数 - 可以自定义锁定时间
   */
  getGameParams() {
    return {
      lockDuration: 5 * 60 * 1000, // 5分钟
      checkInterval: 5000, // 每5秒检查一次
      showCountdown: true
    }
  }
  
  // 游戏参数
  duration = 20 * 60 * 1000 // 20分钟
  lockCheckInterval = 5000 // 5秒检查一次
  unlockPenalty = 10000 // 解锁惩罚时间10秒
  maxUnlockAttempts = 3 // 最大解锁尝试次数
  
  // 可配置参数定义
  parameters = {
    duration: {
      name: '游戏时长',
      type: 'number',
      min: 1,
      max: 180,
      step: 1,
      default: 20,
      description: '游戏持续时间（分钟）'
    },
    lockCheckInterval: {
      name: '检查间隔',
      type: 'number',
      min: 1,
      max: 30,
      step: 1,
      default: 5,
      description: '锁定状态检查间隔（秒）'
    },
    unlockPenalty: {
      name: '解锁惩罚时间',
      type: 'number',
      min: 5,
      max: 60,
      step: 5,
      default: 10,
      description: '非法解锁的惩罚时间（秒）'
    },
    maxUnlockAttempts: {
      name: '最大解锁次数',
      type: 'number',
      min: 1,
      max: 10,
      step: 1,
      default: 3,
      description: '允许的最大解锁尝试次数'
    },
    strictMode: {
      name: '严格模式',
      type: 'boolean',
      default: false,
      description: '启用严格模式（解锁后立即重新锁定）'
    }
  }
  
  /**
   * 更新参数配置
   * @param {Object} newParams - 新的参数配置
   */
  updateParameters(newParams) {
    if (newParams.duration) {
      this.duration = newParams.duration * 60 * 1000 // 转换为毫秒
    }
    if (newParams.lockCheckInterval) {
      this.lockCheckInterval = newParams.lockCheckInterval * 1000 // 转换为毫秒
    }
    if (newParams.unlockPenalty) {
      this.unlockPenalty = newParams.unlockPenalty * 1000 // 转换为毫秒
    }
    if (newParams.maxUnlockAttempts) {
      this.maxUnlockAttempts = newParams.maxUnlockAttempts
    }
    if (newParams.strictMode !== undefined) {
      this.strictMode = newParams.strictMode
    }
    
    console.log('参数已更新:', newParams)
  }
  
  /**
   * 开始游戏
   * @param {DeviceManager} deviceManager - 设备管理器
   * @param {Object} params - 游戏参数
   */
  async start(deviceManager, params) {
    this.deviceManager = deviceManager
    this.updateParameters(params)
    
    // 获取自动锁设备
    this.targetDevice = 'auto_lock' // 使用逻辑设备ID
    
    if (this.log) {
      this.log('简单锁定游戏正在启动...', 'info')
    }else{
      console.log('log未定义')
    }
    
    // 设置设备属性监听器 - 监听open属性变化
    this.deviceManager.listenDeviceProperty(this.targetDevice, 'open', (value, data) => {
      if (this.log) {
        this.log(`设备open属性变化: ${value}`, 'info')
      }
      if (value === 1) {
        this.log('检测到设备被解锁！', 'warning')
      }
    })
    
    // 监听设备所有MQTT消息
    this.deviceManager.listenDeviceMessages(this.targetDevice, (data) => {
      if (this.log) {
        this.log(`收到设备消息: ${JSON.stringify(data)}`, 'debug')
      }
    })
    
    // 锁定设备 - 设置设备属性open为0
    const success = await this.deviceManager.setDeviceProperty(
      this.targetDevice,
      'open',
      0
    )
    
    if (success) {
      this.startTime = Date.now()
      if (this.log) {
        this.log(`简单锁定游戏开始，持续时间: ${Math.floor(this.duration/60000)}分钟`, 'success')
      }
      
      // 示例：发送自定义MQTT消息
      await this.deviceManager.sendDeviceMqttMessage(this.targetDevice, {
        type: 'game_start',
        duration: this.duration,
        timestamp: Date.now()
      })
      
    } else {
      if (this.log) {
        this.log('设备锁定失败', 'error')
      }
      throw new Error('设备锁定失败')
    }
  }
  
  /**
   * 游戏循环
   * @param {DeviceManager} deviceManager - 设备管理器
   */
  async loop(deviceManager) {
    const elapsed = Date.now() - this.startTime
    const remaining = this.duration - elapsed
    
    if (remaining <= 0) {
      // 时间到，结束游戏
      if (this.log) {
        this.log('锁定时间已到，游戏即将结束', 'info')
      }
      return false
    }
    
    // 每30秒输出一次状态
    if (elapsed % 30000 < 1000) {
      if (this.log) {
        const remainingMinutes = Math.ceil(remaining / 60000)
        this.log(`剩余锁定时间: ${remainingMinutes}分钟`, 'info')
      }
    }
    
    // 每5秒输出一次详细状态（用于调试）
    if (elapsed % 5000 < 1000) {
      if (this.log) {
        const remainingSeconds = Math.ceil(remaining / 1000)
        this.log(`游戏循环运行中，剩余: ${remainingSeconds}秒`, 'debug')
        
        // 示例：读取设备当前的open属性值
        const openValue = this.deviceManager.getDeviceProperty(this.targetDevice, 'open')
        if (openValue !== null) {
          this.log(`当前设备open属性值: ${openValue}`, 'debug')
        }
      }
    }
    
    return true
  }
  
  /**
   * 结束游戏
   * @param {DeviceManager} deviceManager - 设备管理器
   */
  async end(deviceManager) {
    const totalTime = Date.now() - this.startTime
    
    // 解锁设备 - 设置设备属性open为1
    await this.deviceManager.setDeviceProperty(
      this.targetDevice,
      'open',
      1
    )
    
    // 发送游戏结束消息
    await this.deviceManager.sendDeviceMqttMessage(this.targetDevice, {
      type: 'game_end',
      totalTime: totalTime,
      timestamp: Date.now()
    })
    
    if (this.log) {
      this.log(`简单锁定游戏结束，总锁定时间: ${Math.floor(totalTime / 1000)}秒`, 'success')
    }
  }
}

// 导出游戏类 (CommonJS格式)
module.exports = SimpleLockGame;
module.exports.default = SimpleLockGame;