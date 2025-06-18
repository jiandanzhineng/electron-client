<template>
  <div class="game-list">
    <div class="header">
      <div class="header-top">
        <h1>游戏列表</h1>
        <div class="custom-tip">
          如有想玩的玩法可以联系官方免费定制~QQ群970326066
        </div>
      </div>
      <div class="header-actions">
        <div class="search-box">
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="搜索游戏..."
            class="search-input"
          >
          <span class="search-icon">🔍</span>
        </div>
        <select v-model="selectedCategory" class="category-filter">
          <option value="">所有分类</option>
          <option v-for="category in gameStore.categories" :key="category" :value="category">
            {{ category }}
          </option>
        </select>
        <button @click="refreshGames" class="btn btn-secondary">
          🔄 刷新
        </button>
        <button @click="showLoadGameplayDialog" class="btn btn-success">
          📁 加载外部玩法
        </button>
      </div>
    </div>

    <!-- 游戏列表 -->
    <div class="games-container">
      <div v-if="filteredGames.length === 0" class="no-games">
        <div class="no-games-icon">🎮</div>
        <div class="no-games-text">
          {{ searchQuery || selectedCategory ? '没有找到匹配的游戏' : '暂无游戏，可以加载外部玩法开始体验' }}
        </div>
      </div>
      
      <div class="games-grid">
        <div 
          v-for="game in filteredGames" 
          :key="game.id" 
          class="game-card"
          :class="{ 
            'selected': gameStore.selectedGame?.id === game.id,
            'running': game.status === 'running'
          }"
          @click="selectGame(game)"
        >
          <div class="game-header">
            <div class="game-title">{{ game.name }}</div>
            <div class="game-actions">
              <button 
                v-if="game.status === 'stopped'"
                @click.stop="startGame(game)"
                class="btn btn-sm btn-success"
                title="启动游戏"
              >
                ▶️
              </button>
              <button 
                v-if="game.status === 'running'"
                @click.stop="pauseGame(game)"
                class="btn btn-sm btn-warning"
                title="暂停游戏"
              >
                ⏸️
              </button>
              <button 
                v-if="game.status === 'paused'"
                @click.stop="resumeGame(game)"
                class="btn btn-sm btn-success"
                title="恢复游戏"
              >
                ▶️
              </button>
              <button 
                v-if="game.status !== 'stopped'"
                @click.stop="stopGame(game)"
                class="btn btn-sm btn-danger"
                title="停止游戏"
              >
                ⏹️
              </button>
              <button 
                @click.stop="editGame(game)"
                class="btn btn-sm btn-secondary"
                title="编辑游戏"
              >
                ✏️
              </button>
              <button 
                @click.stop="removeGame(game)"
                class="btn btn-sm btn-danger"
                title="删除游戏"
              >
                🗑️
              </button>
            </div>
          </div>
          
          <div class="game-info">
            <div class="game-category">{{ game.category }}</div>
            <div class="game-status" :class="game.status">
              {{ gameStore.statusMap[game.status] }}
            </div>
          </div>
          
          <div class="game-details">
            <div class="detail-item">
              <label>路径:</label>
              <span class="game-path" :title="game.path">{{ getShortPath(game.path) }}</span>
            </div>
            <div class="detail-item" v-if="game.arguments">
              <label>参数:</label>
              <span>{{ game.arguments }}</span>
            </div>
            <div class="detail-item">
              <label>添加时间:</label>
              <span>{{ formatDate(game.createdAt) }}</span>
            </div>
            <div class="detail-item" v-if="game.lastPlayed">
              <label>最后游戏:</label>
              <span>{{ formatDate(game.lastPlayed) }}</span>
            </div>
            <div class="detail-item" v-if="game.type === 'external_gameplay' && game.requiredDevices && game.requiredDevices.length > 0">
              <label>必备设备:</label>
              <span class="device-tags">
                <span 
                  v-for="device in game.requiredDevices.filter(d => d.required)" 
                  :key="device.type" 
                  class="device-tag required"
                >
                  {{ device.type }}
                </span>
                <span v-if="game.requiredDevices.filter(d => d.required).length === 0" class="no-devices">无</span>
              </span>
            </div>
            <div class="detail-item" v-if="game.type === 'external_gameplay' && game.requiredDevices && game.requiredDevices.length > 0">
              <label>可选设备:</label>
              <span class="device-tags">
                <span 
                  v-for="device in game.requiredDevices.filter(d => !d.required)" 
                  :key="device.type" 
                  class="device-tag optional"
                >
                  {{ device.type }}
                </span>
                <span v-if="game.requiredDevices.filter(d => !d.required).length === 0" class="no-devices">无</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 移除了加载外部玩法模态框，现在直接弹出文件选择对话框 -->

    <!-- 编辑游戏模态框 -->
    <div v-if="editingGame" class="modal-overlay" @click="closeModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>编辑游戏</h2>
          <button @click="closeModal" class="modal-close">✕</button>
        </div>
        
        <div class="modal-body">
          <form @submit.prevent="saveGame">
            <div class="form-group">
              <label>游戏名称 *</label>
              <input 
                v-model="gameForm.name" 
                type="text" 
                required 
                placeholder="输入游戏名称"
              >
            </div>
            
            <div class="form-group">
              <label>游戏路径 *</label>
              <div class="path-input">
                <input 
                  v-model="gameForm.path" 
                  type="text" 
                  required 
                  placeholder="选择游戏可执行文件"
                >
                <button type="button" @click="selectGamePath" class="btn btn-secondary">
                  📁 浏览
                </button>
              </div>
            </div>
            
            <div class="form-group">
              <label>启动参数</label>
              <input 
                v-model="gameForm.arguments" 
                type="text" 
                placeholder="可选的启动参数"
              >
            </div>
            
            <div class="form-group">
              <label>游戏分类</label>
              <div class="category-input">
                <select v-model="gameForm.category">
                  <option value="">选择分类</option>
                  <option v-for="category in gameStore.categories" :key="category" :value="category">
                    {{ category }}
                  </option>
                </select>
                <input 
                  v-model="newCategory" 
                  type="text" 
                  placeholder="或输入新分类"
                  @input="gameForm.category = newCategory"
                >
              </div>
            </div>
            
            <div class="form-group">
              <label>描述</label>
              <textarea 
                v-model="gameForm.description" 
                rows="3" 
                placeholder="游戏描述（可选）"
              ></textarea>
            </div>
            
            <div class="form-actions">
              <button type="button" @click="closeModal" class="btn btn-secondary">
                取消
              </button>
              <button type="submit" class="btn btn-primary">
                {{ editingGame ? '保存' : '添加' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/gameStore'

const router = useRouter()
const gameStore = useGameStore()
const searchQuery = ref('')
const selectedCategory = ref('')
const editingGame = ref(null)
const newCategory = ref('')

// 外部玩法加载相关
const isLoadingGameplay = ref(false)

const gameForm = ref({
  name: '',
  path: '',
  arguments: '',
  category: '',
  description: ''
})

const filteredGames = computed(() => {
  let games = gameStore.games
  
  // 按搜索查询过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    games = games.filter(game => 
      game.name.toLowerCase().includes(query) ||
      game.category.toLowerCase().includes(query) ||
      (game.description && game.description.toLowerCase().includes(query))
    )
  }
  
  // 按分类过滤
  if (selectedCategory.value) {
    games = games.filter(game => game.category === selectedCategory.value)
  }
  
  return games
})

