const { Bonjour } = require('./mdns/bonjour-service')
// const { Bonjour } = require('bonjour-service')
const os = require('os');
const { execSync } = require('child_process');

/**
 * 检查网络接口是否有网关
 * @param {string} interfaceName - 网络接口名称
 * @returns {boolean} 是否有网关
 */
function hasGateway(interfaceName) {
    try {
        // Windows系统检查默认网关
        const result = execSync('ipconfig | findstr "默认网关"', { encoding: 'utf8' });
        if (result.trim().length > 0) {
            return true;
        }
        // 尝试英文版本
        const resultEn = execSync('ipconfig | findstr "Default Gateway"', { encoding: 'utf8' });
        return resultEn.trim().length > 0;
    } catch (error) {
        console.error('无法检查网络接口是否有网关:', error);
        // 如果ipconfig失败，尝试检查路由表
        try {
            const result = execSync('route print | findstr "0.0.0.0"', { encoding: 'utf8' });
            return result.trim().length > 0;
        } catch (e) {
            console.error('路由表检查也失败:', e);
            // 如果所有方法都失败，返回true以避免阻塞
            return true;
        }
    }
}

/**
 * 获取本机IPv4地址
 * @returns {string|null} 返回第一个非回环的IPv4地址
 */
function getLocalIPv4Address() {
    const interfaces = os.networkInterfaces();
    
    for (const interfaceName in interfaces) {
        const networkInterface = interfaces[interfaceName];
        
        for (const address of networkInterface) {
            // 查找IPv4地址，排除回环地址和内部地址，并且要求有网关
            if (address.family === 'IPv4' && !address.internal && hasGateway(interfaceName)) {
                return address.address;
            }
        }
    }
    
    return null;
}

/**
 * mDNS服务管理类
 */
class MDNSService {
    constructor() {
        // 获取有网关的本地IP地址
        const localIP = getLocalIPv4Address();
        
        // 创建Bonjour实例，配置为在有网关的网络接口上工作
        this.bonjour = new Bonjour({
            multicast: true, // 启用组播
            interface: localIP || '0.0.0.0', // 优先绑定到有网关的接口
            port: 5353, // 标准mDNS端口
            ip: '224.0.0.251', // mDNS组播地址
            ttl: 20, // 设置TTL确保跨网段传播
            // loopback: true // 允许回环
        });
        // this.bonjour = new Bonjour();
        this.service = null;
        this.isPublished = false;
    }

    /**
     * 发布mDNS服务，将本机IPv4地址注册为easysmart.local
     * @param {number} port - 服务端口号
     * @param {Object} options - 可选配置
     * @returns {Promise<boolean>} 发布是否成功
     */
    async publishService(port = 8080, options = {}) {
        try {
            const ipAddress = getLocalIPv4Address();
            
            if (!ipAddress) {
                console.error('无法获取本机IPv4地址');
                return false;
            } else {
                console.log(`本机IPv4地址: ${ipAddress}`);
            }

            // 如果已经发布了服务，先停止
            if (this.isPublished) {
                this.stopService();
            }

            const serviceConfig = {
                name: options.name || 'EasySmart',
                type: options.type || 'http',
                port: port,
                // 移除host限制，让服务在所有网络接口上发布
                host: 'easysmart.local', 
                disableIPv6: true, // 禁用IPv6
                
                // 网络配置 - 确保在整个局域网内可见
                // probe: true, // 启用探测以避免名称冲突
                announce: true, // 启用服务公告
                ip: ipAddress, // 明确指定IP地址
                
                txt: {

                }
            };

            console.log(`正在发布mDNS服务: ${serviceConfig.name} 在 ${ipAddress}:${port}`);
             console.log(`服务将在整个局域网内发布，可通过以下方式访问:`);
             console.log(`  - 直接IP访问: http://${ipAddress}:${port}`);
             console.log(`  - mDNS域名访问: http://easysmart.local:${port} (如果客户端支持mDNS)`);
             console.log(`  - 局域网内所有设备都可以发现此服务`);

            this.service = this.bonjour.publish(serviceConfig);
            
            // 监听服务发布事件
            this.service.on('up', () => {
                console.log(`✅ mDNS服务已成功发布到整个局域网!`);
                 console.log(`   服务名称: ${serviceConfig.name}`);
                 console.log(`   IP地址: ${ipAddress}:${port}`);
                 console.log(`   域名: easysmart.local (如果客户端支持mDNS解析)`);
                 console.log(`   局域网内的所有设备现在都可以发现和访问此服务`);
                 this.isPublished = true;
            });

            this.service.on('error', (err) => {
                console.error('mDNS服务发布失败:', err);
                this.isPublished = false;
            });

            return true;
        } catch (error) {
            console.error('发布mDNS服务时出错:', error);
            return false;
        }
    }

