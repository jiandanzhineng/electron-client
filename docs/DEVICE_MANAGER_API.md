# DeviceManager API 使用指南

本文档介绍了外部玩法中可用的 DeviceManager 接口，用于与设备进行交互。

## 新增接口

### 1. 设置设备属性

```javascript
// 设置设备属性
const success = await this.deviceManager.setDeviceProperty(logicalId, property, value)

// 示例：设置自动锁的open属性为0（锁定）
const success = await this.deviceManager.setDeviceProperty('auto_lock', 'open', 0)
```

**参数说明：**
- `logicalId`: 逻辑设备ID
- `property`: 属性名称
- `value`: 属性值

**返回值：** `boolean` - 设置是否成功

### 2. 发送MQTT消息到设备

```javascript
// 直接发送MQTT消息到指定设备
const success = await this.deviceManager.sendDeviceMqttMessage(logicalId, message)

// 示例：发送自定义消息
const success = await this.deviceManager.sendDeviceMqttMessage('auto_lock', {
  type: 'custom_command',
  data: { action: 'blink', times: 3 }
})

// 发送到自定义MQTT主题
const success = await this.deviceManager.sendMqttMessage('/custom/topic', {
  message: 'Hello Device'
})
```

**参数说明：**
- `logicalId`: 逻辑设备ID
- `message`: 消息内容（Object或String）
- `topic`: MQTT主题（sendMqttMessage方法）

**返回值：** `boolean` - 发送是否成功

### 3. 读取设备属性

```javascript
// 获取设备属性值
const value = this.deviceManager.getDeviceProperty(logicalId, property)

// 示例：读取自动锁的open属性
const openValue = this.deviceManager.getDeviceProperty('auto_lock', 'open')
if (openValue !== null) {
  console.log(`设备当前状态: ${openValue === 1 ? '解锁' : '锁定'}`)
}
```

**参数说明：**
- `logicalId`: 逻辑设备ID
- `property`: 属性名称

**返回值：** `any|null` - 属性值，如果属性不存在返回null

### 4. 监听设备MQTT消息

```javascript
// 监听设备的所有MQTT消息
const success = this.deviceManager.listenDeviceMessages(logicalId, callback)

// 示例：监听自动锁的所有消息
this.deviceManager.listenDeviceMessages('auto_lock', (data) => {
  console.log('收到设备消息:', data)
  // 处理消息逻辑
})
```

**参数说明：**
- `logicalId`: 逻辑设备ID
- `callback`: 消息回调函数，参数为消息数据

**返回值：** `boolean` - 监听器设置是否成功

### 5. 监听设备属性变化

监听设备特定属性的变化。**重要：只有当属性值真正发生变化时才会触发回调。**

```javascript
// 监听特定属性的变化
const success = this.deviceManager.listenDeviceProperty(logicalId, property, callback)

// 示例：监听自动锁的open属性变化
this.deviceManager.listenDeviceProperty('auto_lock', 'open', (value, data) => {
  console.log(`open属性变化为: ${value}`)
  if (value === 1) {
    console.log('设备被解锁了！')
  } else if (value === 0) {
    console.log('设备被锁定了！')
  }
})
```

**参数说明：**
- `logicalId`: 逻辑设备ID
- `property`: 要监听的属性名称
- `callback`: 属性变化回调函数，参数为新值和完整数据

**返回值：** `boolean` - 监听器设置是否成功

**工作原理：**
- DeviceManager 内部维护设备属性的缓存状态
- 当收到新的设备数据时，会比较属性的新旧值
- 只有当属性值从一个值变化为另一个值时，才会触发回调
- 如果属性值没有变化，不会触发回调

## 完整使用示例

以下是在 `simple-lock-game.js` 中的完整使用示例：

```javascript
async start(deviceManager, params) {
  this.deviceManager = deviceManager
  this.targetDevice = 'auto_lock'
  
  // 1. 设置属性监听器
  this.deviceManager.listenDeviceProperty(this.targetDevice, 'open', (value, data) => {
    this.log(`设备open属性变化: ${value}`, 'info')
    if (value === 1) {
      this.log('检测到设备被解锁！', 'warning')
    }
  })
  
  // 2. 监听所有消息
  this.deviceManager.listenDeviceMessages(this.targetDevice, (data) => {
    this.log(`收到设备消息: ${JSON.stringify(data)}`, 'debug')
  })
  
  // 3. 设置设备属性（锁定）
  const success = await this.deviceManager.setDeviceProperty(
    this.targetDevice,
    'open',
    0
  )
  
  if (success) {
    // 4. 发送自定义MQTT消息
    await this.deviceManager.sendDeviceMqttMessage(this.targetDevice, {
      type: 'game_start',
      duration: this.duration,
      timestamp: Date.now()
    })
  }
}

async loop(deviceManager) {
  // 5. 读取设备属性
  const openValue = this.deviceManager.getDeviceProperty(this.targetDevice, 'open')
  if (openValue !== null) {
    this.log(`当前设备open属性值: ${openValue}`, 'debug')
  }
}

async end(deviceManager) {
  // 6. 解锁设备
  await this.deviceManager.setDeviceProperty(this.targetDevice, 'open', 1)
  
  // 7. 发送游戏结束消息
  await this.deviceManager.sendDeviceMqttMessage(this.targetDevice, {
    type: 'game_end',
    totalTime: Date.now() - this.startTime,
    timestamp: Date.now()
  })
}
```

## 注意事项

1. **设备映射**: 确保在游戏开始前，目标设备已正确映射到逻辑ID
2. **错误处理**: 所有异步方法都应该进行适当的错误处理
3. **资源清理**: 监听器会在游戏结束时自动清理
4. **MQTT连接**: 确保MQTT服务已连接，否则消息发送会失败
5. **属性存在性**: 读取属性前建议先检查返回值是否为null
6. **消息格式**: 设备上报的消息必须是JSON格式，且包含`method: 'report'`字段
7. **主题格式**: 设备上报消息的主题必须是`/dpub/{deviceId}`格式才能被监听器接收

## 设备消息监听原理

设备消息监听的工作流程：

1. **设备上报**: 设备通过MQTT发送消息到`/dpub/{deviceId}`主题
2. **消息格式**: 消息必须是JSON格式，包含`method: 'report'`和其他设备属性
3. **消息过滤**: GameplayService只处理符合格式的上报消息
4. **数据传递**: 过滤后的设备数据传递给DeviceManager的handleSensorData方法
5. **回调触发**: 根据设备映射关系，触发对应的监听回调函数

### 设备上报消息示例

```json
{
  "method": "report",
  "open": 1,
  "battery": 85,
  "temperature": 25.6,
  "device_type": "ZIDONGSUO"
}
```

### 故障排除

如果监听器没有收到设备消息，请检查：

1. **MQTT连接状态**: 确保MQTT服务已连接
2. **设备上报格式**: 确保设备发送的消息包含`method: 'report'`
3. **主题格式**: 确保设备发送到`/dpub/{deviceId}`主题
4. **设备映射**: 确保设备已正确映射到逻辑ID
5. **JSON格式**: 确保消息内容是有效的JSON格式

## 设备属性说明

### 自动锁设备 (ZIDONGSUO)
- `open`: 锁定状态，0=锁定，1=解锁
- 其他属性根据具体设备而定

### MQTT主题格式
- 设备接收主题: `/drecv/{deviceId}`
- 设备发送主题: `/dsend/{deviceId}`