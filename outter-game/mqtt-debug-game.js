/**
 * MQTT调试游戏 - 专门用于显示映射设备的MQTT日志
 * 实时监控所有MQTT消息，帮助调试消息延迟和丢失问题
 */
export class MqttDebugGame {
  constructor() {
    this.title = "MQTT调试工具"
    this.description = "实时显示所有设备MQTT消息，用于调试消息延迟和丢失问题"
    this.version = "1.0.0"
    this.author = "调试工具"
    
    // 游戏状态
    this.state = {
      startTime: 0,
      isGameActive: false,
      messageCount: 0,
      lastMessageTime: 0,
      messageHistory: [],
      deviceStats: new Map() // 设备消息统计
    }
    
    // UI相关
    this.uiAPI = null
    this.statusUpdateTimer = null
    this.maxHistorySize = 1000 // 最大历史消息数量
  }
  
  /**
   * 设备依赖配置 - 不需要特定设备
   */
  get requiredDevices() {
    return []
  }
  
  /**
   * 可配置参数定义
   */
  get parameters() {
    return {
      maxMessages: {
        name: '最大消息数量',
        type: 'number',
        min: 100,
        max: 5000,
        step: 100,
        default: 1000,
        description: '界面显示的最大消息历史数量'
      },
      showRawPayload: {
        name: '显示原始载荷',
        type: 'boolean',
        default: true,
        description: '是否显示完整的原始MQTT载荷数据'
      },
      filterDeviceMessages: {
        name: '仅显示设备消息',
        type: 'boolean',
        default: true,
        description: '仅显示/dpub/开头的设备上报消息'
      },
      highlightDelays: {
        name: '高亮延迟消息',
        type: 'boolean',
        default: true,
        description: '高亮显示处理时间超过阈值的消息'
      },
      delayThreshold: {
        name: '延迟阈值(ms)',
        type: 'number',
        min: 10,
        max: 1000,
        step: 10,
        default: 100,
        description: '消息处理延迟的警告阈值（毫秒）'
      }
    }
  }
  
  /**
   * 更新参数配置
   */
  updateParameters(newParams) {
    for (const [key, value] of Object.entries(newParams)) {
      if (this.parameters[key]) {
        if (typeof this.parameters[key] === 'object' && this.parameters[key].default !== undefined) {
          this.parameters[key].default = value
        } else {
          this.parameters[key] = value
        }
      }
    }
    this.maxHistorySize = this.parameters.maxMessages.default
    console.log('MQTT调试工具参数已更新:', newParams)
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
    
    this.log(`MQTT调试工具 v${this.version} 正在启动...`, 'info')
    
    try {
      // 初始化游戏状态
      this.state = {
        startTime: Date.now(),
        isGameActive: true,
        messageCount: 0,
        lastMessageTime: 0,
        messageHistory: [],
        deviceStats: new Map()
      }
      
      // 设置MQTT消息监听
      this.setupMqttListener()
      
      // 启动状态更新计时器
      this.startStatusUpdateTimer()
      
      // 渲染初始UI
      this.renderUI()
      
      this.log('MQTT调试工具启动成功，开始监控所有MQTT消息', 'success')
      
    } catch (error) {
      this.log(`调试工具启动失败: ${error.message}`, 'error')
      throw error
    }
  }
  
  /**
   * 设置MQTT消息监听
   */
  setupMqttListener() {
    if (window.electronAPI && window.electronAPI.onMqttMessage) {
      window.electronAPI.onMqttMessage((message) => {
        this.handleMqttMessage(message)
      })
      this.log('MQTT消息监听已设置', 'info')
    } else {
      this.log('MQTT API不可用', 'error')
    }
  }
  
  /**
   * 处理MQTT消息
   */
  handleMqttMessage(message) {
    const receiveTime = Date.now()
    
    // 过滤设备消息
    if (this.parameters.filterDeviceMessages.default) {
      if (!message.topic.startsWith('/dpub/')) {
        return
      }
    }
    
    this.state.messageCount++
    this.state.lastMessageTime = receiveTime
    
    // 解析设备ID
    const deviceId = this.extractDeviceId(message.topic)
    
    // 解析载荷
    let parsedPayload = null
    let parseError = null
    try {
      parsedPayload = JSON.parse(message.payload)
    } catch (e) {
      parseError = e.message
    }
    
    // 创建消息记录
    const messageRecord = {
      id: this.state.messageCount,
      timestamp: receiveTime,
      topic: message.topic,
      deviceId: deviceId,
      rawPayload: message.payload,
      parsedPayload: parsedPayload,
      parseError: parseError,
      processingTime: 0 // 将在后续计算
    }
    
    // 计算处理延迟（模拟）
    const processingStart = performance.now()
    setTimeout(() => {
      const processingEnd = performance.now()
      messageRecord.processingTime = processingEnd - processingStart
      
      // 检查是否超过延迟阈值
      if (messageRecord.processingTime > this.parameters.delayThreshold.default) {
        this.log(`检测到消息处理延迟: ${messageRecord.processingTime.toFixed(2)}ms - ${message.topic}`, 'warning')
      }
    }, 0)
    
    // 添加到历史记录
    this.state.messageHistory.unshift(messageRecord)
    
    // 限制历史记录大小
    if (this.state.messageHistory.length > this.maxHistorySize) {
      this.state.messageHistory = this.state.messageHistory.slice(0, this.maxHistorySize)
    }
    
    // 更新设备统计
    this.updateDeviceStats(deviceId, messageRecord)
    
    // 记录日志
    this.log(`MQTT消息 [${deviceId || 'Unknown'}]: ${message.topic}`, 'info')
    if (this.parameters.showRawPayload.default) {
      this.log(`载荷: ${message.payload}`, 'debug')
    }
    
    // 更新UI
    this.renderUI()
  }
  
