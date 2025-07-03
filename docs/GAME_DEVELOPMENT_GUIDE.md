# 游戏开发指南

本文档基于 `maid-punishment-game.js` 的实现，说明如何在本系统中开发自定义游戏。

## 游戏类基本结构

### 1. 类定义和构造函数

```javascript
export class YourGameName {
  constructor() {
    // 游戏基本信息
    this.title = "游戏标题"
    this.description = "游戏描述"
    this.version = "1.0.0"
    this.author = "作者名称"
    
    // 游戏配置参数
    this.config = {
      // 在这里定义游戏的可配置参数
    }
    
    // 游戏状态
    this.state = {
      // 在这里定义游戏运行时的状态变量
    }
    
    // UI和计时器相关
    this.uiAPI = null
    this.gameTimer = null
    // 其他计时器...
  }
}
```

### 2. 必须实现的属性和方法

#### 2.1 设备依赖配置 (必需)

```javascript
get requiredDevices() {
  return [
    {
      logicalId: "device_logical_id",  // 逻辑设备ID
      type: "DEVICE_TYPE",             // 设备类型
      name: "设备显示名称",
      required: true,                   // 是否必需
      description: "设备用途描述"
    }
    // 更多设备...
  ]
}
```

**支持的设备类型：**
- `ZIDONGSUO` - 自动锁设备
- `DIANJI` - 电击设备
- `QTZ` - QTZ激光测距传感器
- `TD01` - TD01设备

#### 2.2 可配置参数定义 (必需)

```javascript
get parameters() {
  return {
    parameterName: {
      name: '参数显示名称',
      type: 'number|boolean|string',  // 参数类型
      min: 1,                         // 数字类型的最小值
      max: 100,                       // 数字类型的最大值
      step: 1,                        // 数字类型的步长
      default: 10,                    // 默认值
      description: '参数描述'
    }
    // 更多参数...
  }
}
```

#### 2.3 核心方法

##### updateParameters(newParams) - 必需

```javascript
updateParameters(newParams) {
  for (const [key, value] of Object.entries(newParams)) {
    if (this.config.hasOwnProperty(key)) {
      this.config[key] = value
    }
  }
  console.log('游戏参数已更新:', newParams)
}
```

##### start(deviceManager, params) - 必需

```javascript
async start(deviceManager, params) {
  this.deviceManager = deviceManager
  this.updateParameters(params)
  
  // 获取UI API
  this.uiAPI = window.gameplayUI
  if (!this.uiAPI) {
    throw new Error('UI API未找到，请确保在正确的环境中运行')
  }
  
  // 初始化游戏状态
  this.state = {
    startTime: Date.now(),
    isGameActive: true,
    // 其他状态...
  }
  
  // 设置设备监听
  this.setupDeviceListeners()
  
  // 启动游戏逻辑
  this.startGameplay()
}
```

##### loop(deviceManager) - 必需

```javascript
async loop(deviceManager) {
  if (!this.state.isGameActive) {
    return false  // 返回false表示游戏结束
  }
  
  // 检查游戏结束条件
  const elapsed = Date.now() - this.state.startTime
  const duration = this.config.duration * 60 * 1000
  
  if (elapsed >= duration) {
    await this.endGame()
    return false
  }
  
  return true  // 返回true表示游戏继续
}
```

## 设备管理器 API

### 设备属性监听

```javascript
// 监听设备属性变化
this.deviceManager.listenDeviceProperty('logical_id', 'property_name', (newValue, deviceData) => {
  // 处理属性变化
})
```

### 设备消息监听

```javascript
// 监听设备消息
this.deviceManager.listenDeviceMessages('logical_id', (deviceData) => {
  // 处理设备消息
})
```

### 设置设备属性

```javascript
// 设置设备属性
await this.deviceManager.setDeviceProperty('logical_id', {
  property1: value1,
  property2: value2
})
```

### 检查设备状态

```javascript
// 获取设备映射信息
const mappedDevice = this.deviceManager.deviceMap.get('logical_id')
if (mappedDevice && mappedDevice.connected) {
  // 设备已连接
}
```

## UI 渲染系统

### 基本UI渲染

```javascript
renderUI() {
  if (!this.uiAPI) return
  
  const html = `
    <style>
      /* CSS样式 */
    </style>
    
    <div class="game-container">
      <!-- HTML内容 -->
    </div>
  `
  
  this.uiAPI.updateGameUI(html)
}
```

### 等待界面渲染

```javascript
renderWaitingUI() {
  if (!this.uiAPI) return
  
  const html = `
    <div class="waiting-container">
      <h2>等待游戏开始...</h2>
      <p>请按设备按键开始游戏</p>
    </div>
  `
  
  this.uiAPI.updateGameUI(html)
}
```

## 日志系统

```javascript
// 记录日志
this.log('日志信息', 'info')    // 信息
this.log('警告信息', 'warning') // 警告
this.log('错误信息', 'error')   // 错误
this.log('成功信息', 'success') // 成功
this.log('调试信息', 'debug')   // 调试
```

## 计时器管理

### 游戏主计时器

```javascript
startGameTimer() {
  const duration = this.config.duration * 60 * 1000
  
  this.gameTimer = setTimeout(async () => {
    await this.endGame()
  }, duration)
}
```

### 状态更新计时器

```javascript
startStatusUpdateTimer() {
  this.statusUpdateTimer = setInterval(() => {
    if (this.state.isGameActive) {
      this.updateGameStatus()
      this.renderUI()
    }
  }, 1000) // 每秒更新
}
```

