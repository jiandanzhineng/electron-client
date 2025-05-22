(function() {
// MQTT连接配置
const mqttConfig = {
  host: 'easysmart.local',
  port: 1883,
  clientId: 'easysmart-electron-' + Math.random().toString(16).substr(2, 8),
  connectTimeout: 5000 // 5秒连接超时
};

let connectAttempts = 0;
const maxConnectAttempts = 3;

// 获取DOM元素
const statusElement = document.getElementById('mqtt-status');
const statusIndicator = document.getElementById('status-indicator');
const connectionStatus = document.getElementById('connection-status');
const reconnectButton = document.getElementById('reconnect-button');
const messageList = document.getElementById('message-list'); // 确保获取到消息列表元素

// 连接MQTT服务器
function connectMQTT() {
  // 更新UI状态为正在连接
  updateConnectionStatus('connecting');

  // 通过IPC请求主进程连接MQTT
  const url = `mqtt://${mqttConfig.host}:${mqttConfig.port}`;
  window.electronAPI.mqttConnect(url, mqttConfig);
}

// 更新连接状态UI
function updateConnectionStatus(status) {
  switch(status) {
    case 'connected':
      statusElement.className = 'mqtt-status mqtt-connected';
      statusIndicator.className = 'status-indicator status-connected';
      connectionStatus.textContent = 'MQTT连接状态: 已连接';
      reconnectButton.disabled = true;
      break;
    case 'disconnected':
      statusElement.className = 'mqtt-status mqtt-disconnected';
      statusIndicator.className = 'status-indicator status-disconnected';
      connectionStatus.textContent = 'MQTT连接状态: 未连接';
      reconnectButton.disabled = false;
      break;
    case 'connecting':
      statusElement.className = 'mqtt-status mqtt-disconnected';
      statusIndicator.className = 'status-indicator status-disconnected';
      connectionStatus.textContent = 'MQTT连接状态: 正在连接...';
      reconnectButton.disabled = true;
      break;
  }
}

// 消息列表管理
const messages = [];
const maxMessages = 50; // 限制消息数量

// 添加消息到列表
function addMessageToList(topic, payload) {
  // 移除“暂无消息”提示
  const emptyMessage = messageList.querySelector('.empty-message');
  if (emptyMessage) {
    emptyMessage.remove();
  }

  // 创建新消息元素
  const messageItem = document.createElement('div');
  messageItem.className = 'message-item';

  // 格式化时间
  const now = new Date();
  const timeStr = now.toLocaleTimeString();

  // 设置消息内容
  messageItem.innerHTML = `
    <span class="message-topic">${topic}</span>
    <span class="message-payload">${payload}</span>
    <span class="message-time">${timeStr}</span>
  `;

  // 添加到消息数组顶部
  messages.unshift(messageItem);

  // 如果超过最大消息数，移除最旧的消息
  if (messages.length > maxMessages) {
    messages.pop();
  }

  // 更新UI
  updateMessageList();
}

// 更新消息列表UI
function updateMessageList() {
  // 清空消息列表
  messageList.innerHTML = '';

  // 如果没有消息，显示空消息提示
  if (messages.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = '暂无消息';
    messageList.appendChild(emptyMessage);
    return;
  }

  // 添加所有消息到列表
  messages.forEach(message => {
    messageList.appendChild(message);
  });

  // 保持滚动条在底部
  messageList.scrollTop = messageList.scrollHeight;
}

// 监听主进程发送的 MQTT 状态更新
window.electronAPI.onMqttStatus((status) => {
  console.log('收到 MQTT 状态更新:', status);
  updateConnectionStatus(status);
});

// 监听主进程发送的 MQTT 消息
window.electronAPI.onMqttMessage((message) => {
  console.log('收到 MQTT 消息:', message);
  addMessageToList(message.topic, message.payload);
});

// 重新连接按钮点击事件
reconnectButton.addEventListener('click', () => {
  // 在主进程中处理断开和重新连接逻辑
  connectMQTT();
});

// 页面加载完成后自动连接MQTT
window.addEventListener('load', () => {
  console.log('Electron应用已启动，正在连接MQTT...');
  connectMQTT();
});

// 将 connectMQTT 函数暴露到全局作用域，以便 index.html 可以调用它
window.connectMQTT = connectMQTT;
})();