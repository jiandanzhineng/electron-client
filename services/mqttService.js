/**
 * MQTT服务模块
 * 处理MQTT连接、消息发送和接收
 */

const mqtt = require('mqtt');
const EventEmitter = require('events');
const logger = require('./logService');

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
      logger.info('MQTT client already connected, no need to reconnect', 'mqtt');
      return;
    }

    logger.info(`Attempting to connect to MQTT: ${url}`, 'mqtt');
    this.client = mqtt.connect(url, options);

    this.client.on('connect', () => {
      logger.info('MQTT connection successful', 'mqtt');
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('mqtt-status', 'connected');
        // 订阅所有主题
        this.client.subscribe('/#', (err) => {
          if (err) {
            logger.error('Failed to subscribe to topics', 'mqtt', err);
          } else {
            logger.info('Subscribed to all topics', 'mqtt');
          }
        });
        // 生成三位随机数
        const randomNumber = Math.floor(100 + Math.random() * 900);
        const topic = `/dpub/electron${randomNumber}`;
        const message = '{ "electron": "start" }';
        
        // 发布消息
        this.client.publish(topic, message, (err) => {
          if (err) {
            logger.error(`Failed to publish message to ${topic}`, 'mqtt', err);
          } else {
            logger.info(`Successfully published message to ${topic}: ${message}`, 'mqtt');
          }
        });
      }
    });

    this.client.on('error', (err) => {
      logger.error('MQTT connection error', 'mqtt', err);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('mqtt-status', 'disconnected');
      }
    });

    this.client.on('close', () => {
      logger.info('MQTT connection closed', 'mqtt');
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('mqtt-status', 'disconnected');
      }
    });

    this.client.on('message', (topic, message) => {
      logger.info(`Received message: ${topic} - ${message.toString()}`, 'mqtt');
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('mqtt-message', { topic: topic, payload: message.toString() });
      }
    });
  }

  sendMessage(topic, payload) {
    if (this.client && this.client.connected) {
      this.client.publish(topic, payload, (err) => {
        if (err) {
          logger.error(`Failed to publish message to ${topic}`, 'mqtt', err);
        } else {
          logger.info(`Successfully published message to ${topic}: ${payload}`, 'mqtt');
        }
      });
    } else {
      logger.warn('MQTT client not connected, unable to send message', 'mqtt');
    }
  }

  disconnect() {
    if (this.client && this.client.connected) {
      this.client.end();
      logger.info('MQTT client disconnected', 'mqtt');
    }
  }

  isConnected() {
    return this.client && this.client.connected;
  }
}

module.exports = new MQTTService();