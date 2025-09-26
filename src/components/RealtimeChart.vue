<template>
  <div class="realtime-chart">
    <div class="chart-header">
      <h4>{{ title }}</h4>
      <span class="current-value">当前值: {{ currentValue }} {{ unit }}</span>
    </div>
    <canvas ref="chartCanvas" :width="width" :height="height"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useMonitoringStore } from '@/stores/monitoringStore'

const props = defineProps({
  deviceId: {
    type: String,
    required: true
  },
  property: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: '设备属性监控'
  },
  unit: {
    type: String,
    default: ''
  },
  width: {
    type: Number,
    default: 400
  },
  height: {
    type: Number,
    default: 200
  }
})

const chartCanvas = ref(null)
const monitoringStore = useMonitoringStore()
let animationId = null

// 获取监控数据
const monitoringData = computed(() => {
  return monitoringStore.getMonitoringData(props.deviceId, props.property)
})

// 当前值
const currentValue = computed(() => {
  const data = monitoringData.value
  return data.length > 0 ? data[data.length - 1].value : 0
})

// 绘制图表
const drawChart = () => {
  const canvas = chartCanvas.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  const data = monitoringData.value

  // 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (data.length < 2) return

  // 计算数据范围
  const values = data.map(d => d.value)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const valueRange = maxValue - minValue || 1

  // 绘制网格
  ctx.strokeStyle = '#e0e0e0'
  ctx.lineWidth = 1
  
  // 水平网格线
  for (let i = 0; i <= 4; i++) {
    const y = (canvas.height / 4) * i
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(canvas.width, y)
    ctx.stroke()
  }

  // 垂直网格线
  for (let i = 0; i <= 8; i++) {
    const x = (canvas.width / 8) * i
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, canvas.height)
    ctx.stroke()
  }

  // 绘制折线
  ctx.strokeStyle = '#007bff'
  ctx.lineWidth = 2
  ctx.beginPath()

  data.forEach((point, index) => {
    const x = (index / (data.length - 1)) * canvas.width
    const y = canvas.height - ((point.value - minValue) / valueRange) * canvas.height
    
    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })

  ctx.stroke()

  // 绘制数据点
  ctx.fillStyle = '#007bff'
  data.forEach((point, index) => {
    const x = (index / (data.length - 1)) * canvas.width
    const y = canvas.height - ((point.value - minValue) / valueRange) * canvas.height
    
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, 2 * Math.PI)
    ctx.fill()
  })

  // 绘制Y轴标签
  ctx.fillStyle = '#666'
  ctx.font = '12px Arial'
  ctx.textAlign = 'right'
  
  for (let i = 0; i <= 4; i++) {
    const value = minValue + (valueRange * (4 - i) / 4)
    const y = (canvas.height / 4) * i + 4
    ctx.fillText(value.toFixed(1), canvas.width - 5, y)
  }
}

// 动画循环
const animate = () => {
  drawChart()
  animationId = requestAnimationFrame(animate)
}

// 监听数据变化
watch(monitoringData, () => {
  drawChart()
}, { deep: true })

onMounted(() => {
  animate()
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
})
</script>

<style scoped>
.realtime-chart {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.chart-header h4 {
  margin: 0;
  color: #333;
  font-size: 16px;
}

.current-value {
  font-size: 14px;
  color: #007bff;
  font-weight: bold;
}

canvas {
  border: 1px solid #eee;
  border-radius: 4px;
}
</style>