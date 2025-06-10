<template>
  <div class="local-server">
    <div class="header">
      <h1>本地启动服务端</h1>
      <div class="header-actions">
        <button @click="startAllServices" class="btn btn-primary" :disabled="serviceStore.allServicesRunning">
          🚀 启动所有服务
        </button>
        <button @click="stopAllServices" class="btn btn-danger" :disabled="!serviceStore.allServicesRunning">
          🛑 停止所有服务
        </button>
      </div>
    </div>

    <div class="content-grid">
      <!-- 服务状态面板 -->
      <div class="services-panel">
        <h2>服务状态</h2>
        
        <!-- MDNS服务 -->
        <div class="service-card">
          <div class="service-header">
            <div class="service-info">
              <h3>MDNS服务</h3>
              <p>设备发现和网络服务广播</p>
            </div>
            <div class="service-status">
              <span :class="['status-indicator', serviceStore.serviceStatus.mdns]">
                {{ serviceStore.getServiceStatusText('mdns') }}
              </span>
            </div>
          </div>
          <div class="service-actions">
            <button 
              @click="startMdnsService" 
              class="btn btn-success btn-sm"
              :disabled="serviceStore.isServiceRunning('mdns')"
            >
              启动
            </button>
            <button 
              @click="stopMdnsService" 
              class="btn btn-danger btn-sm"
              :disabled="!serviceStore.isServiceRunning('mdns')"
            >
              停止
            </button>
          </div>
        </div>

        <!-- MQTT服务 -->
        <div class="service-card">
          <div class="service-header">
            <div class="service-info">
              <h3>MQTT服务</h3>
              <p>消息队列和设备通信</p>
            </div>
            <div class="service-status">
              <span :class="['status-indicator', serviceStore.serviceStatus.mqtt]">
                {{ serviceStore.getServiceStatusText('mqtt') }}
              </span>
            </div>
          </div>
          <div class="service-actions">
            <button 
              @click="startMqttService" 
              class="btn btn-success btn-sm"
              :disabled="serviceStore.isServiceRunning('mqtt')"
            >
              启动
            </button>
            <button 
              @click="stopMqttService" 
              class="btn btn-danger btn-sm"
              :disabled="!serviceStore.isServiceRunning('mqtt')"
            >
              停止
            </button>
          </div>
        </div>

        <!-- API服务 -->
        <div class="service-card">
          <div class="service-header">
            <div class="service-info">
              <h3>API服务</h3>
              <p>RESTful API和Web界面</p>
            </div>
            <div class="service-status">
              <span :class="['status-indicator', serviceStore.serviceStatus.api]">
                {{ serviceStore.getServiceStatusText('api') }}
              </span>
            </div>
          </div>
          <div class="service-config">
            <div class="config-item">
              <label>端口:</label>
              <input 
                v-model.number="serviceStore.serverConfig.port" 
                type="number" 
                min="1024" 
                max="65535"
                :disabled="serviceStore.isServiceRunning('api')"
              >
            </div>
            <div class="config-item">
              <label>模式:</label>
              <select 
                v-model="serviceStore.serverConfig.mode"
                :disabled="serviceStore.isServiceRunning('api')"
              >
                <option value="development">开发模式</option>
                <option value="production">生产模式</option>
              </select>
            </div>
          </div>
          <div class="service-actions">
            <button 
              @click="startApiService" 
              class="btn btn-success btn-sm"
              :disabled="serviceStore.isServiceRunning('api')"
            >
              启动
            </button>
            <button 
              @click="stopApiService" 
              class="btn btn-danger btn-sm"
              :disabled="!serviceStore.isServiceRunning('api')"
            >
              停止
            </button>
          </div>
        </div>
      </div>

      <!-- 服务器日志 -->
      <div class="logs-panel">
        <div class="logs-header">
          <h2>服务器日志</h2>
          <div class="logs-actions">
            <button @click="clearLogs" class="btn btn-secondary btn-sm">
              🗑️ 清空日志
            </button>
            <button @click="toggleAutoScroll" class="btn btn-secondary btn-sm">
              {{ autoScroll ? '📌' : '📍' }} 自动滚动
            </button>
          </div>
        </div>
        
        <div class="logs-container" ref="logsContainer">
          <div v-if="serviceStore.serverLogs.length === 0" class="no-logs">
            暂无日志信息
          </div>
          <div 
            v-for="log in serviceStore.serverLogs" 
            :key="log.id" 
            class="log-entry"
          >
            <span class="log-timestamp">{{ log.timestamp }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 服务配置面板 -->
    <div class="config-panel">
      <h2>服务配置</h2>
      <div class="config-grid">
        <div class="config-section">
          <h3>MQTT配置</h3>
          <div class="config-form">
            <div class="form-group">
              <label>主机地址:</label>
              <input v-model="serviceStore.mqttConfig.host" type="text" placeholder="localhost">
            </div>
            <div class="form-group">
              <label>端口:</label>
              <input v-model.number="serviceStore.mqttConfig.port" type="number" placeholder="1883">
            </div>
            <div class="form-group">
              <label>用户名:</label>
              <input v-model="serviceStore.mqttConfig.username" type="text" placeholder="可选">
            </div>
            <div class="form-group">
              <label>密码:</label>
              <input v-model="serviceStore.mqttConfig.password" type="password" placeholder="可选">
            </div>
          </div>
        </div>
        
        <div class="config-section">
          <h3>系统信息</h3>
          <div class="system-info">
            <div class="info-item">
              <label>Node.js版本:</label>
              <span>{{ systemInfo.versions.node }}</span>
            </div>
            <div class="info-item">
              <label>Electron版本:</label>
              <span>{{ systemInfo.versions.electron }}</span>
            </div>
            <div class="info-item">
              <label>Chrome版本:</label>
              <span>{{ systemInfo.versions.chrome }}</span>
            </div>
            <div class="info-item">
              <label>平台:</label>
              <span>{{ systemInfo.platform }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, watch, onMounted } from 'vue'
import { useServiceStore } from '../stores/serviceStore'

const serviceStore = useServiceStore()
const logsContainer = ref(null)
const autoScroll = ref(true)
const systemInfo = ref({
  versions: {
    node: 'N/A',
    electron: 'N/A',
    chrome: 'N/A'
  },
  platform: 'N/A'
})

onMounted(async () => {
  // 初始化服务状态监听器
  serviceStore.init()
  
  // 获取系统信息
  try {
    if (window.electronAPI && window.electronAPI.getSystemInfo) {
      const info = await window.electronAPI.getSystemInfo()
      if (info) {
        systemInfo.value = {
          versions: {
            node: info.versions?.node || 'N/A',
            electron: info.versions?.electron || 'N/A',
            chrome: info.versions?.chrome || 'N/A'
          },
          platform: info.platform || 'N/A'
        }
      }
    }
  } catch (error) {
    console.error('Error getting system info:', error)
  }
  
  // 监听日志变化，自动滚动到底部
  watch(
    () => serviceStore.serverLogs.length,
    () => {
      if (autoScroll.value) {
        nextTick(() => {
          if (logsContainer.value) {
            logsContainer.value.scrollTop = logsContainer.value.scrollHeight
          }
        })
      }
    }
  )
})

function startAllServices() {
  serviceStore.startAllServices()
}

function startMdnsService() {
  serviceStore.startMdnsService()
}

function stopMdnsService() {
  serviceStore.stopMdnsService()
}

function startMqttService() {
  serviceStore.startMqttService()
}

function stopMqttService() {
  serviceStore.stopMqttService()
}

function startApiService() {
  serviceStore.startApiService()
}

function stopApiService() {
  serviceStore.stopApiService()
}

function stopAllServices() {
  serviceStore.stopAllServices()
}

function clearLogs() {
  serviceStore.clearServerLogs()
}

function toggleAutoScroll() {
  autoScroll.value = !autoScroll.value
}
</script>

<style scoped>
.local-server {
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

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-bottom: 30px;
}

.services-panel h2,
.logs-panel h2 {
  color: #2c3e50;
  margin-bottom: 20px;
}

.service-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border: 1px solid #e1e8ed;
}

