<template>
  <div class="home">
    <h1>欢迎使用 EasySmart Electron</h1>
    <p>这是一个基于Vue 3和Pinia重构的Electron应用程序。您可以在此基础上进行开发，构建跨平台的桌面应用。</p>
    
    <div class="info-grid">
      <div class="info-card">
        <h3>🚀 关于Electron</h3>
        <p>Electron是一个使用JavaScript、HTML和CSS构建跨平台桌面应用程序的框架。它基于Node.js和Chromium，让您可以使用Web技术创建原生应用程序体验。</p>
      </div>
      
      <div class="info-card">
        <h3>⚡ Vue 3特性</h3>
        <p>本应用使用Vue 3的Composition API，提供更好的TypeScript支持、更小的包体积和更好的性能。响应式系统经过重写，提供更精确的更新。</p>
      </div>
      
      <div class="info-card">
        <h3>🗃️ Pinia状态管理</h3>
        <p>使用Pinia作为状态管理库，提供类型安全的store、直观的API和优秀的开发者体验。所有页面状态都会被持久化保存。</p>
      </div>
      
      <div class="info-card">
        <h3>📊 系统状态</h3>
        <div class="status-overview">
          <div class="status-item">
            <span class="status-label">设备数量:</span>
            <span class="status-value">{{ deviceStore.devices.length }}</span>
          </div>
          <div class="status-item">
            <span class="status-label">在线设备:</span>
            <span class="status-value">{{ deviceStore.connectedDevices.length }}</span>
          </div>
          <div class="status-item">
            <span class="status-label">游戏数量:</span>
            <span class="status-value">{{ gameStore.games.length }}</span>
          </div>
          <div class="status-item">
            <span class="status-label">运行中游戏:</span>
            <span class="status-value">{{ gameStore.runningGames.length }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <div class="quick-actions">
      <h3>快速操作</h3>
      <div class="action-buttons">
        <button @click="$router.push('/device-management')" class="action-btn">
          📱 设备管理
        </button>
        <button @click="$router.push('/local-server')" class="action-btn">
          🖥️ 启动服务
        </button>
        <button @click="$router.push('/games')" class="action-btn">
          🎮 游戏列表
        </button>
        <button @click="$router.push('/server-status')" class="action-btn">
          📊 服务状态
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useDeviceStore } from '../stores/deviceStore'
import { useGameStore } from '../stores/gameStore'
import { useServiceStore } from '../stores/serviceStore'

const deviceStore = useDeviceStore()
const gameStore = useGameStore()
const serviceStore = useServiceStore()

onMounted(() => {
  // 初始化各个store
  deviceStore.initDeviceList()
  gameStore.initGameList()
})
</script>

<style scoped>
.home {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.home h1 {
  color: #2c3e50;
  margin-bottom: 20px;
  text-align: center;
}

.home > p {
  text-align: center;
  color: #7f8c8d;
  margin-bottom: 40px;
  font-size: 16px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.info-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border: 1px solid #e1e8ed;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.info-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.info-card h3 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 18px;
}

.info-card p {
  color: #5a6c7d;
  line-height: 1.6;
  margin: 0;
}

.status-overview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.status-item:last-child {
  border-bottom: none;
}

.status-label {
  color: #7f8c8d;
  font-size: 14px;
}

.status-value {
  color: #2c3e50;
  font-weight: bold;
  font-size: 16px;
}

.quick-actions {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border: 1px solid #e1e8ed;
}

.quick-actions h3 {
  color: #2c3e50;
  margin-bottom: 20px;
  text-align: center;
}

.action-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.action-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 15px 20px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.action-btn:active {
  transform: translateY(0);
}
</style>