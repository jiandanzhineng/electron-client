/**
 * EMQX服务模块
 * 处理EMQX MQTT Broker的启动、停止和状态检查
 */

const path = require('path');
const { spawn } = require('child_process');

class EMQXService {
  constructor() {
    this.mainWindow = null;
    this.emqxPath = path.join(__dirname, '..', 'tools', 'emqx', 'bin', 'emqx');
    this.emqxCtlPath = path.join(__dirname, '..', 'tools', 'emqx', 'bin', 'emqx_ctl');
    this.emqxWorkDir = path.join(__dirname, '..', 'tools', 'emqx');
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  /**
   * 启动EMQX MQTT Broker
   * @returns {Promise<Object>} 启动结果
   */
  async startBroker() {
    try {
      console.log('Starting EMQX broker at:', this.emqxPath);
      
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
          errorOutput += data.toString();
        });
        
        emqxProcess.on('close', async (code) => {
          console.log(`EMQX start process exited with code ${code}`);
          console.log('Output:', output);
          console.log('Error output:', errorOutput);
          
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
          console.error('Failed to start EMQX:', error);
          resolve({
            success: false,
            error: error.message
          });
        });
      });
    } catch (error) {
      console.error('Error starting MQTT broker:', error);
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
      console.log('Stopping EMQX broker at:', this.emqxPath);
      
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
          console.log(`EMQX stop process exited with code ${code}`);
          console.log('Output:', output);
          console.log('Error output:', errorOutput);
          
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
          console.error('Failed to stop EMQX:', error);
          resolve({
            success: false,
            error: error.message
          });
        });
      });
    } catch (error) {
      console.error('Error stopping MQTT broker:', error);
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
      console.log('Checking EMQX status at:', this.emqxCtlPath);
      
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
          console.log(`EMQX status check exited with code ${code}`);
          console.log('Status output:', output);
          console.log('Status error:', errorOutput);
          
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
          console.error('Failed to check EMQX status:', error);
          resolve({
            running: false,
            status: 'error',
            error: error.message
          });
        });
      });
    } catch (error) {
      console.error('Error checking MQTT broker status:', error);
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
      console.log('Restarting EMQX broker...');
      
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
      console.error('Error restarting MQTT broker:', error);
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
    console.log('Cleaning up EMQX service...');
    // 这里可以添加清理逻辑，比如强制停止进程等
  }
}

// 创建并导出EMQX服务实例
const emqxServiceInstance = new EMQXService();

module.exports = emqxServiceInstance;