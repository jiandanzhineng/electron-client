/**
 * 电击惩罚游戏 - 基于时间和概率的电击惩罚机制
 * 这是一个示例外部玩法文件，展示如何使用类的方式定义复杂的游戏逻辑
 */
export class ShockPunishmentGame {
  constructor() {
    this.title = "电击惩罚游戏"
    this.description = "基于时间和概率的电击惩罚机制，随着时间推移电击概率和强度会逐渐增加"
    this.version = "1.0.0"
    this.author = "游戏设计师"
    
    // 游戏状态
    this.state = {
      shockCount: 0,
      lastShockTime: 0,
      playerScore: 0,
      currentPhase: 'warmup', // warmup, normal, intense, final
      movementBonus: 0
    }
  }
  
  /**
   * 设备依赖配置
   */
  get requiredDevices() {
    return [
      {
        id: "auto_lock",
        type: "ZIDONGSUO",
        name: "自动锁",
        required: true,
        description: "用于控制游戏开始和结束"
      },
      {
        id: "shock_device",
        type: "DIANJI", 
        name: "电击设备",
        required: true,
        description: "执行电击惩罚"
      },
      {
        id: "sensor",
        type: "sensor",
        name: "运动传感器",
        required: false,
        description: "检测玩家运动状态，影响电击概率"
      }
    ]
  }
  
  /**
   * 获取游戏参数
   */
  getGameParams() {
    return {
      duration: 15 * 60 * 1000, // 15分钟
      baseShockProbability: 0.05, // 基础5%概率
      maxShockIntensity: 80,
      checkInterval: 1000, // 每秒检查一次
      phases: {
        warmup: { duration: 3 * 60 * 1000, multiplier: 0.5 }, // 前3分钟热身
        normal: { duration: 6 * 60 * 1000, multiplier: 1.0 }, // 中间6分钟正常
        intense: { duration: 4 * 60 * 1000, multiplier: 1.5 }, // 4分钟强化
        final: { duration: 2 * 60 * 1000, multiplier: 2.0 }   // 最后2分钟冲刺
      }
    }
  }
  
