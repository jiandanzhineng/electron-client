/**
 * 俯卧撑检测游戏测试用例
 * 演示如何使用测试框架进行游戏逻辑测试
 */

// 导入测试框架和模拟设备管理器
const GameTestFramework = require('./game-test-framework')
const MockDeviceManager = require('./mock-device-manager')

// 在Node.js环境中模拟浏览器环境
if (typeof window === 'undefined') {
  global.window = {
    gameplayUI: {
      updateUI: (html) => {
        // 在测试环境中静默处理UI更新
      },
      addLog: (message, level) => {
        // 在测试环境中静默处理日志
      }
    }
  }
}

// 导入被测试的游戏类
// 注意：在实际环境中需要适配模块导入方式
const { PushupDetectionGame } = require('../outter-game/pushup-detection-game/pushup-detection-game.js')

// 创建测试框架实例
const testFramework = new GameTestFramework()
const { assert, sleep, waitFor } = GameTestFramework

// ===== 测试夹具 =====

// 游戏实例夹具
testFramework.fixture('game', async () => {
  const game = new PushupDetectionGame()
  return game
}, async (game) => {
  // 清理游戏状态
  if (game.state && game.state.isGameActive) {
    await game.endGame(false)
  }
})

// 模拟设备管理器夹具
testFramework.fixture('mockDeviceManager', async () => {
  const mockDM = new MockDeviceManager()
  
  // 添加俯卧撑游戏需要的设备
  mockDM.addMockDevice('distance_sensor', 'QTZ', { distance: 30 })
  mockDM.addMockDevice('auto_lock', 'ZIDONGSUO', { open: 1 })
  mockDM.addMockDevice('shock_device', 'DIANJI', { voltage: 0, shock: 0 })
  mockDM.addMockDevice('vibrator_device', 'TD01', { power: 0 })
  
  return mockDM
}, async (mockDM) => {
  mockDM.reset()
})

// ===== 基础功能测试 =====

testFramework.test('游戏初始化测试', async ({ game }) => {
  // 测试游戏基本属性
  assert.equal(game.title, '俯卧撑检测训练游戏', '游戏标题正确')
  assert.equal(game.version, '1.0.0', '游戏版本正确')
  assert.isTrue(game.config.duration > 0, '游戏时长配置有效')
  assert.isTrue(game.config.targetCount > 0, '目标数量配置有效')
  
  // 测试设备依赖
  const requiredDevices = game.requiredDevices
  assert.equal(requiredDevices.length, 4, '需要4个设备')
  
  const distanceSensor = requiredDevices.find(d => d.logicalId === 'distance_sensor')
  assert.equal(distanceSensor.type, 'QTZ', 'QTZ传感器类型正确')
  assert.isTrue(distanceSensor.required, 'QTZ传感器是必需的')
}, { fixtures: ['game'] })

testFramework.test('参数更新测试', async ({ game }) => {
  const newParams = {
    duration: 20,
    targetCount: 50,
    downThreshold: 12,
    upThreshold: 38
  }
  
  game.updateParameters(newParams)
  
  assert.equal(game.config.duration, 20, '时长参数更新成功')
  assert.equal(game.config.targetCount, 50, '目标数量参数更新成功')
  assert.equal(game.config.downThreshold, 12, '下降阈值参数更新成功')
  assert.equal(game.config.upThreshold, 38, '上升阈值参数更新成功')
}, { fixtures: ['game'] })

// ===== 游戏流程测试 =====

