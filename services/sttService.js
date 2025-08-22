/**
 * STT (Speech-to-Text) 服务模块
 * 处理语音转文本功能
 */

const logger = require('./logService');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class STTService {
  constructor() {
    this.mainWindow = null;
    this.apiToken = null;
    this.apiUrl = 'https://api.siliconflow.cn/v1/audio/transcriptions';
    this.model = 'FunAudioLLM/SenseVoiceSmall';
    this.configPath = path.join(__dirname, '../config/stt-config.json');
    this.loadConfig();
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  // 加载配置
  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        this.apiToken = config.apiToken;
      }
    } catch (error) {
      logger.error('加载STT配置失败', 'stt', error);
    }
  }

  // 保存配置
  saveConfig() {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      const config = {
        apiToken: this.apiToken
      };
      
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      logger.error('保存STT配置失败', 'stt', error);
      throw error;
    }
  }

  // 设置API Token
  setApiToken(token) {
    this.apiToken = token;
    this.saveConfig();
  }

  // 获取API Token
  getApiToken() {
    return this.apiToken;
  }

  // 检查配置是否完整
  isConfigured() {
    return !!this.apiToken;
  }

  // 语音转文本
  async transcribe(audioData) {
    if (!this.isConfigured()) {
      throw new Error('STT服务未配置，请先设置API Token');
    }

    if (!audioData) {
      throw new Error('音频数据不能为空');
    }

    try {
      // 将Uint8Array转换为Blob
      const audioBlob = new Blob([audioData], { type: 'audio/wav' });
      
      const form = new FormData();
      form.append('model', this.model);
      form.append('file', audioBlob, 'audio.wav');

      const options = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        },
        body: form
      };

      const response = await fetch(this.apiUrl, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API请求失败: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      if (data.text) {
        return data.text;
      } else {
        throw new Error('API返回数据格式错误');
      }
    } catch (error) {
      logger.error('语音转文本失败', 'stt', error);
      throw error;
    }
  }

  // 测试API连接
  async testConnection() {
    if (!this.isConfigured()) {
      throw new Error('请先设置API Token');
    }

    return new Promise((resolve) => {
      try {
        const url = new URL(this.apiUrl);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;
        
        const options = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'multipart/form-data'
          },
          timeout: 5000
        };

        const req = httpModule.request(options, (res) => {
          // 即使返回错误，只要能连接到API就算成功
          resolve(res.statusCode < 500);
        });

        req.on('error', (error) => {
          logger.error('STT连接测试失败', 'stt', error);
          resolve(false);
        });

        req.on('timeout', () => {
          logger.error('STT连接测试超时', 'stt');
          req.destroy();
          resolve(false);
        });

        // 发送一个简单的测试请求
        req.write('test');
        req.end();
      } catch (error) {
        logger.error('STT连接测试失败', 'stt', error);
        resolve(false);
      }
    });
  }

  // 清理资源
  cleanup() {
    // 清理相关资源
  }
}

module.exports = new STTService();