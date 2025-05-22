(function() {
  // 获取DOM元素
  const serverStatusIndicator = document.getElementById('server-status-indicator');
  const serverStatusText = document.getElementById('server-status-text');
  const startServerBtn = document.getElementById('start-server-btn');
  const stopServerBtn = document.getElementById('stop-server-btn');
  const serverLogs = document.getElementById('server-logs');
  const serverPort = document.getElementById('server-port');
  const serverMode = document.getElementById('server-mode');
  const saveConfigBtn = document.getElementById('save-config-btn');

  // 服务端状态
  let serverStatus = 'stopped'; // 'stopped', 'starting', 'running', 'stopping'
  let serverProcess = null;
  let serverConfig = {
    port: 8080,
    mode: 'development'
  };

  // 初始化配置
  function initConfig() {
    // 从本地存储加载配置
    const savedConfig = localStorage.getItem('serverConfig');
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        serverConfig = { ...serverConfig, ...parsedConfig };
        
        // 更新UI
        serverPort.value = serverConfig.port;
        serverMode.value = serverConfig.mode;
      } catch (error) {
        console.error('加载服务端配置失败:', error);
        addLog('加载服务端配置失败: ' + error.message, 'error');
      }
    }
  }

  // 保存配置
  function saveConfig() {
    serverConfig.port = parseInt(serverPort.value, 10);
    serverConfig.mode = serverMode.value;
    
    try {
      localStorage.setItem('serverConfig', JSON.stringify(serverConfig));
      addLog('服务端配置已保存', 'info');
    } catch (error) {
      console.error('保存服务端配置失败:', error);
      addLog('保存服务端配置失败: ' + error.message, 'error');
    }
  }

  // 启动服务端
  function startServer() {
    if (serverStatus !== 'stopped') {
      addLog('服务端已在运行或正在启动中', 'warning');
      return;
    }

    updateServerStatus('starting');
    addLog('正在启动服务端...', 'info');

    // 通过IPC请求主进程启动服务端
    window.electronAPI.startLocalServer(serverConfig)
      .then(processId => {
        serverProcess = processId;
        updateServerStatus('running');
        addLog(`服务端已启动，进程ID: ${processId}，端口: ${serverConfig.port}，模式: ${serverConfig.mode}`, 'success');
      })
      .catch(error => {
        updateServerStatus('stopped');
        addLog(`服务端启动失败: ${error.message}`, 'error');
      });
  }

  // 停止服务端
  function stopServer() {
    if (serverStatus !== 'running') {
      addLog('服务端未在运行', 'warning');
      return;
    }

    updateServerStatus('stopping');
    addLog('正在停止服务端...', 'info');

    // 通过IPC请求主进程停止服务端
    window.electronAPI.stopLocalServer(serverProcess)
      .then(() => {
        serverProcess = null;
        updateServerStatus('stopped');
        addLog('服务端已停止', 'info');
      })
      .catch(error => {
        // 如果停止失败，尝试强制停止
        addLog(`服务端停止失败: ${error.message}，尝试强制停止...`, 'warning');
        return window.electronAPI.forceStopLocalServer(serverProcess);
      })
      .then(() => {
        serverProcess = null;
        updateServerStatus('stopped');
        addLog('服务端已强制停止', 'info');
      })
      .catch(error => {
        addLog(`服务端停止失败: ${error.message}`, 'error');
        // 如果强制停止也失败，重置UI状态
        updateServerStatus('stopped');
      });
  }

  // 更新服务端状态UI
  function updateServerStatus(status) {
    serverStatus = status;
    
    switch(status) {
      case 'stopped':
        serverStatusIndicator.className = 'status-indicator status-stopped';
        serverStatusText.textContent = '服务端状态: 未启动';
        startServerBtn.disabled = false;
        stopServerBtn.disabled = true;
        break;
      case 'starting':
        serverStatusIndicator.className = 'status-indicator status-starting';
        serverStatusText.textContent = '服务端状态: 正在启动...';
        startServerBtn.disabled = true;
        stopServerBtn.disabled = true;
        break;
      case 'running':
        serverStatusIndicator.className = 'status-indicator status-running';
        serverStatusText.textContent = '服务端状态: 运行中';
        startServerBtn.disabled = true;
        stopServerBtn.disabled = false;
        break;
      case 'stopping':
        serverStatusIndicator.className = 'status-indicator status-stopping';
        serverStatusText.textContent = '服务端状态: 正在停止...';
        startServerBtn.disabled = true;
        stopServerBtn.disabled = true;
        break;
    }
  }

  // 添加日志
  function addLog(message, type = 'info') {
    // 移除空日志提示
    const emptyLog = serverLogs.querySelector('.empty-log');
    if (emptyLog) {
      emptyLog.remove();
    }

    // 创建日志元素
    const logItem = document.createElement('div');
    logItem.className = `log-item log-${type}`;

    // 格式化时间
    const now = new Date();
    const timeStr = now.toLocaleTimeString();

    // 设置日志内容
    logItem.innerHTML = `
      <span class="log-time">[${timeStr}]</span>
      <span class="log-message">${message}</span>
    `;

    // 添加到日志容器
    serverLogs.appendChild(logItem);

    // 保持滚动条在底部
    serverLogs.scrollTop = serverLogs.scrollHeight;

    // 限制日志数量
    const maxLogs = 100;
    const logs = serverLogs.querySelectorAll('.log-item');
    if (logs.length > maxLogs) {
      serverLogs.removeChild(logs[0]);
    }
  }

  // 监听主进程发送的服务端日志
  window.electronAPI.onServerLog((log) => {
    addLog(log.message, log.type);
  });

  // 监听主进程发送的服务端状态更新
  window.electronAPI.onServerStatusChange((status) => {
    updateServerStatus(status);
  });

  // 事件监听
  startServerBtn.addEventListener('click', startServer);
  stopServerBtn.addEventListener('click', stopServer);
  saveConfigBtn.addEventListener('click', saveConfig);

  // 初始化
  function init() {
    initConfig();
    updateServerStatus('stopped');
    addLog('本地服务端管理页面已加载', 'info');

    // 检查服务端状态
    window.electronAPI.checkLocalServerStatus()
      .then(status => {
        if (status.running) {
          serverProcess = status.processId;
          updateServerStatus('running');
          addLog(`检测到服务端正在运行，进程ID: ${status.processId}`, 'info');
        }
      })
      .catch(error => {
        console.error('检查服务端状态失败:', error);
      });
  }

  // 页面加载完成后初始化
  window.addEventListener('load', init);

  // 将初始化函数暴露到全局作用域，以便 index.html 可以调用它
  window.initLocalServer = init;
})();