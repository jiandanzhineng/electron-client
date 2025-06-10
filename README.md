# Electron Client - Vue 3 + Pinia 重构版

这是一个基于 Electron + Vue 3 + Pinia 的桌面应用程序，提供设备管理、服务监控和游戏管理功能。

## 🚀 技术栈

- **Electron** - 跨平台桌面应用框架
- **Vue 3** - 渐进式 JavaScript 框架
- **Pinia** - Vue 状态管理库
- **Vue Router** - Vue 官方路由管理器
- **Vite** - 现代化构建工具

## 📁 项目结构

```
electron-client/
├── src/                    # Vue 应用源码
│   ├── components/         # 可复用组件
│   │   └── Sidebar.vue    # 侧边栏导航组件
│   ├── views/             # 页面视图
│   │   ├── Home.vue       # 首页
│   │   ├── ServerStatus.vue    # 服务器状态页面
│   │   ├── LocalServer.vue     # 本地服务器管理
│   │   ├── DeviceManagement.vue # 设备管理
│   │   └── GameList.vue        # 游戏列表
│   ├── stores/            # Pinia 状态管理
│   │   ├── deviceStore.js # 设备状态管理
│   │   ├── serviceStore.js # 服务状态管理
│   │   └── gameStore.js   # 游戏状态管理
│   ├── router/            # 路由配置
│   │   └── index.js       # 路由定义
│   ├── App.vue           # 根组件
│   └── main.js           # Vue 应用入口
├── services/              # Electron 主进程服务
│   ├── ipcHandlers.js    # IPC 通信处理
│   ├── mdnsService.js    # mDNS 服务
│   ├── mqttService.js    # MQTT 服务
│   └── localServerService.js # 本地服务器服务
├── main.js               # Electron 主进程入口
├── preload.js            # 预加载脚本
├── index.html            # HTML 入口文件
├── vite.config.js        # Vite 配置
└── package.json          # 项目配置
```

## 🛠️ 开发环境设置

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

这个命令会同时启动：
- Vite 开发服务器 (http://localhost:5173)
- Electron 应用程序

### 构建生产版本

```bash
# 构建 Vue 应用
npm run build

# 打包 Electron 应用
npm run dist
```

## 📋 功能特性

### 🏠 首页
- 应用概览
- 系统状态统计
- 快速导航

### 📊 服务器状态
- MQTT 连接状态监控
- 设备连接统计
- 服务运行状态
- 系统资源监控
- 实时日志查看

### 🖥️ 本地服务器
- mDNS 服务管理
- MQTT 服务配置
- API 服务控制
- 服务日志查看

### 📱 设备管理
- 设备列表查看
- 设备状态监控
- 设备添加/删除
- 离线检测

### 🎮 游戏列表
- 游戏库管理
- 游戏启动/停止
- 游戏分类
- 游戏时长统计

## 🔧 状态管理

项目使用 Pinia 进行状态管理，解决了页面切换时状态丢失的问题：

- **deviceStore** - 管理设备列表、连接状态、设备类型等
- **serviceStore** - 管理服务状态、配置信息、日志等
- **gameStore** - 管理游戏列表、运行状态、分类等

所有状态都会自动持久化到 localStorage，确保应用重启后状态不丢失。

## 🚀 重构亮点

### ✅ 解决的问题
1. **状态丢失** - 使用 Pinia 实现状态持久化
2. **代码重复** - 组件化开发，提高代码复用性
3. **维护困难** - 清晰的文件结构和模块化设计
4. **开发效率** - 热重载、TypeScript 支持、现代化工具链

### 🎯 技术优势
1. **响应式数据绑定** - Vue 3 Composition API
2. **状态管理** - Pinia 提供类型安全的状态管理
3. **路由管理** - Vue Router 实现单页应用导航
4. **组件化** - 可复用的 Vue 组件
5. **现代化构建** - Vite 提供快速的开发体验

## 📝 开发指南

### 添加新页面
1. 在 `src/views/` 创建新的 Vue 组件
2. 在 `src/router/index.js` 添加路由配置
3. 在 `src/components/Sidebar.vue` 添加导航链接

### 添加新的状态管理
1. 在 `src/stores/` 创建新的 store 文件
2. 定义 state、getters、actions
3. 在组件中使用 `useXxxStore()` 导入

### IPC 通信
- 主进程服务在 `services/` 目录
- 使用 `window.electronAPI` 进行渲染进程通信
- 在 `preload.js` 中暴露安全的 API

## 🔍 调试

- 开发模式下会自动打开 DevTools
- Vue DevTools 可用于调试组件和状态
- 使用 `console.log` 在主进程和渲染进程中调试

## 📦 部署

```bash
# 构建并打包
npm run dist

# 输出文件在 dist/ 目录
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！

## 📄 许可证

MIT License