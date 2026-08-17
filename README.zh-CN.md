# Hermes — 你的私人跑步教练

本地优先的私人跑步教练应用。**React** 前端，**Spring Boot** 后端 — 它回答每位跑者的三个问题：*今天该不该跑、强度多大，我在进步吗，今天穿哪双鞋？*

📖 **[Wiki](https://github.com/JunWeiLi233/Hermesruns/wiki)** · 安装指南、架构文档等。

## 活动徽章与架构图

GitHub 提交活动徽章与实时架构图（自动生成）位于 [README.md](README.md)，由 GitHub Actions 每日刷新。中文版不再重复维护这些自动生成区块。

## Hermes 是什么？

Hermes 是你本地运行的**私人跑步教练**，分析你的跑步数据，回答三个问题：

1. **今天要跑吗？跑多累？** — 每日准备度、天气、训练蓝图、跑鞋推荐
2. **我在进步吗？** — VDOT 追踪、训练负荷（ACWR）、比赛预测、恢复时间估算
3. **今天穿哪双鞋？** — 跑鞋库存、里程追踪、AI 照片扫描导入

数据来源：**Strava**、**Garmin Connect**、**COROS**，以及手动文件导入（FIT/GPX/TCX/ZIP）。所有分析都在本机完成 — 为下一次决策提供私密的跑步智能。

## 快速开始

```powershell
# Windows
.\start_hermes.bat
```

```bash
# macOS / Linux
./start_hermes.sh
```

打开 `http://localhost:8080`，邮箱注册即可使用 — 无需配置数据库、API 密钥。更多命令见 [docs/repo-rules/stack-and-commands.md](docs/repo-rules/stack-and-commands.md)。生产部署（PostgreSQL、OAuth、Stripe）见 [docs/setup.md](docs/setup.md)。

## 功能亮点

| 模块 | 功能 |
|---|---|
| **今日训练** | 每日教练指导：准备度、天气、个性化训练蓝图、跑鞋推荐 |
| **深度分析** | VDOT、训练配速、强度评分、ACWR 伤病风险、恢复时间 — 公式详解见 [docs/README-ANALYSIS.md](docs/README-ANALYSIS.md) |
| **跑鞋管理** | 库存追踪、里程管理、AI 拍照扫描导入、目录浏览 |
| **赛事 / 训练计划** | 交互式世界地图、60+ 赛事目录、个人最佳、倒计时；每周训练规划器 |
| **热力图 / 天气** | 全屏 GPS 热力图（实时统计）；天气感知的教练建议 |
| **教练 / 成就** | 每日教练推荐；成就徽章与进度追踪 |
| **数据导入** | Strava 同步、Garmin Connect 拉取、手动 FIT/GPX/TCX/ZIP 导入（COROS、Huawei Health） |
| **管理后台** | 运维状态、KPI 看板、跑者管理、任务队列、审计日志 |

## Web 路由

| 路由 | 页面 |
|---|---|
| `/`、`/login`、`/signup` | 首页、登录、注册 |
| `/profile`、`/runs`、`/run/:id` | 个人主页、跑步历史、跑步详情 |
| `/analysis`、`/prediction/:distKey` | 深度分析、比赛预测 |
| `/today-run`、`/heatmap` | 今日训练、GPS 热力图 |
| `/shoes`、`/shoe-catalog`、`/shoes/add` | 跑鞋管理、跑鞋目录、添加跑鞋 |
| `/races`、`/schedule` | 赛事中心、每周训练计划 |
| `/muscle-training`、`/rewards` | 肌肉训练、成就 |
| `/settings` | 主题、语言、单位、已连接服务 |
| `/admin`、`/dashboard` | 管理员登录、管理面板 |

## 文档

- [docs/PROJECT_MAP.md](docs/PROJECT_MAP.md) — 项目架构地图：目录结构、模块映射、调用链
- [docs/README-DEV.md](docs/README-DEV.md) — 贡献者入门：模拟账号、第一次代码改动、提交/同步流程
- [docs/README-ANALYSIS.md](docs/README-ANALYSIS.md) — 分析公式详解：VDOT、训练配速、ACWR、恢复时间
- [docs/setup.md](docs/setup.md) — 本地与生产部署、环境变量参考
- [docs/repo-rules/stack-and-commands.md](docs/repo-rules/stack-and-commands.md) — 技术栈、核心命令、编码规范
- [docs/repo-rules/index.md](docs/repo-rules/index.md) — 仓库规则记录系统
- [docs/auto-hermes/index.md](docs/auto-hermes/index.md) — `/auto-hermes` 记录系统地图

## 参与贡献

- **任务队列** — `TASKS.md` 是共享任务队列；可领取任务或添加新任务。
- **AI 智能体工作流** — `/auto-hermes`（有界单轮）和 `/auto-hermes-max`（并行通道 + 合并闸门）随仓库分发；在 Claude Code 或 Codex 中输入 `/` 即可使用。
- **提交改动** — `/auto-hermes-push-main` 是向 `main` 发起 PR 的**唯一受支持路径**（全量闸门：安全扫描、lint、编译、Docker、身份校验）。详见 [docs/repo-rules/git-and-publish.md](docs/repo-rules/git-and-publish.md)。
- **新贡献者** — 使用内置模拟账号登录，即可看到所有功能都预置了真实数据：[docs/README-DEV.md](docs/README-DEV.md)。

## English

→ [README.md](README.md)