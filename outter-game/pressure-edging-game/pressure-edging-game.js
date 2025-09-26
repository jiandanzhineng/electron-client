/**
 * 寸止玩法游戏 - 基于气压传感器的寸止训练游戏
 * 通过检测括约肌压力变化，结合偏轴电机控制器和电击设备进行智能刺激控制
 */
export class PressureEdgingGame {
  constructor() {
    this.title = "寸止玩法游戏"
    this.description = "基于气压传感器的寸止训练游戏，通过压力变化智能调节刺激强度"
    this.version = "1.0.0"
    this.author = "游戏设计师"
    
    // 游戏配置参数
    this.config = {
      // 基础参数
      duration: 20,                           // 游戏持续时间（分钟）
      criticalPressure: 20,                   // 临界气压值（kPa）
      maxMotorIntensity: 200,                 // TD01最大强度
      
      // 刺激控制参数
      lowPressureDelay: 5,                    // 压力低时延迟刺激时间（秒）
      stimulationRampRateLimit: 10,           // 刺激强度递增速率限制（每秒变化不超过此值）
      pressureSensitivity: 1.0,               // 压力变化敏感度系数
      stimulationRampRandomPercent: 0,        // 刺激强度随机扰动百分比
      intensityGradualIncrease: 2,            // 强度逐渐提升速率（每秒提升的强度值）
      
      // 电击参数
      shockIntensity: 20,                     // 电击强度（V）
      shockDuration: 1                        // 电击持续时间（秒）
    }
    
    // 游戏状态
    this.state = {
      startTime: 0,
      isGameActive: false,
      currentPressure: 0,                     // 当前压力值
      targetMotorIntensity: 0,                // 目标电机强度
      currentMotorIntensity: 0,               // 当前电机强度
      isShocking: false,                      // 是否正在电击
      lastShockTime: 0,                       // 上次电击时间
      pressureHistory: [],                    // 压力历史数据（用于图表）
      intensityHistory: [],                   // 强度历史数据
      delayStartTime: 0,                      // 延迟开始时间
      isInDelayPeriod: false,                 // 是否在延迟期间
      baseIntensity: 0,                       // 基础强度（延迟期结束时的初始强度）
      intensityIncreaseStartTime: 0,          // 强度开始提升的时间
      shockCount: 0,                          // 电击次数
      totalStimulationTime: 0,                // 总刺激时间
      averagePressure: 0,                     // 平均压力
      maxPressure: 0,                         // 最大压力
      minPressure: 0                          // 最小压力
    }
    
    // UI和计时器相关
    this.uiAPI = null
    this.gameTimer = null
    this.statusUpdateTimer = null
    this.stimulationUpdateTimer = null
    this.shockTimer = null
  }
  
  /**
   * 设备依赖配置
   */
  get requiredDevices() {
    return [
      {
        logicalId: "pressure_sensor",
        type: "QIYA",
        name: "气压传感器",
        required: true,
        description: "检测括约肌压力变化"
      },
      {
        logicalId: "motor_controller",
        type: "TD01",
        name: "偏轴电机控制器",
        required: true,
        description: "提供可调节强度的刺激"
      },
      {
        logicalId: "shock_device",
        type: "DIANJI",
        name: "电击设备",
        required: false,
        description: "压力过高时的警示电击"
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
        max: 120,
        step: 1,
        default: 20,
        description: '游戏持续时间（分钟）'
      },
      criticalPressure: {
        name: '临界气压值',
        type: 'number',
        min: 0,
        max: 40,
        step: 0.5,
        default: 20,
        description: '临界气压值（kPa），超过此值将触发电击'
      },
      maxMotorIntensity: {
        name: 'TD01最大强度',
        type: 'number',
        min: 1,
        max: 255,
        step: 1,
        default: 200,
        description: 'TD01电机控制器的最大输出强度'
      },
      lowPressureDelay: {
        name: '压力低时延迟刺激时间',
        type: 'number',
        min: 1,
        max: 30,
        step: 1,
        default: 5,
        description: '压力低于临界值时延迟刺激的时间（秒）'
      },
      stimulationRampRateLimit: {
        name: '刺激强度递增速率限制',
        type: 'number',
        min: 1,
        max: 50,
        step: 1,
        default: 10,
        description: '刺激强度每秒变化不超过此值'
      },
      pressureSensitivity: {
        name: '压力变化敏感度系数',
        type: 'number',
        min: 0.1,
        max: 5.0,
        step: 0.1,
        default: 1.0,
        description: '压力变化对刺激强度影响的敏感度'
      },
      stimulationRampRandomPercent: {
        name: '刺激强度随机扰动百分比',
        type: 'number',
        min: 0,
        max: 100,
        step: 1,
        default: 0,
        description: '刺激强度的随机扰动百分比（0-100%）'
      },
      intensityGradualIncrease: {
        name: '强度逐渐提升速率',
        type: 'number',
        min: 0,
        max: 20,
        step: 0.5,
        default: 2,
        description: '当压力持续低于临界值时，每秒提升的强度值'
      },
      shockIntensity: {
        name: '电击强度',
        type: 'number',
        min: 10,
        max: 100,
        step: 1,
        default: 20,
        description: '电击强度（V）'
      },
      shockDuration: {
        name: '电击持续时间',
        type: 'number',
        min: 0.5,
        max: 5,
        step: 0.1,
        default: 1,
        description: '电击持续时间（秒）'
      }
    }
  }
  
