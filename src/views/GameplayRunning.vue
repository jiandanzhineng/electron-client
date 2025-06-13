<template>
  <div class="gameplay-running">
    <el-card class="header-card">
      <template #header>
        <div class="card-header">
          <h1>{{ gameplayInfo.title || '玩法运行中' }}</h1>
          <div class="status-indicator">
            <el-tag :type="statusType" size="large">
              {{ statusText }} - {{ formatTime(elapsedTime) }}
            </el-tag>
          </div>
        </div>
      </template>
      <div class="description-section">
        <p class="description">{{ gameplayInfo.description }}</p>
        
        <!-- 参数折叠面板 -->
        <el-collapse v-if="currentParameters && Object.keys(currentParameters).length > 0" class="params-collapse">
          <el-collapse-item title="玩法参数" name="params">
            <div class="parameters">
              <div v-for="(value, key) in currentParameters" :key="key" class="param-item">
                <span class="param-name">{{ key }}:</span>
                <span class="param-value">{{ value }}</span>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
        
        <!-- 设备状态折叠面板 -->
        <el-collapse v-if="deviceMapping && Object.keys(deviceMapping).length > 0" class="device-collapse">
          <el-collapse-item title="设备状态" name="devices">
            <div class="device-list">
              <div v-for="(deviceId, logicalId) in deviceMapping" :key="logicalId" class="device-item">
                <div class="device-info">
                  <span class="device-name">{{ getDeviceName(logicalId) }}</span>
                  <el-tag :type="getDeviceStatus(deviceId) === 'online' ? 'success' : 'danger'" size="small">
                    {{ getDeviceStatus(deviceId) === 'online' ? '在线' : '离线' }}
                  </el-tag>
                </div>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </el-card>

    <!-- 运行日志 - 占据整行 -->
    <el-card class="log-card-full">
      <template #header>
        <div class="log-header">
          <h3>运行日志</h3>
          <div class="log-controls">
            <el-button @click="clearLogs" size="small" type="warning">
              清空日志
            </el-button>
            <el-button @click="toggleAutoScroll" size="small" :type="autoScroll ? 'primary' : 'default'">
              {{ autoScroll ? '关闭' : '开启' }}自动滚动
            </el-button>
          </div>
        </div>
      </template>
      <div class="log-container" ref="logContainer">
        <div v-for="(log, index) in logs" :key="index" class="log-entry" :class="log.level">
          <span class="log-time">{{ formatLogTime(log.timestamp) }}</span>
          <span class="log-level">[{{ log.level.toUpperCase() }}]</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
        <div v-if="logs.length === 0" class="no-logs">
          <el-empty description="暂无日志" />
        </div>
      </div>
    </el-card>

    <!-- 控制按钮 -->
    <div class="control-actions">
      <el-button @click="pauseGameplay" v-if="status === 'running'" type="warning" size="large">
        暂停玩法
      </el-button>
      <el-button @click="resumeGameplay" v-if="status === 'paused'" type="primary" size="large">
        继续玩法
      </el-button>
      <el-button @click="stopGameplay" type="danger" size="large">
        停止玩法
      </el-button>
      <el-button @click="goBack" size="large">
        返回列表
      </el-button>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import { useDeviceStore } from '@/stores/deviceStore'
import { gameplayService } from '@/services/gameplayService'

