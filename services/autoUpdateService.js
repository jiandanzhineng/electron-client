const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');
const logger = require('./logService');

class AutoUpdateService {
  constructor() {
    this.mainWindow = null;
    this.isUpdateAvailable = false;
    this.isUpdateDownloaded = false;
    
    // 配置自动更新器
    this.setupAutoUpdater();
  }

  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
  }

  setupAutoUpdater() {
    // 设置更新服务器URL（GitHub releases）
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'jiandanzhineng',
      repo: 'electron-client'
    });

    // 自动下载更新
    autoUpdater.autoDownload = false;
    
    // 允许预发布版本
    autoUpdater.allowPrerelease = false;
    
    // 配置更新文件格式（使用NSIS安装包）
    autoUpdater.logger = logger;

    // 监听更新事件
    autoUpdater.on('checking-for-update', () => {
      logger.info('正在检查更新...', 'autoUpdater');
      this.sendStatusToRenderer('checking-for-update');
    });

    autoUpdater.on('update-available', (info) => {
      logger.info(`发现新版本: ${info.version}`, 'autoUpdater');
      this.isUpdateAvailable = true;
      this.sendStatusToRenderer('update-available', info);
      this.showUpdateDialog(info);
    });

    autoUpdater.on('update-not-available', (info) => {
      logger.info('当前已是最新版本', 'autoUpdater');
      this.sendStatusToRenderer('update-not-available', info);
    });

    autoUpdater.on('error', (err) => {
      logger.error(`自动更新错误: ${err.message}`, 'autoUpdater');
      this.sendStatusToRenderer('update-error', { message: err.message });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const logMessage = `下载进度: ${Math.round(progressObj.percent)}% (${progressObj.transferred}/${progressObj.total})`;
      logger.info(logMessage, 'autoUpdater');
      this.sendStatusToRenderer('download-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
      logger.info('更新下载完成', 'autoUpdater');
      this.isUpdateDownloaded = true;
      this.sendStatusToRenderer('update-downloaded', info);
      this.showInstallDialog(info);
    });
  }

  // 检查更新
  checkForUpdates() {
    if (process.env.NODE_ENV === 'development') {
      logger.info('开发模式下跳过更新检查', 'autoUpdater');
      return;
    }
    
    autoUpdater.checkForUpdatesAndNotify();
  }

  // 手动检查更新
  checkForUpdatesManually() {
    if (process.env.NODE_ENV === 'development') {
      this.showDevModeDialog();
      return;
    }
    
    autoUpdater.checkForUpdates();
  }

  // 下载更新
  downloadUpdate() {
    if (this.isUpdateAvailable) {
      autoUpdater.downloadUpdate();
    }
  }

  // 安装更新并重启
  installUpdate() {
    if (this.isUpdateDownloaded) {
      autoUpdater.quitAndInstall();
    }
  }

  // 显示更新对话框
  showUpdateDialog(info) {
    if (!this.mainWindow) return;

    const options = {
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 ${info.version}`,
      detail: `当前版本: ${require('../package.json').version}\n新版本: ${info.version}\n\n是否立即下载更新？`,
      buttons: ['立即下载', '稍后提醒', '跳过此版本'],
      defaultId: 0,
      cancelId: 1
    };

    dialog.showMessageBox(this.mainWindow, options).then((result) => {
      if (result.response === 0) {
        // 立即下载
        this.downloadUpdate();
      } else if (result.response === 2) {
        // 跳过此版本
        logger.info(`用户选择跳过版本 ${info.version}`, 'autoUpdater');
      }
    });
  }

  // 显示安装对话框
  showInstallDialog(info) {
    if (!this.mainWindow) return;

    const options = {
      type: 'info',
      title: '更新下载完成',
      message: '更新已下载完成',
      detail: `新版本 ${info.version} 已下载完成，是否立即安装并重启应用？`,
      buttons: ['立即安装', '稍后安装'],
      defaultId: 0,
      cancelId: 1
    };

    dialog.showMessageBox(this.mainWindow, options).then((result) => {
      if (result.response === 0) {
        // 立即安装
        this.installUpdate();
      }
    });
  }

  // 显示开发模式对话框
  showDevModeDialog() {
    if (!this.mainWindow) return;

    const options = {
      type: 'info',
      title: '开发模式',
      message: '当前处于开发模式',
      detail: '开发模式下无法检查更新，请在生产环境中使用此功能。',
      buttons: ['确定'],
      defaultId: 0
    };

    dialog.showMessageBox(this.mainWindow, options);
  }

  // 向渲染进程发送状态
  sendStatusToRenderer(event, data = null) {
    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.send('auto-updater-status', { event, data });
    }
  }

  // 获取当前状态
  getStatus() {
    return {
      isUpdateAvailable: this.isUpdateAvailable,
      isUpdateDownloaded: this.isUpdateDownloaded,
      currentVersion: require('../package.json').version
    };
  }
}

// 创建单例实例
const autoUpdateService = new AutoUpdateService();

module.exports = autoUpdateService;