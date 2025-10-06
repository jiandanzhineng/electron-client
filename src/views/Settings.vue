<template>
  <div class="settings">
    <div class="settings-header">
      <h1>设置</h1>
      <p>配置应用程序的各项设置</p>
    </div>

    <div class="settings-content">
      <!-- TTS设置区域 -->
      <div class="settings-section">
        <h2>🔊 TTS (文本转语音) 设置</h2>
        
        <!-- TTS支持状态 -->
        <div class="setting-item">
          <label>TTS支持状态:</label>
          <span :class="['status', ttsSupported ? 'supported' : 'not-supported']">
            {{ ttsSupported ? '✅ 支持' : '❌ 不支持' }}
          </span>
        </div>

        <div v-if="ttsSupported">
          <!-- 语音选择 -->
          <div class="setting-item">
            <label for="voice-select">语音:</label>
            <select 
              id="voice-select" 
              v-model="selectedVoice" 
              @change="onVoiceChange"
              :disabled="loading"
            >
              <option value="">选择语音...</option>
              <option 
                v-for="voice in availableVoices" 
                :key="voice.Name" 
                :value="voice.Name"
              >
                {{ voice.Name }} {{ voice.Culture ? `(${voice.Culture})` : '' }}
              </option>
            </select>
          </div>

          <!-- 语音参数设置 -->
          <div class="setting-item">
            <label for="voice-rate">语音速度:</label>
            <div class="slider-container">
              <input 
                id="voice-rate" 
                type="range" 
                min="-10" 
                max="10" 
                step="1" 
                v-model="voiceRate"
                @input="onVoiceRateChange"
              >
              <span class="slider-value">{{ voiceRate }}</span>
            </div>
          </div>

          <!-- 测试文本输入 -->
          <div class="setting-item">
            <label for="test-text">测试文本:</label>
            <textarea 
              id="test-text" 
              v-model="testText" 
              placeholder="输入要测试的文本..."
              rows="3"
              :disabled="loading || isSpeaking"
            ></textarea>
          </div>

          <!-- 测试按钮 -->
          <div class="setting-item">
            <div class="button-group">
              <button 
                @click="testTTS" 
                :disabled="loading || isSpeaking || !testText.trim()"
                class="btn btn-primary"
              >
                <span v-if="isSpeaking">🔊 播放中...</span>
                <span v-else>🎵 测试播放</span>
              </button>
              <button 
                @click="stopTTS" 
                :disabled="loading || !isSpeaking"
                class="btn btn-secondary"
              >
                ⏹️ 停止
              </button>
            </div>
          </div>
        </div>

        <div v-else class="not-supported-message">
          <p>⚠️ 当前系统不支持TTS功能，或者缺少必要的组件。</p>
          <p>请确保您的系统已安装相应的TTS引擎。</p>
        </div>
      </div>

      <!-- AI功能设置区域 -->
      <div class="settings-section">
        <h2>🤖 AI功能设置</h2>
        
        <!-- 统一API Token配置 -->
        <div class="ai-subsection">
          <h3>🔑 API Token 配置</h3>
          <div class="setting-item">
            <label for="ai-token">硅基流动 API Token:</label>
            <div class="token-input-group">
              <input 
                id="ai-token" 
                type="text" 
                v-model="aiToken" 
                placeholder="请输入硅基流动API Token（用于STT和LLM功能）..."
                :disabled="loading"
              >
              <button 
                @click="saveAiToken" 
                :disabled="loading || !aiToken.trim()"
                class="btn btn-primary btn-sm"
              >
                💾 保存
              </button>
              <button 
                @click="testAiConnection" 
                :disabled="loading || !aiConfigured"
                class="btn btn-info btn-sm"
              >
                🔗 测试连接
              </button>
            </div>
            
            <!-- 状态提示 -->
            <div v-if="aiStatusMessage" class="status-message" :class="aiStatusType">
              {{ aiStatusMessage }}
            </div>
          </div>

          <!-- 配置状态 -->
          <div class="setting-item">
            <label>配置状态:</label>
            <span :class="['status', aiConfigured ? 'configured' : 'not-configured']">
              {{ aiConfigured ? '✅ 已配置' : '❌ 未配置' }}
            </span>
          </div>
        </div>
        
        <!-- STT设置子区域 -->
        <div class="ai-subsection" v-if="aiConfigured">
          <h3>🎤 STT (语音转文本)</h3>

        <div>
          <!-- 录音测试区域 -->
           <div class="setting-item">
             <label>录音测试:</label>
             <div class="recording-controls">
               <button 
                 @click="startRecording" 
                 :disabled="loading || isRecording || isTranscribing"
                 class="btn btn-primary"
               >
                 <span v-if="isRecording">🔴 录音中...</span>
                 <span v-else>🎤 开始录音</span>
               </button>
               <button 
                 @click="stopRecording" 
                 :disabled="loading || !isRecording || isTranscribing"
                 class="btn btn-secondary"
               >
                 ⏹️ 结束录音
               </button>
               <button 
                 @click="playRecording" 
                 :disabled="loading || isRecording || isTranscribing || !hasRecording || isPlaying"
                 class="btn btn-info"
               >
                 <span v-if="isPlaying">🔊 播放中...</span>
                 <span v-else>▶️ 播放录音</span>
               </button>
               <button 
                 @click="stopPlayback" 
                 :disabled="loading || !isPlaying"
                 class="btn btn-warning"
               >
                 ⏸️ 停止播放
               </button>
             </div>
           </div>

          <!-- 转录结果 -->
          <div class="setting-item" v-if="transcriptionResult">
            <label>转录结果:</label>
            <div class="transcription-result">
              {{ transcriptionResult }}
            </div>
          </div>

          <!-- 转录状态 -->
          <div class="setting-item" v-if="isTranscribing">
            <div class="transcribing-status">
              🔄 正在转录中，请稍候...
            </div>
          </div>
        </div>

        </div>
        <!-- STT设置子区域结束 -->
        
        <!-- LLM设置子区域 -->
        <div class="ai-subsection" v-if="aiConfigured">
          <h3>🧠 LLM (大语言模型)</h3>
          
          <div>
            <!-- 模型选择 -->
            <div class="setting-item">
              <label for="llm-model-select">模型选择:</label>
              <select 
                id="llm-model-select" 
                v-model="selectedLlmModel" 
                :disabled="loading"
              >
                <option 
                  v-for="model in availableLlmModels" 
                  :key="model" 
                  :value="model"
                >
                  {{ model }}
                </option>
              </select>
            </div>

            <!-- 对话测试区域 -->
            <div class="setting-item">
              <label for="llm-test-message">对话测试:</label>
              <textarea 
                id="llm-test-message" 
                v-model="llmTestMessage" 
                placeholder="输入要测试的消息..."
                rows="3"
                :disabled="loading || isLlmChatting"
              ></textarea>
            </div>

            <!-- 测试按钮 -->
            <div class="setting-item">
              <div class="button-group">
                <button 
                  @click="testLlmChat" 
                  :disabled="loading || isLlmChatting || !llmTestMessage.trim()"
                  class="btn btn-primary"
                >
                  <span v-if="isLlmChatting">🤖 对话中...</span>
                  <span v-else>💬 发送消息</span>
                </button>
                <button 
                  @click="clearLlmChat" 
                  :disabled="loading"
                  class="btn btn-secondary"
                >
                  🗑️ 清空对话
                </button>
              </div>
            </div>

            <!-- 对话结果 -->
            <div class="setting-item" v-if="llmChatResult">
              <label>AI回复:</label>
              <div class="chat-result">
                <div class="chat-message user-message">
                  <strong>用户:</strong> {{ llmLastUserMessage }}
                </div>
                <div class="chat-message ai-message">
                  <strong>AI:</strong> {{ llmChatResult }}
                </div>
                <div v-if="llmChatDuration" class="chat-info">
                  耗时: {{ llmChatDuration }}秒 | 模型: {{ selectedLlmModel }}
                </div>
              </div>
            </div>
          </div>

        </div>
        <!-- LLM设置子区域结束 -->
        
        <div v-if="!aiConfigured" class="not-configured-message">
          <p>⚠️ 请先配置API Token才能使用AI功能（STT和LLM）。</p>
          <p>您可以在硅基流动官网获取API Token。</p>
        </div>
      </div>

      <!-- 其他设置区域可以在这里添加 -->
      <div class="settings-section">
        <h2>🔧 其他设置</h2>
        <div class="setting-item">
          <p class="placeholder-text">更多设置选项即将推出...</p>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useAiStore } from '@/stores/aiStore'

