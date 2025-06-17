

const { app, BrowserWindow } = require('electron');
const path = require('path');
const logger = require('./services/logService');

// 引入 electron-reloader，忽略tools目录避免日志文件变化触发重载
// 临时注释掉 electron-reloader 来调试启动问题
if (process.env.NODE_ENV === 'development') {
  require('electron-reloader')(module, {
    ignore: ['**/tools/**/*']
  });
}
// 引入键盘快捷键模块
const { initKeyboardShortcuts } = require('./util/keyboardShortcuts');

// 引入服务模块
const ipcHandlers = require('./services/ipcHandlers');
const mqttService = require('./services/mqttService');
const mdnsService = require('./services/mdnsService');
const localServerService = require('./services/localServerService');
const autoUpdateService = require('./services/autoUpdateService');

// 保持对window对象的全局引用，如果不这么做的话，当JavaScript对象被
// 垃圾回收的时候，window对象将会自动的关闭
let mainWindow;

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 1000,
    title: '简单智能控制台',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // 在开发模式下加载 Vite 开发服务器，生产模式下加载构建后的文件
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    // 打开开发者工具
    mainWindow.webContents.openDevTools()
  } else {
    // 加载构建后的文件
    mainWindow.loadFile('dist/index.html')
    // 如果需要调试生产环境，可以取消下面这行的注释
    mainWindow.webContents.openDevTools()
  }

  // 当window被关闭时，触发下面的事件
  mainWindow.on('closed', function () {
    // 取消引用window对象，如果你的应用支持多窗口的话，
    // 通常会把多个window对象存放在一个数组里面，
    // 与此同时，你应该删除相应的元素。
    mainWindow = null;
  });
  
  // 初始化键盘快捷键
  initKeyboardShortcuts(mainWindow);
  
  // 初始化IPC处理器
  ipcHandlers.setMainWindow(mainWindow);
  ipcHandlers.initializeHandlers();
  
  // 初始化自动更新服务
  autoUpdateService.setMainWindow(mainWindow);
  
  // 在应用启动后5秒检查更新（避免影响启动速度）
  setTimeout(() => {
    autoUpdateService.checkForUpdates();
  }, 5000);
}

// 当Electron完成初始化并准备创建浏览器窗口时调用此方法
app.whenReady().then(createWindow);

// 注意：window-all-closed 和 activate 事件处理器已在下方重新定义

// 注意：所有IPC处理器和服务逻辑已移至 services/ 目录下的模块中

// 在应用退出时清理所有服务
app.on('before-quit', () => {
  logger.info('Application is quitting, cleaning up services...', 'main');
  ipcHandlers.cleanup();
});

// 当所有窗口关闭时也进行清理
app.on('window-all-closed', function () {
  // 清理服务
  ipcHandlers.cleanup();
  
  // 在macOS上，除非用户用Cmd + Q确定地退出，
  // 否则绝大部分应用及其菜单栏会保持激活。
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  // 在macOS上，当单击dock图标并且没有其他窗口打开时，
  // 通常在应用程序中重新创建一个窗口。
  if (mainWindow === null) {
    createWindow();
  }
});