  /**
   * 更新游戏参数
   */
  updateParameters(newParams) {
    for (const [key, value] of Object.entries(newParams)) {
      if (this.config.hasOwnProperty(key)) {
        this.config[key] = value
      }
    }
    this.log('寸止玩法游戏参数已更新:', 'info')
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
    
    this.log(`寸止玩法游戏 v${this.version} 正在启动...`, 'info')
    
    try {
      // 初始化游戏状态
      this.state = {
        ...this.state,
        startTime: Date.now(),
        isGameActive: true,
        currentPressure: 0,
        targetMotorIntensity: 0,
        currentMotorIntensity: 0,
        isShocking: false,
        lastShockTime: 0,
        pressureHistory: [],
        intensityHistory: [],
        delayStartTime: 0,
        isInDelayPeriod: false,
        shockCount: 0,
        totalStimulationTime: 0,
        averagePressure: 0,
        maxPressure: 0,
        minPressure: 999
      }
      
      // 检查设备连接状态
      await this.checkDeviceConnections()
      
      // 初始化设备状态
      await this.initializeDevices()
      
      // 设置设备监听
      this.setupDeviceListeners()
      
      // 启动游戏逻辑
      this.startGameplay()
      
      this.log('寸止玩法游戏启动成功', 'success')
      
    } catch (error) {
      this.log(`游戏启动失败: ${error.message}`, 'error')
      throw error
    }
  }
  
  /**
   * 检查设备连接状态
   */
  async checkDeviceConnections() {
    const requiredDevices = this.requiredDevices.filter(device => device.required)
    
    for (const deviceReq of requiredDevices) {
      const device = this.deviceManager.deviceMap.get(deviceReq.logicalId)
      
      if (!device) {
        throw new Error(`必需设备未映射: ${deviceReq.name}`)
      }
      
      if (!device.connected) {
        throw new Error(`必需设备离线: ${device.name}`)
      }
      
      this.log(`设备检查通过: ${device.name}`, 'info')
    }
    
    // 检查可选设备
    const optionalDevices = this.requiredDevices.filter(device => !device.required)
    for (const deviceReq of optionalDevices) {
      const device = this.deviceManager.deviceMap.get(deviceReq.logicalId)
      if (device && device.connected) {
        this.log(`可选设备已连接: ${device.name}`, 'info')
      } else {
        this.log(`可选设备未连接: ${deviceReq.name}`, 'warning')
      }
    }
  }
  
  /**
   * 初始化设备状态
   */
  async initializeDevices() {
    try {
      // 设置气压传感器汇报延迟为100ms以提高响应速度
      const pressureSensor = this.deviceManager.deviceMap.get('pressure_sensor')
      if (pressureSensor && pressureSensor.connected) {
        await this.deviceManager.setDeviceProperty('pressure_sensor', {
          report_delay_ms: 100
        })
        this.log('气压传感器汇报延迟已设置为100ms，提高游戏响应速度', 'info')
      }
      
      // 初始化TD01电机控制器
      await this.deviceManager.setDeviceProperty('motor_controller', {
        power: 0
      })
      this.log('TD01电机控制器已初始化', 'info')
      
      // 初始化电击设备（如果存在）
      const shockDevice = this.deviceManager.deviceMap.get('shock_device')
      if (shockDevice && shockDevice.connected) {
        await this.deviceManager.setDeviceProperty('shock_device', {
          voltage: this.config.shockIntensity,
          shock: 0
        })
        this.log('电击设备已初始化', 'info')
      }
      
    } catch (error) {
      this.log(`设备初始化失败: ${error.message}`, 'error')
      throw error
    }
  }
  