// 初始化Pinia store
const aiStore = useAiStore()

// 响应式数据
const ttsSupported = ref(false)
const availableVoices = ref([])
const selectedVoice = ref('')
const voiceRate = ref(0)
const testText = ref('你好，这是一个TTS测试。Hello, this is a TTS test.')
const loading = ref(false)
const isSpeaking = ref(false)
const statusMessage = ref('')
const statusType = ref('info') // 'info', 'success', 'error'

// AI配置现在通过aiStore管理，创建计算属性来访问
const aiToken = ref('')
const aiConfigured = ref(false)
const aiStatusMessage = ref('')
const aiStatusType = ref('info')

// STT相关响应式数据
const isRecording = ref(false)
const isTranscribing = ref(false)
const transcriptionResult = ref('')
const mediaRecorder = ref(null)
const audioChunks = ref([])
const recordedAudioBlob = ref(null)
const hasRecording = ref(false)
const isPlaying = ref(false)
const audioPlayer = ref(null)

// LLM相关响应式数据
const selectedLlmModel = ref('Qwen/Qwen2.5-7B-Instruct')
const availableLlmModels = ref([])
const llmTestMessage = ref('你好，请介绍一下你自己。')
const isLlmChatting = ref(false)
const llmChatResult = ref('')
const llmLastUserMessage = ref('')
const llmChatDuration = ref(null)

