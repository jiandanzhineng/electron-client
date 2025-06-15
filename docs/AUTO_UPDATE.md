# 自动更新功能说明

本应用集成了基于 GitHub Releases 的自动更新功能，用户可以自动检测、下载和安装应用程序的最新版本。

## 功能特性

- ✅ 自动检测新版本
- ✅ 后台下载更新包
- ✅ 用户确认后安装更新
- ✅ 支持增量更新
- ✅ 更新进度显示
- ✅ 错误处理和重试机制

## 技术实现

### 核心依赖

- `electron-updater`: Electron 应用自动更新库
- GitHub Releases: 作为更新服务器

### 文件结构

```
services/
├── autoUpdateService.js    # 自动更新服务
└── ipcHandlers.js          # IPC 通信处理（包含更新相关接口）

src/
├── components/
│   └── AutoUpdater.vue     # 更新界面组件
└── views/
    └── Home.vue            # 集成了更新组件的首页

preload.js                  # 暴露更新 API 给渲染进程
```

## 配置说明

### package.json 配置

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "jiandanzhineng",
      "repo": "electron-client"
    }
  }
}
```

### GitHub Actions 配置

工作流会在创建 tag 时自动构建并发布到 GitHub Releases：

```yaml
on:
  push:
    tags:
      - 'v*'
```

## 使用方法

### 开发者操作

1. **发布新版本**：
   ```bash
   # 更新版本号
   npm version patch  # 或 minor, major
   
   # 推送 tag 触发构建
   git push origin --tags
   ```

2. **GitHub Actions 会自动**：
   - 构建应用程序
   - 创建 GitHub Release
   - 上传安装包和更新文件

### 用户体验

1. **自动检查**：应用启动 5 秒后自动检查更新
2. **手动检查**：在首页点击"检查更新"按钮
3. **更新流程**：
   - 发现新版本 → 提示用户
   - 用户确认 → 后台下载
   - 下载完成 → 提示安装
   - 用户确认 → 安装并重启

## API 接口

### 主进程 API

```javascript
// 自动更新服务
const autoUpdateService = require('./services/autoUpdateService')

// 检查更新
autoUpdateService.checkForUpdates()

// 手动检查更新
autoUpdateService.checkForUpdatesManually()

// 下载更新
autoUpdateService.downloadUpdate()

// 安装更新
autoUpdateService.installUpdate()

// 获取状态
autoUpdateService.getStatus()
```

### 渲染进程 API

```javascript
// 检查更新
const result = await window.electronAPI.checkForUpdates()

// 下载更新
const result = await window.electronAPI.downloadUpdate()

// 安装更新
const result = await window.electronAPI.installUpdate()

// 获取状态
const result = await window.electronAPI.getUpdateStatus()

// 监听更新状态
window.electronAPI.onAutoUpdaterStatus((status) => {
  console.log('更新状态:', status)
})
```

## 事件说明

### 更新事件类型

- `checking-for-update`: 正在检查更新
- `update-available`: 发现新版本
- `update-not-available`: 已是最新版本
- `download-progress`: 下载进度
- `update-downloaded`: 下载完成
- `update-error`: 更新错误

### 事件数据结构

```javascript
// update-available
{
  event: 'update-available',
  data: {
    version: '1.1.0',
    releaseDate: '2024-01-01',
    releaseNotes: '更新说明'
  }
}

// download-progress
{
  event: 'download-progress',
  data: {
    percent: 50.5,
    transferred: 1024000,
    total: 2048000
  }
}
```

## 安全考虑

1. **代码签名**：生产环境建议配置代码签名
2. **HTTPS 传输**：GitHub Releases 使用 HTTPS
3. **校验机制**：electron-updater 内置文件完整性校验
4. **权限控制**：只有仓库维护者可以发布新版本

## 故障排除

### 常见问题

1. **开发模式下无法更新**
   - 这是正常的，自动更新只在生产环境生效
   - 开发模式会显示相应提示

2. **网络连接问题**
   - 检查网络连接
   - 确认可以访问 GitHub

3. **权限问题**
   - 确保应用有写入权限
   - Windows 可能需要管理员权限

### 调试方法

1. **查看日志**：
   ```javascript
   // 在 autoUpdateService.js 中已集成日志记录
   logger.info('更新状态', 'autoUpdater')
   ```

2. **手动测试**：
   ```bash
   # 构建测试版本
   npm run dist:never
   
   # 创建测试 tag
   git tag v1.0.1-test
   git push origin v1.0.1-test
   ```

## 版本发布流程

1. **开发完成**：确保所有功能正常
2. **更新版本**：修改 package.json 中的版本号
3. **提交代码**：提交所有更改
4. **创建标签**：`git tag v1.x.x`
5. **推送标签**：`git push origin --tags`
6. **自动构建**：GitHub Actions 自动构建和发布
7. **测试更新**：在旧版本中测试自动更新功能

## 注意事项

- 版本号必须遵循语义化版本规范（SemVer）
- 标签名必须以 `v` 开头（如 `v1.0.0`）
- 确保 GitHub Token 有足够的权限
- 生产环境建议配置代码签名证书
- 大版本更新建议提供详细的更新说明