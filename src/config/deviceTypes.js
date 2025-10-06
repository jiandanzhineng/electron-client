// 设备类型映射配置
// 未来可能通过网络获取，暂时放在本地文件中

export const deviceTypeMap = {
  'QTZ': '测距及脚踏传感器',
  'ZIDONGSUO': '自动锁',
  'TD01': '偏轴电机控制器',
  'DIANJI': '电脉冲设备',
  'QIYA': '气压传感器',
  'other': '其他'
}

// 获取设备类型显示名称
export function getDeviceTypeName(type) {
  return deviceTypeMap[type] || type
}

// 获取所有设备类型
export function getAllDeviceTypes() {
  return Object.keys(deviceTypeMap)
}

// 检查设备类型是否存在
export function isValidDeviceType(type) {
  return type in deviceTypeMap
}