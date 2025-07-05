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
    // 初始化游戏商店
    async init() {
      this.loadGames()
      if (this.games.length === 0) {
        await this.loadDefaultGames()
      }
    },

    // 加载游戏列表
    loadGames() {
      const savedGames = localStorage.getItem('games')
      if (savedGames) {
        try {
          this.games = JSON.parse(savedGames)
        } catch (error) {
          console.error('Failed to load games from localStorage:', error)
          this.games = []
        }
      } else {
        this.games = []
      }
    },

    // 加载默认游戏列表
    async loadDefaultGames() {
      this.games = []
      
      // 动态加载outter-game目录下的所有玩法
      await this.loadAllGameplaysFromDirectory()
      
      this.saveGames()
    },
    
    /**
     * 从outter-game目录加载所有玩法文件
     */
    async loadAllGameplaysFromDirectory() {
      try {
        // 获取应用路径信息
        const pathInfo = await this.getAppPath()
        
        // 根据环境选择正确的路径
        let outterGamePath
        if (import.meta.env.DEV) {
          // 开发环境：直接从项目目录加载
          outterGamePath = `${pathInfo.appPath}/outter-game`
        } else {
          // 生产环境：从extraResources加载
          outterGamePath = `${pathInfo.resourcesPath}/outter-game`
        }
        
        console.log(`扫描玩法目录: ${outterGamePath}`)
        
        // 通过IPC获取目录下的所有JS文件
        const gameplayFiles = await this.scanGameplayDirectory(outterGamePath)
        
        for (const filePath of gameplayFiles) {
          try {
            await this.loadGameplayFromFile(filePath)
          } catch (error) {
            console.warn(`加载玩法失败: ${filePath}`, error)
            // 加载失败时跳过，不影响其他玩法的加载
          }
        }
      } catch (error) {
        console.error('扫描玩法目录失败:', error)
      }
    },
    
    /**
     * 扫描玩法目录获取所有JS文件
     * @param {string} directoryPath - 目录路径
     */
    async scanGameplayDirectory(directoryPath) {
      try {
        // 通过IPC调用主进程扫描目录
        const files = await window.electronAPI?.scanGameplayDirectory(directoryPath)
        return files || []
      } catch (error) {
        console.error('扫描玩法目录失败:', error)
        return []
      }
    },
    
    /**
     * 从文件路径加载玩法
     * @param {string} filePath - 玩法文件的完整路径
     */
    async loadGameplayFromFile(filePath) {
      try {
        console.log(`尝试加载玩法: ${filePath}`)
        
        // 通过gameplayService加载玩法配置
        const config = await this.gameplayService.loadGameplayFromJS(filePath)
        
        if (!config) {
          throw new Error('加载玩法配置失败')
        }
        
        // 从完整路径生成相对路径用于ID生成
        const relativePath = this.getRelativePathFromFull(filePath)
        const gameId = this.generateGameIdFromPath(relativePath)
        
        // 检查是否已存在同ID的游戏
        const existingGame = this.games.find(game => game.id === gameId)
        if (existingGame) {
          console.log(`跳过已存在的玩法: ${config.title}`)
          return
        }
        
        // 创建游戏配置
        const gameData = {
          id: gameId,
          name: config.title,
          description: config.description,
          category: 'external',
          type: 'external_gameplay',
          status: 'stopped',
          configPath: filePath,
          version: config.version || '1.0.0',
          author: config.author || '未知作者',
          requiredDevices: config.requiredDevices || [],
          createdAt: Date.now(),
          lastPlayed: null
        }
        
        this.games.push(gameData)
        console.log(`成功加载玩法: ${config.title}`)
        
      } catch (error) {
        console.error(`加载玩法失败 ${filePath}:`, error)
        throw error
      }
    },
    
    /**
     * 从完整路径提取相对于outter-game的路径
     * @param {string} fullPath - 完整文件路径
     */
    getRelativePathFromFull(fullPath) {
      const outterGameIndex = fullPath.indexOf('outter-game')
      if (outterGameIndex !== -1) {
        return fullPath.substring(outterGameIndex + 'outter-game'.length + 1)
      }
      // 如果找不到outter-game，使用文件名
      return fullPath.split(/[\\/]/).pop()
    },
    
    /**
     * 获取应用路径（兼容开发和打包环境）
     */
    async getAppPath() {
      try {
        // 通过IPC获取应用路径和资源路径
        const pathInfo = await window.electronAPI?.invoke('get-app-paths')
        if (pathInfo) {
          return pathInfo
        }
      } catch (error) {
        console.warn('无法通过IPC获取应用路径，使用默认路径')
      }
      
      // 开发环境下的默认路径
      if (import.meta.env.DEV) {
        return {
          appPath: 'e:/develop/electron-client',
          resourcesPath: 'e:/develop/electron-client'
        }
      }
      
      // 生产环境下的默认路径（相对于应用安装目录）
      return {
        appPath: './',
        resourcesPath: './'
      }
    },
    
    /**
     * 从路径生成游戏ID
     * @param {string} path - 玩法文件路径
     */
    generateGameIdFromPath(path) {
      return path
        .replace(/\.js$/, '')
        .replace(/\//g, '-')
        .replace(/\\/g, '-')
        .toLowerCase()
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
     * 加载外部玩法文件（复制到outter-game目录）
     * @param {string} filePath - 玩法文件路径
     */
    async loadExternalGameplay(filePath) {
      try {
        console.log('正在加载外部玩法:', filePath)
        
        // 首先加载配置以获取玩法信息
        const config = await this.gameplayService.loadGameplayFromJS(filePath)
        this.currentGameplayConfig = config
        
        // 保存到 sessionStorage 以防热更新时丢失
        sessionStorage.setItem('currentGameplayConfig', JSON.stringify(config))
        
        // 复制文件到outter-game目录
        const copiedFilePath = await this.copyGameplayToOutterGame(filePath, config.title)
        
        // 检查是否已经存在同名游戏
        const existingGame = this.games.find(game => 
          game.type === 'external_gameplay' && game.name === config.title
        )
        
        if (existingGame) {
          // 更新现有游戏
          this.updateGame(existingGame.id, {
            description: config.description,
            configPath: copiedFilePath,
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
            configPath: copiedFilePath,
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
     * 复制玩法文件到outter-game目录
     * @param {string} sourcePath - 源文件路径
     * @param {string} gameplayTitle - 玩法标题
     */
    async copyGameplayToOutterGame(sourcePath, gameplayTitle) {
      try {
        // 获取应用路径信息
        const pathInfo = await this.getAppPath()
        
        // 根据环境选择正确的目标路径
        let outterGamePath
        if (import.meta.env.DEV) {
          outterGamePath = `${pathInfo.appPath}/outter-game`
        } else {
          outterGamePath = `${pathInfo.resourcesPath}/outter-game`
        }
        
        // 生成安全的文件名
        const safeFileName = this.generateSafeFileName(gameplayTitle)
        const targetPath = `${outterGamePath}/${safeFileName}.js`
        
        // 通过IPC调用主进程复制文件
         await window.electronAPI?.copyGameplayFile(sourcePath, targetPath)
        
        console.log(`玩法文件已复制到: ${targetPath}`)
        return targetPath
      } catch (error) {
        console.error('复制玩法文件失败:', error)
        throw error
      }
    },
    
    /**
     * 生成安全的文件名
     * @param {string} title - 玩法标题
     */
    generateSafeFileName(title) {
      return title
        .replace(/[^a-zA-Z0-9\u4e00-\u9fa5\-_]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_|_$/g, '')
        .toLowerCase()
    },
    
    /**
     * 刷新玩法列表（删除旧数据，重新扫描outter-game目录）
     */
    async refreshGameplayList() {
      try {
        console.log('开始刷新玩法列表...')
        
        // 删除所有外部玩法类型的游戏
        this.games = this.games.filter(game => game.type !== 'external_gameplay')
        
        // 重新扫描并加载outter-game目录下的所有玩法
        await this.loadAllGameplaysFromDirectory()
        
        // 保存更新后的游戏列表
        this.saveGames()
        
        console.log('玩法列表刷新完成')
      } catch (error) {
        console.error('刷新玩法列表失败:', error)
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