  /**
   * 提取设备ID
   */
  extractDeviceId(topic) {
    const match = topic.match(/^\/dpub\/(.+)$/)
    return match ? match[1] : null
  }
  
  /**
   * 更新设备统计
   */
  updateDeviceStats(deviceId, messageRecord) {
    if (!deviceId) return
    
    if (!this.state.deviceStats.has(deviceId)) {
      this.state.deviceStats.set(deviceId, {
        messageCount: 0,
        lastMessageTime: 0,
        firstMessageTime: messageRecord.timestamp,
        totalProcessingTime: 0,
        maxProcessingTime: 0,
        errorCount: 0
      })
    }
    
    const stats = this.state.deviceStats.get(deviceId)
    stats.messageCount++
    stats.lastMessageTime = messageRecord.timestamp
    stats.totalProcessingTime += messageRecord.processingTime
    stats.maxProcessingTime = Math.max(stats.maxProcessingTime, messageRecord.processingTime)
    
    if (messageRecord.parseError) {
      stats.errorCount++
    }
  }
  
  /**
   * 启动状态更新计时器
   */
  startStatusUpdateTimer() {
    this.statusUpdateTimer = setInterval(() => {
      this.renderUI()
    }, 1000) // 每秒更新一次UI
  }
  
  /**
   * 渲染UI界面
   */
  renderUI() {
    if (!this.uiAPI) return
    
    const runningTime = Math.floor((Date.now() - this.state.startTime) / 1000)
    const messageRate = this.state.messageCount / Math.max(runningTime, 1)
    
    let html = `
      <div class="mqtt-debug-container">
        <div class="debug-header">
          <h2>🔍 MQTT调试工具</h2>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">运行时间:</span>
              <span class="stat-value">${this.formatTime(runningTime)}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">消息总数:</span>
              <span class="stat-value">${this.state.messageCount}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">消息速率:</span>
              <span class="stat-value">${messageRate.toFixed(2)} msg/s</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">活跃设备:</span>
              <span class="stat-value">${this.state.deviceStats.size}</span>
            </div>
          </div>
        </div>
        
        <div class="debug-content">
          <div class="device-stats">
            <h3>📊 设备统计</h3>
            <div class="device-list">
              ${this.renderDeviceStats()}
            </div>
          </div>
          
          <div class="message-history">
            <h3>📨 消息历史 (最近${Math.min(this.state.messageHistory.length, 20)}条)</h3>
            <div class="message-list">
              ${this.renderMessageHistory()}
            </div>
          </div>
        </div>
      </div>
      
      <style>
        .mqtt-debug-container {
          padding: 20px;
          font-family: 'Consolas', 'Monaco', monospace;
          background: #1a1a1a;
          color: #e0e0e0;
          border-radius: 8px;
          max-height: 80vh;
          overflow-y: auto;
        }
        
        .debug-header {
          margin-bottom: 20px;
          border-bottom: 2px solid #333;
          padding-bottom: 15px;
        }
        
        .debug-header h2 {
          margin: 0 0 15px 0;
          color: #4CAF50;
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
        }
        
        .stat-item {
          background: #2a2a2a;
          padding: 10px;
          border-radius: 5px;
          border-left: 4px solid #4CAF50;
        }
        
        .stat-label {
          display: block;
          font-size: 12px;
          color: #888;
          margin-bottom: 5px;
        }
        
        .stat-value {
          font-size: 16px;
          font-weight: bold;
          color: #4CAF50;
        }
        
        .debug-content {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 20px;
        }
        
        .device-stats, .message-history {
          background: #2a2a2a;
          padding: 15px;
          border-radius: 5px;
        }
        
        .device-stats h3, .message-history h3 {
          margin: 0 0 15px 0;
          color: #FFC107;
        }
        
        .device-list, .message-list {
          max-height: 400px;
          overflow-y: auto;
        }
        
        .device-item {
          background: #333;
          margin-bottom: 10px;
          padding: 10px;
          border-radius: 3px;
          border-left: 3px solid #2196F3;
        }
        
        .device-name {
          font-weight: bold;
          color: #2196F3;
          margin-bottom: 5px;
        }
        
        .device-info {
          font-size: 12px;
          color: #ccc;
        }
        
        .message-item {
          background: #333;
          margin-bottom: 8px;
          padding: 8px;
          border-radius: 3px;
          font-size: 12px;
        }
        
        .message-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
        }
        
        .message-topic {
          color: #FF9800;
          font-weight: bold;
        }
        
        .message-time {
          color: #888;
        }
        
        .message-payload {
          color: #E0E0E0;
          word-break: break-all;
          max-height: 60px;
          overflow-y: auto;
        }
        
        .message-delayed {
          border-left: 3px solid #F44336;
        }
        
        .message-error {
          border-left: 3px solid #FF5722;
        }
        
        .processing-time {
          color: #FFC107;
          font-size: 10px;
        }
      </style>
    `
    
    this.uiAPI.updateGameUI(html)
  }
  
