const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class LogService {
  constructor() {
    this.logDir = null;
    this.logFile = null;
    this.isProduction = process.env.NODE_ENV === 'production';
    this.initializeLogDirectory();
  }

  initializeLogDirectory() {
    try {
      // 获取用户数据目录
      const userDataPath = app.getPath('userData');
      this.logDir = path.join(userDataPath, 'logs');
      
      // 确保日志目录存在
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      
      // 生成日志文件名（按日期）
      const today = new Date().toISOString().split('T')[0];
      this.logFile = path.join(this.logDir, `app-${today}.log`);
      
      // 清理旧日志文件（保留最近7天）
      this.cleanOldLogs();
      
      // 写入启动日志
      this.writeToFile(`[${new Date().toISOString()}] [INFO] Application started`);
    } catch (error) {
      console.error('Failed to initialize log directory:', error);
    }
  }

  cleanOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir);
      const now = Date.now();
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      
      files.forEach(file => {
        if (file.startsWith('app-') && file.endsWith('.log')) {
          const filePath = path.join(this.logDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime.getTime() < sevenDaysAgo) {
            fs.unlinkSync(filePath);
          }
        }
      });
    } catch (error) {
      console.error('Failed to clean old logs:', error);
    }
  }

  writeToFile(message) {
    if (!this.logFile) return;
    
    try {
      fs.appendFileSync(this.logFile, message + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  formatMessage(level, message, source = '') {
    const timestamp = new Date().toISOString();
    const sourceStr = source ? ` [${source}]` : '';
    return `[${timestamp}] [${level.toUpperCase()}]${sourceStr} ${message}`;
  }

  log(message, source = '') {
    const formattedMessage = this.formatMessage('info', message, source);
    
    // 总是输出到控制台
    console.log(formattedMessage);
    
    // 总是写入文件
    this.writeToFile(formattedMessage);
  }

  error(message, source = '', error = null) {
    let errorMessage = message;
    if (error) {
      errorMessage += ` - ${error.message || error}`;
      if (error.stack) {
        errorMessage += `\nStack: ${error.stack}`;
      }
    }
    
    const formattedMessage = this.formatMessage('error', errorMessage, source);
    
    // 错误信息总是输出到控制台
    console.error(formattedMessage);
    
    // 同时写入文件
    this.writeToFile(formattedMessage);
  }

  warn(message, source = '') {
    const formattedMessage = this.formatMessage('warn', message, source);
    
    // 总是输出到控制台
    console.warn(formattedMessage);
    
    // 总是写入文件
    this.writeToFile(formattedMessage);
  }

  info(message, source = '') {
    this.log(message, source);
  }

  debug(message, source = '') {
    const formattedMessage = this.formatMessage('debug', message, source);
    
    // 调试信息在开发环境下输出到控制台，在所有环境下写入文件
    if (!this.isProduction) {
      console.log(formattedMessage);
    }
    this.writeToFile(formattedMessage);
  }

  // 获取日志文件路径
  getLogFilePath() {
    return this.logFile;
  }

  // 获取日志目录路径
  getLogDirectory() {
    return this.logDir;
  }

  // 读取最新的日志内容
  getRecentLogs(lines = 100) {
    if (!this.logFile || !fs.existsSync(this.logFile)) {
      return [];
    }
    
    try {
      const content = fs.readFileSync(this.logFile, 'utf8');
      const allLines = content.split('\n').filter(line => line.trim());
      return allLines.slice(-lines);
    } catch (error) {
      console.error('Failed to read log file:', error);
      return [];
    }
  }
}

// 创建全局日志服务实例
const logService = new LogService();

module.exports = logService;