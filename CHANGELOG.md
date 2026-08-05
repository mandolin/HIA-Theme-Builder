# Changelog

本项目遵循阶段化发布。以下记录公开可验证的发布与里程碑节点。

## [P4] 工程化、合规与文档化收尾（2026-08-05）

- CI 矩阵增强：`.github/workflows/pages.yml` 在部署前对 `core`/`web`/`electron`/`tauri` 四端做构建与测试校验（electron/tauri 以 `--ignore-scripts` 跳过重型二进制下载，仅编译 + SSRF 单测）。
- 三端冒烟证据齐备：core 单测 7/7、web 构建 0 错误、electron `tsc` 0 + SSRF 单测 8/8、tauri 前端 `tsc` 0 + SSRF 单测 6/6（Rust 端到端启动待工具链，符合 P3 限制）。
- 许可证复核：补齐 `HIA/tauri/LICENSE`（MIT），新增 `work-zone/dev/audits/license-audit-tauri-2026-08-05.md`；混合许可证策略（根 MIT / electron Apache-2.0 / tauri MIT）证据齐备。
- ROP 文档化：为 `core` 与 `web` 全部源码补全中英双语注释（commit `c43e49c`）。

## [P3] 三端具象：web 发布 + electron/tauri 骨架与网址取色（2026-08-05）

- web 在线主题构建 + GitHub Pages 发布；操作台/PC/小程序预览/8 渐变角色/Token 导出可交互。
- electron/tauri 桌面骨架 + 从指定网址获取颜色集（SSRF 校验 + `core.analyze` 多信号加权）。
- core 抽离为公共核心（`HIA/core`），被各端以 `file:` 链接复用。

## [P2] 公共核心 core（基线）

- 建立 `HIA/core` 公共主题模型、颜色算法、Token 导出，供各端复用。

## [P1] 项目初始化（基线）

- 建立 mono-repo 容器结构与双仓库边界（公开主库 + 私有 WorkZone）。
- 落地 `README.md`、`AGENTS.md`、`LICENSE`、`work-zone/` 私有工作区基线。
- 引入 HIA-Documentation-Sys 通知读取状态登记机制。
- 建立首份周期规划、里程碑与任务状态账本样板。

> 更多阶段条目随实现推进在公开发布时补充；过程性规划与 closeout 保存在私有 `work-zone/`。
