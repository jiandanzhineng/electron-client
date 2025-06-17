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
              <el-form :model="deviceMapping" label-width="120px">
                <el-form-item 
                  v-for="device in config.requiredDevices" 
                  :key="device.id || device.logicalId"
                  :label="device.name || device.type"
                >
                  <el-select 
                    v-model="deviceMapping[device.id || device.logicalId]" 
                    placeholder="请选择设备"
                    style="width: 100%"
                  >
                    <el-option 
                      v-for="availableDevice in getAvailableDevices(device.type)" 
                      :key="availableDevice.id"
                      :label="`${availableDevice.name} (${availableDevice.id})`"
                      :value="availableDevice.id"
                    />
                  </el-select>
                </el-form-item>
              </el-form>
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import { useDeviceStore } from '@/stores/deviceStore'

export default {
  name: 'GameplayConfig',
  setup() {
    const router = useRouter()
    const gameStore = useGameStore()
    const deviceStore = useDeviceStore()
    
    const config = ref({})
    const deviceMapping = ref({})
    const parameters = ref({})
    
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
      
      // 初始化设备映射
      if (config.value.requiredDevices) {
        config.value.requiredDevices.forEach(device => {
          deviceMapping.value[device.id || device.logicalId] = ''
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
      return true
    })
    
    const cancel = () => {
      router.push('/games')
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
      deviceStore,
      getAvailableDevices,
      canStart,
      cancel,
      startGameplay
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

.config-actions {
  text-align: center;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.config-actions .el-button {
  margin: 0 10px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .config-content .el-col {
    margin-bottom: 20px;
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