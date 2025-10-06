/**
 * TTS (Text-to-Speech) 服务模块
 * 处理文本转语音功能
 */

const { spawn } = require('child_process');
const os = require('os');
const logger = require('./logService');

class TTSService {
  constructor() {
    this.mainWindow = null;
    this.currentProcess = null;
    this.isSupported = this.checkTTSSupport();
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  // 检查TTS支持
  checkTTSSupport() {
    const platform = os.platform();
    return platform === 'win32' || platform === 'darwin' || platform === 'linux';
  }





  // 文本转语音
  async speak(text, options = {}) {
    if (!this.isSupported) {
      throw new Error('TTS not supported on this platform');
    }

    if (!text || text.trim() === '') {
      throw new Error('Text cannot be empty');
    }

    try {
      // 停止当前播放
      this.stop();

      const platform = os.platform();
      
      if (platform === 'win32') {
        await this.speakWindows(text, options);
      } else if (platform === 'darwin') {
        await this.speakMac(text, options);
      } else {
        await this.speakLinux(text, options);
      }
      
      logger.info(`TTS speech completed: ${text.substring(0, 50)}...`, 'tts');
    } catch (error) {
      logger.error('TTS speech failed', 'tts', error);
      throw error;
    }
  }

  // Windows TTS
  speakWindows(text, options) {
    return new Promise((resolve, reject) => {
      const voice = options.voice || 'Microsoft Huihui Desktop';
      const rate = options.rate || 0;
      
      // 对文本进行Base64编码以避免中文字符问题
      const encodedText = Buffer.from(text, 'utf8').toString('base64');
      
      const powershellScript = `
        Add-Type -AssemblyName System.Speech;
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
        $synth.Rate = ${rate};
        try {
          $synth.SelectVoice('${voice}');
        } catch {
          # Use default voice if specified voice not found
        }
        # 解码Base64文本
        $encodedText = '${encodedText}';
        $decodedBytes = [System.Convert]::FromBase64String($encodedText);
        $decodedText = [System.Text.Encoding]::UTF8.GetString($decodedBytes);
        $synth.Speak($decodedText);
        $synth.Dispose();
      `;
      
      logger.info(`TTS调用信息 - 语音: ${voice}, 语速: ${rate}, 文本: ${text}`);
      
      this.currentProcess = spawn('powershell', ['-Command', powershellScript], {
        windowsHide: true,
        encoding: 'utf8'
      });
      
      this.currentProcess.on('close', (code) => {
        logger.info(`TTS PowerShell进程结束，退出代码: ${code}`);
        this.currentProcess = null;
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`TTS process exited with code ${code}`));
        }
      });
      
      this.currentProcess.on('error', (error) => {
        logger.error(`TTS PowerShell进程错误: ${error.message}`);
        this.currentProcess = null;
        reject(error);
      });
    });
  }

  // macOS TTS
  speakMac(text, options) {
    return new Promise((resolve, reject) => {
      const voice = options.voice || 'Ting-Ting';
      const rate = options.rate || 200;
      
      this.currentProcess = spawn('say', ['-v', voice, '-r', rate.toString(), text]);
      
      this.currentProcess.on('close', (code) => {
        this.currentProcess = null;
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`TTS process exited with code ${code}`));
        }
      });
      
      this.currentProcess.on('error', (error) => {
        this.currentProcess = null;
        reject(error);
      });
    });
  }

  // Linux TTS
  speakLinux(text, options) {
    return new Promise((resolve, reject) => {
      const voice = options.voice || 'default';
      const rate = options.rate || 150;
      
      this.currentProcess = spawn('espeak', ['-s', rate.toString(), text]);
      
      this.currentProcess.on('close', (code) => {
        this.currentProcess = null;
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`TTS process exited with code ${code}`));
        }
      });
      
      this.currentProcess.on('error', (error) => {
        this.currentProcess = null;
        // 如果espeak不可用，尝试使用festival
        this.currentProcess = spawn('echo', [text, '|', 'festival', '--tts']);
        
        this.currentProcess.on('close', (code) => {
          this.currentProcess = null;
          if (code === 0) {
            resolve();
          } else {
            reject(new Error('No TTS engine available on Linux'));
          }
        });
        
        this.currentProcess.on('error', () => {
          this.currentProcess = null;
          reject(new Error('No TTS engine available on Linux'));
        });
      });
    });
  }

  // 停止当前播放
  stop() {
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = null;
      logger.info('TTS speech stopped', 'tts');
    }
  }

  // 获取可用的语音列表
  async getAvailableVoices() {
    try {
      const platform = os.platform();
      
      if (platform === 'win32') {
        return await this.getWindowsVoices();
      } else if (platform === 'darwin') {
        return await this.getMacVoices();
      } else {
        return await this.getLinuxVoices();
      }
    } catch (error) {
      logger.error('Failed to get available voices', 'tts', error);
      return [];
    }
  }

  // Windows语音列表
  getWindowsVoices() {
    return new Promise((resolve) => {
      const powershellScript = `
        Add-Type -AssemblyName System.Speech;
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
        $synth.GetInstalledVoices() | ForEach-Object {
          [PSCustomObject]@{
            Name = $_.VoiceInfo.Name
            Culture = $_.VoiceInfo.Culture.Name
            Gender = $_.VoiceInfo.Gender
            Age = $_.VoiceInfo.Age
          }
        } | ConvertTo-Json
      `;
      
      const process = spawn('powershell', ['-Command', powershellScript], {
        windowsHide: true
      });
      
      let output = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.on('close', (code) => {
        try {
          const voices = JSON.parse(output);
          const voiceList = Array.isArray(voices) ? voices : [voices];
          resolve(voiceList);
        } catch (error) {
          resolve([{ Name: 'Microsoft Zira Desktop', Culture: 'en-US', Gender: 'Female', Age: 'Adult' }]);
        }
      });
    });
  }

  // macOS语音列表
  getMacVoices() {
    return new Promise((resolve) => {
      const process = spawn('say', ['-v', '?']);
      
      let output = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.on('close', (code) => {
        try {
          const voices = [];
          const lines = output.split('\n');
          
          lines.forEach(line => {
            const match = line.match(/^(\S+)\s+(.+)$/);
            if (match) {
              voices.push({
                Name: match[1],
                Description: match[2]
              });
            }
          });
          
          resolve(voices);
        } catch (error) {
          resolve([{ Name: 'Ting-Ting', Description: 'Chinese (China)' }]);
        }
      });
    });
  }

  // Linux语音列表
  getLinuxVoices() {
    return new Promise((resolve) => {
      resolve([{ Name: 'default', Description: 'Default Linux Voice' }]);
    });
  }

  // 清理资源
  cleanup() {
    this.stop();
    logger.info('TTS service cleaned up', 'tts');
  }
}

module.exports = new TTSService();