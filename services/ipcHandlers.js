/**
 * IPC处理器模块
 * 集中管理所有主进程的IPC通信处理
 */

const { ipcMain } = require('electron');
const mqttService = require('./mqttService');
const mdnsService = require('./mdnsService');
const localServerService = require('./localServerService');
const emqxService = require('./emqxService');
const autoUpdateService = require('./autoUpdateService');
const logger = require('./logService');

class IPCHandlers {
  constructor() {
    this.mainWindow = null;
  }

  setMainWindow(window) {
    this.mainWindow = window;
    mqttService.setMainWindow(window);
    mdnsService.setMainWindow(window);
    emqxService.setMainWindow(window);
  }

  // 初始化所有IPC处理器
  initializeHandlers() {
    this.setupKeyboardHandlers();
    this.setupMQTTHandlers();
    this.setupMDNSHandlers();
    this.setupLocalServerHandlers();
    this.setupSystemHandlers();
    this.setupAutoUpdateHandlers();
  }

  // 键盘事件处理器
  setupKeyboardHandlers() {
    ipcMain.on('keyboard-event', (event, type, keyEvent) => {
      if (type === 'keydown' && global.keyDownHandler) {
        global.keyDownHandler(keyEvent, event.sender);
      } else if (type === 'keyup' && global.keyUpHandler) {
        global.keyUpHandler(keyEvent);
      }
    });
  }

  // MQTT相关处理器
  setupMQTTHandlers() {
    // MQTT连接处理
    ipcMain.on('mqtt-connect', (event, url, options) => {
      mqttService.connect(url, options);
    });

    // MQTT连接处理 (新的统一接口)
    ipcMain.handle('connect-mqtt', async (event, config) => {
      try {
        const url = `mqtt://${config.host}:${config.port}`;
        const options = {
          username: config.username || undefined,
          password: config.password || undefined
        };
        mqttService.connect(url, options);
        return { success: true };
      } catch (error) {
        logger.error('MQTT连接失败', 'ipc', error);
        return { success: false, error: error.message };
      }
    });

    // MQTT断开连接处理
    ipcMain.handle('disconnect-mqtt', async (event) => {
      try {
        mqttService.disconnect();
        return { success: true };
      } catch (error) {
        logger.error('MQTT断开连接失败', 'ipc', error);
        return { success: false, error: error.message };
      }
    });

    // MQTT消息发送处理
    ipcMain.on('mqtt-send-message', (event, topic, payload) => {
      mqttService.sendMessage(topic, payload);
    });

    // MQTT消息发布处理 (新的统一接口)
    ipcMain.handle('publish-mqtt-message', async (event, topic, payload) => {
      try {
        mqttService.sendMessage(topic, payload);
        return { success: true };
      } catch (error) {
        logger.error('MQTT消息发布失败', 'ipc', error);
        return { success: false, error: error.message };
      }
    });
  }

  // mDNS相关处理器
  setupMDNSHandlers() {
    // 发布mDNS服务
    ipcMain.handle('publish-mdns', async (event, port) => {
      try {
        await mdnsService.publishService(port);
        return { success: true };
      } catch (error) {
        throw error;
      }
    });

    // 运行mDNS工具
    ipcMain.handle('run-mdns-tool', async (event, port) => {
      return await mdnsService.runMDNSTool(port);
    });

    // 停止mDNS工具
    ipcMain.handle('stop-mdns-tool', async (event) => {
      return mdnsService.stopMDNSTool();
    });

    // 获取mDNS工具状态
    ipcMain.handle('get-mdns-tool-status', async (event) => {
      return mdnsService.getMDNSToolStatus();
    });
  }

  // 本地服务器相关处理器
  setupLocalServerHandlers() {
    // 启动本地服务器
    ipcMain.handle('start-local-server', async (event, config) => {
      return await localServerService.startServer(config);
    });

    // 停止本地服务器
    ipcMain.handle('stop-local-server', async (event, processId) => {
      return await localServerService.stopServer(processId);
    });

    // 强制停止本地服务器
    ipcMain.handle('force-stop-local-server', async (event, processId) => {
      return await localServerService.forceStopServer(processId);
    });

    // 检查本地服务器状态
    ipcMain.handle('check-local-server-status', async (event) => {
      return await localServerService.checkServerStatus();
    });

    // 启动MQTT Broker (EMQX)
    ipcMain.handle('start-mqtt-broker', async (event) => {
      return await emqxService.startBroker();
    });

    // 停止MQTT Broker (EMQX)
    ipcMain.handle('stop-mqtt-broker', async (event) => {
      return await emqxService.stopBroker();
    });

    // 重启MQTT Broker (EMQX)
    ipcMain.handle('restart-mqtt-broker', async (event) => {
      return await emqxService.restartBroker();
    });

    // 检查MQTT Broker状态
    ipcMain.handle('check-mqtt-broker-status', async (event) => {
      return await emqxService.checkStatus();
    });
  }

