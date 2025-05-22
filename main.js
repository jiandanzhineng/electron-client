

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// 引入 electron-reloader
require('electron-reloader')(module);

const mqtt = require('mqtt'); // 引入 mqtt 模块

// 引入键盘快捷键模块
const { initKeyboardShortcuts } = require('./util/keyboardShortcuts');

// 保持对window对象的全局引用，如果不这么做的话，当JavaScript对象被
// 垃圾回收的时候，window对象将会自动的关闭
let mainWindow;
let mqttClient = null; // 添加 MQTT 客户端变量

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 1000,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // 加载index.html文件
  mainWindow.loadFile('index.html');

  // 打开开发者工具（可选）
  mainWindow.webContents.openDevTools();

  // 当window被关闭时，触发下面的事件
  mainWindow.on('closed', function () {
    // 取消引用window对象，如果你的应用支持多窗口的话，
    // 通常会把多个window对象存放在一个数组里面，
    // 与此同时，你应该删除相应的元素。
    mainWindow = null;
  });
  
  // 初始化键盘快捷键
  initKeyboardShortcuts(mainWindow);
}

// 当Electron完成初始化并准备创建浏览器窗口时调用此方法
app.whenReady().then(createWindow);

// 所有窗口关闭时退出应用
app.on('window-all-closed', function () {
  // 在macOS上，除非用户用Cmd + Q确定地退出，
  // 否则绝大部分应用及其菜单栏会保持激活。
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  // 在macOS上，当单击dock图标并且没有其他窗口打开时，
  // 通常在应用程序中重新创建一个窗口。
  if (mainWindow === null) createWindow();
});

// 设置IPC通信，接收渲染进程发送的键盘事件
ipcMain.on('keyboard-event', (event, type, keyEvent) => {
  if (type === 'keydown' && global.keyDownHandler) {
    global.keyDownHandler(keyEvent, event.sender);
  } else if (type === 'keyup' && global.keyUpHandler) {
    global.keyUpHandler(keyEvent);
  }
});

// MQTT 连接和事件处理逻辑
function connectMQTT(url, options) {
  if (mqttClient && mqttClient.connected) {
    console.log('MQTT客户端已连接，无需重复连接');
    return;
  }

  console.log('尝试连接 MQTT:', url);
  mqttClient = mqtt.connect(url, options);

  mqttClient.on('connect', () => {
    console.log('MQTT连接成功');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mqtt-status', 'connected');
      // 订阅所有主题
      mqttClient.subscribe('/#', (err) => {
        if (err) {
          console.error('订阅主题失败:', err);
        } else {
          console.log('已订阅所有主题');
        }
      });
      // 生成三位随机数
      const randomNumber = Math.floor(100 + Math.random() * 900);
      const topic = `/dpub/electron${randomNumber}`;
      const message = 'electron start';
      
      // 发布消息
      mqttClient.publish(topic, message, (err) => {
        if (err) {
          console.error(`发布消息到 ${topic} 失败:`, err);
        } else {
          console.log(`成功发布消息到 ${topic}: ${message}`);
        }
      });
    }
  });

  mqttClient.on('error', (err) => {
    console.error('MQTT连接错误:', err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mqtt-status', 'disconnected');
    }
  });

  mqttClient.on('close', () => {
    console.log('MQTT连接已关闭');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mqtt-status', 'disconnected');
    }
  });

  mqttClient.on('message', (topic, message) => {
    console.log(`收到消息: ${topic} - ${message.toString()}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mqtt-message', { topic: topic, payload: message.toString() });
    }
  });
}

// IPC 处理程序，用于接收渲染进程的连接请求
ipcMain.on('mqtt-connect', (event, url, options) => {
  connectMQTT(url, options);
});

// 在应用退出时断开 MQTT 连接
app.on('before-quit', () => {
  if (mqttClient && mqttClient.connected) {
    mqttClient.end();
    console.log('MQTT客户端已断开连接');
  }
});