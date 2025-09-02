import { defineStore } from 'pinia'

export const useAiStore = defineStore('ai', {
  state: () => ({
    // API Token配置
    apiToken: '',
    isConfigured: false,
    
    // 连接状态
    connectionStatus: 'disconnected', // disconnected, connecting, connected, error
    statusMessage: '',
    statusType: 'info', // info, success, warning, error
    
    // LLM相关配置
    availableModels: [
      'deepseek-chat',
      'deepseek-coder',
      'Qwen/Qwen2.5-7B-Instruct',
      'Qwen/Qwen2.5-Coder-7B-Instruct',
      'meta-llama/Meta-Llama-3.1-8B-Instruct',
      'meta-llama/Meta-Llama-3.1-70B-Instruct',
      'meta-llama/Meta-Llama-3.1-405B-Instruct',
      'THUDM/glm-4-9b-chat',
      'microsoft/Phi-3.5-mini-instruct'
    ],
    selectedModel: 'deepseek-chat',
    
    // 聊天测试相关
    chatHistory: [],
    isChatting: false
  }),

  getters: {
    // 检查是否已配置API Token
    hasValidToken: (state) => {
      return state.apiToken && state.apiToken.trim() !== ''
    },
    
    // 获取连接状态文本
    connectionStatusText: (state) => {
      switch(state.connectionStatus) {
        case 'connected': return '已连接'
        case 'connecting': return '连接中'
        case 'disconnected': return '未连接'
        case 'error': return '连接错误'
        default: return '未知状态'
      }
    },
    
    // 检查是否可以进行聊天测试
    canChat: (state) => {
      const hasToken = state.hasValidToken
      const notError = state.connectionStatus !== 'error'
      const notChatting = !state.isChatting
      const canChat = hasToken && notError && notChatting
      
      if (!canChat) {
        const reasons = []
        if (!hasToken) reasons.push('API Token未配置')
        if (!notError) reasons.push(`连接状态错误: ${state.connectionStatus}`)
        if (!notChatting) reasons.push('正在聊天中')
        console.log('[AI Store] canChat=false, 原因:', reasons.join(', '))
      }
      
      return canChat
    }
  },

  actions: {
    // 初始化store，从localStorage加载配置
    init() {
      this.loadConfig()
    },
    
    // 从localStorage加载配置
    loadConfig() {
      try {
        const savedConfig = localStorage.getItem('ai_config')
        if (savedConfig) {
          const config = JSON.parse(savedConfig)
          this.apiToken = config.apiToken || ''
          this.selectedModel = config.selectedModel || 'deepseek-chat'
          this.isConfigured = this.hasValidToken
        }
      } catch (error) {
        console.error('加载AI配置失败:', error)
        this.showStatus('加载配置失败', 'error')
      }
    },
    
    // 保存配置到localStorage
    saveConfig() {
      try {
        const config = {
          apiToken: this.apiToken,
          selectedModel: this.selectedModel
        }
        localStorage.setItem('ai_config', JSON.stringify(config))
        this.isConfigured = this.hasValidToken
      } catch (error) {
        console.error('保存AI配置失败:', error)
        this.showStatus('保存配置失败', 'error')
        throw error
      }
    },
    
    // 设置API Token
    setApiToken(token) {
      this.apiToken = token
      this.saveConfig()
      
      if (this.hasValidToken) {
        this.showStatus('API Token已保存', 'success')
      } else {
        this.showStatus('请输入有效的API Token', 'warning')
      }
    },
    
    // 设置选中的模型
    setSelectedModel(model) {
      this.selectedModel = model
      this.saveConfig()
    },
    
    // 测试连接
    async testConnection() {
      if (!this.hasValidToken) {
        const error = 'API Token未配置或无效'
        console.error('[AI Store] 测试连接失败:', error)
        this.showStatus(error, 'error')
        return { success: false, error }
      }

      try {
        this.connectionStatus = 'testing'
        this.showStatus('正在测试连接...', 'info')
        console.log('[AI Store] 开始测试连接，API Token:', this.apiToken.substring(0, 10) + '...')
        
        const result = await window.electronAPI.invoke('llm-test-connection')
        console.log('[AI Store] 连接测试结果:', result)
        
        if (result.success) {
          this.connectionStatus = 'connected'
          this.showStatus('连接测试成功', 'success')
          console.log('[AI Store] 连接测试成功')
          return { success: true, message: '连接成功' }
        } else {
          this.connectionStatus = 'disconnected'
          const errorMsg = result.error || '连接失败'
          console.error('[AI Store] 连接测试失败:', errorMsg)
          console.error('[AI Store] 完整错误信息:', result)
          this.showStatus('连接测试失败: ' + errorMsg, 'error')
          return { success: false, error: errorMsg }
        }
      } catch (error) {
        this.connectionStatus = 'disconnected'
        console.error('[AI Store] 连接测试异常:', error)
        console.error('[AI Store] 错误堆栈:', error.stack)
        this.showStatus('连接测试异常: ' + error.message, 'error')
        return { success: false, error: error.message }
      }
    },
    
    // 发送聊天消息
    async sendChatMessage(message, options = {}) {
      console.log('[AI Store] 开始发送聊天消息:', message)
      console.log('[AI Store] 聊天选项:', options)
      
      if (!this.canChat) {
        const error = '无法发送消息，请检查连接状态'
        console.error('[AI Store] 聊天失败:', error)
        this.showStatus(error, 'warning')
        return { success: false, error }
      }
      
      this.isChatting = true
      
      // 添加用户消息到历史
      this.chatHistory.push({
        role: 'user',
        content: message,
        timestamp: new Date().toLocaleTimeString()
      })
      
      try {
        // 通过IPC调用后端聊天
        const chatPayload = {
          message,
          model: options.model || this.selectedModel,
          maxTokens: options.maxTokens || 1000
        }
        
        console.log('[AI Store] 发送聊天请求:', chatPayload)
        const result = await window.electronAPI?.invoke('llm-chat', message, {
          model: chatPayload.model,
          maxTokens: chatPayload.maxTokens
        })
        
        console.log('[AI Store] 聊天结果:', result)
        
        if (result && result.success) {
          // 添加AI回复到历史
          this.chatHistory.push({
            role: 'assistant',
            content: result.data.content,
            timestamp: new Date().toLocaleTimeString(),
            model: chatPayload.model
          })
          
          console.log('[AI Store] 聊天成功')
          this.showStatus('对话完成', 'success')
          return {
            success: true,
            data: {
              content: result.data.content,
              model: result.data.model,
              usage: result.data.usage,
              duration: result.data.duration
            }
          }
        } else {
          const errorMsg = result?.error || '未知错误'
          console.error('[AI Store] 聊天失败:', errorMsg)
          console.error('[AI Store] 完整错误信息:', result)
          this.showStatus('聊天失败: ' + errorMsg, 'error')
          return { success: false, error: errorMsg }
        }
      } catch (error) {
        console.error('[AI Store] 聊天异常:', error)
        console.error('[AI Store] 错误堆栈:', error.stack)
        this.showStatus('聊天失败: ' + error.message, 'error')
        return { success: false, error: error.message }
      } finally {
        this.isChatting = false
      }
    },
    
    // 清除聊天历史
    clearChatHistory() {
      this.chatHistory = []
      this.showStatus('聊天记录已清除', 'info')
    },
    
    // 显示状态消息
    showStatus(message, type = 'info') {
      this.statusMessage = message
      this.statusType = type
      
      // 3秒后自动清除消息
      setTimeout(() => {
        if (this.statusMessage === message) {
          this.statusMessage = ''
        }
      }, 3000)
    },
    
    // 清理资源
    cleanup() {
      this.connectionStatus = 'disconnected'
      this.statusMessage = ''
      this.isChatting = false
    }
  }
})