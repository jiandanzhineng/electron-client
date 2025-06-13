<template>
  <div class="device-management">
    <div class="header">
      <h1>设备管理</h1>
      <div class="header-actions">
        <button @click="refreshDevices" class="btn btn-secondary">
          🔄 刷新设备
        </button>
        <button @click="showAddModal = true" class="btn btn-primary">
          ➕ 添加设备
        </button>
      </div>
    </div>

    <div class="content-grid">
      <!-- 设备列表 -->
      <div class="device-list-section">
        <div class="section-header">
          <h2>设备列表</h2>
          <div class="device-stats">
            <span class="stat-item">
              总数: <strong>{{ deviceStore.devices.length }}</strong>
            </span>
            <span class="stat-item">
              在线: <strong class="online">{{ deviceStore.connectedDevices.length }}</strong>
            </span>
            <span class="stat-item">
              离线: <strong class="offline">{{ deviceStore.disconnectedDevices.length }}</strong>
            </span>
          </div>
        </div>
        
        <div class="device-table-container">
          <table class="device-table">
            <thead>
              <tr>
                <th>设备名称</th>
                <th>设备ID</th>
                <th>类型</th>
                <th>状态</th>
                <th>最后上报</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="device in deviceStore.devices" 
                :key="device.id"
                :class="{ 'selected': device.id === deviceStore.selectedDeviceId }"
                @click="selectDevice(device.id)"
              >
                <td>{{ device.name }}</td>
                <td>{{ device.id }}</td>
                <td>{{ deviceStore.deviceTypeMap[device.type] || device.type }}</td>
                <td>
                  <span :class="['status-badge', device.connected ? 'online' : 'offline']">
                    {{ device.connected ? '在线' : '离线' }}
                  </span>
                </td>
                <td>{{ formatLastReport(device.lastReport) }}</td>
                <td>
                  <button @click.stop="removeDevice(device.id)" class="btn btn-danger btn-sm">
                    删除
                  </button>
                </td>
              </tr>
              <tr v-if="deviceStore.devices.length === 0">
                <td colspan="6" class="no-data">暂无设备数据</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 设备详情 -->
      <div class="device-details-section">
        <h2>设备详情</h2>
        <div v-if="selectedDevice" class="device-details">
          <div class="detail-card">
            <h3>{{ selectedDevice.name }}</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <label>设备ID:</label>
                <span>{{ selectedDevice.id }}</span>
              </div>
              <div class="detail-item">
                <label>设备类型:</label>
                <span>{{ deviceStore.deviceTypeMap[selectedDevice.type] || selectedDevice.type }}</span>
              </div>
              <div class="detail-item">
                <label>连接状态:</label>
                <span :class="['status-badge', selectedDevice.connected ? 'online' : 'offline']">
                  {{ selectedDevice.connected ? '在线' : '离线' }}
                </span>
              </div>
              <div class="detail-item">
                <label>最后上报:</label>
                <span>{{ formatLastReport(selectedDevice.lastReport) }}</span>
              </div>
            </div>
            
            <div v-if="selectedDevice.data && Object.keys(selectedDevice.data).length > 0" class="device-data">
              <div class="device-data-header">
                <h4>设备数据</h4>
                <div class="data-actions">
                  <button v-if="!isEditing" @click="startEdit" class="btn btn-secondary btn-sm">
                    编辑
                  </button>
                  <div v-else class="edit-actions">
                    <button @click="saveChanges" class="btn btn-primary btn-sm">
                      保存
                    </button>
                    <button @click="cancelEdit" class="btn btn-secondary btn-sm">
                      取消
                    </button>
                  </div>
                </div>
              </div>
              <div class="data-grid">
                <div v-for="(value, key) in selectedDevice.data" :key="key" class="data-item">
                  <label>{{ key }}:</label>
                  <span v-if="!isEditing">{{ value }}</span>
                  <input 
                    v-else-if="getInputType(value) === 'checkbox'" 
                    v-model="editData[key]" 
                    type="checkbox"
                    class="data-checkbox"
                  >
                  <input 
                    v-else 
                    v-model="editData[key]" 
                    :type="getInputType(value)"
                    class="data-input"
                  >
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="no-selection">
          <p>请选择一个设备查看详情</p>
        </div>
      </div>
    </div>

    <!-- 添加设备模态框 -->
    <div v-if="showAddModal" class="modal-overlay" @click="closeModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>添加设备</h3>
          <button @click="closeModal" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="addDevice">
            <div class="form-group">
              <label for="deviceName">设备名称:</label>
              <input 
                id="deviceName" 
                v-model="newDevice.name" 
                type="text" 
                required 
                placeholder="请输入设备名称"
              >
            </div>
            <div class="form-group">
              <label for="deviceId">设备ID:</label>
              <input 
                id="deviceId" 
                v-model="newDevice.id" 
                type="text" 
                required 
                placeholder="请输入设备ID"
              >
            </div>
            <div class="form-group">
              <label for="deviceType">设备类型:</label>
              <select id="deviceType" v-model="newDevice.type" required>
                <option value="">请选择设备类型</option>
                <option v-for="(name, type) in deviceStore.deviceTypeMap" :key="type" :value="type">
                  {{ name }}
                </option>
              </select>
            </div>
            <div class="modal-actions">
              <button type="button" @click="closeModal" class="btn btn-secondary">
                取消
              </button>
              <button type="submit" class="btn btn-primary">
                添加
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useDeviceStore } from '../stores/deviceStore'
import { useServiceStore } from '../stores/serviceStore'

