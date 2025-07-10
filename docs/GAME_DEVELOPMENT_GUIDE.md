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

##### end(deviceManager) - 必需

```javascript
async end(deviceManager) {
  // 游戏结束时的清理工作
  await this.endGame()
}
```

**注意：** `end` 方法是供 gameplayService 调用的标准接口，用于外部停止游戏时的清理工作。该方法通常调用内部的 `endGame` 方法来执行实际的结束逻辑。

**⚠️ 重要提醒：endGame过程中不要进行游戏初始化，否则会在游戏结束时重新开始游戏。**

## 设备管理器 API

设备管理器 (DeviceManager) 是游戏与硬件设备交互的核心接口，提供了完整的设备控制和监听功能。

### 设备查询方法

#### getDevices()
获取所有可用设备列表

```javascript
// 获取所有设备
const devices = this.deviceManager.getDevices()
console.log('可用设备:', devices)
```

#### findDeviceByLogicalId(logicalId)
根据逻辑ID查找设备

```javascript
// 查找特定设备
const device = this.deviceManager.findDeviceByLogicalId('my_device')
if (device) {
  console.log('找到设备:', device.name)
}
```

#### findDevicesByType(deviceType)
根据设备类型查找设备

```javascript
// 查找所有电击设备
const shockDevices = this.deviceManager.findDevicesByType('DIANJI')
console.log('电击设备数量:', shockDevices.length)
```

#### isDeviceOnline(deviceId)
检查设备是否在线

```javascript
// 检查设备在线状态
if (this.deviceManager.isDeviceOnline('device_id')) {
  console.log('设备在线')
} else {
  console.log('设备离线')
}
```

### 设备属性操作

#### setDeviceProperty(logicalId, properties)
设置设备属性（异步方法）

```javascript
// 设置单个属性
await this.deviceManager.setDeviceProperty('shock_device', {
  intensity: 50
})

// 设置多个属性
await this.deviceManager.setDeviceProperty('lock_device', {
  locked: true,
  timeout: 300
})

// 检查设置结果
const success = await this.deviceManager.setDeviceProperty('device_id', {
  property: value
})
if (success) {
  console.log('属性设置成功')
} else {
  console.log('属性设置失败')
}
```

#### getDeviceProperty(logicalId, property)
获取设备属性值

```javascript
// 获取设备属性
const intensity = this.deviceManager.getDeviceProperty('shock_device', 'intensity')
const isLocked = this.deviceManager.getDeviceProperty('lock_device', 'locked')

if (intensity !== null) {
  console.log('当前强度:', intensity)
}
```

### 设备消息监听

#### listenDeviceMessages(logicalId, callback)
监听设备的所有MQTT消息

```javascript
// 监听设备消息
this.deviceManager.listenDeviceMessages('button_device', (deviceData) => {
  console.log('收到设备消息:', deviceData)
  
  // 处理按键事件
  if (deviceData.method === 'action' && deviceData.action === 'key_clicked') {
    this.handleButtonClick()
  }
  
  // 处理传感器数据
  if (deviceData.method === 'report') {
    this.handleSensorData(deviceData)
  }
})
```

#### listenDeviceProperty(logicalId, property, callback)
监听设备特定属性的变化

```javascript
// 监听距离传感器
this.deviceManager.listenDeviceProperty('distance_sensor', 'distance', (newValue, deviceData) => {
  console.log('距离变化:', newValue)
  
  if (newValue < 10) {
    this.handleCloseProximity()
  }
})

// 监听按钮状态
this.deviceManager.listenDeviceProperty('button_device', 'button1', (newValue, deviceData) => {
  if (newValue === 1) {
    console.log('按钮被按下')
    this.handleButtonPress()
  } else {
    console.log('按钮被释放')
    this.handleButtonRelease()
  }
})
```

### 直接MQTT通信

#### sendDeviceMqttMessage(logicalId, message)
直接向设备发送MQTT消息

```javascript
// 发送自定义命令
await this.deviceManager.sendDeviceMqttMessage('custom_device', {
  method: 'custom_action',
  command: 'start_sequence',
  parameters: {
    duration: 5000,
    intensity: 75
  }
})

// 发送控制指令
await this.deviceManager.sendDeviceMqttMessage('lock_device', {
  method: 'control',
  action: 'unlock'
})
```

#### sendMqttMessage(topic, message)
向指定MQTT主题发送消息