  /**
   * 渲染设备统计
   */
  renderDeviceStats() {
    if (this.state.deviceStats.size === 0) {
      return '<div class="device-item">暂无设备消息</div>'
    }
    
    let html = ''
    for (const [deviceId, stats] of this.state.deviceStats) {
      const avgProcessingTime = stats.messageCount > 0 ? stats.totalProcessingTime / stats.messageCount : 0
      const timeSinceLastMessage = Date.now() - stats.lastMessageTime
      
      html += `
        <div class="device-item">
          <div class="device-name">${deviceId}</div>
          <div class="device-info">
            消息数: ${stats.messageCount} | 
            平均延迟: ${avgProcessingTime.toFixed(2)}ms | 
            最大延迟: ${stats.maxProcessingTime.toFixed(2)}ms<br>
            错误数: ${stats.errorCount} | 
            最后消息: ${this.formatTimeAgo(timeSinceLastMessage)}
          </div>
        </div>
      `
    }
    
    return html
  }
  
  /**
   * 渲染消息历史
   */
  renderMessageHistory() {
    if (this.state.messageHistory.length === 0) {
      return '<div class="message-item">暂无消息</div>'
    }
    
    let html = ''
    const recentMessages = this.state.messageHistory.slice(0, 20)
    
    for (const message of recentMessages) {
      const isDelayed = message.processingTime > this.parameters.delayThreshold.default
      const hasError = message.parseError !== null
      
      let cssClass = 'message-item'
      if (isDelayed) cssClass += ' message-delayed'
      if (hasError) cssClass += ' message-error'
      
      const payload = this.parameters.showRawPayload.default ? 
        message.rawPayload : 
        (message.parsedPayload ? JSON.stringify(message.parsedPayload, null, 2) : message.rawPayload)
      
      html += `
        <div class="${cssClass}">
          <div class="message-header">
            <span class="message-topic">${message.topic}</span>
            <span class="message-time">${new Date(message.timestamp).toLocaleTimeString()}</span>
          </div>
          <div class="message-payload">${payload}</div>
          ${message.processingTime > 0 ? `<div class="processing-time">处理时间: ${message.processingTime.toFixed(2)}ms</div>` : ''}
          ${hasError ? `<div style="color: #F44336; font-size: 10px;">解析错误: ${message.parseError}</div>` : ''}
        </div>
      `
    }
    
    return html
  }
  
  /**
   * 格式化时间
   */
  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`
    }
  }
  
  /**
   * 格式化时间差
   */
  formatTimeAgo(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000)
    
    if (seconds < 60) {
      return `${seconds}秒前`
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}分钟前`
    } else {
      return `${Math.floor(seconds / 3600)}小时前`
    }
  }
  
  /**
   * 游戏停止
   */
  async stop() {
    this.state.isGameActive = false
    
    // 清理计时器
    if (this.statusUpdateTimer) {
      clearInterval(this.statusUpdateTimer)
      this.statusUpdateTimer = null
    }
    
    this.log('MQTT调试工具已停止', 'info')
  }
  
  /**
   * 日志输出
   */
  log(message, level = 'info') {
    const timestamp = new Date().toLocaleTimeString()
    console.log(`[${timestamp}] [${level.toUpperCase()}] [MQTT调试工具] ${message}`)
    
    // 如果有设备管理器，使用其日志系统
    if (this.deviceManager && this.deviceManager.sendLog) {
      this.deviceManager.sendLog(`[MQTT调试工具] ${message}`, level)
    }
  }
}