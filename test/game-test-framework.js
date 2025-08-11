/**
 * 游戏测试框架 - 类似pytest的JavaScript测试系统
 * 用于自动化测试游戏逻辑，无需手工操作
 */

class GameTestFramework {
  constructor() {
    this.tests = []
    this.fixtures = new Map()
    this.results = []
    this.mockDeviceManager = null
    this.currentTest = null
  }

  /**
   * 注册测试用例
   * @param {string} name - 测试名称
   * @param {Function} testFunc - 测试函数
   * @param {Object} options - 测试选项
   */
  test(name, testFunc, options = {}) {
    this.tests.push({
      name,
      func: testFunc,
      timeout: options.timeout || 30000,
      skip: options.skip || false,
      only: options.only || false,
      fixtures: options.fixtures || []
    })
  }

  /**
   * 创建测试夹具
   * @param {string} name - 夹具名称
   * @param {Function} setupFunc - 设置函数
   * @param {Function} teardownFunc - 清理函数
   */
  fixture(name, setupFunc, teardownFunc = null) {
    this.fixtures.set(name, {
      setup: setupFunc,
      teardown: teardownFunc,
      instance: null
    })
  }

  /**
   * 运行所有测试
   */
  async runTests() {
    console.log('🚀 开始运行游戏测试...')
    console.log('=' * 50)
    
    const startTime = Date.now()
    let passed = 0
    let failed = 0
    let skipped = 0

    // 检查是否有only标记的测试
    const onlyTests = this.tests.filter(test => test.only)
    const testsToRun = onlyTests.length > 0 ? onlyTests : this.tests.filter(test => !test.skip)
    
    for (const test of testsToRun) {
      if (test.skip) {
        skipped++
        console.log(`⏭️  SKIP: ${test.name}`)
        continue
      }

      this.currentTest = test
      const result = await this.runSingleTest(test)
      this.results.push(result)

      if (result.passed) {
        passed++
        console.log(`✅ PASS: ${test.name} (${result.duration}ms)`)
      } else {
        failed++
        console.log(`❌ FAIL: ${test.name} (${result.duration}ms)`)
        console.log(`   Error: ${result.error}`)
        if (result.stack) {
          console.log(`   Stack: ${result.stack}`)
        }
      }
    }

    const totalTime = Date.now() - startTime
    console.log('=' * 50)
    console.log(`📊 测试结果: ${passed} passed, ${failed} failed, ${skipped} skipped`)
    console.log(`⏱️  总耗时: ${totalTime}ms`)
    
    return {
      passed,
      failed,
      skipped,
      totalTime,
      results: this.results
    }
  }

  /**
   * 运行单个测试
   */
  async runSingleTest(test) {
    const startTime = Date.now()
    const result = {
      name: test.name,
      passed: false,
      duration: 0,
      error: null,
      stack: null
    }

    try {
      // 设置夹具
      const fixtureInstances = {}
      for (const fixtureName of test.fixtures) {
        const fixture = this.fixtures.get(fixtureName)
        if (fixture) {
          fixture.instance = await fixture.setup()
          fixtureInstances[fixtureName] = fixture.instance
        }
      }

      // 运行测试，带超时控制
      await Promise.race([
        test.func(fixtureInstances),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`测试超时 (${test.timeout}ms)`)), test.timeout)
        )
      ])

      result.passed = true

      // 清理夹具
      for (const fixtureName of test.fixtures) {
        const fixture = this.fixtures.get(fixtureName)
        if (fixture && fixture.teardown && fixture.instance) {
          await fixture.teardown(fixture.instance)
          fixture.instance = null
        }
      }

    } catch (error) {
      result.error = error.message
      result.stack = error.stack
    }

    result.duration = Date.now() - startTime
    return result
  }

  /**
   * 断言工具
   */
  static assert = {
    /**
     * 断言相等
     */
    equal(actual, expected, message = '') {
      if (actual !== expected) {
        throw new Error(`断言失败: ${message}\n期望: ${expected}\n实际: ${actual}`)
      }
    },

    /**
     * 断言不相等
     */
    notEqual(actual, expected, message = '') {
      if (actual === expected) {
        throw new Error(`断言失败: ${message}\n期望不等于: ${expected}\n实际: ${actual}`)
      }
    },

    /**
     * 断言为真
     */
    isTrue(value, message = '') {
      if (value !== true) {
        throw new Error(`断言失败: ${message}\n期望: true\n实际: ${value}`)
      }
    },

    /**
     * 断言为假
     */
    isFalse(value, message = '') {
      if (value !== false) {
        throw new Error(`断言失败: ${message}\n期望: false\n实际: ${value}`)
      }
    },

    /**
     * 断言包含
     */
    contains(container, item, message = '') {
      if (!container.includes(item)) {
        throw new Error(`断言失败: ${message}\n容器不包含: ${item}`)
      }
    },

    /**
     * 断言抛出异常
     */
    async throws(asyncFunc, expectedError = null, message = '') {
      try {
        await asyncFunc()
        throw new Error(`断言失败: ${message}\n期望抛出异常，但没有抛出`)
      } catch (error) {
        if (expectedError && !error.message.includes(expectedError)) {
          throw new Error(`断言失败: ${message}\n期望异常包含: ${expectedError}\n实际异常: ${error.message}`)
        }
      }
    },

    /**
     * 断言范围内
     */
    inRange(value, min, max, message = '') {
      if (value < min || value > max) {
        throw new Error(`断言失败: ${message}\n期望在范围 [${min}, ${max}] 内\n实际: ${value}`)
      }
    },

    /**
     * 断言近似相等（用于浮点数比较）
     */
    approximately(actual, expected, tolerance = 0.001, message = '') {
      if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`断言失败: ${message}\n期望约等于: ${expected} (±${tolerance})\n实际: ${actual}`)
      }
    }
  }

  /**
   * 等待指定时间
   */
  static async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 等待条件满足
   */
  static async waitFor(condition, timeout = 5000, interval = 100) {
    const startTime = Date.now()
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true
      }
      await this.sleep(interval)
    }
    throw new Error(`等待条件超时 (${timeout}ms)`)
  }
}

// 导出框架
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameTestFramework
}
if (typeof window !== 'undefined') {
  window.GameTestFramework = GameTestFramework
}