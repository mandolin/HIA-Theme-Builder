# Fixture: 重定向站点（baidu.com）

## 目的

验证 `finalUrl` 如实报告重定向终址，而非回填请求 URL。

## 预期行为

- 输入：`https://baidu.com`
- 预期 `finalUrl`：`https://www.baidu.com/`（或类似重定向终址）
- 旧实现（回填请求 URL）：会返回 `https://baidu.com`（错误）
- 新实现（读取 `location.href`）：返回真实终址（正确）

## 验证步骤

1. 在真实渲染环境中调用 `collectSignalsV2('https://baidu.com')`
2. 检查返回的 `page.finalUrl` 是否为重定向后的真实 URL
3. 确认不是回填的请求 URL

## 相关修复

此 fixture 验证 `W-tb-P6` 回归加固中的 B3 修复（`finalUrl` 读取真实 `location.href`）。
