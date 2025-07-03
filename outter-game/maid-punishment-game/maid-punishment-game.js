/**
 * 女仆偷懒惩罚游戏 - 踮脚站立惩罚机制
 * 要求目标对象保持踮脚站立，脚后跟不能压下QTZ设备按钮，否则会触发电击惩罚
 * 游戏开始时自动锁定，达到设定时间后自动解锁
 */
export class MaidPunishmentGame {
  constructor() {
    this.title = "女仆偷懒惩罚游戏"
    this.description = "要求保持踮脚站立，任意按钮按下时持续电击，两按钮都未按下时停止电击"
    this.version = "1.3.0"
    this.author = "游戏设计师"
    
    // 当前配置的参数值
    this.config = {
      duration: 10,
      shockIntensity: 10,
      progressiveIntensity: false,
      maxIntensityIncrease: 20,
      allowUnsafeIntensity: false,
      td01DelaySeconds: 5,
      td01IntensityIncrease: 50,
      manualStart: false
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
      isShocking: false,
      lastNoShockTime: 0,
      td01Active: false,
      td01Intensity: 0,
      hasTD01Device: false,
      waitingForManualStart: false
    }
    
    // UI相关
    this.uiAPI = null
    this.gameTimer = null
    this.statusUpdateTimer = null
    this.td01Timer = null
    this.td01IntensityTimer = null
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
      },
      {
        logicalId: "td01_device",
        type: "TD01",
        name: "TD01设备",
        required: false,
        description: "可选设备，在未触发电击一定时间后开启，逐渐增加强度"
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
        max: 360,
        step: 1,
        default: 10,
        description: '游戏持续时间（分钟）'
      },
      shockIntensity: {
        name: '电击强度（V）',
        type: 'number',
        min: 10,
        max: 100,
        step: 1,
        default: 10,
        description: '脚后跟压下时的电击强度（10-100）V，注意，请谨慎设置，过高可能导致电击伤害，风险需自行承担'
      },

      progressiveIntensity: {
        name: '渐进式强度',
        type: 'boolean',
        default: false,
        description: '启用后，电击强度会随着违规次数增加'
      },
      maxIntensityIncrease: {
        name: '最大强度增幅',
        type: 'number',
        min: 0,
        max: 50,
        step: 5,
        default: 10,
        description: '渐进式强度的最大增幅值'
      },
      allowUnsafeIntensity: {
        name: '允许超过安全限度',
        type: 'boolean',
        default: false,
        description: '启用后允许电击强度超过30，否则最大强度限制为30，开启后风险自负'
      },
      td01DelaySeconds: {
        name: 'TD01延时时间',
        type: 'number',
        min: 1,
        max: 60,
        step: 1,
        default: 5,
        description: '未触发电击多少秒后开启TD01设备（秒）'
      },
      td01IntensityIncrease: {
        name: 'TD01强度增幅',
        type: 'number',
        min: 1,
        max: 100,
        step: 1,
        default: 50,
        description: 'TD01设备每5秒增加的强度值'
      },
      manualStart: {
        name: '手动开启',
        type: 'boolean',
        default: false,
        description: '启用后，游戏加载完成后等待auto_lock设备的按键点击消息才开始游戏'
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
        isGameActive: !this.config.manualStart, // 如果是手动开启，则先不激活游戏
        isLocked: false,
        shockCount: 0,
        lastShockTime: 0,
        totalStandingTime: 0,
        lastHeelDownTime: 0,
        heelDownCount: 0,
        button0Pressed: false,
        button1Pressed: false,
        isShocking: false,
        lastNoShockTime: Date.now(),
        td01Active: false,
        td01Intensity: 0,
        hasTD01Device: false,
        waitingForManualStart: this.config.manualStart
      }
      
      // 检查是否有TD01设备
      this.checkTD01Device()
      
      // 设置QTZ设备按键监听
      this.setupQTZButtonListener()
      
      // 如果启用手动开启，设置auto_lock设备消息监听
      if (this.config.manualStart) {
        this.setupManualStartListener()
        this.log('手动开启模式已启用，等待auto_lock设备的按键点击消息...', 'info')
      }
      
      // 锁定自动锁设备
      await this.lockDevice()
      