.service-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
}

.service-info h3 {
  color: #2c3e50;
  margin: 0 0 5px 0;
  font-size: 18px;
}

.service-info p {
  color: #7f8c8d;
  margin: 0;
  font-size: 14px;
}

.status-indicator {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-indicator.running {
  background: #d4edda;
  color: #155724;
}

.status-indicator.stopped {
  background: #f8d7da;
  color: #721c24;
}

.status-indicator.starting {
  background: #fff3cd;
  color: #856404;
}

.status-indicator.error {
  background: #f5c6cb;
  color: #721c24;
}

.service-config {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 15px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.config-item label {
  font-size: 12px;
  font-weight: 600;
  color: #7f8c8d;
  text-transform: uppercase;
}

.config-item input,
.config-item select {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.config-item input:focus,
.config-item select:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.service-actions {
  display: flex;
  gap: 10px;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.logs-actions {
  display: flex;
  gap: 10px;
}

.logs-container {
  background: #1e1e1e;
  color: #f8f8f2;
  border-radius: 8px;
  padding: 15px;
  height: 400px;
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

.config-panel {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border: 1px solid #e1e8ed;
}

.config-panel h2 {
  color: #2c3e50;
  margin-bottom: 20px;
}

.config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
}

.config-section h3 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 16px;
}

.config-form {
  display: grid;
  gap: 15px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-group label {
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
}

.form-group input {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-group input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.system-info {
  display: grid;
  gap: 10px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.info-item:last-child {
  border-bottom: none;
}

.info-item label {
  font-weight: 600;
  color: #7f8c8d;
  font-size: 14px;
}

.info-item span {
  color: #2c3e50;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
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