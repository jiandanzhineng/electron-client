/**
 * EMQX服务模块
 * 处理EMQX MQTT Broker的启动、停止和状态检查
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');
const { promisify } = require('util');
const AdmZip = require('adm-zip');
const { app } = require('electron');
const logService = require('./logService');

class EMQXService {
  constructor() {
    this.mainWindow = null;
    // 在打包环境中，tools目录放在C盘根目录下避免中文路径问题
    if (process.env.NODE_ENV === 'development') {
      this.toolsDir = path.join(__dirname, '..', 'tools');
    } else {
      this.toolsDir = path.join('C:', 'easysmart', 'tools');
    }
    this.emqxWorkDir = path.join(this.toolsDir, 'emqx');
    this.emqxPath = path.join(this.emqxWorkDir, 'bin', 'emqx.cmd');
    this.emqxCtlPath = path.join(this.emqxWorkDir, 'bin', 'emqx_ctl.cmd');
    this.emqxZipPath = path.join(this.toolsDir, 'emqx.zip');
    this.downloadUrl = 'https://packages.emqx.io/emqx-ce/v5.3.1/emqx-5.3.1-windows-amd64.zip';
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  /**
   * 检查EMQX是否已安装
   * @returns {boolean} 是否已安装
   */
  isEmqxInstalled() {
    return fs.existsSync(this.emqxPath) && fs.existsSync(this.emqxCtlPath);
  }

  /**
   * 发送日志到GUI
   * @param {string} message 日志消息
   * @param {string} level 日志级别
   */
  sendLogToGUI(message, level = 'info') {
    try {
      if (this.mainWindow && 
          this.mainWindow.webContents && 
          !this.mainWindow.isDestroyed() && 
          !this.mainWindow.webContents.isDestroyed()) {
        this.mainWindow.webContents.send('server-log', {
          timestamp: new Date().toISOString(),
          level: level,
          message: message,
          service: 'EMQX'
        });
      }
    } catch (error) {
      // 窗口已销毁时静默处理，避免程序退出时的错误
    }
    
    // 同时通过logService输出日志
    switch (level) {
      case 'error':
        logService.error(message, 'EMQX');
        break;
      case 'warn':
        logService.warn(message, 'EMQX');
        break;
      case 'debug':
        logService.debug(message, 'EMQX');
        break;
      default:
        logService.info(message, 'EMQX');
        break;
    }
  }

  /**
   * 下载文件
   * @param {string} url 下载链接
   * @param {string} filePath 保存路径
   * @returns {Promise<void>}
   */
  async downloadFile(url, filePath) {
    return new Promise((resolve, reject) => {
      const message = `开始下载 EMQX 服务: ${url}`;
      this.sendLogToGUI(message, 'info');
      
      const file = fs.createWriteStream(filePath);
      
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // 处理重定向
          return this.downloadFile(response.headers.location, filePath)
            .then(resolve)
            .catch(reject);
        }
        
        if (response.statusCode !== 200) {
          const errorMsg = `下载失败，状态码: ${response.statusCode}`;
          this.sendLogToGUI(errorMsg, 'error');
          reject(new Error(errorMsg));
          return;
        }
        
        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;
        let lastProgressReport = 0;
        
        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (totalSize) {
            const progress = ((downloadedSize / totalSize) * 100).toFixed(2);
            // 每10%报告一次进度，避免日志过多
            if (progress - lastProgressReport >= 10) {
              const progressMsg = `EMQX 下载进度: ${progress}%`;
              this.sendLogToGUI(progressMsg, 'info');
              lastProgressReport = Math.floor(progress / 10) * 10;
            }
          }
        });
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          const completeMsg = 'EMQX 服务下载完成';
          this.sendLogToGUI(completeMsg, 'success');
          resolve();
        });
        
        file.on('error', (err) => {
          fs.unlink(filePath, () => {}); // 删除不完整的文件
          this.sendLogToGUI(`下载文件时发生错误: ${err.message}`, 'error');
          reject(err);
        });
      }).on('error', (err) => {
        this.sendLogToGUI(`网络请求错误: ${err.message}`, 'error');
        reject(err);
      });
    });
  }

  /**
   * 解压EMQX服务
   * @returns {Promise<void>}
   */
  async extractEmqx() {
    try {
      const extractMsg = `开始解压 EMQX 服务到: ${this.emqxWorkDir}`;
      this.sendLogToGUI(extractMsg, 'info');
      
      // 确保目标目录存在
      if (!fs.existsSync(this.toolsDir)) {
        fs.mkdirSync(this.toolsDir, { recursive: true });
      }
      
      // 如果目标目录已存在，先删除
      if (fs.existsSync(this.emqxWorkDir)) {
        this.sendLogToGUI('清理现有 EMQX 目录', 'info');
        fs.rmSync(this.emqxWorkDir, { recursive: true, force: true });
      }
      
      const zip = new AdmZip(this.emqxZipPath);
      
      // 获取zip文件中的条目
      const zipEntries = zip.getEntries();
      if (zipEntries.length === 0) {
        throw new Error('ZIP文件为空');
      }
      
      // 找到根目录名称（通常是emqx-x.x.x-windows-amd64）
      const rootEntry = zipEntries[0];
      const rootDirName = rootEntry.entryName.split('/')[0];
      
      
      this.sendLogToGUI('正在解压文件...', 'info');
      zip.extractAllTo(this.emqxWorkDir, true);
      
      // 删除zip文件
      if (fs.existsSync(this.emqxZipPath)) {
        fs.unlinkSync(this.emqxZipPath);
        this.sendLogToGUI('清理下载的ZIP文件', 'info');
      }
      
      const completeMsg = 'EMQX 服务解压完成';
      this.sendLogToGUI(completeMsg, 'success');
    } catch (error) {
      const errorMsg = `解压 EMQX 服务失败: ${error.message}`;
      this.sendLogToGUI(errorMsg, 'error');
      throw error;
    }
  }

  /**
   * 下载并安装EMQX服务
   * @returns {Promise<Object>} 安装结果
   */
  async downloadAndInstallEmqx() {
    try {
      const startMsg = '检测到 EMQX 服务未安装，开始下载和安装...';
      this.sendLogToGUI(startMsg, 'info');
      
      // 确保tools目录存在
      if (!fs.existsSync(this.toolsDir)) {
        fs.mkdirSync(this.toolsDir, { recursive: true });
      }
      
      // 下载EMQX
      await this.downloadFile(this.downloadUrl, this.emqxZipPath);
      
      // 解压EMQX
      await this.extractEmqx();
      
      // 验证安装
      this.sendLogToGUI('验证 EMQX 安装...', 'info');
      if (!this.isEmqxInstalled()) {
        throw new Error('EMQX 服务安装验证失败');
      }
      
      const successMsg = 'EMQX 服务安装成功';
      this.sendLogToGUI(successMsg, 'success');
      return {
        success: true,
        message: 'EMQX 服务下载和安装成功'
      };
    } catch (error) {
      const errorMsg = `下载和安装 EMQX 服务失败: ${error.message}`;
      this.sendLogToGUI(errorMsg, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 启动EMQX MQTT Broker
   * @returns {Promise<Object>} 启动结果
   */
  async startBroker() {
    try {
      // 检查EMQX是否已安装
      if (!this.isEmqxInstalled()) {
        this.sendLogToGUI('EMQX 服务未安装，开始下载和安装...', 'info');
        const installResult = await this.downloadAndInstallEmqx();
        if (!installResult.success) {
          return {
            success: false,
            error: `安装 EMQX 服务失败: ${installResult.error}`
          };
        }
      }
      
      this.sendLogToGUI(`Starting EMQX broker at: ${this.emqxPath}`, 'info');
      
      // 启动emqx
      const emqxProcess = spawn(this.emqxPath, ['start'], {
        cwd: this.emqxWorkDir,
        stdio: 'pipe',
        shell: true
      });
      
      return new Promise((resolve) => {
        let output = '';
        let errorOutput = '';
        
        emqxProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        emqxProcess.stderr.on('data', (data) => {
          output += data.toString();
        });
        
        emqxProcess.on('close', async (code) => {
          this.sendLogToGUI(`EMQX start process exited with code ${code}`, 'info');
          this.sendLogToGUI(`Output: ${output}`, 'info');
          this.sendLogToGUI(`Error output: ${errorOutput}`, 'info');
          
          // 等待一段时间后检查状态
          setTimeout(async () => {
            const status = await this.checkStatus();
            resolve({
              success: status.running,
              output: output || errorOutput,
              status: status,
              code: code
            });
          }, 3000);
        });
        
        emqxProcess.on('error', (error) => {
          this.sendLogToGUI(`Failed to start EMQX: ${error.message}`, 'error');
          resolve({
            success: false,
            error: error.message
          });
        });
      });
    } catch (error) {
      this.sendLogToGUI(`Error starting MQTT broker: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * 停止EMQX MQTT Broker
   * @returns {Promise<Object>} 停止结果
   */
  async stopBroker() {
    try {
      this.sendLogToGUI(`Stopping EMQX broker at: ${this.emqxPath}`, 'info');
      
      const emqxProcess = spawn(this.emqxPath, ['stop'], {
        cwd: this.emqxWorkDir,
        stdio: 'pipe',
        shell: true
      });
      
      return new Promise((resolve) => {
        let output = '';
        let errorOutput = '';
        
        emqxProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        emqxProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        emqxProcess.on('close', async (code) => {
          this.sendLogToGUI(`EMQX stop process exited with code ${code}`, 'info');
          this.sendLogToGUI(`Output: ${output}`, 'info');
          this.sendLogToGUI(`Error output: ${errorOutput}`, 'info');
          
          // 等待一段时间后检查状态
          setTimeout(async () => {
            const status = await this.checkStatus();
            resolve({
              success: !status.running,
              output: output || errorOutput,
              status: status,
              code: code
            });
          }, 2000);
        });
        
        emqxProcess.on('error', (error) => {
          this.sendLogToGUI(`Failed to stop EMQX: ${error.message}`, 'error');
          resolve({
            success: false,
            error: error.message
          });
        });
      });
    } catch (error) {
      this.sendLogToGUI(`Error stopping MQTT broker: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * 检查EMQX MQTT Broker状态
   * @returns {Promise<Object>} 状态信息
   */
  async checkStatus() {
    try {
      this.sendLogToGUI(`Checking EMQX status at: ${this.emqxCtlPath}`, 'info');
      
      return new Promise((resolve) => {
        const statusProcess = spawn(this.emqxCtlPath, ['status'], {
          cwd: this.emqxWorkDir,
          stdio: 'pipe',
          shell: true
        });
        
        let output = '';
        let errorOutput = '';
        
        statusProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        statusProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        statusProcess.on('close', (code) => {
          this.sendLogToGUI(`EMQX status check exited with code ${code}`, 'info');
          this.sendLogToGUI(`Status output: ${output}`, 'info');
          this.sendLogToGUI(`Status error: ${errorOutput}`, 'info');
          
          const result = output || errorOutput;
          let running = false;
          let status = 'stopped';
          
          if (result.includes('is started')) {
            running = true;
            status = 'running';
          } else if (result.includes('is starting')) {
            running = false;
            status = 'starting';
          } else {
            running = false;
            status = 'stopped';
          }
          
          resolve({
            running: running,
            status: status,
            output: result,
            code: code
          });
        });
        
        statusProcess.on('error', (error) => {
          this.sendLogToGUI(`Failed to check EMQX status: ${error.message}`, 'error');
          resolve({
            running: false,
            status: 'error',
            error: error.message
          });
        });
      });
    } catch (error) {
      this.sendLogToGUI(`Error checking MQTT broker status: ${error.message}`, 'error');
      return {
        running: false,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * 重启EMQX MQTT Broker
   * @returns {Promise<Object>} 重启结果
   */
  async restartBroker() {
    try {
      this.sendLogToGUI('Restarting EMQX broker...', 'info');
      
      // 先停止
      const stopResult = await this.stopBroker();
      if (!stopResult.success) {
        return {
          success: false,
          error: 'Failed to stop EMQX before restart: ' + stopResult.error
        };
      }
      
      // 等待一段时间确保完全停止
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 再启动
      const startResult = await this.startBroker();
      return {
        success: startResult.success,
        output: `Stop: ${stopResult.output}\nStart: ${startResult.output}`,
        status: startResult.status,
        error: startResult.error
      };
    } catch (error) {
      this.sendLogToGUI(`Error restarting MQTT broker: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.sendLogToGUI('Cleaning up EMQX service...', 'info');
    // 这里可以添加清理逻辑，比如强制停止进程等
  }
}

// 创建并导出EMQX服务实例
const emqxServiceInstance = new EMQXService();

module.exports = emqxServiceInstance;