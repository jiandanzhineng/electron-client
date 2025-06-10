<template>
  <div class="game-list">
    <div class="header">
      <h1>游戏列表</h1>
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
        <button @click="showAddGameModal = true" class="btn btn-primary">
          ➕ 添加游戏
        </button>
        <button @click="refreshGames" class="btn btn-secondary">
          🔄 刷新
        </button>
      </div>
    </div>

    <!-- 游戏统计 -->
    <div class="stats-section">
      <div class="stat-card">
        <div class="stat-number">{{ gameStore.games.length }}</div>
        <div class="stat-label">总游戏数</div>
      </div>
      <div class="stat-card running">
        <div class="stat-number">{{ gameStore.runningGames.length }}</div>
        <div class="stat-label">运行中</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ gameStore.categories.length }}</div>
        <div class="stat-label">分类数</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ getAveragePlayTime() }}</div>
        <div class="stat-label">平均游戏时长</div>
      </div>
    </div>

    <!-- 游戏列表 -->
    <div class="games-container">
      <div v-if="filteredGames.length === 0" class="no-games">
        <div class="no-games-icon">🎮</div>
        <div class="no-games-text">
          {{ searchQuery || selectedCategory ? '没有找到匹配的游戏' : '暂无游戏，点击添加游戏开始' }}
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
            <div class="detail-item">
              <label>游戏时长:</label>
              <span>{{ formatPlayTime(game.totalPlayTime) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加/编辑游戏模态框 -->
    <div v-if="showAddGameModal || editingGame" class="modal-overlay" @click="closeModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>{{ editingGame ? '编辑游戏' : '添加游戏' }}</h2>
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
import { useGameStore } from '../stores/gameStore'

const gameStore = useGameStore()
const searchQuery = ref('')
const selectedCategory = ref('')
const showAddGameModal = ref(false)
const editingGame = ref(null)
const newCategory = ref('')

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

onMounted(() => {
  gameStore.initGameList()
})

function selectGame(game) {
  gameStore.selectGame(game.id)
}

function startGame(game) {
  gameStore.startGame(game.id)
}

function pauseGame(game) {
  gameStore.pauseGame(game.id)
}

function resumeGame(game) {
  gameStore.resumeGame(game.id)
}

function stopGame(game) {
  gameStore.stopGame(game.id)
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
  showAddGameModal.value = false
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

function getAveragePlayTime() {
  const games = gameStore.games
  if (games.length === 0) return '0分钟'
  
  const totalTime = games.reduce((sum, game) => sum + (game.totalPlayTime || 0), 0)
  const avgTime = Math.round(totalTime / games.length)
  
  return formatPlayTime(avgTime)
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
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e1e8ed;
  flex-wrap: wrap;
  gap: 15px;
}

.header h1 {
  color: #2c3e50;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
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

.stats-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border: 1px solid #e1e8ed;
  text-align: center;
}

.stat-card.running {
  background: linear-gradient(135deg, #d4edda, #c3e6cb);
}

.stat-number {
  font-size: 32px;
  font-weight: bold;
  color: #2c3e50;
  margin-bottom: 8px;
}

.stat-label {
  color: #7f8c8d;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
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

/* 响应式设计 */
@media (max-width: 768px) {
  .header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .header-actions {
    justify-content: center;
  }
  
  .search-input {
    width: 150px;
  }
  
  .games-grid {
    grid-template-columns: 1fr;
  }
  
  .stats-section {
    grid-template-columns: repeat(2, 1fr);
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