/**
 * 测试运行器
 * 统一管理和运行所有游戏测试
 */

const path = require('path')
const fs = require('fs')

// 测试配置
const TEST_CONFIG = {
  testDir: __dirname,
  testPattern: '*-tests.js',
  timeout: 30000,
  verbose: true,
  coverage: false
}

class TestRunner {
  constructor(config = {}) {
    this.config = { ...TEST_CONFIG, ...config }
    this.testFiles = []
    this.results = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      failures: []
    }
  }

  /**
   * 发现测试文件
   */
  discoverTests() {
    const testDir = this.config.testDir
    const pattern = this.config.testPattern
    
    try {
      const files = fs.readdirSync(testDir)
      this.testFiles = files
        .filter(file => file.endsWith('-tests.js') && file !== 'run-tests.js')
        .map(file => path.join(testDir, file))
      
      console.log(`🔍 发现 ${this.testFiles.length} 个测试文件:`)
      this.testFiles.forEach(file => {
        console.log(`   📄 ${path.basename(file)}`)
      })
      
    } catch (error) {
      console.error(`❌ 测试文件发现失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🚀 开始运行游戏测试套件...')
    console.log('=' * 60)
    
    const startTime = Date.now()
    
    this.discoverTests()
    
    if (this.testFiles.length === 0) {
      console.log('⚠️  未找到测试文件')
      return this.results
    }

    for (const testFile of this.testFiles) {
      await this.runTestFile(testFile)
    }

    this.results.duration = Date.now() - startTime
    this.printSummary()
    
    return this.results
  }

  /**
   * 运行单个测试文件
   */
  async runTestFile(testFile) {
    const fileName = path.basename(testFile)
    console.log(`\n📋 运行测试文件: ${fileName}`)
    console.log('-' * 40)
    
    try {
      // 清除模块缓存以确保每次都是新的实例
      delete require.cache[require.resolve(testFile)]
      
      // 加载测试文件
      const testFramework = require(testFile)
      
      // 运行测试
      const fileResults = await testFramework.runTests()
      
      // 汇总结果
      this.results.totalTests += fileResults.passed + fileResults.failed + fileResults.skipped
      this.results.passed += fileResults.passed
      this.results.failed += fileResults.failed
      this.results.skipped += fileResults.skipped
      
      // 收集失败信息
      fileResults.results.forEach(result => {
        if (!result.passed) {
          this.results.failures.push({
            file: fileName,
            test: result.name,
            error: result.error,
            stack: result.stack
          })
        }
      })
      
      console.log(`✅ ${fileName}: ${fileResults.passed} passed, ${fileResults.failed} failed, ${fileResults.skipped} skipped`)
      
    } catch (error) {
      console.error(`❌ 测试文件 ${fileName} 运行失败:`, error.message)
      this.results.failures.push({
        file: fileName,
        test: 'File Load Error',
        error: error.message,
        stack: error.stack
      })
    }
  }

  /**
   * 打印测试摘要
   */
  printSummary() {
    console.log('\n' + '=' * 60)
    console.log('📊 测试摘要')
    console.log('=' * 60)
    
    const { totalTests, passed, failed, skipped, duration } = this.results
    
    console.log(`📈 总测试数: ${totalTests}`)
    console.log(`✅ 通过: ${passed}`)
    console.log(`❌ 失败: ${failed}`)
    console.log(`⏭️  跳过: ${skipped}`)
    console.log(`⏱️  总耗时: ${duration}ms`)
    
    if (failed > 0) {
      console.log('\n❌ 失败详情:')
      this.results.failures.forEach((failure, index) => {
        console.log(`\n${index + 1}. ${failure.file} - ${failure.test}`)
        console.log(`   错误: ${failure.error}`)
        if (this.config.verbose && failure.stack) {
          console.log(`   堆栈: ${failure.stack.split('\n')[1]?.trim() || ''}`) // 只显示第一行堆栈
        }
      })
    }
    
    const successRate = totalTests > 0 ? ((passed / totalTests) * 100).toFixed(1) : 0
    console.log(`\n🎯 成功率: ${successRate}%`)
    
    if (failed === 0) {
      console.log('\n🎉 所有测试通过！')
    } else {
      console.log(`\n⚠️  有 ${failed} 个测试失败`)
    }
  }

  /**
   * 运行特定测试文件
   */
  async runSpecificTest(testName) {
    const testFile = this.testFiles.find(file => 
      path.basename(file).includes(testName)
    )
    
    if (!testFile) {
      console.error(`❌ 未找到测试文件: ${testName}`)
      return
    }
    
    await this.runTestFile(testFile)
    this.printSummary()
  }
}

// 命令行参数处理
function parseArgs() {
  const args = process.argv.slice(2)
  const config = {}
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    switch (arg) {
      case '--verbose':
      case '-v':
        config.verbose = true
        break
      case '--timeout':
        config.timeout = parseInt(args[++i]) || 30000
        break
      case '--coverage':
        config.coverage = true
        break
      case '--help':
      case '-h':
        printHelp()
        process.exit(0)
        break
      default:
        if (!arg.startsWith('-')) {
          config.specificTest = arg
        }
    }
  }
  
  return config
}

function printHelp() {
  console.log(`
游戏测试运行器

用法:
  node run-tests.js [选项] [测试名称]

选项:
  -v, --verbose     显示详细输出
  --timeout <ms>    设置测试超时时间 (默认: 30000ms)
  --coverage        启用代码覆盖率 (暂未实现)
  -h, --help        显示帮助信息

示例:
  node run-tests.js                    # 运行所有测试
  node run-tests.js pushup             # 运行包含'pushup'的测试文件
  node run-tests.js --verbose          # 详细模式运行所有测试
  node run-tests.js --timeout 60000    # 设置60秒超时
`)
}

// 主函数
async function main() {
  try {
    const config = parseArgs()
    const runner = new TestRunner(config)
    
    if (config.specificTest) {
      runner.discoverTests()
      await runner.runSpecificTest(config.specificTest)
    } else {
      await runner.runAllTests()
    }
    
    // 根据测试结果设置退出码
    process.exit(runner.results.failed > 0 ? 1 : 0)
    
  } catch (error) {
    console.error('❌ 测试运行器错误:', error.message)
    process.exit(1)
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main()
}

module.exports = TestRunner