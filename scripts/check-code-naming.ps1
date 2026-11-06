#!/usr/bin/env pwsh
# @lang zh-CN 代号全称门禁脚本：扫描活跃文档中的裸缩写（P<n>/W<n>/C<n>），失败则退出码非 0（用于 CI 门禁）。
#   例外：规则条文中的示例引用（如"禁止 `P6`"）、外部规格节编号（如"原始规格 P5 节"，需显式标注）、
#   优先级标签（如"P0 必须/P1 应该/P2 可选"）。
# @lang en Code naming gate script: scan active documents for bare abbreviations (P<n>/W<n>/C<n>),
#   fail with non-zero exit code on violation (for CI gate).
#   Exceptions: rule citations (e.g., "forbid `P6`"), external spec section numbers (e.g., "original spec section P5", must be annotated),
#   priority labels (e.g., "P0 required / P1 recommended / P2 optional").

$ErrorActionPreference = "Stop"

Write-Host "Scanning for bare planning codes (P<n>/W<n>/C<n>)..."

# 活跃文档列表（本次触及的、非历史收口的文档）
# <lang zh-CN>历史收口文档按 touch-improve 原则，下次触及时整改，不在此扫描。
#   任务账本（tasks/active/*）中的 C4-C12 等是任务项标识符，非规划代号，不扫描。</lang>
# <lang en>Historical closed documents follow touch-improve; fixed next time touched, not scanned here.
#   Task ledger (tasks/active/*) contains C4-C12 etc. as task item identifiers, not planning codes; excluded.</lang>
$activeDocs = @(
    "AGENTS.md",
    "README.md",
    "CHANGELOG.md",
    "docs/README.md",
    "work-zone/dev/roadmap.md",
    "work-zone/dev/plans/C-tb-INDEX.md",
    "work-zone/dev/plans/C-tb-P2.md",
    "work-zone/dev/plans/C-tb-CANDIDATES.md",
    "work-zone/dev/milestones/README.md",
    "work-zone/docs/planning-system.md",
    "work-zone/docs/standards/planning-code-naming-policy.md",
    "work-zone/design/screen-state-matrix.md",
    "work-zone/design/design-implementation-map.md",
    "work-zone/dev/releases/README.md",
    "work-zone/dev/exceptions/W-tb-P5-EX-*.md"
)

$violations = @()

foreach ($doc in $activeDocs) {
    $paths = Get-ChildItem -Path $doc -ErrorAction SilentlyContinue
    foreach ($path in $paths) {
        $content = Get-Content $path.FullName -Raw
        $lines = $content -split "`n"
        $lineNum = 0
        foreach ($line in $lines) {
            $lineNum++
            # 行级例外检查（跳过整行）
            # <lang zh-CN>以下模式视为合法引用，不扫描裸代号。</lang>
            # <lang en>Following patterns are legitimate references; skip entire line.</lang>
            if ($line -match 'CC0') { continue } # CC0 许可证名
            if ($line -match '禁止|不得写|之类简写|forbid|must not write|such abbreviations') { continue } # 规则条文示例
            if ($line -match '原始规格|external spec|spec section') { continue } # 外部规格节编号
            if ($line -match '必须|应该|可选|required|recommended|optional|任务优先级标签|priority labels') { continue } # 优先级标签
            if ($line -match 'P<n>') { continue } # 编号规则说明
            # 查找裸 P<n>/W<n>/C<n>
            # <lang zh-CN>PCRE 负向断言排除 W-tb-P/C-tb-P 等合法前缀。</lang>
            # <lang en>PCRE negative lookbehind excludes legitimate prefixes like W-tb-P/C-tb-P.</lang>
            $matches = [regex]::Matches($line, '(?<![A-Za-z-])([PWC]\d+)(?![\w.-])')
            foreach ($match in $matches) {
                $code = $match.Groups[1].Value
                # 违例
                $violations += "$($path.Name):$lineNum → bare code '$code' in: $($line.Trim().Substring(0, [Math]::Min(80, $line.Trim().Length)))"
            }
        }
    }
}

if ($violations.Count -eq 0) {
    Write-Host "✅ No bare planning codes found."
    exit 0
} else {
    Write-Host "❌ Found $($violations.Count) bare planning code violations:"
    foreach ($v in $violations) {
        Write-Host "  $v"
    }
    Write-Host ""
    Write-Host "Fix violations by using full codes (e.g., W-tb-P6 instead of P6)."
    Write-Host "See work-zone/docs/standards/planning-code-naming-policy.md for rules."
    exit 1
}
