/**
 * 问答游戏 - 支持外部题目导入的答题玩法
 * 答对进入下一题，答错电击并将题目放到后面重新回答
 */
class QAGame {
  constructor() {
    this.title = "问答游戏"
    this.description = "支持外部题目导入的答题游戏，答错会有电击惩罚"
    this.version = "1.0.0"
    this.author = "游戏设计师"
    
    // 游戏状态
    this.state = {
      questions: [],
      currentQuestionIndex: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      isGameActive: false,
      startTime: 0
    }
    
    // UI相关
    this.uiAPI = null
  }
  
  /**
   * 设备依赖配置
   */
  get requiredDevices() {
    return [
      {
        logicalId: "shock_device",
        type: "DIANJI", 
        name: "电击设备",
        required: true,
        description: "答错时执行电击惩罚"
      },
      {
        logicalId: "auto_lock",
        type: "ZIDONGSUO",
        name: "自动锁",
        required: false,
        description: "可选的锁定设备"
      }
    ]
  }
  
  /**
   * 可配置参数定义
   */
  parameters = {
    questionsFile: {
      name: '题目文件路径',
      type: 'string',
      default: 'e:/develop/electron-client/outter-game/QA-game/questions.json',
      description: '包含题目的JSON文件路径'
    },
    shockIntensity: {
      name: '电击强度',
      type: 'number',
      min: 10,
      max: 100,
      step: 5,
      default: 50,
      description: '答错时的电击强度（10-100）'
    },
    shockDuration: {
      name: '电击持续时间',
      type: 'number',
      min: 1,
      max: 10,
      step: 1,
      default: 3,
      description: '电击持续时间（秒）'
    },
    timeLimit: {
      name: '答题时间限制',
      type: 'number',
      min: 10,
      max: 300,
      step: 5,
      default: 30,
      description: '每题的答题时间限制（秒，0为无限制）'
    }
  }
  
  /**
   * 更新参数配置
   */
  updateParameters(newParams) {
    // 正确处理参数更新，保持参数结构
    for (const [key, value] of Object.entries(newParams)) {
      if (this.parameters[key]) {
        // 如果是对象类型的参数，更新其值
        if (typeof this.parameters[key] === 'object' && this.parameters[key].default !== undefined) {
          this.parameters[key] = value
        } else {
          this.parameters[key] = value
        }
      }
    }
    console.log('问答游戏参数已更新:', newParams)
  }
  
  /**
   * 游戏开始初始化
   */
  async start(deviceManager, params) {
    this.deviceManager = deviceManager
    this.updateParameters(params)
    
    // 获取UI API
    this.uiAPI = window.gameplayUI
    if (!this.uiAPI) {
      throw new Error('UI API未找到，请确保在正确的环境中运行')
    }
    
    this.log('问答游戏正在启动...', 'info')
    
    try {
      // 加载题目
      await this.loadQuestions()
      
      // 初始化游戏状态
      this.state = {
        questions: this.state.questions,
        currentQuestionIndex: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        isGameActive: true,
        startTime: Date.now()
      }
      
      // 保存初始状态
      this.saveGameState()
      
      // 渲染初始UI
      this.renderUI()
      
      this.log(`问答游戏启动成功，共加载 ${this.state.questions.length} 道题目`, 'success')
      
    } catch (error) {
      this.log(`问答游戏启动失败: ${error.message}`, 'error')
      throw error
    }
  }
  
  /**
   * 游戏循环
   */
  async loop(deviceManager) {
    if (!this.state.isGameActive) {
      return false // 游戏结束
    }
    
    // 检查是否所有题目都已完成
    if (this.state.currentQuestionIndex >= this.state.questions.length) {
      this.log('所有题目已完成！', 'success')
      this.endGame()
      return false
    }
    
    // 更新UI显示当前题目
    this.renderCurrentQuestion()
    
    return true // 继续游戏循环
  }
  
  /**
   * 加载题目文件
   */
  async loadQuestions() {
    try {
      // 获取用户配置的文件路径，如果没有则使用默认值
      const filePath = (typeof this.parameters.questionsFile === 'string') 
        ? this.parameters.questionsFile 
        : this.parameters.questionsFile.default
      
      if (!filePath) {
        throw new Error('未指定题目文件路径')
      }
      
      this.log(`正在加载题目文件: ${filePath}`, 'info')
      
      // 使用gameplayService的文件读取接口
      const content = await window.gameplayService?.readExternalFile?.(filePath)
      if (!content) {
        throw new Error('无法读取题目文件')
      }
      
      const questionsData = JSON.parse(content)
      
      if (!questionsData.questions || !Array.isArray(questionsData.questions)) {
        throw new Error('题目文件格式错误，应包含questions数组')
      }
      
      this.state.questions = questionsData.questions
      this.log(`成功加载 ${this.state.questions.length} 道题目`, 'success')
      
    } catch (error) {
      this.log(`加载题目失败: ${error.message}`, 'error')
      // 使用默认题目
      this.state.questions = this.getDefaultQuestions()
      this.log(`使用默认题目，共 ${this.state.questions.length} 道`, 'warning')
    }
  }
  
