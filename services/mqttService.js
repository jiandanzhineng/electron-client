/**
 * MQTT服务模块
 * 处理MQTT连接、消息发送和接收
 */

const mqtt = require('mqtt');

class MQTTService {
  constructor() {
    this.client = null;
    this.mainWindow = null;
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  connect(url, options) {
    if (this.client && this.client.connected) {
      console.log('MQTT client already connected, no need to reconnect');
      return;
    }

    console.log('Attempting to connect to MQTT:', url);
    this.client = mqtt.connect(url, options);

    this.client.on('connect', () => {
      console.log('MQTT connection successful');
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('mqtt-status', 'connected');
        // 订阅所有主题
        this.client.subscribe('/#', (err) => {
          if (err) {
            console.error('Failed to subscribe to topics:', err);
          } else {
            console.log('Subscribed to all topics');
          }
        });
        // 生成三位随机数
        const randomNumber = Math.floor(100 + Math.random() * 900);
        const topic = `/dpub/electron${randomNumber}`;
        const message = 'electron start';
        
        // 发布消息
        this.client.publish(topic, message, (err) => {
          if (err) {
            console.error(`Failed to publish message to ${topic}:`, err);
          } else {
            console.log(`Successfully published message to ${topic}: ${message}`);
          }
        });
      }
    });

    this.client.on('error', (err) => {
      console.error('MQTT connection error:', err);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('mqtt-status', 'disconnected');
      }
    });

    this.client.on('close', () => {
      console.log('MQTT connection closed');
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('mqtt-status', 'disconnected');
      }
    });

    this.client.on('message', (topic, message) => {
      console.log(`Received message: ${topic} - ${message.toString()}`);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('mqtt-message', { topic: topic, payload: message.toString() });
      }
    });
  }

  sendMessage(topic, payload) {
    if (this.client && this.client.connected) {
      this.client.publish(topic, payload, (err) => {
        if (err) {
          console.error(`Failed to publish message to ${topic}:`, err);
        } else {
          console.log(`Successfully published message to ${topic}: ${payload}`);
        }
      });
    } else {
      console.error('MQTT client not connected, unable to send message');
    }
  }

  disconnect() {
    if (this.client && this.client.connected) {
      this.client.end();
      console.log('MQTT client disconnected');
    }
  }

  isConnected() {
    return this.client && this.client.connected;
  }
}

module.exports = new MQTTService();