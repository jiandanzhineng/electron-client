<template>
  <div class="server-status">
    <div class="header">
      <h1>服务端状态</h1>
      <div class="header-actions">
        <button @click="refreshStatus" class="btn btn-secondary">
          🔄 刷新状态
        </button>
        <button 
          @click="toggleMqttConnection" 
          :class="['btn', serviceStore.mqttConnected ? 'btn-danger' : 'btn-success']"
        >
          {{ serviceStore.mqttConnected ? '🔌 断开MQTT' : '🔗 连接MQTT' }}
        </button>
      </div>
    </div>

    <div class="status-grid">
      <!-- MQTT连接状态 -->
      <div class="status-card">
        <div class="card-header">
          <h2>🔗 MQTT连接状态</h2>
          <span :class="['connection-status', serviceStore.mqttConnected ? 'connected' : 'disconnected']">
            {{ serviceStore.mqttConnected ? '已连接' : '未连接' }}
          </span>
        </div>
        <div class="card-content">
          <div class="connection-info">
            <div class="info-row">
              <label>服务器地址:</label>
              <span>{{ serviceStore.mqttConfig.host }}:{{ serviceStore.mqttConfig.port }}</span>
            </div>
            <div class="info-row" v-if="serviceStore.mqttConfig.username">
              <label>用户名:</label>
              <span>{{ serviceStore.mqttConfig.username }}</span>
            </div>
            <div class="info-row">
              <label>连接时间:</label>
              <span>{{ formatConnectionTime() }}</span>
            </div>
          </div>
          
          <div class="mqtt-config">
            <h3>连接配置</h3>
            <div class="config-form">
              <div class="form-row">
                <div class="form-group">
                  <label>主机地址:</label>
                  <input 
                    value="easysmart.local" 
                    type="text" 
                    disabled
                    readonly
                  >
                </div>
                <div class="form-group">
                  <label>端口:</label>
                  <input 
                    value="1883" 
                    type="number" 
                    disabled
                    readonly
                  >
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>用户名:</label>
                  <input 
                    v-model="serviceStore.mqttConfig.username" 
                    type="text" 
                    :disabled="serviceStore.mqttConnected"
                    placeholder="可选"
                  >
                </div>
                <div class="form-group">
                  <label>密码:</label>
                  <input 
                    v-model="serviceStore.mqttConfig.password" 
                    type="password" 
                    :disabled="serviceStore.mqttConnected"
                    placeholder="可选"
                  >
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 设备连接统计 -->
      <div class="status-card">
        <div class="card-header">
          <h2>📱 设备连接统计</h2>
        </div>
        <div class="card-content">
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-number">{{ deviceStore.devices.length }}</div>
              <div class="stat-label">总设备数</div>
            </div>
            <div class="stat-item online">
              <div class="stat-number">{{ deviceStore.connectedDevices.length }}</div>
              <div class="stat-label">在线设备</div>
            </div>
            <div class="stat-item offline">
              <div class="stat-number">{{ deviceStore.disconnectedDevices.length }}</div>
              <div class="stat-label">离线设备</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">{{ getConnectionRate() }}%</div>
              <div class="stat-label">连接率</div>
            </div>
          </div>
          
          <div class="device-types">
            <h3>设备类型分布</h3>
            <div class="type-list">
              <div 
                v-for="(count, type) in getDeviceTypeStats()" 
                :key="type" 
                class="type-item"
              >
                <span class="type-name">{{ deviceStore.deviceTypeMap[type] || type }}</span>
                <span class="type-count">{{ count }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 服务运行状态 -->
      <div class="status-card">
        <div class="card-header">
          <h2>⚙️ 服务运行状态</h2>
        </div>
        <div class="card-content">
          <div class="services-list">
            <div class="service-item">
              <div class="service-info">
                <span class="service-name">MDNS服务</span>
                <span class="service-desc">设备发现服务</span>
              </div>
              <span :class="['service-status', serviceStore.serviceStatus.mdns]">
                {{ serviceStore.getServiceStatusText('mdns') }}
              </span>
            </div>
            
            <div class="service-item">
              <div class="service-info">
                <span class="service-name">MQTT服务</span>
                <span class="service-desc">消息队列服务</span>
              </div>
              <span :class="['service-status', serviceStore.serviceStatus.mqtt]">
                {{ serviceStore.getServiceStatusText('mqtt') }}
              </span>
            </div>
            
            <div class="service-item">
              <div class="service-info">
                <span class="service-name">API服务</span>
                <span class="service-desc">Web API服务</span>
              </div>
              <span :class="['service-status', serviceStore.serviceStatus.api]">
                {{ serviceStore.getServiceStatusText('api') }}
              </span>
            </div>
          </div>
          
          <div class="service-summary">
            <div class="summary-item">
              <label>运行中服务:</label>
              <span>{{ getRunningServicesCount() }}/3</span>
            </div>
            <div class="summary-item">
              <label>API端口:</label>
              <span>{{ serviceStore.serverConfig.port }}</span>
            </div>
            <div class="summary-item">
              <label>运行模式:</label>
              <span>{{ serviceStore.serverConfig.mode === 'development' ? '开发模式' : '生产模式' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 系统资源监控 -->
      <div class="status-card">
        <div class="card-header">
          <h2>💻 系统资源监控</h2>
        </div>
        <div class="card-content">
          <div class="resource-stats">
            <div class="resource-item">
              <label>内存使用:</label>
              <div class="resource-bar">
                <div class="resource-fill" :style="{ width: getMemoryUsage() + '%' }"></div>
              </div>
              <span class="resource-text">{{ getMemoryUsage() }}%</span>
            </div>
            
            <div class="resource-item">
              <label>运行时间:</label>
              <span class="resource-text">{{ uptime }}</span>
            </div>
          </div>
          
          <div class="system-info">
            <h3>系统信息</h3>
            <div class="info-grid">
              <div class="info-item">
                <label>操作系统:</label>
                <span>{{ systemInfo.platform }}</span>
              </div>
              <div class="info-item">
                <label>Node.js:</label>
                <span>{{ systemInfo.versions.node }}</span>
              </div>
              <div class="info-item">
                <label>Electron:</label>
                <span>{{ systemInfo.versions.electron }}</span>
              </div>
              <div class="info-item">
                <label>Chrome:</label>
                <span>{{ systemInfo.versions.chrome }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 实时日志 -->
    <div class="logs-section">
      <div class="logs-header">
        <h2>📋 实时日志</h2>
        <div class="logs-actions">
          <button @click="clearLogs" class="btn btn-secondary btn-sm">
            🗑️ 清空
          </button>
          <button @click="exportLogs" class="btn btn-secondary btn-sm">
            📤 导出
          </button>
        </div>
      </div>
      
      <div class="logs-container" ref="logsContainer">
        <div v-if="serviceStore.serverLogs.length === 0" class="no-logs">
          暂无日志信息
        </div>
        <div 
          v-for="log in recentLogs" 
          :key="log.id" 
          class="log-entry"
        >
          <span class="log-timestamp">{{ log.timestamp }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDeviceStore } from '../stores/deviceStore'
import { useServiceStore } from '../stores/serviceStore'

const deviceStore = useDeviceStore()
const serviceStore = useServiceStore()
const logsContainer = ref(null)
const connectionTime = ref(null)
const uptimeInterval = ref(null)
const uptime = ref('00:00:00')
const systemInfo = ref({
  platform: 'N/A',
  versions: {
    node: 'N/A',
    electron: 'N/A',
    chrome: 'N/A'
  }
})

const recentLogs = computed(() => {
  return serviceStore.serverLogs.slice(-50) // 只显示最近50条日志
})

onMounted(async () => {
  // 获取系统信息
  try {
    if (window.electronAPI && window.electronAPI.getSystemInfo) {
      const info = await window.electronAPI.getSystemInfo()
      if (info) {
        systemInfo.value = {
          platform: info.platform || 'N/A',
          versions: {
            node: info.versions?.node || 'N/A',
            electron: info.versions?.electron || 'N/A',
            chrome: info.versions?.chrome || 'N/A'
          }
        }
      }
    }
  } catch (error) {
    console.error('Error getting system info:', error)
  }
  deviceStore.initDeviceList()
  
  // 初始化运行时间
  uptime.value = await getUptime()
  
  // 每秒更新一次运行时间
  uptimeInterval.value = setInterval(async () => {
    uptime.value = await getUptime()
  }, 1000)
  
  if (serviceStore.mqttConnected) {
    connectionTime.value = Date.now()
  }
})

onUnmounted(() => {
  if (uptimeInterval.value) {
    clearInterval(uptimeInterval.value)
  }
})

function refreshStatus() {
  deviceStore.refreshDevices()
  serviceStore.addServerLog('状态已刷新')
}

function toggleMqttConnection() {
  if (serviceStore.mqttConnected) {
    serviceStore.disconnectMqtt()
    connectionTime.value = null
  } else {
    serviceStore.connectMqtt()
    connectionTime.value = Date.now()
  }
}

function formatConnectionTime() {
  if (!connectionTime.value) return '未连接'
  const duration = Date.now() - connectionTime.value
  const seconds = Math.floor(duration / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds % 60}秒`
  } else {
    return `${seconds}秒`
  }
}

function getConnectionRate() {
  if (deviceStore.devices.length === 0) return 0
  return Math.round((deviceStore.connectedDevices.length / deviceStore.devices.length) * 100)
}

function getDeviceTypeStats() {
  const stats = {}
  deviceStore.devices.forEach(device => {
    stats[device.type] = (stats[device.type] || 0) + 1
  })
  return stats
}

function getRunningServicesCount() {
  return Object.values(serviceStore.serviceStatus).filter(status => status === 'running').length
}

function getMemoryUsage() {
  // 模拟内存使用率
  return Math.floor(Math.random() * 30 + 40) // 40-70%
}

async function getUptime() {
  try {
    if (window.electronAPI && window.electronAPI.getSystemUptime) {
      const result = await window.electronAPI.getSystemUptime()
      return result.formatted
    } else {
      // 浏览器环境下的fallback
      return '00:00:00'
    }
  } catch (error) {
    console.error('Error getting uptime:', error)
    return '00:00:00'
  }
}

function clearLogs() {
  serviceStore.clearServerLogs()
}

function exportLogs() {
  const logs = serviceStore.serverLogs.map(log => `${log.timestamp} - ${log.message}`).join('\n')
  const blob = new Blob([logs], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `server-logs-${new Date().toISOString().slice(0, 10)}.txt`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.server-status {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e1e8ed;
}

.header h1 {
  color: #2c3e50;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.status-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border: 1px solid #e1e8ed;
  overflow: hidden;
}

.card-header {
  background: #f8f9fa;
  padding: 15px 20px;
  border-bottom: 1px solid #e1e8ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h2 {
  margin: 0;
  color: #2c3e50;
  font-size: 16px;
}

.connection-status {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.connection-status.connected {
  background: #d4edda;
  color: #155724;
}

.connection-status.disconnected {
  background: #f8d7da;
  color: #721c24;
}

.card-content {
  padding: 20px;
}

.connection-info {
  margin-bottom: 20px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.info-row:last-child {
  border-bottom: none;
}

.info-row label {
  font-weight: 600;
  color: #7f8c8d;
}

.mqtt-config h3 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 14px;
}

.config-form {
  display: grid;
  gap: 15px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-group label {
  font-size: 12px;
  font-weight: 600;
  color: #7f8c8d;
}

.form-group input {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-group input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}

.stat-item {
  text-align: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.stat-item.online {
  background: #d4edda;
}

.stat-item.offline {
  background: #f8d7da;
}

.stat-number {
  font-size: 24px;
  font-weight: bold;
  color: #2c3e50;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 12px;
  color: #7f8c8d;
  text-transform: uppercase;
}

.device-types h3 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 14px;
}

.type-list {
  display: grid;
  gap: 8px;
}

.type-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 4px;
}

.type-name {
  color: #2c3e50;
  font-size: 14px;
}

.type-count {
  background: #3498db;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.services-list {
  display: grid;
  gap: 15px;
  margin-bottom: 20px;
}

.service-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.service-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.service-name {
  font-weight: 600;
  color: #2c3e50;
}

.service-desc {
  font-size: 12px;
  color: #7f8c8d;
}

.service-status {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.service-status.running {
  background: #d4edda;
  color: #155724;
}

.service-status.stopped {
  background: #f8d7da;
  color: #721c24;
}

.service-summary {
  display: grid;
  gap: 10px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.summary-item:last-child {
  border-bottom: none;
}

.summary-item label {
  font-weight: 600;
  color: #7f8c8d;
}

.resource-stats {
  display: grid;
  gap: 15px;
  margin-bottom: 20px;
}

.resource-item {
  display: grid;
  grid-template-columns: 80px 1fr 50px;
  gap: 10px;
  align-items: center;
}

.resource-item label {
  font-size: 12px;
  font-weight: 600;
  color: #7f8c8d;
}

.resource-bar {
  height: 8px;
  background: #e1e8ed;
  border-radius: 4px;
  overflow: hidden;
}

.resource-fill {
  height: 100%;
  background: linear-gradient(90deg, #27ae60, #f39c12, #e74c3c);
  transition: width 0.3s ease;
}

.resource-text {
  font-size: 12px;
  font-weight: 600;
  color: #2c3e50;
  text-align: right;
}

.system-info h3 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 14px;
}

.info-grid {
  display: grid;
  gap: 8px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #f0f0f0;
}

.info-item:last-child {
  border-bottom: none;
}

.info-item label {
  font-size: 12px;
  color: #7f8c8d;
}

.info-item span {
  font-size: 12px;
  color: #2c3e50;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

.logs-section {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border: 1px solid #e1e8ed;
  overflow: hidden;
}

.logs-header {
  background: #f8f9fa;
  padding: 15px 20px;
  border-bottom: 1px solid #e1e8ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logs-header h2 {
  margin: 0;
  color: #2c3e50;
  font-size: 16px;
}

.logs-actions {
  display: flex;
  gap: 10px;
}

.logs-container {
  background: #1e1e1e;
  color: #f8f8f2;
  padding: 15px;
  height: 300px;
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.4;
}

.no-logs {
  color: #7f8c8d;
  text-align: center;
  font-style: italic;
  padding: 20px;
}

.log-entry {
  display: flex;
  margin-bottom: 5px;
  padding: 2px 0;
}

.log-timestamp {
  color: #6c7b7f;
  margin-right: 10px;
  min-width: 80px;
  font-size: 11px;
}

.log-message {
  color: #f8f8f2;
  flex: 1;
}

/* 按钮样式 */
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2980b9;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #7f8c8d;
}

.btn-success {
  background: #27ae60;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #229954;
}

.btn-danger {
  background: #e74c3c;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c0392b;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}
</style>