```javascript
// 发送到特定主题
await this.deviceManager.sendMqttMessage('/custom/topic', {
  type: 'broadcast',
  message: 'Game started'
})
```

### 初始化和清理方法

#### initDeviceStore()
初始化设备存储（内部方法，通常自动调用）

```javascript
// 手动初始化设备存储（通常不需要）
const store = this.deviceManager.initDeviceStore()
```

#### cleanup()
清理设备管理器资源

```javascript
// 清理所有监听器和缓存
this.deviceManager.cleanup()

// 通常在游戏结束时自动调用
// 手动清理示例
if (this.gameEnded) {
  this.deviceManager.cleanup()
}
```

### 高级功能

#### 设备属性缓存
设备管理器会自动缓存设备属性，确保属性监听的准确性：

```javascript
// 属性会被自动缓存，无需手动管理
// 获取缓存的属性值
const cachedValue = this.deviceManager.getDeviceProperty('device_id', 'property')
```

#### 消息处理统计
设备管理器提供消息处理性能统计：

```javascript
// 查看消息统计（通过日志）
// 统计信息包括：接收消息数、处理消息数、平均处理时间等
```

### 错误处理和调试

#### 日志记录
所有设备操作都会自动记录日志：

```javascript
// 日志会自动发送到游戏日志系统
// 日志级别：info, success, warning, error, debug

// 手动发送日志（如果需要）
this.deviceManager.sendLog('自定义日志消息', 'info')
```

#### 常见错误处理

```javascript
// 设备未找到
const device = this.deviceManager.findDeviceByLogicalId('unknown_device')
if (!device) {
  this.log('设备未找到，请检查设备映射', 'error')
  return
}

// 设备离线
if (!this.deviceManager.isDeviceOnline(device.id)) {
  this.log('设备离线，无法执行操作', 'warning')
  return
}

// 属性设置失败
const success = await this.deviceManager.setDeviceProperty('device_id', { prop: value })
if (!success) {
  this.log('设备属性设置失败', 'error')
  // 执行错误恢复逻辑
}
```

### 最佳实践

#### 1. 设备状态检查
在执行设备操作前，始终检查设备状态：

```javascript
async performDeviceAction(logicalId, action) {
  // 检查设备是否存在
  const device = this.deviceManager.deviceMap.get(logicalId)
  if (!device) {
    this.log(`设备未映射: ${logicalId}`, 'error')
    return false
  }
  
  // 执行操作
  return await this.deviceManager.setDeviceProperty(logicalId, action)
}
```

#### 2. 批量设备操作

```javascript
async initializeAllDevices() {
  const initPromises = []
  
  for (const [logicalId, device] of this.deviceManager.deviceMap) {
    if (device.connected) {
      const promise = this.deviceManager.setDeviceProperty(logicalId, {
        game_mode: true,
        initialized: true
      })
      initPromises.push(promise)
    }
  }
  
  const results = await Promise.allSettled(initPromises)
  const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length
  
  this.log(`设备初始化完成: ${successCount}/${results.length}`, 'info')
}
```

#### 3. 属性监听管理

```javascript
setupDeviceListeners() {
  // 为每个设备设置必要的监听器
  for (const [logicalId, device] of this.deviceManager.deviceMap) {
    // 监听设备连接状态
    this.deviceManager.listenDeviceProperty(logicalId, 'connected', (connected) => {
      if (!connected) {
        this.handleDeviceDisconnected(logicalId)
      }
    })
    
    // 监听设备特定功能
    if (device.type === 'BUTTON') {
      this.deviceManager.listenDeviceMessages(logicalId, (data) => {
        this.handleButtonDevice(logicalId, data)
      })
    }
  }
}

cleanupDeviceListeners() {
  // 游戏结束时清理监听器
  this.deviceManager.cleanup()
}
```

### 设备映射访问

#### deviceMap
访问当前游戏的设备映射

```javascript
// 获取映射的设备
const mappedDevice = this.deviceManager.deviceMap.get('logical_id')
if (mappedDevice) {
  console.log('设备名称:', mappedDevice.name)
  console.log('设备ID:', mappedDevice.id)
  console.log('设备类型:', mappedDevice.type)
  console.log('连接状态:', mappedDevice.connected)
}

// 遍历所有映射的设备
for (const [logicalId, device] of this.deviceManager.deviceMap) {
  console.log(`${logicalId} -> ${device.name} (${device.connected ? '在线' : '离线'})`)
}
```

