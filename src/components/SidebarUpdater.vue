<template>
  <div class="sidebar-updater">
    <div class="update-section">
      <div class="version-info">
        <span class="version-text">v{{ currentVersion }}</span>
      </div>
      
      <el-button 
        type="primary" 
        size="small" 
        @click="checkForUpdates"
        :loading="isChecking"
        :disabled="isDownloading"
        class="update-btn"
      >
        <el-icon><Refresh /></el-icon>
        检查更新
      </el-button>
      
      <div v-if="statusMessage" class="status-message">
        <el-tag 
          :type="getTagType()"
          size="small"
          effect="plain"
        >
          {{ statusMessage }}
        </el-tag>
      </div>
      
      <div v-if="downloadProgress.percent > 0" class="download-progress">
        <el-progress 
          :percentage="Math.round(downloadProgress.percent)"
          :stroke-width="4"
          :show-text="false"
          :status="downloadProgress.percent === 100 ? 'success' : undefined"
        />
        <div class="progress-text">
          {{ Math.round(downloadProgress.percent) }}%
        </div>
      </div>
      
      <div v-if="isUpdateAvailable" class="update-actions">
        <el-button 
          v-if="!isUpdateDownloaded"
          type="success" 
          size="small"
          @click="downloadUpdate"
          :loading="isDownloading"
          class="action-btn"
        >
          <el-icon><Download /></el-icon>
          下载
        </el-button>
        
        <el-button 
          v-if="isUpdateDownloaded"
          type="warning" 
          size="small"
          @click="installUpdate"
          class="action-btn"
        >
          <el-icon><Upload /></el-icon>
          安装
        </el-button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Download, Upload } from '@element-plus/icons-vue'

export default {
  name: 'SidebarUpdater',
  components: {
    Refresh,
    Download,
    Upload
  },
  setup() {
    const currentVersion = ref('1.0.0')
    const isChecking = ref(false)
    const isDownloading = ref(false)
    const isUpdateAvailable = ref(false)
    const isUpdateDownloaded = ref(false)
    const statusMessage = ref('')
    const alertType = ref('info')
    const updateInfo = reactive({
      version: '',
      releaseNotes: ''
    })
    const downloadProgress = reactive({
      percent: 0,
      transferred: 0,
      total: 0
    })

    // 获取标签类型
    const getTagType = () => {
      switch (alertType.value) {
        case 'success': return 'success'
        case 'error': return 'danger'
        case 'warning': return 'warning'
        default: return 'info'
      }
    }

    // 检查更新
    const checkForUpdates = async () => {
      try {
        isChecking.value = true
        statusMessage.value = '检查中...'
        alertType.value = 'info'
        
        const result = await window.electronAPI.checkForUpdates()
        if (result.success) {
          ElMessage.success('开始检查更新')
        } else {
          ElMessage.error(`检查失败: ${result.error}`)
          statusMessage.value = '检查失败'
          alertType.value = 'error'
        }
      } catch (error) {
        console.error('检查更新错误:', error)
        ElMessage.error('检查更新时发生错误')
        statusMessage.value = '检查失败'
        alertType.value = 'error'
      } finally {
        isChecking.value = false
      }
    }

    // 下载更新
    const downloadUpdate = async () => {
      try {
        isDownloading.value = true
        const result = await window.electronAPI.downloadUpdate()
        if (result.success) {
          ElMessage.success('开始下载更新')
          statusMessage.value = '下载中...'
          alertType.value = 'info'
        } else {
          ElMessage.error(`下载失败: ${result.error}`)
          statusMessage.value = '下载失败'
          alertType.value = 'error'
          isDownloading.value = false
        }
      } catch (error) {
        console.error('下载更新错误:', error)
        ElMessage.error('下载更新时发生错误')
        statusMessage.value = '下载失败'
        alertType.value = 'error'
        isDownloading.value = false
      }
    }

    // 安装更新
    const installUpdate = async () => {
      try {
        const result = await window.electronAPI.installUpdate()
        if (result.success) {
          ElMessage.success('正在安装更新并重启应用...')
        } else {
          ElMessage.error(`安装失败: ${result.error}`)
        }
      } catch (error) {
        console.error('安装更新错误:', error)
        ElMessage.error('安装更新时发生错误')
      }
    }

    // 获取更新状态
    const getUpdateStatus = async () => {
      try {
        const result = await window.electronAPI.getUpdateStatus()
        if (result.success) {
          const status = result.data
          currentVersion.value = status.currentVersion
          isUpdateAvailable.value = status.isUpdateAvailable
          isUpdateDownloaded.value = status.isUpdateDownloaded
        }
      } catch (error) {
        console.error('获取更新状态错误:', error)
      }
    }

    // 处理自动更新状态变化
    const handleAutoUpdaterStatus = (status) => {
      console.log('自动更新状态:', status)
      
      switch (status.event) {
        case 'checking-for-update':
          isChecking.value = true
          statusMessage.value = '检查中...'
          alertType.value = 'info'
          break
          
        case 'update-available':
          isChecking.value = false
          isUpdateAvailable.value = true
          updateInfo.version = status.data.version
          statusMessage.value = `新版本 ${status.data.version}`
          alertType.value = 'success'
          ElMessage.success(`发现新版本 ${status.data.version}`)
          break
          
        case 'update-not-available':
          isChecking.value = false
          statusMessage.value = '已是最新'
          alertType.value = 'success'
          ElMessage.info('当前已是最新版本')
          break
          
        case 'download-progress':
          downloadProgress.percent = status.data.percent
          downloadProgress.transferred = status.data.transferred
          downloadProgress.total = status.data.total
          break
          
        case 'update-downloaded':
          isDownloading.value = false
          isUpdateDownloaded.value = true
          downloadProgress.percent = 100
          statusMessage.value = '下载完成'
          alertType.value = 'success'
          ElMessage.success('更新下载完成')
          break
          
        case 'update-error':
          isChecking.value = false
          isDownloading.value = false
          statusMessage.value = '更新错误'
          alertType.value = 'error'
          ElMessage.error(`更新错误: ${status.data.message}`)
          break
      }
    }

    onMounted(() => {
      // 获取初始状态
      getUpdateStatus()
      
      // 监听自动更新状态变化
      window.electronAPI.onAutoUpdaterStatus(handleAutoUpdaterStatus)
    })

    return {
      currentVersion,
      isChecking,
      isDownloading,
      isUpdateAvailable,
      isUpdateDownloaded,
      statusMessage,
      alertType,
      updateInfo,
      downloadProgress,
      checkForUpdates,
      downloadUpdate,
      installUpdate,
      getTagType
    }
  }
}
</script>

