/**
 * 俯卧撑检测训练游戏
 * 基于QTZ距离传感器检测俯卧撑动作，结合自动锁、电击和跳蛋设备进行训练激励和惩罚机制
 */
export class PushupDetectionGame {
  constructor() {
    this.title = "俯卧撑检测训练游戏"
    this.description = "通过距离传感器检测俯卧撑动作，完成指定数量获得解锁，长时间无动作触发惩罚"
    this.version = "1.0.0"
    this.author = "游戏设计师"
    
    // 当前配置的参数值
    this.config = {
      duration: 15,
      targetCount: 30,
      downThreshold: 15,
      upThreshold: 35,
      idleTimeLimit: 30,
      shockIntensity: 15,
      shockDuration: 3,
      randomIntensityRange: 10,
      randomDurationRange: 1,
      rewardTriggerCount: 5,
      rewardTriggerProbability: 30,
      vibratorIntensity: 100,
      vibratorDuration: 15
    }
    
    // 游戏状态
    this.state = {
      startTime: 0,
      isGameActive: false,
      isLocked: false,
      completedCount: 0,
      consecutiveCount: 0,
      currentDistance: 0,
      currentPhase: 'up', // 'up' 或 'down'
      lastActionTime: 0,
      lastIdleWarningTime: 0,
      isShocking: false,
      isVibratorActive: false,
      totalIdleTime: 0,
      punishmentCount: 0,
      rewardCount: 0
    }
    
    // UI相关
    this.uiAPI = null
    this.gameTimer = null
    this.statusUpdateTimer = null
    this.idleCheckTimer = null
    this.shockTimer = null
    this.vibratorTimer = null
  }
  
  /**
   * 设备依赖配置
   */
  get requiredDevices() {
    return [
      {
        logicalId: "distance_sensor",
        type: "QTZ",
        name: "QTZ距离传感器",
        required: true,
        description: "检测身体高度变化，判定俯卧撑动作"
      },
      {
        logicalId: "auto_lock",
        type: "ZIDONGSUO",
        name: "自动锁",
        required: false,
        description: "游戏开始时锁定，完成或超时后解锁"
      },
      {
        logicalId: "shock_device",
        type: "DIANJI",
        name: "电击设备",
        required: false,
        description: "长时间无动作时执行惩罚"
      },
      {
        logicalId: "vibrator_device",
        type: "TD01",
        name: "跳蛋设备",
        required: false,
        description: "连续完成动作后随机干扰"
      }
    ]
  }
  
  /**
   * 可配置参数定义
   */
  get parameters() {
    return {
      duration: {
        name: '游戏时长',
        type: 'number',
        min: 1,
        max: 240,
        step: 1,
        default: 15,
        description: '游戏持续时间（分钟）'
      },
      targetCount: {
        name: '目标完成数量',
        type: 'number',
        min: 1,
        max: 2000,
        step: 1,
        default: 30,
        description: '需要完成的俯卧撑数量'
      },
      downThreshold: {
        name: '下降阈值',
        type: 'number',
        min: 5,
        max: 30,
        step: 1,
        default: 15,
        description: '身体下降到此距离以下视为"下"（厘米）'
      },
      upThreshold: {
        name: '上升阈值',
        type: 'number',
        min: 20,
        max: 50,
        step: 1,
        default: 35,
        description: '身体上升到此距离以上视为"起"（厘米）'
      },
      idleTimeLimit: {
        name: '无动作时间限制',
        type: 'number',
        min: 5,
        max: 120,
        step: 1,
        default: 30,
        description: '无动作超过此时间触发惩罚（秒）'
      },
      shockIntensity: {
        name: '电击强度',
        type: 'number',
        min: 10,
        max: 100,
        step: 1,
        default: 15,
        description: '电击强度基础值（V）'
      },
      shockDuration: {
        name: '电击持续时间',
        type: 'number',
        min: 1,
        max: 10,
        step: 1,
        default: 3,
        description: '电击持续时间基础值（秒）'
      },
      randomIntensityRange: {
        name: '随机强度幅度',
        type: 'number',
        min: 0,
        max: 50,
        step: 1,
        default: 10,
        description: '随机电击强度幅度（±此值）'
      },
      randomDurationRange: {
        name: '随机时间幅度',
        type: 'number',
        min: 0,
        max: 5,
        step: 1,
        default: 1,
        description: '随机持续时间幅度（±此值）'
      },
      rewardTriggerCount: {
        name: '奖励触发数量',
        type: 'number',
        min: 1,
        max: 20,
        step: 1,
        default: 5,
        description: '连续完成多少个后开始奖励触发判定'
      },
      rewardTriggerProbability: {
        name: '奖励触发概率',
        type: 'number',
        min: 0,
        max: 100,
        step: 1,
        default: 30,
        description: '达到触发条件后每完成一个的干扰触发概率（%）'
      },
      vibratorIntensity: {
        name: '跳蛋强度',
        type: 'number',
        min: 0,
        max: 255,
        step: 1,
        default: 100,
        description: '跳蛋强度'
      },
      vibratorDuration: {
        name: '跳蛋工作时间',
        type: 'number',
        min: 5,
        max: 60,
        step: 1,
        default: 15,
        description: '跳蛋工作时间（秒）'
      }
    }
  }
  