  // 可配置参数定义
  parameters = {
    duration: {
      name: '游戏时长',
      type: 'number',
      min: 5,
      max: 120,
      step: 5,
      default: 30,
      description: '游戏持续时间（分钟）'
    },
    shockProbability: {
      name: '电击概率',
      type: 'number',
      min: 0.1,
      max: 1.0,
      step: 0.1,
      default: 0.3,
      description: '每次检查时触发电击的概率（0.1-1.0）'
    },
    baseShockIntensity: {
      name: '基础电击强度',
      type: 'number',
      min: 10,
      max: 100,
      step: 5,
      default: 50,
      description: '电击的基础强度（10-100）'
    },
    maxShockIntensity: {
      name: '最大电击强度',
      type: 'number',
      min: 20,
      max: 100,
      step: 5,
      default: 80,
      description: '电击的最大强度（20-100）'
    },
    difficulty: {
      name: '难度等级',
      type: 'select',
      options: [
        { value: 'easy', label: '简单' },
        { value: 'normal', label: '普通' },
        { value: 'hard', label: '困难' }
      ],
      default: 'normal',
      description: '游戏难度等级'
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
    if (newParams.shockProbability) {
      this.shockProbability = newParams.shockProbability
    }
    if (newParams.baseShockIntensity) {
      this.baseShockIntensity = newParams.baseShockIntensity
    }
    if (newParams.maxShockIntensity) {
      this.maxShockIntensity = newParams.maxShockIntensity
    }
    if (newParams.difficulty) {
      this.applyDifficultySettings(newParams.difficulty)
    }
    
    console.log('参数已更新:', newParams)
  }
  
  /**
   * 应用难度设置
   * @param {string} difficulty - 难度等级
   */
  applyDifficultySettings(difficulty) {
    switch (difficulty) {
      case 'easy':
        this.shockProbability *= 0.7
        this.maxShockIntensity *= 0.8
        break
      case 'hard':
        this.shockProbability *= 1.3
        this.maxShockIntensity *= 1.2
        break
      // normal 保持默认值
    }
  }
  
  /**
   * 游戏开始初始化
   * @param {Object} deviceManager - 设备管理器
   * @param {Object} params - 游戏参数
   */
  async start(deviceManager, params) {
    console.log('🎮 电击惩罚游戏开始！')
    
    // 重置游戏状态
    this.state = {
      shockCount: 0,
      lastShockTime: 0,
      playerScore: 0,
      currentPhase: 'warmup',
      movementBonus: 0
    }
    
    // 锁定设备
    console.log('🔒 锁定自动锁...')
    await deviceManager.executeAction('auto_lock', 'lock')
    
    // 关闭电击设备
    console.log('⚡ 初始化电击设备...')
    await deviceManager.executeAction('shock_device', 'disable')
    
    // 如果有传感器，开始监听
    if (deviceManager.hasDevice('sensor')) {
      console.log('📡 开始监听运动传感器...')
      deviceManager.startSensorMonitoring('sensor', (data) => {
        this.handleSensorData(data)
      })
    }
    
    // 播放开始提示
    await this.playStartSound()
    await this.showWelcomeMessage()
    
    console.log('✅ 游戏初始化完成，开始游戏循环')
  }
  
  /**
   * 游戏主循环
   * @param {Object} deviceManager - 设备管理器
   * @param {Object} params - 游戏参数
   * @param {number} elapsed - 已经过时间（毫秒）
   */
  async loop(deviceManager, params, elapsed) {
    // 更新游戏阶段
    this.updateGamePhase(params, elapsed)
    
    // 计算当前电击概率
    const shockProbability = this.calculateShockProbability(params, elapsed)
    
    // 概率性电击判定
    if (Math.random() < shockProbability) {
      await this.executeShock(deviceManager, params)
    }
    
    // 更新玩家分数
    this.updatePlayerScore(elapsed)
    
    // 检查特殊事件
    await this.checkSpecialEvents(deviceManager, params, elapsed)
    
    // 输出状态信息（每30秒一次）
    if (elapsed % 30000 < 1000) {
      this.logGameStatus(elapsed, params.duration)
    }
    
    // 检查游戏结束条件
    if (elapsed >= params.duration) {
      return 'end'
    }
  }
  
  /**
   * 游戏结束处理
   * @param {Object} deviceManager - 设备管理器
   * @param {Object} params - 游戏参数
   */
  async end(deviceManager, params) {
    console.log('🏁 游戏结束！')
    
    // 解锁设备
    console.log('🔓 解锁自动锁...')
    await deviceManager.executeAction('auto_lock', 'unlock')
    
    // 关闭电击设备
    console.log('⚡ 关闭电击设备...')
    await deviceManager.executeAction('shock_device', 'disable')
    
    // 停止传感器监听
    if (deviceManager.hasDevice('sensor')) {
      console.log('📡 停止传感器监听...')
      deviceManager.stopSensorMonitoring('sensor')
    }
    
    // 播放结束音效和显示统计
    await this.playEndSound()
    await this.showCompletionMessage()
    
    console.log('📊 游戏统计:')
    console.log(`   电击次数: ${this.state.shockCount}`)
    console.log(`   最终分数: ${this.state.playerScore}`)
    console.log(`   最终阶段: ${this.state.currentPhase}`)
  }
  

  
  /**
   * 更新游戏阶段
   * @param {Object} params - 游戏参数
   * @param {number} elapsed - 已经过时间
   */
  updateGamePhase(params, elapsed) {
    const phases = params.phases
    let currentPhase = 'warmup'
    let phaseStart = 0
    
    if (elapsed < phases.warmup.duration) {
      currentPhase = 'warmup'
    } else if (elapsed < phases.warmup.duration + phases.normal.duration) {
      currentPhase = 'normal'
    } else if (elapsed < phases.warmup.duration + phases.normal.duration + phases.intense.duration) {
      currentPhase = 'intense'
    } else {
      currentPhase = 'final'
    }
    
    if (this.state.currentPhase !== currentPhase) {
      console.log(`🔄 进入新阶段: ${currentPhase}`)
      this.state.currentPhase = currentPhase
    }
  }
  
  /**
   * 计算电击概率
   * @param {Object} params - 游戏参数
   * @param {number} elapsed - 已经过时间
   */
  calculateShockProbability(params, elapsed) {
    let probability = params.baseShockProbability
    
    // 阶段倍数
    const phaseMultiplier = params.phases[this.state.currentPhase].multiplier
    probability *= phaseMultiplier
    
    // 时间因子：游戏后期概率增加
    const timeProgress = elapsed / params.duration
    probability *= (1 + timeProgress * 0.3)
    
    // 电击间隔因子：距离上次电击时间越长，概率越高
    const timeSinceLastShock = Date.now() - this.state.lastShockTime
    if (timeSinceLastShock > 60000) { // 1分钟无电击
      probability *= 1.8
    } else if (timeSinceLastShock > 30000) { // 30秒无电击
      probability *= 1.3
    }
    
    // 运动加成
    probability += this.state.movementBonus
    
    // 限制最大概率
    return Math.min(probability, 0.4) // 最大40%概率
  }
  
  /**
   * 计算电击强度
   * @param {Object} params - 游戏参数
   */
  calculateShockIntensity(params) {
    // 基础强度
    let intensity = 25
    
    // 阶段加成
    const phaseBonus = {
      'warmup': 0,
      'normal': 10,
      'intense': 20,
      'final': 30
    }
    intensity += phaseBonus[this.state.currentPhase] || 0
    
    // 随机因子
    intensity += Math.random() * 15
    
    // 累积因子（每次电击后强度略微增加）
    intensity += this.state.shockCount * 1.5
    
    // 限制最大强度
    return Math.min(Math.floor(intensity), params.maxShockIntensity)
  }
  
  /**
   * 执行电击
   * @param {Object} deviceManager - 设备管理器
   * @param {Object} params - 游戏参数
   */
  async executeShock(deviceManager, params) {
    const intensity = this.calculateShockIntensity(params)
    const duration = 1000 + (this.state.shockCount * 50) // 持续时间递增
    
    console.log(`⚡ 执行电击！强度: ${intensity}, 持续: ${duration}ms`)
    
    await deviceManager.executeAction('shock_device', 'shock', {
      intensity: intensity,
      duration: duration
    })
    
    // 更新状态
    this.state.shockCount++
    this.state.lastShockTime = Date.now()
    
    // 电击后的特殊处理
    await this.handlePostShock(deviceManager)
    
    // 重置运动加成
    this.state.movementBonus = 0
  }
  
  /**
   * 电击后处理
   * @param {Object} deviceManager - 设备管理器
   */
  async handlePostShock(deviceManager) {
    // 每5次电击的里程碑事件
    if (this.state.shockCount % 5 === 0) {
      console.log(`🎯 电击里程碑！已完成 ${this.state.shockCount} 次电击`)
      
      // 可以在这里添加特殊效果
      if (this.state.shockCount === 10) {
        console.log('🔥 达成10次电击成就！')
      } else if (this.state.shockCount === 25) {
        console.log('💀 达成25次电击成就！进入疯狂模式！')
      }
    }
  }
  
  /**
   * 更新玩家分数
   * @param {number} elapsed - 已经过时间
   */
  updatePlayerScore(elapsed) {
    // 基础分数：存活时间
    const timeScore = Math.floor(elapsed / 1000)
    
    // 电击惩罚
    const shockPenalty = this.state.shockCount * 10
    
    // 阶段奖励
    const phaseBonus = {
      'warmup': 0,
      'normal': 50,
      'intense': 100,
      'final': 200
    }
    
    this.state.playerScore = timeScore - shockPenalty + (phaseBonus[this.state.currentPhase] || 0)
  }
  
  /**
   * 检查特殊事件
   * @param {Object} deviceManager - 设备管理器
   * @param {Object} params - 游戏参数
   * @param {number} elapsed - 已经过时间
   */
  async checkSpecialEvents(deviceManager, params, elapsed) {
    const progress = elapsed / params.duration
    
    // 中场休息事件（50%进度时）
    if (progress > 0.5 && progress < 0.51) {
      console.log('☕ 中场休息时间！暂停电击5秒')
      await deviceManager.executeAction('shock_device', 'disable')
      setTimeout(async () => {
        await deviceManager.executeAction('shock_device', 'enable')
        console.log('⚡ 中场休息结束，恢复电击')
      }, 5000)
    }
    
    // 最后阶段警告（90%进度时）
    if (progress > 0.9 && progress < 0.91) {
      console.log('🚨 警告：进入最后阶段！电击概率大幅提升！')
    }
  }
  
  /**
   * 处理传感器数据
   * @param {Object} data - 传感器数据
   */
  handleSensorData(data) {
    // 检测剧烈运动
    if (data.movement && data.movement > 0.7) {
      console.log('🏃 检测到剧烈运动，增加电击概率')
      this.state.movementBonus = Math.min(this.state.movementBonus + 0.05, 0.2)
    }
    
    // 检测心率（如果传感器支持）
    if (data.heartRate && data.heartRate > 120) {
      console.log('💓 检测到心率过快，轻微增加电击概率')
      this.state.movementBonus = Math.min(this.state.movementBonus + 0.02, 0.2)
    }
  }
  
  /**
   * 输出游戏状态
   * @param {number} elapsed - 已经过时间
   * @param {number} duration - 总时长
   */
  logGameStatus(elapsed, duration) {
    const progress = ((elapsed / duration) * 100).toFixed(1)
    const remaining = Math.ceil((duration - elapsed) / 1000)
    
    console.log(`📊 游戏状态 - 进度: ${progress}%, 剩余: ${remaining}s, 阶段: ${this.state.currentPhase}, 电击: ${this.state.shockCount}次, 分数: ${this.state.playerScore}`)
  }
  
  // 辅助方法
  async playStartSound() {
    console.log('🔊 播放开始音效')
    // 这里可以实现实际的音效播放
  }
  
  async playEndSound() {
    console.log('🔊 播放结束音效')
    // 这里可以实现实际的音效播放
  }
  
  async showWelcomeMessage() {
    console.log('💬 显示欢迎消息: 电击惩罚游戏开始，祝你好运！')
    // 这里可以实现UI消息显示
  }
  
  async showCompletionMessage() {
    console.log('💬 显示完成消息: 恭喜完成游戏！')
    console.log(`   你总共承受了 ${this.state.shockCount} 次电击`)
    console.log(`   最终分数: ${this.state.playerScore} 分`)
    // 这里可以实现UI消息显示
  }
}

// 导出游戏类 (CommonJS格式)
module.exports = ShockPunishmentGame;
module.exports.default = ShockPunishmentGame;