<style scoped>
.sidebar-updater {
  margin-top: auto;
  padding-top: 20px;
  border-top: 1px solid #34495e;
}

.update-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.version-info {
  text-align: center;
  margin-bottom: 8px;
}

.version-text {
  font-size: 12px;
  color: #bdc3c7;
  opacity: 0.8;
}

.update-btn {
  width: 100%;
  font-size: 12px;
}

.status-message {
  text-align: center;
}

.status-message .el-tag {
  font-size: 10px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.download-progress {
  margin: 4px 0;
}

.progress-text {
  font-size: 10px;
  color: #bdc3c7;
  text-align: center;
  margin-top: 4px;
}

.update-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  flex: 1;
  font-size: 11px;
  padding: 4px 8px;
}

/* 覆盖Element Plus的按钮样式以适应sidebar */
.sidebar-updater :deep(.el-button) {
  border-radius: 4px;
}

.sidebar-updater :deep(.el-button--small) {
  padding: 6px 12px;
  font-size: 12px;
}

.sidebar-updater :deep(.el-progress-bar__outer) {
  background-color: #34495e;
}

.sidebar-updater :deep(.el-tag) {
  border: none;
  background-color: rgba(255, 255, 255, 0.1);
  color: #ecf0f1;
}

.sidebar-updater :deep(.el-tag--success) {
  background-color: rgba(103, 194, 58, 0.2);
  color: #67c23a;
}

.sidebar-updater :deep(.el-tag--danger) {
  background-color: rgba(245, 108, 108, 0.2);
  color: #f56c6c;
}

.sidebar-updater :deep(.el-tag--warning) {
  background-color: rgba(230, 162, 60, 0.2);
  color: #e6a23c;
}

.sidebar-updater :deep(.el-tag--info) {
  background-color: rgba(144, 147, 153, 0.2);
  color: #909399;
}
</style>