  /**
   * 更新参数配置
   */
  updateParameters(newParams) {
    for (const [key, value] of Object.entries(newParams)) {
      if (this.config.hasOwnProperty(key)) {
        this.config[key] = value
      }
    }
    console.log('俯卧撑检测游戏参数已更新:', newParams)
    console.log('当前配置:', this.config)
  }
  
  /**
   * 游戏开始初始化
   */
  async start(deviceManager, params) {
    this.deviceManager = deviceManager
    this.updateParameters(params)
    
    // 获取UI API
    this.uiAPI = window.gameplayUI
    if (!this.uiAPI) {
      throw new Error('UI API未找到，请确保在正确的环境中运行')
    }
    
    this.log(`俯卧撑检测训练游戏 v${this.version} 正在启动...`, 'info')
    
    try {
      // 初始化游戏状态
      this.state = {
        startTime: Date.now(),
        isGameActive: true,
        isLocked: false,
        completedCount: 0,
        consecutiveCount: 0,
        currentDistance: 0,
        currentPhase: 'up',
        lastActionTime: Date.now(),
        lastIdleWarningTime: 0,
        isShocking: false,
        isVibratorActive: false,
        totalIdleTime: 0,
        punishmentCount: 0,
        rewardCount: 0
      }
      
      // 设置距离传感器监听
      await this.setupDistanceSensorListener()
      
      // 尝试锁定自动锁设备（如果存在）
      await this.setLockState(false)
      
      // 启动游戏计时器
      this.startGameTimer()
      
      // 启动状态更新计时器
      this.startStatusUpdateTimer()
      
      // 启动无动作检查计时器
      this.startIdleCheckTimer()
      
      // 渲染UI
      this.renderUI()
      
      this.log(`俯卧撑检测游戏已启动，目标: ${this.config.targetCount}个，时长: ${this.config.duration}分钟`, 'success')
      this.log('请开始做俯卧撑！保持标准动作姿势', 'info')
      
    } catch (error) {
      this.log(`游戏启动失败: ${error.message}`, 'error')
      throw error
    }
  }
  