const deviceStore = useDeviceStore()
const serviceStore = useServiceStore()

const showAddModal = ref(false)
const newDevice = ref({
  name: '',
  id: '',
  type: ''
})

// 编辑相关状态
const isEditing = ref(false)
const editData = ref({})
const originalData = ref({})

const selectedDevice = computed(() => {
  return deviceStore.selectedDeviceId ? deviceStore.getDeviceById(deviceStore.selectedDeviceId) : null
})

onMounted(() => {
  deviceStore.initDeviceList()
  serviceStore.init() // 初始化服务监听器，包括MQTT消息处理
})

function selectDevice(deviceId) {
  deviceStore.selectDevice(deviceId)
}

function refreshDevices() {
  deviceStore.refreshDevices()
}

function removeDevice(deviceId) {
  if (confirm('确定要删除这个设备吗？')) {
    deviceStore.removeDevice(deviceId)
  }
}

function addDevice() {
  if (newDevice.value.name && newDevice.value.id && newDevice.value.type) {
    // 检查设备ID是否已存在
    if (deviceStore.getDeviceById(newDevice.value.id)) {
      alert('设备ID已存在，请使用其他ID')
      return
    }
    
    deviceStore.addDevice(newDevice.value)
    closeModal()
  }
}

function closeModal() {
  showAddModal.value = false
  newDevice.value = {
    name: '',
    id: '',
    type: ''
  }
}

function formatLastReport(timestamp) {
  if (!timestamp) return '从未上报'
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) { // 小于1分钟
    return '刚刚'
  } else if (diff < 3600000) { // 小于1小时
    return `${Math.floor(diff / 60000)}分钟前`
  } else if (diff < 86400000) { // 小于1天
    return `${Math.floor(diff / 3600000)}小时前`
  } else {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }
}

// 编辑相关方法
function startEdit() {
  if (!selectedDevice.value || !selectedDevice.value.data) return
  
  isEditing.value = true
  // 深拷贝当前数据
  originalData.value = JSON.parse(JSON.stringify(selectedDevice.value.data))
  editData.value = JSON.parse(JSON.stringify(selectedDevice.value.data))
}

function cancelEdit() {
  isEditing.value = false
  editData.value = {}
  originalData.value = {}
}

