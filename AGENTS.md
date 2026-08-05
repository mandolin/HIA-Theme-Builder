# HIA-Theme-Builder — Agent 指引

## Shell

- Windows 下默认使用 PowerShell 7：`C:\Program Files\PowerShell\7\pwsh.exe`。
- 若工具运行器启动的是 Windows PowerShell 5.1，在涉及脚本语义、编码、管道或版本差异时显式调用 PowerShell 7。

## 仓库与边界

- 根目录是 mono-repo 容器：顶层文件夹自身是公开主库；`work-zone/` 是被根 `.gitignore` 排除的独立私有仓库，映射到 `mandolin/HIA-Theme-Builder-WorkZone`。
- `HIA/core/`、`HIA/web/`、`HIA/electron/`、`HIA/tauri/` 均位于公开主库内，但彼此独立包管理、测试与发布；根目录不得建立跨端共享依赖树或统一构建流水线。
- `HIA/core/` 是公共核心，供其余各端以本地包链接或 workspace 引用方式复用；不得把某端的私有依赖上提到根。
- 公开 README、`docs/`、`examples/` 与发布物不得泄露内部规划、AI 协作、私有路径、草稿或会话记录。`work-zone/` 保存规划、研究、审计、评审与 AI 日志。
- `work-zone/ai/share/` 为参与 AI 共享区；`work-zone/ai/<agent>/` 归对应 AI，其他 AI 默认只读且不覆盖。
- 外部/目标项目默认只读；需其采取行动时，在其约定通知区留言，不得越界修改。

## 上下文恢复与反循环

- 长任务开始、上下文恢复、阶段切换或用户说“继续推进”时，必须先读取 `work-zone/` 中对应的任务状态账本（`dev/tasks/active/<任务ID>-state.md`）与规划/里程碑。
- 读取账本后，再核对主库与 `work-zone/` 的 `git status`、最近验证结果与实际文件状态；不得只依赖会话摘要继续工作。
- 已标记 `已完成`/`已放弃`/`已取消` 的步骤不得无依据重做；用户改变目标或约束时必须先更新账本再实施。
- 反循环熔断：同一命令或方案因同一原因重复失败两次，或连续两轮无新增可验证进展（代码、测试、文档证据），应暂停并向用户报告。

## 公开材料与 WorkZone

- 内部文档默认中文叙述（规划、草案、ADR、任务、审查、交接、AI 日志、引导记录）；代码标识符、协议名、标准名、包名、命令、配置键保留原文。
- 每次有实质内容的对话结束前，须在 `work-zone/ai/<agent>/chatlog/YYYY-MM-DD/` 创建或续写任务日志，记录目标、边界、关键命令、取舍、验证与下一入口；不记录逐字私有思维链。

## 规划、决策与文档通知

- 周期组 `C-tb-P<n>.md`、全局周期 `W-tb-P<n>.md`、子项目 `G-<short>-P<n>.md`、横向 `T-<code>-P<n>.md`、编排 `S-<code>-<n>.md`。
- 规划存放 `work-zone/dev/plans/`；里程碑 `work-zone/dev/milestones/`；任务模板 `work-zone/dev/tasks/TASK_TEMPLATE.md`。
- 改变长期边界、协议、依赖、兼容性策略或跨端契约前，须在 `work-zone/docs/adr/` 建立或更新 ADR；存在产品取舍时取得维护者定案。
- 初始化、阶段启动、文档化/发布准备与阶段收尾时，扫描 `K:\Project\Github_mandolin\HIA-Documentation-Sys\work-zone\notify\`，并在 `work-zone/dev/adoption/documentation-notify-state.md` 登记适用性、决定、关联项与状态。

## 研究、质量与合规

- 选语言、协议、解析器、运行时、基础设施、合规、许可证或跨项目接口等基础方案前，先研究成熟生态与官方资料并留据至 `work-zone/dev/research/`、规划或 ADR。
- 高风险核心改动：测试/fixture/检查脚本先行；按风险运行验证并精确记录命令、结果、限制与后续事项。
- 新增第三方依赖、图标、图片、字体、代码片段、数据集或二进制前，记录来源、版本、许可证、再分发与运行时影响。默认优先 MIT、Apache-2.0、BSD、ISC、OFL、CC0 等宽松许可。

## ROP 与中英双语代码注释

- 自首份源码、每个新文件与每个新语义节点首次写入起执行 ROP，不得以“后续补齐”或“检查器未接入”为由降低要求。
- 每个代码语义节点（package/module 边界、class、interface、type、function、method、constructor、公开成员、重要常量，以及具独立职责/约束/副作用的内部单元）均须有紧邻声明的中英双语文档化注释。
- 节点内部明显流程块、分支、转换、错误恢复、兼容路径、资源生命周期须有分层中英双语普通注释；函数/方法/构造器/回调/初始化块内部基本每个局部变量与每句非自明语句须有紧邻双语说明。
- JS/TS 使用 `@lang zh-CN`、`@lang en` 与 inline `<lang>`；HTML/CSS 等用各自合法注释表面并保留完整中英双语。不得自创 `@zh`/`@en` 等临时标签。
- 注释须解释职责、语义、来源、意图、状态变化、不变量、副作用、异常、兼容、安全/隐私或风险，而非逐 token 翻译或空话。
- 修改旧代码执行 touch-improve：补齐本次触及的模块职责、公共 API 与关键不变量；未处理缺口进入 coverage inventory。

## 完成定义

完成意味着边界清晰、验证与风险相称、公开/私有文档同步、规划/里程碑/审计已更新，且风险或未完成事项有明确去向。触及源码时尚须满足 ROP 双语节点/普通注释、touch-improve、测试与 coverage 记录要求。未经授权不得自动提交；提醒维护者将公开主库与私有 WorkZone 分别提交。
