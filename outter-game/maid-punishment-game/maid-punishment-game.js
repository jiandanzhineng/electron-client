/**
 * 女仆偷懒惩罚游戏 - 踮脚站立惩罚机制
 * 要求目标对象保持踮脚站立，脚后跟不能压下QTZ设备按钮，否则会触发电击惩罚
 * 游戏开始时自动锁定，达到设定时间后自动解锁
 */
export class MaidPunishmentGame {
  constructor() {
    this.title = "女仆偷懒惩罚游戏"
    this.description = "要求保持踮脚站立，任意按钮按下时持续电击，两按钮都未按下时停止电击"
    this.version = "1.2.0"
    this.author = "游戏设计师"
    
    // 当前配置的参数值
    this.config = {
      duration: 30,
      shockIntensity: 60,
      progressiveIntensity: true,
      maxIntensityIncrease: 20
    }
    
    // 游戏状态
    this.state = {
      startTime: 0,
      isGameActive: false,
      isLocked: false,
      shockCount: 0,
      lastShockTime: 0,
      totalStandingTime: 0,
      lastHeelDownTime: 0,
      heelDownCount: 0,
      button0Pressed: false,
      button1Pressed: false,
      isShocking: false
    }
    
    // UI相关
    this.uiAPI = null
    this.gameTimer = null
    this.statusUpdateTimer = null
  }
  
