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

      <!-- 其他设置区域可以在这里添加 -->
      <div class="settings-section">
        <h2>🔧 其他设置</h2>
        <div class="setting-item">
          <p class="placeholder-text">更多设置选项即将推出...</p>
        </div>
      </div>
    </div>

    <!-- 状态消息 -->
    <div v-if="statusMessage" :class="['status-message', statusType]">
      {{ statusMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

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

// 显示状态消息
const showStatus = (message, type = 'info', duration = 3000) => {
  statusMessage.value = message
  statusType.value = type
  setTimeout(() => {
    statusMessage.value = ''
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

// 组件挂载时初始化
onMounted(() => {
  checkTTSSupport()
})

// 组件卸载时清理
onUnmounted(() => {
  if (isSpeaking.value) {
    stopTTS()
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

.not-supported-message {
  background-color: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
  padding: 15px;
  color: #856404;
}

.not-supported-message p {
  margin: 5px 0;
}

.placeholder-text {
  color: #7f8c8d;
  font-style: italic;
  text-align: center;
  padding: 20px;
}

.status-message {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 20px;
  border-radius: 4px;
  font-weight: 600;
  z-index: 1000;
  animation: slideIn 0.3s ease;
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

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
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