onMounted(async () => {
  gameStore.initGameList()
  // 自动加载保存在easysmart目录中的玩法
  await loadSavedGameplays()
})

function selectGame(game) {
  gameStore.selectGame(game.id)
}

async function startGame(game) {
  try {
    if (game.type === 'external_gameplay') {
      // 进入配置页面
      await gameStore.startExternalGameplayConfig(game.configPath || game.path)
      router.push('/gameplay-config')
    } else {
      gameStore.startGame(game.id)
    }
  } catch (error) {
    console.error('启动游戏失败:', error)
    alert(`启动失败: ${error.message}`)
  }
}

async function pauseGame(game) {
  try {
    if (game.type === 'external_gameplay') {
      await gameStore.pauseExternalGameplay(game.id)
    } else {
      gameStore.pauseGame(game.id)
    }
  } catch (error) {
    alert(`暂停失败: ${error.message}`)
  }
}

async function resumeGame(game) {
  try {
    if (game.type === 'external_gameplay') {
      await gameStore.resumeExternalGameplay(game.id)
    } else {
      gameStore.resumeGame(game.id)
    }
  } catch (error) {
    alert(`恢复失败: ${error.message}`)
  }
}

async function stopGame(game) {
  try {
    if (game.type === 'external_gameplay') {
      await gameStore.stopExternalGameplay(game.id)
    } else {
      gameStore.stopGame(game.id)
    }
  } catch (error) {
    alert(`停止失败: ${error.message}`)
  }
}

