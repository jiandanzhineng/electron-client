import { defineStore } from 'pinia'

export const useMonitoringStore = defineStore('monitoring', {
  state: () => ({
    // 监控数据 Map<deviceId, Map<property, Array<{value, timestamp}>>>
    monitoringData: new Map(),
    // 活跃的监控会话 Map<sessionId, {deviceId, property, maxPoints}>
    activeSessions: new Map(),
    // 最大数据点数量
    maxDataPoints: 100
  }),

  getters: {
    // 获取设备属性的监控数据
    getMonitoringData: (state) => (deviceId, property) => {
      const deviceData = state.monitoringData.get(deviceId)
      return deviceData ? deviceData.get(property) || [] : []
    },

    // 获取活跃监控会话
    getActiveSessions: (state) => {
      return Array.from(state.activeSessions.values())
    }
  },

  actions: {
    // 添加监控数据点
    addDataPoint(deviceId, property, value, timestamp = Date.now()) {
      if (!this.monitoringData.has(deviceId)) {
        this.monitoringData.set(deviceId, new Map())
      }
      
      const deviceData = this.monitoringData.get(deviceId)
      if (!deviceData.has(property)) {
        deviceData.set(property, [])
      }
      
      const propertyData = deviceData.get(property)
      propertyData.push({ value, timestamp })
      
      // 保持数据点数量在限制内
      if (propertyData.length > this.maxDataPoints) {
        propertyData.shift()
      }
    },

    // 开始监控会话
    startMonitoring(deviceId, property) {
      const sessionId = `${deviceId}-${property}`
      this.activeSessions.set(sessionId, {
        deviceId,
        property,
        startTime: Date.now()
      })
      return sessionId
    },

    // 停止监控会话
    stopMonitoring(sessionId) {
      this.activeSessions.delete(sessionId)
    },

    // 清除设备的监控数据
    clearDeviceData(deviceId) {
      this.monitoringData.delete(deviceId)
      // 清除相关的活跃会话
      for (const [sessionId, session] of this.activeSessions) {
        if (session.deviceId === deviceId) {
          this.activeSessions.delete(sessionId)
        }
      }
    },

    // 处理MQTT消息
    handleMqttMessage(message) {
      try {
        const data = JSON.parse(message.payload)
        const deviceId = message.topic.split('/').pop()
        
        // 检查是否有该设备的活跃监控会话
        const hasActiveSession = Array.from(this.activeSessions.values())
          .some(session => session.deviceId === deviceId)
        
        if (!hasActiveSession) {
          // 没有活跃监控会话，不处理消息
          return
        }
        
        console.log('监控Store处理MQTT消息:', { deviceId, data })
        
        // 只处理 report 和 update 方法的消息
        if (data.method === 'report' || data.method === 'update') {
          // 为每个属性添加数据点（排除method和其他系统字段）
          Object.keys(data).forEach(property => {
            if (property !== 'method' && property !== 'device_type' && 
                property !== 'report_delay_ms' && property !== 'sleep_time') {
              // 检查是否有该属性的活跃监控会话
              const sessionId = `${deviceId}-${property}`
              if (this.activeSessions.has(sessionId)) {
                console.log(`添加监控数据点: ${deviceId}.${property} = ${data[property]}`)
                this.addDataPoint(deviceId, property, data[property])
              }
            }
          })
        }
      } catch (error) {
        console.error('处理MQTT监控消息失败:', error)
      }
    }
  }
})