<template>
  <el-container class="server-status-el full-width-page">
    <el-header class="page-header">
      <h1>服务端状态</h1>
      <div class="header-actions">
        <el-button type="primary" @click="refreshStatus" :icon="RefreshRight">刷新状态</el-button>
        <el-button 
          :type="serviceStore.mqttConnected ? 'danger' : 'success'" 
          @click="toggleMqttConnection" 
          :icon="serviceStore.mqttConnected ? Connection : CircleCloseFilled"
        >
          {{ serviceStore.mqttConnected ? '断开MQTT' : '连接MQTT' }}
        </el-button>
      </div>
    </el-header>
    <el-main class="page-main">
      <el-row :gutter="20">
        <el-col :xs="24" :sm="24" :md="12" class="card-col">
          <el-card class="status-card" shadow="hover">
            <template #header>
              <div class="card-header-title">
                <el-icon><Connection /></el-icon>
                <span>MQTT连接状态</span>
                <el-tag :type="serviceStore.mqttConnected ? 'success' : 'danger'" size="small" style="margin-left: 10px;">
                  {{ serviceStore.mqttConnected ? '已连接' : '未连接' }}
                </el-tag>
              </div>
            </template>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="服务器地址">{{ serviceStore.mqttConfig.host }}:{{ serviceStore.mqttConfig.port }}</el-descriptions-item>
              <el-descriptions-item label="用户名" v-if="serviceStore.mqttConfig.username">{{ serviceStore.mqttConfig.username }}</el-descriptions-item>
              <el-descriptions-item label="连接时间">{{ formatConnectionTime() }}</el-descriptions-item>
            </el-descriptions>
            <el-divider content-position="left">连接配置</el-divider>
            <el-form label-position="top" :model="serviceStore.mqttConfig">
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="主机地址">
                    <el-input value="easysmart.local" disabled readonly />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="端口">
                    <el-input value="1883" type="number" disabled readonly />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="用户名">
                    <el-input v-model="serviceStore.mqttConfig.username" :disabled="serviceStore.mqttConnected" placeholder="可选" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="密码">
                    <el-input v-model="serviceStore.mqttConfig.password" type="password" :disabled="serviceStore.mqttConnected" placeholder="可选" show-password />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-form>
          </el-card>

          <el-card class="status-card" shadow="hover">
            <template #header>
              <div class="card-header-title">
                <el-icon><Cpu /></el-icon>
                <span>系统资源监控</span>
              </div>
            </template>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="内存使用">
                <el-progress :percentage="getMemoryUsage()" :stroke-width="10" :format="() => `${getMemoryUsage()}%`" style="width:100%"/>
              </el-descriptions-item>
              <el-descriptions-item label="运行时间">{{ uptime }}</el-descriptions-item>
            </el-descriptions>
            <el-divider content-position="left">系统信息</el-divider>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="操作系统">{{ systemInfo.platform }}</el-descriptions-item>
              <el-descriptions-item label="Node.js">{{ systemInfo.versions.node }}</el-descriptions-item>
              <el-descriptions-item label="Electron">{{ systemInfo.versions.electron }}</el-descriptions-item>
              <el-descriptions-item label="Chrome">{{ systemInfo.versions.chrome }}</el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-col>

        <el-col :xs="24" :sm="24" :md="12" class="card-col">
          <el-card class="status-card" shadow="hover">
            <template #header>
              <div class="card-header-title">
                <el-icon><Tickets /></el-icon>
                <span>设备连接统计</span>
              </div>
            </template>
            <el-row :gutter="20" class="stats-row">
              <el-col :span="12"><el-statistic title="总设备数" :value="deviceStore.devices.length" /></el-col>
              <el-col :span="12"><el-statistic title="在线设备" :value="deviceStore.connectedDevices.length" /></el-col>
              <el-col :span="12"><el-statistic title="离线设备" :value="deviceStore.disconnectedDevices.length" /></el-col>
              <el-col :span="12"><el-statistic title="连接率" :value="getConnectionRate()" suffix="%" /></el-col>
            </el-row>
            <el-divider content-position="left">设备类型分布</el-divider>
            <el-table :data="deviceTypeStatsForTable" stripe size="small" max-height="200">
              <el-table-column prop="type" label="类型" />
              <el-table-column prop="count" label="数量" width="80" align="center"/>
            </el-table>
          </el-card>

          <el-card class="status-card" shadow="hover">
            <template #header>
              <div class="card-header-title">
                <el-icon><Setting /></el-icon>
                <span>服务运行状态</span>
              </div>
            </template>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="MDNS服务">
                <template #default>
                  <el-tag :type="serviceStore.serviceStatus.mdns === 'running' ? 'success' : 'danger'" size="small">
                    {{ serviceStore.getServiceStatusText('mdns') }}
                  </el-tag>
                  <span class="service-desc">设备发现服务</span>
                </template>
              </el-descriptions-item>
              <el-descriptions-item label="MQTT服务">
                <template #default>
                  <el-tag :type="serviceStore.serviceStatus.mqtt === 'running' ? 'success' : 'danger'" size="small">
                    {{ serviceStore.getServiceStatusText('mqtt') }}
                  </el-tag>
                  <span class="service-desc">消息队列服务</span>
                </template>
              </el-descriptions-item>
              <el-descriptions-item label="API服务">
                <template #default>
                  <el-tag :type="serviceStore.serviceStatus.api === 'running' ? 'success' : 'danger'" size="small">
                    {{ serviceStore.getServiceStatusText('api') }}
                  </el-tag>
                  <span class="service-desc">Web API服务</span>
                </template>
              </el-descriptions-item>
            </el-descriptions>
            <el-divider content-position="left">服务概要</el-divider>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="运行中服务">{{ getRunningServicesCount() }}/3</el-descriptions-item>
              <el-descriptions-item label="API端口">{{ serviceStore.serverConfig.port }}</el-descriptions-item>
              <el-descriptions-item label="运行模式">{{ serviceStore.serverConfig.mode === 'development' ? '开发模式' : '生产模式' }}</el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-col>
      </el-row>

      <el-row style="margin-top: 20px;">
        <el-col :span="24">
          <el-card class="logs-section-el" shadow="hover">
            <template #header>
              <div class="card-header-title">
                <el-icon><Document /></el-icon>
                <span>实时日志</span>
                <div class="logs-actions">
                  <el-button type="info" :icon="Delete" @click="clearLogs" size="small" plain>清空</el-button>
                  <el-button type="success" :icon="Download" @click="exportLogs" size="small" plain>导出</el-button>
                </div>
              </div>
            </template>
            <el-scrollbar height="300px" class="logs-container-el">
              <div v-if="serviceStore.serverLogs.length === 0" class="no-logs-el">
                <el-empty description="暂无日志信息" :image-size="60"/>
              </div>
              <div v-for="log in recentLogs" :key="log.id" class="log-entry-el">
                <span class="log-timestamp-el">{{ log.timestamp }}</span>
                <span class="log-message-el">{{ log.message }}</span>
              </div>
            </el-scrollbar>
          </el-card>
        </el-col>
      </el-row>
    </el-main>
  </el-container>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDeviceStore } from '../stores/deviceStore'
