#!/usr/bin/env node

/**
 * BluFi配网测试脚本
 * 基于ESP32 BluFi协议实现WiFi配网功能
 */

const noble = require('@abandonware/noble');

let isInitialized = false;
let discoveredDevices = [];
let sequence = -1; // 序列号初始化为-1，自增后从0开始

// BluFi协议常量
const FRAME_TYPE = {
  CTRL: 0x00,
  DATA: 0x01
};

const CTRL_SUBTYPE = {
  SET_OP_MODE: 0x02,
  CONNECT_WIFI: 0x03,
  GET_WIFI_STATUS: 0x05
};

const DATA_SUBTYPE = {
  WIFI_SSID: 0x02,
  WIFI_PASSWORD: 0x03,
  WIFI_CONNECTION_STATE: 0x0F
};

const WIFI_MODE = {
  STATION: 0x01
};

function log(message) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

// 初始化蓝牙
function initBluetooth() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('蓝牙初始化超时'));
    }, 5000);

    noble.on('stateChange', (state) => {
      clearTimeout(timeout);
      if (state === 'poweredOn') {
        isInitialized = true;
        log('✅ 蓝牙初始化成功');
        resolve();
      } else {
        reject(new Error(`❌ 蓝牙状态异常: ${state}`));
      }
    });

    if (noble.state === 'poweredOn') {
      clearTimeout(timeout);
      isInitialized = true;
      log('✅ 蓝牙已就绪');
      resolve();
    }
  });
}

// 扫描设备
function scanDevices() {
  return new Promise((resolve) => {
    log('🔍 开始扫描BluFi设备...');
    
    const onDiscover = (peripheral) => {
      const name = peripheral.advertisement.localName || '未知设备';
      
      if (name.includes('BLUFI') || name.includes('ESP32')) {
        const device = {
          id: peripheral.id,
          name: name,
          rssi: peripheral.rssi,
          peripheral: peripheral
        };
        
        discoveredDevices.push(device);
        log(`📱 发现设备: ${name} (${peripheral.id}) 信号强度: ${peripheral.rssi}dBm`);
      }
    };

    noble.on('discover', onDiscover);
    noble.startScanning([], false);

    setTimeout(() => {
      noble.stopScanning();
      noble.removeListener('discover', onDiscover);
      log(`🔍 扫描完成，共发现 ${discoveredDevices.length} 个BluFi设备`);
      resolve(discoveredDevices);
    }, 8000);
  });
}

// 连接设备
function connectDevice(device) {
  return new Promise((resolve, reject) => {
    log(`🔗 正在连接设备: ${device.name}`);
    
    device.peripheral.connect((error) => {
      if (error) {
        reject(error);
        return;
      }

      log(`✅ 设备连接成功: ${device.name}`);
      
      // 发现服务
      device.peripheral.discoverServices(['ffff'], (error, services) => {
        if (error) {
          reject(error);
          return;
        }

        if (services.length === 0) {
          reject(new Error('未找到BluFi服务'));
          return;
        }

        log(`🔧 发现BluFi服务`);
        
        // 发现特征值
        services[0].discoverCharacteristics([], (error, characteristics) => {
          if (error) {
            reject(error);
            return;
          }

          log(`📡 发现 ${characteristics.length} 个特征值`);
          
          let writeChar = null;
          let notifyChar = null;
          
          characteristics.forEach(char => {
            if (char.uuid === 'ff01') {
              writeChar = char;
              log(`✅ 找到写入特征值: ff01`);
            } else if (char.uuid === 'ff02') {
              notifyChar = char;
              log(`✅ 找到通知特征值: ff02`);
            }
          });

          if (writeChar && notifyChar) {
            log(`🎉 设备连接完成，所有特征值已找到`);
            resolve({ device, writeChar, notifyChar });
          } else {
            reject(new Error('未找到必要的特征值'));
          }
        });
      });
    });
  });
}

