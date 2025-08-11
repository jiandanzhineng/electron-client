# 游戏测试框架

这是一个专为游戏逻辑设计的自动化测试框架，类似于Python的pytest，用于测试游戏功能而无需手工操作。

## 🎯 功能特性

- **自动化测试**: 无需手工操作，自动验证游戏逻辑
- **设备模拟**: 完整模拟真实设备行为，包括QTZ传感器、自动锁、电击器等
- **丰富断言**: 提供多种断言方法，支持数值、范围、异常等验证
- **测试夹具**: 支持测试前后的设置和清理工作
- **详细报告**: 提供清晰的测试结果和失败详情
- **灵活配置**: 支持超时、跳过、单独运行等配置

## 📁 文件结构

```
test/
├── README.md                 # 本文档
├── game-test-framework.js    # 核心测试框架
├── mock-device-manager.js    # 模拟设备管理器
├── pushup-game-tests.js      # 俯卧撑游戏测试用例
├── run-tests.js              # 测试运行器
└── test-config.json          # 测试配置文件
```

## 🚀 快速开始

### 1. 运行所有测试

```bash
# 进入项目根目录
cd c:\develop\electron-client

# 运行所有测试
node test/run-tests.js

# 或使用npm脚本
npm test
```

### 2. 运行特定测试

```bash
# 运行俯卧撑游戏测试
node test/run-tests.js pushup

# 详细模式运行
node test/run-tests.js --verbose

# 设置超时时间
node test/run-tests.js --timeout 60000
```

### 3. 查看帮助

```bash
node test/run-tests.js --help
```

## 📝 编写测试用例

### 基本测试结构

```javascript
const GameTestFramework = require('./game-test-framework')
const { assert, sleep, waitFor } = GameTestFramework

const testFramework = new GameTestFramework()

// 定义测试用例
testFramework.test('测试名称', async ({ fixture1, fixture2 }) => {
  // 测试逻辑
  assert.equal(actual, expected, '断言消息')
}, { fixtures: ['fixture1', 'fixture2'] })

// 运行测试
testFramework.runTests()
```

### 测试夹具

```javascript
// 定义夹具
testFramework.fixture('gameName', async () => {
  // 设置代码
  const game = new SomeGame()
  return game
}, async (game) => {
  // 清理代码
  await game.cleanup()
})

// 在测试中使用夹具
testFramework.test('使用夹具的测试', async ({ gameName }) => {
  // gameName 是夹具返回的实例
  assert.isTrue(gameName.isInitialized)
}, { fixtures: ['gameName'] })
```

### 断言方法

```javascript
const { assert } = GameTestFramework

// 基本断言
assert.equal(actual, expected, '相等断言')
assert.notEqual(actual, expected, '不相等断言')
assert.isTrue(value, '真值断言')
assert.isFalse(value, '假值断言')

// 范围断言
assert.inRange(value, min, max, '范围断言')
assert.approximately(actual, expected, tolerance, '近似相等断言')

// 容器断言
assert.contains(array, item, '包含断言')

// 异常断言
await assert.throws(async () => {
  await someAsyncFunction()
}, '期望的错误信息', '异常断言')
```

### 设备模拟

```javascript
// 创建模拟设备管理器
const mockDM = new MockDeviceManager()

// 添加设备
mockDM.addMockDevice('distance_sensor', 'QTZ', { distance: 30 })
mockDM.addMockDevice('auto_lock', 'ZIDONGSUO', { open: 1 })

// 模拟设备事件
mockDM.simulateQTZEvent('distance_sensor', 'low', 10)
mockDM.simulateQTZEvent('distance_sensor', 'high', 40)

// 批量模拟俯卧撑动作
await mockDM.simulatePushupSequence('distance_sensor', 5, 1000)

// 检查设备状态
const props = mockDM.getAllDeviceProperties('distance_sensor')
assert.equal(props.distance, 30)
```

## 🎮 游戏测试示例

### 俯卧撑检测游戏测试

```javascript
testFramework.test('俯卧撑动作检测', async ({ game, mockDeviceManager }) => {
  // 启动游戏
  await game.start(mockDeviceManager, {
    duration: 5,
    targetCount: 10,
    downThreshold: 15,
    upThreshold: 35
  })
  
  // 模拟俯卧撑动作
  mockDeviceManager.simulateQTZEvent('distance_sensor', 'low', 10)
  await sleep(100)
  mockDeviceManager.simulateQTZEvent('distance_sensor', 'high', 40)
  await sleep(100)
  
  // 验证结果
  assert.equal(game.state.completedCount, 1, '完成一个俯卧撑')
  assert.equal(game.state.currentPhase, 'up', '当前阶段正确')
  
  await game.endGame()
}, { fixtures: ['game', 'mockDeviceManager'] })
```

