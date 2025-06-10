# 设置代理环境变量
$env:ELECTRON_GET_USE_PROXY = "true"
$env:GLOBAL_AGENT_HTTP_PROXY = "socks5://127.0.0.1:10808"
$env:GLOBAL_AGENT_HTTPS_PROXY = "socks5://127.0.0.1:10808"
$env:HTTP_PROXY = "socks5://127.0.0.1:10808"
$env:HTTPS_PROXY = "socks5://127.0.0.1:10808"
$env:ALL_PROXY = "socks5://127.0.0.1:10808"

# 显示当前代理设置
Write-Host "当前代理设置:"
Write-Host "HTTP_PROXY: $env:HTTP_PROXY"
Write-Host "HTTPS_PROXY: $env:HTTPS_PROXY"
Write-Host "ELECTRON_GET_USE_PROXY: $env:ELECTRON_GET_USE_PROXY"

# 运行构建
Write-Host "开始构建Windows安装包..."
npm run build:win

if ($LASTEXITCODE -eq 0) {
    Write-Host "构建成功完成!" -ForegroundColor Green
    Write-Host "安装包位置: dist/" -ForegroundColor Yellow
} else {
    Write-Host "构建失败，退出码: $LASTEXITCODE" -ForegroundColor Red
}