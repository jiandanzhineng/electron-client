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
    this.apiUrl = 'https://api.siliconflow.cn/v1/audio/transcriptions';
    this.model = 'FunAudioLLM/SenseVoiceSmall';
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  // 从前端store获取API Token
  async getApiTokenFromFrontend() {
    try {
      if (this.mainWindow) {
        const result = await this.mainWindow.webContents.executeJavaScript(`
          window.aiStore ? window.aiStore.apiToken : ''
        `);
        return result || '';
      }
      return '';
    } catch (error) {
      logger.error('从前端获取API Token失败', 'stt', error);
      return '';
    }
  }

  // 检查配置是否完整
  async isConfigured() {
    const token = await this.getApiTokenFromFrontend();
    return token && token.trim() !== '';
  }

  // 语音转文本
  async transcribe(audioData) {
    if (!(await this.isConfigured())) {
      throw new Error('STT服务未配置，请先设置API Token');
    }

    if (!audioData) {
      throw new Error('音频数据不能为空');
    }

    const apiToken = await this.getApiTokenFromFrontend();
    if (!apiToken) {
      throw new Error('无法获取API Token');
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
          'Authorization': `Bearer ${apiToken}`
        },
        body: form
      };

      const response = await fetch(this.apiUrl, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API请求失败: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      // 如果API返回空文本或没有文本，返回空字符串而不是报错
      return data.text || '';
    } catch (error) {
      logger.error('语音转文本失败', 'stt', error);
      throw error;
    }
  }

  // 测试API连接
  async testConnection() {
    console.log('[STT Service] 开始测试连接');
    
    if (!(await this.isConfigured())) {
      const error = '请先设置API Token';
      console.error('[STT Service] 测试连接失败:', error);
      return { success: false, error };
    }

    const apiToken = await this.getApiTokenFromFrontend();
    console.log('[STT Service] 获取到API Token:', apiToken ? apiToken.substring(0, 10) + '...' : 'null');
    
    if (!apiToken) {
      const error = '无法获取API Token';
      console.error('[STT Service] 测试连接失败:', error);
      return { success: false, error };
    }

    return new Promise((resolve) => {
      try {
        const url = new URL(this.apiUrl);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;
        
        console.log('[STT Service] 发送请求到:', this.apiUrl);
        
        const options = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'multipart/form-data'
          },
          timeout: 5000
        };

        const req = httpModule.request(options, (res) => {
          console.log('[STT Service] 收到响应，状态码:', res.statusCode);
          
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            console.log('[STT Service] 响应数据:', data.substring(0, 200) + (data.length > 200 ? '...' : ''));
            
            if (res.statusCode < 500) {
              console.log('[STT Service] 连接测试成功');
              resolve({ success: true, message: 'STT API连接成功' });
            } else {
              console.error('[STT Service] 连接测试失败，状态码:', res.statusCode);
              console.error('[STT Service] 错误响应:', data);
              resolve({ success: false, error: `服务器错误: HTTP ${res.statusCode}` });
            }
          });
        });

        req.on('error', (error) => {
          console.error('[STT Service] 请求错误:', error);
          logger.error('STT连接测试失败', 'stt', error);
          resolve({ success: false, error: `连接失败: ${error.message}` });
        });

        req.on('timeout', () => {
          console.error('[STT Service] 请求超时');
          logger.error('STT连接测试超时', 'stt');
          req.destroy();
          resolve({ success: false, error: '请求超时' });
        });

        // 发送一个简单的测试请求
        req.write('test');
        req.end();
      } catch (error) {
        console.error('[STT Service] 连接测试异常:', error);
        console.error('[STT Service] 错误堆栈:', error.stack);
        logger.error('STT连接测试失败', 'stt', error);
        resolve({ success: false, error: `测试异常: ${error.message}` });
      }
    });
  }

  // 清理资源
  cleanup() {
    // 清理相关资源
  }
}

module.exports = new STTService();