### 清理计时器

```javascript
cleanupTimers() {
  if (this.gameTimer) {
    clearTimeout(this.gameTimer)
    this.gameTimer = null
  }
  
  if (this.statusUpdateTimer) {
    clearInterval(this.statusUpdateTimer)
    this.statusUpdateTimer = null
  }
}
```

## 游戏生命周期

### 游戏结束处理

```javascript
async endGame() {
  this.log('游戏结束', 'info')
  
  this.state.isGameActive = false
  
  // 停止所有设备
  await this.stopAllDevices()
  
  // 解锁设备
  await this.unlockDevices()
  
  // 清理计时器
  this.cleanupTimers()
  
  // 渲染结束界面
  this.renderEndUI()
}
```

### 游戏停止处理

```javascript
async stop() {
  this.log('游戏被停止', 'warning')
  
  await this.endGame()
}
```

## 手动启动模式支持

如果游戏支持手动启动模式，需要实现以下逻辑：

```javascript
// 在start方法中
if (this.config.manualStart) {
  this.state.isGameActive = false
  this.state.waitingForManualStart = true
  this.setupManualStartListener()
}

// 手动启动监听
setupManualStartListener() {
  this.deviceManager.listenDeviceMessages('trigger_device', (deviceData) => {
    if (deviceData.method === 'action' && deviceData.action === 'key_clicked') {
      this.handleManualStart()
    }
  })
}

// 处理手动启动
handleManualStart() {
  if (!this.state.waitingForManualStart) return
  
  this.state.waitingForManualStart = false
  this.state.isGameActive = true
  this.state.startTime = Date.now()
  
  this.startGameplay()
}

// 在loop方法中添加等待状态检查
async loop(deviceManager) {
  if (this.state.waitingForManualStart) {
    return true  // 继续等待
  }
  
  // 其他游戏逻辑...
}
```

## 最佳实践

### 1. 错误处理

- 所有异步操作都应该使用 try-catch 包装
- 设备操作失败时要有适当的错误处理和日志记录

### 2. 状态管理

- 使用明确的状态变量来控制游戏流程
- 避免在多个地方修改同一个状态

### 3. 资源清理

- 游戏结束时要清理所有计时器
- 停止所有设备操作
- 移除事件监听器

### 4. 用户体验

- 提供清晰的UI反馈
- 重要操作要有确认提示
- 错误信息要用户友好

### 5. 安全考虑

- 对于可能造成伤害的设备操作，要有安全限制
- 提供紧急停止功能
- 参数验证和边界检查

## 示例游戏模板

```javascript
export class ExampleGame {
  constructor() {
    this.title = "示例游戏"
    this.description = "这是一个示例游戏"
    this.version = "1.0.0"
    this.author = "开发者"
    
    this.config = {
      duration: 5,
      intensity: 10
    }
    
    this.state = {
      startTime: 0,
      isGameActive: false
    }
    
    this.uiAPI = null
    this.gameTimer = null
  }
  
  get requiredDevices() {
    return [
      {
        logicalId: "test_device",
        type: "DIANJI",
        name: "测试设备",
        required: true,
        description: "用于测试的设备"
      }
    ]
  }
  
  get parameters() {
    return {
      duration: {
        name: '游戏时长',
        type: 'number',
        min: 1,
        max: 60,
        step: 1,
        default: 5,
        description: '游戏持续时间（分钟）'
      }
    }
  }
  
  updateParameters(newParams) {
    for (const [key, value] of Object.entries(newParams)) {
      if (this.config.hasOwnProperty(key)) {
        this.config[key] = value
      }
    }
  }
  
  async start(deviceManager, params) {
    this.deviceManager = deviceManager
    this.updateParameters(params)
    
    this.uiAPI = window.gameplayUI
    if (!this.uiAPI) {
      throw new Error('UI API未找到')
    }
    
    this.state = {
      startTime: Date.now(),
      isGameActive: true
    }
    
    this.startGameTimer()
    this.renderUI()
  }
  
  async loop(deviceManager) {
    if (!this.state.isGameActive) {
      return false
    }
    
    const elapsed = Date.now() - this.state.startTime
    const duration = this.config.duration * 60 * 1000
    
    if (elapsed >= duration) {
      await this.endGame()
      return false
    }
    
    return true
  }
  
  startGameTimer() {
    const duration = this.config.duration * 60 * 1000
    this.gameTimer = setTimeout(async () => {
      await this.endGame()
    }, duration)
  }
  
  renderUI() {
    if (!this.uiAPI) return
    
    const elapsed = Date.now() - this.state.startTime
    const duration = this.config.duration * 60 * 1000
    const remaining = Math.max(0, duration - elapsed)
    
    const html = `
      <div style="text-align: center; padding: 20px;">
        <h2>示例游戏</h2>
        <p>剩余时间: ${Math.ceil(remaining / 1000)}秒</p>
      </div>
    `
    
    this.uiAPI.updateGameUI(html)
  }
  
  async endGame() {
    this.state.isGameActive = false
    
    if (this.gameTimer) {
      clearTimeout(this.gameTimer)
      this.gameTimer = null
    }
    
    this.log('游戏结束', 'info')
  }
  
  async stop() {
    await this.endGame()
  }
  
  log(message, level = 'info') {
    console.log(`[${level.toUpperCase()}] ${message}`)
  }
}
```

通过遵循这个指南，你可以创建功能完整、稳定可靠的游戏模块。记住要充分测试你的游戏，特别是设备交互和错误处理部分。