<template>
  <div class="gameplay-config">
    <el-card class="header-card">
      <template #header>
        <div class="card-header">
          <h1>{{ config?.title || '外部玩法配置' }}</h1>
        </div>
      </template>
      <p class="description">{{ config?.description }}</p>
    </el-card>

    <el-row :gutter="20" class="config-content">
      <!-- 设备映射配置 -->
      <el-col :span="12">
        <el-card class="config-section">
          <template #header>
            <div class="card-header">
              <h2>设备映射</h2>
            </div>
          </template>
          <div class="device-mapping">
            <div v-if="config?.requiredDevices && config.requiredDevices.length > 0">
              <div class="device-list">
                <div 
                  v-for="device in config.requiredDevices" 
                  :key="device.id || device.logicalId"
                  class="device-item"
                  :class="{ 'required-device-item': device.required }"
                >
                  <div class="device-header">
                    <div class="device-info">
                      <span class="device-name">{{ device.name || device.type }}</span>
                      <el-tag 
                        :type="device.required ? 'danger' : 'info'" 
                        size="small" 
                        class="device-status-tag"
                      >
                        {{ device.required ? '必选' : '可选' }}
                      </el-tag>
                    </div>
                  </div>
                  <div class="device-selector">
                    <el-select 
                      v-model="deviceMapping[device.id || device.logicalId]" 
                      :placeholder="device.required ? '请选择设备（必选）' : '请选择设备（可选）'"
                      style="width: 100%"
                      :class="{ 'required-select': device.required }"
                      size="default"
                    >
                      <el-option 
                        v-for="availableDevice in getAvailableDevices(device.type)" 
                        :key="availableDevice.id"
                        :label="`${availableDevice.name} (${availableDevice.id})`"
                        :value="availableDevice.id"
                      />
                    </el-select>
                  </div>
                  <div v-if="device.description" class="device-description">
                    <el-text type="info" size="small">
                      <el-icon class="description-icon"><InfoFilled /></el-icon>
                      {{ device.description }}
                    </el-text>
                  </div>
                </div>
              </div>
            </div>
            <el-empty v-else description="此玩法不需要设备映射" />
          </div>
        </el-card>
      </el-col>

      <!-- 参数配置 -->
      <el-col :span="12">
        <el-card class="config-section">
          <template #header>
            <div class="card-header">
              <h2>参数配置</h2>
            </div>
          </template>
          <div class="parameters">
            <div v-if="config?.parameters && Object.keys(config.parameters).length > 0">
              <el-form :model="parameters" label-width="120px">
                <el-form-item 
                  v-for="(param, key) in config.parameters" 
                  :key="key"
                  :label="param.name || key"
                >
                  <!-- 数值类型参数 -->
                  <el-input-number 
                    v-if="param.type === 'number'"
                    v-model="parameters[key]" 
                    :min="param.min" 
                    :max="param.max" 
                    :step="param.step || 1"
                    style="width: 100%"
                  />
                  
                  <!-- 布尔类型参数 -->
                  <el-switch 
                    v-else-if="param.type === 'boolean'"
                    v-model="parameters[key]"
                  />
                  
                  <!-- 选择类型参数 -->
                  <el-select 
                    v-else-if="param.type === 'select'"
                    v-model="parameters[key]"
                    placeholder="请选择"
                    style="width: 100%"
                  >
                    <el-option 
                      v-for="option in param.options" 
                      :key="option.value"
                      :label="option.label"
                      :value="option.value"
                    />
                  </el-select>
                  
                  <!-- 文件类型参数 -->
                  <div v-else-if="param.type === 'file'" class="file-input-container">
                    <el-input 
                      v-model="parameters[key]" 
                      :placeholder="param.description"
                      readonly
                    />
                    <el-button 
                      @click="selectFile(key, param)"
                      type="primary"
                      style="margin-left: 8px;"
                    >
                      浏览
                    </el-button>
                  </div>
                  
                  <!-- 文本类型参数 -->
                  <el-input 
                    v-else
                    v-model="parameters[key]" 
                    :placeholder="param.description"
                  />
                  
                  <div v-if="param.description" class="param-description">
                    <el-text type="info" size="small">{{ param.description }}</el-text>
                  </div>
                </el-form-item>
              </el-form>
            </div>
            <el-empty v-else description="此玩法没有可配置的参数" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 风险告知 -->
    <div class="risk-notice">
      <el-alert
        type="warning"
        :closable="false"
        show-icon
      >
        <template #title>
          <span class="risk-title">重要安全提醒</span>
        </template>
        <div class="risk-text">
          <p><strong>设备风险：</strong>由于设备、网络的不确定性，设备存在失效风险，请用户自行准备脱困道具。</p>
          <p><strong>刺激设备风险：</strong>对于有人体刺激的设备，用户需自行控制强度，自行承担风险。</p>
          <p><strong>免责声明：</strong>软件为开源软件，作者无法约束代码内容。使用本系统及相关设备产生的任何风险和后果，需用户自行承担。</p>
        </div>
      </el-alert>
      <div class="risk-confirmation">
        <el-checkbox 
          v-model="riskAcknowledged" 
          size="large"
          class="risk-checkbox"
        >
          <span class="confirmation-text">
            我已阅读并理解上述风险告知，愿意自行承担相关风险
          </span>
        </el-checkbox>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="config-actions">
      <el-button @click="cancel">取消</el-button>
      <el-button @click="startGameplay" :disabled="!canStart" type="primary">
        开始玩法
      </el-button>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import { useDeviceStore } from '@/stores/deviceStore'