testFramework.test('游戏启动测试', async ({ game, mockDeviceManager }) => {
  const params = {
    duration: 1, // 1分钟测试
    targetCount: 5,
    downThreshold: 15,
    upThreshold: 35
  }
  
  await game.start(mockDeviceManager, params)
  
  // 验证游戏状态
  assert.isTrue(game.state.isGameActive, '游戏已激活')
  assert.equal(game.state.completedCount, 0, '完成数量初始为0')
  assert.equal(game.state.currentPhase, 'up', '初始阶段为up')
  
  // 验证设备设置（QTZ设备接收mm单位）
  const qtzProps = mockDeviceManager.getAllDeviceProperties('distance_sensor')
  assert.equal(qtzProps.low_band, 150, 'QTZ低阈值设置正确（mm单位）')
  assert.equal(qtzProps.high_band, 350, 'QTZ高阈值设置正确（mm单位）')
  
  // 验证自动锁状态
  const lockProps = mockDeviceManager.getAllDeviceProperties('auto_lock')
  assert.equal(lockProps.open, 0, '自动锁已锁定')
  
  await game.endGame()
}, { fixtures: ['game', 'mockDeviceManager'] })

testFramework.test('俯卧撑动作检测测试', async ({ game, mockDeviceManager }) => {
  const params = {
    duration: 5,
    targetCount: 10,
    downThreshold: 15,
    upThreshold: 35
  }
  
  await game.start(mockDeviceManager, params)
  
  // 模拟一个完整的俯卧撑动作
  // 1. 下降阶段
  mockDeviceManager.simulateQTZEvent('distance_sensor', 'low', 10)
  await sleep(100)
  
  assert.equal(game.state.currentPhase, 'down', '检测到下降阶段')
  assert.equal(game.state.completedCount, 0, '下降时未计数')
  
  // 2. 上升阶段
  mockDeviceManager.simulateQTZEvent('distance_sensor', 'high', 40)
  await sleep(100)
  
  assert.equal(game.state.currentPhase, 'up', '检测到上升阶段')
  assert.equal(game.state.completedCount, 1, '完成一个俯卧撑')
  assert.equal(game.state.consecutiveCount, 1, '连续计数正确')
  
  await game.endGame()
}, { fixtures: ['game', 'mockDeviceManager'] })

testFramework.test('批量俯卧撑测试', async ({ game, mockDeviceManager }) => {
  const params = {
    duration: 5,
    targetCount: 3,
    downThreshold: 15,
    upThreshold: 35
  }
  
  await game.start(mockDeviceManager, params)
  
  // 模拟3个俯卧撑
  await mockDeviceManager.simulatePushupSequence('distance_sensor', 3, 1000)
  
  // 等待游戏处理完成
  await sleep(500)
  
  assert.equal(game.state.completedCount, 3, '完成3个俯卧撑')
  assert.isFalse(game.state.isGameActive, '达到目标后游戏结束')
  
  // 验证自动锁解锁
  const lockProps = mockDeviceManager.getAllDeviceProperties('auto_lock')
  assert.equal(lockProps.open, 1, '达到目标后自动锁解锁')
}, { fixtures: ['game', 'mockDeviceManager'] })

// ===== 惩罚机制测试 =====

testFramework.test('无动作惩罚测试', async ({ game, mockDeviceManager }) => {
  const params = {
    duration: 5,
    targetCount: 10,
    idleTimeLimit: 2, // 2秒无动作触发惩罚
    shockIntensity: 20,
    shockDuration: 1
  }
  
  await game.start(mockDeviceManager, params)
  
  // 等待超过无动作时间限制
  await sleep(2500)
  
  // 验证惩罚触发
  assert.isTrue(game.state.isShocking, '触发电击惩罚')
  assert.equal(game.state.punishmentCount, 1, '惩罚计数增加')
  assert.equal(game.state.consecutiveCount, 0, '连续计数重置')
  
  // 验证电击设备状态
  const shockProps = mockDeviceManager.getAllDeviceProperties('shock_device')
  assert.equal(shockProps.shock, 1, '电击设备已激活')
  assert.inRange(shockProps.voltage, 10, 30, '电击强度在合理范围内')
  
  // 等待惩罚结束
  await sleep(1500)
  assert.isFalse(game.state.isShocking, '惩罚已结束')
  
  await game.endGame()
}, { fixtures: ['game', 'mockDeviceManager'], timeout: 10000 })

