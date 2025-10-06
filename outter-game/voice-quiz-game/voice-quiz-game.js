/**
 * 语音应答游戏 - 基于STT/TTS/LLM的智能问答游戏
 * 玩家需要在限定时间内语音回答问题，系统使用LLM判定答案正确性
 */
class VoiceQuizGame {
  constructor() {
    this.title = "语音应答游戏"
    this.description = "使用语音回答问题，AI智能判定答案正确性"
    this.version = "1.0.0"
    this.author = "游戏设计师"
    
    // 当前配置的参数值
    this.config = {
      questionsFile: '<OUTTER_GAME>/voice-quiz-game/items.json',
      maxDuration: 30,
      silentWindow: 5,
      similarityThreshold: 0.75,
      shockIntensity: 30,
      shockDuration: 800,
      restTime: 3,
      totalTime: 10,
      enableTTS: true,
      showAnswers: true,
      llmModel: 'Qwen/Qwen2.5-7B-Instruct',
      llmTemperature: 0.7
    }
    
    // 游戏状态
    this.state = {
      questions: [],
      currentQuestionIndex: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      isGameActive: false,
      gameState: 'idle', // idle, prompting, listening, transcribing, judging, feedback, resting
      startTime: 0,
      questionStartTime: 0,
      recordingStartTime: 0,
      isRecording: false,
      lastSpeechText: '',
      lastJudgment: null,
      silentStartTime: 0,
      isSilent: true,
      audioLevel: 0
    }
    
    // UI和计时器相关
    this.uiAPI = null
    this.gameTimer = null
    this.recordingTimer = null
    this.silentTimer = null
    this.restTimer = null
    this.mediaRecorder = null
    this.audioChunks = []
    this.audioContext = null
    this.analyser = null
    this.microphone = null
    this.dataArray = null
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
        required: false,
        description: "答错时执行电击惩罚（可选）"
      },
      {
        logicalId: "qtz_sensor",
        type: "QTZ",
        name: "QTZ踏板设备",
        required: false,
        description: "可选的踏板设备，用于手动结束录音"
      }
    ]
  }
  
  /**
   * 可配置参数定义
   */
  get parameters() {
    return {
      questionsFile: {
        name: '题目文件路径',
        type: 'file',
        default: '<OUTTER_GAME>/voice-quiz-game/items.json',
        description: '包含题目的JSON文件路径，支持<OUTTER_GAME>标记',
        fileFilter: {
          name: 'JSON文件',
          extensions: ['json']
        }
      },
      maxDuration: {
        name: '最长录音时间',
        type: 'number',
        min: 10,
        max: 120,
        step: 5,
        default: 30,
        description: '单次录音的最长时间（秒）'
      },
      silentWindow: {
        name: '静音检测时间',
        type: 'number',
        min: 2,
        max: 15,
        step: 1,
        default: 5,
        description: '连续静音多少秒后自动结束录音'
      },
      similarityThreshold: {
        name: '答案相似度阈值',
        type: 'number',
        min: 0.5,
        max: 1.0,
        step: 0.05,
        default: 0.75,
        description: 'LLM判定答案正确的相似度阈值（0.5-1.0）'
      },
      shockIntensity: {
        name: '电击强度',
        type: 'number',
        min: 10,
        max: 100,
        step: 5,
        default: 30,
        description: '答错时的电击强度（10-100）'
      },
      shockDuration: {
        name: '电击持续时间',
        type: 'number',
        min: 200,
        max: 3000,
        step: 100,
        default: 800,
        description: '电击持续时间（毫秒）'
      },
      restTime: {
        name: '题目间休息时间',
        type: 'number',
        min: 1,
        max: 10,
        step: 1,
        default: 3,
        description: '每题结束后的休息时间（秒）'
      },
      totalTime: {
        name: '总训练时间',
        type: 'number',
        min: 5,
        max: 60,
        step: 5,
        default: 10,
        description: '总训练时间（分钟，0为无限制）'
      },
      enableTTS: {
        name: '启用语音播报',
        type: 'boolean',
        default: true,
        description: '是否使用TTS播报题目'
      },
      showAnswers: {
        name: '显示标准答案',
        type: 'boolean',
        default: true,
        description: '是否在界面上显示标准答案'
      },
      loopTraining: {
        name: '循环训练',
        type: 'boolean',
        default: false,
        description: '是否循环训练直到总训练时间结束'
      },
      llmModel: {
        name: 'LLM模型',
        type: 'select',
        options: [
          { value: 'Qwen/Qwen2.5-7B-Instruct', label: 'Qwen2.5-7B-Instruct' },
          { value: 'Qwen/Qwen2.5-14B-Instruct', label: 'Qwen2.5-14B-Instruct' },
          { value: 'Qwen/Qwen2.5-32B-Instruct', label: 'Qwen2.5-32B-Instruct' }
        ],
        default: 'Qwen/Qwen2.5-7B-Instruct',
        description: '选择用于答案判定的LLM模型'
      },
      llmTemperature: {
        name: 'LLM温度参数',
        type: 'number',
        min: 0.1,
        max: 1.0,
        step: 0.1,
        default: 0.7,
        description: 'LLM生成的随机性控制（0.1-1.0）'
      }
    }
  }
  
  /**
   * 更新参数
   */
  updateParameters(newParams) {
    for (const [key, value] of Object.entries(newParams)) {
      if (this.config.hasOwnProperty(key)) {
        this.config[key] = value
      }
    }
  }
  
  /**
   * 游戏开始
   */
  async start(deviceManager, params) {
    this.deviceManager = deviceManager
    this.updateParameters(params)
    
    // 获取UI API
    this.uiAPI = window.gameplayUI
    if (!this.uiAPI) {
      throw new Error('UI API未找到，请确保在正确的环境中运行')
    }
    
    // 获取TTS接口（由gameplayService注入）
    // 如果没有注入TTS接口，使用模拟接口
    if (!this.tts) {
      this.log('TTS接口未注入，使用模拟接口', 'warning')
      this.tts = {
        speak: async (text) => {
          this.log(`TTS播报(模拟): ${text}`, 'info')
          // 模拟TTS播报时间
          await new Promise(resolve => setTimeout(resolve, text.length * 100))
          return true
        },
        stop: () => {}
      }
    } else {
      this.log('TTS接口已正确注入', 'info')
      this.log(`TTS接口方法: ${Object.keys(this.tts).join(', ')}`, 'info')
    }
    
    this.log('语音应答游戏正在启动...', 'info')
    
    try {
      // 加载题目
      await this.loadQuestions()
      
      // 初始化游戏状态
      this.resetGameState()
      
      // 设置QTZ设备监听
      this.setupQTZButtonListener()
      
      // 启动游戏
      this.state.isGameActive = true
      this.state.startTime = Date.now()
      
      // 设置总时间计时器
      if (this.config.totalTime > 0) {
        this.gameTimer = setTimeout(() => {
          this.endGame()
        }, this.config.totalTime * 60 * 1000)
      }
      
      // 开始第一题
      // 重置答案显示状态
      this.state.showCurrentAnswer = false
      await this.startQuestion()
      
      this.log(`语音应答游戏启动成功，共加载 ${this.state.questions.length} 道题目`, 'success')
      
    } catch (error) {
      this.log(`语音应答游戏启动失败: ${error.message}`, 'error')
      throw error
    }
  }
  
  /**
   * 游戏主循环
   */
  async loop(deviceManager) {
    if (!this.state.isGameActive) {
      return false
    }
    
    // 检查是否所有题目都已完成
    if (this.state.currentQuestionIndex >= this.state.questions.length) {
      this.log('所有题目已完成！', 'success')
      await this.endGame()
      return false
    }
    
    // 更新UI
    this.renderUI()
    
    return true
  }
  
  /**
   * 加载题目文件
   */
  async loadQuestions() {
    try {
      const filePath = this.config.questionsFile
      this.log(`正在加载题目文件: ${filePath}`, 'info')
      
      const content = await window.gameplayService?.readExternalFile?.(filePath)
      if (!content) {
        throw new Error('无法读取文件内容')
      }
      
      const questions = JSON.parse(content)
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('题目文件格式错误或为空')
      }
      
      this.state.questions = questions
      this.log(`成功加载 ${questions.length} 道题目`, 'success')
      
    } catch (error) {
      this.log(`加载题目失败，使用默认题目: ${error.message}`, 'warning')
      this.state.questions = this.getDefaultQuestions()
    }
  }
  
  /**
   * 获取默认题目
   */
  getDefaultQuestions() {
    return [
      {
        id: "1",
        prompt: "请说出你的名字",
        answer: ["主人", "master", "我是主人的奴隶"]
      },
      {
        id: "2",
        prompt: "你现在在做什么？",
        answer: ["在接受训练", "在回答问题", "在学习"]
      },
      {
        id: "3",
        prompt: "你应该如何称呼我？",
        answer: ["主人", "master", "我的主人"]
      }
    ]
  }
  
  /**
   * 开始新题目
   */
  async startQuestion() {
    if (this.state.currentQuestionIndex >= this.state.questions.length) {
      await this.endGame()
      return
    }
    
    const question = this.getCurrentQuestion()
    this.state.gameState = 'prompting'
    this.state.questionStartTime = Date.now()
    this.state.showCurrentAnswer = false
    
    this.log(`开始第 ${this.state.currentQuestionIndex + 1} 题: ${question.prompt}`, 'info')
    
    // 渲染UI
    this.renderUI()
    
    // TTS播报题目
    if (this.config.enableTTS) {
      try {
        this.log(`准备TTS播报题目: ${question.prompt}`, 'info')
        this.log(`TTS接口类型: ${this.tts ? 'gameplayService注入' : '模拟接口'}`, 'info')
        
        const result = await this.tts.speak(question.prompt)
        this.log(`TTS播报完成，结果: ${result}`, 'info')
      } catch (error) {
        this.log(`TTS播报失败: ${error.message}`, 'warning')
        this.log(`错误堆栈: ${error.stack}`, 'warning')
      }
    } else {
      this.log('TTS播报已禁用', 'info')
    }
    
    // 开始录音
    await this.startListening()
  }
  
  /**
   * 开始录音监听
   */
  async startListening() {
    try {
      this.state.gameState = 'listening'
      this.state.recordingStartTime = Date.now()
      this.state.isRecording = true
      this.state.silentStartTime = Date.now()
      this.state.isSilent = true
      this.audioChunks = []
      
      // 获取麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // 设置音频分析器用于检测静音
      this.audioContext = new AudioContext()
      this.analyser = this.audioContext.createAnalyser()
      this.microphone = this.audioContext.createMediaStreamSource(stream)
      this.microphone.connect(this.analyser)
      
      this.analyser.fftSize = 256
      const bufferLength = this.analyser.frequencyBinCount
      this.dataArray = new Uint8Array(bufferLength)
      
      // 设置录音器
      this.mediaRecorder = new MediaRecorder(stream)
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }
      
      this.mediaRecorder.start()
      
      // 开始音量检测
      this.startVolumeDetection()
      
      // 设置最大录音时间
      this.recordingTimer = setTimeout(() => {
        this.log('录音超时，自动结束', 'warning')
        this.stopListening()
      }, this.config.maxDuration * 1000)
      
      this.log('开始录音，请说话...', 'info')
      this.renderUI()
      
    } catch (error) {
      this.log(`开始录音失败: ${error.message}`, 'error')
      this.state.isRecording = false
      this.state.gameState = 'idle'
      this.renderUI()
    }
  }
  
  /**
   * 开始音量检测
   */
  startVolumeDetection() {
    const detectVolume = () => {
      if (!this.state.isRecording || !this.analyser) {
        return
      }
      
      this.analyser.getByteFrequencyData(this.dataArray)
      
      // 计算平均音量
      let sum = 0
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i]
      }
      this.state.audioLevel = sum / this.dataArray.length
      
      // 检测是否静音（阈值可调整）
      const silentThreshold = 10
      const isSilent = this.state.audioLevel < silentThreshold
      
      if (isSilent) {
        if (!this.state.isSilent) {
          // 刚开始静音
          this.state.isSilent = true
          this.state.silentStartTime = Date.now()
        } else {
          // 检查静音时长
          const silentDuration = (Date.now() - this.state.silentStartTime) / 1000
          if (silentDuration >= this.config.silentWindow) {
            this.log(`检测到连续静音 ${this.config.silentWindow} 秒，自动结束录音`, 'info')
            this.stopListening()
            return
          }
        }
      } else {
        // 有声音
        this.state.isSilent = false
      }
      
      // 继续检测
      requestAnimationFrame(detectVolume)
    }
    
    detectVolume()
  }
  
  /**
   * 停止录音
   */
  async stopListening() {
    if (!this.state.isRecording) {
      return
    }
    
    this.state.isRecording = false
    this.state.gameState = 'transcribing'
    
    // 清理计时器
    if (this.recordingTimer) {
      clearTimeout(this.recordingTimer)
      this.recordingTimer = null
    }
    
    // 停止录音
    if (this.mediaRecorder) {
      this.mediaRecorder.stop()
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop())
    }
    
    // 清理音频上下文
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    
    this.log('录音结束，开始语音识别...', 'info')
    this.renderUI()
    
    // 处理录音数据
    this.mediaRecorder.onstop = async () => {
      await this.processRecording()
    }
  }
  
  /**
   * 处理录音数据
   */
  async processRecording() {
    try {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' })
      const audioData = new Uint8Array(await audioBlob.arrayBuffer())
      
      // 调用语音识别API
      const result = await window.electronAPI.invoke('game-speech-to-text', {
        audioData: audioData,
        options: {
          timeout: 30000
        }
      })
      
      if (result.success) {
        this.state.lastSpeechText = result.text
        this.log(`语音识别结果: ${result.text}`, 'info')
        
        // 开始答案判定
        await this.judgeAnswer(result.text)
      } else {
        this.state.lastSpeechText = '识别失败'
        this.log(`语音识别失败: ${result.error}`, 'error')
        
        // 识别失败视为答错
        await this.handleWrongAnswer('语音识别失败')
      }
      
    } catch (error) {
      this.log(`处理录音失败: ${error.message}`, 'error')
      await this.handleWrongAnswer('处理录音失败')
    }
  }
  
  /**
   * 使用LLM判定答案
   */
  async judgeAnswer(speechText) {
    this.state.gameState = 'judging'
    this.renderUI()
    
    try {
      const question = this.getCurrentQuestion()
      const standardAnswers = Array.isArray(question.answer) ? question.answer : [question.answer]
      
      // 构建LLM提示词
      const prompt = `你是一个答案评判官，请判断用户的回答是否与标准答案基本一致。

题目：${question.prompt}

标准答案：${standardAnswers.join('、')}

用户回答：${speechText}

请考虑语音识别可能存在的误差，判断用户回答是否基本正确。
请只返回JSON格式：{"correct": true/false, "similarity": 0.0-1.0, "reason": "判断理由"}`
      
      const result = await window.electronAPI.invoke('game-chat-llm', {
        message: prompt,
        options: {
          timeout: 30000,
          model: this.config.llmModel,
          max_tokens: 200,
          temperature: this.config.llmTemperature
        }
      })
      
      if (result.success) {
        const responseText = result.response.content
        this.log(`LLM判定响应: ${responseText}`, 'info')
        
        try {
          // 尝试解析JSON响应
          const judgment = JSON.parse(responseText)
          this.state.lastJudgment = judgment
          
          // 根据相似度阈值判定
          const isCorrect = judgment.correct && judgment.similarity >= this.config.similarityThreshold
          
          if (isCorrect) {
            await this.handleCorrectAnswer(judgment)
          } else {
            await this.handleWrongAnswer(judgment.reason || '答案不正确')
          }
          
        } catch (parseError) {
          this.log(`解析LLM响应失败: ${parseError.message}`, 'error')
          // 如果无法解析，尝试简单的文本匹配
          const isCorrect = standardAnswers.some(answer => 
            speechText.toLowerCase().includes(answer.toLowerCase()) ||
            answer.toLowerCase().includes(speechText.toLowerCase())
          )
          
          if (isCorrect) {
            await this.handleCorrectAnswer({ correct: true, similarity: 0.8, reason: '文本匹配' })
          } else {
            await this.handleWrongAnswer('答案不匹配')
          }
        }
        
      } else {
        this.log(`LLM调用失败: ${result.error}`, 'error')
        await this.handleWrongAnswer('LLM判定失败')
      }
      
    } catch (error) {
      this.log(`答案判定失败: ${error.message}`, 'error')
      await this.handleWrongAnswer('判定过程出错')
    }
  }
  
  /**
   * 处理正确答案
   */
  async handleCorrectAnswer(judgment) {
    this.state.gameState = 'feedback'
    this.state.correctAnswers++
    
    this.log(`回答正确！相似度: ${judgment.similarity}`, 'success')
    
    // 录音结束时总是展示标准答案
    this.state.showCurrentAnswer = true
    this.renderUI()
    
    // TTS播报反馈
    if (this.config.enableTTS) {
      try {
        await this.tts.speak('回答正确，很好！')
      } catch (error) {
        this.log(`TTS播报失败: ${error.message}`, 'warning')
      }
    }
    
    // 进入下一题
    await this.nextQuestion()
  }
  
  /**
   * 处理错误答案
   */
  async handleWrongAnswer(reason) {
    this.state.gameState = 'feedback'
    this.state.wrongAnswers++
    
    this.log(`回答错误: ${reason}`, 'error')
    
    // 录音结束时总是展示标准答案
    this.state.showCurrentAnswer = true
    this.renderUI()
    
    // TTS播报反馈
    if (this.config.enableTTS) {
      try {
        await this.tts.speak('回答错误！')
      } catch (error) {
        this.log(`TTS播报失败: ${error.message}`, 'warning')
      }
    }
    
    // 执行电击惩罚
    await this.executeShockPunishment()
    
    // 进入下一题
    await this.nextQuestion()
  }
  
  /**
   * 执行电击惩罚
   */
  async executeShockPunishment() {
    const shockDevice = this.deviceManager?.deviceMap?.get('shock_device')
    if (!shockDevice || !shockDevice.connected) {
      this.log('电击设备未连接，跳过惩罚', 'warning')
      return
    }
    
    try {
      this.log(`执行电击惩罚: 强度${this.config.shockIntensity}, 时长${this.config.shockDuration}ms`, 'warning')
      
      await this.deviceManager.sendDeviceCommand('shock_device', {
        method: 'action',
        action: 'shock',
        intensity: this.config.shockIntensity,
        duration: this.config.shockDuration
      })
      
    } catch (error) {
      this.log(`电击执行失败: ${error.message}`, 'error')
    }
  }
  
  /**
   * 进入下一题
   */
  async nextQuestion() {
    this.state.gameState = 'resting'
    this.renderUI()
    
    // 休息时间
    this.restTimer = setTimeout(async () => {
      this.state.currentQuestionIndex++
      
      // 检查是否需要循环训练
      if (this.state.currentQuestionIndex >= this.state.questions.length) {
        if (this.config.loopTraining && this.state.isGameActive) {
          // 循环训练：重置到第一题
          this.state.currentQuestionIndex = 0
          this.log('循环训练：重新开始题目', 'info')
        } else {
          // 结束游戏
          await this.endGame()
          return
        }
      }
      
      await this.startQuestion()
    }, this.config.restTime * 1000)
  }
  
  /**
   * 设置QTZ按钮监听
   */
  setupQTZButtonListener() {
    const qtzDevice = this.deviceManager?.deviceMap?.get('qtz_sensor')
    if (!qtzDevice || !qtzDevice.connected) {
      this.log('QTZ设备未连接，无法设置按钮监听', 'info')
      return
    }
    
    this.deviceManager.listenDeviceMessages('qtz_sensor', (deviceData) => {
      if (this.state.isRecording && (deviceData.button0 || deviceData.button1)) {
        this.log('检测到QTZ按钮按下，结束录音', 'info')
        this.stopListening()
      }
    })
    
    this.log('QTZ按钮监听已设置', 'info')
  }
  
  /**
   * 获取当前题目
   */
  getCurrentQuestion() {
    return this.state.questions[this.state.currentQuestionIndex]
  }
  
  /**
   * 渲染UI界面
   */
  renderUI() {
    if (!this.uiAPI) {
      return
    }
    
    const question = this.getCurrentQuestion()
    const progress = ((this.state.currentQuestionIndex + 1) / this.state.questions.length * 100).toFixed(1)
    const elapsed = this.state.startTime ? Math.floor((Date.now() - this.state.startTime) / 1000) : 0
    const remainingTime = this.config.totalTime > 0 ? Math.max(0, this.config.totalTime * 60 - elapsed) : null
    
    let stateText = ''
    let stateClass = ''
    
    switch (this.state.gameState) {
      case 'prompting':
        stateText = '📢 播报题目中...'
        stateClass = 'text-info'
        break
      case 'listening':
        const recordingTime = this.state.recordingStartTime ? Math.floor((Date.now() - this.state.recordingStartTime) / 1000) : 0
        const silentTime = this.state.isSilent && this.state.silentStartTime ? Math.floor((Date.now() - this.state.silentStartTime) / 1000) : 0
        stateText = `🎤 录音中... (${recordingTime}s) ${this.state.isSilent ? `静音: ${silentTime}s` : '有声音'}`
        stateClass = 'text-success'
        break
      case 'transcribing':
        stateText = '🔄 语音识别中...'
        stateClass = 'text-warning'
        break
      case 'judging':
        stateText = '🤖 AI判定中...'
        stateClass = 'text-warning'
        break
      case 'feedback':
        stateText = '✅ 反馈中...'
        stateClass = 'text-primary'
        break
      case 'resting':
        stateText = '😴 休息中...'
        stateClass = 'text-muted'
        break
      default:
        stateText = '⏸️ 待机中'
        stateClass = 'text-muted'
    }
    
    const html = `
      <div class="voice-quiz-game">
        <div class="game-header">
          <h2>🎙️ 语音应答游戏</h2>
          <div class="game-stats">
            <span class="badge badge-success">正确: ${this.state.correctAnswers}</span>
            <span class="badge badge-danger">错误: ${this.state.wrongAnswers}</span>
            <span class="badge badge-info">进度: ${progress}%</span>
            ${remainingTime !== null ? `<span class="badge badge-warning">剩余: ${Math.floor(remainingTime / 60)}:${(remainingTime % 60).toString().padStart(2, '0')}</span>` : ''}
          </div>
        </div>
        
        <div class="question-section">
          <div class="question-header">
            <h3>题目 ${this.state.currentQuestionIndex + 1} / ${this.state.questions.length}</h3>
          </div>
          
          <div class="question-content">
            <div class="question-text">
              <h4>${question ? question.prompt : '加载中...'}</h4>
            </div>
            
            ${(this.config.showAnswers || this.state.showCurrentAnswer) && question ? `
              <div class="answer-section">
                <h5>标准答案：</h5>
                <div class="answer-text">
                  ${Array.isArray(question.answer) ? question.answer.join('、') : question.answer}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
        
        <div class="status-section">
          <div class="game-state ${stateClass}">
            <h4>${stateText}</h4>
          </div>
          
          ${this.state.isRecording ? `
            <div class="recording-info">
              <div class="audio-level">
                <div class="level-bar">
                  <div class="level-fill" style="width: ${Math.min(100, this.state.audioLevel * 2)}%"></div>
                </div>
                <span>音量: ${Math.round(this.state.audioLevel)}</span>
              </div>
            </div>
          ` : ''}
          
          ${this.state.lastSpeechText ? `
            <div class="speech-result">
              <h5>识别结果：</h5>
              <div class="speech-text">${this.state.lastSpeechText}</div>
            </div>
          ` : ''}
          
          ${this.state.lastJudgment ? `
            <div class="judgment-result">
              <h5>判定结果：</h5>
              <div class="judgment-text">
                <span class="${this.state.lastJudgment.correct ? 'text-success' : 'text-danger'}">
                  ${this.state.lastJudgment.correct ? '✅ 正确' : '❌ 错误'}
                </span>
                <span class="similarity">相似度: ${(this.state.lastJudgment.similarity * 100).toFixed(1)}%</span>
                <div class="reason">${this.state.lastJudgment.reason}</div>
              </div>
            </div>
          ` : ''}
        </div>
        
        <div class="control-section">
          ${this.state.isRecording ? `
            <button onclick="window.gameplayUI.handleEvent('stopRecording')" class="btn btn-danger">
              ⏹️ 停止录音
            </button>
          ` : ''}
          
          <button onclick="window.gameplayUI.handleEvent('quitGame')" class="btn btn-secondary">
            🚪 退出游戏
          </button>
        </div>
      </div>
      
      <style>
        .voice-quiz-game {
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }
        
        .game-header {
          text-align: center;
          margin-bottom: 20px;
        }
        
        .game-stats {
          margin-top: 10px;
        }
        
        .game-stats .badge {
          margin: 0 5px;
          padding: 5px 10px;
          border-radius: 15px;
          font-size: 12px;
        }
        
        .question-section {
          background: #f8f9fa;
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 20px;
        }
        
        .question-text h4 {
          color: #333;
          font-size: 18px;
          margin-bottom: 15px;
        }
        
        .answer-section {
          background: #e9ecef;
          border-radius: 5px;
          padding: 10px;
          margin-top: 15px;
        }
        
        .answer-text {
          color: #666;
          font-style: italic;
        }
        
        .status-section {
          margin-bottom: 20px;
        }
        
        .game-state {
          text-align: center;
          padding: 15px;
          border-radius: 10px;
          background: #f8f9fa;
          margin-bottom: 15px;
        }
        
        .recording-info {
          background: #d4edda;
          border-radius: 5px;
          padding: 10px;
          margin-bottom: 10px;
        }
        
        .level-bar {
          width: 100%;
          height: 20px;
          background: #e9ecef;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 5px;
        }
        
        .level-fill {
          height: 100%;
          background: linear-gradient(90deg, #28a745, #ffc107, #dc3545);
          transition: width 0.1s;
        }
        
        .speech-result, .judgment-result {
          background: #f8f9fa;
          border-radius: 5px;
          padding: 10px;
          margin-bottom: 10px;
        }
        
        .speech-text, .judgment-text {
          background: white;
          border-radius: 3px;
          padding: 8px;
          border-left: 3px solid #007bff;
        }
        
        .similarity {
          margin-left: 10px;
          font-size: 12px;
          color: #666;
        }
        
        .reason {
          font-size: 12px;
          color: #666;
          margin-top: 5px;
        }
        
        .control-section {
          text-align: center;
        }
        
        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          margin: 0 5px;
          font-size: 14px;
        }
        
        .btn-danger {
          background: #dc3545;
          color: white;
        }
        
        .btn-secondary {
          background: #6c757d;
          color: white;
        }
        
        .text-success { color: #28a745; }
        .text-danger { color: #dc3545; }
        .text-warning { color: #ffc107; }
        .text-info { color: #17a2b8; }
        .text-primary { color: #007bff; }
        .text-muted { color: #6c757d; }
        
        .badge-success { background: #28a745; color: white; }
        .badge-danger { background: #dc3545; color: white; }
        .badge-info { background: #17a2b8; color: white; }
        .badge-warning { background: #ffc107; color: black; }
      </style>
    `
    
    this.uiAPI.updateUI(html)
  }
  
  /**
   * 处理UI事件
   */
  handleUIEvent(eventType, data) {
    switch (eventType) {
      case 'stopRecording':
        this.stopListening()
        break
      case 'quitGame':
        this.quitGame()
        break
    }
  }
  
  /**
   * 退出游戏
   */
  async quitGame() {
    this.log('用户请求退出游戏', 'info')
    await this.endGame()
  }
  
  /**
   * 结束游戏
   */
  async endGame() {
    this.state.isGameActive = false
    this.state.gameState = 'idle'
    
    // 停止录音
    if (this.state.isRecording) {
      this.state.isRecording = false
      if (this.mediaRecorder) {
        this.mediaRecorder.stop()
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop())
      }
    }
    
    // 清理计时器
    this.cleanupTimers()
    
    // 停止TTS
    if (this.tts) {
      this.tts.stop()
    }
    
    // 渲染结束界面
    this.renderGameComplete()
    
    this.log('语音应答游戏结束', 'info')
  }
  
  /**
   * 渲染游戏结束界面
   */
  renderGameComplete() {
    if (!this.uiAPI) {
      return
    }
    
    const totalQuestions = this.state.correctAnswers + this.state.wrongAnswers
    const accuracy = totalQuestions > 0 ? (this.state.correctAnswers / totalQuestions * 100).toFixed(1) : 0
    const elapsed = this.state.startTime ? Math.floor((Date.now() - this.state.startTime) / 1000) : 0
    
    const html = `
      <div class="game-complete">
        <div class="complete-header">
          <h2>🎉 游戏结束</h2>
          <p>语音应答游戏已完成</p>
        </div>
        
        <div class="game-summary">
          <h3>📊 游戏统计</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">${this.state.correctAnswers}</div>
              <div class="stat-label">正确答案</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${this.state.wrongAnswers}</div>
              <div class="stat-label">错误答案</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${accuracy}%</div>
              <div class="stat-label">正确率</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, '0')}</div>
              <div class="stat-label">用时</div>
            </div>
          </div>
        </div>
        
        <div class="performance-rating">
          <h4>🏆 表现评价</h4>
          <div class="rating">${this.getPerformanceRating(accuracy)}</div>
        </div>
      </div>
      
      <style>
        .game-complete {
          padding: 20px;
          max-width: 600px;
          margin: 0 auto;
          text-align: center;
        }
        
        .complete-header {
          margin-bottom: 30px;
        }
        
        .game-summary {
          background: #f8f9fa;
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 20px;
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-top: 20px;
        }
        
        .stat-item {
          background: white;
          border-radius: 8px;
          padding: 15px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #007bff;
          margin-bottom: 5px;
        }
        
        .stat-label {
          font-size: 12px;
          color: #666;
        }
        
        .performance-rating {
          background: #e9ecef;
          border-radius: 10px;
          padding: 20px;
        }
        
        .rating {
          font-size: 18px;
          font-weight: bold;
          margin-top: 10px;
        }
      </style>
    `
    
    this.uiAPI.updateUI(html)
  }
  
  /**
   * 获取表现评价
   */
  getPerformanceRating(accuracy) {
    if (accuracy >= 90) {
      return '🌟 优秀！语音表达清晰准确！'
    } else if (accuracy >= 70) {
      return '👍 良好！继续保持！'
    } else if (accuracy >= 50) {
      return '📈 一般，还有提升空间'
    } else {
      return '💪 需要更多练习'
    }
  }
  
  /**
   * 重置游戏状态
   */
  resetGameState() {
    this.state = {
      questions: this.state.questions,
      currentQuestionIndex: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      isGameActive: false,
      gameState: 'idle',
      startTime: 0,
      questionStartTime: 0,
      recordingStartTime: 0,
      isRecording: false,
      lastSpeechText: '',
      lastJudgment: null,
      silentStartTime: 0,
      isSilent: true,
      audioLevel: 0,
      showCurrentAnswer: false
    }
  }
  
  /**
   * 清理计时器
   */
  cleanupTimers() {
    if (this.gameTimer) {
      clearTimeout(this.gameTimer)
      this.gameTimer = null
    }
    if (this.recordingTimer) {
      clearTimeout(this.recordingTimer)
      this.recordingTimer = null
    }
    if (this.silentTimer) {
      clearTimeout(this.silentTimer)
      this.silentTimer = null
    }
    if (this.restTimer) {
      clearTimeout(this.restTimer)
      this.restTimer = null
    }
  }
  
  /**
   * 日志记录
   */
  log(message, level = 'info') {
    const timestamp = new Date().toLocaleTimeString()
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`)
    
    // 如果有UI API，也发送到游戏日志
    if (this.uiAPI && this.uiAPI.addLog) {
      this.uiAPI.addLog(message, level)
    }
  }
  
  /**
   * 停止游戏
   */
  async stop() {
    this.log('停止语音应答游戏', 'info')
    await this.endGame()
  }
  
  /**
   * 游戏结束清理
   */
  async end(deviceManager) {
    await this.endGame()
  }
}

// 标准导出方式（必需）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VoiceQuizGame
} else {
  window.VoiceQuizGame = VoiceQuizGame
}