// 构建BluFi协议帧
function buildFrame(frameType, frameSubType, data) {
  const typeSubType = (frameType & 0x03) | ((frameSubType & 0x3F) << 2);
  sequence = (sequence + 1) % 256;
  
  const frameSize = 4 + (data ? data.length : 0);
  const frame = new Uint8Array(frameSize);
  
  frame[0] = typeSubType;
  frame[1] = 0; // 帧控制
  frame[2] = sequence;
  frame[3] = data ? data.length : 0;
  
  if (data && data.length > 0) {
    frame.set(data, 4);
  }
  
  log(`📤 发送帧: ${Array.from(frame).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
  return frame;
}

// 字符串转Uint8Array
function stringToUint8Array(str) {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

// 发送控制帧
function sendCtrlFrame(writeChar, subType, data) {
  return new Promise((resolve, reject) => {
    const frame = buildFrame(FRAME_TYPE.CTRL, subType, data);
    writeChar.write(Buffer.from(frame), false, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

// 发送数据帧
function sendDataFrame(writeChar, subType, data) {
  return new Promise((resolve, reject) => {
    const frame = buildFrame(FRAME_TYPE.DATA, subType, data);
    writeChar.write(Buffer.from(frame), false, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

// 启用通知
function enableNotify(notifyChar) {
  return new Promise((resolve, reject) => {
    notifyChar.on('data', (data) => {
      log(`📥 收到响应: ${Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      
      if (data.length >= 4) {
        const frameType = data[0] & 0x03;
        const frameSubType = (data[0] >> 2) & 0x3F;
        const frameCtrl = data[1];
        const seq = data[2];
        const dataLen = data[3];
        
        log(`📋 帧解析: 类型=${frameType}, 子类型=${frameSubType}, 控制=${frameCtrl}, 序列=${seq}, 长度=${dataLen}`);
        
        if (frameType === FRAME_TYPE.DATA && frameSubType === DATA_SUBTYPE.WIFI_CONNECTION_STATE && dataLen > 0) {
          const status = data[4];
          log(`📶 WiFi连接状态: ${status === 0 ? '已连接并获取IP' : status === 1 ? '已断开' : status === 2 ? '连接中' : '未知状态'}`);
        }
      }
    });
    
    notifyChar.subscribe((error) => {
      if (error) {
        reject(error);
      } else {
        log('✅ 通知已启用');
        resolve();
      }
    });
  });
}

// WiFi配网
async function configureWifi(writeChar, ssid, password) {
  log('🌐 开始WiFi配网...');
  
  // 1. 设置操作模式为Station
  log('📡 设置WiFi模式为Station');
  await sendCtrlFrame(writeChar, CTRL_SUBTYPE.SET_OP_MODE, new Uint8Array([WIFI_MODE.STATION]));
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // 2. 发送SSID
  log(`📡 发送SSID: ${ssid}`);
  const ssidData = stringToUint8Array(ssid);
  await sendDataFrame(writeChar, DATA_SUBTYPE.WIFI_SSID, ssidData);
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // 3. 发送密码
  log(`🔐 发送密码: ${'*'.repeat(password.length)}`);
  const passwordData = stringToUint8Array(password);
  await sendDataFrame(writeChar, DATA_SUBTYPE.WIFI_PASSWORD, passwordData);
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // 4. 连接WiFi
  log('🔗 发送连接WiFi命令');
  await sendCtrlFrame(writeChar, CTRL_SUBTYPE.CONNECT_WIFI, new Uint8Array([]));
  
  log('✅ WiFi配网命令已发送');
}

// 获取WiFi状态
async function getWifiStatus(writeChar) {
  log('📊 查询WiFi连接状态');
  await sendCtrlFrame(writeChar, CTRL_SUBTYPE.GET_WIFI_STATUS, new Uint8Array([]));
}

// 主测试函数
async function quickTest() {
  console.log('🚀 BluFi配网测试开始\n');

  // WiFi配置 - 请修改为你的WiFi信息
  const wifiConfig = {
    ssid: 'easysmart',     // 请修改为实际的WiFi名称
    password: '11111111'   // 请修改为实际的WiFi密码
  };

  try {
    // 1. 初始化蓝牙
    await initBluetooth();
    
    // 2. 扫描设备
    const devices = await scanDevices();
    
    if (devices.length === 0) {
      log('❌ 未发现BluFi设备');
      return;
    }

    // 3. 连接第一个设备
    const result = await connectDevice(devices[0]);
    
    // 4. 启用通知
    await enableNotify(result.notifyChar);
    
    // 5. 执行WiFi配网
    await configureWifi(result.writeChar, wifiConfig.ssid, wifiConfig.password);
    
    // 8. 测试完成
    log('\n🎉 BluFi配网测试完成！');
    log(`📊 测试结果:`);
    log(`   - 设备名称: ${result.device.name}`);
    log(`   - 设备ID: ${result.device.id}`);
    log(`   - 信号强度: ${result.device.rssi}dBm`);
    log(`   - WiFi SSID: ${wifiConfig.ssid}`);
    log(`   - 配网命令: ✅ 已发送`);

    // 9. 断开连接
    await new Promise(resolve => setTimeout(resolve, 1000));
    result.device.peripheral.disconnect();
    log('🔌 设备已断开连接');

  } catch (error) {
    log(`❌ 测试失败: ${error.message}`);
  } finally {
    noble.stopScanning();
    process.exit(0);
  }
}

// 运行测试
if (require.main === module) {
  quickTest();
}