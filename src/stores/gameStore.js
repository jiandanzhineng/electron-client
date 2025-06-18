import { defineStore } from 'pinia'
import { gameplayService } from '@/services/gameplayService'

export const useGameStore = defineStore('game', {
  state: () => ({
    games: [],
    selectedGameId: null,
    gameCategories: [
      { id: 'puzzle', name: '益智游戏', icon: '🧩' },
      { id: 'action', name: '动作游戏', icon: '⚡' },
      { id: 'strategy', name: '策略游戏', icon: '🎯' },
      { id: 'educational', name: '教育游戏', icon: '📚' },
      { id: 'multiplayer', name: '多人游戏', icon: '👥' },
      { id: 'external', name: '外部玩法', icon: '📁' },
      { id: 'other', name: '其他', icon: '🎮' }
    ],
    gameStatus: {
      'idle': '空闲',
      'running': '运行中',
      'paused': '暂停',
      'finished': '已结束',
      'error': '错误'
    },
    // 外部玩法相关
    gameplayService: gameplayService,
    loadedGameplays: [],
    currentGameplayConfig: null
  }),

  getters: {
    getGameById: (state) => (id) => {
      return state.games.find(game => game.id === id)
    },
    
    getGamesByCategory: (state) => (category) => {
      return state.games.filter(game => game.category === category)
    },
    
    runningGames: (state) => {
      return state.games.filter(game => game.status === 'running')
    },
    
    getCategoryName: (state) => (categoryId) => {
      const category = state.gameCategories.find(cat => cat.id === categoryId)
      return category ? category.name : '未知分类'
    },
    
    getCategoryIcon: (state) => (categoryId) => {
      const category = state.gameCategories.find(cat => cat.id === categoryId)
      return category ? category.icon : '🎮'
    },
    
    categories: (state) => {
      return state.gameCategories.map(cat => cat.id)
    },
    
    statusMap: (state) => {
      return state.gameStatus
    }
  },

  actions: {
    // 初始化游戏列表
    initGameList() {
      const savedGames = localStorage.getItem('games')
      if (savedGames) {
        try {
          this.games = JSON.parse(savedGames)
        } catch (error) {
          console.error('Failed to load games from localStorage:', error)
          this.loadDefaultGames()
        }
      } else {
        this.loadDefaultGames()
      }
    },

    // 加载默认游戏列表
    loadDefaultGames() {
      this.games = [
        {
          id: 'puzzle-1',
          name: '数字拼图',
          description: '经典的数字滑块拼图游戏',
          category: 'puzzle',
          status: 'idle',
          players: 1,
          difficulty: 'easy',
          createdAt: Date.now(),
          lastPlayed: null
        },
        {
          id: 'action-1',
          name: '反应测试',
          description: '测试你的反应速度',
          category: 'action',
          status: 'idle',
          players: 1,
          difficulty: 'medium',
          createdAt: Date.now(),
          lastPlayed: null
        },
        {
          id: 'multiplayer-1',
          name: '多人问答',
          description: '支持多人同时参与的问答游戏',
          category: 'multiplayer',
          status: 'idle',
          players: 4,
          difficulty: 'medium',
          createdAt: Date.now(),
          lastPlayed: null
        }
      ]
      this.saveGames()
    },

    // 添加游戏
    addGame(gameData) {
      const newGame = {
        id: `game-${Date.now()}`,
        name: gameData.name,
        description: gameData.description || '',
        category: gameData.category || 'other',
        status: gameData.status || 'stopped',
        players: gameData.players || 1,
        difficulty: gameData.difficulty || 'medium',
        createdAt: Date.now(),
        lastPlayed: null,
        ...gameData
      }
      
      this.games.push(newGame)
      this.saveGames()
    },

    // 删除游戏
    removeGame(gameId) {
      const index = this.games.findIndex(game => game.id === gameId)
      if (index !== -1) {
        this.games.splice(index, 1)
        this.saveGames()
        
        if (this.selectedGameId === gameId) {
          this.selectedGameId = null
        }
      }
    },

    // 更新游戏信息
    updateGame(gameId, updates) {
      const game = this.getGameById(gameId)
      if (game) {
        Object.assign(game, updates)
        this.saveGames()
      }
    },

    // 启动游戏
    startGame(gameId) {
      const game = this.getGameById(gameId)
      if (game && game.status !== 'running') {
        game.status = 'running'
        game.lastPlayed = Date.now()
        this.selectedGameId = gameId
        this.saveGames()
      }
    },

    // 暂停游戏
    pauseGame(gameId) {
      const game = this.getGameById(gameId)
      if (game && game.status === 'running') {
        game.status = 'paused'
        this.saveGames()
      }
    },

    // 恢复游戏
    resumeGame(gameId) {
      const game = this.getGameById(gameId)
      if (game && game.status === 'paused') {
        game.status = 'running'
        this.saveGames()
      }
    },

    // 结束游戏
    finishGame(gameId) {
      const game = this.getGameById(gameId)
      if (game) {
        game.status = 'finished'
        this.saveGames()
        
        // 3秒后自动重置为空闲状态
        setTimeout(() => {
          if (game.status === 'finished') {
            game.status = 'idle'
            this.saveGames()
          }
        }, 3000)
      }
    },

    // 停止游戏
    stopGame(gameId) {
      const game = this.getGameById(gameId)
      if (game) {
        game.status = 'stopped'
        this.saveGames()
        
        if (this.selectedGameId === gameId) {
          this.selectedGameId = null
        }
      }
    },

    // 选择游戏
    selectGame(gameId) {
      this.selectedGameId = gameId
    },

    // 保存游戏到本地存储
    saveGames() {
      try {
        localStorage.setItem('games', JSON.stringify(this.games))
      } catch (error) {
        console.error('Failed to save games to localStorage:', error)
      }
    },

    // 获取游戏统计信息
    getGameStats() {
      return {
        total: this.games.length,
        running: this.runningGames.length,
        byCategory: this.gameCategories.map(category => ({
          ...category,
          count: this.getGamesByCategory(category.id).length
        }))
      }
    },

    // === 外部玩法相关方法 ===
    
    /**
     * 加载外部玩法文件
     * @param {string} filePath - 玩法文件路径
     */
    async loadExternalGameplay(filePath) {
      try {
        console.log('正在加载外部玩法:', filePath)
        const config = await this.gameplayService.loadGameplayFromJS(filePath)
        this.currentGameplayConfig = config
        // 保存到 sessionStorage 以防热更新时丢失
        sessionStorage.setItem('currentGameplayConfig', JSON.stringify(config))
        
        // 检查是否已经存在同名游戏
        const existingGame = this.games.find(game => 
          game.type === 'external_gameplay' && game.name === config.title
        )
        
        if (existingGame) {
          // 更新现有游戏
          this.updateGame(existingGame.id, {
            description: config.description,
            configPath: filePath,
            requiredDevices: config.requiredDevices,
            version: config.version,
            author: config.author
          })
          console.log('已更新现有外部玩法:', config.title)
        } else {
          // 添加新游戏
          const gameData = {
            name: config.title,
            description: config.description,
            category: 'external',
            type: 'external_gameplay',
            status: 'stopped',
            configPath: filePath,
            requiredDevices: config.requiredDevices,
            version: config.version || '1.0.0',
            author: config.author || '未知作者'
          }
          
          this.addGame(gameData)
          console.log('已添加新外部玩法:', config.title)
        }
        
        return config
      } catch (error) {
        console.error('加载外部玩法失败:', error)
        throw error
      }
    },
    
    /**
     * 更新玩法路径
     * @param {string} title - 玩法标题
     * @param {string} newPath - 新的文件路径
     */
    async updateGameplayPath(title, newPath) {
      try {
        const game = this.games.find(game => 
          game.type === 'external_gameplay' && game.name === title
        )
        
        if (game) {
          this.updateGame(game.id, {
            configPath: newPath
          })
          console.log(`已更新玩法路径: ${title} -> ${newPath}`)
        }
      } catch (error) {
        console.error('更新玩法路径失败:', error)
      }
    },
    
    /**
     * 启动外部玩法配置
     * @param {string} filePath - 玩法文件路径
     */
    async startExternalGameplayConfig(filePath) {
      try {
        const gameplay = await gameplayService.loadGameplayFromJS(filePath)
        this.currentGameplayConfig = {
          title: gameplay.title || gameplay.name || '外部玩法',
          description: gameplay.description || '外部玩法配置',
          requiredDevices: gameplay.requiredDevices || [],
          parameters: gameplay.parameters || {},
          gameplay,
          filePath
        }
        // 保存到 sessionStorage 以防热更新时丢失
        sessionStorage.setItem('currentGameplayConfig', JSON.stringify(this.currentGameplayConfig))
        return this.currentGameplayConfig
      } catch (error) {
        console.error('加载外部玩法配置失败:', error)
        throw error
      }
    },
    
    /**
     * 启动外部玩法（配置完成后）
     * @param {Object} deviceMapping - 设备映射
     * @param {Object} parameters - 参数
     */
    async startExternalGameplay(deviceMapping, parameters) {
      try {
        if (!this.currentGameplayConfig) {
          throw new Error('没有准备好的玩法配置')
        }
        
        // 应用设备映射和参数
        this.gameplayService.applyDeviceMapping(deviceMapping)
        this.gameplayService.applyParameters(parameters)
        
        // 启动玩法
        await this.gameplayService.startGameplay()
        
        // 更新游戏状态
        this.startGame(this.currentGameplayConfig.gameId)
        
        console.log('外部玩法启动成功:', this.currentGameplayConfig.config.title)
      } catch (error) {
        console.error('启动外部玩法失败:', error)
        throw error
      }
    },
    
    /**
     * 暂停外部玩法
     * @param {string} gameId - 游戏ID
     */
    async pauseExternalGameplay(gameId) {
      const game = this.getGameById(gameId)
      if (game && game.type === 'external_gameplay') {
        try {
          await this.gameplayService.pauseGameplay()
          this.pauseGame(gameId)
          console.log('外部玩法已暂停:', game.name)
        } catch (error) {
          console.error('暂停外部玩法失败:', error)
          throw error
        }
      }
    },
    
    /**
     * 恢复外部玩法
     * @param {string} gameId - 游戏ID
     */
    async resumeExternalGameplay(gameId) {
      const game = this.getGameById(gameId)
      if (game && game.type === 'external_gameplay') {
        try {
          await this.gameplayService.resumeGameplay()
          this.resumeGame(gameId)
          console.log('外部玩法已恢复:', game.name)
        } catch (error) {
          console.error('恢复外部玩法失败:', error)
          throw error
        }
      }
    },
    
    /**
     * 停止外部玩法
     * @param {string} gameId - 游戏ID
     */
    async stopExternalGameplay(gameId) {
      const game = this.getGameById(gameId)
      if (game && game.type === 'external_gameplay') {
        try {
          await this.gameplayService.endGameplay()
          this.stopGame(gameId)
          console.log('外部玩法已停止:', game.name)
        } catch (error) {
          console.error('停止外部玩法失败:', error)
          // 即使停止失败，也要重置游戏状态
          this.stopGame(gameId)
          throw error
        }
      }
    },
    
    /**
     * 获取外部玩法状态
     */
    getExternalGameplayStatus() {
      return this.gameplayService.getGameplayStatus()
    },
    
    /**
     * 检查外部玩法的设备依赖
     * @param {string} gameId - 游戏ID
     */
    checkExternalGameplayDevices(gameId) {
      const game = this.getGameById(gameId)
      if (!game || game.type !== 'external_gameplay' || !game.requiredDevices) {
        return { valid: false, missing: [], optional: [] }
      }
      
      // 这里需要导入deviceStore来检查设备
      // 为了避免循环依赖，我们返回设备需求信息，让UI层处理
      return {
        valid: true,
        required: game.requiredDevices.filter(d => d.required),
        optional: game.requiredDevices.filter(d => !d.required),
        all: game.requiredDevices
      }
    }
  }
})