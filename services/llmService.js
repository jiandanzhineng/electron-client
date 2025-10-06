/**
 * LLM (Large Language Model) 服务模块
 * 处理大语言模型对话功能，使用硅基流动API
 */

const logger = require('./logService');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class LLMService {
  constructor() {
    this.mainWindow = null;
    this.apiUrl = 'https://api.siliconflow.cn/v1/chat/completions';
    this.defaultModel = 'Qwen/Qwen2.5-7B-Instruct';
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  // 设置API Key (兼容性方法，实际不使用)
  setApiKey(key) {
    // 不再使用，API Key由前端store管理
  }

  // 从前端获取API Token
  async getApiTokenFromFrontend() {
    if (!this.mainWindow) {
      throw new Error('主窗口未设置');
    }
    
    try {
      const token = await this.mainWindow.webContents.executeJavaScript(
        'window.aiStore ? window.aiStore.apiToken : null'
      );
      return token;
    } catch (error) {
      logger.error('从前端获取API Token失败', 'llm', error);
      return null;
    }
  }

  // 检查配置是否完整
  async isConfigured() {
    const token = await this.getApiTokenFromFrontend();
    return token && token.trim().length > 0;
  }

  // 发送聊天请求
  async chat(message, options = {}) {
    if (!(await this.isConfigured())) {
      throw new Error('LLM服务未配置，请先设置API Key');
    }

    if (!message || typeof message !== 'string') {
      throw new Error('消息内容不能为空');
    }

    const apiToken = await this.getApiTokenFromFrontend();
    if (!apiToken) {
      throw new Error('无法获取API Token');
    }

    try {
      const startTime = Date.now();
      
      const payload = {
        model: options.model || this.defaultModel,
        messages: [
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.9
      };

      const requestOptions = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      };

      logger.info('发送LLM请求', 'llm', { model: payload.model, messageLength: message.length });

      const response = await fetch(this.apiUrl, requestOptions);
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('LLM API请求失败', 'llm', { 
          status: response.status, 
          statusText: response.statusText,
          error: errorText 
        });
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      logger.info('LLM请求完成', 'llm', { 
        duration: `${duration.toFixed(2)}秒`,
        usage: result.usage 
      });

      if (result.choices && result.choices.length > 0) {
        return {
          success: true,
          data: {
            content: result.choices[0].message.content,
            model: result.model,
            usage: result.usage,
            duration: duration
          }
        };
      } else {
        throw new Error('API返回数据格式异常');
      }

    } catch (error) {
      logger.error('LLM聊天失败', 'llm', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 测试连接
  async testConnection() {
    console.log('[LLM Service] 开始测试连接');
    
    if (!(await this.isConfigured())) {
      const error = '请先设置API Token';
      console.error('[LLM Service] 测试连接失败:', error);
      return { success: false, error };
    }

    const apiToken = await this.getApiTokenFromFrontend();
    console.log('[LLM Service] 获取到API Token:', apiToken ? apiToken.substring(0, 10) + '...' : 'null');

    return new Promise((resolve) => {
      const postData = JSON.stringify({
        model: 'Qwen/Qwen2.5-7B-Instruct',
        messages: [{
          role: 'user',
          content: 'Hello'
        }],
        max_tokens: 10
      });

      const options = {
        hostname: 'api.siliconflow.cn',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      console.log('[LLM Service] 发送请求到:', `https://${options.hostname}${options.path}`);

      const req = require('https').request(options, (res) => {
        let data = '';
        console.log('[LLM Service] 收到响应，状态码:', res.statusCode);
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            console.log('[LLM Service] 响应数据:', data.substring(0, 200) + (data.length > 200 ? '...' : ''));
            
            if (res.statusCode === 200) {
              console.log('[LLM Service] 连接测试成功');
              resolve({ success: true, message: 'API Token验证成功' });
            } else {
              let errorMessage = `HTTP ${res.statusCode}`;
              try {
                const errorData = JSON.parse(data);
                errorMessage = errorData.error?.message || errorMessage;
                console.error('[LLM Service] API错误响应:', errorData);
              } catch (parseError) {
                console.error('[LLM Service] 响应解析失败:', parseError.message);
                console.error('[LLM Service] 原始响应:', data);
              }
              console.error('[LLM Service] 连接测试失败:', errorMessage);
              resolve({ success: false, error: errorMessage });
            }
          } catch (error) {
            console.error('[LLM Service] 处理响应时发生错误:', error);
            resolve({ success: false, error: '响应处理失败: ' + error.message });
          }
        });
      });

      req.on('error', (error) => {
        console.error('[LLM Service] 请求错误:', error);
        resolve({ success: false, error: `连接失败: ${error.message}` });
      });

      req.setTimeout(10000, () => {
        console.error('[LLM Service] 请求超时');
        req.destroy();
        resolve({ success: false, error: '请求超时' });
      });

      req.write(postData);
      req.end();
    });
  }

  // 获取可用模型列表
  getAvailableModels() {
    return [
      'Qwen/Qwen2.5-7B-Instruct',
      'Qwen/Qwen2.5-14B-Instruct',
      'Qwen/Qwen2.5-32B-Instruct',
      'Qwen/Qwen2.5-72B-Instruct',
      'deepseek-ai/DeepSeek-V2.5',
      'meta-llama/Meta-Llama-3.1-8B-Instruct',
      'meta-llama/Meta-Llama-3.1-70B-Instruct',
      'THUDM/glm-4-9b-chat',
      'internlm/internlm2_5-7b-chat'
    ];
  }

  // 清理资源
  cleanup() {
    logger.info('LLM服务清理完成', 'llm');
  }
}

module.exports = new LLMService();