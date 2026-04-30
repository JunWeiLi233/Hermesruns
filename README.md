# Hermes — Your Personal Running Coach

> A local-first runner analytics platform. **React** frontend, **Spring Boot** backend.
> Combines daily training guidance, VDOT analysis, heatmaps, race planning, shoe management, and AI-powered import pipelines — all running on your own machine.

[English](#english) | [中文说明](#中文)

---

<a id="english"></a>

## English

### What is Hermes?

Hermes is a **personal running coach** you run locally. It analyzes your running data to answer three questions every runner asks:

1. **Should I run today, and how hard?** — Daily readiness, weather, workout blueprint, shoe guidance
2. **Am I improving?** — VDOT tracking, training load (ACWR), race predictions, recovery estimation
3. **Which shoes should I use?** — Shoe inventory, mileage tracking, AI-assisted photo scanning

Hermes works with data from **Strava**, **Garmin Connect**, **COROS**, and manual file imports (FIT/GPX/TCX/ZIP). All analysis stays on your machine.

**Better than Strava?** Hermes earns its place by being smarter (personalized coaching, not social feeds), more actionable (specific pace ranges, not generic recommendations), and more trustworthy (transparent methodology, no hidden algorithms).

### Quick Start

#### Windows

```powershell
.\start_hermes.bat
```

#### macOS / Linux

```bash
cd backend
./mvnw spring-boot:run
```

Open `http://localhost:8080`, sign up with email, and you're in. No database setup, no API keys, no configuration needed.

> **Want the full experience?** See [Production Setup](#production-setup-postgresql--oauth--admin) for PostgreSQL, Strava/Google OAuth, Stripe billing, and email verification.

### Platform-Specific Instructions

Hermes setup instructions are split by platform from now on:

- **Windows users** should use PowerShell examples, `.bat` launchers, and `Hermes.local.env.ps1`.
- **macOS / Linux users** should use Bash/Zsh examples, `./mvnw`, and exported environment variables.
- When adding new setup steps, include both command forms whenever shell syntax differs.

### Feature Highlights

| Area | What you get |
|---|---|
| **Today Run** | Daily coaching: readiness score, weather, personalized workout blueprint, shoe recommendation |
| **Analysis** | VDOT (VO₂max estimate), training paces, effort scores, ACWR injury risk, recovery time, form tracking |
| **Heatmap** | Full-screen GPS heatmap of all your runs with live totals |
| **Runs** | Filterable run log with route maps, performance metrics, and drill-down detail |
| **Shoes** | Inventory with mileage tracking, rotation insight, AI photo scan import, catalog browser |
| **Races** | Interactive world map, 60+ race catalog, personal bests, countdowns, race-specific training |
| **Schedule** | Weekly training planner |
| **Import** | Strava sync, Garmin Connect pull, manual FIT/GPX/TCX/ZIP (including COROS and Huawei Health) |
| **Settings** | Theme (light/midnight), language (en/zh-CN), units, connected services, batch import |

### Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, Chart.js, Leaflet, Vite 8 |
| Backend | Spring Boot 4, Spring Data JPA, Hibernate |
| Database | H2 (zero-config default) or PostgreSQL |
| Auth | JWT sessions, Google OAuth 2.0, Strava OAuth 2.0, email/password + verification |
| AI | Gemini 2.5 Flash (shoe image scanning), Qwen (course-map route extraction) |
| Payments | Stripe Checkout (Pro subscription) |

### Architecture

```
frontend/          React 19 + Vite 8 — dev server on :3000, proxies API calls to :8080
backend/           Spring Boot 4 + JPA — REST API on :8080, serves the built frontend SPA
```

<!-- AUTO-GENERATED ARCHITECTURE DIAGRAMS START -->
### Live Architecture Diagrams

#### AI Agents Workflow

![Hermes AI agents workflow](docs/architecture/ai-agents-workflow.svg)

Source artifact: [docs/architecture/ai-agents-workflow.html](docs/architecture/ai-agents-workflow.html)

#### SaaS Architecture

![Hermes SaaS architecture](docs/architecture/saas-architecture.svg)

Source artifact: [docs/architecture/saas-architecture.html](docs/architecture/saas-architecture.html)
<!-- AUTO-GENERATED ARCHITECTURE DIAGRAMS END -->

---

### AI-Agent Workflow

Hermes includes an AI-agent workflow driven by **Claude Code** and **Gemini CLI** for autonomous development. The agents pick tasks from a shared queue, implement them with specialist sub-teams, verify, and promote follow-up work.

#### Setup

1. Install the CLI tools:
   ```bash
   npm install -g @anthropic-ai/claude-code
   npm install -g @google/gemini-cli
   ```
2. Configure local secrets for your platform.

   Windows:
   ```powershell
   Copy-Item Hermes.local.env.example.ps1 Hermes.local.env.ps1
   notepad Hermes.local.env.ps1
   ```

   macOS / Linux:
   ```bash
   cp .env.example .env
   ${EDITOR:-nano} .env
   ```

#### Claude Code Commands

| Command | What it does |
|---|---|
| `/auto-hermes` | Standard dev loop — picks a task, implements, verifies |
| `/auto-hermes-self` | Ralph-style indefinite self-loop — keeps executing until a real stop gate fires |
| `/auto-hermes-max` | Parallel multi-agent round with merge gate |
| `/auto-hermes-tech-debt` | Codebase-wide tech debt audit |
| `/auto-hermes-security` | Security audit across auth, config, runtime, and code surfaces |
| `/auto-hermes-market` | Parallel market research + SEO lane → verified opportunities |
| `/auto-hermes-attack` | Resilience/breakage simulation for high-risk surfaces |
| `/auto-hermes-structure-update` | Structure improvement pass |
| `/auto-hermes-find-shoe` | Web-research running shoe brands and update the catalog |
| `/auto-hermes-language` | Polish frontend copy to coach-voice (zh-CN/en sync enforced) |
| `/auto-hermes-push-main` | Guarded publish to `github.com/520HXC/run` |
| `/auto-hermes-submit-main` | Backup-first cherry-pick from nested repo |
| `/auto-ship` | Run TASKS.md queue with shared git policy |
| `/deploy` | Prepare Hermes for deployment |
| `/fix-issue` | Fix a GitHub issue |
| `/pr-review` | Review pull request changes |
| `/frontend-design` | Apply Hermes UI design standards |
| `/optimize-context` | Generate minimal working brief before broad execution |
| `/caveman` | Low-token response mode |

#### Key Files for AI Agents

| File | Purpose |
|---|---|
| `TASKS.md` | Shared task queue — check what agents are working on or add new tasks |
| `.ai-sync/CONTEXT_LEDGER.md` | Durable surface-level decisions and context capsules |
| `.ai-sync/AGENT_SYNC.md` | Cross-agent coordination board |
| `AGENTS.md` | Agent personas, coach-voice rules, engineering standards |
| `CLAUDE.md` | Project brain — product vision, stack, conventions |

---

### Web Routes

| Route | Page | Description |
|---|---|---|
| `/` | Landing | Public homepage with sign-in, sign-up, Strava start |
| `/login` | Login | Email/password + Strava + Google OAuth |
| `/signup` | Signup | Email/password + OAuth entry points + email verification |
| `/terms`, `/privacy` | Legal | Public legal pages |
| `/admin` | Admin Login | System administrator sign-in |
| `/dashboard` | Admin Dashboard | Ops status, KPI grid, runner management, job queues, audit log |
| `/profile` | Runner Hub | Readiness, metrics, records, imports, quick links |
| `/runs` | Run History | Filterable, sortable, paginated run log |
| `/run/:id` | Run Detail | Route map, performance metrics, route intelligence |
| `/analysis` | Analysis | Insight cards, VDOT, training paces, ACWR, recovery |
| `/analysis/vo2max` | VO₂ Max Detail | Trend drill-down |
| `/analysis/:insightKey` | Insight Detail | Injury risk, intensity, coach insight, load balance |
| `/prediction/:distKey` | Prediction Detail | Distance-specific race prediction |
| `/heatmap` | Heatmap | Full-screen GPS heatmap with live totals |
| `/today-run` | Today Run | Daily coaching: readiness, weather, workout, shoes |
| `/shoes` | Shoes | Inventory, rotation insight, filters, scan/import |
| `/shoes/add` | Add Shoes | Guided add-shoes flow |
| `/shoe-catalog` | Shoe Catalog | Browse shoe database |
| `/races` | Race Center | Discovery, countdowns, PBs, saved races |
| `/schedule` | Schedule | Weekly training planner |
| `/muscle-training` | Muscle Training | Anatomical figure, session planning, log |
| `/rewards` | Rewards | Achievement badges, progression |
| `/settings` | Settings | Theme, language, units, Strava, Garmin, imports |

---

### Analysis — How It Works

All formulas come from Jack Daniels' *Running Formula* and peer-reviewed sports science. Hermes shows its work — every number has a traceable basis.

#### VDOT (Daniels' VO₂max Estimate)

From a race performance (distance in meters, time in minutes):

```
velocity     = distance / time                              (m/min)
VO₂          = -4.60 + 0.182258 × v + 0.000104 × v²        (ml/kg/min)
%VO₂max      = 0.8 + 0.1894393 × e^(-0.012778 × t) + 0.2989558 × e^(-0.1932605 × t)
VDOT         = VO₂ / %VO₂max
```

**Current VDOT**: Uses performances from the last **90 days**, prefers distances ≥3 km, takes the **mean of the top three** VDOT values.

#### Training Paces (from VDOT)

| Zone | %VO₂max | Purpose |
|---|---|---|
| Easy | 54–62% | Aerobic base, recovery |
| Marathon | 78% | Race-specific endurance |
| Threshold | 85% | Lactate clearance |
| Interval | 96% | VO₂max stimulus |
| Repetition | 111% | Speed and economy |

#### Training Load — ACWR

EWMA-based injury risk tracking (Gabbett 2016, Hulin et al. 2014, Williams et al. 2017):

```
Acute  λ = 2/(7+1) = 0.25   (7-day)
Chronic λ = 2/(28+1) = 0.069 (28-day)
ACWR = Acute EWMA / Chronic EWMA
```

| ACWR | Zone | Meaning |
|---|---|---|
| < 0.80 | Under-training | Not enough stimulus |
| 0.80–1.30 | Sweet spot | Optimal loading |
| 1.30–1.50 | Warning | Elevated injury risk |
| > 1.50 | Danger | Reduce load |

#### Effort Score

```
intensityRatio = vo₂Fraction / 0.85
effortScore    = duration_hours × intensityRatio² × 100
```

`vo₂Fraction` derived from heart rate or pace. Threshold runs score ~100/hour.

#### Recovery Estimation

```
durationFactor  = (duration > 90 min) ? 1 + 0.005 × (duration - 90) : 1.0
adjustedScore   = effortScore × durationFactor
baseHours       = 0.45 × adjustedScore^0.85
fitnessDiscount = max(0.80, 1.10 - VDOT / 200)
recoveryHours   = min(96, baseHours × fitnessDiscount)
```

Fitter runner (higher VDOT) → faster recovery. Long runs (>90 min) add penalty. Cap: 96 hours.

#### Daniels' Training Zones

| Zone | VO₂ Fraction | Label |
|---|---|---|
| Recovery | < 59% | Easy recovery jog |
| Easy | 59–75% | Aerobic base |
| Marathon | 75–83% | Marathon pace |
| Threshold | 83–92% | Tempo / lactate threshold |
| Interval | 92–105% | VO₂max intervals |
| Repetition | > 105% | Sprint / economy |

---

### Production Setup (PostgreSQL + OAuth + Admin)

#### Windows

```powershell
.\start_hermes_postgres.ps1
```

`start_hermes_postgres.ps1` is the main launcher. It loads secrets from `Hermes.local.env.ps1`.

#### macOS / Linux

```bash
export APP_DB_URL='jdbc:postgresql://localhost:5432/hermes'
export APP_DB_USERNAME='hermes'
export APP_DB_PASSWORD='<your-password>'
export STRAVA_CLIENT_ID='<your-strava-client-id>'
export STRAVA_CLIENT_SECRET='<your-strava-client-secret>'
export APP_DATA_ENCRYPTION_KEY='<long-random-hex-key>'
cd backend
./mvnw spring-boot:run
```

Use `.env` only when your shell, IDE, or process manager explicitly loads it before starting Spring Boot. See [docs/setup.md](docs/setup.md) for the canonical variable reference.

#### Core Configuration

| Section | Variables | Purpose |
|---|---|---|
| Database | `APP_DB_URL`, `APP_DB_USERNAME`, `APP_DB_PASSWORD` | PostgreSQL connection |
| Strava OAuth | `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI`, `APP_DATA_ENCRYPTION_KEY` | Strava login + activity sync |
| Google OAuth | `APP_GOOGLE_CLIENT_ID`, `APP_GOOGLE_CLIENT_SECRET`, `APP_GOOGLE_REDIRECT_URI` | Google login |
| Admin | `APP_BOOTSTRAP_ADMIN_EMAIL`, `APP_BOOTSTRAP_ADMIN_PASSWORD` | Admin account created on startup |

#### Stripe Billing (optional)

Sell **Pro** (AI scan quota) via Stripe Checkout.

1. Create a **Product** with a one-time **Price** in [Stripe Dashboard](https://dashboard.stripe.com/)
2. Set `STRIPE_PRICE_PRO_MONTHLY` to the Price ID (`price_...`)
3. Set `STRIPE_SECRET_KEY` (API key) and `STRIPE_WEBHOOK_SECRET` (webhook signing secret)
4. Set `APP_PUBLIC_BASE_URL` to your site URL (e.g. `https://app.example.com`)
5. Optionally set `APP_BILLING_PRICE_LABEL` (e.g. `$9/month`)

Local testing: `stripe listen --forward-to localhost:8080/api/billing/webhook`

#### Email Verification

Email/password sign-up sends a verification link via SMTP. Leave `SPRING_MAIL_HOST` empty on dev to skip verification.

| Variable | Purpose |
|---|---|
| `SPRING_MAIL_HOST` | SMTP server (empty = skip verification) |
| `SPRING_MAIL_PORT` | Usually `587` |
| `SPRING_MAIL_USERNAME` / `SPRING_MAIL_PASSWORD` | SMTP credentials |
| `APP_MAIL_FROM` | From address |
| `APP_PUBLIC_BASE_URL` | Used in verification link |

#### Public Cloud Security Checklist

- **`HERMES_ENV=production`** — Requires `STRAVA_WEBHOOK_VERIFY_TOKEN` set to a long random value
- **TLS** — Terminate HTTPS at reverse proxy. Set `APP_ENABLE_HSTS=true` only when all traffic is HTTPS
- **Reverse proxy** — `server.forward-headers-strategy=framework` is set; configure proxy to send `X-Forwarded-*`
- **CORS** — Set `APP_CORS_ALLOWED_ORIGINS` if frontend is on a different origin
- **Database** — Use PostgreSQL in production; never expose H2 to the network
- **Webhooks** — Strava/Garmin rate-limited per IP; Garmin callback restricted to `*.garmin.com`; Stripe uses signature verification
- **Errors** — Default error pages omit stack traces; use `APP_JPA_DDL_AUTO=validate` + migrations for mature deployments

---

### Development

#### Prerequisites

- **Java 17+** — [Adoptium Temurin 17 LTS](https://adoptium.net) recommended
- **Node.js 18+** — [nodejs.org](https://nodejs.org)

#### Frontend Dev

Windows:

```powershell
cd frontend
npm install
npm run dev        # → http://localhost:3000 (hot reload, proxies API to :8080)
```

macOS / Linux:

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000 (hot reload, proxies API to :8080)
```

#### Build for Production

Windows:

```powershell
cd frontend
npm run build      # → backend/src/main/resources/static/
```

macOS / Linux:

```bash
cd frontend
npm run build      # backend/src/main/resources/static/
```

#### Backend

Windows:

```powershell
cd backend
.\mvnw.cmd spring-boot:run        # http://localhost:8080
.\mvnw.cmd test                   # run tests on Windows
.\mvnw.cmd -q -DskipTests compile # compile check on Windows
```

macOS / Linux:

```bash
cd backend
./mvnw spring-boot:run            # http://localhost:8080
./mvnw test                       # run tests
./mvnw -q -DskipTests compile     # compile check
```

---

### Database

#### H2 (default)

Zero config. Database file created at `backend/hermes_db_v2.mv.db`.

#### PostgreSQL

Windows:

```powershell
$env:APP_DB_URL      = "jdbc:postgresql://localhost:5432/hermes"
$env:APP_DB_USERNAME = "hermes"
$env:APP_DB_PASSWORD = "<your-password>"
.\start_hermes.bat
```

macOS / Linux:

```bash
export APP_DB_URL='jdbc:postgresql://localhost:5432/hermes'
export APP_DB_USERNAME='hermes'
export APP_DB_PASSWORD='<your-password>'
cd backend
./mvnw spring-boot:run
```

#### Migrate H2 → PostgreSQL

```powershell
.\migrate_h2_to_postgres.bat
```

For macOS / Linux, use the PostgreSQL env block above and run the backend against PostgreSQL directly. The current migration helper is Windows-only.

---

### Login Options

| Method | Setup Required |
|---|---|
| Email | None — sign up and go |
| Admin | Set `APP_BOOTSTRAP_ADMIN_EMAIL` / `APP_BOOTSTRAP_ADMIN_PASSWORD` |
| Google | Windows: configure `Hermes.local.env.ps1`; macOS/Linux: export `APP_GOOGLE_CLIENT_ID`, `APP_GOOGLE_CLIENT_SECRET`, `APP_GOOGLE_REDIRECT_URI` |
| Strava | Windows: configure `Hermes.local.env.ps1`; macOS/Linux: export `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI`, `APP_DATA_ENCRYPTION_KEY` |

#### Local Shared Runner for Contributors

Hermes can bootstrap a local-only demo account with seeded shoes and runs:
`strava+140971747@hermes.local` / `HermesLocal1!`

Windows:

```powershell
$env:APP_LOCAL_SHARED_RUNNER_ENABLED = "true"
$env:APP_LOCAL_SHARED_RUNNER_EMAIL = "strava+140971747@hermes.local"
$env:APP_LOCAL_SHARED_RUNNER_PASSWORD = "HermesLocal1!"
.\start_hermes.bat
```

macOS / Linux:

```bash
export APP_LOCAL_SHARED_RUNNER_ENABLED=true
export APP_LOCAL_SHARED_RUNNER_EMAIL=strava+140971747@hermes.local
export APP_LOCAL_SHARED_RUNNER_PASSWORD='HermesLocal1!'
cd backend
./mvnw spring-boot:run
```

The bootstrap is local-safe: it is disabled by default, skipped in production, and only seeds mock shoes/runs when the runner has no activities yet.

---

### Garmin Connect Import

Pull activities directly from your Garmin Connect account — no manual file export.

```bash
pip install -r .tools/requirements-garmin.txt
```

Then go to **Profile → Garmin Connect → Import from Garmin**. Credentials are used only for the current session and **not stored**.

Uses [GarminDB](https://github.com/tcgoetz/GarminDB)'s `garth` library for SSO login. Duplicate activities skipped automatically.

---

### File Auto-Import (Garmin / COROS)

Supports `GPX`, `TCX`, `FIT`, `ZIP`. Automatic folder watching.

1. Copy `.tools/hermes_sync_config.example.json` to `.tools/hermes_sync_config.json`
2. Fill in your Hermes email/password
3. Drop files into `imports/garmin` or `imports/coros`
4. Start Hermes — processed files move to `imports/processed/`

---

### Important

- **Keep the terminal open** while using the app
- **Restart the backend** after configuration changes
- **Never commit secrets** — use environment variables
- **Use a strong `APP_DATA_ENCRYPTION_KEY`** — it protects stored Strava tokens

---

### Troubleshooting

| Problem | Fix |
|---|---|
| `ERR_CONNECTION_REFUSED` | Windows: `.\start_hermes.bat`; macOS/Linux: `cd backend && ./mvnw spring-boot:run` |
| `java` not found | Install Java 17 from [adoptium.net](https://adoptium.net) |
| OAuth callback fails | Backend must run on `localhost:8080`, redirect URIs must match exactly |
| Frontend changes not showing | Run `npm run build` in `frontend/`, then refresh |

---

### Regression Checklist

Run after changes to auth, import, upload, or third-party integrations.

1. **Expired session**: Block an API call to return `401` while on a page with active edits → should redirect to `/login?return=<path>&reason=expired` with a visible notice
2. **Partial batch import**: Upload valid + invalid files together → should return `200` with `rejectedFiles` listed, modal stays open
3. **Weather outage**: Block `api.open-meteo.com` → weather bar shows "Weather unavailable", rest of page loads normally
4. **Malformed analytics**: Stub analytics endpoint to return `500` → Run Detail renders with inline error card and "Reload" action
5. **Batch file cap**: Submit >50 files → backend returns `400` with limit explanation, frontend shows it in the import modal

---

---

<a id="中文"></a>

## 中文说明

Hermes 是一个本地运行的**个人跑步教练**平台 — **React** 前端，**Spring Boot** 后端。

从 Strava、Garmin Connect、COROS 导入跑步数据，热力图可视化路线，追踪 VDOT 进步，管理跑鞋与赛事，获取丹尼尔斯训练配速。所有数据留在你的机器上。

### 快速开始（30 秒）

```powershell
.\start_hermes.bat
```

打开 `http://localhost:8080`，邮箱注册即可使用。无需配置数据库、API 密钥。

### 功能亮点

| 模块 | 功能 |
|---|---|
| **今日训练** | 每日教练指导：准备度、天气、训练蓝图、跑鞋推荐 |
| **深度分析** | VDOT（VO₂max 估算）、训练配速、训练负荷（ACWR 伤病风险）、恢复时间 |
| **热力图** | 全屏 GPS 跑步热力图，实时统计 |
| **跑步记录** | 可筛选列表，路线地图，运动指标，详情下钻 |
| **跑鞋管理** | 库存追踪、里程管理、AI 拍照扫描、目录浏览 |
| **赛事中心** | 交互式世界地图、60+ 赛事目录、个人最佳、倒计时 |
| **数据导入** | Strava 同步、Garmin Connect 拉取、手动 FIT/GPX/TCX/ZIP 导入 |

### 技术栈

| 层级 | 技术 |
|---|---|
| 前端 | React 19, React Router 7, Chart.js, Leaflet, Vite 8 |
| 后端 | Spring Boot 4, Spring Data JPA, Hibernate |
| 数据库 | H2（默认零配置）或 PostgreSQL |
| 认证 | JWT, Google OAuth 2.0, Strava OAuth 2.0, 邮箱+验证 |
| AI | Gemini 2.5 Flash（跑鞋图片扫描）, Qwen（赛道地图路线提取）|
| 支付 | Stripe Checkout（Pro 订阅）|

### AI 智能体命令

| 命令 | 功能 |
|---|---|
| `/auto-hermes` | 标准开发循环：领取任务、实现、验证 |
| `/auto-hermes-self` | Ralph 式无限自循环 — 持续执行直到触发真正的停止条件 |
| `/auto-hermes-max` | 并行多智能体轮次 + 合并闸门 |
| `/auto-hermes-tech-debt` | 全局技术债审计 |
| `/auto-hermes-security` | 安全审计（认证、配置、运行时、代码）|
| `/auto-hermes-market` | 并行市场调研 + SEO 支持通道 |
| `/auto-hermes-find-shoe` | 网络调研跑鞋品牌并更新目录 |
| `/auto-hermes-language` | 前端文案润色（中英文同步）|
| `/auto-hermes-push-main` | 安全发布到 `github.com/520HXC/run` |

### Web 路由

| 路由 | 页面 | 功能 |
|---|---|---|
| `/` | 首页 | 公开首页，含登录/注册入口 |
| `/login` | 登录 | 邮箱/密码、Strava OAuth、Google OAuth |
| `/signup` | 注册 | 注册账号 + 邮箱验证 |
| `/admin` | 管理员登录 | 系统管理员登录 |
| `/dashboard` | 管理面板 | 运维状态、KPI 看板、用户管理、任务队列、审计日志 |
| `/profile` | 个人主页 | 准备度、指标摘要、个人纪录、数据导入 |
| `/runs` | 跑步历史 | 可筛选/排序/分页列表 |
| `/run/:id` | 跑步详情 | 路线地图、运动指标、路线分析 |
| `/analysis` | 深度分析 | VDOT、训练配速、ACWR、恢复分析 |
| `/today-run` | 今日训练 | 每日教练：准备度、天气、训练、跑鞋 |
| `/shoes` | 跑鞋管理 | 库存、里程追踪、AI 扫描、目录 |
| `/races` | 赛事中心 | 世界地图、60+ 赛事、个人最佳 |
| `/settings` | 设置 | 主题、语言、单位、已连接服务 |

### 分析公式

所有公式来源于 Jack Daniels《丹尼尔斯跑步方程式》及运动生理学文献。

**VDOT**：通过比赛成绩估算有氧能力。使用最近 **90 天**内表现，优先 ≥3km 距离，取**前三个最佳** VDOT 的均值。

**ACWR**（急性/慢性工作负荷比）：使用 EWMA 追踪伤病风险 — 急性 λ=0.25（7天），慢性 λ=0.069（28天）。ACWR < 0.80 训练不足，0.80-1.30 最佳区间，>1.50 危险。

**恢复时间**：基于训练负荷和 VDOT 估算，上限 96 小时。VDOT 越高恢复越快，超过 90 分钟的长跑有额外惩罚。

### 生产部署

```powershell
.\start_hermes_postgres.ps1
```

编辑该文件配置 PostgreSQL、Strava/Google OAuth、管理员账号。详细配置说明见上方英文部分。

### 数据库

| 方案 | 说明 |
|---|---|
| H2（默认）| 零配置，文件自动生成 |
| PostgreSQL | 安装 PG 15+，创建 `hermes` 数据库，配置连接信息 |
| 迁移 | `.\migrate_h2_to_postgres.bat` |

### 注意事项

- **保持终端窗口打开**，关闭则后端停止
- **修改配置后需重启后端**
- **不要把密钥提交到 Git**
- **`APP_DATA_ENCRYPTION_KEY` 请使用强密钥**

### 常见问题

| 问题 | 解决 |
|---|---|
| `ERR_CONNECTION_REFUSED` | 运行 `.\start_hermes.bat` |
| `java` 找不到 | 安装 Java 17：https://adoptium.net |
| OAuth 回调失败 | 确认后端运行在 `localhost:8080`，回调地址完全匹配 |
| 前端修改未生效 | 运行 `npm run build`，刷新页面 |
