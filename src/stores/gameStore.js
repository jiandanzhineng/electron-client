import { defineStore } from 'pinia'

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
      { id: 'other', name: '其他', icon: '🎮' }
    ],
    gameStatus: {
      'idle': '空闲',
      'running': '运行中',
      'paused': '暂停',
      'finished': '已结束',
      'error': '错误'
    }
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
        status: 'idle',
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
        game.status = 'idle'
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
    }
  }
})