  /**
   * 获取默认题目（当文件加载失败时使用）
   */
  getDefaultQuestions() {
    return [
      {
        question: "以下哪个是JavaScript的数据类型？",
        options: ["string", "integer", "float", "char"],
        correct: 0,
        explanation: "JavaScript的基本数据类型包括string、number、boolean等"
      },
      {
        question: "Vue.js是什么？",
        options: ["数据库", "前端框架", "后端语言", "操作系统"],
        correct: 1,
        explanation: "Vue.js是一个用于构建用户界面的渐进式JavaScript框架"
      },
      {
        question: "HTTP状态码200表示什么？",
        options: ["请求失败", "服务器错误", "请求成功", "重定向"],
        correct: 2,
        explanation: "HTTP状态码200表示请求已成功处理"
      }
    ]
  }
  
  /**
   * 渲染游戏UI
   */
  renderUI() {
    const currentQuestion = this.getCurrentQuestion()
    if (!currentQuestion) {
      this.renderGameComplete()
      return
    }
    
    const html = `
      <div class="qa-game-container">
        <div class="game-header">
          <div class="progress-info">
            <span>题目进度: ${this.state.currentQuestionIndex + 1} / ${this.state.questions.length}</span>
            <span>正确: ${this.state.correctAnswers}</span>
            <span>错误: ${this.state.wrongAnswers}</span>
          </div>
        </div>
        
        <div class="question-container">
          <h3 class="question-text">${currentQuestion.question}</h3>
          
          <div class="options-container">
            ${currentQuestion.options.map((option, index) => `
              <button class="option-btn" onclick="window.gameplayUI.handleEvent('answer', ${index})">
                ${String.fromCharCode(65 + index)}. ${option}
              </button>
            `).join('')}
          </div>
        </div>
        
        <div class="game-controls">
          <button class="control-btn danger" onclick="window.gameplayUI.handleEvent('quit', null)">退出游戏</button>
        </div>
      </div>
      
      <style>
        .qa-game-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          font-family: Arial, sans-serif;
        }
        
        .game-header {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        
        .progress-info {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
        }
        
        .question-container {
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          margin-bottom: 20px;
        }
        
        .question-text {
          font-size: 1.4em;
          margin-bottom: 25px;
          color: #333;
          line-height: 1.5;
        }
        
        .options-container {
          display: grid;
          gap: 12px;
        }
        
        .option-btn {
          padding: 15px 20px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          background: white;
          cursor: pointer;
          font-size: 1.1em;
          text-align: left;
          transition: all 0.3s ease;
        }
        
        .option-btn:hover {
          border-color: #007bff;
          background: #f8f9ff;
        }
        
        .game-controls {
          display: flex;
          gap: 15px;
          justify-content: center;
        }
        
        .control-btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          background: #6c757d;
          color: white;
          cursor: pointer;
          font-size: 1em;
        }
        
        .control-btn.danger {
          background: #dc3545;
        }
        
        .control-btn:hover {
          opacity: 0.9;
        }
      </style>
    `
    
    this.uiAPI.updateUI(html, '问答游戏')
  }
  
  /**
   * 渲染当前题目
   */
  renderCurrentQuestion() {
    this.renderUI()
  }
  
  /**
   * 渲染游戏完成界面
   */
  renderGameComplete() {
    const totalTime = Math.floor((Date.now() - this.state.startTime) / 1000)
    const accuracy = this.state.correctAnswers / (this.state.correctAnswers + this.state.wrongAnswers) * 100
    
    const html = `
      <div class="qa-game-container">
        <div class="game-complete">
          <h2>🎉 游戏完成！</h2>
          <div class="stats">
            <div class="stat-item">
              <span class="stat-label">总题数:</span>
              <span class="stat-value">${this.state.questions.length}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">正确答案:</span>
              <span class="stat-value correct">${this.state.correctAnswers}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">错误答案:</span>
              <span class="stat-value wrong">${this.state.wrongAnswers}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">正确率:</span>
              <span class="stat-value">${accuracy.toFixed(1)}%</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">用时:</span>
              <span class="stat-value">${totalTime}秒</span>
            </div>
          </div>
        </div>
      </div>
      
      <style>
        .game-complete {
          text-align: center;
          padding: 40px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .game-complete h2 {
          color: #28a745;
          margin-bottom: 30px;
        }
        
        .stats {
          display: grid;
          gap: 15px;
          max-width: 400px;
          margin: 0 auto;
        }
        
        .stat-item {
          display: flex;
          justify-content: space-between;
          padding: 10px 15px;
          background: #f8f9fa;
          border-radius: 6px;
        }
        
        .stat-label {
          font-weight: bold;
        }
        
        .stat-value.correct {
          color: #28a745;
        }
        
        .stat-value.wrong {
          color: #dc3545;
        }
      </style>
    `
    
    this.uiAPI.updateUI(html, '游戏完成')
  }
  