  /**
   * 设置设备监听
   */
  setupDeviceListeners() {
    // 监听气压传感器数据
    this.deviceManager.listenDeviceProperty('pressure_sensor', 'pressure', (newValue, deviceData) => {
      this.handlePressureChange(newValue)
    })
    
    // 监听气压传感器的所有消息（用于获取更多数据）
    this.deviceManager.listenDeviceMessages('pressure_sensor', (deviceData) => {
      this.handlePressureDeviceMessage(deviceData)
    })
    
    this.log('设备监听已设置', 'info')
  }
  
  /**
   * 处理压力变化
   */
  handlePressureChange(pressure) {
    this.state.currentPressure = pressure
    
    // 更新压力统计
    this.updatePressureStatistics(pressure)
    
    // 记录压力历史
    this.recordPressureHistory(pressure)
    
    // 计算刺激强度
    this.calculateStimulationIntensity()
    
    // 检查是否需要电击
    this.checkShockCondition()
  }
  
  /**
   * 处理气压设备消息
   */
  handlePressureDeviceMessage(deviceData) {
    // 处理设备上报的其他数据
    if (deviceData.method === 'report') {
      // 可以在这里处理更多的传感器数据
      this.log(`气压传感器数据: ${JSON.stringify(deviceData)}`, 'debug')
    }
  }
  
  /**
   * 更新压力统计
   */
  updatePressureStatistics(pressure) {
    // 更新最大最小压力
    this.state.maxPressure = Math.max(this.state.maxPressure, pressure)
    this.state.minPressure = Math.min(this.state.minPressure, pressure)
    
    // 计算平均压力（简单移动平均）
    if (this.state.pressureHistory.length > 0) {
      const recentHistory = this.state.pressureHistory.slice(-60) // 最近60个数据点
      const sum = recentHistory.reduce((acc, item) => acc + item.pressure, 0)
      this.state.averagePressure = sum / recentHistory.length
    }
  }
  
  /**
   * 记录压力历史
   */
  recordPressureHistory(pressure) {
    const now = Date.now()
    this.state.pressureHistory.push({
      time: now,
      pressure: pressure
    })
    
    // 保持历史数据在合理范围内（最多保留10分钟的数据）
    const tenMinutesAgo = now - 10 * 60 * 1000
    this.state.pressureHistory = this.state.pressureHistory.filter(item => item.time > tenMinutesAgo)
  }
  
  /**
   * 计算刺激强度
   */
  calculateStimulationIntensity() {
    const currentPressure = this.state.currentPressure
    const criticalPressure = this.config.criticalPressure
    
    if (currentPressure >= criticalPressure) {
      // 压力超过临界值，停止刺激并重置状态
      this.state.targetMotorIntensity = 0
      this.state.isInDelayPeriod = false
      this.state.baseIntensity = 0
      this.state.intensityIncreaseStartTime = 0
    } else {
      // 压力低于临界值
      const pressureDiff = criticalPressure - currentPressure
      
      if (!this.state.isInDelayPeriod) {
        // 开始延迟期
        this.state.isInDelayPeriod = true
        this.state.delayStartTime = Date.now()
        this.state.targetMotorIntensity = 0
        this.state.baseIntensity = 0
        this.state.intensityIncreaseStartTime = 0
        this.log(`压力低于临界值，开始${this.config.lowPressureDelay}秒延迟期`, 'info')
      } else {
        // 检查延迟期是否结束
        const delayElapsed = (Date.now() - this.state.delayStartTime) / 1000
        
        if (delayElapsed >= this.config.lowPressureDelay) {
          // 延迟期结束，计算目标强度
          const normalizedPressureDiff = pressureDiff / criticalPressure
          let baseTargetIntensity = normalizedPressureDiff * this.config.maxMotorIntensity * this.config.pressureSensitivity
          
          // 如果是第一次计算延迟期后的强度，记录基础强度和开始时间
          if (this.state.intensityIncreaseStartTime === 0) {
            this.state.baseIntensity = baseTargetIntensity
            this.state.intensityIncreaseStartTime = Date.now()
            this.log(`延迟期结束，基础强度: ${baseTargetIntensity.toFixed(1)}，开始逐渐提升`, 'info')
          }
          
          // 计算强度逐渐提升
          const increaseElapsed = (Date.now() - this.state.intensityIncreaseStartTime) / 1000
          const intensityIncrease = increaseElapsed * (this.config.intensityGradualIncrease || 0)
          let targetIntensity = (this.state.baseIntensity || 0) + intensityIncrease
          
          // 应用随机扰动
          if (this.config.stimulationRampRandomPercent > 0) {
            const randomFactor = 1 + (Math.random() - 0.5) * 2 * (this.config.stimulationRampRandomPercent / 100)
            targetIntensity *= randomFactor
          }
          
          // 限制在最大强度范围内
          this.state.targetMotorIntensity = Math.min(Math.max(targetIntensity, 0), this.config.maxMotorIntensity)
        }
      }
    }
  }
  