import { useServiceStore } from '../stores/serviceStore'
import {
  RefreshRight,
  Connection,
  CircleCloseFilled,
  Cpu,
  Tickets,
  Setting,
  Document,
  Delete,
  Download
} from '@element-plus/icons-vue'

const deviceStore = useDeviceStore()
const serviceStore = useServiceStore()
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
  return serviceStore.serverLogs.slice(-100) // 显示最近100条日志
})

const deviceTypeStatsForTable = computed(() => {
  const stats = getDeviceTypeStats()
  return Object.entries(stats).map(([type, count]) => ({
    type: deviceStore.deviceTypeMap[type] || type,
    count
  }))
})

onMounted(async () => {
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
  
  uptime.value = await getUptime()
  
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
  // 模拟内存使用率, 实际项目中应从后端获取
  return Math.floor(Math.random() * 30 + 40) // 40-70%
}

async function getUptime() {
  try {
    if (window.electronAPI && window.electronAPI.getSystemUptime) {
      const result = await window.electronAPI.getSystemUptime()
      return result.formatted
    } else {
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
.full-width-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.server-status-el {
  background-color: #f4f6f8; /* Element Plus 风格的浅灰色背景 */
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background-color: #ffffff;
  border-bottom: 1px solid #e4e7ed;
  height: auto; /* 调整 Header 高度 */
}

.page-header h1 {
  font-size: 20px;
  color: #303133;
  margin: 0;
}

.page-main {
  padding: 20px;
  overflow-y: auto;
  flex-grow: 1;
}

.card-col {
  display: flex;
  flex-direction: column;
  gap: 20px; /* 卡片之间的垂直间距 */
}

.status-card {
  flex-grow: 1; /* 使卡片在列中均匀分布高度 */
  display: flex;
  flex-direction: column;
}

.status-card .el-card__body {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.card-header-title {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: bold;
}

.card-header-title .el-icon {
  margin-right: 8px;
}

.stats-row .el-col {
  margin-bottom: 10px;
}

.service-desc {
  font-size: 12px;
  color: #909399;
  margin-left: 10px;
}

.logs-section-el .card-header-title {
  width: 100%;
  justify-content: space-between;
}

.logs-actions .el-button {
  margin-left: 10px;
}

.logs-container-el {
  background-color: #2d2d2d;
  border-radius: 4px;
  padding: 10px;
}

.no-logs-el {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  min-height: 100px; /* 确保在没有日志时也有一定高度 */
}

.log-entry-el {
  display: flex;
  margin-bottom: 4px;
  padding: 2px 4px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #e0e0e0;
  border-radius: 2px;
}

.log-entry-el:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

.log-timestamp-el {
  color: #888;
  margin-right: 10px;
  min-width: 130px; /* 调整时间戳宽度以适应 YYYY-MM-DD HH:mm:ss */
  font-size: 12px;
}

.log-message-el {
  color: #d4d4d4;
  flex: 1;
  word-break: break-all;
  white-space: pre-wrap;
}

/* Element Plus 组件的微调 */
.el-descriptions {
  margin-top: 10px;
}

.el-divider {
  margin: 15px 0;
}

.el-statistic {
  text-align: center;
}

.el-statistic__head {
  font-size: 13px !important;
  color: #606266 !important;
}

.el-statistic__content {
  font-size: 22px !important;
}

</style>