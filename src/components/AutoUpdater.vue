<template>
  <div class="auto-updater">
    <el-card class="update-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>应用更新</span>
          <el-button 
            type="primary" 
            size="small" 
            @click="checkForUpdates"
            :loading="isChecking"
            :disabled="isDownloading"
          >
            检查更新
          </el-button>
        </div>
      </template>
      
      <div class="update-content">
        <div class="version-info">
          <p><strong>当前版本:</strong> {{ currentVersion }}</p>
          <p v-if="updateInfo.version"><strong>最新版本:</strong> {{ updateInfo.version }}</p>
        </div>
        
        <div class="update-status">
          <el-alert
            v-if="statusMessage"
            :title="statusMessage"
            :type="alertType"
            :closable="false"
            show-icon
          />
        </div>
        
        <div v-if="downloadProgress.percent > 0" class="download-progress">
          <p>下载进度:</p>
          <el-progress 
            :percentage="Math.round(downloadProgress.percent)"
            :status="downloadProgress.percent === 100 ? 'success' : 'active'"
          />
          <p class="progress-text">
            {{ formatBytes(downloadProgress.transferred) }} / {{ formatBytes(downloadProgress.total) }}
          </p>
        </div>
        
        <div v-if="isUpdateAvailable" class="update-actions">
          <el-button 
            type="success" 
            @click="downloadUpdate"
            :loading="isDownloading"
            :disabled="isUpdateDownloaded"
          >
            {{ isUpdateDownloaded ? '已下载' : '下载更新' }}
          </el-button>
          
          <el-button 
            v-if="isUpdateDownloaded"
            type="warning" 
            @click="installUpdate"
          >
            安装并重启
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'

export default {
  name: 'AutoUpdater',
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

    // 检查更新
    const checkForUpdates = async () => {
      try {
        isChecking.value = true
        statusMessage.value = '正在检查更新...'
        alertType.value = 'info'
        
        const result = await window.electronAPI.checkForUpdates()
        if (result.success) {
          ElMessage.success('开始检查更新')
        } else {
          ElMessage.error(`检查更新失败: ${result.error}`)
          statusMessage.value = `检查更新失败: ${result.error}`
          alertType.value = 'error'
        }
      } catch (error) {
        console.error('检查更新错误:', error)
        ElMessage.error('检查更新时发生错误')
        statusMessage.value = '检查更新时发生错误'
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
          statusMessage.value = '正在下载更新...'
          alertType.value = 'info'
        } else {
          ElMessage.error(`下载更新失败: ${result.error}`)
          statusMessage.value = `下载更新失败: ${result.error}`
          alertType.value = 'error'
          isDownloading.value = false
        }
      } catch (error) {
        console.error('下载更新错误:', error)
        ElMessage.error('下载更新时发生错误')
        statusMessage.value = '下载更新时发生错误'
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
          ElMessage.error(`安装更新失败: ${result.error}`)
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
          statusMessage.value = '正在检查更新...'
          alertType.value = 'info'
          break
          
        case 'update-available':
          isChecking.value = false
          isUpdateAvailable.value = true
          updateInfo.version = status.data.version
          statusMessage.value = `发现新版本 ${status.data.version}`
          alertType.value = 'success'
          ElMessage.success(`发现新版本 ${status.data.version}`)
          break
          
        case 'update-not-available':
          isChecking.value = false
          statusMessage.value = '当前已是最新版本'
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
          statusMessage.value = '更新下载完成，可以安装'
          alertType.value = 'success'
          ElMessage.success('更新下载完成')
          break
          
        case 'update-error':
          isChecking.value = false
          isDownloading.value = false
          statusMessage.value = `更新错误: ${status.data.message}`
          alertType.value = 'error'
          ElMessage.error(`更新错误: ${status.data.message}`)
          break
      }
    }

    // 格式化字节数
    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    onMounted(() => {
      // 获取初始状态
      getUpdateStatus()
      
      // 监听自动更新状态变化
      window.electronAPI.onAutoUpdaterStatus(handleAutoUpdaterStatus)
    })

    onUnmounted(() => {
      // 清理事件监听器
      // 注意：electron的ipcRenderer.removeAllListeners在preload中可能不可用
      // 这里只是示例，实际可能需要其他清理方式
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
      formatBytes
    }
  }
}
</script>

<style scoped>
.auto-updater {
  margin: 20px 0;
}

.update-card {
  max-width: 600px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.update-content {
  space-y: 16px;
}

.version-info {
  margin-bottom: 16px;
}

.version-info p {
  margin: 8px 0;
  color: #606266;
}

.update-status {
  margin: 16px 0;
}

.download-progress {
  margin: 16px 0;
}

.progress-text {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
  text-align: center;
}

.update-actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}
</style>