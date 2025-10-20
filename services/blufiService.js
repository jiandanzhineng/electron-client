/**
 * BluFi配网服务
 * 基于ESP32 BluFi协议实现WiFi配网功能
 */

let noble;
try {
  noble = require('@abandonware/noble');
} catch (error) {
  console.warn('Noble库加载失败，将使用模拟模式:', error.message);
  noble = null;
}

const logger = require('./logService');

class BluFiService {
  constructor() {
    this.mainWindow = null;
    this.isInitialized = false;
    this.discoveredDevices = [];
    this.sequence = -1;
    this.isConfiguring = false;
    this.currentConnection = null; // 存储当前连接信息
    
    // BluFi协议常量
    this.FRAME_TYPE = {
      CTRL: 0x00,
      DATA: 0x01
    };

    this.CTRL_SUBTYPE = {
      SET_OP_MODE: 0x02,
      CONNECT_WIFI: 0x03,
      GET_WIFI_STATUS: 0x05
    };

    this.DATA_SUBTYPE = {
      WIFI_SSID: 0x02,
      WIFI_PASSWORD: 0x03,
      WIFI_CONNECTION_STATE: 0x0F
    };

    this.WIFI_MODE = {
      STATION: 0x01
    };
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  // 发送日志到渲染进程
  sendLog(message) {
    const logMessage = `[${new Date().toLocaleTimeString()}] ${message}`;
    logger.info(logMessage, 'blufi');
    
    if (this.mainWindow) {
      this.mainWindow.webContents.send('blufi-log', logMessage);
    }
  }

  // 初始化蓝牙
  async initBluetooth() {
    return new Promise((resolve, reject) => {
      if (!noble) {
        reject(new Error('蓝牙库不可用'));
        return;
      }
      const timeout = setTimeout(() => {
        reject(new Error('蓝牙初始化超时'));
      }, 15000);

      noble.removeAllListeners?.('stateChange');
      noble.on('stateChange', (state) => {
        clearTimeout(timeout);
        if (state === 'poweredOn') {
          this.isInitialized = true;
          this.sendLog('✅ 蓝牙初始化成功');
          resolve();
        } else {
          reject(new Error(`❌ 蓝牙状态异常: ${state}`));
        }
      });

      if (noble.state === 'poweredOn') {
        clearTimeout(timeout);
        this.isInitialized = true;
        this.sendLog('✅ 蓝牙已就绪');
        resolve();
      }
    });
  }

  // 扫描设备
  async scanDevices() {
    this.sendLog('🔍 开始扫描BluFi设备...');
    this.discoveredDevices = [];

    await this.initBluetooth();
    if (!noble || noble.state !== 'poweredOn') {
      throw new Error('蓝牙未开启或不可用');
    }

    return new Promise((resolve, reject) => {
      const onDiscover = (peripheral) => {
        const name = peripheral.advertisement.localName || '未知设备';
        if (name?.includes('BLUFI') || name?.includes('ESP32')) {
          const device = {
            id: peripheral.id,
            name,
            rssi: peripheral.rssi,
            peripheral
          };
          this.discoveredDevices.push(device);
          this.sendLog(`📱 发现设备: ${name} (${peripheral.id}) 信号强度: ${peripheral.rssi}dBm`);
        }
      };

      noble.on('discover', onDiscover);
      try {
        noble.startScanning([], false, (error) => {
          if (error) {
            noble.removeListener('discover', onDiscover);
            this.sendLog(`❌ 扫描启动失败: ${error.message}`);
            reject(error);
            return;
          }
        });
      } catch (err) {
        noble.removeListener('discover', onDiscover);
        this.sendLog(`❌ 扫描调用异常: ${err.message}`);
        reject(err);
        return;
      }

      setTimeout(() => {
        try { noble.stopScanning(); } catch (_) {}
        noble.removeListener('discover', onDiscover);
        this.sendLog(`🔍 扫描完成，共发现 ${this.discoveredDevices.length} 个BluFi设备`);
        const serializableDevices = this.discoveredDevices.map(device => ({
          id: device.id,
          name: device.name,
          rssi: device.rssi,
          uuid: device.peripheral.uuid,
          address: device.peripheral.address
        }));
        resolve(serializableDevices);
      }, 8000);
    });
  }

  // 连接设备
  async connectDevice(deviceId) {
    await this.initBluetooth();
    if (!noble || noble.state !== 'poweredOn') {
      throw new Error('蓝牙未开启或不可用');
    }
    return new Promise((resolve, reject) => {
      const id = typeof deviceId === 'string' ? deviceId : deviceId.id;
      this.sendLog(`🔗 正在连接设备: ${id}`);
      this.sequence = -1;

      const device = this.discoveredDevices.find(d => d.id === id);
      if (!device) {
        reject(new Error('设备未找到，请重新扫描'));
        return;
      }

      device.peripheral.connect((error) => {
        if (error) {
          reject(error);
          return;
        }
        this.sendLog(`✅ 设备连接成功: ${device.name}`);
        device.peripheral.discoverServices(['ffff'], (error, services) => {
          if (error) {
            reject(error);
            return;
          }
          if (services.length === 0) {
            reject(new Error('未找到BluFi服务'));
            return;
          }
          this.sendLog(`🔧 发现BluFi服务`);
          services[0].discoverCharacteristics([], (error, characteristics) => {
            if (error) {
              reject(error);
              return;
            }
            this.sendLog(`📡 发现 ${characteristics.length} 个特征值`);
            let writeChar = null;
            let notifyChar = null;
            characteristics.forEach(char => {
              if (char.uuid === 'ff01') {
                writeChar = char;
                this.sendLog(`✅ 找到写入特征值: ff01`);
              } else if (char.uuid === 'ff02') {
                notifyChar = char;
                this.sendLog(`✅ 找到通知特征值: ff02`);
              }
            });
            if (writeChar && notifyChar) {
              this.sendLog(`🎉 设备连接完成，所有特征值已找到`);
              this.currentConnection = { device, writeChar, notifyChar };
              resolve({ success: true, deviceId: device.id, deviceName: device.name });
            } else {
              reject(new Error('未找到必要的特征值'));
            }
          });
        });
      });
    });
  }

  // 构建BluFi协议帧
  buildFrame(frameType, frameSubType, data) {
    const typeSubType = (frameType & 0x03) | ((frameSubType & 0x3F) << 2);
    this.sequence = (this.sequence + 1) % 256;
    
    const frameSize = 4 + (data ? data.length : 0);
    const frame = new Uint8Array(frameSize);
    
    frame[0] = typeSubType;
    frame[1] = 0; // 帧控制
    frame[2] = this.sequence;
    frame[3] = data ? data.length : 0;
    
    if (data && data.length > 0) {
      frame.set(data, 4);
    }
    
    this.sendLog(`📤 发送帧: ${Array.from(frame).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    return frame;
  }

  // 字符串转Uint8Array
  stringToUint8Array(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
  }

  // 发送控制帧
  async sendCtrlFrame(writeChar, subType, data) {
    return new Promise((resolve, reject) => {
      const frame = this.buildFrame(this.FRAME_TYPE.CTRL, subType, data);
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
  async sendDataFrame(writeChar, subType, data) {
    return new Promise((resolve, reject) => {
      const frame = this.buildFrame(this.FRAME_TYPE.DATA, subType, data);
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
  async enableNotify(notifyChar) {
    return new Promise((resolve, reject) => {
      notifyChar.on('data', (data) => {
        this.sendLog(`📥 收到响应: ${Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
        
        if (data.length >= 4) {
          const frameType = data[0] & 0x03;
          const frameSubType = (data[0] >> 2) & 0x3F;
          const frameCtrl = data[1];
          const seq = data[2];
          const dataLen = data[3];
          
          this.sendLog(`📋 帧解析: 类型=${frameType}, 子类型=${frameSubType}, 控制=${frameCtrl}, 序列=${seq}, 长度=${dataLen}`);
          
          if (frameType === this.FRAME_TYPE.DATA && frameSubType === this.DATA_SUBTYPE.WIFI_CONNECTION_STATE && dataLen > 0) {
            const status = data[4];
            const statusText = status === 0 ? '已连接并获取IP' : status === 1 ? '已断开' : status === 2 ? '连接中' : '未知状态';
            this.sendLog(`📶 WiFi连接状态: ${statusText}`);
          }
        }
      });
      
      notifyChar.subscribe((error) => {
        if (error) {
          reject(error);
        } else {
          this.sendLog('✅ 通知已启用');
          resolve();
        }
      });
    });
  }

  // WiFi配网
  async configureWifi(config) {
    this.sendLog('🌐 开始WiFi配网...');
    if (!this.currentConnection) {
      throw new Error('没有活动的设备连接');
    }
    const { writeChar } = this.currentConnection;
    const { ssid, password } = config;
    this.sendLog('📡 设置WiFi模式为Station');
    await this.sendCtrlFrame(writeChar, this.CTRL_SUBTYPE.SET_OP_MODE, new Uint8Array([this.WIFI_MODE.STATION]));
    await new Promise(resolve => setTimeout(resolve, 100));
    this.sendLog(`📡 发送SSID: ${ssid}`);
    const ssidData = this.stringToUint8Array(ssid);
    await this.sendDataFrame(writeChar, this.DATA_SUBTYPE.WIFI_SSID, ssidData);
    await new Promise(resolve => setTimeout(resolve, 100));
    this.sendLog(`🔐 发送密码: ${'*'.repeat(password.length)}`);
    const pwdData = this.stringToUint8Array(password);
    await this.sendDataFrame(writeChar, this.DATA_SUBTYPE.WIFI_PASSWORD, pwdData);
    await new Promise(resolve => setTimeout(resolve, 100));
    this.sendLog('🔗 发送连接WiFi命令');
    await this.sendCtrlFrame(writeChar, this.CTRL_SUBTYPE.CONNECT_WIFI, new Uint8Array([]));
  }

  // 主配网流程
  async startConfiguration(config) {
    if (this.isConfiguring) {
      throw new Error('配网正在进行中');
    }

    this.isConfiguring = true;
    this.sequence = -1; // 重置序列号
    this.sendLog('🚀 BluFi配网开始');

    try {
      // 1. 初始化蓝牙
      await this.initBluetooth();
      
      // 2. 扫描设备
      const devices = await this.scanDevices();
      
      if (devices.length === 0) {
        throw new Error('未发现BluFi设备');
      }

      // 3. 连接第一个设备
      await this.connectDevice(devices[0].id);
      
      // 4. 启用通知
      await this.enableNotify(this.currentConnection.notifyChar);
      
      // 5. 执行WiFi配网
      await this.configureWifi(config);
      
      // 6. 等待一段时间让配网完成
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 7. 断开连接
      await this.disconnect();
      
      this.sendLog('🎉 BluFi配网完成！');
      return { success: true };
      
    } catch (error) {
      this.sendLog(`❌ 配网失败: ${error.message}`);
      throw error;
    } finally {
      this.isConfiguring = false;
      if (noble) {
        noble.stopScanning();
      }
    }
  }

  // 断开设备连接
  async disconnect() {
    if (!this.currentConnection) {
      this.sendLog('⚠️ 没有连接的设备需要断开');
      return;
    }
    const { device } = this.currentConnection;
    if (device && device.peripheral) {
      device.peripheral.disconnect();
      this.sendLog('🔌 设备已断开连接');
    }
    this.currentConnection = null;
  }

  // 停止配网
  stopConfiguration() {
    if (this.isConfiguring) {
      this.isConfiguring = false;
      if (noble) {
        noble.stopScanning();
      }
      this.sendLog('配网已手动停止');
    }
  }

  cleanup() {
    this.sendLog('BluFi服务已清理');
  }
}

const blufiService = new BluFiService();
module.exports = blufiService;