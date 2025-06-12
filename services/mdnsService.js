/**
 * mDNS服务模块
 * 处理mDNS服务发布和管理
 */

const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { Bonjour } = require('bonjour-service');

class MDNSService {
  constructor() {
    this.bonjourInstance = null;
    this.publishedService = null;
    this.mdnsProcess = null;
    this.mainWindow = null;
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  // 获取本地IP地址
  getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const networkInterface of interfaces[name]) {
        // 跳过内部地址和IPv6地址
        if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
          console.log(`Found local IP address: ${networkInterface.address}`);
          return networkInterface.address;
        }
      }
    }
    console.error('No local IP address found');
    return null;
  }

  // 发布mDNS服务
  publishService(port) {
    return new Promise((resolve, reject) => {
      try {
        // 如果已经有发布的服务，先停止它
        if (this.publishedService) {
          this.publishedService.stop();
          this.publishedService = null;
        }

        // 如果没有Bonjour实例，创建一个
        if (!this.bonjourInstance) {
          this.bonjourInstance = new Bonjour();
        }

        const localIP = this.getLocalIPAddress();
        console.log(`Publishing mDNS service on IP: ${localIP}, Port: ${port}`);

        // 发布HTTP服务到easysmart.local
        this.publishedService = this.bonjourInstance.publish({
          name: 'easysmart',
          type: 'http',
          port: port,
          host: 'easysmart.local',
          disableIPv6: true, // 禁用IPv6地址，仅发布IPv4地址
          ttl: 9999 * 3600, // TTL设置为9999小时（转换为秒）
          txt: {
            ip: localIP,
            version: '1.0.0',
            description: 'EasySmart Local Server'
          }
        });

        this.publishedService.on('up', () => {
          console.log(`mDNS service published successfully: easysmart.local:${port}`);
          resolve();
        });

        this.publishedService.on('error', (err) => {
          console.error('mDNS service publish error:', err);
          reject(err);
        });

      } catch (error) {
        console.error('Failed to publish mDNS service:', error);
        reject(error);
      }
    });
  }

  // 运行mDNS工具
  runMDNSTool(port) {
    return new Promise((resolve, reject) => {
      // 如果已有进程在运行，先停止它
      if (this.mdnsProcess && !this.mdnsProcess.killed) {
        this.mdnsProcess.kill();
        this.mdnsProcess = null;
      }

      // 获取正确的工具路径
      let mdnsToolPath;
      if (process.env.NODE_ENV === 'development') {
        mdnsToolPath = path.join(__dirname, '..', 'inner-tools', 'mdns_tool.exe');
      } else {
        // 生产环境下，工具在 extraResources 中
        mdnsToolPath = path.join(process.resourcesPath, 'inner-tools', 'mdns_tool.exe');
      }
      this.mdnsProcess = spawn(mdnsToolPath, [port.toString()], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });
      
      let output = '';
      let errorOutput = '';
      let hasResolved = false;
      
      // 统一的数据处理函数
      const handleProcessData = (data, source = '') => {
        const dataStr = data.toString();
        output += dataStr;
        console.log(`mDNS Tool output${source}:`, dataStr.trim());
        
        // 实时发送输出到渲染进程
        if (this.mainWindow) {
          this.mainWindow.webContents.send('mdns-output', dataStr.trim());
        }
        
        // 如果还没有resolve，并且有输出，说明程序启动成功
        if (!hasResolved) {
          hasResolved = true;
          resolve({ success: true, output: dataStr.trim(), processId: this.mdnsProcess.pid });
        }
      };
      
      this.mdnsProcess.stdout.on('data', (data) => {
        handleProcessData(data);
      });
      
      this.mdnsProcess.stderr.on('data', (data) => {
        handleProcessData(data, ' (from stderr)');
      });
      
      this.mdnsProcess.on('close', (code) => {
        console.log(`mDNS Tool process closed with code ${code}`);
        this.mdnsProcess = null;
        
        // 通知渲染进程服务状态变化
        if (this.mainWindow) {
          this.mainWindow.webContents.send('mdns-status-change', 'stopped');
        }
        
        if (!hasResolved) {
          hasResolved = true;
          if (code === 0) {
            resolve({ success: true, output: output.trim() });
          } else {
            resolve({ success: false, error: `Tool exited with code ${code}: ${errorOutput.trim()}` });
          }
        }
      });
      
      this.mdnsProcess.on('error', (error) => {
        console.error('mDNS Tool process error:', error);
        this.mdnsProcess = null;
        
        if (!hasResolved) {
          hasResolved = true;
          resolve({ success: false, error: `Failed to start tool: ${error.message}` });
        }
      });
      
      // 设置超时，如果3秒内没有输出，认为启动失败
      setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          if (this.mdnsProcess && !this.mdnsProcess.killed) {
            this.mdnsProcess.kill();
            this.mdnsProcess = null;
          }
          resolve({ success: false, error: 'mDNS tool startup timeout (no output within 3 seconds)' });
        }
      }, 3000);
    });
  }

  // 停止mDNS工具
  stopMDNSTool() {
    if (this.mdnsProcess && !this.mdnsProcess.killed) {
      this.mdnsProcess.kill();
      this.mdnsProcess = null;
      console.log('mDNS Tool process stopped');
      return true;
    }
    return false;
  }

  // 检查mDNS工具状态
  getMDNSToolStatus() {
    return {
      running: this.mdnsProcess && !this.mdnsProcess.killed,
      processId: this.mdnsProcess ? this.mdnsProcess.pid : null
    };
  }

  // 停止mDNS服务
  stopService() {
    // 停止mDNS工具进程
    this.stopMDNSTool();
    
    if (this.publishedService) {
      this.publishedService.stop();
      console.log('mDNS service stopped');
      this.publishedService = null;
    }
    
    if (this.bonjourInstance) {
      this.bonjourInstance.destroy();
      console.log('Bonjour instance destroyed');
      this.bonjourInstance = null;
    }
  }
}

module.exports = new MDNSService();