  /**
   * 设备依赖配置
   */
  get requiredDevices() {
    return [
      {
        logicalId: "auto_lock",
        type: "ZIDONGSUO",
        name: "自动锁",
        required: true,
        description: "游戏开始时锁定，时间到达后解锁"
      },
      {
        logicalId: "shock_device",
        type: "DIANJI", 
        name: "电击设备",
        required: true,
        description: "脚后跟压下按钮时执行电击惩罚"
      },
      {
        logicalId: "qtz_sensor",
        type: "QTZ",
        name: "QTZ激光测距传感器",
        required: true,
        description: "检测脚后跟是否压下按钮（放置在脚后跟位置）"
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
        max: 180,
        step: 1,
        default: 30,
        description: '游戏持续时间（分钟）'
      },
      shockIntensity: {
        name: '电击强度',
        type: 'number',
        min: 10,
        max: 100,
        step: 5,
        default: 60,
        description: '脚后跟压下时的电击强度（10-100）'
      },

      progressiveIntensity: {
        name: '渐进式强度',
        type: 'boolean',
        default: true,
        description: '启用后，电击强度会随着违规次数增加'
      },
      maxIntensityIncrease: {
        name: '最大强度增幅',
        type: 'number',
        min: 0,
        max: 50,
        step: 5,
        default: 20,
        description: '渐进式强度的最大增幅值'
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
    console.log('女仆惩罚游戏参数已更新:', newParams)
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
    
    this.log(`女仆偷懒惩罚游戏 v${this.version} 正在启动...`, 'info')
    
    try {
      // 初始化游戏状态
      this.state = {
        startTime: Date.now(),
        isGameActive: true,
        isLocked: false,
        shockCount: 0,
        lastShockTime: 0,
        totalStandingTime: 0,
        lastHeelDownTime: 0,
        heelDownCount: 0,
        button0Pressed: false,
        button1Pressed: false,
        isShocking: false
      }
      
      // 设置QTZ设备按键监听
      this.setupQTZButtonListener()
      
      // 锁定自动锁设备
      await this.lockDevice()
      
      // 启动游戏计时器
      this.startGameTimer()
      
      // 启动状态更新计时器
      this.startStatusUpdateTimer()
      
      // 渲染初始UI
      this.renderUI()
      
      this.log(`女仆惩罚游戏启动成功，游戏时长: ${this.config.duration}分钟`, 'success')
      this.log('请保持踮脚站立，脚后跟不要压下按钮！', 'warning')
      
    } catch (error) {
      this.log(`游戏启动失败: ${error.message}`, 'error')
      throw error
    }
  }
  
  /**
   * 设置QTZ设备按键监听
   */
  setupQTZButtonListener() {
    // 监听QTZ设备的按键属性变化
    this.deviceManager.listenDeviceProperty('qtz_sensor', 'button0', (newValue, deviceData) => {
      this.log(`button0状态变化: ${newValue}`, 'info')
      this.state.button0Pressed = (newValue === 1)
      this.checkShockCondition()
    })
    
    this.deviceManager.listenDeviceProperty('qtz_sensor', 'button1', (newValue, deviceData) => {
      this.log(`button1状态变化: ${newValue}`, 'info')
      this.state.button1Pressed = (newValue === 1)
      this.checkShockCondition()
    })
    
    this.log('QTZ按键监听已设置，监听button0和button1属性变化', 'info')
  }
  
  /**
   * 检查电击条件
   */
  checkShockCondition() {
    if (!this.state.isGameActive) {
      return
    }
    
    const anyButtonPressed = this.state.button0Pressed || this.state.button1Pressed
    
    if (anyButtonPressed && !this.state.isShocking) {
      // 任意按钮按下且当前未在电击，开始电击
      this.log('检测到按钮按下，开始电击！', 'warning')
      this.state.heelDownCount++
      this.startShock()
    } else if (!anyButtonPressed && this.state.isShocking) {
      // 所有按钮都未按下且当前在电击，停止电击
      this.log('所有按钮已抬起，停止电击', 'info')
      this.stopShock()
    }
  }
  
  /**
   * 开始电击
   */
  async startShock() {
    if (this.state.isShocking) {
      return // 已经在电击中
    }
    
    try {
      let intensity = this.config.shockIntensity
      
      // 渐进式强度计算
      if (this.config.progressiveIntensity) {
        const intensityIncrease = Math.min(
          this.state.shockCount * 5,
          this.config.maxIntensityIncrease
        )
        intensity = Math.min(intensity + intensityIncrease, 100)
      }
      
      this.log(`开始电击 - 强度: ${intensity}`, 'error')
      
      // 设置电击状态
      this.state.isShocking = true
      this.state.shockCount++
      this.state.lastShockTime = Date.now()
      
      // 设置电击强度和启动电击
    await this.deviceManager.setDeviceProperty('shock_device', {
      voltage: intensity,
      shock: 1
    })
      
      this.log(`电击已开始，强度: ${intensity}`, 'warning')
      
    } catch (error) {
      this.log(`开始电击失败: ${error.message}`, 'error')
      this.state.isShocking = false
    }
  }
  
  /**
   * 停止电击
   */
  async stopShock() {
    if (!this.state.isShocking) {
      return // 当前未在电击
    }
    
    try {
      // 停止电击
    await this.deviceManager.setDeviceProperty('shock_device', { shock: 0 })
      
      this.state.isShocking = false
      
      this.log('电击已停止', 'info')
      
    } catch (error) {
      this.log(`停止电击失败: ${error.message}`, 'error')
    }
  }
  

  
  /**
   * 锁定设备
   */
  async lockDevice() {
    try {
      const success = await this.deviceManager.setDeviceProperty('auto_lock', { open: 0 })
      if (success) {
        this.state.isLocked = true
        this.log('自动锁已锁定', 'success')
      } else {
        throw new Error('锁定失败')
      }
    } catch (error) {
      this.log(`设备锁定失败: ${error.message}`, 'error')
      throw error
    }
  }
  
  /**
   * 解锁设备
   */
  async unlockDevice() {
    try {
      const success = await this.deviceManager.setDeviceProperty('auto_lock', { open: 1 })
      if (success) {
        this.state.isLocked = false
        this.log('自动锁已解锁', 'success')
      } else {
        throw new Error('解锁失败')
      }
    } catch (error) {
      this.log(`设备解锁失败: ${error.message}`, 'error')
    }
  }
  
  /**
   * 启动游戏计时器
   */
  startGameTimer() {
    const duration = this.config.duration * 60 * 1000
    
    this.gameTimer = setTimeout(async () => {
      await this.endGame()
    }, duration)
  }
  
  /**
   * 启动状态更新计时器
   */
  startStatusUpdateTimer() {
    this.statusUpdateTimer = setInterval(() => {
      if (this.state.isGameActive) {
        this.updateGameStatus()
        this.renderUI()
      }
    }, 1000) // 每秒更新一次
  }
  
  /**
   * 更新游戏状态
   */
  updateGameStatus() {
    const elapsed = Date.now() - this.state.startTime
    this.state.totalStandingTime = elapsed
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
      await this.endGame()
      return false
    }
    
    return true
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
    
    const html = `
      <style>
        .maid-punishment-container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .game-header {
          text-align: center;
          margin-bottom: 30px;
          padding: 20px;
          background: linear-gradient(135deg, #ff6b6b, #ee5a24);
          color: white;
          border-radius: 12px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
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
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 15px;
          margin-bottom: 30px;
        }
        
        .status-card {
          background: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          text-align: center;
        }
        
        .status-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }
        
        .status-value {
          font-size: 24px;
          font-weight: bold;
          color: #333;
        }
        
        .status-value.time {
          color: ${remaining < 300000 ? '#e74c3c' : '#2ecc71'};
        }
        
        .status-value.shock {
          color: #e74c3c;
        }
        
        .status-value.heel {
          color: #f39c12;
        }
        
        .warning-section {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
        }
        
        .warning-title {
          font-weight: bold;
          color: #856404;
          margin-bottom: 8px;
        }
        
        .warning-text {
          color: #856404;
          font-size: 14px;
        }
        
        .instructions {
          background: #d1ecf1;
          border: 1px solid #bee5eb;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
        }
        
        .instructions-title {
          font-weight: bold;
          color: #0c5460;
          margin-bottom: 8px;
        }
        
        .instructions-text {
          color: #0c5460;
          font-size: 14px;
          line-height: 1.5;
        }
        
        .game-controls {
          text-align: center;
          margin-top: 30px;
        }
        
        .btn {
          padding: 12px 24px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          margin: 0 10px;
          transition: all 0.3s ease;
        }
        
        .btn-danger {
          background: #e74c3c;
          color: white;
        }
        
        .btn-danger:hover {
          background: #c0392b;
        }
        
        .progress-bar {
          width: 100%;
          height: 8px;
          background: #ecf0f1;
          border-radius: 4px;
          overflow: hidden;
          margin-top: 10px;
        }
        
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #2ecc71, #27ae60);
          transition: width 0.3s ease;
          width: ${((duration - remaining) / duration) * 100}%;
        }
      </style>
      
      <div class="maid-punishment-container">
        <div class="game-header">
          <div class="game-title">女仆偷懒惩罚游戏 v${this.version}</div>
          <div class="game-subtitle">保持踮脚站立 · 脚后跟不要压下按钮</div>
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
        </div>
        
        <div class="status-grid">
          <div class="status-card">
            <div class="status-label">剩余时间</div>
            <div class="status-value time">${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}</div>
          </div>
          
          <div class="status-card">
            <div class="status-label">电击次数</div>
            <div class="status-value shock">${this.state.shockCount}</div>
          </div>
          
          <div class="status-card">
            <div class="status-label">违规次数</div>
            <div class="status-value heel">${this.state.heelDownCount}</div>
          </div>
          
          <div class="status-card">
            <div class="status-label">锁定状态</div>
            <div class="status-value">${this.state.isLocked ? '🔒 已锁定' : '🔓 已解锁'}</div>
          </div>
          
          <div class="status-card">
            <div class="status-label">按钮0状态</div>
            <div class="status-value">${this.state.button0Pressed ? '🔴 按下' : '🟢 未按下'}</div>
          </div>
          
          <div class="status-card">
            <div class="status-label">按钮1状态</div>
            <div class="status-value">${this.state.button1Pressed ? '🔴 按下' : '🟢 未按下'}</div>
          </div>
          
          <div class="status-card">
            <div class="status-label">电击状态</div>
            <div class="status-value ${this.state.isShocking ? 'shock' : ''}">${this.state.isShocking ? '⚡ 电击中' : '⭕ 未电击'}</div>
          </div>
        </div>
        
        <div class="instructions">
          <div class="instructions-title">游戏规则</div>
          <div class="instructions-text">
            • 保持踮脚站立，脚后跟不要接触地面<br>
            • QTZ设备放置在脚后跟位置，监控两个按钮状态<br>
            • 当任意一个按钮被按下时立即开始电击<br>
            • 当两个按钮都未按下时停止电击<br>
            • 电击强度会随违规次数逐渐增加<br>
            • 游戏时间结束后自动解锁
          </div>
        </div>
        
        ${this.state.isShocking ? `
          <div class="warning-section">
            <div class="warning-title">⚡ 电击中</div>
            <div class="warning-text">检测到按钮按下！正在执行电击惩罚！请立即抬起脚后跟停止电击！</div>
          </div>
        ` : ''}
        
        ${(this.state.button0Pressed || this.state.button1Pressed) && !this.state.isShocking ? `
          <div class="warning-section">
            <div class="warning-title">⚠️ 警告</div>
            <div class="warning-text">检测到按钮按下！电击即将开始！</div>
          </div>
        ` : ''}
        
        <div class="game-controls">
          <button class="btn btn-danger" onclick="window.gameplayUI.handleEvent('quit')">
            紧急停止游戏
          </button>
        </div>
      </div>
    `
    
    this.uiAPI.updateUI(html, '女仆惩罚游戏')
  }
  
  /**
   * 处理UI事件
   */
  handleUIEvent(eventType, data) {
    switch (eventType) {
      case 'quit':
        this.quitGame()
        break
    }
  }
  
  /**
   * 退出游戏
   */
  async quitGame() {
    this.log('游戏被手动停止', 'warning')
    await this.endGame()
  }
  
  /**
   * 结束游戏
   */
  async endGame() {
    this.state.isGameActive = false
    
    // 停止电击
    if (this.state.isShocking) {
      await this.stopShock()
    }
    
    // 清理计时器
    if (this.gameTimer) {
      clearTimeout(this.gameTimer)
      this.gameTimer = null
    }
    
    if (this.statusUpdateTimer) {
      clearInterval(this.statusUpdateTimer)
      this.statusUpdateTimer = null
    }
    
    // 解锁设备
    if (this.state.isLocked) {
      await this.unlockDevice()
    }
    
    // 渲染游戏完成界面
    this.renderGameComplete()
    
    this.log('女仆惩罚游戏结束', 'info')
  }
  
  /**
   * 渲染游戏完成界面
   */
  renderGameComplete() {
    if (!this.uiAPI) return
    
    const totalTime = Date.now() - this.state.startTime
    const totalMinutes = Math.floor(totalTime / 60000)
    const totalSeconds = Math.floor((totalTime % 60000) / 1000)
    
    const html = `
      <style>
        .game-complete {
          text-align: center;
          padding: 40px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          max-width: 500px;
          margin: 0 auto;
        }
        
        .game-complete h2 {
          color: #28a745;
          margin-bottom: 30px;
          font-size: 28px;
        }
        
        .completion-stats {
          display: grid;
          gap: 15px;
          margin-bottom: 30px;
        }
        
        .stat-item {
          display: flex;
          justify-content: space-between;
          padding: 15px 20px;
          background: #f8f9fa;
          border-radius: 8px;
          border-left: 4px solid #28a745;
        }
        
        .stat-label {
          font-weight: bold;
          color: #333;
        }
        
        .stat-value {
          color: #666;
        }
        
        .stat-value.highlight {
          color: #e74c3c;
          font-weight: bold;
        }
        
        .completion-message {
          background: #d4edda;
          border: 1px solid #c3e6cb;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          color: #155724;
        }
      </style>
      
      <div class="game-complete">
        <h2>🎉 游戏完成！</h2>
        
        <div class="completion-message">
          恭喜完成女仆惩罚训练！希望这次体验能让你更加专注和自律。
        </div>
        
        <div class="completion-stats">
          <div class="stat-item">
            <span class="stat-label">游戏时长</span>
            <span class="stat-value">${totalMinutes}分${totalSeconds}秒</span>
          </div>
          
          <div class="stat-item">
            <span class="stat-label">电击惩罚次数</span>
            <span class="stat-value highlight">${this.state.shockCount}</span>
          </div>
          
          <div class="stat-item">
            <span class="stat-label">脚后跟违规次数</span>
            <span class="stat-value highlight">${this.state.heelDownCount}</span>
          </div>
          
          <div class="stat-item">
            <span class="stat-label">表现评价</span>
            <span class="stat-value">${this.getPerformanceRating()}</span>
          </div>
        </div>
      </div>
    `
    
    this.uiAPI.updateUI(html, '游戏完成')
  }
  
  /**
   * 获取表现评价
   */
  getPerformanceRating() {
    if (this.state.shockCount === 0) {
      return '完美表现 ⭐⭐⭐'
    } else if (this.state.shockCount <= 2) {
      return '良好表现 ⭐⭐'
    } else if (this.state.shockCount <= 5) {
      return '一般表现 ⭐'
    } else {
      return '需要改进'
    }
  }
  
  /**
   * 发送日志
   */
  log(message, level = 'info') {
    if (this.uiAPI && this.uiAPI.addLog) {
      this.uiAPI.addLog(message, level)
    } else {
      console.log(`[MAID-PUNISHMENT ${level.toUpperCase()}] ${message}`)
    }
  }
  
  /**
   * 暂停游戏
   */
  pause() {
    this.state.isGameActive = false
    this.log('游戏已暂停', 'warning')
  }
  
  /**
   * 恢复游戏
   */
  resume() {
    this.state.isGameActive = true
    this.log('游戏已恢复', 'success')
  }
  
  /**
   * 停止游戏
   */
  stop() {
    this.endGame()
  }
}

// 默认导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MaidPunishmentGame
} else {
  window.MaidPunishmentGame = MaidPunishmentGame
}