testFramework.test('连续完成奖励测试', async ({ game, mockDeviceManager }) => {
  const params = {
    duration: 5,
    targetCount: 20,
    rewardTriggerCount: 3,
    rewardTriggerProbability: 100, // 100%触发
    vibratorIntensity: 50,
    vibratorDuration: 5
  }
  
  await game.start(mockDeviceManager, params)
  
  // 连续完成3个俯卧撑触发奖励
  await mockDeviceManager.simulatePushupSequence('distance_sensor', 3, 500)
  await sleep(200)
  
  // 验证奖励触发
  assert.isTrue(game.state.isVibratorActive, '触发跳蛋奖励')
  assert.equal(game.state.rewardCount, 1, '奖励计数增加')
  
  // 验证跳蛋设备状态
  const vibratorProps = mockDeviceManager.getAllDeviceProperties('vibrator_device')
  assert.equal(vibratorProps.power, 50, '跳蛋设备已激活')
  
  await game.endGame()
}, { fixtures: ['game', 'mockDeviceManager'] })

// ===== 边界条件测试 =====

testFramework.test('设备断开连接测试', async ({ game, mockDeviceManager }) => {
  const params = {
    duration: 5,
    targetCount: 10
  }
  
  await game.start(mockDeviceManager, params)
  
  // 断开距离传感器
  mockDeviceManager.setDeviceConnected('distance_sensor', false)
  
  // 尝试发送事件（应该失败）
  const result = mockDeviceManager.simulateQTZEvent('distance_sensor', 'low')
  assert.isFalse(result, '断开的设备无法发送事件')
  
  await game.endGame()
}, { fixtures: ['game', 'mockDeviceManager'] })

testFramework.test('无效QTZ事件测试', async ({ mockDeviceManager }) => {
  // 测试无效事件类型
  await assert.throws(async () => {
    mockDeviceManager.simulateQTZEvent('distance_sensor', 'invalid')
  }, '无效的QTZ事件类型')
}, { fixtures: ['mockDeviceManager'] })

testFramework.test('游戏超时测试', async ({ game, mockDeviceManager }) => {
  const params = {
    duration: 0.05, // 3秒游戏时长
    targetCount: 100 // 不可能完成的目标
  }
  
  await game.start(mockDeviceManager, params)
  
  // 等待游戏超时
  await sleep(4000)
  
  assert.isFalse(game.state.isGameActive, '游戏因超时结束')
  assert.isTrue(game.state.completedCount < 100, '未完成目标')
  
  // 验证自动锁解锁
  const lockProps = mockDeviceManager.getAllDeviceProperties('auto_lock')
  assert.equal(lockProps.open, 1, '超时后自动锁解锁')
}, { fixtures: ['game', 'mockDeviceManager'], timeout: 10000 })

// ===== 性能测试 =====

testFramework.test('高频事件处理测试', async ({ game, mockDeviceManager }) => {
  const params = {
    duration: 5,
    targetCount: 50
  }
  
  await game.start(mockDeviceManager, params)
  
  const startTime = Date.now()
  
  // 快速发送20个俯卧撑事件
  for (let i = 0; i < 20; i++) {
    mockDeviceManager.simulateQTZEvent('distance_sensor', 'low')
    await sleep(10)
    mockDeviceManager.simulateQTZEvent('distance_sensor', 'high')
    await sleep(10)
  }
  
  const endTime = Date.now()
  const duration = endTime - startTime
  
  assert.equal(game.state.completedCount, 20, '高频事件处理正确')
  assert.isTrue(duration < 1000, '处理时间在合理范围内')
  
  await game.endGame()
}, { fixtures: ['game', 'mockDeviceManager'] })

// 导出测试框架以便运行
module.exports = testFramework

// 如果直接运行此文件，执行所有测试
if (require.main === module) {
  testFramework.runTests().then(results => {
    console.log('\n🎯 测试完成!')
    process.exit(results.failed > 0 ? 1 : 0)
  }).catch(error => {
    console.error('❌ 测试运行失败:', error)
    process.exit(1)
  })
}