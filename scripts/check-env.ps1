#!/usr/bin/env pwsh
# @lang zh-CN 本地环境 doctor 脚本（T-tb-ENVDOC / `W-tb-P6` 收尾）：一键体检开发环境，拦截
#   "mise 未激活时 Node 20.9 静默破坏测试" 类踩坑（2026-11-06 与 2026-11-08 两度实测）。
#   检查项：Node 版本、npm、PowerShell 7、Git、Rust/Tauri 工具链、 mise 激活状态；
#   输出 PASS/WARN/FAIL 三级结论与修复提示，FAIL 退出码非 0（可挂 CI/预提交）。
# @lang en Local environment doctor script (T-tb-ENVDOC, `W-tb-P6` closeout): one-shot dev-env
#   health check guarding against pitfalls like "Node 20.9 silently breaking tests when mise is not
#   activated" (observed 2026-11-06 and 2026-11-08). Checks Node, npm, PowerShell 7, Git, Rust/Tauri
#   toolchain and mise activation; emits PASS/WARN/FAIL with fix hints; non-zero exit on FAIL.

$ErrorActionPreference = "Continue"

# 结果聚合器：每项检查登记为 PASS/WARN/FAIL + 说明。
# <lang zh-CN>WARN 不影响退出码；FAIL 置 1。WARN 用于"能用但已知有坑"的项（如 Node 20.9）。</lang>
# <lang en>WARN does not affect exit code; FAIL sets 1. WARN marks "works but known-pitfall" items (e.g. Node 20.9).</lang>
$script:results = New-Object System.Collections.Generic.List[object]
$script:exitCode = 0

function Add-Result([string]$level, [string]$name, [string]$detail) {
    $script:results.Add([pscustomobject]@{ Level = $level; Name = $name; Detail = $detail })
    if ($level -eq "FAIL") { $script:exitCode = 1 }
}

# 命令探测：返回可执行文件完整路径或 $null。
# <lang zh-CN>Get-Command 对缺失命令抛错，这里统一容错封装。</lang>
# <lang en>Get-Command throws on missing commands; wrapped uniformly here.</lang>
function Get-Tool([string]$name) {
    try { return (Get-Command $name -ErrorAction Stop).Source } catch { return $null }
}

Write-Host "=== HIA Theme Builder 本地环境体检 / Local environment doctor ===" -ForegroundColor Cyan

# 1) Node.js：版本 >=22 达标；20.x 可用但 WARN（.ts 直导单测失败、npm scripts glob 不展开两坑）。
# <lang zh-CN>engines 声明 >=18，但 20.9 实测：celebi.test.mjs 直导 .ts 报 ERR_UNKNOWN_FILE_EXTENSION、
#   Git Bash 下 npm run test 的 glob 不展开（node --test test/*.test.mjs 找不到文件）。22+ 无此两坑。</lang>
# <lang en>engines declares >=18, but Node 20.9 verified pitfalls: direct .ts import in tests fails with
#   ERR_UNKNOWN_FILE_EXTENSION, and npm-script globs do not expand under Git Bash. Node 22+ has neither.</lang>
$node = Get-Tool "node"
if ($node) {
    $nodeVer = (& node --version) -replace '^v', ''
    $nodeMajor = [int]($nodeVer -replace '\..*$', '')
    if ($nodeMajor -ge 22) {
        Add-Result "PASS" "Node.js $nodeVer" "版本达标（>=22，无已知测试坑）"
    } elseif ($nodeMajor -ge 18) {
        Add-Result "WARN" "Node.js $nodeVer" "可运行基础测试，但 <22 存在已知坑：① extractor celebi.test.mjs 直导 .ts 失败；② Git Bash 下 npm scripts 的 glob 不展开。建议 mise exec -- node@22 或切换 LTS 22+"
    } else {
        Add-Result "FAIL" "Node.js $nodeVer" "低于 engines 要求（>=18）；请切换 Node 22 LTS"
    }
} else {
    Add-Result "FAIL" "Node.js" "未找到 node 命令——若使用 mise，请先 'mise activate' 或在 shell 配置中挂载"
}

# 2) npm：随 Node 安装，仅作存在性检查。
# <lang zh-CN>npm 缺失通常意味着 Node 安装不完整。</lang>
# <lang en>Missing npm usually implies an incomplete Node install.</lang>
if (Get-Tool "npm") {
    Add-Result "PASS" "npm $(& npm --version)" "可用"
} else {
    Add-Result "FAIL" "npm" "未找到——随 Node.js 一起安装"
}