  /**
   * 检查电击条件
   */
  checkShockCondition() {
    const currentPressure = this.state.currentPressure
    const criticalPressure = this.config.criticalPressure
    
    if (currentPressure >= criticalPressure && !this.state.isShocking) {
      this.triggerShock()
    }
  }
  
  /**
   * 触发电击
   */
  async triggerShock() {
    const shockDevice = this.deviceManager.deviceMap.get('shock_device')
    if (!shockDevice || !shockDevice.connected) {
      this.log('电击设备未连接，无法执行电击', 'warning')
      return
    }
    
    if (this.state.isShocking) {
      return // 已在电击中
    }
    
    try {
      this.state.isShocking = true
      this.state.lastShockTime = Date.now()
      this.state.shockCount++
      
      this.log(`触发电击 - 强度: ${this.config.shockIntensity}V, 持续: ${this.config.shockDuration}秒`, 'warning')
      
      // 开始电击
      await this.deviceManager.setDeviceProperty('shock_device', {
        voltage: this.config.shockIntensity,
        shock: 1
      })
      
      // 设置电击持续时间
      this.shockTimer = setTimeout(async () => {
        await this.stopShock()
      }, this.config.shockDuration * 1000)
      
    } catch (error) {
      this.log(`电击执行失败: ${error.message}`, 'error')
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
      
      this.log('电击已停止', 'info')
      
    } catch (error) {
      this.log(`停止电击失败: ${error.message}`, 'error')
    }
  }
  
  /**
   * 启动游戏逻辑
   */
  startGameplay() {
    // 启动游戏计时器
    this.startGameTimer()
    
    // 启动状态更新计时器
    this.startStatusUpdateTimer()
    
    // 启动刺激更新计时器
    this.startStimulationUpdateTimer()
    
    // 渲染初始UI
    this.renderUI()
    
    this.log('游戏逻辑已启动', 'info')
  }
  
