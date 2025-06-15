# 构建和打包指南

本项目支持多种打包模式，可以根据需要选择不同的构建方式。

## 开发模式

```bash
# 启动开发服务器
npm run dev
```

## 构建模式

### 1. 基础构建
```bash
# 仅构建前端资源
npm run build

# 构建并打包成目录格式（用于开发测试）
npm run dist
```

### 2. 安装包模式
```bash
# 构建并打包成 Windows 安装包（.exe）
npm run dist:installer
```

这将生成一个 NSIS 安装程序，具有以下特性：
- 支持自定义安装目录
- 创建桌面快捷方式
- 创建开始菜单快捷方式
- 支持卸载程序
- 用户友好的安装界面

### 3. 便携版模式
```bash
# 构建并打包成便携版（.exe）
npm run dist:portable
```

这将生成一个便携版可执行文件，特性：
- 单文件执行
- 无需安装
- 可以放在U盘等移动设备上运行

## 输出文件

所有构建产物都会输出到 `dist` 目录：

- `dist/win-unpacked/` - 未打包的应用程序文件
- `dist/EasySmart Electron Setup 1.0.0.exe` - Windows 安装包
- `dist/EasySmart Electron 1.0.0.exe` - 便携版可执行文件

## 注意事项

1. 首次构建可能需要下载 Electron 二进制文件，请确保网络连接正常
2. 构建过程中会自动包含以下资源：
   - 前端构建产物
   - 主进程文件（main.js, preload.js）
   - 服务文件（services/）
   - 工具文件（util/）
   - 资源文件（assets/）
   - 内置工具（inner-tools/）

3. 如需修改应用图标，请替换 `assets/icon.ico` 文件
4. 如需修改应用信息，请编辑 `package.json` 中的 `build` 配置

## GitHub Actions 自动构建

项目配置了 GitHub Actions 工作流，可以自动构建和发布安装包：

### 触发条件
- 推送带有 `v*` 格式的标签（如 `v1.0.0`）
- 手动触发工作流

### 自动构建流程
1. 安装依赖
2. 构建前端资源
3. 生成 Windows 安装包（.exe）
4. 生成便携版可执行文件
5. 自动创建 GitHub Release
6. 上传安装包和便携版到 Release

### 发布新版本
```bash
# 创建并推送标签
git tag v1.0.0
git push origin v1.0.0
```

工作流将自动运行并在 GitHub Releases 页面发布安装包。

## 故障排除

如果构建失败，请尝试：

1. 清理 node_modules 并重新安装依赖：
   ```bash
   rm -rf node_modules
   npm install
   ```

2. 清理构建缓存：
   ```bash
   rm -rf dist
   ```

3. 检查 Electron 版本兼容性
4. 确保所有依赖都已正确安装
5. 检查 GitHub Actions 工作流日志