// 显示状态消息
const showStatus = (message, type = 'info', duration = 3000) => {
  statusMessage.value = message
  statusType.value = type
  setTimeout(() => {
    statusMessage.value = ''
  }, duration)
}

// 显示AI状态消息
const showAiStatus = (message, type = 'info', duration = 3000) => {
  aiStatusMessage.value = message
  aiStatusType.value = type
  setTimeout(() => {
    aiStatusMessage.value = ''
  }, duration)
}

// 检查TTS支持
const checkTTSSupport = async () => {
  try {
    loading.value = true
    const result = await window.electronAPI.invoke('tts-check-support')
    if (result.success) {
        ttsSupported.value = result.data
        if (ttsSupported.value) {
          await loadAvailableVoices()
        }
      } else {
      showStatus('检查TTS支持失败: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('检查TTS支持失败:', error)
    showStatus('检查TTS支持失败', 'error')
  } finally {
    loading.value = false
  }
}

// 加载可用语音列表
const loadAvailableVoices = async () => {
  try {
    const result = await window.electronAPI.invoke('tts-get-voices')
    if (result.success) {
      availableVoices.value = result.data
      if (availableVoices.value.length > 0) {
        selectedVoice.value = availableVoices.value[0].Name
      }
    } else {
      showStatus('获取语音列表失败: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('获取语音列表失败:', error)
    showStatus('获取语音列表失败', 'error')
  }
}

// 语音变更处理
const onVoiceChange = () => {
  showStatus('语音已更改', 'success')
}

// 语音速度变更处理
const onVoiceRateChange = () => {
  // 实时更新，不显示消息
}

// 测试TTS
const testTTS = async () => {
  if (!testText.value.trim()) {
    showStatus('请输入测试文本', 'error')
    return
  }

  try {
    isSpeaking.value = true
    const options = {
      voice: selectedVoice.value,
      rate: parseInt(voiceRate.value)
    }
    
    const result = await window.electronAPI.invoke('tts-speak', testText.value, options)
    if (result.success) {
      showStatus('TTS播放完成', 'success')
    } else {
      showStatus('TTS播放失败: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('TTS播放失败:', error)
    showStatus('TTS播放失败', 'error')
  } finally {
    isSpeaking.value = false
  }
}

// 停止TTS
const stopTTS = async () => {
  try {
    const result = await window.electronAPI.invoke('tts-stop')
    if (result.success) {
      showStatus('TTS播放已停止', 'success')
    } else {
      showStatus('停止TTS失败: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('停止TTS失败:', error)
    showStatus('停止TTS失败', 'error')
  } finally {
    isSpeaking.value = false
  }
}

// AI统一配置方法
const loadAiConfig = async () => {
  try {
    await aiStore.loadConfig()
    // 同步store状态到本地响应式变量
    aiToken.value = aiStore.apiToken
    aiConfigured.value = aiStore.isConfigured
  } catch (error) {
    console.error('加载AI配置失败:', error)
  }
}

const saveAiToken = async () => {
  if (!aiToken.value.trim()) {
    showAiStatus('请输入有效的API Token', 'error')
    return
  }

  try {
    loading.value = true
    aiStore.setApiToken(aiToken.value.trim())
    aiConfigured.value = aiStore.isConfigured
    showAiStatus('API Token保存成功', 'success')
    // 重新加载LLM模型列表
    await loadLlmModels()
  } catch (error) {
    console.error('保存AI Token失败:', error)
    showAiStatus('保存失败', 'error')
  } finally {
    loading.value = false
  }
}

const testAiConnection = async () => {
  try {
    loading.value = true
    console.log('[Settings] 开始测试AI连接')
    const result = await aiStore.testConnection()
    console.log('[Settings] AI连接测试结果:', result)
    
    if (result.success) {
      showAiStatus('连接测试成功', 'success')
    } else {
      const errorMsg = result.error || '连接测试失败，请检查API Token是否正确'
      console.error('[Settings] AI连接测试失败:', errorMsg)
      showAiStatus(`连接测试失败: ${errorMsg}`, 'error')
    }
  } catch (error) {
    console.error('[Settings] AI连接测试异常:', error)
    console.error('[Settings] 错误堆栈:', error.stack)
    showAiStatus(`连接测试异常: ${error.message}`, 'error')
  } finally {
    loading.value = false
  }
}

const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.value = new MediaRecorder(stream)
    audioChunks.value = []
    
    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.value.push(event.data)
      }
    }
    
    mediaRecorder.value.onstop = async () => {
      const audioBlob = new Blob(audioChunks.value, { type: 'audio/wav' })
      recordedAudioBlob.value = audioBlob
      hasRecording.value = true
      await transcribeAudio(audioBlob)
      
      // 停止所有音频轨道
      stream.getTracks().forEach(track => track.stop())
    }
    
    mediaRecorder.value.start()
    isRecording.value = true
    transcriptionResult.value = ''
    showStatus('开始录音...', 'info')
  } catch (error) {
    console.error('开始录音失败:', error)
    showStatus('无法访问麦克风，请检查权限设置', 'error')
  }
}

const stopRecording = () => {
  if (mediaRecorder.value && isRecording.value) {
    mediaRecorder.value.stop()
    isRecording.value = false
    showStatus('录音结束，正在转录...', 'info')
  }
}

const transcribeAudio = async (audioBlob) => {
  try {
    isTranscribing.value = true
    
    // 将Blob转换为ArrayBuffer
    const arrayBuffer = await audioBlob.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    const result = await window.electronAPI.invoke('stt-transcribe', uint8Array)
    if (result.success) {
      transcriptionResult.value = result.data
      showStatus('转录完成', 'success')
    } else {
      showStatus('转录失败: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('转录失败:', error)
    showStatus('转录失败', 'error')
  } finally {
    isTranscribing.value = false
  }
}

const playRecording = () => {
  if (!recordedAudioBlob.value) {
    showStatus('没有可播放的录音', 'warning')
    return
  }
  
  try {
    // 创建音频URL
    const audioUrl = URL.createObjectURL(recordedAudioBlob.value)
    
    // 创建音频播放器
    audioPlayer.value = new Audio(audioUrl)
    
    // 设置播放结束事件
    audioPlayer.value.onended = () => {
      isPlaying.value = false
      URL.revokeObjectURL(audioUrl)
      audioPlayer.value = null
      showStatus('录音播放完成', 'success')
    }
    
    // 设置播放错误事件
    audioPlayer.value.onerror = (error) => {
      console.error('播放录音失败:', error)
      isPlaying.value = false
      URL.revokeObjectURL(audioUrl)
      audioPlayer.value = null
      showStatus('播放录音失败', 'error')
    }
    
    // 开始播放
    audioPlayer.value.play()
    isPlaying.value = true
    showStatus('开始播放录音...', 'info')
  } catch (error) {
    console.error('播放录音失败:', error)
    showStatus('播放录音失败', 'error')
  }
}

const stopPlayback = () => {
  if (audioPlayer.value) {
    audioPlayer.value.pause()
    audioPlayer.value.currentTime = 0
    
    // 清理资源
    const audioUrl = audioPlayer.value.src
    if (audioUrl.startsWith('blob:')) {
      URL.revokeObjectURL(audioUrl)
    }
    
    audioPlayer.value = null
    isPlaying.value = false
    showStatus('停止播放录音', 'info')
  }
}



// LLM相关方法
const loadLlmModels = async () => {
  try {
    const modelsResult = await window.electronAPI.invoke('ai-get-models')
    if (modelsResult.success) {
      availableLlmModels.value = modelsResult.data
    }
  } catch (error) {
    console.error('加载LLM模型失败:', error)
  }
}

const testLlmChat = async () => {
  if (!llmTestMessage.value.trim()) {
    showAiStatus('请输入测试消息', 'warning')
    return
  }
  
  try {
    isLlmChatting.value = true
    llmLastUserMessage.value = llmTestMessage.value
    showAiStatus('正在对话...', 'info')
    
    console.log('[Settings] 开始LLM对话测试')
    console.log('[Settings] 测试消息:', llmTestMessage.value)
    console.log('[Settings] 选中的模型:', selectedLlmModel.value)
    
    const options = {
      model: selectedLlmModel.value,
      maxTokens: 1000
    }
    
    console.log('[Settings] 对话选项:', options)
    const result = await aiStore.sendChatMessage(llmTestMessage.value, options)
    console.log('[Settings] LLM对话结果:', result)
    
    if (result && result.success) {
      llmChatResult.value = result.data.content
      llmChatDuration.value = result.data.duration?.toFixed(2)
      showAiStatus('对话完成', 'success')
      console.log('[Settings] LLM对话成功，内容长度:', result.data.content?.length)
    } else {
      const errorMsg = result?.error || '未知错误'
      console.error('[Settings] LLM对话失败:', errorMsg)
      console.error('[Settings] 完整错误信息:', result)
      showAiStatus('对话失败: ' + errorMsg, 'error')
    }
  } catch (error) {
    console.error('[Settings] LLM对话异常:', error)
    console.error('[Settings] 错误堆栈:', error.stack)
    showAiStatus('对话异常: ' + error.message, 'error')
  } finally {
    isLlmChatting.value = false
  }
}

const clearLlmChat = () => {
  llmChatResult.value = ''
  llmLastUserMessage.value = ''
  llmChatDuration.value = null
  llmTestMessage.value = '你好，请介绍一下你自己。'
  showAiStatus('对话已清空', 'info')
}

// 组件挂载时初始化
onMounted(() => {
  checkTTSSupport()
  loadAiConfig()
  loadLlmModels()
})

// 组件卸载时清理
onUnmounted(() => {
  if (isSpeaking.value) {
    stopTTS()
  }
  
  // 清理音频播放器
  if (audioPlayer.value) {
    stopPlayback()
  }
  
  // 清理录音资源
  if (recordedAudioBlob.value) {
    recordedAudioBlob.value = null
    hasRecording.value = false
  }
})
</script>

<style scoped>
.settings {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.settings-header {
  margin-bottom: 30px;
  text-align: center;
}

.settings-header h1 {
  color: #2c3e50;
  margin-bottom: 10px;
}

.settings-header p {
  color: #7f8c8d;
  font-size: 16px;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.settings-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #e9ecef;
}

.settings-section h2 {
  color: #2c3e50;
  margin-bottom: 20px;
  font-size: 18px;
  border-bottom: 2px solid #3498db;
  padding-bottom: 10px;
}

.setting-item {
  margin-bottom: 20px;
}

.setting-item label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #34495e;
}

.setting-item select,
.setting-item textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  transition: border-color 0.3s ease;
}

.setting-item select:focus,
.setting-item textarea:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.setting-item select:disabled,
.setting-item textarea:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 15px;
}

.slider-container input[type="range"] {
  flex: 1;
  height: 6px;
  background: #ddd;
  border-radius: 3px;
  outline: none;
}

.slider-container input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  background: #3498db;
  border-radius: 50%;
  cursor: pointer;
}

.slider-container input[type="range"]::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: #3498db;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.slider-value {
  min-width: 50px;
  text-align: center;
  font-weight: 600;
  color: #2c3e50;
}

.button-group {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 5px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #3498db;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #2980b9;
}

.btn-secondary {
  background-color: #95a5a6;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #7f8c8d;
}

.status {
  font-weight: 600;
  padding: 5px 10px;
  border-radius: 4px;
}

.status.supported {
  background-color: #d4edda;
  color: #155724;
}

.status.not-supported {
  background-color: #f8d7da;
  color: #721c24;
}

.not-supported-message,
.not-configured-message {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
  padding: 15px;
  margin-top: 15px;
}

.not-supported-message p,
.not-configured-message p {
  margin: 5px 0;
  color: #856404;
}

/* STT相关样式 */
.token-input-group {
  display: flex;
  gap: 10px;
  align-items: center;
}

.token-input-group input {
  flex: 1;
}

.recording-controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.transcription-result {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 15px;
  margin-top: 10px;
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-word;
}

.transcribing-status {
  background: #e3f2fd;
  border: 1px solid #bbdefb;
  border-radius: 4px;
  padding: 10px;
  color: #1976d2;
  text-align: center;
  font-weight: 500;
}

.status.configured {
  color: #27ae60;
  font-weight: 600;
}

.status.not-configured {
  color: #e74c3c;
  font-weight: 600;
}

.btn-info {
  background: #17a2b8;
  color: white;
  border: 1px solid #17a2b8;
}

.btn-info:hover {
  background: #138496;
  border-color: #117a8b;
}

.btn-info:disabled {
  background: #6c757d;
  border-color: #6c757d;
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-warning {
  background: #ffc107;
  color: #212529;
  border: 1px solid #ffc107;
}

.btn-warning:hover:not(:disabled) {
  background: #e0a800;
  border-color: #d39e00;
}

.btn-warning:disabled {
  background: #6c757d;
  border-color: #6c757d;
  opacity: 0.6;
  cursor: not-allowed;
}

.placeholder-text {
  color: #7f8c8d;
  font-style: italic;
  text-align: center;
  padding: 20px;
}

.status-message {
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 4px;
  font-weight: 500;
  font-size: 14px;
  animation: fadeIn 0.3s ease;
}

.status-message.info {
  background-color: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

.status-message.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-message.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* AI功能设置相关样式 */
.ai-subsection {
  margin-bottom: 25px;
  padding: 15px;
  background: #ffffff;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.ai-subsection h3 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 16px;
  border-bottom: 1px solid #ecf0f1;
  padding-bottom: 8px;
}

/* LLM对话结果样式 */
.chat-result {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 15px;
  margin-top: 10px;
}

.chat-message {
  margin-bottom: 10px;
  padding: 8px 12px;
  border-radius: 4px;
  word-wrap: break-word;
}

.user-message {
  background: #e3f2fd;
  border-left: 3px solid #2196f3;
}

.ai-message {
  background: #f3e5f5;
  border-left: 3px solid #9c27b0;
}

.chat-info {
  font-size: 12px;
  color: #666;
  text-align: right;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e0e0e0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .settings {
    padding: 15px;
  }
  
  .button-group {
    flex-direction: column;
  }
  
  .slider-container {
    flex-direction: column;
    align-items: stretch;
  }
  
  .status-message {
    position: relative;
    top: auto;
    right: auto;
    margin-top: 20px;
  }
}
</style>