import { InfoFilled } from '@element-plus/icons-vue'

export default {
  name: 'GameplayConfig',
  components: {
    InfoFilled
  },
  setup() {
    const router = useRouter()
    const gameStore = useGameStore()
    const deviceStore = useDeviceStore()
    
    const config = ref({})
    const deviceMapping = ref({})
    const parameters = ref({})
    const riskAcknowledged = ref(false)
    
    // 从 sessionStorage 恢复状态
    const restoreFromSessionStorage = () => {
      try {
        const savedConfig = sessionStorage.getItem('currentGameplayConfig')
        if (savedConfig) {
          const parsedConfig = JSON.parse(savedConfig)
          gameStore.currentGameplayConfig = parsedConfig
          console.log('从 sessionStorage 恢复配置:', parsedConfig)
        }
      } catch (error) {
        console.error('恢复配置失败:', error)
      }
    }
    
    onMounted(async () => {
      // 检查是否有当前配置
      if (!gameStore.currentGameplayConfig) {
        // 尝试从 sessionStorage 恢复
        restoreFromSessionStorage()
        
        // 如果还是没有配置，显示错误并返回
        if (!gameStore.currentGameplayConfig) {
          alert('没有找到玩法配置，可能是由于页面刷新或热更新导致状态丢失。请重新选择玩法。')
          router.push('/games')
          return
        }
      }
      
      config.value = gameStore.currentGameplayConfig
      
      // 从 localStorage 恢复风险确认状态
      try {
        const savedRiskAcknowledged = localStorage.getItem('riskAcknowledged')
        if (savedRiskAcknowledged !== null) {
          riskAcknowledged.value = JSON.parse(savedRiskAcknowledged)
        }
      } catch (error) {
        console.error('恢复风险确认状态失败:', error)
      }
      
      // 初始化设备映射
      if (config.value.requiredDevices) {
        config.value.requiredDevices.forEach(device => {
          const deviceId = device.id || device.logicalId
          // 获取该设备类型的可用设备列表
          const availableDevices = getAvailableDevices(device.type)
          // 默认选择第一个可用的同类型设备
          deviceMapping.value[deviceId] = availableDevices.length > 0 ? availableDevices[0].id : ''
        })
      }
      
      // 初始化参数值
      if (config.value.parameters) {
        Object.keys(config.value.parameters).forEach(key => {
          const param = config.value.parameters[key]
          parameters.value[key] = param.default !== undefined ? param.default : ''
        })
      }
      
      // 初始化设备列表
       deviceStore.initDeviceList()
    })
    
    // 监听风险确认状态变化，自动保存到 localStorage
    watch(riskAcknowledged, (newValue) => {
      try {
        localStorage.setItem('riskAcknowledged', JSON.stringify(newValue))
      } catch (error) {
        console.error('保存风险确认状态失败:', error)
      }
    })
    
    // 清理 sessionStorage（除非是热更新）
    onUnmounted(() => {
      // 只有在真正离开页面时才清理，热更新时不清理
      if (router.currentRoute.value.path !== '/gameplay-config') {
        sessionStorage.removeItem('currentGameplayConfig')
      }
    })
    
    const getAvailableDevices = (deviceType) => {
      // 只返回在线设备
      const onlineDevices = deviceStore.devices.filter(device => device.connected)
      
      if (!deviceType) return onlineDevices
      return onlineDevices.filter(device => 
        device.type === deviceType || device.capabilities?.includes(deviceType)
      )
    }
    
    const canStart = computed(() => {
      // 检查必需的设备是否都已映射
      if (config.value.requiredDevices) {
        for (const device of config.value.requiredDevices) {
          if (device.required && !deviceMapping.value[device.id || device.logicalId]) {
            return false
          }
        }
      }
      // 检查是否已确认风险告知
      if (!riskAcknowledged.value) {
        return false
      }
      return true
    })
    
    const cancel = () => {
      router.push('/games')
    }
    
    const selectFile = async (paramKey, param) => {
      try {
        const filters = []
        if (param.fileFilter) {
          // 确保创建纯净的对象，避免Vue响应式代理导致的序列化问题
          filters.push({
            name: String(param.fileFilter.name || '文件'),
            extensions: Array.isArray(param.fileFilter.extensions) ? [...param.fileFilter.extensions] : ['*']
          })
        } else {
          filters.push({ name: '所有文件', extensions: ['*'] })
        }
        
        const options = {
          properties: ['openFile'],
          filters: filters
        }
        
        const result = await window.electronAPI.showOpenDialog(options)
        
        if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
          parameters.value[paramKey] = result.filePaths[0]
        }
      } catch (error) {
        console.error('选择文件失败:', error)
        alert('选择文件失败: ' + error.message)
      }
    }
    
    const startGameplay = async () => {
      if (!canStart.value) {
        alert('请完成所有必需的配置')
        return
      }
      
      try {
        const gameplayConfig = {
          ...config.value,
          deviceMapping: deviceMapping.value,
          parameters: parameters.value
        }
        
        console.log('启动玩法配置:', gameplayConfig)
        
        // 保存运行中的玩法信息到 sessionStorage
        const runningGameplay = {
          config: config.value,
          deviceMapping: deviceMapping.value,
          parameters: parameters.value,
          startTime: Date.now()
        }
        sessionStorage.setItem('runningGameplay', JSON.stringify(runningGameplay))
        
        // 这里应该调用实际的启动逻辑
        // await gameStore.startGameplay(gameplayConfig)
        
        // 跳转到玩法运行界面
        router.push('/gameplay-running')
      } catch (error) {
        console.error('启动玩法失败:', error)
        alert('启动玩法失败: ' + error.message)
      }
    }
    
    return {
      config,
      deviceMapping,
      parameters,
      riskAcknowledged,
      deviceStore,
      getAvailableDevices,
      canStart,
      cancel,
      startGameplay,
      selectFile
    }
  }
}
</script>