### 惩罚机制测试

```javascript
testFramework.test('无动作惩罚', async ({ game, mockDeviceManager }) => {
  await game.start(mockDeviceManager, {
    idleTimeLimit: 2, // 2秒触发惩罚
    shockIntensity: 20
  })
  
  // 等待触发惩罚
  await sleep(2500)
  
  // 验证惩罚状态
  assert.isTrue(game.state.isShocking, '触发电击惩罚')
  assert.equal(game.state.punishmentCount, 1, '惩罚计数正确')
  
  // 验证设备状态
  const shockProps = mockDeviceManager.getAllDeviceProperties('shock_device')
  assert.equal(shockProps.shock, 1, '电击设备已激活')
  
  await game.endGame()
}, { fixtures: ['game', 'mockDeviceManager'], timeout: 10000 })
```

## ⚙️ 配置选项

### 测试选项

```javascript
testFramework.test('测试名称', testFunction, {
  timeout: 30000,        // 超时时间(ms)
  skip: false,           // 是否跳过
  only: false,           // 只运行此测试
  fixtures: ['fixture1'] // 使用的夹具
})
```

### 运行器选项

```bash
node test/run-tests.js [选项] [测试名称]

选项:
  -v, --verbose     显示详细输出
  --timeout <ms>    设置测试超时时间
  --coverage        启用代码覆盖率
  -h, --help        显示帮助信息
```

## 🔧 高级功能

### 等待条件

```javascript
// 等待游戏状态变化
await waitFor(async () => {
  return game.state.completedCount >= 5
}, 10000, 100) // 最多等待10秒，每100ms检查一次
```

### 性能测试

```javascript
testFramework.test('高频事件处理', async ({ game, mockDeviceManager }) => {
  const startTime = Date.now()
  
  // 快速发送事件
  for (let i = 0; i < 100; i++) {
    mockDeviceManager.simulateQTZEvent('distance_sensor', 'low')
    mockDeviceManager.simulateQTZEvent('distance_sensor', 'high')
  }
  
  const duration = Date.now() - startTime
  assert.isTrue(duration < 1000, '处理时间在合理范围内')
})
```

### 边界条件测试

```javascript
testFramework.test('设备断开测试', async ({ mockDeviceManager }) => {
  // 断开设备
  mockDeviceManager.setDeviceConnected('distance_sensor', false)
  
  // 验证行为
  const result = mockDeviceManager.simulateQTZEvent('distance_sensor', 'low')
  assert.isFalse(result, '断开的设备无法发送消息')
})
```

## 📊 测试报告

测试运行后会显示详细报告：

```
🚀 开始运行游戏测试...
============================================================

📋 运行测试文件: pushup-game-tests.js
----------------------------------------
✅ PASS: 游戏初始化测试 (45ms)
✅ PASS: 参数更新测试 (12ms)
✅ PASS: 游戏启动测试 (156ms)
✅ PASS: 俯卧撑动作检测测试 (234ms)
❌ FAIL: 无动作惩罚测试 (2567ms)
   Error: 断言失败: 触发电击惩罚

============================================================
📊 测试摘要
============================================================
📈 总测试数: 15
✅ 通过: 14
❌ 失败: 1
⏭️  跳过: 0
⏱️  总耗时: 3456ms

🎯 成功率: 93.3%
```

## 🤝 贡献指南

1. 为新游戏添加测试时，创建 `{game-name}-tests.js` 文件
2. 遵循现有的测试命名和结构约定
3. 为复杂功能添加多个测试用例
4. 包含正常流程、边界条件和错误处理测试
5. 添加适当的注释和文档

## 🐛 故障排除

### 常见问题

1. **模块导入错误**: 确保游戏文件正确导出类
2. **测试超时**: 增加超时时间或优化测试逻辑
3. **设备模拟失败**: 检查设备ID和类型是否正确
4. **断言失败**: 检查期望值和实际值是否匹配

### 调试技巧

```javascript
// 添加调试输出
console.log('当前游戏状态:', game.state)
console.log('设备属性:', mockDeviceManager.getAllDeviceProperties('device_id'))

// 使用详细模式运行
node test/run-tests.js --verbose
```

## 📚 参考资料

- [游戏开发指南](../docs/GAME_DEVELOPMENT_GUIDE.md)
- [设备管理器API](../docs/DEVICE_MANAGER_API.md)
- [俯卧撑游戏实现](../outter-game/pushup-detection-game/pushup-detection-game.js)