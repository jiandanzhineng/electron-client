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
    
    // 当前配置的参数值
    this.config = {
      questionsFile: '<OUTTER_GAME>/QA-game/女仆行为规范考核题库.json',
      shockIntensity: 50,
      shockDuration: 3,
      timeLimit: 30,
      manualStart: false
    }
    
    // 游戏状态
    this.state = {
      questions: [],
      currentQuestionIndex: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      isGameActive: false,
      startTime: 0,
      questionStartTime: 0,
      remainingTime: 0,
      // QTZ设备相关状态
      selectedOptionIndex: 0, // 默认选择第一项
      qtzButton0Pressed: false,
      qtzButton1Pressed: false,
      // 手动开启相关状态
      waitingForManualStart: false
    }
    
    // UI相关
    this.uiAPI = null
    this.timerInterval = null
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
        name: "自动锁设备",
        required: false,
        description: "可选的自动锁设备，用于手动开启游戏"
      },
      {
        logicalId: "qtz_sensor",
        type: "QTZ",
        name: "QTZ按键设备",
        required: false,
        description: "可选的按键设备，用于代替鼠标选择答案"
      }
    ]
  }
  
  /**
   * 可配置参数定义
   */
  parameters = {
    questionsFile: {
      name: '题目文件路径',
      type: 'file',
      default: '<OUTTER_GAME>/QA-game/女仆行为规范考核题库.json',
      description: '包含题目的JSON文件路径，支持<OUTTER_GAME>标记指向打包后的outter-game文件夹',
      fileFilter: {
        name: 'JSON文件',
        extensions: ['json']
      }
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
    },
    manualStart: {
      name: '手动开启',
      type: 'boolean',
      default: false,
      description: '启用后，游戏加载完成后等待auto_lock设备的按键点击消息才开始游戏'
    }
  }
  
  /**
   * 更新参数配置
   */
  updateParameters(newParams) {
    for (const [key, value] of Object.entries(newParams)) {
      if (this.config.hasOwnProperty(key)) {
        this.config[key] = value
      }
    }
    console.log('问答游戏参数已更新:', newParams)
    console.log('当前配置:', this.config)
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
        isGameActive: !this.config.manualStart, // 如果是手动开启，则先不激活游戏
        startTime: Date.now(),
        questionStartTime: Date.now(),
        remainingTime: this.config.timeLimit,
        // QTZ设备相关状态
        selectedOptionIndex: 0, // 默认选择第一项
        qtzButton0Pressed: false,
        qtzButton1Pressed: false,
        // 手动开启相关状态
        waitingForManualStart: this.config.manualStart
      }
      
      // 设置QTZ设备监听
      this.setupQTZButtonListener()
      
      // 如果启用手动开启，设置auto_lock设备消息监听
      let manualStartEnabled = false
      if (this.config.manualStart) {
        manualStartEnabled = this.setupManualStartListener()
        if (manualStartEnabled) {
          this.log('手动开启模式已启用，等待auto_lock设备的按键点击消息...', 'info')
        } else {
          this.log('auto_lock设备未映射，自动切换为立即开始模式', 'warning')
          this.state.waitingForManualStart = false
          this.state.isGameActive = true
        }
      }
      
      // 如果不是手动开启模式或设备未映射，立即启动游戏
      if (!this.config.manualStart || !manualStartEnabled) {
        this.startGameplay()
      } else {
        // 手动开启模式，先解锁设备，然后渲染等待界面
        await this.unlockAutoLockDevice()
        this.renderUI()
        this.log(`问答游戏已准备就绪，等待手动开启信号`, 'success')
        this.log('请点击auto_lock设备按键开始游戏！', 'warning')
      }
      
    } catch (error) {
      this.log(`问答游戏启动失败: ${error.message}`, 'error')
      throw error
    }
  }
  
  /**
   * 设置手动开启监听
   * @returns {boolean} 是否成功设置监听器
   */
  setupManualStartListener() {
    // 检查auto_lock设备是否存在
    const autoLockDevice = this.deviceManager.deviceMap.get('auto_lock')
    if (!autoLockDevice || !autoLockDevice.connected) {
      this.log('auto_lock设备未映射或未连接，无法启用手动开启功能', 'warning')
      return false
    }
    
    // 监听auto_lock设备的所有消息
    this.deviceManager.listenDeviceMessages('auto_lock', (deviceData) => {
      this.log(`收到auto_lock设备消息: ${JSON.stringify(deviceData)}`, 'info')
      
      // 检查是否是按键点击消息
      if (deviceData.method === 'action' && deviceData.action === 'key_clicked') {
        this.log('检测到auto_lock设备按键点击，开始游戏！', 'success')
        this.handleManualStart()
      }
    })
    
    this.log('auto_lock设备手动开启监听已设置', 'info')
    return true
  }
  
  /**
   * 处理手动开启
   */
  async handleManualStart() {
    if (!this.state.waitingForManualStart) {
      return // 不在等待手动开启状态
    }
    
    this.state.waitingForManualStart = false
    this.state.isGameActive = true
    this.state.startTime = Date.now() // 重新设置开始时间
    this.state.questionStartTime = Date.now()
    
    // 启动游戏
    await this.startGameplay()
  }
  
  /**
   * 启动游戏逻辑
   */
  async startGameplay() {
    // 锁定自动锁设备（游戏开始时锁定）
    await this.lockAutoLockDevice()
    
    // 启动倒计时
    this.startQuestionTimer()
    
    // 保存初始状态
    this.saveGameState()
    
    // 渲染初始UI
    this.renderUI()
    
    this.log(`问答游戏启动成功，共加载 ${this.state.questions.length} 道题目`, 'success')
  }
  
  /**
   * 游戏循环
   */
  async loop(deviceManager) {
    // 如果在等待手动开启状态，继续运行循环但不检查游戏逻辑
    if (this.state.waitingForManualStart) {
      return true
    }
    
    if (!this.state.isGameActive) {
      return false // 游戏结束
    }
    
    // 检查是否所有题目都已完成
    if (this.state.currentQuestionIndex >= this.state.questions.length) {
      this.log('所有题目已完成！', 'success')
      await this.endGame()
      return false
    }
    
    // 只在UI不存在时才渲染，避免与计时器冲突
    this.renderCurrentQuestion()
    
    return true // 继续游戏循环
  }
  
  /**
   * 加载题目文件
   */
  async loadQuestions() {
    try {
      // 获取用户配置的文件路径（路径解析由gameplayService处理）
      const filePath = this.config.questionsFile
      
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
    // 如果在等待手动开启，显示等待界面
    if (this.state.waitingForManualStart) {
      this.renderWaitingUI()
      return
    }
    
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
          ${this.config.timeLimit > 0 ? `
          <div class="timer-container">
            <span class="timer-label">剩余时间:</span>
            <span class="timer-value" id="timer-display">${Math.max(0, this.state.remainingTime)}秒</span>
          </div>` : ''}
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
          
          <!-- 反馈提示区域 -->
          <div id="feedback-container" class="feedback-container" style="display: none;">
            <div id="feedback-message" class="feedback-message"></div>
          </div>
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
          margin-bottom: 10px;
        }
        
        .timer-container {
          text-align: center;
          padding: 10px;
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 6px;
        }
        
        .timer-label {
          font-weight: bold;
          color: #856404;
          margin-right: 8px;
        }
        
        .timer-value {
          font-size: 1.2em;
          font-weight: bold;
          color: #d63384;
        }
        
        .timer-value.warning {
          color: #dc3545;
          animation: pulse 1s infinite;
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
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
        
        .option-btn.correct {
          border-color: #28a745;
          background: #d4edda;
          color: #155724;
        }
        
        .option-btn.incorrect {
          border-color: #dc3545;
          background: #f8d7da;
          color: #721c24;
        }
        
        .option-btn.disabled {
          pointer-events: none;
          opacity: 0.6;
        }
        
        .option-btn.qtz-selected {
          border-color: #ffc107;
          background: #fff3cd;
          color: #856404;
          box-shadow: 0 0 0 2px rgba(255, 193, 7, 0.25);
        }
        
        .feedback-container {
          margin-top: 20px;
          padding: 15px;
          border-radius: 8px;
          text-align: center;
          font-weight: bold;
          font-size: 1.1em;
        }
        
        .feedback-container.success {
          background: #d4edda;
          border: 1px solid #c3e6cb;
          color: #155724;
        }
        
        .feedback-container.error {
          background: #f8d7da;
          border: 1px solid #f5c6cb;
          color: #721c24;
        }
        
        .feedback-container.shock {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          color: #856404;
          animation: shake 0.5s ease-in-out;
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      </style>
    `
    
    this.uiAPI.updateUI(html, '问答游戏')
    
    // 延迟一下确保DOM已渲染，然后高亮默认选中的第一个选项
    setTimeout(() => {
      this.updateOptionHighlight()
    }, 100)
  }
  
  /**
   * 渲染当前题目
   */
  renderCurrentQuestion() {
    // 检查游戏是否已结束，如果结束则不渲染
    if (!this.state.isGameActive) {
      return
    }
    
    // 只在必要时重新渲染整个UI，避免与计时器冲突
    if (!document.getElementById('timer-display')) {
      this.renderUI()
      // 渲染后恢复QTZ选择状态
      setTimeout(() => {
        this.updateOptionHighlight()
      }, 100)
    }
  }
  
  /**
   * 渲染等待手动开启界面
   */
  renderWaitingUI() {
    const html = `
      <div class="qa-game-container">
        <div class="waiting-container">
          <h2>🎮 问答游戏</h2>
          <div class="waiting-message">
            <p>游戏已准备就绪</p>
            <p>请按下自动锁设备上的按钮开始游戏</p>
          </div>
          <div class="waiting-animation">
            <div class="pulse"></div>
          </div>
        </div>
      </div>
      
      <style>
        .qa-game-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          font-family: Arial, sans-serif;
        }
        
        .waiting-container {
          text-align: center;
          padding: 60px 40px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .waiting-container h2 {
          color: #007bff;
          margin-bottom: 30px;
          font-size: 2.5em;
        }
        
        .waiting-message {
          margin-bottom: 40px;
        }
        
        .waiting-message p {
          font-size: 1.3em;
          margin: 10px 0;
          color: #333;
        }
        
        .waiting-message p:first-child {
          font-weight: bold;
          color: #28a745;
        }
        
        .waiting-animation {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        
        .pulse {
          width: 60px;
          height: 60px;
          background: #007bff;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0% {
            transform: scale(0.8);
            opacity: 1;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.5;
          }
          100% {
            transform: scale(0.8);
            opacity: 1;
          }
        }
      </style>
    `
    
    this.uiAPI.updateUI(html, '等待开始')
  }
  
  /**
   * 渲染游戏完成界面
   */
  renderGameComplete() {
    const totalTime = Math.floor((Date.now() - this.state.startTime) / 1000)
    
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
   * 启动题目计时器
   */
  startQuestionTimer() {
    // 清除之前的计时器
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
    }
    
    // 如果没有设置时间限制，则不启动计时器
    if (this.config.timeLimit <= 0) {
      return
    }
    
    // 设置题目开始时间和剩余时间
    this.state.questionStartTime = Date.now()
    this.state.remainingTime = this.config.timeLimit
    
    // 立即更新一次显示，确保UI同步
    this.updateTimerDisplay()
    
    // 启动计时器，每秒更新一次
    this.timerInterval = setInterval(() => {
      this.updateTimer()
    }, 1000)
  }
  
  /**
   * 更新计时器显示
   */
  updateTimerDisplay() {
    const timerDisplay = document.getElementById('timer-display')
    if (timerDisplay) {
      timerDisplay.textContent = `${Math.max(0, this.state.remainingTime)}秒`
      
      // 当剩余时间少于10秒时添加警告样式
      if (this.state.remainingTime <= 10 && this.state.remainingTime > 0) {
        timerDisplay.classList.add('warning')
      } else {
        timerDisplay.classList.remove('warning')
      }
    }
  }
  
  /**
   * 更新计时器
   */
  updateTimer() {
    if (!this.state.isGameActive || this.config.timeLimit <= 0) {
      return
    }
    
    const elapsed = Math.floor((Date.now() - this.state.questionStartTime) / 1000)
    this.state.remainingTime = Math.max(0, this.config.timeLimit - elapsed)
    
    // 更新显示
    this.updateTimerDisplay()
    
    // 时间到了，自动处理超时
    if (this.state.remainingTime <= 0) {
      this.handleTimeout()
    }
  }
  
  /**
   * 处理超时
   */
  async handleTimeout() {
    // 清除计时器
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
    
    const currentQuestion = this.getCurrentQuestion()
    if (!currentQuestion) return
    
    this.state.wrongAnswers++
    this.log(`时间到！正确答案是: ${currentQuestion.options[currentQuestion.correct]}`, 'error')
    
    // 高亮正确答案
    this.highlightAnswers(-1, currentQuestion.correct)
    
    // 显示超时反馈
    this.showFeedback(`⏰ 时间到！正确答案是: ${currentQuestion.options[currentQuestion.correct]}`, 'error')
    
    // 执行电击惩罚
    await this.executeShockPunishment()
    
    // 将超时的题目移到队列末尾
    const timeoutQuestion = this.state.questions.splice(this.state.currentQuestionIndex, 1)[0]
    this.state.questions.push(timeoutQuestion)
    
    this.log('该题目已移至队列末尾，稍后重新回答', 'warning')
    
    // 保存游戏状态
    this.saveGameState()
    
    // 重置QTZ选择状态为默认选择第一项
    this.state.selectedOptionIndex = 0
    this.updateOptionHighlight()
    
    // 延迟后更新UI并开始下一题
    setTimeout(() => {
      this.renderUI()
      this.startQuestionTimer()
    }, 2000)
  }
  
  /**
   * 显示反馈信息
   */
  showFeedback(message, type, duration = 2000) {
    const feedbackContainer = document.getElementById('feedback-container')
    const feedbackMessage = document.getElementById('feedback-message')
    
    if (feedbackContainer && feedbackMessage) {
      // 清除之前的样式
      feedbackContainer.className = 'feedback-container'
      
      // 添加对应的样式类
      feedbackContainer.classList.add(type)
      feedbackMessage.textContent = message
      
      // 显示反馈
      feedbackContainer.style.display = 'block'
      
      // 禁用所有选项按钮
      const optionBtns = document.querySelectorAll('.option-btn')
      optionBtns.forEach(btn => btn.classList.add('disabled'))
      
      // 自动隐藏反馈
      setTimeout(() => {
        if (feedbackContainer) {
          feedbackContainer.style.display = 'none'
        }
      }, duration)
    }
  }
  
  /**
   * 高亮正确和错误答案
   */
  highlightAnswers(selectedIndex, correctIndex) {
    const optionBtns = document.querySelectorAll('.option-btn')
    
    optionBtns.forEach((btn, index) => {
      if (index === correctIndex) {
        btn.classList.add('correct')
      } else if (index === selectedIndex && selectedIndex !== correctIndex) {
        btn.classList.add('incorrect')
      }
      btn.classList.add('disabled')
    })
  }
  
  /**
   * 处理答题
   */
  async handleAnswer(selectedIndex) {
    // 清除计时器
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
    const currentQuestion = this.getCurrentQuestion()
    if (!currentQuestion) return
    
    const isCorrect = selectedIndex === currentQuestion.correct
    
    // 高亮答案
    this.highlightAnswers(selectedIndex, currentQuestion.correct)
    
    if (isCorrect) {
      this.state.correctAnswers++
      this.state.currentQuestionIndex++
      this.log(`回答正确！${currentQuestion.explanation || ''}`, 'success')
      
      // 显示正确反馈
      this.showFeedback('🎉 回答正确！', 'success')
    } else {
      this.state.wrongAnswers++
      this.log(`回答错误！正确答案是: ${currentQuestion.options[currentQuestion.correct]}`, 'error')
      
      // 显示错误反馈
      this.showFeedback(`❌ 回答错误！正确答案是: ${currentQuestion.options[currentQuestion.correct]}`, 'error')
      
      // 执行电击惩罚
      await this.executeShockPunishment()
      
      // 将错误的题目移到队列末尾
      const wrongQuestion = this.state.questions.splice(this.state.currentQuestionIndex, 1)[0]
      this.state.questions.push(wrongQuestion)
      
      this.log('该题目已移至队列末尾，稍后重新回答', 'warning')
    }
    
    // 重置QTZ选择状态为默认选择第一项
    this.state.selectedOptionIndex = 0
    this.updateOptionHighlight()
    
    // 保存游戏状态
    this.saveGameState()
    
    // 更新UI并启动下一题计时器
    setTimeout(() => {
      this.renderUI()
      this.startQuestionTimer()
    }, 2000)
  }
  
  /**
   * 设置QTZ设备按键监听
   */
  setupQTZButtonListener() {
    if (!this.deviceManager) {
      this.log('设备管理器未初始化，跳过QTZ按键监听设置', 'warning')
      return
    }
    
    try {
      // 监听QTZ设备的按键属性变化
      this.deviceManager.listenDeviceProperty('qtz_sensor', 'button0', (newValue, deviceData) => {
        this.log(`QTZ button0状态变化: ${newValue}`, 'info')
        const wasPressed = this.state.qtzButton0Pressed
        this.state.qtzButton0Pressed = (newValue === 1)
        
        // 检测按键从未按下到按下的状态变化（按键按下事件）
        if (!wasPressed && this.state.qtzButton0Pressed) {
          this.handleQTZButton0Press()
        }
      })
      
      this.deviceManager.listenDeviceProperty('qtz_sensor', 'button1', (newValue, deviceData) => {
        this.log(`QTZ button1状态变化: ${newValue}`, 'info')
        const wasPressed = this.state.qtzButton1Pressed
        this.state.qtzButton1Pressed = (newValue === 1)
        
        // 检测按键从未按下到按下的状态变化（按键按下事件）
        if (!wasPressed && this.state.qtzButton1Pressed) {
          this.handleQTZButton1Press()
        }
      })
      
      this.log('QTZ按键监听已设置，监听button0（选择）和button1（确认）属性变化', 'info')
    } catch (error) {
      this.log(`QTZ按键监听设置失败: ${error.message}`, 'error')
    }
  }
  
  /**
   * 处理QTZ按键0按下（选择功能）
   */
  handleQTZButton0Press() {
    if (!this.state.isGameActive) {
      return
    }
    
    const currentQuestion = this.getCurrentQuestion()
    if (!currentQuestion) {
      return
    }
    
    // 循环选择下一个选项
    this.state.selectedOptionIndex = (this.state.selectedOptionIndex + 1) % currentQuestion.options.length
    
    this.log(`QTZ选择选项: ${String.fromCharCode(65 + this.state.selectedOptionIndex)}`, 'info')
    
    // 更新UI高亮
    this.updateOptionHighlight()
  }
  
  /**
   * 处理QTZ按键1按下（确认功能）
   */
  handleQTZButton1Press() {
    if (!this.state.isGameActive) {
      return
    }
    
    const currentQuestion = this.getCurrentQuestion()
    if (!currentQuestion) {
      return
    }
    
    // 提交当前选择的答案
    this.log(`QTZ确认提交选项: ${String.fromCharCode(65 + this.state.selectedOptionIndex)}`, 'info')
    this.handleAnswer(this.state.selectedOptionIndex)
  }
  
  /**
   * 更新选项高亮显示
   */
  updateOptionHighlight() {
    const optionBtns = document.querySelectorAll('.option-btn')
    
    optionBtns.forEach((btn, index) => {
      // 移除之前的选中样式
      btn.classList.remove('qtz-selected')
      
      // 添加当前选中的样式
      if (index === this.state.selectedOptionIndex) {
        btn.classList.add('qtz-selected')
      }
    })
  }
  
  /**
   * 执行电击惩罚
   */
  async executeShockPunishment() {
    try {
      const intensity = this.config.shockIntensity
      const duration = this.config.shockDuration
      
      this.log(`执行电击惩罚 - 强度: ${intensity}, 持续: ${duration}秒`, 'warning')
      
      // 显示电击反馈
      this.showFeedback(`⚡ 执行电击惩罚 - 强度: ${intensity}, 持续: ${duration}秒`, 'shock', 1500)
      
      // 根据硬件API使用正确的电击命令格式
      await this.deviceManager.sendDeviceMqttMessage('shock_device', {
        method: 'dian',
        time: duration * 1000, // 转换为毫秒
        voltage: intensity
      })
      
      this.log('电击惩罚执行完成', 'info')
      
    } catch (error) {
      this.log(`电击惩罚执行失败: ${error.message}`, 'error')
    }
  }
  

  
  /**
   * 退出游戏
   */
  async quitGame() {
    this.log('游戏已退出', 'info')
    await this.endGame()
  }
  
  /**
   * 结束游戏
   */
  async endGame() {
    this.log('开始游戏结束流程', 'info')
    
    this.state.isGameActive = false
    
    // 停止所有设备操作
    await this.stopAllDevices()
    
    // 清除所有计时器
    this.cleanupTimers()
    
    
    // 清理设备监听器
    this.cleanupDeviceListeners()
    
    this.renderGameComplete()
    this.saveGameState()
    this.log('问答游戏结束', 'info')
  }
  
  /**
   * 锁定自动锁设备
   */
  async lockAutoLockDevice() {
    try {
      const autoLockDevice = this.deviceManager.deviceMap.get('auto_lock')
      if (autoLockDevice && autoLockDevice.connected) {
        await this.deviceManager.setDeviceProperty('auto_lock', {
          open: 0  // 0表示锁定
        })
        this.log('自动锁设备已锁定', 'info')
      }
    } catch (error) {
      this.log(`自动锁设备锁定失败: ${error.message}`, 'warning')
    }
  }
  
  /**
   * 解锁自动锁设备
   */
  async unlockAutoLockDevice() {
    try {
      const autoLockDevice = this.deviceManager.deviceMap.get('auto_lock')
      if (autoLockDevice && autoLockDevice.connected) {
        await this.deviceManager.setDeviceProperty('auto_lock', {
          open: 1  // 1表示解锁
        })
        this.log('自动锁设备已解锁', 'info')
      }
    } catch (error) {
      this.log(`自动锁设备解锁失败: ${error.message}`, 'warning')
    }
  }
  
  /**
   * 停止所有设备操作
   */
  async stopAllDevices() {
    try {
      // 停止电击设备（如果正在电击）
      if (this.deviceManager) {
        await this.deviceManager.setDeviceProperty('shock_device', {
          shock: 0,
          voltage: 0
        })
        this.log('电击设备已停止', 'info')
      }
      
      // 解锁自动锁设备（游戏结束时解锁）
      await this.unlockAutoLockDevice()
      
    } catch (error) {
      this.log(`设备停止操作失败: ${error.message}`, 'error')
    }
  }
  
  /**
   * 清理所有计时器
   */
  cleanupTimers() {
    // 清除主游戏计时器
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
      this.log('主游戏计时器已清理', 'debug')
    }
    
    // 清除其他可能的计时器
    // 如果将来添加了其他计时器，在这里清理
  }
  
  /**
   * 重置游戏状态
   */
  resetGameState() {
    // 重置QTZ选择状态为默认选择第一项
    this.state.selectedOptionIndex = 0
    
    // 重置QTZ按键状态
    this.state.qtzButton0Pressed = false
    this.state.qtzButton1Pressed = false
    
    // 重置其他游戏状态
    this.state.currentQuestionIndex = 0
    this.state.score = 0
    this.state.correctAnswers = 0
    this.state.wrongAnswers = 0
    this.state.timeoutAnswers = 0
    this.state.remainingTime = 0
    
    this.log('游戏状态已重置', 'debug')
  }
  
  /**
   * 清理设备监听器
   */
  cleanupDeviceListeners() {
    try {
      if (this.deviceManager && this.deviceManager.cleanup) {
        this.deviceManager.cleanup()
        this.log('设备监听器已清理', 'debug')
      }
    } catch (error) {
      this.log(`设备监听器清理失败: ${error.message}`, 'warning')
    }
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
   * 停止游戏（内部调用）
   */
  async stop() {
    this.log('游戏被内部停止', 'warning')
    await this.endGame()
  }
  
  /**
   * 游戏结束方法 - 供外部调用
   * @param {Object} deviceManager - 设备管理器
   */
  async end(deviceManager) {
    this.log('游戏被外部停止', 'warning')
    await this.endGame()
  }
}

// 默认导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QAGame
} else {
  window.QAGame = QAGame
}