      // 如果不是手动开启模式，立即启动游戏
      if (!this.config.manualStart) {
        this.startGameplay()
      } else {
        // 手动开启模式，只启动状态更新计时器用于UI更新
        this.startStatusUpdateTimer()
        this.renderUI()
        this.log(`女仆惩罚游戏已准备就绪，等待手动开启信号`, 'success')
        this.log('请点击auto_lock设备按键开始游戏！', 'warning')
      }
      
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
   * 设置手动开启监听
   */
  setupManualStartListener() {
    // 监听auto_lock设备的所有消息
    this.deviceManager.listenDeviceMessages('auto_lock', (deviceData) => {
      this.log(`收到auto_lock设备消息: ${JSON.stringify(deviceData)}`, 'info')
      
      // 检查是否是按键点击消息
      if (deviceData.method === 'action' && deviceData.action === 'key_clicked') {
        this.log('检测到auto_lock设备按键点击，开始游戏！', 'success')
        this.handleManualStart()
      }
    })
    
    this.log('auto_lock设备手动开启监听已设置', 'info')
  }
  
  /**
   * 处理手动开启
   */
  handleManualStart() {
    if (!this.state.waitingForManualStart) {
      return // 不在等待手动开启状态
    }
    
    this.state.waitingForManualStart = false
    this.state.isGameActive = true
    this.state.startTime = Date.now() // 重新设置开始时间
    this.state.lastNoShockTime = Date.now()
    
    // 启动游戏
    this.startGameplay()
  }
  
