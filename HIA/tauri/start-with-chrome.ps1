# HIA Theme Builder Tauri 一键启动脚本（connect 模式）
# 自动启动 Chrome（远程调试端口 9222）→ 等待就绪 → 设 HIA_CHROME_WS → 启动 Tauri 应用
# 避开 chromiumoxide 0.5.7 与新版 Chrome 的 CDP 兼容问题（oneshot canceled）

param(
    [string]$ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe",
    [string]$TauriExe = "$PSScriptRoot\src-tauri\target\debug\hia-theme-tauri.exe",
    [int]$Port = 9222,
    [int]$TimeoutSec = 15
)

$ErrorActionPreference = "Stop"

Write-Host "=== HIA Theme Builder Tauri 启动器 ===" -ForegroundColor Cyan
Write-Host ""

# 检查 Chrome 是否存在
if (-not (Test-Path $ChromePath)) {
    Write-Host "错误：未找到 Chrome，请确认路径：$ChromePath" -ForegroundColor Red
    Write-Host "可修改脚本参数 -ChromePath 指向你的 Chrome 安装路径" -ForegroundColor Yellow
    exit 1
}

# 检查 Tauri 二进制是否存在
if (-not (Test-Path $TauriExe)) {
    Write-Host "错误：未找到 Tauri 二进制，请先运行 cargo build：$TauriExe" -ForegroundColor Red
    exit 1
}

# 检查端口是否已被占用（Chrome 可能已在运行）
$chromeRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/json/version" -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        $chromeRunning = $true
        Write-Host "检测到 Chrome 已在端口 $Port 运行，直接复用" -ForegroundColor Green
    }
} catch {
    # Chrome 未运行，继续启动
}

# 启动 Chrome（如果未运行）
if (-not $chromeRunning) {
    Write-Host "启动 Chrome（远程调试模式，端口 $Port）..." -ForegroundColor Yellow
    $chromeArgs = @(
        "--remote-debugging-port=$Port",
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--user-data-dir=$env:TEMP\hia-chrome-profile"
    )
    Start-Process -FilePath $ChromePath -ArgumentList $chromeArgs -WindowStyle Hidden
    Write-Host "Chrome 已启动，等待就绪..." -ForegroundColor Yellow
}

# 等待 Chrome 就绪
$ready = $false
$elapsed = 0
while (-not $ready -and $elapsed -lt $TimeoutSec) {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/json/version" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $ready = $true
            Write-Host "Chrome 就绪（CDP endpoint: http://127.0.0.1:$Port）" -ForegroundColor Green
        }
    } catch {
        Start-Sleep -Milliseconds 500
        $elapsed += 0.5
    }
}

if (-not $ready) {
    Write-Host "错误：Chrome 在 $TimeoutSec 秒内未就绪，请检查 Chrome 是否被防火墙拦截" -ForegroundColor Red
    exit 1
}

# 设置环境变量并启动 Tauri
Write-Host ""
Write-Host "启动 Tauri 应用（HIA_CHROME_WS=http://127.0.0.1:$Port）..." -ForegroundColor Cyan
$env:HIA_CHROME_WS = "http://127.0.0.1:$Port"
& $TauriExe

# Tauri 退出后清理
Write-Host ""
Write-Host "Tauri 已退出。Chrome 仍在后台运行（如需关闭请手动结束 chrome.exe 进程）。" -ForegroundColor Yellow
