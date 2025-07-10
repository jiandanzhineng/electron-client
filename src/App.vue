<template>
  <div class="app">
    <Sidebar v-if="showSidebar" />
    <main class="main-content" :class="{ 'fullscreen': !showSidebar }">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from './components/Sidebar.vue'
import { useServiceStore } from './stores/serviceStore'
import { useDeviceStore } from './stores/deviceStore'

const route = useRoute()
const serviceStore = useServiceStore()
const deviceStore = useDeviceStore()

// 计算是否显示侧边栏 - 在游戏运行页面时隐藏侧边栏
const showSidebar = computed(() => {
  return route.path !== '/gameplay-running'
})

let serverLogListener = null

onMounted(() => {
  // 初始化服务状态监听器
  serviceStore.init()
  
  // 初始化设备store
  deviceStore.initDeviceList()
  
  // 监听服务器日志事件
  if (window.electronAPI && window.electronAPI.onServerLog) {
    serverLogListener = (logData) => {
      // 格式化日志消息
      const formattedLog = {
        timestamp: new Date(logData.timestamp).toLocaleTimeString(),
        level: logData.level || 'info',
        message: logData.message,
        service: logData.service || 'System',
        id: Date.now() + Math.random()
      }
      serviceStore.addServerLog(formattedLog)
    }
    
    window.electronAPI.onServerLog(serverLogListener)
  }
})

onUnmounted(() => {
  // 清理设备store资源
  deviceStore.cleanup()
  
  // 清理事件监听器
  if (serverLogListener) {
    // 注意：这里可能需要根据实际的API来移除监听器
    // 如果electronAPI提供了移除监听器的方法，在这里调用
  }
})
</script>

<style scoped>
.app {
  display: flex;
  height: 100vh;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  transition: all 0.3s ease;
}

.main-content.fullscreen {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
}
</style>