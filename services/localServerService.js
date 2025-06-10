/**
 * 本地服务器管理模块
 * 处理本地服务器的启动、停止和状态检查
 */

class LocalServerService {
  constructor() {
    this.runningServers = new Map(); // 存储运行中的服务器进程
  }

  // 启动本地服务器
  async startServer(config) {
    // 这里应该实现启动本地服务器的逻辑
    // 暂时返回一个模拟的进程ID
    console.log('Starting local server with config:', config);
    const processId = Math.floor(Math.random() * 10000);
    
    // 模拟存储服务器信息
    this.runningServers.set(processId, {
      config: config,
      startTime: new Date(),
      status: 'running'
    });
    
    return processId;
  }

  // 停止本地服务器
  async stopServer(processId) {
    // 这里应该实现停止本地服务器的逻辑
    console.log('Stopping local server with process ID:', processId);
    
    if (this.runningServers.has(processId)) {
      this.runningServers.delete(processId);
      return { success: true };
    }
    
    return { success: false, error: 'Server not found' };
  }

  // 强制停止本地服务器
  async forceStopServer(processId) {
    // 这里应该实现强制停止本地服务器的逻辑
    console.log('Force stopping local server with process ID:', processId);
    
    if (this.runningServers.has(processId)) {
      this.runningServers.delete(processId);
      return { success: true };
    }
    
    return { success: false, error: 'Server not found' };
  }

  // 检查本地服务器状态
  async checkServerStatus() {
    // 这里应该实现检查本地服务器状态的逻辑
    // 暂时返回未运行状态
    const runningCount = this.runningServers.size;
    
    if (runningCount > 0) {
      const firstServer = this.runningServers.entries().next().value;
      return { 
        running: true, 
        processId: firstServer[0],
        serverInfo: firstServer[1]
      };
    }
    
    return { running: false, processId: null };
  }

  // 获取所有运行中的服务器
  getAllRunningServers() {
    return Array.from(this.runningServers.entries()).map(([id, info]) => ({
      processId: id,
      ...info
    }));
  }

  // 清理所有服务器
  cleanup() {
    console.log('Cleaning up all local servers...');
    this.runningServers.clear();
  }
}

module.exports = new LocalServerService();