async function saveChanges() {
  if (!selectedDevice.value) return
  
  try {
    // 构建下发数据
    const updateData = {
      method: 'update'
    }
    
    // 只包含修改过的属性
    for (const key in editData.value) {
      if (editData.value[key] !== originalData.value[key]) {
        // 保持原始数据类型
        const originalValue = originalData.value[key]
        let newValue = editData.value[key]
        
        if (typeof originalValue === 'number') {
          newValue = Number(newValue)
        } else if (typeof originalValue === 'boolean') {
          newValue = newValue === 'true' || newValue === true
        }
        
        updateData[key] = newValue
      }
    }
    
    // 如果没有修改，直接取消编辑
    if (Object.keys(updateData).length === 1) {
      cancelEdit()
      return
    }
    
    // 下发到设备
    const topic = `/drecv/${selectedDevice.value.id}`
    await serviceStore.publishMessage(topic, JSON.stringify(updateData))
    
    // 更新本地设备数据
    deviceStore.updateDeviceData(selectedDevice.value.id, editData.value)
    
    // 退出编辑模式
    cancelEdit()
    
    console.log('设备数据更新成功')
  } catch (error) {
    console.error('保存设备数据失败:', error)
    alert('保存失败，请重试')
  }
}

function getInputType(value) {
  if (typeof value === 'number') {
    return 'number'
  } else if (typeof value === 'boolean') {
    return 'checkbox'
  } else {
    return 'text'
  }
}
</script>

<style scoped>
.device-management {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e1e8ed;
}

.header h1 {
  color: #2c3e50;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.content-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 30px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h2 {
  color: #2c3e50;
  margin: 0;
}

.device-stats {
  display: flex;
  gap: 15px;
}

.stat-item {
  color: #7f8c8d;
  font-size: 14px;
}

.stat-item .online {
  color: #27ae60;
}

.stat-item .offline {
  color: #e74c3c;
}

.device-table-container {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.device-table {
  width: 100%;
  border-collapse: collapse;
}

.device-table th {
  background: #f8f9fa;
  padding: 15px;
  text-align: left;
  font-weight: 600;
  color: #2c3e50;
  border-bottom: 2px solid #e1e8ed;
}

.device-table td {
  padding: 15px;
  border-bottom: 1px solid #e1e8ed;
}

.device-table tbody tr {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.device-table tbody tr:hover {
  background-color: #f8f9fa;
}

.device-table tbody tr.selected {
  background-color: #e3f2fd;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.online {
  background: #d4edda;
  color: #155724;
}

.status-badge.offline {
  background: #f8d7da;
  color: #721c24;
}

.no-data {
  text-align: center;
  color: #7f8c8d;
  font-style: italic;
  padding: 40px;
}

.device-details-section h2 {
  color: #2c3e50;
  margin-bottom: 20px;
}

.detail-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.detail-card h3 {
  color: #2c3e50;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e1e8ed;
}

.detail-grid {
  display: grid;
  gap: 15px;
  margin-bottom: 20px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-item label {
  font-weight: 600;
  color: #7f8c8d;
}

.device-data h4 {
  color: #2c3e50;
  margin-bottom: 15px;
}

.data-grid {
  display: grid;
  gap: 10px;
}

.data-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 4px;
}

.data-item label {
  font-weight: 600;
  color: #495057;
}

.no-selection {
  background: white;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.no-selection p {
  color: #7f8c8d;
  font-style: italic;
  margin: 0;
}

/* 按钮样式 */
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover {
  background: #2980b9;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.btn-secondary:hover {
  background: #7f8c8d;
}

.btn-danger {
  background: #e74c3c;
  color: white;
}

.btn-danger:hover {
  background: #c0392b;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

/* 设备数据编辑样式 */
.device-data-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.device-data-header h4 {
  margin: 0;
  color: #2c3e50;
}

.data-actions {
  display: flex;
  gap: 8px;
}

.edit-actions {
  display: flex;
  gap: 8px;
}

.data-input {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  width: 100%;
  transition: border-color 0.2s ease;
}

.data-input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.data-checkbox {
  width: auto;
  margin: 0;
  cursor: pointer;
}

.data-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.data-item:last-child {
  border-bottom: none;
}

.data-item label {
  font-weight: 500;
  color: #555;
  min-width: 100px;
}

.data-item span {
  color: #333;
  flex: 1;
  text-align: right;
}

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e1e8ed;
}

.modal-header h3 {
  margin: 0;
  color: #2c3e50;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #7f8c8d;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #2c3e50;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 600;
  color: #2c3e50;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
</style>