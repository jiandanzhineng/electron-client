(function() {
  // 获取DOM元素
  const refreshDevicesBtn = document.getElementById('refresh-devices-btn');
  const addDeviceBtn = document.getElementById('add-device-btn');
  const deviceTableBody = document.getElementById('device-table-body');
  const deviceDetails = document.getElementById('device-details');
  const addDeviceModal = document.getElementById('add-device-modal');
  const closeModal = document.querySelector('.close-modal');
  const cancelAddDevice = document.getElementById('cancel-add-device');
  const confirmAddDevice = document.getElementById('confirm-add-device');
  const deviceName = document.getElementById('device-name');
  const deviceId = document.getElementById('device-id');
  const deviceType = document.getElementById('device-type');

  // 设备列表
  let devices = [];
  let selectedDeviceId = null;

  // 设备类型映射
  const deviceTypeMap = {
    'light': '智能灯',
    'switch': '智能开关',
    'sensor': '传感器',
    'camera': '摄像头',
    'other': '其他'
  };

  // 初始化设备列表
  function initDeviceList() {
    // 从本地存储加载设备列表
    const savedDevices = localStorage.getItem('devices');
    if (savedDevices) {
      try {
        devices = JSON.parse(savedDevices);
        updateDeviceList();
      } catch (error) {
        console.error('加载设备列表失败:', error);
      }
    }
  }

  // 保存设备列表到本地存储
  function saveDevices() {
    try {
      localStorage.setItem('devices', JSON.stringify(devices));
    } catch (error) {
      console.error('保存设备列表失败:', error);
    }
  }

  // 更新设备列表UI
  function updateDeviceList() {
    // 清空设备表格
    deviceTableBody.innerHTML = '';

    if (devices.length === 0) {
      // 如果没有设备，显示空行
      const emptyRow = document.createElement('tr');
      emptyRow.className = 'empty-row';
      emptyRow.innerHTML = '<td colspan="5">暂无设备</td>';
      deviceTableBody.appendChild(emptyRow);
      return;
    }

    // 添加设备到表格
    devices.forEach(device => {
      const row = document.createElement('tr');
      row.dataset.deviceId = device.id;
      row.className = device.id === selectedDeviceId ? 'selected-row' : '';

      // 设置连接状态样式
      const statusClass = device.connected ? 'status-connected' : 'status-disconnected';
      const statusText = device.connected ? '已连接' : '未连接';

      row.innerHTML = `
        <td>${device.name}</td>
        <td>${device.id}</td>
        <td>${deviceTypeMap[device.type] || device.type}</td>
        <td><span class="device-status ${statusClass}">${statusText}</span></td>
        <td>
          <button class="action-btn view-btn" data-action="view" data-device-id="${device.id}">查看</button>
          <button class="action-btn edit-btn" data-action="edit" data-device-id="${device.id}">编辑</button>
          <button class="action-btn delete-btn" data-action="delete" data-device-id="${device.id}">删除</button>
        </td>
      `;

      deviceTableBody.appendChild(row);
    });

    // 添加事件监听
    const actionButtons = deviceTableBody.querySelectorAll('.action-btn');
    actionButtons.forEach(button => {
      button.addEventListener('click', handleDeviceAction);
    });

    // 添加行点击事件
    const rows = deviceTableBody.querySelectorAll('tr:not(.empty-row)');
    rows.forEach(row => {
      row.addEventListener('click', (event) => {
        // 如果点击的是按钮，不触发行点击事件
        if (event.target.tagName === 'BUTTON') return;
        
        const deviceId = row.dataset.deviceId;
        selectDevice(deviceId);
      });
    });
  }

  // 处理设备操作
  function handleDeviceAction(event) {
    const action = event.target.dataset.action;
    const deviceId = event.target.dataset.deviceId;
    const device = devices.find(d => d.id === deviceId);

    if (!device) return;

    switch (action) {
      case 'view':
        selectDevice(deviceId);
        break;
      case 'edit':
        editDevice(device);
        break;
      case 'delete':
        deleteDevice(deviceId);
        break;
    }
  }

  // 选择设备并显示详情
  function selectDevice(deviceId) {
    selectedDeviceId = deviceId;
    const device = devices.find(d => d.id === deviceId);

    if (!device) {
      deviceDetails.innerHTML = '<p class="empty-details">设备不存在</p>';
      return;
    }

    // 更新行选中状态
    const rows = deviceTableBody.querySelectorAll('tr');
    rows.forEach(row => {
      if (row.dataset.deviceId === deviceId) {
        row.classList.add('selected-row');
      } else {
        row.classList.remove('selected-row');
      }
    });

    // 更新设备详情
    deviceDetails.innerHTML = `
      <div class="device-detail-header">
        <h4>${device.name}</h4>
        <span class="device-status ${device.connected ? 'status-connected' : 'status-disconnected'}">
          ${device.connected ? '已连接' : '未连接'}
        </span>
      </div>
      <div class="device-detail-info">
        <p><strong>设备ID:</strong> ${device.id}</p>
        <p><strong>设备类型:</strong> ${deviceTypeMap[device.type] || device.type}</p>
        <p><strong>添加时间:</strong> ${new Date(device.addedAt).toLocaleString()}</p>
        <p><strong>最后连接:</strong> ${device.lastConnected ? new Date(device.lastConnected).toLocaleString() : '从未连接'}</p>
      </div>
      <div class="device-detail-actions">
        <button class="secondary-btn" id="connect-device-btn" ${device.connected ? 'disabled' : ''}>连接设备</button>
        <button class="danger-btn" id="disconnect-device-btn" ${!device.connected ? 'disabled' : ''}>断开连接</button>
      </div>
    `;

    // 添加连接/断开连接按钮事件
    const connectBtn = document.getElementById('connect-device-btn');
    const disconnectBtn = document.getElementById('disconnect-device-btn');

    if (connectBtn) {
      connectBtn.addEventListener('click', () => connectDevice(device.id));
    }

    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', () => disconnectDevice(device.id));
    }
  }

  // 连接设备
  function connectDevice(deviceId) {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    // 模拟连接设备
    device.connected = true;
    device.lastConnected = Date.now();
    saveDevices();
    updateDeviceList();
    selectDevice(deviceId);
  }

  // 断开设备连接
  function disconnectDevice(deviceId) {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    // 模拟断开设备连接
    device.connected = false;
    saveDevices();
    updateDeviceList();
    selectDevice(deviceId);
  }

  // 添加设备
  function addDevice() {
    const name = deviceName.value.trim();
    const id = deviceId.value.trim();
    const type = deviceType.value;

    if (!name || !id) {
      alert('设备名称和ID不能为空');
      return;
    }

    // 检查ID是否已存在
    if (devices.some(d => d.id === id)) {
      alert('设备ID已存在');
      return;
    }

    // 创建新设备
    const newDevice = {
      id,
      name,
      type,
      connected: false,
      addedAt: Date.now(),
      lastConnected: null
    };

    // 添加到设备列表
    devices.push(newDevice);
    saveDevices();
    updateDeviceList();
    closeAddDeviceModal();

    // 选中新添加的设备
    selectDevice(id);
  }

  // 编辑设备
  function editDevice(device) {
    // 填充表单
    deviceName.value = device.name;
    deviceId.value = device.id;
    deviceType.value = device.type;

    // 打开模态框
    addDeviceModal.style.display = 'block';

    // 修改确认按钮文本
    confirmAddDevice.textContent = '确认修改';

    // 修改确认按钮事件
    confirmAddDevice.onclick = function() {
      // 更新设备信息
      const updatedDevice = devices.find(d => d.id === device.id);
      if (updatedDevice) {
        updatedDevice.name = deviceName.value.trim();
        updatedDevice.type = deviceType.value;
        saveDevices();
        updateDeviceList();
        selectDevice(device.id);
      }
      closeAddDeviceModal();
    };
  }

  // 删除设备
  function deleteDevice(deviceId) {
    if (!confirm('确定要删除此设备吗？')) return;

    // 从设备列表中移除
    devices = devices.filter(d => d.id !== deviceId);
    saveDevices();
    updateDeviceList();

    // 如果删除的是当前选中的设备，清空详情
    if (selectedDeviceId === deviceId) {
      selectedDeviceId = null;
      deviceDetails.innerHTML = '<p class="empty-details">请选择一个设备查看详情</p>';
    }
  }

  // 打开添加设备模态框
  function openAddDeviceModal() {
    // 重置表单
    deviceName.value = '';
    deviceId.value = '';
    deviceType.value = 'light';

    // 重置确认按钮
    confirmAddDevice.textContent = '确认添加';
    confirmAddDevice.onclick = addDevice;

    // 显示模态框
    addDeviceModal.style.display = 'block';
  }

  // 关闭添加设备模态框
  function closeAddDeviceModal() {
    addDeviceModal.style.display = 'none';
  }

  // 刷新设备列表
  function refreshDevices() {
    // 模拟刷新设备列表
    // 在实际应用中，这里应该从服务器或本地服务获取设备列表
    updateDeviceList();
  }

  // 事件监听
  refreshDevicesBtn.addEventListener('click', refreshDevices);
  addDeviceBtn.addEventListener('click', openAddDeviceModal);
  closeModal.addEventListener('click', closeAddDeviceModal);
  cancelAddDevice.addEventListener('click', closeAddDeviceModal);

  // 点击模态框外部关闭模态框
  window.addEventListener('click', (event) => {
    if (event.target === addDeviceModal) {
      closeAddDeviceModal();
    }
  });

  // 初始化
  function init() {
    initDeviceList();
    console.log('设备管理页面已加载');
  }

  // 页面加载完成后初始化
  window.addEventListener('load', init);

  // 将初始化函数暴露到全局作用域，以便 index.html 可以调用它
  window.initDeviceManagement = init;
})();