export default {
  name: 'GameplayRunning',
  setup() {
    const router = useRouter()
    const gameStore = useGameStore()
    const deviceStore = useDeviceStore()
    
    const gameplayInfo = ref({})
    const deviceMapping = ref({})
    const currentParameters = ref({})
    const status = ref('running')
    const elapsedTime = ref(0)
    const logs = ref([])
    const autoScroll = ref(true)
    const logContainer = ref(null)
    
    let startTime = Date.now()
    let timer = null
    
    const statusType = computed(() => {
      switch (status.value) {
        case 'running': return 'success'
        case 'paused': return 'warning'
        case 'stopped': return 'danger'
        default: return 'info'
      }
    })
    
    const statusText = computed(() => {
      switch (status.value) {
        case 'running': return '运行中'
        case 'paused': return '已暂停'
        case 'stopped': return '已停止'
        default: return '未知状态'
      }
    })
    
    const formatTime = (ms) => {
      const seconds = Math.floor(ms / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)
      
      if (hours > 0) {
        return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
      }
      return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`
    }
    
    const formatLogTime = (timestamp) => {
      const date = new Date(timestamp)
      return date.toLocaleTimeString()
    }
    
    const addLog = (message, level = 'info') => {
      logs.value.push({
        timestamp: Date.now(),
        level,
        message
      })
      
      // 限制日志数量
      if (logs.value.length > 1000) {
        logs.value.splice(0, 100)
      }
      
      // 自动滚动到底部
      if (autoScroll.value) {
        nextTick(() => {
          if (logContainer.value) {
            logContainer.value.scrollTop = logContainer.value.scrollHeight
          }
        })
      }
    }
    
    const clearLogs = () => {
      logs.value = []
      addLog('日志已清空', 'info')
    }
    
    const toggleAutoScroll = () => {
      autoScroll.value = !autoScroll.value
      addLog(`自动滚动已${autoScroll.value ? '开启' : '关闭'}`, 'info')
    }
    
    const getDeviceName = (logicalId) => {
      const requiredDevice = gameplayInfo.value.requiredDevices?.find(d => 
        (d.id || d.logicalId) === logicalId
      )
      return requiredDevice?.name || logicalId
    }
    
    const getDeviceStatus = (deviceId) => {
      const device = deviceStore.devices.find(d => d.id === deviceId)
      return device?.connected ? 'online' : 'offline'
    }
    
    const updateElapsedTime = () => {
      if (status.value === 'running') {
        elapsedTime.value = Date.now() - startTime
      }
    }
    
    const pauseGameplay = () => {
      try {
        gameplayService.pauseGameplay()
        status.value = 'paused'
      } catch (error) {
        addLog(`暂停玩法失败: ${error.message}`, 'error')
      }
    }
    
    const resumeGameplay = () => {
      try {
        gameplayService.resumeGameplay()
        status.value = 'running'
      } catch (error) {
        addLog(`恢复玩法失败: ${error.message}`, 'error')
      }
    }
    
    const stopGameplay = async () => {
      try {
        await gameplayService.stopGameplay()
        status.value = 'stopped'
        if (timer) {
          clearInterval(timer)
          timer = null
        }
        // 清除会话存储
        sessionStorage.removeItem('runningGameplay')
        // 延迟跳转，让用户看到停止日志
        setTimeout(() => {
          router.push('/games')
        }, 2000)
      } catch (error) {
        addLog(`停止玩法失败: ${error.message}`, 'error')
      }
    }
    
    const goBack = () => {
      if (timer) {
        clearInterval(timer)
      }
      router.push('/games')
    }
    
    onMounted(async () => {
      // 获取玩法信息
      const runningGameplay = sessionStorage.getItem('runningGameplay')
      if (runningGameplay) {
        const data = JSON.parse(runningGameplay)
        gameplayInfo.value = data.config
        deviceMapping.value = data.deviceMapping
        currentParameters.value = data.parameters
      } else {
        addLog('未找到运行中的玩法信息', 'error')
        router.push('/games')
        return
      }
      
      // 设置 gameplayService 的日志回调
      gameplayService.setLogCallback((logData) => {
        if (typeof logData === 'object' && logData.message) {
          // 新格式：对象形式的日志数据
          addLog(logData.message, logData.level || 'info')
        } else {
          // 兼容旧格式：直接传递消息和级别
          addLog(logData, arguments[1] || 'info')
        }
      })
      
      // 初始化设备列表
      deviceStore.initDeviceList()
      
      // 启动计时器
      timer = setInterval(updateElapsedTime, 1000)
      
      // 添加初始日志
      addLog(`玩法运行界面已加载`, 'info')
      
      // 启动外部玩法
      try {
        addLog('正在启动外部玩法...', 'info')
        
        // 从sessionStorage获取玩法文件路径（这里需要根据实际情况调整）
        const gameplayFilePath = 'e:\\develop\\electron-client\\outter-game\\simple-lock-game.js'
        
        // 加载外部玩法
        await gameplayService.loadGameplayFromJS(gameplayFilePath)
        addLog('外部玩法加载成功', 'success')
        
        // 启动玩法
        const data = JSON.parse(runningGameplay)
        await gameplayService.startGameplay(
          data.config,
          data.deviceMapping,
          data.parameters
        )
        addLog('外部玩法启动成功', 'success')
        
      } catch (error) {
        addLog(`启动外部玩法失败: ${error.message}`, 'error')
        console.error('启动外部玩法失败:', error)
      }
    })
    
    onUnmounted(() => {
      if (timer) {
        clearInterval(timer)
      }
      // 清理日志回调
      gameplayService.setLogCallback(null)
    })
    
    return {
      gameplayInfo,
      deviceMapping,
      currentParameters,
      status,
      statusType,
      statusText,
      elapsedTime,
      logs,
      autoScroll,
      logContainer,
      formatTime,
      formatLogTime,
      addLog,
      clearLogs,
      toggleAutoScroll,
      getDeviceName,
      getDeviceStatus,
      pauseGameplay,
      resumeGameplay,
      stopGameplay,
      goBack
    }
  }
}
</script>

<style scoped>
.gameplay-running {
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

.header-card {
  margin-bottom: 24px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: none;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border-radius: 16px;
  transition: all 0.3s ease;
}

.header-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h1 {
  margin: 0;
  background: linear-gradient(45deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-size: 28px;
  font-weight: 700;
}

.status-indicator {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.description-section {
  margin-top: 15px;
}

.description {
  margin: 0 0 15px 0;
  color: #64748b;
  font-size: 16px;
  line-height: 1.6;
}

.params-collapse, .device-collapse {
  margin-bottom: 15px;
}

.params-collapse:last-child, .device-collapse:last-child {
  margin-bottom: 0;
}

.content-area {
  margin-bottom: 24px;
}

.info-card,
.device-card {
  margin-bottom: 20px;
  height: fit-content;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: none;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.info-card:hover,
.device-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  transition: all 0.2s ease;
}

.info-item:hover {
  background: rgba(102, 126, 234, 0.05);
  border-radius: 8px;
  padding-left: 8px;
  padding-right: 8px;
}

.info-item:last-child {
  border-bottom: none;
}

.label {
  font-weight: 600;
  color: #475569;
  font-size: 14px;
}

.value {
  color: #1e293b;
  font-weight: 500;
}

.parameters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  padding: 10px 0;
}

.param-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(102, 126, 234, 0.08);
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s ease;
}

.param-item:hover {
  background: rgba(102, 126, 234, 0.12);
  transform: translateX(4px);
}

.param-name {
  font-weight: 600;
  color: #667eea;
}

.param-value {
  color: #1e293b;
  font-weight: 500;
}

.device-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
  padding: 10px 0;
}

.device-item {
  margin-bottom: 12px;
  padding: 12px;
  background: rgba(40, 167, 69, 0.05);
  border-radius: 8px;
  border-left: 4px solid #28a745;
  transition: all 0.2s ease;
}

.device-item:hover {
  background: rgba(40, 167, 69, 0.1);
  transform: translateX(4px);
}

.device-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.device-name {
  font-weight: 600;
  color: #495057;
}

.log-card-full {
  height: 520px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: none;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.log-card-full:hover {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.log-header h3 {
  margin: 0;
  color: #1e293b;
  font-weight: 600;
}

.log-controls {
  display: flex;
  gap: 12px;
}

.log-container {
  height: 500px;
  overflow-y: auto;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  padding: 15px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
}

.log-container::-webkit-scrollbar {
  width: 8px;
}

.log-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.log-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
}

.log-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

.log-entry {
  display: flex;
  align-items: flex-start;
  margin-bottom: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  transition: all 0.2s ease;
  word-wrap: break-word;
}

.log-entry:hover {
  background: rgba(0, 0, 0, 0.05);
}

.log-entry.info {
  background: rgba(13, 202, 240, 0.1);
  border-left: 3px solid #0dcaf0;
}

.log-entry.success {
  background: rgba(25, 135, 84, 0.1);
  border-left: 3px solid #198754;
}

.log-entry.warning {
  background: rgba(255, 193, 7, 0.1);
  border-left: 3px solid #ffc107;
}

.log-entry.error {
  background: rgba(220, 53, 69, 0.1);
  border-left: 3px solid #dc3545;
}

.log-time {
  color: #6c757d;
  font-size: 12px;
  margin-right: 10px;
  min-width: 80px;
  font-weight: 500;
}

.log-level {
  font-weight: 700;
  margin-right: 10px;
  min-width: 60px;
  font-size: 12px;
}

.log-entry.info .log-level {
  color: #0dcaf0;
}

.log-entry.success .log-level {
  color: #198754;
}

.log-entry.warning .log-level {
  color: #ffc107;
}

.log-entry.error .log-level {
  color: #dc3545;
}

.log-message {
  flex: 1;
  color: #495057;
  line-height: 1.4;
  word-break: break-word;
}

.no-logs {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: #6c757d;
}

.control-actions {
  text-align: center;
  padding: 24px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.control-actions:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

.control-actions .el-button {
  margin: 0 12px;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.control-actions .el-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .gameplay-running {
    padding: 15px;
  }
  
  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .card-header h1 {
    font-size: 24px;
  }
  
  .parameters, .device-list {
    grid-template-columns: 1fr;
  }
  
  .log-container {
    height: 400px;
  }
  
  .control-actions {
    flex-direction: column;
  }
  
  .control-actions .el-button {
    width: 100%;
  }
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .gameplay-running {
    background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%);
  }
  
  .header-card, .log-card-full {
    background: rgba(45, 55, 72, 0.9);
    border-color: rgba(255, 255, 255, 0.1);
  }
  
  .card-header h1 {
    color: #f7fafc;
  }
  
  .description {
    color: #cbd5e0;
  }
  
  .device-name {
    color: #e2e8f0;
  }
  
  .log-container {
    background: #2d3748;
    border-color: #4a5568;
    color: #e2e8f0;
  }
  
  .log-message {
    color: #e2e8f0;
  }
  
  .control-actions {
    background: rgba(45, 55, 72, 0.9);
  }
}
</style>