  /**
   * 设置距离传感器监听
   */
  async setupDistanceSensorListener() {
    // 设置QTZ设备的高低阈值和报告延迟
    try {
      // 将cm单位的配置转换为mm单位发送给QTZ设备
      // 同时设置report_delay_ms为1000ms以提高响应速度
      await this.deviceManager.setDeviceProperty('distance_sensor', {
        low_band: this.config.downThreshold * 10,
        high_band: this.config.upThreshold * 10,
        report_delay_ms: 1000
      })
      
      this.log(`QTZ阈值已设置: 低阈值=${this.config.downThreshold}cm, 高阈值=${this.config.upThreshold}cm`, 'info')
      this.log('QTZ报告延迟已设置为1000ms，提高游戏响应速度', 'info')
    } catch (error) {
      this.log(`设置QTZ参数失败: ${error.message}`, 'error')
    }
    
    // 监听QTZ设备的阈值触发事件
    this.deviceManager.listenDeviceMessages('distance_sensor', (deviceData) => {
      this.handleQTZEvent(deviceData)
    })
    
    // 监听距离属性用于UI显示
    this.deviceManager.listenDeviceProperty('distance_sensor', 'distance', (newValue, deviceData) => {
      // QTZ传感器返回的是mm单位，转换为cm用于显示
      this.state.currentDistance = (newValue / 10).toFixed(1)
    })
    
    this.log('QTZ事件监听已设置，开始检测俯卧撑动作', 'info')
  }
  
  /**
   * 处理QTZ阈值触发事件
   */
  handleQTZEvent(deviceData) {
    if (!this.state.isGameActive) {
      return
    }
    
    const currentTime = Date.now()
    
    // 检查是否是阈值触发事件
    if (deviceData.method === 'low') {
      // 距离低于低阈值，进入下降阶段
      if (this.state.currentPhase === 'up') {
        this.state.currentPhase = 'down'
        this.state.lastActionTime = currentTime
        this.log(`动作检测: 下降阶段 (触发低阈值)`, 'info')
      }
    } else if (deviceData.method === 'high') {
      // 距离高于高阈值，回到上升阶段
      if (this.state.currentPhase === 'down') {
        this.state.currentPhase = 'up'
        this.state.lastActionTime = currentTime
        this.completePushup()
      }
    }
  }
  
  /**
   * 完成一个俯卧撑
   */
  async completePushup() {
    this.state.completedCount++
    this.state.consecutiveCount++
    
    this.log(`完成俯卧撑! 当前进度: ${this.state.completedCount}/${this.config.targetCount}`, 'success')
    
    // 检查是否达到目标
    if (this.state.completedCount >= this.config.targetCount) {
      await this.endGame(true)
      return
    }
    
    // 检查奖励触发
    await this.checkRewardTrigger()
  }
  
  /**
   * 检查奖励触发
   */
  async checkRewardTrigger() {
    if (this.state.consecutiveCount >= this.config.rewardTriggerCount) {
      const randomValue = Math.random() * 100
      if (randomValue < this.config.rewardTriggerProbability) {
        await this.triggerReward()
      }
    }
  }
  
  /**
   * 触发奖励（跳蛋干扰）
   */
  async triggerReward() {
    if (this.state.isVibratorActive) {
      return // 已经在工作中
    }
    
    try {
      this.state.isVibratorActive = true
      this.state.rewardCount++
      
      this.log(`触发奖励干扰! 强度: ${this.config.vibratorIntensity}, 时长: ${this.config.vibratorDuration}秒`, 'warning')
      
      // 启动跳蛋
      await this.deviceManager.setDeviceProperty('vibrator_device', {
        power: this.config.vibratorIntensity
      })
      
      // 设置停止计时器
      this.vibratorTimer = setTimeout(async () => {
        await this.stopVibrator()
      }, this.config.vibratorDuration * 1000)
      
    } catch (error) {
      this.log(`奖励触发失败: ${error.message}`, 'error')
      this.state.isVibratorActive = false
    }
  }
  
  /**
   * 停止跳蛋
   */
  async stopVibrator() {
    if (!this.state.isVibratorActive) {
      return
    }
    
    try {
      await this.deviceManager.setDeviceProperty('vibrator_device', {
        power: 0
      })
      
      this.state.isVibratorActive = false
      
      if (this.vibratorTimer) {
        clearTimeout(this.vibratorTimer)
        this.vibratorTimer = null
      }
      
      this.log('奖励干扰已停止', 'info')
      
    } catch (error) {
      this.log(`停止奖励失败: ${error.message}`, 'error')
    }
  }
  
  /**
   * 启动无动作检查计时器
   */
  startIdleCheckTimer() {
    this.idleCheckTimer = setInterval(() => {
      this.checkIdleTime()
    }, 1000) // 每秒检查一次
  }
  