function editGame(game) {
  editingGame.value = game
  gameForm.value = {
    name: game.name,
    path: game.path,
    arguments: game.arguments || '',
    category: game.category,
    description: game.description || ''
  }
  newCategory.value = ''
}

function removeGame(game) {
  if (confirm(`确定要删除游戏 "${game.name}" 吗？`)) {
    gameStore.removeGame(game.id)
  }
}

function refreshGames() {
  gameStore.initGameList()
}

function closeModal() {
  editingGame.value = null
  gameForm.value = {
    name: '',
    path: '',
    arguments: '',
    category: '',
    description: ''
  }
  newCategory.value = ''
}

function saveGame() {
  const gameData = {
    ...gameForm.value,
    category: gameForm.value.category || '未分类'
  }
  
  if (editingGame.value) {
    gameStore.updateGame(editingGame.value.id, gameData)
  } else {
    gameStore.addGame(gameData)
  }
  
  closeModal()
}

function selectGamePath() {
  // 这里应该调用 Electron 的文件选择对话框
  // 暂时使用 prompt 模拟
  const path = prompt('请输入游戏可执行文件路径:')
  if (path) {
    gameForm.value.path = path
  }
}

function getShortPath(path) {
  if (!path) return ''
  const parts = path.split(/[\\/]/)
  if (parts.length > 3) {
    return `.../${parts.slice(-2).join('/')}`
  }
  return path
}

function formatDate(timestamp) {
  if (!timestamp) return '从未'
  return new Date(timestamp).toLocaleString('zh-CN')
}

function formatPlayTime(minutes) {
  if (!minutes || minutes === 0) return '0分钟'
  
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  
  if (hours > 0) {
    return `${hours}小时${mins}分钟`
  }
  return `${mins}分钟`
}

// === 外部玩法加载相关方法 ===

async function showLoadGameplayDialog() {
  // 直接调用加载外部玩法函数
  await loadExternalGameplay()
}

// 移除了不再使用的文件选择处理函数

async function loadExternalGameplay() {
  isLoadingGameplay.value = true
  
  try {
    // 直接使用Electron的文件选择对话框获取完整路径
    const result = await window.electronAPI?.invoke('show-open-dialog', {
      title: '选择外部玩法文件',
      filters: [{ name: 'JavaScript Files', extensions: ['js'] }],
      properties: ['openFile']
    })
    
    if (!result || result.canceled || !result.filePaths.length) {
      return // 用户取消选择
    }
    
    const fullPath = result.filePaths[0]
    
    // 加载外部玩法
    const config = await gameStore.loadExternalGameplay(fullPath)
    
    // 保存玩法到C:\easysmart目录
    await saveGameplayToEasySmart(fullPath, config)
    
    alert(`外部玩法 "${config.title}" 加载成功！`)
    
    // 刷新游戏列表
    refreshGames()
    
  } catch (error) {
    console.error('加载外部玩法失败:', error)
    alert(`加载失败: ${error.message}`)
  } finally {
    isLoadingGameplay.value = false
  }
}

// 移除了不再使用的cancelLoadGameplay函数

/**
 * 保存玩法到C:\easysmart目录
 * @param {string} originalPath - 原始文件路径
 * @param {Object} config - 玩法配置
 */
