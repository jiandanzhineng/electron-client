<template>
  <div class="home">
    <h1>欢迎使用简单智能控制终端</h1>
    <p>官方网站 easysmart.top 支持nodejs python开发更多可用程序</p>
    
    <div class="info-grid">
      <div class="info-card documentation-card">
        <h3>📚 项目文档</h3>
        <p>
          详细的使用文档和开发指南请访问：
          <br>
          <a href="https://easysmart.top" target="_blank" rel="noopener noreferrer" @click="openInBrowser" class="doc-link">
            🌐 easysmart.top
          </a>
          <br>
          <small>包含API文档、设备配置、游戏开发等完整教程</small>
        </p>
      </div>
      
      <div class="info-card">
        <h3>🚀 交流社群</h3>
        <p>QQ群970326066 欢迎大家交流使用心得 开发更多玩法</p>
        <div class="social-buttons">
          <a href="https://t.me/jiandanzhineng" target="_blank" rel="noopener noreferrer" @click="openInBrowser" class="social-btn tg-btn">
            📱 TG频道
          </a>
          <a href="https://x.com/lufashi181845" target="_blank" rel="noopener noreferrer" @click="openInBrowser" class="social-btn twitter-btn">
            🐦 推特
          </a>
        </div>
      </div>
      
      <div class="info-card">
        <h3>⚡ 淘宝店铺</h3>
        <p>
          <a href="https://shop282688998.taobao.com/" target="_blank" rel="noopener noreferrer" @click="openInBrowser">
            点击访问淘宝店铺
          </a>
          在售卖的商品：简单智能电击终端，锁定终端，跳蛋控制终端
        </p>
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

// 打开外部浏览器
const openInBrowser = async (event) => {
  event.preventDefault() // 阻止默认行为
  const url = event.target.href || event.target.closest('a').href
  try {
    await window.electronAPI.openExternalUrl(url)
  } catch (error) {
    console.error('打开外部链接失败:', error)
  }
}

onMounted(async () => {
  // 初始化各个store
  deviceStore.initDeviceList()
  await gameStore.init()
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

/* 文档说明框特殊样式 */
.documentation-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
}

.documentation-card h3 {
  color: white;
  margin-bottom: 15px;
}

.documentation-card p {
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.8;
}

.doc-link {
  color: #ffd700;
  text-decoration: none;
  font-weight: bold;
  font-size: 18px;
  display: inline-block;
  margin: 8px 0;
  transition: all 0.3s ease;
}

.doc-link:hover {
  color: #ffed4e;
  text-shadow: 0 0 8px rgba(255, 215, 0, 0.6);
  transform: scale(1.05);
}

.documentation-card small {
  color: rgba(255, 255, 255, 0.8);
  font-style: italic;
}

/* QQ群卡片特殊样式 */
.info-card:nth-child(2) {
  background: linear-gradient(135deg, #00c6ff 0%, #0072ff 100%);
  color: white;
  border: none;
}

.info-card:nth-child(2) h3 {
  color: white;
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-card:nth-child(2) p {
  color: rgba(255, 255, 255, 0.9);
  font-size: 16px;
  font-weight: 500;
}

.social-buttons {
  display: flex;
  gap: 12px;
  margin-top: 15px;
  flex-wrap: wrap;
}

.social-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 20px;
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.tg-btn {
  background: linear-gradient(135deg, #0088cc 0%, #229ed9 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(0, 136, 204, 0.3);
}

.tg-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 136, 204, 0.4);
  background: linear-gradient(135deg, #229ed9 0%, #0088cc 100%);
}

.twitter-btn {
  background: linear-gradient(135deg, #1da1f2 0%, #0d8bd9 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(29, 161, 242, 0.3);
}

.twitter-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(29, 161, 242, 0.4);
  background: linear-gradient(135deg, #0d8bd9 0%, #1da1f2 100%);
}

/* 淘宝店铺卡片特殊样式 */
.info-card:nth-child(3) {
  background: linear-gradient(135deg, #e67e22 0%, #d35400 100%);
  color: white;
  border: none;
}

.info-card:nth-child(3) h3 {
  color: white;
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-card:nth-child(3) p {
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.6;
}

.info-card:nth-child(3) a {
  color: #ffd700;
  text-decoration: none;
  font-weight: bold;
  display: inline-block;
  margin: 8px 0;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  transition: all 0.3s ease;
  border: 2px solid rgba(255, 215, 0, 0.5);
}

.info-card:nth-child(3) a:hover {
  background: rgba(255, 215, 0, 0.2);
  border-color: #ffd700;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3);
}
</style>