  /**
   * 检查无动作时间
   */
  checkIdleTime() {
    if (!this.state.isGameActive || this.state.isShocking) {
      return
    }
    
    const currentTime = Date.now()
    const idleTime = (currentTime - this.state.lastActionTime) / 1000
    
    if (idleTime >= this.config.idleTimeLimit) {
      this.triggerPunishment()
    } else if (idleTime >= this.config.idleTimeLimit - 5 && 
               currentTime - this.state.lastIdleWarningTime > 5000) {
      // 提前5秒警告
      this.state.lastIdleWarningTime = currentTime
      this.log(`警告: 还有${Math.ceil(this.config.idleTimeLimit - idleTime)}秒将触发惩罚!`, 'warning')
    }
  }
  
  /**
   * 触发惩罚
   */
  async triggerPunishment() {
    if (this.state.isShocking) {
      return // 已经在惩罚中
    }
    
    try {
      // 重置连续完成数量
      this.state.consecutiveCount = 0
      this.state.punishmentCount++
      
      // 计算随机强度和时长
      const intensityVariation = (Math.random() - 0.5) * 2 * this.config.randomIntensityRange
      const durationVariation = (Math.random() - 0.5) * 2 * this.config.randomDurationRange
      
      const intensity = Math.max(10, Math.min(100, 
        this.config.shockIntensity + intensityVariation))
      const duration = Math.max(1, Math.min(10, 
        this.config.shockDuration + durationVariation))
      
      this.log(`触发惩罚! 强度: ${intensity.toFixed(1)}V, 时长: ${duration.toFixed(1)}秒`, 'error')
      
      this.state.isShocking = true
      this.state.lastActionTime = Date.now() // 重置动作时间
      
      // 启动电击
      await this.deviceManager.setDeviceProperty('shock_device', {
        voltage: Math.round(intensity),
        shock: 1
      })
      
      // 设置停止计时器
      this.shockTimer = setTimeout(async () => {
        await this.stopShock()
      }, duration * 1000)
      
    } catch (error) {
      this.log(`惩罚触发失败: ${error.message}`, 'error')
      this.state.isShocking = false
    }
  }
  
  /**
   * 停止电击
   */
  async stopShock() {
    if (!this.state.isShocking) {
      return
    }
    
    try {
      await this.deviceManager.setDeviceProperty('shock_device', {
        shock: 0
      })
      
      this.state.isShocking = false
      
      if (this.shockTimer) {
        clearTimeout(this.shockTimer)
        this.shockTimer = null
      }
      
      this.log('惩罚已停止，请继续做俯卧撑!', 'info')
      
    } catch (error) {
      this.log(`停止惩罚失败: ${error.message}`, 'error')
    }
  }
  
  /**
   * 设置锁定状态
   */
  async setLockState(isOpen) {
    try {
      const success = await this.deviceManager.setDeviceProperty('auto_lock', { open: isOpen ? 1 : 0 })
      if (success) {
        this.state.isLocked = !isOpen
        this.log(`自动锁已${isOpen ? '解锁' : '锁定'}`, 'success')
      } else {
        this.log(`自动锁设备不可用或${isOpen ? '解锁' : '锁定'}失败`, 'warning')
      }
    } catch (error) {
      this.log(`自动锁设备不可用: ${error.message}`, 'warning')
    }
  }
  
  /**
   * 启动游戏计时器
   */
  startGameTimer() {
    const duration = this.config.duration * 60 * 1000
    
    this.gameTimer = setTimeout(async () => {
      await this.endGame(false)
    }, duration)
  }
  
  /**
   * 启动状态更新计时器
   */
  startStatusUpdateTimer() {
    this.statusUpdateTimer = setInterval(() => {
      if (this.state.isGameActive) {
        this.renderUI()
      }
    }, 1000) // 每秒更新一次
  }
  