    /**
     * 停止mDNS服务
     */
    stopService() {
        if (this.service) {
            console.log('正在停止mDNS服务...');
            this.service.stop();
            this.service = null;
            this.isPublished = false;
            console.log('mDNS服务已停止');
        }
    }

    /**
     * 查找网络中的mDNS服务
     * @param {string} type - 服务类型，默认为'http'
     * @returns {Promise<Array>} 发现的服务列表
     */
    async findServices(type = 'http') {
        return new Promise((resolve) => {
            const services = [];
            const browser = this.bonjour.find({ type });

            browser.on('up', (service) => {
                console.log('发现服务:', service.name, service.host, service.addresses);
                services.push(service);
            });

            // 搜索3秒后返回结果
            setTimeout(() => {
                browser.stop();
                resolve(services);
            }, 3000);
        });
    }

    /**
     * 获取当前服务状态
     * @returns {Object} 服务状态信息
     */
    getStatus() {
        return {
            isPublished: this.isPublished,
            localIP: getLocalIPv4Address(),
            serviceName: this.service ? this.service.name : null
        };
    }

    /**
     * 销毁mDNS服务实例
     */
    destroy() {
        this.stopService();
        if (this.bonjour) {
            this.bonjour.destroy();
            this.bonjour = null;
        }
    }
}

// 创建全局实例
const mdnsService = new MDNSService();

module.exports = {
    MDNSService,
    mdnsService,
    getLocalIPv4Address
};


// 测试代码 - 仅在直接运行此文件时执行
if (require.main === module) {
    console.log('=== mDNS服务测试 ===');
    
    async function testMDNS() {
        try {
            // 显示当前本机IP地址和网络接口信息
             const localIP = getLocalIPv4Address();
             console.log(`本机IPv4地址: ${localIP}`);
             
             // 显示所有网络接口信息
             const interfaces = os.networkInterfaces();
             console.log('\n网络接口信息:');
             for (const interfaceName in interfaces) {
                 const networkInterface = interfaces[interfaceName];
                 for (const address of networkInterface) {
                     if (address.family === 'IPv4' && !address.internal) {
                         console.log(`  ${interfaceName}: ${address.address} (子网掩码: ${address.netmask})`);
                     }
                 }
             }
            
            if (!localIP) {
                console.error('无法获取本机IPv4地址，测试终止');
                return;
            }
            
            // 测试发布mDNS服务
            console.log('\n正在启动mDNS服务...');
            const success = await mdnsService.publishService(80, {
                name: 'EasySmart-Test',
                txt: {
                    test: 'true',
                    timestamp: new Date().toISOString()
                }
            });
            
            if (success) {
                console.log('mDNS服务启动成功！');
                
                // 等待2秒让服务完全启动
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // 显示服务状态
                const status = mdnsService.getStatus();
                console.log('\n当前服务状态:', JSON.stringify(status, null, 2));
                
                // 测试服务发现
                console.log('\n正在搜索网络中的HTTP服务...');
                const services = await mdnsService.findServices('http');
                console.log(`发现 ${services.length} 个服务:`);
                services.forEach((service, index) => {
                    console.log(`  ${index + 1}. ${service.name} - ${service.host}:${service.port}`);
                    if (service.addresses && service.addresses.length > 0) {
                        console.log(`     地址: ${service.addresses.join(', ')}`);
                    }
                });
                
                // 运行10秒后停止服务
                console.log('\n服务将在100秒后自动停止...');
                setTimeout(() => {
                    console.log('\n正在停止mDNS服务...');
                    mdnsService.destroy();
                    console.log('测试完成！');
                    process.exit(0);
                }, 100000);
                
            } else {
                console.error('mDNS服务启动失败');
                process.exit(1);
            }
            
        } catch (error) {
            console.error('测试过程中发生错误:', error);
            mdnsService.destroy();
            process.exit(1);
        }
    }
    
    // 处理程序退出
    process.on('SIGINT', () => {
        console.log('\n收到退出信号，正在清理资源...');
        mdnsService.destroy();
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\n收到终止信号，正在清理资源...');
        mdnsService.destroy();
        process.exit(0);
    });
    
    // 启动测试
    testMDNS().catch(error => {
        console.error('测试启动失败:', error);
        process.exit(1);
    });
    
    console.log('\n📋 使用说明:');
}