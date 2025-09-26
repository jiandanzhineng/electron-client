<template>
  <div v-if="visible" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>设备监控 - {{ deviceInfo.type }} ({{ deviceInfo.id }})</h3>
        <button @click="closeModal" class="close-btn">×</button>
      </div>
      
      <div class="modal-body">
        <div class="charts-container">
          <div v-for="property in availableProperties" :key="property" class="chart-item">
            <RealtimeChart
              :device-id="deviceInfo.id"
              :property="property"
              :title="`${property} 实时数据`"
              :unit="getPropertyUnit(property)"
              :width="580"
              :height="250"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useMonitoringStore } from '@/stores/monitoringStore'
import { useServiceStore } from '@/stores/serviceStore'
import RealtimeChart from './RealtimeChart.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  deviceInfo: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['close'])

const monitoringStore = useMonitoringStore()
const serviceStore = useServiceStore()
const isMonitoring = ref(false)
const currentSessionIds = ref([])

// 根据设备类型定义可监控的属性
const devicePropertyMap = {
  'QIYA': ['pressure', 'temperature'],
  'QTZ': ['distance', 'button0', 'button1'],
  'TD01': ['intensity', 'status'],
  'DIANJI': ['voltage', 'current'],
  'ZIDONGSUO': ['status', 'battery']
}

// 属性单位映射
const propertyUnitMap = {
  'pressure': 'kPa',
  'temperature': '°C',
  'distance': 'cm',
  'intensity': '%',
  'voltage': 'V',
  'current': 'mA',
  'battery': '%'
}

// 可用属性
const availableProperties = computed(() => {
  if (!props.deviceInfo || !props.deviceInfo.type) {
    return ['value', 'status', 'battery']
  }
  return devicePropertyMap[props.deviceInfo.type] || ['value', 'status', 'battery']
})

// 获取属性单位
const getPropertyUnit = (property) => {
  return propertyUnitMap[property] || ''
}

// 开始监控所有属性
const startAllMonitoring = async () => {
  if (!props.deviceInfo || !props.deviceInfo.id) return
  
  try {
    // 设置设备高频率上报 (100ms)
    const topic = `/drecv/${props.deviceInfo.id}`
    const message = {
      method: 'update',
      report_delay_ms: 100
    }
    await serviceStore.publishMessage(topic, JSON.stringify(message))
    console.log(`设置设备 ${props.deviceInfo.id} 高频率上报: 100ms`)
  } catch (error) {
    console.error('设置设备高频率上报失败:', error)
  }
  
  currentSessionIds.value = []
  availableProperties.value.forEach(property => {
    const sessionId = monitoringStore.startMonitoring(props.deviceInfo.id, property)
    currentSessionIds.value.push(sessionId)
  })
  isMonitoring.value = true
}

// 停止所有监控
const stopAllMonitoring = async () => {
  currentSessionIds.value.forEach(sessionId => {
    if (sessionId) {
      monitoringStore.stopMonitoring(sessionId)
    }
  })
  currentSessionIds.value = []
  isMonitoring.value = false
  
  // 只有在设备信息存在时才发送恢复频率的消息
  if (props.deviceInfo && props.deviceInfo.id) {
    try {
      // 恢复设备正常上报频率 (5000ms)
      const topic = `/drecv/${props.deviceInfo.id}`
      const message = {
        method: 'update',
        report_delay_ms: 5000
      }
      await serviceStore.publishMessage(topic, JSON.stringify(message))
      console.log(`恢复设备 ${props.deviceInfo.id} 正常上报频率: 5000ms`)
    } catch (error) {
      console.error('恢复设备正常上报频率失败:', error)
    }
  }
}

// 关闭弹窗
const closeModal = () => {
  stopAllMonitoring()
  emit('close')
}

// 监听弹窗打开/关闭
watch(() => props.visible, (newVal) => {
  if (newVal && props.deviceInfo && props.deviceInfo.id) {
    // 弹窗打开时自动开始监控
    startAllMonitoring()
  } else if (!newVal) {
    // 弹窗关闭时停止监控
    stopAllMonitoring()
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
}



.charts-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(580px, 1fr));
  gap: 20px;
  max-height: 70vh;
  overflow-y: auto;
}

.chart-item {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.no-data {
  text-align: center;
  padding: 40px;
  color: #666;
}

.no-data p {
  margin: 0;
  font-size: 16px;
}
</style>