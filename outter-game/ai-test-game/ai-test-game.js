/**
 * AI功能测试游戏 - 测试语音识别和LLM对话功能
 * 提供语音识别转文字和LLM对话的测试界面
 */
class AITestGame {
  constructor() {
    this.title = "AI功能测试游戏"
    this.description = "测试语音识别和LLM对话功能的专用游戏"
    this.version = "1.0.0"
    this.author = "AI开发团队"
    
    // 当前配置的参数值
    this.config = {
      sttTimeout: 30000,
      llmTimeout: 30000,
      llmModel: 'Qwen/Qwen2.5-7B-Instruct',
      maxTokens: 1000,
      temperature: 0.7
    }
    
    // 游戏状态
    this.state = {
      isGameActive: false,
      isRecording: false,
      isProcessing: false,
      lastSpeechText: '',
      lastLLMResponse: '',
      testResults: []
    }
    
    // UI相关
    this.uiAPI = null
    this.mediaRecorder = null
    this.audioChunks = []
  }
  
  /**
   * 设备依赖配置
   */
  get requiredDevices() {
    return [] // 不需要任何设备
  }
  
  /**
   * 游戏参数配置
   */
  parameters = {
    sttTimeout: {
      name: '语音识别超时时间',
      type: 'number',
      min: 5000,
      max: 60000,
      step: 1000,
      default: 30000,
      description: '语音识别API调用的超时时间（毫秒）'
    },
    llmTimeout: {
      name: 'LLM调用超时时间',
      type: 'number',
      min: 5000,
      max: 60000,
      step: 1000,
      default: 30000,
      description: 'LLM API调用的超时时间（毫秒）'
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
      description: '选择要使用的LLM模型'
    },
    maxTokens: {
      name: '最大Token数',
      type: 'number',
      min: 100,
      max: 4000,
      step: 100,
      default: 1000,
      description: 'LLM响应的最大Token数量'
    },
    temperature: {
      name: '温度参数',
      type: 'number',
      min: 0.1,
      max: 2.0,
      step: 0.1,
      default: 0.7,
      description: 'LLM生成的随机性控制（0.1-2.0）'
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
    
    // 获取UI API
    this.uiAPI = window.gameplayUI
    if (!this.uiAPI) {
      throw new Error('UI API未找到，请确保在正确的环境中运行')
    }
    
    this.log('AI测试游戏开始')
    
    // 更新参数
    if (params) {
      this.updateParameters(params)
    }
    
    this.state.isGameActive = true
    this.state.testResults = []
    
    // 渲染UI
    this.renderUI()
    
    // 设置事件监听器
    this.setupEventListeners()
    
    this.log('AI测试游戏启动完成')
  }
  
  /**
   * 游戏主循环
   */
  async loop(deviceManager) {
    if (!this.state.isGameActive) {
      return false
    }
    
    // AI测试游戏不需要主循环逻辑
    return true
  }
  
  /**
   * 渲染UI界面
   */
  renderUI() {
    if (!this.uiAPI) {
      this.log('UI API未初始化', 'error')
      return
    }
    
    const html = `
      <div class="ai-test-game">
        <div class="game-header">
          <h2>🤖 AI功能测试游戏</h2>
          <p>测试语音识别和LLM对话功能</p>
        </div>
        
        <div class="test-section">
          <div class="stt-test">
            <h3>🎤 语音识别测试</h3>
            <div class="stt-controls">
              <button id="startRecording" onclick="window.gameplayUI.handleEvent('startRecording')" ${this.state.isRecording ? 'disabled' : ''} 
                    class="btn btn-primary">
              ${this.state.isRecording ? '🔴 录音中...' : '🎤 开始录音'}
            </button>
            <button id="stopRecording" onclick="window.gameplayUI.handleEvent('stopRecording')" ${!this.state.isRecording ? 'disabled' : ''} 
                    class="btn btn-secondary">
              ⏹️ 停止录音
            </button>
            </div>
            <div class="stt-result">
              <h4>识别结果：</h4>
              <div class="result-text">${this.state.lastSpeechText || '暂无结果'}</div>
            </div>
          </div>
          
          <div class="llm-test">
            <h3>💬 LLM对话测试</h3>
            <div class="llm-controls">
              <textarea id="llmInput" placeholder="请输入要发送给LLM的消息..." 
                        rows="3" class="form-control"></textarea>
              <button id="sendToLLM" onclick="window.gameplayUI.handleEvent('sendToLLM')" ${this.state.isProcessing ? 'disabled' : ''} 
                       class="btn btn-success">
                 ${this.state.isProcessing ? '⏳ 处理中...' : '📤 发送给LLM'}
               </button>
            </div>
            <div class="llm-result">
              <h4>LLM响应：</h4>
              <div class="result-text">${this.state.lastLLMResponse || '暂无响应'}</div>
            </div>
          </div>
          
          <div class="combined-test">
            <h3>🔄 组合测试</h3>
            <button id="combinedTest" onclick="window.gameplayUI.handleEvent('combinedTest')" ${this.state.isProcessing || this.state.isRecording ? 'disabled' : ''} 
                     class="btn btn-warning">
               🎯 语音转文字 + LLM对话
             </button>
            <p class="help-text">点击后先录音，然后将识别结果发送给LLM</p>
          </div>
        </div>
        
        <div class="test-results">
          <h3>📊 测试记录</h3>
          <div class="results-list">
            ${this.renderTestResults()}
          </div>
        </div>
        
        <div class="game-controls">
          <button id="clearResults" onclick="window.gameplayUI.handleEvent('clearResults')" class="btn btn-outline-secondary">🗑️ 清空记录</button>
           <button id="quitGame" onclick="window.gameplayUI.handleEvent('quitGame')" class="btn btn-danger">❌ 退出游戏</button>
        </div>
      </div>
      
      <style>
        .ai-test-game {
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
          font-family: Arial, sans-serif;
        }
        
        .game-header {
          text-align: center;
          margin-bottom: 30px;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 10px;
        }
        
        .test-section {
          display: grid;
          gap: 20px;
          margin-bottom: 30px;
        }
        
        .stt-test, .llm-test, .combined-test {
          padding: 20px;
          border: 2px solid #e0e0e0;
          border-radius: 10px;
          background: #f9f9f9;
        }
        
        .stt-controls, .llm-controls {
          margin: 15px 0;
        }
        
        .btn {
          padding: 10px 20px;
          margin: 5px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.3s;
        }
        
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .btn-primary { background: #007bff; color: white; }
        .btn-secondary { background: #6c757d; color: white; }
        .btn-success { background: #28a745; color: white; }
        .btn-warning { background: #ffc107; color: black; }
        .btn-danger { background: #dc3545; color: white; }
        .btn-outline-secondary { background: transparent; color: #6c757d; border: 1px solid #6c757d; }
        
        .form-control {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 5px;
          margin: 10px 0;
          font-size: 14px;
        }
        
        .result-text {
          background: white;
          padding: 15px;
          border-radius: 5px;
          border: 1px solid #ddd;
          min-height: 50px;
          margin-top: 10px;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        
        .help-text {
          font-size: 12px;
          color: #666;
          margin-top: 10px;
        }
        
        .test-results {
          margin: 30px 0;
        }
        
        .results-list {
          max-height: 300px;
          overflow-y: auto;
          border: 1px solid #ddd;
          border-radius: 5px;
          background: white;
        }
        
        .result-item {
          padding: 10px;
          border-bottom: 1px solid #eee;
        }
        
        .result-item:last-child {
          border-bottom: none;
        }
        
        .result-timestamp {
          font-size: 12px;
          color: #666;
          margin-bottom: 5px;
        }
        
        .game-controls {
          text-align: center;
          margin-top: 30px;
        }
      </style>
    `
    
    this.uiAPI.updateUI(html)
    this.setupEventListeners()
  }
  
  /**
   * 渲染测试结果
   */
  renderTestResults() {
    if (this.state.testResults.length === 0) {
      return '<div class="result-item">暂无测试记录</div>'
    }
    
    return this.state.testResults.map(result => `
      <div class="result-item">
        <div class="result-timestamp">${result.timestamp}</div>
        <div><strong>类型：</strong>${result.type}</div>
        <div><strong>输入：</strong>${result.input}</div>
        <div><strong>输出：</strong>${result.output}</div>
        <div><strong>耗时：</strong>${result.duration}ms</div>
        ${result.error ? `<div style="color: red;"><strong>错误：</strong>${result.error}</div>` : ''}
      </div>
    `).join('')
  }
  
  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // UI事件通过HTML中的onclick="window.gameplayUI.handleEvent()"调用处理
    // 不需要手动设置监听器
  }
  