<style scoped>
.gameplay-config {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.header-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h1,
.card-header h2 {
  margin: 0;
  color: #2c3e50;
}

.description {
  margin: 0;
  color: #606266;
}

.file-input-container {
  display: flex;
  align-items: center;
  width: 100%;
}

.file-input-container .el-input {
  flex: 1;
  font-size: 14px;
}

.config-content {
  margin-bottom: 20px;
}

.config-section {
  height: 100%;
}

.param-description {
  margin-top: 5px;
}

.device-description {
  margin-top: 8px;
  padding: 8px 12px;
  background-color: #f0f9ff;
  border-left: 3px solid #409eff;
  border-radius: 4px;
}

.description-icon {
  margin-right: 4px;
  vertical-align: middle;
}

.debug-card {
  margin-bottom: 20px;
}

.debug-card pre {
  background: #f5f7fa;
  padding: 10px;
  border-radius: 4px;
  font-size: 12px;
  max-height: 200px;
  overflow-y: auto;
}

.risk-notice {
  margin-bottom: 16px;
}

.risk-text {
  margin: 0;
  line-height: 1.4;
}

.risk-text p {
  margin: 4px 0;
  color: #606266;
  font-size: 13px;
}

.risk-text strong {
  color: #e6a23c;
  font-weight: 600;
}

.risk-confirmation {
  margin-top: 6px;
  padding: 6px;
  background-color: #fafafa;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
}

.risk-checkbox {
  font-size: 13px;
}

.confirmation-text {
  font-weight: 500;
  color: #303133;
  line-height: 1.4;
  font-size: 13px;
}

.config-actions {
  text-align: center;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.config-actions .el-button {
  margin: 0 10px;
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.device-item {
  padding: 16px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background-color: #fafafa;
  transition: all 0.3s ease;
}

.device-item:hover {
  border-color: #c0c4cc;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.required-device-item {
  border-color: #f56c6c;
  background-color: #fef0f0;
}

.required-device-item:hover {
  border-color: #f56c6c;
  box-shadow: 0 2px 8px rgba(245, 108, 108, 0.2);
}

.device-header {
  margin-bottom: 12px;
}

.device-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.device-name {
  font-weight: 500;
  font-size: 14px;
  color: #303133;
}

.device-status-tag {
  font-weight: 500;
}

.device-selector {
  margin-bottom: 8px;
}

.required-select .el-input__wrapper {
  border-color: #f56c6c;
}

.required-select .el-input__wrapper:hover {
  border-color: #f56c6c;
}

.required-select .el-input__wrapper.is-focus {
  border-color: #f56c6c;
  box-shadow: 0 0 0 2px rgba(245, 108, 108, 0.2);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .config-content .el-col {
    margin-bottom: 20px;
  }
  
  .device-item {
    padding: 12px;
  }
  
  .device-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .device-name {
    font-size: 13px;
  }
  
  .device-description {
    padding: 6px 8px;
    font-size: 12px;
  }
  
  .risk-notice {
    margin-bottom: 12px;
  }
  
  .risk-text p {
    font-size: 12px;
    margin: 3px 0;
  }
  
  .risk-confirmation {
    padding: 8px;
    margin-top: 8px;
  }
  
  .confirmation-text {
    font-size: 12px;
  }
  
  .risk-checkbox {
    font-size: 12px;
  }
  
  .config-actions {
    text-align: center;
  }
  
  .config-actions .el-button {
    margin: 5px;
    width: 100px;
  }
}
</style>