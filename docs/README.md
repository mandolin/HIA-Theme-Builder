# HIA-Theme-Builder · 公开文档

本目录汇集面向使用者与二次开发者的公开文档。过程性规划、里程碑、审计与 AI 协作记录位于私有 `work-zone/`，不随公开主库分发。

## 快速入口

- 项目总览、仓库边界、许可证与构建发布：根目录 [`README.md`](../README.md)
- 发布与阶段节点：根目录 [`CHANGELOG.md`](../CHANGELOG.md)
- 智能体协作与边界规则：根目录 [`AGENTS.md`](../AGENTS.md)

## 各端使用与构建

| 入口 | 文档 |
| --- | --- |
| 网页版 | [`HIA/web/README.md`](../HIA/web/README.md)（GitHub Pages 部署） |
| Electron 版 | [`HIA/electron/README.md`](../HIA/electron/README.md)（便携版打包） |
| Tauri 版 | [`HIA/tauri/README.md`](../HIA/tauri/README.md)（Rust + WebView，便携版打包） |
| 公共核心 | [`HIA/core/README.md`](../HIA/core/README.md) |

## 架构决策摘要

关键架构决策的完整记录位于私有 WorkZone 的架构决策记录（ADR），公开侧仅保留结论：

- **共享 UI 复用**：桌面端不重写 UI，直接复用 web 共享渲染器（三端 UI 单一事实来源）。
- **网址取色同源**：Electron 注入与 Tauri `include_str!` 复用同一 scanner bundle，保证算法一致与评分可复现。
- **P5 增强项**：logo 检测、dark 双模式、受限多页面采集、Celebi 对比基准、precision 可选骨架。

## 当前发布状态（2026-08-06）

- 网页版：GitHub Pages 已部署。
- 桌面端：Electron / Tauri 未签名便携版已发布至 GitHub Release `v0.1.0-desktop`。
- 三端版本号各自独立演进（当前均为 `0.1.0`）。