# 3) PowerShell 7（pwsh）：代号门禁与检查脚本依赖 7.x 语义（5.1 不兼容部分语法）。
# <lang zh-CN>AGENTS.md 约定 Windows 下默认使用 PowerShell 7。</lang>
# <lang en>AGENTS.md mandates PowerShell 7 on Windows.</lang>
if (Get-Tool "pwsh") {
    Add-Result "PASS" "PowerShell 7 $((& pwsh --version))" "门禁脚本可运行"
} else {
    Add-Result "WARN" "PowerShell 7" "未找到 pwsh——scripts/check-code-naming.ps1 等门禁需 pwsh 7 运行（winget install Microsoft.PowerShell）"
}

# 4) Git：双库（公开主库 + WorkZone）提交推送的基础。
# <lang zh-CN>未找到 git 时一切提交/推送操作不可用。</lang>
# <lang en>Without git, commit/push workflows are unavailable.</lang>
if (Get-Tool "git") {
    Add-Result "PASS" "git $((& git --version))" "可用"
} else {
    Add-Result "FAIL" "git" "未找到——双库工作流不可用"
}

# 5) Rust/Cargo：仅 Tauri 端构建需要；缺失降级为 WARN（可只做 web/electron 开发）。
# <lang zh-CN>tauri build 需要 cargo；tauri 无独立单测，构建即验证。</lang>
# <lang en>tauri build needs cargo; no standalone tauri tests, build is the verification.</lang>
if (Get-Tool "cargo") {
    Add-Result "PASS" "cargo $((& cargo --version))" "Tauri 工具链可用"
} else {
    Add-Result "WARN" "cargo (Rust)" "未找到——Tauri 端无法构建（web/electron 不受影响）；rustup 安装后重跑"
}

# 6) mise 激活状态：检测 MISE_ 环境变量与 mise 命令，给出"未激活即裸系统工具链"的提示。
# <lang zh-CN>mise 未激活时 PATH 落到系统 Node（常见 20.9），正是两度踩坑的根因。</lang>
# <lang en>Without mise activation PATH falls back to the system Node (commonly 20.9) — the root cause of both incidents.</lang>
$misectl = Get-Tool "mise"
if ($misectl) {
    $miseActive = [bool]($env:MISE_SHELL -or $env:MISE_SESSION_NAME -or ($env:PATH -split ';' | Where-Object { $_ -like '*mise*shims*' }))
    if ($miseActive) {
        Add-Result "PASS" "mise" "已激活（shims/shell 已挂载）"
    } else {
        Add-Result "WARN" "mise" "已安装但未激活——当前为裸系统工具链；在 shell 配置加入 'mise activate pwsh' 或每会话 'mise exec --'"
    }
} else {
    Add-Result "PASS" "mise" "未安装（直接管理工具链，跳过激活检查）"
}

# 7) 双库工作区：公开主库 + WorkZone 同仓检查（当前脚本位于主库 scripts/，WorkZone 为同级目录）。
# <lang zh-CN>仓库结构约定：仓库根/work-zone 是独立私有库。</lang>
# <lang en>Repo layout: repo-root/work-zone is an independent private repo.</lang>
$wz = Join-Path (Get-Location) "work-zone"
if (Test-Path (Join-Path $wz ".git")) {
    Add-Result "PASS" "WorkZone 双库" "work-zone/.git 存在（在主库根运行本脚本）"
} elseif (Test-Path (Join-Path (Split-Path (Get-Location) -Parent) "work-zone\.git")) {
    Add-Result "PASS" "WorkZone 双库" "检测到上级目录的 work-zone（当前在 WorkZone 内运行）"
} else {
    Add-Result "WARN" "WorkZone 双库" "未在仓库结构中找到 work-zone/.git——请在主库根或 WorkZone 内运行"
}

# 汇总输出：FAIL 红、WARN 黄、PASS 绿；末行给出退出码结论。
# <lang zh-CN>输出对齐便于快速扫读；结论行指导下一步动作。</lang>
# <lang en>Aligned output for quick scanning; the verdict line guides next actions.</lang>
Write-Host ""
foreach ($r in $script:results) {
    $color = switch ($r.Level) { "PASS" { "Green" } "WARN" { "Yellow" } "FAIL" { "Red" } }
    Write-Host ("[{0}] {1}" -f $r.Level, $r.Name) -ForegroundColor $color -NoNewline
    Write-Host (" — " + $r.Detail)
}
$fails = ($script:results | Where-Object { $_.Level -eq "FAIL" }).Count
$warns = ($script:results | Where-Object { $_.Level -eq "WARN" }).Count
Write-Host ""
Write-Host ("结论：{0} 项通过，{1} 项警告，{2} 项失败 / {3} pass, {4} warn, {5} fail" -f ($script:results.Count - $fails - $warns), $warns, $fails, ($script:results.Count - $fails - $warns), $warns, $fails) -ForegroundColor $(if ($fails -gt 0) { "Red" } elseif ($warns -gt 0) { "Yellow" } else { "Green" })
if ($script:exitCode -ne 0) { Write-Host "存在 FAIL 项：请先修复再运行构建/测试。" -ForegroundColor Red }
exit $script:exitCode