  /**
   * 游戏循环
   */
  async loop(deviceManager) {
    if (!this.state.isGameActive) {
      return false
    }
    
    const elapsed = Date.now() - this.state.startTime
    const duration = this.config.duration * 60 * 1000
    const remaining = duration - elapsed
    
    if (remaining <= 0) {
      await this.endGame(false)
      return false
    }
    
    return true
  }
  
  /**
   * 结束游戏
   */
  async endGame(completed = false) {
    this.state.isGameActive = false
    
    // 清理所有计时器
    if (this.gameTimer) {
      clearTimeout(this.gameTimer)
      this.gameTimer = null
    }
    
    if (this.statusUpdateTimer) {
      clearInterval(this.statusUpdateTimer)
      this.statusUpdateTimer = null
    }
    
    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer)
      this.idleCheckTimer = null
    }
    
    if (this.shockTimer) {
      clearTimeout(this.shockTimer)
      this.shockTimer = null
    }
    
    if (this.vibratorTimer) {
      clearTimeout(this.vibratorTimer)
      this.vibratorTimer = null
    }
    
    // 停止所有设备
    await this.stopShock()
    await this.stopVibrator()
    
    // 恢复QTZ设备的报告延迟为默认值
    try {
      await this.deviceManager.setDeviceProperty('distance_sensor', {
        report_delay_ms: 10000
      })
      this.log('QTZ报告延迟已恢复为10000ms', 'info')
    } catch (error) {
      this.log(`恢复QTZ报告延迟失败: ${error.message}`, 'error')
    }
    
    // 解锁自动锁
    await this.setLockState(true)
    
    // 显示结果
    const completionRate = (this.state.completedCount / this.config.targetCount * 100).toFixed(1)
    
    if (completed) {
      this.log(`🎉 恭喜完成训练! 完成了${this.state.completedCount}个俯卧撑`, 'success')
    } else {
      this.log(`⏰ 时间到! 完成了${this.state.completedCount}/${this.config.targetCount}个俯卧撑 (${completionRate}%)`, 'warning')
    }
    
    this.log(`游戏统计: 惩罚次数${this.state.punishmentCount}, 奖励次数${this.state.rewardCount}`, 'info')
    
    // 最终UI渲染
    this.renderUI()
  }
  
  /**
   * 停止游戏
   */
  async stop() {
    await this.endGame(false)
  }
  
  /**
   * 渲染UI
   */
  renderUI() {
    if (!this.uiAPI) return
    
    const elapsed = Date.now() - this.state.startTime
    const duration = this.config.duration * 60 * 1000
    const remaining = Math.max(0, duration - elapsed)
    
    const remainingMinutes = Math.floor(remaining / 60000)
    const remainingSeconds = Math.floor((remaining % 60000) / 1000)
    
    const completionRate = (this.state.completedCount / this.config.targetCount * 100).toFixed(1)
    const idleTime = Math.floor((Date.now() - this.state.lastActionTime) / 1000)
    
    const html = `
      <style>
        .pushup-container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .game-header {
          text-align: center;
          margin-bottom: 20px;
          padding: 15px;
          background: linear-gradient(135deg, #4CAF50, #45a049);
          color: white;
          border-radius: 10px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        
        .game-title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        
        .game-subtitle {
          font-size: 14px;
          opacity: 0.9;
        }
        
        .status-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-bottom: 20px;
        }
        
        .status-grid-2 {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          margin-bottom: 20px;
        }
        
        .status-card {
          background: white;
          border-radius: 10px;
          padding: 20px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          border-left: 4px solid #4CAF50;
        }
        
        .status-card.warning {
          border-left-color: #ff9800;
        }
        
        .status-card.danger {
          border-left-color: #f44336;
        }
        
        .status-card.info {
          border-left-color: #2196F3;
        }
        
        .status-title {
          font-size: 14px;
          color: #666;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .status-value {
          font-size: 24px;
          font-weight: bold;
          color: #333;
        }
        
        .progress-container {
          margin: 15px 0;
        }
        
        .progress-bar {
          width: 100%;
          height: 20px;
          background-color: #e0e0e0;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 10px;
        }
        
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #4CAF50, #45a049);
          transition: width 0.3s ease;
        }
        
        .progress-text {
          text-align: center;
          font-size: 14px;
          color: #666;
        }
        
        .device-status {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-top: 15px;
        }
        
        .device-item {
          text-align: center;
          padding: 10px;
          border-radius: 8px;
          background: #f5f5f5;
        }
        
        .device-item.active {
          background: #e8f5e8;
          color: #2e7d32;
        }
        
        .device-item.inactive {
          background: #ffebee;
          color: #c62828;
        }
        
        .device-name {
          font-size: 12px;
          margin-bottom: 5px;
        }
        
        .device-state {
          font-size: 10px;
          font-weight: bold;
        }
        
        .action-indicator {
          text-align: center;
          padding: 12px;
          margin: 15px 0;
          border-radius: 10px;
          font-size: 18px;
          font-weight: bold;
        }
        
        .action-up {
          background: #e8f5e8;
          color: #2e7d32;
        }
        
        .action-down {
          background: #fff3e0;
          color: #ef6c00;
        }
        
        .warning-text {
          color: #ff9800;
          font-weight: bold;
          text-align: center;
          margin: 10px 0;
        }
        
        .danger-text {
          color: #f44336;
          font-weight: bold;
          text-align: center;
          margin: 10px 0;
        }
        
        .game-over {
          text-align: center;
          padding: 30px;
          background: linear-gradient(135deg, #ff6b6b, #ee5a24);
          color: white;
          border-radius: 10px;
          margin: 20px 0;
        }
        
        .game-complete {
          text-align: center;
          padding: 30px;
          background: linear-gradient(135deg, #4CAF50, #45a049);
          color: white;
          border-radius: 10px;
          margin: 20px 0;
        }
      </style>
      
      <div class="pushup-container">
        <div class="game-header">
          <div class="game-title">${this.title}</div>
          <div class="game-subtitle">v${this.version} - 俯卧撑训练模式</div>
        </div>
        
        ${!this.state.isGameActive && this.state.completedCount >= this.config.targetCount ? `
          <div class="game-complete">
            <h2>🎉 训练完成!</h2>
            <p>恭喜您完成了${this.state.completedCount}个俯卧撑!</p>
          </div>
        ` : ''}
        
        ${!this.state.isGameActive && this.state.completedCount < this.config.targetCount ? `
          <div class="game-over">
            <h2>⏰ 时间到!</h2>
            <p>完成了${this.state.completedCount}/${this.config.targetCount}个俯卧撑 (${completionRate}%)</p>
          </div>
        ` : ''}
        
        <div class="status-grid">
          <div class="status-card">
            <div class="status-title">剩余时间</div>
            <div class="status-value">${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}</div>
          </div>
          
          <div class="status-card">
            <div class="status-title">完成进度</div>
            <div class="status-value">${this.state.completedCount}/${this.config.targetCount}</div>
          </div>
          
          <div class="status-card ${parseFloat(this.state.currentDistance) <= this.config.downThreshold ? 'warning' : 'info'}">
            <div class="status-title">当前距离</div>
            <div class="status-value">${this.state.currentDistance}cm</div>
          </div>
          
          <div class="status-card ${idleTime >= this.config.idleTimeLimit - 5 ? 'danger' : 'info'}">
            <div class="status-title">无动作时间</div>
            <div class="status-value">${idleTime}s</div>
          </div>
        </div>
        
        <div class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${completionRate}%"></div>
          </div>
          <div class="progress-text">完成率: ${completionRate}%</div>
        </div>
        
        <div class="action-indicator ${this.state.currentPhase === 'up' ? 'action-up' : 'action-down'}">
          当前动作阶段: ${this.state.currentPhase === 'up' ? '上升 ↑' : '下降 ↓'}
        </div>
        
        ${idleTime >= this.config.idleTimeLimit - 5 && idleTime < this.config.idleTimeLimit ? `
          <div class="warning-text">
            ⚠️ 警告: 还有${this.config.idleTimeLimit - idleTime}秒将触发惩罚!
          </div>
        ` : ''}
        
        ${this.state.isShocking ? `
          <div class="danger-text">
            ⚡ 正在执行惩罚电击...
          </div>
        ` : ''}
        
        ${this.state.isVibratorActive ? `
          <div class="warning-text">
            💫 奖励干扰激活中...
          </div>
        ` : ''}
        
        <div class="status-grid">
          <div class="status-card info">
            <div class="status-title">连续完成</div>
            <div class="status-value">${this.state.consecutiveCount}</div>
          </div>
          
          <div class="status-card warning">
            <div class="status-title">惩罚次数</div>
            <div class="status-value">${this.state.punishmentCount}</div>
          </div>
          
          <div class="status-card">
            <div class="status-title">奖励次数</div>
            <div class="status-value">${this.state.rewardCount}</div>
          </div>
          
          <div class="status-card ${this.state.isLocked ? 'danger' : 'info'}">
            <div class="status-title">锁定状态</div>
            <div class="status-value">${this.state.isLocked ? '🔒 锁定' : '🔓 解锁'}</div>
          </div>
        </div>
        
        <div class="status-grid-2">
          <div class="status-card ${this.state.isVibratorActive ? 'warning' : 'info'}">
            <div class="status-title">奖励状态</div>
            <div class="status-value">${this.state.isVibratorActive ? '💫 激活中' : '⭕ 未激活'}</div>
          </div>
          
          <div class="status-card info">
            <div class="status-title">距离奖励</div>
            <div class="status-value">${Math.max(0, this.config.rewardTriggerCount - this.state.consecutiveCount)}次</div>
          </div>
        </div>
        
        <div class="device-status">
          <div class="device-item ${this.deviceManager?.deviceMap?.get('distance_sensor')?.connected ? 'active' : 'inactive'}">
            <div class="device-name">距离传感器</div>
            <div class="device-state">${this.deviceManager?.deviceMap?.get('distance_sensor')?.connected ? '在线' : '离线'}</div>
          </div>
          
          <div class="device-item ${this.deviceManager?.deviceMap?.get('auto_lock')?.connected ? 'active' : 'inactive'}">
            <div class="device-name">自动锁</div>
            <div class="device-state">${this.deviceManager?.deviceMap?.get('auto_lock')?.connected ? '在线' : '离线'}</div>
          </div>
          
          <div class="device-item ${this.deviceManager?.deviceMap?.get('shock_device')?.connected ? 'active' : 'inactive'}">
            <div class="device-name">电击设备</div>
            <div class="device-state">${this.deviceManager?.deviceMap?.get('shock_device')?.connected ? '在线' : '离线'}</div>
          </div>
          
          <div class="device-item ${this.deviceManager?.deviceMap?.get('vibrator_device')?.connected ? 'active' : 'inactive'}">
            <div class="device-name">跳蛋设备</div>
            <div class="device-state">${this.deviceManager?.deviceMap?.get('vibrator_device')?.connected ? '在线' : '离线'}</div>
          </div>
        </div>
      </div>
    `
    
    this.uiAPI.updateUI(html)
  }
  
  /**
   * 日志输出
   */
  log(message, level = 'info') {
    const timestamp = new Date().toLocaleTimeString()
    const logMessage = `[${timestamp}] [俯卧撑游戏] ${message}`
    
    if (this.uiAPI && this.uiAPI.addLog) {
      this.uiAPI.addLog(logMessage, level)
    }
    
    // 同时输出到控制台
    switch (level) {
      case 'error':
        console.error(logMessage)
        break
      case 'warning':
        console.warn(logMessage)
        break
      case 'success':
      case 'info':
      default:
        console.log(logMessage)
        break
    }
  }
  
  /**
   * 外部结束游戏方法
   * 用于外部系统强制结束游戏时调用
   * @param {Object} deviceManager - 设备管理器
   */
  async end(deviceManager) {
    await this.endGame()
  }
}

// 默认导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PushupDetectionGame
} else {
  window.PushupDetectionGame = PushupDetectionGame
}