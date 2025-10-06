/**
 * AI 服务模块
 * 统一管理AI功能的API Token，为STT和LLM提供共享的认证服务
 */

const logger = require('./logService');

class AIService {
  constructor() {
    this.mainWindow = null;
    // 移除文件系统配置管理，改为通过前端store管理
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  // 从前端获取API Token
  async getApiTokenFromFrontend() {
    try {
      if (this.mainWindow) {
        // 通过IPC从前端获取当前的API Token
        const result = await this.mainWindow.webContents.executeJavaScript(`
          window.aiStore ? window.aiStore.apiToken : ''
        `);
        return result || '';
      }
      return '';
    } catch (error) {
      logger.error('从前端获取API Token失败', 'ai', error);
      return '';
    }
  }

  // 检查是否已配置（通过前端store）
  async isConfigured() {
    const token = await this.getApiTokenFromFrontend();
    return token && token.trim() !== '';
  }

  // 获取配置（从前端store）
  async getConfig() {
    const token = await this.getApiTokenFromFrontend();
    return {
      apiToken: token,
      isConfigured: await this.isConfigured()
    };
  }

  // AI对话 (委托给LLM服务)
  async chat(message, options = {}) {
    const apiToken = await this.getApiTokenFromFrontend();
    if (!apiToken) {
      throw new Error('API Token未配置');
    }
    const llmService = require('./llmService');
    // 设置LLM服务的API密钥
    llmService.setApiKey(apiToken);
    return await llmService.chat(message, options);
  }

  // 获取可用模型列表 (委托给LLM服务)
  async getAvailableModels() {
    const apiToken = await this.getApiTokenFromFrontend();
    if (!apiToken) {
      throw new Error('API Token未配置');
    }
    const llmService = require('./llmService');
    llmService.setApiKey(apiToken);
    return llmService.getAvailableModels();
  }

  // 测试API Token连接
  async testConnection() {
    console.log('[AI Service] 开始测试连接');
    
    if (!(await this.isConfigured())) {
      const error = 'API Token未配置';
      console.error('[AI Service] 测试连接失败:', error);
      return { success: false, error };
    }

    const apiToken = await this.getApiTokenFromFrontend();
    console.log('[AI Service] 获取到API Token:', apiToken ? apiToken.substring(0, 10) + '...' : 'null');

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

      console.log('[AI Service] 发送请求到:', `https://${options.hostname}${options.path}`);

      const req = require('https').request(options, (res) => {
        let data = '';
        console.log('[AI Service] 收到响应，状态码:', res.statusCode);
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            console.log('[AI Service] 响应数据:', data.substring(0, 200) + (data.length > 200 ? '...' : ''));
            
            if (res.statusCode === 200) {
              console.log('[AI Service] 连接测试成功');
              resolve({ success: true, message: 'API Token验证成功' });
            } else {
              let errorMessage = `HTTP ${res.statusCode}`;
              try {
                const errorData = JSON.parse(data);
                errorMessage = errorData.error?.message || errorMessage;
                console.error('[AI Service] API错误响应:', errorData);
              } catch (parseError) {
                console.error('[AI Service] 响应解析失败:', parseError.message);
                console.error('[AI Service] 原始响应:', data);
              }
              console.error('[AI Service] 连接测试失败:', errorMessage);
              resolve({ success: false, error: errorMessage });
            }
          } catch (error) {
            console.error('[AI Service] 处理响应时发生错误:', error);
            resolve({ success: false, error: '响应处理失败: ' + error.message });
          }
        });
      });

      req.on('error', (error) => {
        console.error('[AI Service] 请求错误:', error);
        resolve({ success: false, error: `连接失败: ${error.message}` });
      });

      req.setTimeout(10000, () => {
        console.error('[AI Service] 请求超时');
        req.destroy();
        resolve({ success: false, error: '请求超时' });
      });

      req.write(postData);
      req.end();
    });
  }

  // 语音识别 - 供外部游戏调用
  async speechToText(audioData, options = {}) {
    const timeout = options.timeout || 30000; // 默认30秒超时
    
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          error: '语音识别超时'
        });
      }, timeout);

      try {
        const apiToken = await this.getApiTokenFromFrontend();
        if (!apiToken) {
          clearTimeout(timeoutId);
          resolve({
            success: false,
            error: 'API Token未配置'
          });
          return;
        }

        const sttService = require('./sttService');
        const result = await sttService.transcribe(audioData);
        
        clearTimeout(timeoutId);
        resolve({
          success: true,
          text: result
        });
      } catch (error) {
        clearTimeout(timeoutId);
        logger.error('语音识别失败', 'ai', error);
        resolve({
          success: false,
          error: error.message
        });
      }
    });
  }

  // LLM对话 - 供外部游戏调用
  async chatWithLLM(message, options = {}) {
    const timeout = options.timeout || 30000; // 默认30秒超时
    const model = options.model || 'Qwen/Qwen2.5-7B-Instruct';
    
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          error: 'LLM调用超时'
        });
      }, timeout);

      try {
        const apiToken = await this.getApiTokenFromFrontend();
        if (!apiToken) {
          clearTimeout(timeoutId);
          resolve({
            success: false,
            error: 'API Token未配置'
          });
          return;
        }

        const llmService = require('./llmService');
        llmService.setApiKey(apiToken);
        
        const result = await llmService.chat(message, {
          model: model,
          max_tokens: options.max_tokens || 1000,
          temperature: options.temperature || 0.7
        });
        
        clearTimeout(timeoutId);
        resolve({
          success: true,
          response: result.data
        });
      } catch (error) {
        clearTimeout(timeoutId);
        logger.error('LLM调用失败', 'ai', error);
        resolve({
          success: false,
          error: error.message
        });
      }
    });
  }

  // 清理资源
  cleanup() {
    this.mainWindow = null;
    logger.info('AI服务已清理', 'ai');
  }
}

module.exports = new AIService();