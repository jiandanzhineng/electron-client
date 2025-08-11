/**
 * 模拟设备管理器
 * 用于测试环境中模拟真实设备的行为
 */

class MockDeviceManager {
  constructor() {
    this.devices = new Map()
    this.properties = new Map()
    this.messageListeners = new Map()
    this.propertyListeners = new Map()
    this.mqttMessages = []
    this.isConnected = true
  }

  /**
   * 添加模拟设备
   * @param {string} logicalId - 逻辑设备ID
   * @param {string} type - 设备类型
   * @param {Object} initialProperties - 初始属性
   */
  addMockDevice(logicalId, type, initialProperties = {}) {
    this.devices.set(logicalId, {
      type,
      connected: true,
      lastMessage: null
    })
    
    this.properties.set(logicalId, { ...initialProperties })
    this.messageListeners.set(logicalId, [])
    this.propertyListeners.set(logicalId, new Map())
    
    console.log(`📱 添加模拟设备: ${logicalId} (${type})`, initialProperties)
  }

  /**
   * 移除模拟设备
   */
  removeMockDevice(logicalId) {
    this.devices.delete(logicalId)
    this.properties.delete(logicalId)
    this.messageListeners.delete(logicalId)
    this.propertyListeners.delete(logicalId)
    console.log(`🗑️  移除模拟设备: ${logicalId}`)
  }

  /**
   * 设置设备连接状态
   */
  setDeviceConnected(logicalId, connected) {
    const device = this.devices.get(logicalId)
    if (device) {
      device.connected = connected
      console.log(`🔌 设备 ${logicalId} ${connected ? '已连接' : '已断开'}`)
    }
  }

  /**
   * 模拟设备上报消息
   * @param {string} logicalId - 设备ID
   * @param {Object} message - 消息内容
   */
  simulateDeviceMessage(logicalId, message) {
    const device = this.devices.get(logicalId)
    if (!device || !device.connected) {
      console.warn(`⚠️  设备 ${logicalId} 未连接，无法发送消息`)
      return false
    }

    // 更新设备属性
    if (message.method === 'report' || !message.method) {
      const deviceProps = this.properties.get(logicalId) || {}
      const oldProps = { ...deviceProps }
      
      // 更新属性
      Object.assign(deviceProps, message)
      this.properties.set(logicalId, deviceProps)
      
      // 触发属性变化监听器
      const propListeners = this.propertyListeners.get(logicalId)
      if (propListeners) {
        for (const [property, callbacks] of propListeners) {
          const oldValue = oldProps[property]
          const newValue = deviceProps[property]
          
          // 只有当值真正变化时才触发回调
          if (oldValue !== newValue && newValue !== undefined) {
            callbacks.forEach(callback => {
              try {
                callback(newValue, deviceProps)
              } catch (error) {
                console.error(`属性监听器错误:`, error)
              }
            })
          }
        }
      }
    }

    // 触发消息监听器
    const listeners = this.messageListeners.get(logicalId) || []
    listeners.forEach(callback => {
      try {
        callback(message)
      } catch (error) {
        console.error(`消息监听器错误:`, error)
      }
    })

    device.lastMessage = message
    console.log(`📨 设备 ${logicalId} 上报消息:`, message)
    return true
  }

  /**
   * 模拟QTZ设备的阈值触发事件
   */
  simulateQTZEvent(logicalId, eventType, distance = null) {
    const validEvents = ['low', 'high']
    if (!validEvents.includes(eventType)) {
      throw new Error(`无效的QTZ事件类型: ${eventType}`)
    }

    const message = {
      method: eventType,
      timestamp: Date.now()
    }

    if (distance !== null) {
      message.distance = distance
    }

    return this.simulateDeviceMessage(logicalId, message)
  }

  /**
   * 模拟距离变化（用于UI显示）
   */
  simulateDistanceChange(logicalId, distance) {
    return this.simulateDeviceMessage(logicalId, {
      method: 'report',
      distance: distance,
      timestamp: Date.now()
    })
  }

  // ===== 实现DeviceManager接口 =====

  /**
   * 设置设备属性
   */
  async setDeviceProperty(logicalId, properties) {
    const device = this.devices.get(logicalId)
    if (!device || !device.connected) {
      console.warn(`⚠️  设备 ${logicalId} 未连接`)
      return false
    }

    const deviceProps = this.properties.get(logicalId) || {}
    Object.assign(deviceProps, properties)
    this.properties.set(logicalId, deviceProps)
    
    console.log(`⚙️  设置设备 ${logicalId} 属性:`, properties)
    
    // 模拟设备响应
    setTimeout(() => {
      this.simulateDeviceMessage(logicalId, {
        method: 'report',
        ...properties,
        timestamp: Date.now()
      })
    }, 10) // 模拟网络延迟
    
    return true
  }

