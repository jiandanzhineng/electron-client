/**
 * 键盘快捷键处理模块
 * 监听键盘事件，实现特定快捷键功能
 */

const { BrowserWindow } = require('electron');

/**
 * 初始化键盘快捷键监听
 * @param {BrowserWindow} mainWindow - 主窗口实例
 */
function initKeyboardShortcuts(mainWindow) {
  // 记录当前按下的键
  const pressedKeys = new Set();
  
  // 监听全局键盘按下事件
  global.keyDownHandler = (event, webContents) => {
    // 将按下的键添加到集合中
    pressedKeys.add(event.key.toLowerCase());
    
    // 检查是否同时按下了 Alt+Ctrl+L
    if (pressedKeys.has('control') && 
        pressedKeys.has('alt') && 
        pressedKeys.has('l')) {
      
      console.log('Triggered shortcut: Alt+Ctrl+L');
      
      // 切换开发者工具（控制台）
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
          console.log('Developer tools closed');
        } else {
          mainWindow.webContents.openDevTools();
          console.log('Developer tools opened');
        }
      }
      
      // 清空按键记录，防止重复触发
      pressedKeys.clear();
    }
  };
  
  // 监听全局键盘释放事件
  global.keyUpHandler = (event) => {
    // 从集合中移除释放的键
    pressedKeys.delete(event.key.toLowerCase());
  };
  
  // 在窗口内容加载完成后设置键盘事件监听
  mainWindow.webContents.on('did-finish-load', () => {
    // 注入键盘事件监听脚本
    mainWindow.webContents.executeJavaScript(`
      document.addEventListener('keydown', (event) => {
        // 发送键盘按下事件到主进程
        const keyEvent = {
          key: event.key,
          code: event.code,
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          metaKey: event.metaKey
        };
        
        if (event.altKey && event.ctrlKey && event.key.toLowerCase() === 'l') {
          console.log('Captured shortcut combination: Alt+Ctrl+L');
        }
        
        window.electronAPI.sendKeyEvent('keydown', keyEvent);
      });
      
      document.addEventListener('keyup', (event) => {
        // 发送键盘释放事件到主进程
        const keyEvent = {
          key: event.key,
          code: event.code,
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          metaKey: event.metaKey
        };
        window.electronAPI.sendKeyEvent('keyup', keyEvent);
      });
      
      console.log('Keyboard event listeners set');
    `);
  });
  
  // 窗口关闭时清理事件监听
  mainWindow.on('closed', () => {
    global.keyDownHandler = null;
    global.keyUpHandler = null;
  });
  
  console.log('Keyboard shortcut listener initialized');
}

module.exports = {
  initKeyboardShortcuts
};