async function saveGameplayToEasySmart(originalPath, config) {
  try {
    const easysmartDir = 'C:\\easysmart\\gameplays'
    
    // 确保目录存在
    await window.electronAPI?.invoke('ensure-directory', easysmartDir)
    
    // 读取原始文件内容
    const fileContent = await window.electronAPI?.invoke('read-file', originalPath)
    if (!fileContent.success) {
      throw new Error(`读取原始文件失败: ${fileContent.error}`)
    }
    
    // 生成保存的文件名（使用玩法标题作为文件名）
    const safeTitle = config.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
    const savedFileName = `${safeTitle}_v${config.version || '1.0.0'}.js`
    const savedPath = `${easysmartDir}\\${savedFileName}`
    
    // 保存文件到easysmart目录
    const saveResult = await window.electronAPI?.invoke('write-file', {
      filePath: savedPath,
      content: fileContent.content
    })
    
    if (!saveResult.success) {
      throw new Error(`保存文件失败: ${saveResult.error}`)
    }
    
    // 更新gameStore中的配置路径为新的保存路径
    await gameStore.updateGameplayPath(config.title, savedPath)
    
    console.log(`玩法已保存到: ${savedPath}`)
    
    // 保存玩法索引信息
    await saveGameplayIndex(config, savedPath)
    
  } catch (error) {
    console.error('保存玩法到easysmart目录失败:', error)
    // 不抛出错误，因为这不应该阻止玩法加载
  }
}

/**
 * 保存玩法索引信息
 * @param {Object} config - 玩法配置
 * @param {string} savedPath - 保存路径
 */
async function saveGameplayIndex(config, savedPath) {
  try {
    const indexPath = 'C:\\easysmart\\gameplays\\index.json'
    
    // 读取现有索引
    let index = []
    const indexResult = await window.electronAPI?.invoke('read-file', indexPath)
    if (indexResult.success) {
      try {
        index = JSON.parse(indexResult.content)
      } catch (e) {
        console.warn('索引文件格式错误，将创建新索引')
      }
    }
    
    // 检查是否已存在同名玩法
    const existingIndex = index.findIndex(item => item.title === config.title)
    
    const gameplayInfo = {
      title: config.title,
      description: config.description,
      version: config.version || '1.0.0',
      author: config.author || '未知作者',
      filePath: savedPath,
      savedAt: new Date().toISOString(),
      requiredDevices: config.requiredDevices || []
    }
    
    if (existingIndex >= 0) {
      // 更新现有记录
      index[existingIndex] = gameplayInfo
    } else {
      // 添加新记录
      index.push(gameplayInfo)
    }
    
    // 保存索引文件
    await window.electronAPI?.invoke('write-file', {
      filePath: indexPath,
      content: JSON.stringify(index, null, 2)
    })
    
  } catch (error) {
     console.error('保存玩法索引失败:', error)
   }
 }
 
 /**
  * 自动加载保存在easysmart目录中的玩法
  */
 async function loadSavedGameplays() {
   try {
     const indexPath = 'C:\\easysmart\\gameplays\\index.json'
     
     // 读取玩法索引
     const indexResult = await window.electronAPI?.invoke('read-file', indexPath)
     if (!indexResult.success) {
       console.log('未找到保存的玩法索引文件')
       return
     }
     
     let savedGameplays = []
     try {
       savedGameplays = JSON.parse(indexResult.content)
     } catch (e) {
       console.warn('玩法索引文件格式错误')
       return
     }
     
     console.log(`发现 ${savedGameplays.length} 个保存的玩法`)
     
     // 逐个加载保存的玩法
     for (const gameplayInfo of savedGameplays) {
       try {
         // 检查文件是否存在
         const fileCheck = await window.electronAPI?.invoke('read-file', gameplayInfo.filePath)
         if (!fileCheck.success) {
           console.warn(`玩法文件不存在: ${gameplayInfo.filePath}`)
           continue
         }
         
         // 检查是否已经加载过
         const existingGame = gameStore.games.find(game => 
           game.type === 'external_gameplay' && game.name === gameplayInfo.title
         )
         
         if (!existingGame) {
           // 加载玩法
           await gameStore.loadExternalGameplay(gameplayInfo.filePath)
           console.log(`自动加载玩法: ${gameplayInfo.title}`)
         } else {
           console.log(`玩法已存在，跳过: ${gameplayInfo.title}`)
         }
         
       } catch (error) {
         console.error(`加载保存的玩法失败: ${gameplayInfo.title}`, error)
       }
     }
     
   } catch (error) {
     console.error('加载保存的玩法失败:', error)
   }
 }