  /**
   * 发送MQTT消息到设备
   */
  async sendDeviceMqttMessage(logicalId, message) {
    const device = this.devices.get(logicalId)
    if (!device || !device.connected) {
      console.warn(`⚠️  设备 ${logicalId} 未连接`)
      return false
    }

    this.mqttMessages.push({
      logicalId,
      message,
      timestamp: Date.now()
    })
    
    console.log(`📤 发送MQTT消息到 ${logicalId}:`, message)
    return true
  }

  /**
   * 发送MQTT消息到自定义主题
   */
  async sendMqttMessage(topic, message) {
    if (!this.isConnected) {
      console.warn(`⚠️  MQTT未连接`)
      return false
    }

    this.mqttMessages.push({
      topic,
      message,
      timestamp: Date.now()
    })
    
    console.log(`📤 发送MQTT消息到主题 ${topic}:`, message)
    return true
  }

  /**
   * 获取设备属性
   */
  getDeviceProperty(logicalId, property) {
    const deviceProps = this.properties.get(logicalId)
    if (!deviceProps) {
      return null
    }
    
    const value = deviceProps[property]
    return value !== undefined ? value : null
  }

  /**
   * 监听设备消息
   */
  listenDeviceMessages(logicalId, callback) {
    if (!this.messageListeners.has(logicalId)) {
      this.messageListeners.set(logicalId, [])
    }
    
    this.messageListeners.get(logicalId).push(callback)
    console.log(`👂 添加设备 ${logicalId} 消息监听器`)
    return true
  }

  /**
   * 监听设备属性变化
   */
  listenDeviceProperty(logicalId, property, callback) {
    if (!this.propertyListeners.has(logicalId)) {
      this.propertyListeners.set(logicalId, new Map())
    }
    
    const propListeners = this.propertyListeners.get(logicalId)
    if (!propListeners.has(property)) {
      propListeners.set(property, [])
    }
    
    propListeners.get(property).push(callback)
    console.log(`👂 添加设备 ${logicalId}.${property} 属性监听器`)
    return true
  }

  // ===== 测试辅助方法 =====

  /**
   * 获取所有MQTT消息历史
   */
  getMqttMessageHistory() {
    return [...this.mqttMessages]
  }

  /**
   * 清空MQTT消息历史
   */
  clearMqttMessageHistory() {
    this.mqttMessages = []
  }

  /**
   * 获取设备最后一条消息
   */
  getLastDeviceMessage(logicalId) {
    const device = this.devices.get(logicalId)
    return device ? device.lastMessage : null
  }

  /**
   * 获取设备当前所有属性
   */
  getAllDeviceProperties(logicalId) {
    return this.properties.get(logicalId) || {}
  }

  /**
   * 重置所有设备状态
   */
  reset() {
    this.devices.clear()
    this.properties.clear()
    this.messageListeners.clear()
    this.propertyListeners.clear()
    this.mqttMessages = []
    console.log(`🔄 模拟设备管理器已重置`)
  }

  /**
   * 设置MQTT连接状态
   */
  setMqttConnected(connected) {
    this.isConnected = connected
    console.log(`🌐 MQTT ${connected ? '已连接' : '已断开'}`)
  }

  /**
   * 批量模拟俯卧撑动作
   * @param {string} logicalId - QTZ设备ID
   * @param {number} count - 俯卧撑次数
   * @param {number} interval - 动作间隔(ms)
   */
  async simulatePushupSequence(logicalId, count, interval = 2000) {
    console.log(`🏃 开始模拟 ${count} 个俯卧撑动作，间隔 ${interval}ms`)
    
    for (let i = 0; i < count; i++) {
      // 下降阶段
      this.simulateQTZEvent(logicalId, 'low', 10)
      await new Promise(resolve => setTimeout(resolve, interval / 2))
      
      // 上升阶段
      this.simulateQTZEvent(logicalId, 'high', 40)
      await new Promise(resolve => setTimeout(resolve, interval / 2))
      
      console.log(`💪 完成第 ${i + 1} 个俯卧撑`)
    }
  }
}

// 导出模拟设备管理器
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MockDeviceManager
}
if (typeof window !== 'undefined') {
  window.MockDeviceManager = MockDeviceManager
}