  /**
   * 处理UI事件
   */
  handleUIEvent(eventType, data) {
    switch (eventType) {
      case 'startRecording':
        this.startRecording()
        break
      case 'stopRecording':
        this.stopRecording()
        break
      case 'sendToLLM':
        this.sendToLLM()
        break
      case 'combinedTest':
        this.runCombinedTest()
        break
      case 'clearResults':
        this.clearResults()
        break
      case 'quitGame':
        this.quitGame()
        break
    }
  }
  
  /**
   * 开始录音
   */
  async startRecording() {
    try {
      this.log('开始录音')
      this.state.isRecording = true
      this.audioChunks = []
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.mediaRecorder = new MediaRecorder(stream)
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }
      
      this.mediaRecorder.start()
      this.renderUI()
      
    } catch (error) {
      this.log(`录音失败: ${error.message}`, 'error')
      this.state.isRecording = false
      this.renderUI()
    }
  }
  
  /**
   * 停止录音并进行语音识别
   */
  async stopRecording() {
    if (!this.mediaRecorder || !this.state.isRecording) {
      return
    }
    
    this.log('停止录音，开始语音识别')
    this.state.isRecording = false
    this.state.isProcessing = true
    
    const startTime = Date.now()
    
    this.mediaRecorder.stop()
    this.mediaRecorder.stream.getTracks().forEach(track => track.stop())
    
    this.mediaRecorder.onstop = async () => {
      try {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' })
        const audioData = new Uint8Array(await audioBlob.arrayBuffer())
        
        // 调用语音识别API
        const result = await window.electronAPI.invoke('game-speech-to-text', {
          audioData: audioData,
          options: {
            timeout: this.config.sttTimeout
          }
        })
        
        const duration = Date.now() - startTime
        
        if (result.success) {
          this.state.lastSpeechText = result.text
          this.addTestResult('语音识别', '音频数据', result.text, duration)
          this.log(`语音识别成功: ${result.text}`)
        } else {
          this.state.lastSpeechText = `错误: ${result.error}`
          this.addTestResult('语音识别', '音频数据', '', duration, result.error)
          this.log(`语音识别失败: ${result.error}`, 'error')
        }
        
      } catch (error) {
        const duration = Date.now() - startTime
        this.state.lastSpeechText = `错误: ${error.message}`
        this.addTestResult('语音识别', '音频数据', '', duration, error.message)
        this.log(`语音识别异常: ${error.message}`, 'error')
      } finally {
        this.state.isProcessing = false
        this.renderUI()
      }
    }
  }
  
  /**
   * 发送消息给LLM
   */
  async sendToLLM() {
    const input = document.getElementById('llmInput')?.value?.trim()
    if (!input) {
      this.log('请输入要发送的消息', 'warn')
      return
    }
    
    this.log(`发送消息给LLM: ${input}`)
    this.state.isProcessing = true
    this.renderUI()
    
    const startTime = Date.now()
    
    try {
      const result = await window.electronAPI.invoke('game-chat-llm', {
        message: input,
        options: {
          timeout: this.config.llmTimeout,
          model: this.config.llmModel,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature
        }
      })
      
      const duration = Date.now() - startTime
      
      if (result.success) {
        // 提取LLM响应的文本内容
        const responseText = result.response && result.response.content ? result.response.content : (result.response || '')
        this.state.lastLLMResponse = responseText
        this.addTestResult('LLM对话', input, responseText, duration)
        this.log(`LLM响应成功`)
        
        // 清空输入框
        const inputElement = document.getElementById('llmInput')
        if (inputElement) inputElement.value = ''
      } else {
        this.state.lastLLMResponse = `错误: ${result.error}`
        this.addTestResult('LLM对话', input, '', duration, result.error)
        this.log(`LLM调用失败: ${result.error}`, 'error')
      }
      
    } catch (error) {
      const duration = Date.now() - startTime
      this.state.lastLLMResponse = `错误: ${error.message}`
      this.addTestResult('LLM对话', input, '', duration, error.message)
      this.log(`LLM调用异常: ${error.message}`, 'error')
    } finally {
      this.state.isProcessing = false
      this.renderUI()
    }
  }
  
  /**
   * 运行组合测试
   */
  async runCombinedTest() {
    this.log('开始组合测试：语音识别 + LLM对话')
    
    // 先进行语音识别
    await this.startRecording()
    
    // 等待用户停止录音
    this.log('请说话，然后点击停止录音按钮')
  }
  
  /**
   * 添加测试结果
   */
  addTestResult(type, input, output, duration, error = null) {
    const result = {
      timestamp: new Date().toLocaleString(),
      type: type,
      input: input,
      output: output,
      duration: duration,
      error: error
    }
    
    this.state.testResults.unshift(result) // 最新的在前面
    
    // 限制记录数量
    if (this.state.testResults.length > 50) {
      this.state.testResults = this.state.testResults.slice(0, 50)
    }
  }
  
  /**
   * 清空测试结果
   */
  clearResults() {
    this.state.testResults = []
    this.state.lastSpeechText = ''
    this.state.lastLLMResponse = ''
    this.renderUI()
    this.log('已清空测试记录')
  }
  
  /**
   * 退出游戏
   */
  async quitGame() {
    this.log('退出AI测试游戏')
    await this.stop()
  }
  
  /**
   * 日志记录
   */
  log(message, level = 'info') {
    const timestamp = new Date().toLocaleString()
    const logMessage = `[${timestamp}] [AI测试游戏] ${message}`
    
    switch (level) {
      case 'error':
        console.error(logMessage)
        break
      case 'warn':
        console.warn(logMessage)
        break
      default:
        console.log(logMessage)
    }
  }
  
  /**
   * 游戏停止
   */
  async stop() {
    this.log('AI测试游戏停止')
    
    this.state.isGameActive = false
    this.state.isRecording = false
    this.state.isProcessing = false
    
    // 停止录音
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop())
    }
    
    return true
  }
  
  /**
   * 游戏结束
   */
  async end(deviceManager) {
    await this.stop()
  }
}

// 导出游戏类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AITestGame
} else {
  window.AITestGame = AITestGame
}