  // 系统信息相关处理器
  setupSystemHandlers() {
    // 获取系统运行时间
    ipcMain.handle('get-system-uptime', async (event) => {
      try {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        
        return {
          uptime,
          formatted: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        };
      } catch (error) {
        logger.error('Error getting system uptime', 'ipc', error);
        return { uptime: 0, formatted: '00:00:00' };
      }
    });

    // 获取系统信息
    ipcMain.handle('get-system-info', async (event) => {
      try {
        const os = require('os');
        return {
          platform: os.platform(),
          arch: os.arch(),
          totalmem: os.totalmem(),
          freemem: os.freemem(),
          cpus: os.cpus().length,
          uptime: os.uptime()
        };
      } catch (error) {
        logger.error('Error getting system info', 'ipc', error);
        return null;
      }
    });

    // 读取文件内容
    ipcMain.handle('read-file', async (event, filePath) => {
      const fs = require('fs').promises;
      const path = require('path');
      
      try {
        const content = await fs.readFile(filePath, 'utf8');
        return { success: true, content };
      } catch (error) {
        logger.error('读取文件失败', 'ipc', error);
        return { success: false, error: error.message };
      }
    });

    // 获取应用日志
    ipcMain.handle('get-app-logs', async (event, lines = 100) => {
      try {
        const logs = logger.getRecentLogs(lines);
        return {
          success: true,
          logs,
          logFile: logger.getLogFilePath(),
          logDirectory: logger.getLogDirectory()
        };
      } catch (error) {
        logger.error('获取应用日志失败', 'ipc', error);
        return { success: false, error: error.message };
      }
    });

    // 清理旧日志
    ipcMain.handle('clean-old-logs', async (event) => {
      try {
        logger.cleanOldLogs();
        return { success: true };
      } catch (error) {
        logger.error('清理旧日志失败', 'ipc', error);
        return { success: false, error: error.message };
      }
    });

    // 打开日志目录
    ipcMain.handle('open-log-directory', async (event) => {
      try {
        const { shell } = require('electron');
        const fs = require('fs');
        const logDir = logger.getLogDirectory();
        if (logDir && fs.existsSync(logDir)) {
          shell.openPath(logDir);
          return { success: true };
        } else {
          return { success: false, error: '日志目录不存在' };
        }
      } catch (error) {
        logger.error('打开日志目录失败', 'ipc', error);
        return { success: false, error: error.message };
      }
    });

    // 打开外部浏览器
    ipcMain.handle('open-external-url', async (event, url) => {
      try {
        const { shell } = require('electron');
        await shell.openExternal(url);
        return { success: true };
      } catch (error) {
        logger.error('打开外部链接失败', 'ipc', error);
        return { success: false, error: error.message };
      }
    });
  }

  // 自动更新相关处理器
  setupAutoUpdateHandlers() {
    // 手动检查更新
    ipcMain.handle('check-for-updates', async (event) => {
      try {
        autoUpdateService.checkForUpdatesManually();
        return { success: true };
      } catch (error) {
        logger.error('检查更新失败', 'ipc', error);
        return { success: false, error: error.message };
      }
    });

    // 下载更新
    ipcMain.handle('download-update', async (event) => {
      try {
        autoUpdateService.downloadUpdate();
        return { success: true };
      } catch (error) {
        logger.error('下载更新失败', 'ipc', error);
        return { success: false, error: error.message };
      }
    });

    // 安装更新并重启
    ipcMain.handle('install-update', async (event) => {
      try {
        autoUpdateService.installUpdate();
        return { success: true };
      } catch (error) {
        logger.error('安装更新失败', 'ipc', error);
        return { success: false, error: error.message };
      }
    });

    // 获取更新状态
    ipcMain.handle('get-update-status', async (event) => {
      try {
        const status = autoUpdateService.getStatus();
        return { success: true, data: status };
      } catch (error) {
        logger.error('获取更新状态失败', 'ipc', error);
        return { success: false, error: error.message };
      }
    });
  }

  // 清理资源
  cleanup() {
    mqttService.disconnect();
    mdnsService.stopService();
    localServerService.cleanup();
    emqxService.cleanup();
  }
}



// 创建并导出IPC处理器实例
const ipcHandlersInstance = new IPCHandlers();

module.exports = ipcHandlersInstance;