  /**
   * 启动游戏计时器
   */
  startGameTimer() {
    const duration = this.config.duration * 60 * 1000
    
    this.gameTimer = setTimeout(async () => {
      await this.endGame()
    }, duration)
    
    this.log(`游戏计时器已启动，持续时间: ${this.config.duration}分钟`, 'info')
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
    }, 1000) // 每秒更新
  }
  
  /**
   * 启动刺激更新计时器
   */
  startStimulationUpdateTimer() {
    this.stimulationUpdateTimer = setInterval(async () => {
      if (this.state.isGameActive) {
        await this.updateStimulationIntensity()
      }
    }, 100) // 每100ms更新一次刺激强度
  }
  
  /**
   * 更新刺激强度
   */
  async updateStimulationIntensity() {
    const targetIntensity = this.state.targetMotorIntensity
    const currentIntensity = this.state.currentMotorIntensity
    
    if (Math.abs(targetIntensity - currentIntensity) < 1) {
      return // 差异很小，不需要更新
    }
    
    // 计算强度变化速率限制
    const maxChange = this.config.stimulationRampRateLimit / 10 // 每100ms的最大变化
    
    let newIntensity
    if (targetIntensity > currentIntensity) {
      newIntensity = Math.min(currentIntensity + maxChange, targetIntensity)
    } else {
      newIntensity = targetIntensity
    }
    
    // 更新电机强度
    try {
      await this.deviceManager.setDeviceProperty('motor_controller', {
        power: Math.round(newIntensity)
      })
      
      this.state.currentMotorIntensity = newIntensity
      
      // 记录强度历史
      this.recordIntensityHistory(newIntensity)
      
      // 更新总刺激时间
      if (newIntensity > 0) {
        this.state.totalStimulationTime += 0.1 // 100ms = 0.1秒
      }
      
    } catch (error) {
      this.log(`更新刺激强度失败: ${error.message}`, 'error')
    }
  }
  
  /**
   * 记录强度历史
   */
  recordIntensityHistory(intensity) {
    const now = Date.now()
    this.state.intensityHistory.push({
      time: now,
      intensity: intensity
    })
    
    // 保持历史数据在合理范围内
    const tenMinutesAgo = now - 10 * 60 * 1000
    this.state.intensityHistory = this.state.intensityHistory.filter(item => item.time > tenMinutesAgo)
  }
  
  /**
   * 更新游戏状态
   */
  updateGameStatus() {
    // 这里可以添加其他状态更新逻辑
    // 例如计算剩余时间等
  }
  
  /**
   * 游戏循环检查
   */
  async loop(deviceManager) {
    if (!this.state.isGameActive) {
      return false // 游戏已结束
    }
    
    // 检查游戏结束条件
    const elapsed = Date.now() - this.state.startTime
    const duration = this.config.duration * 60 * 1000
    
    if (elapsed >= duration) {
      await this.endGame()
      return false
    }
    
    return true // 游戏继续
  }
  
  /**
   * 渲染UI界面
   */
  renderUI() {
    if (!this.uiAPI) return
    
    const elapsed = Date.now() - this.state.startTime
    const duration = this.config.duration * 60 * 1000
    const remainingTime = Math.max(0, duration - elapsed)
    const remainingMinutes = Math.floor(remainingTime / 60000)
    const remainingSeconds = Math.floor((remainingTime % 60000) / 1000)
    
    // 获取压力状态
    const pressureStatus = this.getPressureStatus()
    
    const html = `
      <style>
        .pressure-game-container {
          padding: 20px;
          font-family: 'Microsoft YaHei', sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          color: white;
        }
        
        .game-header {
          text-align: center;
          margin-bottom: 30px;
        }
        
        .game-title {
          font-size: 2.5em;
          margin-bottom: 10px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .game-timer {
          font-size: 1.5em;
          background: rgba(255,255,255,0.2);
          padding: 10px 20px;
          border-radius: 25px;
          display: inline-block;
        }
        
        .main-display {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-bottom: 30px;
        }
        
        .pressure-panel {
          background: rgba(255,255,255,0.1);
          border-radius: 15px;
          padding: 25px;
          backdrop-filter: blur(10px);
        }
        
        .panel-title {
          font-size: 1.3em;
          margin-bottom: 20px;
          text-align: center;
          font-weight: bold;
        }
        
        .pressure-display {
          text-align: center;
          margin-bottom: 20px;
        }
        
        .pressure-value {
          font-size: 3em;
          font-weight: bold;
          margin-bottom: 10px;
        }
        
        .pressure-unit {
          font-size: 1.2em;
          opacity: 0.8;
        }
        
        .pressure-bar {
          width: 100%;
          height: 30px;
          background: rgba(255,255,255,0.2);
          border-radius: 15px;
          overflow: hidden;
          margin-bottom: 15px;
        }
        
        .pressure-fill {
          height: 100%;
          transition: width 0.3s ease;
          border-radius: 15px;
        }
        
        .pressure-normal { background: #4CAF50; }
        .pressure-warning { background: #FF9800; }
        .pressure-critical { background: #F44336; }
        
        .critical-line {
          position: relative;
          height: 2px;
          background: #FF5722;
          margin: 10px 0;
        }
        
        .critical-label {
          position: absolute;
          right: 0;
          top: -20px;
          font-size: 0.9em;
          color: #FF5722;
        }
        
        .motor-panel {
          background: rgba(255,255,255,0.1);
          border-radius: 15px;
          padding: 25px;
          backdrop-filter: blur(10px);
        }
        
        .motor-display {
          text-align: center;
          margin-bottom: 20px;
        }
        
        .motor-value {
          font-size: 2.5em;
          font-weight: bold;
          margin-bottom: 10px;
        }
        
        .motor-bar {
          width: 100%;
          height: 25px;
          background: rgba(255,255,255,0.2);
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 15px;
        }
        
        .motor-fill {
          height: 100%;
          background: linear-gradient(90deg, #4CAF50, #FF9800, #F44336);
          transition: width 0.3s ease;
          border-radius: 12px;
        }
        
        .status-indicators {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        
        .status-card {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 15px;
          text-align: center;
          backdrop-filter: blur(10px);
        }
        
        .status-icon {
          font-size: 2em;
          margin-bottom: 10px;
        }
        
        .status-label {
          font-size: 0.9em;
          opacity: 0.8;
          margin-bottom: 5px;
        }
        
        .status-value {
          font-size: 1.2em;
          font-weight: bold;
        }
        
        .chart-container {
          background: rgba(255,255,255,0.1);
          border-radius: 15px;
          padding: 25px;
          backdrop-filter: blur(10px);
          margin-bottom: 20px;
        }
        
        .chart-title {
          font-size: 1.2em;
          margin-bottom: 15px;
          text-align: center;
          font-weight: bold;
        }
        
        .mini-chart {
          width: 100%;
          height: 150px;
          background: rgba(0,0,0,0.2);
          border-radius: 10px;
          position: relative;
          overflow: hidden;
        }
        
        .chart-line {
          position: absolute;
          bottom: 0;
          width: 2px;
          background: #4CAF50;
          transition: height 0.3s ease;
        }
        
        .emergency-button {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #F44336;
          color: white;
          border: none;
          padding: 15px 25px;
          border-radius: 25px;
          font-size: 1.1em;
          font-weight: bold;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(244, 67, 54, 0.3);
          transition: all 0.3s ease;
        }
        
        .emergency-button:hover {
          background: #D32F2F;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(244, 67, 54, 0.4);
        }
        
        .delay-indicator {
          background: rgba(255, 193, 7, 0.2);
          border: 2px solid #FFC107;
          border-radius: 10px;
          padding: 15px;
          margin: 15px 0;
          text-align: center;
        }
        
        .shock-indicator {
          background: rgba(244, 67, 54, 0.2);
          border: 2px solid #F44336;
          border-radius: 10px;
          padding: 15px;
          margin: 15px 0;
          text-align: center;
          animation: pulse 1s infinite;
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
      </style>
      
      <div class="pressure-game-container">
        <button class="emergency-button" onclick="window.gameplayUI.handleUIEvent('emergency_stop')">
          🚨 紧急停止
        </button>
        
        <div class="game-header">
          <h1 class="game-title">寸止玩法游戏</h1>
          <div class="game-timer">
            剩余时间: ${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}
          </div>
        </div>
        
        <div class="main-display">
          <div class="pressure-panel">
            <div class="panel-title">🌡️ 压力监测</div>
            <div class="pressure-display">
              <div class="pressure-value ${pressureStatus.class}">
                ${this.state.currentPressure.toFixed(2)}
              </div>
              <div class="pressure-unit">kPa</div>
            </div>
            
            <div class="pressure-bar">
              <div class="pressure-fill ${pressureStatus.class}" 
                   style="width: ${Math.min((this.state.currentPressure / (this.config.criticalPressure * 1.5)) * 100, 100)}%">
              </div>
            </div>
            
            <div class="critical-line">
              <div class="critical-label">临界值: ${this.config.criticalPressure} kPa</div>
            </div>
            
            ${this.state.isInDelayPeriod ? `
              <div class="delay-indicator">
                ⏳ 延迟期间 - 等待刺激启动
              </div>
            ` : ''}
            
            ${this.state.isShocking ? `
              <div class="shock-indicator">
                ⚡ 电击进行中
              </div>
            ` : ''}
          </div>
          
          <div class="motor-panel">
            <div class="panel-title">⚡ 刺激强度</div>
            <div class="motor-display">
              <div class="motor-value">
                ${Math.round(this.state.currentMotorIntensity || 0)}
              </div>
              <div class="pressure-unit">/ ${this.config.maxMotorIntensity}</div>
            </div>
            
            <div class="motor-bar">
              <div class="motor-fill" 
                   style="width: ${((this.state.currentMotorIntensity || 0) / this.config.maxMotorIntensity) * 100}%">
              </div>
            </div>
            
            <div style="margin-top: 15px; font-size: 0.9em; opacity: 0.8;">
              目标强度: ${Math.round(this.state.targetMotorIntensity || 0)}
            </div>
            
            ${this.state.intensityIncreaseStartTime > 0 ? `
              <div style="margin-top: 10px; padding: 10px; background: rgba(76, 175, 80, 0.2); border-radius: 8px; font-size: 0.85em;">
                <div style="margin-bottom: 5px;">📈 强度提升中</div>
                <div>基础强度: ${(this.state.baseIntensity || 0).toFixed(1)}</div>
                <div>提升速率: +${(this.config.intensityGradualIncrease || 0)}/秒</div>
                <div>已提升: ${(((Date.now() - this.state.intensityIncreaseStartTime) / 1000 * (this.config.intensityGradualIncrease || 0)) || 0).toFixed(1)}</div>
              </div>
            ` : ''}
          </div>
        </div>
        
        <div class="status-indicators">
          <div class="status-card">
            <div class="status-icon">📊</div>
            <div class="status-label">平均压力</div>
            <div class="status-value">${this.state.averagePressure.toFixed(1)} kPa</div>
          </div>
          
          <div class="status-card">
            <div class="status-icon">📈</div>
            <div class="status-label">最大压力</div>
            <div class="status-value">${this.state.maxPressure.toFixed(1)} kPa</div>
          </div>
          
          <div class="status-card">
            <div class="status-icon">⚡</div>
            <div class="status-label">电击次数</div>
            <div class="status-value">${this.state.shockCount}</div>
          </div>
          
          <div class="status-card">
            <div class="status-icon">⏱️</div>
            <div class="status-label">刺激时间</div>
            <div class="status-value">${Math.round(this.state.totalStimulationTime)}s</div>
          </div>
        </div>
        
        <div class="chart-container">
          <div class="chart-title">📈 实时压力曲线</div>
          <div class="mini-chart" id="pressureChart">
            ${this.renderPressureChart()}
          </div>
        </div>
      </div>
    `
    
    this.uiAPI.updateUI(html)
  }
  
  /**
   * 获取压力状态
   */
  getPressureStatus() {
    const pressure = this.state.currentPressure
    const critical = this.config.criticalPressure
    
    if (pressure >= critical) {
      return { class: 'pressure-critical', status: '危险' }
    } else if (pressure >= critical * 0.8) {
      return { class: 'pressure-warning', status: '警告' }
    } else {
      return { class: 'pressure-normal', status: '正常' }
    }
  }
  
  /**
   * 渲染压力图表
   */
  renderPressureChart() {
    const history = this.state.pressureHistory.slice(-60) // 最近60个数据点
    if (history.length === 0) return ''
    
    const maxPressure = Math.max(this.config.criticalPressure * 1.2, ...history.map(h => h.pressure))
    
    return history.map((item, index) => {
      const height = (item.pressure / maxPressure) * 100
      const left = (index / 59) * 100
      return `<div class="chart-line" style="left: ${left}%; height: ${height}%;"></div>`
    }).join('')
  }
  
  /**
   * 处理UI事件
   */
  handleUIEvent(eventType, data) {
    switch (eventType) {
      case 'emergency_stop':
        this.emergencyStop()
        break
      default:
        this.log(`未知UI事件: ${eventType}`, 'warning')
    }
  }
  
  /**
   * 紧急停止
   */
  async emergencyStop() {
    this.log('紧急停止被触发', 'warning')
    await this.endGame()
  }
  
  /**
   * 结束游戏
   */
  async endGame() {
    this.log('游戏结束', 'info')
    
    this.state.isGameActive = false
    
    // 停止所有设备
    await this.stopAllDevices()
    
    // 清理计时器
    this.cleanupTimers()
    
    // 渲染结束界面
    this.renderEndUI()
  }
  
  /**
   * 停止所有设备
   */
  async stopAllDevices() {
    try {
      // 恢复气压传感器汇报延迟到默认值5000ms
      const pressureSensor = this.deviceManager.deviceMap.get('pressure_sensor')
      if (pressureSensor && pressureSensor.connected) {
        await this.deviceManager.setDeviceProperty('pressure_sensor', {
          report_delay_ms: 5000
        })
        this.log('气压传感器汇报延迟已恢复到5000ms', 'info')
      }
      
      // 停止电机
      await this.deviceManager.setDeviceProperty('motor_controller', {
        power: 0
      })
      this.log('电机已停止', 'info')
      
      // 停止电击
      await this.stopShock()
      
    } catch (error) {
      this.log(`停止设备失败: ${error.message}`, 'error')
    }
  }
  
  /**
   * 清理计时器
   */
  cleanupTimers() {
    if (this.gameTimer) {
      clearTimeout(this.gameTimer)
      this.gameTimer = null
    }
    
    if (this.statusUpdateTimer) {
      clearInterval(this.statusUpdateTimer)
      this.statusUpdateTimer = null
    }
    
    if (this.stimulationUpdateTimer) {
      clearInterval(this.stimulationUpdateTimer)
      this.stimulationUpdateTimer = null
    }
    
    if (this.shockTimer) {
      clearTimeout(this.shockTimer)
      this.shockTimer = null
    }
  }
  
  /**
   * 渲染结束界面
   */
  renderEndUI() {
    if (!this.uiAPI) return
    
    const totalTime = (Date.now() - this.state.startTime) / 1000
    const totalMinutes = Math.floor(totalTime / 60)
    const totalSeconds = Math.floor(totalTime % 60)
    
    const html = `
      <style>
        .end-game-container {
          padding: 40px;
          font-family: 'Microsoft YaHei', sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          color: white;
          text-align: center;
        }
        
        .end-title {
          font-size: 3em;
          margin-bottom: 30px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin: 40px 0;
        }
        
        .stat-card {
          background: rgba(255,255,255,0.1);
          border-radius: 15px;
          padding: 25px;
          backdrop-filter: blur(10px);
        }
        
        .stat-icon {
          font-size: 2.5em;
          margin-bottom: 15px;
        }
        
        .stat-label {
          font-size: 1.1em;
          opacity: 0.8;
          margin-bottom: 10px;
        }
        
        .stat-value {
          font-size: 2em;
          font-weight: bold;
        }
        
        .performance-rating {
          background: rgba(255,255,255,0.1);
          border-radius: 15px;
          padding: 30px;
          margin: 30px 0;
          backdrop-filter: blur(10px);
        }
        
        .rating-title {
          font-size: 1.5em;
          margin-bottom: 20px;
        }
        
        .rating-score {
          font-size: 3em;
          font-weight: bold;
          margin-bottom: 15px;
        }
        
        .rating-description {
          font-size: 1.2em;
          opacity: 0.9;
        }
      </style>
      
      <div class="end-game-container">
        <h1 class="end-title">🎯 游戏完成</h1>
        
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">⏱️</div>
            <div class="stat-label">游戏时长</div>
            <div class="stat-value">${totalMinutes}:${totalSeconds.toString().padStart(2, '0')}</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">📊</div>
            <div class="stat-label">平均压力</div>
            <div class="stat-value">${this.state.averagePressure.toFixed(1)} kPa</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">📈</div>
            <div class="stat-label">最大压力</div>
            <div class="stat-value">${this.state.maxPressure.toFixed(1)} kPa</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">⚡</div>
            <div class="stat-label">电击次数</div>
            <div class="stat-value">${this.state.shockCount}</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">🎯</div>
            <div class="stat-label">刺激时间</div>
            <div class="stat-value">${Math.round(this.state.totalStimulationTime)}s</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">🎮</div>
            <div class="stat-label">控制精度</div>
            <div class="stat-value">${this.calculateControlAccuracy()}%</div>
          </div>
        </div>
        
        <div class="performance-rating">
          <div class="rating-title">综合评价</div>
          <div class="rating-score">${this.getPerformanceRating().score}</div>
          <div class="rating-description">${this.getPerformanceRating().description}</div>
        </div>
      </div>
    `
    
    this.uiAPI.updateUI(html)
  }
  
  /**
   * 计算控制精度
   */
  calculateControlAccuracy() {
    if (this.state.pressureHistory.length === 0) return 0
    
    const criticalPressure = this.config.criticalPressure
    const optimalRange = criticalPressure * 0.1 // 10%的最优范围
    
    let inRangeCount = 0
    for (const item of this.state.pressureHistory) {
      const distanceFromCritical = Math.abs(item.pressure - criticalPressure)
      if (distanceFromCritical <= optimalRange) {
        inRangeCount++
      }
    }
    
    return Math.round((inRangeCount / this.state.pressureHistory.length) * 100)
  }
  
  /**
   * 获取性能评级
   */
  getPerformanceRating() {
    const accuracy = this.calculateControlAccuracy()
    const shockRate = this.state.shockCount / (this.config.duration * 60) * 100 // 每分钟电击次数
    
    if (accuracy >= 80 && shockRate <= 1) {
      return { score: 'S', description: '完美控制！寸止技巧已达到大师级别' }
    } else if (accuracy >= 60 && shockRate <= 3) {
      return { score: 'A', description: '优秀表现！控制能力很强' }
    } else if (accuracy >= 40 && shockRate <= 5) {
      return { score: 'B', description: '良好表现！还有提升空间' }
    } else if (accuracy >= 20 && shockRate <= 8) {
      return { score: 'C', description: '一般表现，需要更多练习' }
    } else {
      return { score: 'D', description: '需要大量练习来提高控制能力' }
    }
  }
  
  /**
   * 外部结束游戏方法
   */
  async end(deviceManager) {
    await this.endGame()
  }
  
  /**
   * 日志记录
   */
  log(message, level = 'info') {
    const timestamp = new Date().toLocaleTimeString()
    const logMessage = `[${timestamp}] [寸止游戏] ${message}`
    
    console.log(logMessage)
    
    // 发送到游戏日志系统
    if (window.gameplayUI && window.gameplayUI.addLog) {
      window.gameplayUI.addLog(logMessage, level)
    }
  }
}

// 导出游戏类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PressureEdgingGame
} else {
  window.PressureEdgingGame = PressureEdgingGame
}