  /**
   * 启动游戏逻辑
   */
  startGameplay() {
    // 启动TD01监控
    if (this.state.hasTD01Device) {
      this.startTD01Monitoring()
    }
    
    // 启动游戏计时器
    this.startGameTimer()
    
    // 启动状态更新计时器（如果还没启动）
    if (!this.statusUpdateTimer) {
      this.startStatusUpdateTimer()
    }
    
    // 渲染UI
    this.renderUI()
    
    this.log(`女仆惩罚游戏正式开始，游戏时长: ${this.config.duration}分钟`, 'success')
    this.log('请保持踮脚站立，脚后跟不要压下按钮！', 'warning')
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
      // 重置TD01相关状态
      this.resetTD01State()
    } else if (!anyButtonPressed && this.state.isShocking) {
      // 所有按钮都未按下且当前在电击，停止电击
      this.log('所有按钮已抬起，停止电击', 'info')
      this.stopShock()
      // 更新最后无电击时间
      this.state.lastNoShockTime = Date.now()
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
      
      // 安全限度检查
      if (!this.config.allowUnsafeIntensity) {
        intensity = Math.min(intensity, 30)
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
   * 检查TD01设备是否可用
   */
  checkTD01Device() {
    try {
      this.log('开始检测TD01设备...', 'info')
      
      // 检查设备映射
      const mappedDevice = this.deviceManager.deviceMap.get('td01_device')
      this.log(`设备映射结果: ${mappedDevice ? '已映射' : '未映射'}`, 'info')
      
      if (mappedDevice) {
        this.log(`映射的设备信息: ${mappedDevice.name}, 连接状态: ${mappedDevice.connected}`, 'info')
        this.state.hasTD01Device = mappedDevice.connected
      } else {
        this.log('TD01设备未映射', 'warning')
        this.state.hasTD01Device = false
      }
      
      if (this.state.hasTD01Device) {
        this.log('检测到TD01设备，将启用延时电击功能', 'info')
      } else {
        this.log('未检测到TD01设备，延时电击功能不可用', 'info')
      }
    } catch (error) {
      this.state.hasTD01Device = false
      this.log('TD01设备检查失败，延时电击功能不可用', 'warning')
    }
  }
  
  /**
   * 启动TD01监控
   */
  startTD01Monitoring() {
    this.log(`TD01监控启动检查: hasTD01Device=${this.state.hasTD01Device}`, 'info')
    
    if (!this.state.hasTD01Device) {
      this.log('TD01设备不可用，跳过监控', 'warning')
      return
    }
    
    this.log(`启动TD01监控，延时时间: ${this.config.td01DelaySeconds}秒`, 'info')
    
    // 每秒检查一次是否需要启动TD01
    this.td01Timer = setInterval(() => {
      this.checkTD01Activation()
    }, 1000)
    
    this.log('TD01监控定时器已启动', 'success')
  }
  
  /**
   * 检查TD01激活条件
   */
  checkTD01Activation() {
    if (!this.state.isGameActive || !this.state.hasTD01Device || this.state.isShocking) {
      return
    }
    
    const timeSinceLastShock = Date.now() - this.state.lastNoShockTime
    const delayMs = this.config.td01DelaySeconds * 1000
    
    this.log(`TD01激活检查: 距离上次非电击时间=${Math.floor(timeSinceLastShock/1000)}s, 需要延迟=${Math.floor(delayMs/1000)}s, TD01状态=${this.state.td01Active}`, 'debug')
    
    if (timeSinceLastShock >= delayMs && !this.state.td01Active) {
      this.log('TD01激活条件满足，启动TD01设备', 'info')
      this.startTD01()
    }
  }
  
  /**
   * 启动TD01设备
   */
  async startTD01() {
    this.log(`TD01启动检查: hasTD01Device=${this.state.hasTD01Device}, td01Active=${this.state.td01Active}`, 'info')
    
    if (!this.state.hasTD01Device || this.state.td01Active) {
      this.log('TD01启动条件不满足，跳过启动', 'warning')
      return
    }
    
    this.log('启动TD01设备...', 'info')
    
    try {
      this.state.td01Active = true
      this.state.td01Intensity = 10 // 初始强度
      
      this.log(`设置TD01设备属性: power=${this.state.td01Intensity}`, 'info')
      
      // 设置初始强度
      await this.deviceManager.setDeviceProperty('td01_device', {
        power: this.state.td01Intensity
      })
      
      this.log(`TD01设备已启动，初始强度: ${this.state.td01Intensity}`, 'success')
      
      // 启动强度递增计时器
      this.startTD01IntensityIncrease()
      
    } catch (error) {
      this.log(`TD01设备启动失败: ${error.message}`, 'error')
      this.state.td01Active = false
    }
  }
  
  /**
   * 启动TD01强度递增
   */
  startTD01IntensityIncrease() {
    if (!this.state.td01Active) {
      return
    }
    
    // 每5秒增加强度
    this.td01IntensityTimer = setInterval(async () => {
      if (!this.state.td01Active || this.state.isShocking) {
        return
      }
      
      // 增加强度（TD01不受安全限度影响，最大值为255）
       this.state.td01Intensity = Math.min(this.state.td01Intensity + this.config.td01IntensityIncrease, 255)
      
      try {
        await this.deviceManager.setDeviceProperty('td01_device', {
          power: this.state.td01Intensity
        })
        
        this.log(`TD01强度已增加至: ${this.state.td01Intensity}`, 'warning')
        
      } catch (error) {
        this.log(`TD01强度调整失败: ${error.message}`, 'error')
      }
    }, 5000)
  }
  
  /**
   * 停止TD01设备
   */
  async stopTD01() {
    if (!this.state.td01Active) {
      return
    }
    
    try {
      await this.deviceManager.setDeviceProperty('td01_device', {
        power: 0
      })
      
      this.state.td01Active = false
      this.state.td01Intensity = 0
      
      // 清理强度递增计时器
      if (this.td01IntensityTimer) {
        clearInterval(this.td01IntensityTimer)
        this.td01IntensityTimer = null
      }
      
      this.log('TD01设备已停止', 'info')
      
    } catch (error) {
      this.log(`TD01设备停止失败: ${error.message}`, 'error')
    }
  }
  
  /**
   * 重置TD01状态
   */
  async resetTD01State() {
    if (this.state.td01Active) {
      await this.stopTD01()
    }
    this.state.lastNoShockTime = Date.now()
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
    // 如果在等待手动开启状态，继续运行循环但不检查时间
    if (this.state.waitingForManualStart) {
      return true
    }
    
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
    
    // 如果在等待手动开启，显示等待界面
    if (this.state.waitingForManualStart) {
      this.renderWaitingUI()
      return
    }
    
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
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
          margin-bottom: 20px;
        }
        
        .status-card {
          background: white;
          padding: 12px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          text-align: center;
        }
        
        .status-label {
          font-size: 11px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }
        
        .status-value {
          font-size: 20px;
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
          
          ${this.state.hasTD01Device ? `
          <div class="status-card">
            <div class="status-label">TD01状态</div>
            <div class="status-value ${this.state.td01Active ? 'shock' : ''}">${this.state.td01Active ? '🔥 激活中' : '💤 待机中'}</div>
          </div>
          
          <div class="status-card">
            <div class="status-label">TD01强度</div>
            <div class="status-value ${this.state.td01Active ? 'shock' : ''}">${this.state.td01Intensity}</div>
          </div>
          ` : ''}
          

        </div>
        
        <div class="instructions">
          <div class="instructions-title">游戏规则</div>
          <div class="instructions-text">
            • 保持踮脚站立，脚后跟不要接触地面<br>
            • QTZ设备放置在脚后跟位置，监控两个按钮状态<br>
            • 当任意一个按钮被按下时立即开始电击<br>
            • 当两个按钮都未按下时停止电击<br>
            ${this.state.hasTD01Device ? `• TD01设备将在未触发电击${this.config.td01DelaySeconds}秒后启动，强度逐渐增加<br>` : ''}
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
        
        ${this.state.td01Active ? `
          <div class="warning-section">
            <div class="warning-title">🔥 TD01激活</div>
            <div class="warning-text">TD01设备已激活，当前强度: ${this.state.td01Intensity}。强度将每5秒递增！</div>
          </div>
        ` : ''}
        
        ${this.state.hasTD01Device && !this.state.td01Active && !this.state.isShocking ? `
          <div class="warning-section">
            <div class="warning-title">⏰ TD01倒计时</div>
            <div class="warning-text">距离TD01激活还有 ${Math.max(0, this.config.td01DelaySeconds - Math.floor((Date.now() - this.state.lastNoShockTime) / 1000))} 秒</div>
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
    
    // 停止TD01设备
    if (this.state.td01Active) {
      await this.stopTD01()
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
    
    if (this.td01Timer) {
      clearInterval(this.td01Timer)
      this.td01Timer = null
    }
    
    if (this.td01IntensityTimer) {
      clearInterval(this.td01IntensityTimer)
      this.td01IntensityTimer = null
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
   * 渲染等待手动开启界面
   */
  renderWaitingUI() {
    if (!this.uiAPI) return
    
    const html = `
      <style>
        .waiting-container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .waiting-header {
          text-align: center;
          margin-bottom: 30px;
          padding: 20px;
          background: linear-gradient(135deg, #3498db, #2980b9);
          color: white;
          border-radius: 12px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        
        .waiting-title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        
        .waiting-subtitle {
          font-size: 14px;
          opacity: 0.9;
        }
        
        .waiting-content {
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          text-align: center;
        }
        
        .waiting-icon {
          font-size: 64px;
          color: #3498db;
          margin-bottom: 20px;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        
        .waiting-message {
          font-size: 18px;
          color: #2c3e50;
          margin-bottom: 20px;
          line-height: 1.6;
        }
        
        .waiting-instruction {
          background: #e8f4fd;
          border: 1px solid #bee5eb;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }
        
        .instruction-title {
          font-weight: bold;
          color: #0c5460;
          margin-bottom: 10px;
          font-size: 16px;
        }
        
        .instruction-text {
          color: #0c5460;
          font-size: 14px;
          line-height: 1.5;
        }
        
        .config-info {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 15px;
          margin-top: 20px;
        }
        
        .config-title {
          font-weight: bold;
          color: #495057;
          margin-bottom: 10px;
        }
        
        .config-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
          font-size: 14px;
          color: #6c757d;
        }
        
        .quit-button {
          background: #dc3545;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          margin-top: 20px;
          transition: background-color 0.3s;
        }
        
        .quit-button:hover {
          background: #c82333;
        }
      </style>
      
      <div class="waiting-container">
        <div class="waiting-header">
          <div class="waiting-title">女仆偷懒惩罚游戏 v${this.version}</div>
          <div class="waiting-subtitle">手动开启模式 · 等待启动信号</div>
        </div>
        
        <div class="waiting-content">
          <div class="waiting-icon">⏳</div>
          
          <div class="waiting-message">
            游戏已准备就绪，等待手动开启信号...
          </div>
          
          <div class="waiting-instruction">
            <div class="instruction-title">📋 操作说明</div>
            <div class="instruction-text">
              请点击 <strong>auto_lock设备</strong> 的按键来开始游戏。<br>
              系统将监听设备发送的按键点击消息，收到信号后自动开始游戏计时。
            </div>
          </div>
          
          <div class="config-info">
            <div class="config-title">🎮 游戏配置</div>
            <div class="config-item">
              <span>游戏时长:</span>
              <span>${this.config.duration} 分钟</span>
            </div>
            <div class="config-item">
              <span>电击强度:</span>
              <span>${this.config.shockIntensity} V</span>
            </div>
            <div class="config-item">
              <span>渐进式强度:</span>
              <span>${this.config.progressiveIntensity ? '启用' : '禁用'}</span>
            </div>
            <div class="config-item">
              <span>TD01设备:</span>
              <span>${this.state.hasTD01Device ? '已连接' : '未连接'}</span>
            </div>
          </div>
          
          <button class="quit-button" onclick="window.gameplayUI.handleEvent('quit', {})">
            退出游戏
          </button>
        </div>
      </div>
    `
    
    this.uiAPI.updateUI(html, '等待手动开启')
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