  /**
   * 获取当前题目
   */
  getCurrentQuestion() {
    if (this.state.currentQuestionIndex < this.state.questions.length) {
      return this.state.questions[this.state.currentQuestionIndex]
    }
    return null
  }
  
  /**
   * 处理UI事件
   */
  handleUIEvent(eventType, data) {
    switch (eventType) {
      case 'answer':
        this.handleAnswer(data)
        break
      case 'quit':
        this.quitGame()
        break
    }
  }
  
  /**
   * 处理答题
   */
  async handleAnswer(selectedIndex) {
    const currentQuestion = this.getCurrentQuestion()
    if (!currentQuestion) return
    
    const isCorrect = selectedIndex === currentQuestion.correct
    
    if (isCorrect) {
      this.state.correctAnswers++
      this.state.currentQuestionIndex++
      this.log(`回答正确！${currentQuestion.explanation || ''}`, 'success')
    } else {
      this.state.wrongAnswers++
      this.log(`回答错误！正确答案是: ${currentQuestion.options[currentQuestion.correct]}`, 'error')
      
      // 执行电击惩罚
      await this.executeShockPunishment()
      
      // 将错误的题目移到队列末尾
      const wrongQuestion = this.state.questions.splice(this.state.currentQuestionIndex, 1)[0]
      this.state.questions.push(wrongQuestion)
      
      this.log('该题目已移至队列末尾，稍后重新回答', 'warning')
    }
    
    // 保存游戏状态
    this.saveGameState()
    
    // 更新UI
    setTimeout(() => {
      this.renderUI()
    }, 2000)
  }
  
  /**
   * 执行电击惩罚
   */
  async executeShockPunishment() {
    try {
      const intensity = this.parameters.shockIntensity.default
      const duration = this.parameters.shockDuration.default
      
      this.log(`执行电击惩罚 - 强度: ${intensity}, 持续: ${duration}秒`, 'warning')
      
      // 发送电击命令
      await this.deviceManager.setDeviceProperty('shock_device', {
        intensity: intensity,
        duration: duration * 1000,
        active: 1
      })
      
      this.log('电击惩罚执行完成', 'info')
      
    } catch (error) {
      this.log(`电击惩罚执行失败: ${error.message}`, 'error')
    }
  }
  

  
  /**
   * 退出游戏
   */
  quitGame() {
    this.log('游戏已退出', 'info')
    this.endGame()
  }
  
  /**
   * 结束游戏
   */
  endGame() {
    this.state.isGameActive = false
    this.renderGameComplete()
    this.saveGameState()
    this.log('问答游戏结束', 'info')
  }
  
  /**
   * 保存游戏状态
   */
  saveGameState() {
    if (window.gameplayService?.saveGameState) {
      window.gameplayService.saveGameState('qa_game', this.state)
    }
  }
  
  /**
   * 加载游戏状态
   */
  loadGameState() {
    if (window.gameplayService?.loadGameState) {
      const savedState = window.gameplayService.loadGameState('qa_game')
      if (savedState) {
        this.state = { ...this.state, ...savedState }
        this.log('游戏状态已恢复', 'info')
      }
    }
  }
  
  /**
   * 发送日志
   */
  log(message, level = 'info') {
    if (this.uiAPI && this.uiAPI.addLog) {
      this.uiAPI.addLog(message, level)
    } else {
      console.log(`[QA-GAME ${level.toUpperCase()}] ${message}`)
    }
  }
  
  /**
   * 暂停游戏
   */
  pause() {
    this.state.isGameActive = false
    this.log('游戏已暂停', 'warning')
  }
  
  /**
   * 恢复游戏
   */
  resume() {
    this.state.isGameActive = true
    this.log('游戏已恢复', 'success')
  }
  
  /**
   * 停止游戏
   */
  stop() {
    this.endGame()
  }
}

// 默认导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QAGame
} else {
  window.QAGame = QAGame
}