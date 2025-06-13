<template>
  <div class="app">
    <Sidebar />
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import Sidebar from './components/Sidebar.vue'
import { useServiceStore } from './stores/serviceStore'

const serviceStore = useServiceStore()

let serverLogListener = null

onMounted(() => {
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
}
</style>