</script>

<style scoped>
.game-list {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 30px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border: 1px solid #e1e8ed;
}

.custom-tip {
  background: linear-gradient(135deg, #e8f5e8, #f0f8f0);
  color: #2d5a2d;
  padding: 12px 16px;
  border-radius: 6px;
  border-left: 4px solid #27ae60;
  font-size: 14px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(39, 174, 96, 0.1);
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.header h1 {
  color: #2c3e50;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
}

.search-input {
  padding: 8px 35px 8px 12px;
  border: 1px solid #ddd;
  border-radius: 20px;
  width: 200px;
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.search-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #7f8c8d;
}

.category-filter {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background: white;
}



.games-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border: 1px solid #e1e8ed;
  padding: 20px;
}

.no-games {
  text-align: center;
  padding: 60px 20px;
  color: #7f8c8d;
}

.no-games-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.no-games-text {
  font-size: 18px;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

.game-card {
  background: #f8f9fa;
  border: 2px solid #e1e8ed;
  border-radius: 8px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.game-card:hover {
  border-color: #3498db;
  box-shadow: 0 4px 15px rgba(52, 152, 219, 0.1);
}

.game-card.selected {
  border-color: #3498db;
  background: #ebf3fd;
}

.game-card.running {
  border-color: #27ae60;
  background: #d4edda;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.game-title {
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
  flex: 1;
  margin-right: 15px;
}

.game-actions {
  display: flex;
  gap: 5px;
}

.game-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.game-category {
  background: #3498db;
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.game-status {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.game-status.stopped {
  background: #f8d7da;
  color: #721c24;
}

.game-status.running {
  background: #d4edda;
  color: #155724;
}

.game-status.paused {
  background: #fff3cd;
  color: #856404;
}

.game-status.finished {
  background: #d1ecf1;
  color: #0c5460;
}

.game-details {
  display: grid;
  gap: 8px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.detail-item label {
  font-weight: 600;
  color: #7f8c8d;
  min-width: 70px;
}

.detail-item span {
  color: #2c3e50;
  flex: 1;
}

.game-path {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  background: #f1f2f6;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
}

.device-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.device-tag {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.device-tag.required {
  background: #e74c3c;
  color: white;
}

.device-tag.optional {
  background: #f39c12;
  color: white;
}

.no-devices {
  color: #95a5a6;
  font-style: italic;
  font-size: 11px;
}

/* 模态框样式 */
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

.modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e1e8ed;
}

.modal-header h2 {
  margin: 0;
  color: #2c3e50;
}

.modal-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #7f8c8d;
  padding: 5px;
}

.modal-close:hover {
  color: #2c3e50;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 600;
  color: #2c3e50;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.path-input {
  display: flex;
  gap: 10px;
}

.path-input input {
  flex: 1;
}

.category-input {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 30px;
}

/* 按钮样式 */
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2980b9;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #7f8c8d;
}

.btn-success {
  background: #27ae60;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #229954;
}

.btn-warning {
  background: #f39c12;
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background: #e67e22;
}

.btn-danger {
  background: #e74c3c;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c0392b;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

/* 文件选择样式 */
.file-input-container {
  display: flex;
  gap: 10px;
  align-items: center;
}

.file-display {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #f8f9fa;
  min-height: 20px;
  display: flex;
  align-items: center;
}

.file-display .placeholder {
  color: #7f8c8d;
  font-style: italic;
}

.file-hint {
  font-size: 12px;
  color: #7f8c8d;
  margin-top: 5px;
  line-height: 1.4;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .header-actions {
    justify-content: center;
  }
  
  .search-input {
    width: 150px;
  }
  
  .games-grid {
    grid-template-columns: 1fr;
  }
  
  .game-header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  
  .game-actions {
    justify-content: center;
  }
}
</style>