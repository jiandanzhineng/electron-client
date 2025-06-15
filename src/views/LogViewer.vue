<template>
  <div class="log-viewer">
    <el-card class="log-card">
      <template #header>
        <div class="card-header">
          <h2>应用日志</h2>
          <div class="log-controls">
            <el-select v-model="logLines" @change="loadLogs" placeholder="选择行数" style="width: 120px">
              <el-option label="最近50行" :value="50" />
              <el-option label="最近100行" :value="100" />
              <el-option label="最近200行" :value="200" />
              <el-option label="最近500行" :value="500" />
            </el-select>
            <el-button type="primary" @click="loadLogs" :loading="loading">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
            <el-button type="warning" @click="clearOldLogs">
              <el-icon><Delete /></el-icon>
              清理旧日志
            </el-button>
            <el-button type="info" @click="openLogDirectory">
              <el-icon><FolderOpened /></el-icon>
              打开日志目录
            </el-button>
          </div>
        </div>
      </template>
      
      <el-alert v-if="logInfo" type="info" :closable="false" class="log-info">
        <template #title>
          <div>
            <p><strong>日志文件:</strong> {{ logInfo.logFile }}</p>
            <p><strong>日志目录:</strong> {{ logInfo.logDirectory }}</p>
          </div>
        </template>
      </el-alert>
      
      <div class="log-content">
        <el-empty v-if="!loading && logs.length === 0" description="暂无日志" />
        <div v-else-if="!loading" class="log-container">
          <div 
            v-for="(log, index) in logs" 
            :key="index" 
            :class="getLogLineClass(log)"
            class="log-line"
          >
            {{ log }}
          </div>
        </div>
        <div v-if="loading" class="loading-container">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>加载中...</span>
        </div>
      </div>
      
      <template #footer>
        <div class="log-footer">
          <el-text class="log-count">共 {{ logs.length }} 条日志</el-text>
          <div class="log-legend">
            <el-tag type="danger" size="small">错误</el-tag>
            <el-tag type="warning" size="small">警告</el-tag>
            <el-tag type="info" size="small">信息</el-tag>
            <el-tag type="" size="small">调试</el-tag>
          </div>
        </div>
      </template>
    </el-card>
  </div>
</template>

<script>
import { ElMessage } from 'element-plus'
import { Refresh, Delete, FolderOpened, Loading } from '@element-plus/icons-vue'

export default {
  name: 'LogViewer',
  components: {
    Refresh,
    Delete,
    FolderOpened,
    Loading
  },
  data() {
    return {
      logs: [],
      logLines: 100,
      loading: false,
      logInfo: null
    }
  },
  mounted() {
    this.loadLogs()
  },
  methods: {
    async loadLogs() {
      this.loading = true
      try {
        const result = await window.electronAPI.getAppLogs(this.logLines)
        if (result.success) {
          this.logs = result.logs
          this.logInfo = {
            logFile: result.logFile,
            logDirectory: result.logDirectory
          }
        } else {
          ElMessage.error('加载日志失败: ' + result.error)
        }
      } catch (error) {
        ElMessage.error('加载日志失败: ' + error.message)
      } finally {
        this.loading = false
      }
    },
    
    async clearOldLogs() {
      try {
        const result = await window.electronAPI.cleanOldLogs()
        if (result.success) {
          ElMessage.success('旧日志清理成功')
          this.loadLogs()
        } else {
          ElMessage.error('清理旧日志失败: ' + result.error)
        }
      } catch (error) {
        ElMessage.error('清理旧日志失败: ' + error.message)
      }
    },
    
    async openLogDirectory() {
      try {
        const result = await window.electronAPI.openLogDirectory()
        if (result.success) {
          ElMessage.success('已打开日志目录')
        } else {
          ElMessage.error('打开日志目录失败: ' + result.error)
        }
      } catch (error) {
        ElMessage.error('打开日志目录失败: ' + error.message)
      }
    },
    
    getLogLineClass(log) {
      if (log.includes('[ERROR]')) return 'log-error'
      if (log.includes('[WARN]')) return 'log-warn'
      if (log.includes('[INFO]')) return 'log-info'
      if (log.includes('[DEBUG]')) return 'log-debug'
      return 'log-default'
    }
  }
}
</script>

<style scoped>
.log-viewer {
  padding: 20px;
  height: calc(100vh - 40px);
}

.log-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h2 {
  margin: 0;
  color: #303133;
  font-size: 18px;
}

.log-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.log-info {
  margin-bottom: 16px;
}

.log-info p {
  margin: 4px 0;
  font-size: 13px;
  color: #606266;
}

.log-content {
  flex: 1;
  min-height: 400px;
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}

.log-container {
  background-color: #2d2d2d;
  border-radius: 6px;
  padding: 16px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #e8e8e8;
  overflow-y: auto;
  max-height: 100%;
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  color: #909399;
}

.log-line {
  margin-bottom: 3px;
  padding: 3px 6px;
  border-radius: 3px;
  word-wrap: break-word;
  white-space: pre-wrap;
  transition: background-color 0.2s;
}

.log-line:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.log-error {
  color: #f56c6c;
  background-color: rgba(245, 108, 108, 0.15);
  border-left: 3px solid #f56c6c;
  padding-left: 8px;
}

.log-warn {
  color: #e6a23c;
  background-color: rgba(230, 162, 60, 0.15);
  border-left: 3px solid #e6a23c;
  padding-left: 8px;
}

.log-info {
  color: #409eff;
  background-color: rgba(64, 158, 255, 0.1);
}

.log-debug {
  color: #909399;
  background-color: rgba(144, 147, 153, 0.1);
}

.log-default {
  color: #e8e8e8;
}

.log-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
}

.log-legend {
  display: flex;
  gap: 8px;
}

.log-count {
  color: #909399;
  font-size: 13px;
}
</style>