### 实用示例

#### 设备状态检查和初始化

```javascript
async setupDevices() {
  // 检查所有必需设备
  for (const deviceReq of this.requiredDevices) {
    const device = this.deviceManager.deviceMap.get(deviceReq.logicalId)
    
    if (!device) {
      this.log(`设备未映射: ${deviceReq.name}`, 'error')
      return false
    }
    
    if (!device.connected) {
      this.log(`设备离线: ${device.name}`, 'error')
      return false
    }
    
    // 初始化设备状态
    await this.deviceManager.setDeviceProperty(deviceReq.logicalId, {
      initialized: true,
      game_mode: true
    })
  }
  
  return true
}
```

#### 复合设备控制

```javascript
async executeShockSequence(intensity, duration) {
  // 设置电击强度
  await this.deviceManager.setDeviceProperty('shock_device', {
    intensity: intensity
  })
  
  // 开始电击
  await this.deviceManager.setDeviceProperty('shock_device', {
    active: true
  })
  
  // 定时停止
  setTimeout(async () => {
    await this.deviceManager.setDeviceProperty('shock_device', {
      active: false
    })
  }, duration)
}
```

#### 传感器数据处理

```javascript
setupSensorMonitoring() {
  // 监听距离传感器
  this.deviceManager.listenDeviceProperty('distance_sensor', 'distance', (distance) => {
    this.state.currentDistance = distance
    
    if (distance < this.config.triggerDistance) {
      this.handleProximityTrigger()
    }
  })
  
  // 监听按钮设备
  this.deviceManager.listenDeviceMessages('button_device', (data) => {
    if (data.method === 'action') {
      this.handleButtonAction(data.action, data.button)
    }
  })
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

## 外部文件路径配置

### 动态路径解析

当游戏需要加载外部文件（如题目文件、配置文件等）时，可以使用动态路径标记来确保在开发和生产环境中都能正确找到文件。

#### 路径标记

系统支持以下路径标记：

- `<OUTTER_GAME>` - 指向打包后的 `outter-game` 文件夹
  - 开发环境：`项目根目录/outter-game`
  - 生产环境：`应用资源目录/outter-game`

#### 使用示例

在游戏参数配置中使用动态路径：

```javascript
get parameters() {
  return {
    questionsFile: {
      name: '题目文件',
      type: 'string',
      default: '<OUTTER_GAME>/QA-game/女仆行为规范考核题库.json',
      description: '题目文件路径，<OUTTER_GAME> 指向打包后的 outter-game 文件夹'
    }
  }
}
```

在构造函数中初始化配置：

```javascript
constructor() {
  this.config = {
    questionsFile: '<OUTTER_GAME>/QA-game/女仆行为规范考核题库.json'
  }
}
```

#### 文件加载

使用 `window.gameplayService?.readExternalFile?.(filePath)` 来加载外部文件，系统会自动解析路径标记：

```javascript
async loadQuestions() {
  try {
    const filePath = this.config.questionsFile
    this.log(`正在加载题目文件: ${filePath}`, 'info')
    
    const content = await window.gameplayService?.readExternalFile?.(filePath)
    if (!content) {
      throw new Error('无法读取文件内容')
    }
    
    const questions = JSON.parse(content)
    this.log(`成功加载 ${questions.length} 道题目`, 'success')
    return questions
  } catch (error) {
    this.log(`加载题目失败: ${error.message}`, 'error')
    throw error
  }
}
```

#### 注意事项

1. **路径标记解析**：路径标记的解析由主程序的 `gameplayService` 处理，游戏代码中不需要手动解析
2. **环境兼容性**：使用路径标记可以确保游戏在开发和生产环境中都能正确运行
3. **错误处理**：文件加载失败时要有适当的错误处理和用户提示
4. **文件格式**：确保外部文件格式正确，特别是 JSON 文件的语法

#### 支持的文件类型

- JSON 配置文件
- 文本文件
- 其他可以通过文本方式读取的文件

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
  
  async end(deviceManager) {
    await this.endGame()
  }
  
  log(message, level = 'info') {
    console.log(`[${level.toUpperCase()}] ${message}`)
  }
}
```

通过遵循这个指南，你可以创建功能完整、稳定可靠的游戏模块。记住要充分测试你的游戏，特别是设备交互和错误处理部分。