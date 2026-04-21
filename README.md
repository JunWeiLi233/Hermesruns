# Hermes Runner Analytics

> [English](#english) | [中文](#中文说明)

---

<a id="english"></a>

## English

A local-first runner coach platform with a **React** frontend and **Spring Boot** backend.

Hermes combines running analytics, daily training guidance, heatmaps, race planning, shoe management, import pipelines, public auth surfaces, and admin tooling in one app you can run on your own machine.

Current website highlights:
- editorial public landing page with sign-in, sign-up, and Strava start flows
- shared signed-in runner shell across profile, analysis, runs, shoes, races, schedule, rewards, settings, and today-run
- route heatmap, VDOT and training-load analysis, race predictions, and deeper drill-down pages
- Today Run coaching with readiness, weather, workout blueprint, and shoe guidance
- shoes inventory plus guided add-shoes, catalog browse, and AI-assisted photo scan/import flows
- settings control room with theme, language, units, weekly brief toggle, Strava status, Garmin Connect import, and batch file import

Supported inputs include Strava sync, Garmin Connect pull, and manual FIT/GPX/TCX/ZIP imports including COROS and Huawei Health export workflows.

### Architecture

```
frontend/          React 19 + Vite 8 — dev server on :3000, proxies API calls to :8080
backend/           Spring Boot 4 + JPA — REST API on :8080, serves the built frontend SPA
```

| Layer | Stack |
|---|---|
| Frontend | React 19, React Router 7, Chart.js, Leaflet, Vite 8 |
| Backend | Spring Boot 4, Spring Data JPA, Hibernate |
| Database | H2 (default, zero-config) or PostgreSQL |
| Auth | JWT sessions, Google OAuth 2.0, Strava OAuth 2.0 |
| File Import | Garmin FIT, GPX, TCX, ZIP, COROS exports, Huawei Health exports |
| Garmin Connect | Direct account import via GarminDB / garth |
| UI posture | Kinetic Editorial design language with `light` and `midnight` runtime themes |

### AI-Agent Workflow (Shared)

This repository includes a specialized, shared AI-agent workflow driven by **Gemini CLI** and **Claude Code**.

**Collaborators can use the same commands to drive development:**

1.  **Setup Agents**:
    *   Install Gemini CLI: `npm install -g @google/gemini-cli`
    *   Install Claude Code: `npm install -g @anthropic-ai/claude-code`
2.  **Configure Secrets**:
    *   Copy `Hermes.local.env.example.ps1` to `Hermes.local.env.ps1`.
    *   Fill in your own `GEMINI_API_KEY` and `ANTHROPIC_API_KEY`.
3.  **Use Commands**:
    *   Launch an autonomous development round: `/auto-hermes`
    *   Launch a parallel max round with merge arbitration: `/auto-hermes-max`
    *   Audit technical debt across the repo: `/auto-hermes-tech-debt`

The workflow state is synchronized via `TASKS.md` (queue) and `CONTEXT_LEDGER.md` (permanent change log). Persona instructions are shared in `AGENTS.md` and `.codex/agents/`.

### Web Routes

| Route | Surface | What it does now |
|---|---|---|
| `/` | Landing | Editorial public homepage with sign-in, sign-up, and Strava start actions |
| `/login` | Login | Email/password login plus Strava and Google OAuth, with verification-aware auth flow |
| `/signup` | Signup | Email/password sign-up plus OAuth entry points and email verification flow |
| `/terms` | Terms | Public legal page |
| `/privacy` | Privacy | Public legal page |
| `/admin` | Admin Login | System administrator sign-in |
| `/dashboard` | Admin Dashboard | Premium admin portal with ops status strip, quick-actions panel, KPI grid, runner management, shoe image verification, job queues, and audit log |
| `/profile` | Runner Hub | Signed-in dashboard with readiness, metrics, records, imports, and links into the rest of the runner shell |
| `/runs` | Run History | Filterable run log with sorting, pagination, previews, and drill-down into run detail |
| `/run` and `/run/:id` | Run Detail | Route map, performance metrics, and route intelligence |
| `/analysis` | Analysis Overview | Quick-glance analytics entrypoint with insight cards and import/empty-state handling |
| `/analysis/vo2max` | VO₂ Max Detail | VO₂ trend drill-down in the shared runner shell |
| `/analysis/:insightKey` | Analysis Insight Detail | Deeper drill-down routes such as injury risk, intensity, coach insight, and load balance |
| `/prediction/:distKey` | Prediction Detail | Distance-specific prediction breakdown with supporting evidence |
| `/heatmap` | Heatmap | Full-screen running heatmap with sampled GPS rendering and live totals |
| `/today-run` | Today Run | Daily coaching surface with readiness, weather, workout blueprint, and shoe guidance |
| `/shoes` | Shoes | Inventory command surface with rotation insight, filters, and scan/import actions |
| `/shoes/add` | Add Shoes | Guided add-shoes flow inside the shared runner shell |
| `/add-shoes` | Redirect | Legacy shortcut redirecting to `/shoes/add` |
| `/shoe-catalog` | Shoe Catalog | Catalog browser within the shoes family |
| `/races` | Race Center | Race planning dashboard with discovery, countdowns, personal-best evidence, and saved-race calendar |
| `/schedule` | Schedule | Weekly planning surface for upcoming training |
| `/muscle-training` | Muscle Training | Anatomical SVG muscle figure, session planning, training log |
| `/rewards` | Rewards | Achievement badges, progression surface |
| `/settings` | Settings | Runner control room for identity, theme, language, units, weekly brief, Strava, Garmin import, and batch file import |

---

### Analysis — Calculations Explained

The Analysis page applies established sports science models. All formulas come from Jack Daniels' *Running Formula* and peer-reviewed physiology research.

#### VDOT (Daniels' VO2max Estimate)

VDOT estimates aerobic fitness from a race performance. Given distance (meters) and time (minutes):

```
velocity     = distance / time                              (m/min)
VO2          = -4.60 + 0.182258 × v + 0.000104 × v²        (ml/kg/min)
%VO2max      = 0.8 + 0.1894393 × e^(-0.012778 × t)
                   + 0.2989558 × e^(-0.1932605 × t)
VDOT         = VO2 / %VO2max
```

The %VO2max curve accounts for the fact that longer efforts use a lower fraction of maximum oxygen uptake.

Hermes also exposes this pipeline explicitly as **estimated VO₂max (ml·kg⁻¹·min⁻¹)** from each run: `VO₂(velocity) = −4.60 + 0.182258·v + 0.000104·v²` with *v* in m/min, then `VO₂max ≈ VO₂(velocity) / %VO₂max(time in minutes)` — the same algebra as headline VDOT, labeled for clarity on the Profile card and charts.

**Headline “current” VDOT in Hermes:** Uses performances from the last **90 days**, **prefers distances ≥3 km** (falls back to ≥1.5 km if you have no longer runs), and takes the **mean of the top three** VDOT values in that pool so one GPS glitch or very short hard segment does not dominate. Scatter charts still plot every qualifying run; the smooth fitness line uses the same **rolling robust** VDOT window.

#### Training Paces (from VDOT)

Each training zone targets a specific %VO2max. The pace for a given fraction is found by reversing the VO2 equation (solving the quadratic):

| Zone | %VO2max | Purpose |
|---|---|---|
| Easy | 54–62% | Aerobic base, recovery |
| Marathon | 78% | Race-specific endurance |
| Threshold | 85% | Lactate clearance at steady state |
| Interval | 96% | VO2max stimulus |
| Repetition | 111% | Speed and running economy |

#### Effort Score

Each run gets a load score based on intensity and duration:

```
intensityRatio = vo2Fraction / 0.85
effortScore    = (duration_hours) × intensityRatio² × 100
```

The 0.85 divisor normalizes to lactate threshold — runs at threshold intensity score 100 per hour.

`vo2Fraction` is derived from either heart rate or pace:

- **From HR:** `vo2Fraction = max(0, 1.67 × (avgHR / HRmax) - 0.67)`
- **From pace:** `vo2Fraction = VO2(pace) / VDOT`, using the Daniels VO2 equation above

#### Training Load — ACWR (Acute:Chronic Workload Ratio)

Tracks injury risk using EWMA (Exponentially Weighted Moving Average):

```
EWMA_today = load_today × λ + (1 - λ) × EWMA_yesterday

Acute  λ = 2 / (7 + 1)  = 0.25      (7-day emphasis)
Chronic λ = 2 / (28 + 1) = 0.069     (28-day emphasis)

ACWR = Acute EWMA / Chronic EWMA
```

| ACWR | Zone | Meaning |
|---|---|---|
| < 0.80 | Under-training | Fitness declining, not enough stimulus |
| 0.80–1.30 | Sweet spot | Optimal loading for adaptation |
| 1.30–1.50 | Warning | Elevated injury risk |
| > 1.50 | Danger | High injury risk — reduce load |

Based on: Gabbett (2016), Hulin et al. (2014), and the EWMA approach by Williams et al. (2017).

#### Training form (42d fitness vs 7d fatigue)

The Analysis page also tracks a **42-day EWMA** of the same per-day effort scores, subtracts the **7-day acute EWMA**, and shows the difference as a simple “form” style signal (similar in spirit to CTL minus short-term fatigue). This **42d series is not** the same as the **28-day chronic** series used in the ACWR denominator.

#### Recovery Estimation

Estimates time to full recovery after each run:

```
durationFactor = (duration > 90 min) ? 1 + 0.005 × (duration - 90) : 1.0
adjustedScore  = effortScore × durationFactor
baseHours      = 0.45 × adjustedScore^0.85
fitnessDiscount = max(0.80, 1.10 - VDOT / 200)
recoveryHours  = min(96, baseHours × fitnessDiscount)
```

Higher VDOT (fitter runner) → faster recovery. Long runs (> 90 min) carry an additional penalty. Maximum recovery is capped at 96 hours.

#### Daniels' Training Zones

Zones classify each run by its VO2 fraction:

| Zone | VO2 Fraction | Label |
|---|---|---|
| Recovery | < 59% | Easy recovery jog |
| Easy | 59–75% | Aerobic base building |
| Marathon | 75–83% | Marathon-pace work |
| Threshold | 83–92% | Tempo / lactate threshold |
| Interval | 92–105% | VO2max intervals |
| Repetition | > 105% | Sprint / economy reps |

---

### Before You Start

#### 1. Install Java 17+

Download from: https://adoptium.net (Temurin 17 LTS recommended)

```powershell
java -version   # should show 17 or higher
```

#### 2. Install Node.js 18+ (for frontend development)

Download from: https://nodejs.org

```powershell
node -v   # should show 18 or higher
```

---

### Quick Start

#### Production (H2, zero setup)

```powershell
.\start_hermes.bat
```

Opens `http://localhost:8080` — the backend serves the pre-built React app.

#### Production (PostgreSQL + OAuth + Admin)

```powershell
.\start_hermes_postgres.ps1
```

`start_hermes_postgres.ps1` is the main launcher for PostgreSQL, OAuth, and admin bootstrapping. It loads local secrets from `Hermes.local.env.ps1`; Stripe billing and email verification are configured separately in the sections below.

#### Frontend Development

```powershell
cd frontend
npm install
npm run dev
```

Dev server runs on `http://localhost:3000` with hot reload. API requests proxy to the backend on `:8080`.

#### Build Frontend for Production

```powershell
cd frontend
npm run build
```

The build writes to `backend/src/main/resources/static/` and, when the backend runtime output exists, syncs the live bundle into `backend/target/classes/static/`.

---

### Configuration — `start_hermes_postgres.ps1`

| Section | Variables | What it controls |
|---|---|---|
| Database | `APP_DB_URL`, `APP_DB_DRIVER`, `APP_DB_USERNAME`, `APP_DB_PASSWORD` | PostgreSQL connection |
| Strava OAuth | `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI`, `APP_DATA_ENCRYPTION_KEY` | Strava login + activity sync |
| Google OAuth | `APP_GOOGLE_CLIENT_ID`, `APP_GOOGLE_CLIENT_SECRET`, `APP_GOOGLE_REDIRECT_URI` | Google login |
| Admin | `APP_BOOTSTRAP_ADMIN_EMAIL`, `APP_BOOTSTRAP_ADMIN_PASSWORD` | Admin account created on startup |

> PowerShell environment variables are session-scoped — the script handles this for you.

#### Stripe billing (optional)

Hermes can sell **Pro** (AI scan quota) through **Stripe Checkout**. Users pay on Stripe’s hosted page; a webhook extends Pro in the database.

1. In [Stripe Dashboard](https://dashboard.stripe.com/), create a **Product** with a **one-time Price** (e.g. one month of Pro — use “customer chooses quantity” or a fixed price; Hermes sends **quantity = number of months** in Checkout).
2. Copy the Price id (`price_...`) into `STRIPE_PRICE_PRO_MONTHLY`.
3. Create an API key (**Developers → API keys**) → `STRIPE_SECRET_KEY`.
4. Add endpoint **Developers → Webhooks** → URL `https://YOUR_DOMAIN/api/billing/webhook`, event `checkout.session.completed`, then copy **Signing secret** → `STRIPE_WEBHOOK_SECRET`.
5. Set **`APP_PUBLIC_BASE_URL`** to the URL users use in the browser (e.g. `https://app.example.com` or `http://localhost:8080`) so Stripe redirects back to `/profile` after payment.
6. Optionally set **`APP_BILLING_PRICE_LABEL`** (e.g. `$9 / month`) for display on the Profile page only.

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Secret API key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret |
| `STRIPE_PRICE_PRO_MONTHLY` | Stripe Price id for one month (quantity = months in cart) |
| `APP_PUBLIC_BASE_URL` | Public site URL for Checkout return links |
| `APP_BILLING_PRICE_LABEL` | Optional UI label for pricing |

Local testing: `stripe listen --forward-to localhost:8080/api/billing/webhook`.

#### Email verification (password sign-up)

Email/password registration sends a **verification link** via SMTP. Until the user opens the link, sign-in returns `EMAIL_NOT_VERIFIED`.

| Variable | Purpose |
|---|---|
| `SPRING_MAIL_HOST` | SMTP server (leave empty on dev to **skip** verification and allow immediate login) |
| `SPRING_MAIL_PORT` | Usually `587` |
| `SPRING_MAIL_USERNAME` / `SPRING_MAIL_PASSWORD` | SMTP credentials |
| `APP_MAIL_FROM` | From address (must be allowed by your provider) |
| `APP_PUBLIC_BASE_URL` | Same as billing — used in the verification link |

Verification link: `GET /api/auth/verify-email?token=…` → redirects to `/login?verified=1`.

#### Public cloud checklist (security)

- **`HERMES_ENV=production`** — If Strava is enabled (`STRAVA_CLIENT_ID` set), Hermes refuses to start until **`STRAVA_WEBHOOK_VERIFY_TOKEN`** is set to a **long random** value (not the default `hermes-strava-webhook`). This reduces trivial spoofing of the Strava subscription handshake.
- **TLS** — Terminate HTTPS in front of the app (nginx, Traefik, cloud LB). Set **`APP_ENABLE_HSTS=true`** only when every user hits the site over HTTPS.
- **Reverse proxy** — `server.forward-headers-strategy=framework` is set so redirects and client IP behave correctly behind `X-Forwarded-*` (still configure your proxy to set these headers).
- **CORS** — If the React app is on another origin, set **`APP_CORS_ALLOWED_ORIGINS`** (comma-separated, e.g. `https://app.example.com`).
- **Database** — Use **PostgreSQL** in production; do not expose the embedded **H2** file DB to the network.
- **Webhooks** — Strava/Garmin push endpoints are **rate-limited per IP**; Garmin **callback URLs** are restricted to **HTTPS `*.garmin.com`** to block SSRF. Stripe billing webhooks rely on **signature verification** (not rate-limited, so retries succeed).
- **Errors** — Default Spring error pages omit stack traces; keep `APP_JPA_DDL_AUTO` off **`update`** for mature deployments if you prefer schema control (e.g. `validate` + migrations).

---

### Database

#### H2 (default)

No setup needed. The database file is created automatically at `backend\hermes_db_v2.mv.db`.

#### PostgreSQL

Install PostgreSQL 15+, create a database named `hermes`, then fill in the credentials in `start_hermes_postgres.ps1` and run it.

```powershell
$env:APP_DB_URL      = "jdbc:postgresql://localhost:5432/hermes"
$env:APP_DB_DRIVER   = "org.postgresql.Driver"
$env:APP_DB_USERNAME = "hermes"
$env:APP_DB_PASSWORD = "<your-postgres-password>"
.\start_hermes.bat
```

#### Migrating H2 to PostgreSQL

```powershell
$env:APP_DB_URL      = "jdbc:postgresql://localhost:5432/hermes"
$env:APP_DB_USERNAME = "hermes"
$env:APP_DB_PASSWORD = "<your-postgres-password>"
.\migrate_h2_to_postgres.bat
```

---

### Login Options

#### Email (no setup)

1. Open `http://localhost:8080`
2. Click **Sign Up**, create an account, sign in

#### Admin

Go to `http://localhost:8080/admin`. The admin account is created on startup from values in `start_hermes_postgres.ps1`.

#### Google

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project, navigate to **APIs & Services > Credentials**
3. Create **OAuth client ID** (Web application)
   - Authorized redirect URI: `http://localhost:8080/api/auth/google/callback`
4. Configure **OAuth consent screen**: add scopes `email`, `profile`, `openid`
5. Copy Client ID and Client Secret into `start_hermes_postgres.ps1`

#### Strava

1. Go to [Strava API Settings](https://www.strava.com/settings/api)
2. Create an app — set Authorization Callback Domain to `localhost`
3. Copy Client ID and Client Secret into `start_hermes_postgres.ps1`
4. Set `APP_DATA_ENCRYPTION_KEY` to a long random string

After Strava OAuth, Hermes imports only running activities. If `APP_DATA_ENCRYPTION_KEY` is missing, Strava login is disabled.

---

### Garmin Connect Import

Import running activities directly from your Garmin Connect account — no manual file export needed. Uses [GarminDB](https://github.com/tcgoetz/GarminDB)'s `garth` authentication library to pull FIT files from Garmin's servers.

#### Setup

Install Python 3.9+ and the required packages:

```bash
pip install -r .tools/requirements-garmin.txt
```

#### Usage

1. Open your **Profile** page in Hermes
2. In **Connected Services**, find the **Garmin Connect** card and click **Import from Garmin**
3. Enter your Garmin Connect email and password
4. Choose the number of recent activities to pull (10–200)
5. Click **Start import** — Hermes downloads FIT files, parses GPS and performance data, and saves running activities

Credentials are used only for the current import session and are **not stored** on the server.

#### How it works

```
Browser  →  POST /api/garmin/connect/import  →  Java backend
         →  Python subprocess (garth SSO login → Garmin Connect API)
         →  Downloads FIT files to temp dir
         →  Java FIT parser extracts GPS, distance, HR, pace
         →  Activities + points saved to DB
         →  Temp files cleaned up
```

Duplicate activities are detected by Garmin activity ID and skipped automatically. Non-running activities are filtered out.

---

### Garmin / COROS File Auto-Import

Supports `GPX`, `TCX`, `FIT`, and `ZIP` files with automatic folder watching.

1. Copy `.tools\hermes_sync_config.example.json` to `.tools\hermes_sync_config.json`
2. Fill in your Hermes email/password
3. Drop exported files into `imports\garmin` or `imports\coros`
4. Start Hermes — processed files are moved to `imports\processed\`

---

### Important

- **Keep the terminal open** while using the app.
- **Restart the backend** after changing any values in `start_hermes_postgres.ps1`.
- **Never commit secrets.** Use environment variables or the startup script.
- **Use a strong `APP_DATA_ENCRYPTION_KEY`** — it protects stored Strava tokens.

---

### Troubleshooting

**`ERR_CONNECTION_REFUSED`** — Start the backend with `.\start_hermes.bat`.

**`java` not found** — Install Java 17 from https://adoptium.net.

**OAuth callback fails** — Check that the backend runs on `localhost:8080` and redirect URIs match exactly.

**Frontend changes not showing** — Run `npm run build` in `frontend/`, then refresh.

---

---

<a id="中文说明"></a>

## 中文说明

Hermes 是一个本地运行的跑步分析平台 — **React** 前端，**Spring Boot** 后端。

支持从 Strava、Garmin Connect、COROS 导入跑步数据，热力图可视化路线，追踪 VDOT 进步，管理跑鞋与赛事，获取丹尼尔斯训练配速。

### 架构

```
frontend/          React 19 + Vite — 开发服务器 :3000，构建输出到后端静态目录
backend/           Spring Boot 4 + JPA — REST API :8080，同时提供前端静态文件
```

### 前端页面

| 路由 | 页面 | 功能 |
|---|---|---|
| `/login` | 登录 | 邮箱/密码、Strava OAuth、Google OAuth |
| `/signup` | 注册 | 注册账号 |
| `/admin` | 管理员登录 | 系统管理员登录 |
| `/dashboard` | 管理面板 | 高级管理门户，含运维状态条、快捷操作面板、KPI 看板、用户管理、跑鞋图片审核、任务队列和审计日志 |
| `/profile` | 个人主页 | 热力图、指标摘要条、周快报卡片、每日步数、个人纪录、VO₂max 趋势、数据导入、Garmin Connect 导入 |
| `/runs` | 跑步历史 | 可筛选列表（全部/年/月/日）、排序控制（最近/最长/最快）、分页、吸附式重置 |
| `/run/:id` | 跑步详情 | 路线地图、运动指标、路线分析 |
| `/analysis` | 深度分析 | 摘要洞察栏、VDOT 评分、VO₂max 术语解释、训练配速、比赛预测、训练负荷（ACWR）、恢复分析 |
| `/today-run` | 今日训练 | 个性化训练计划、教练建议（极化训练）、天气准备度内联展示 |
| `/shoes` | 跑鞋管理 | 健康摘要栏、按品牌筛选、吸附式重置、里程追踪、AI 图片扫描、跑鞋目录 |
| `/races` | 赛事中心 | 交互式世界地图（Leaflet）、60+ 赛事目录、NYRR 9+1 进度、比赛目标、训练建议 |
| `/muscle-training` | 肌肉训练 | 解剖 SVG 肌肉图、训练计划、训练记录 |
| `/rewards` | 成就奖励 | 成就徽章、进阶激励 |
| `/settings` | 设置 | 语言、距离单位、主题、显示名称、已连接服务（Strava）、账户操作 |

---

### 分析页面 — 计算公式说明

分析页面使用经典运动科学模型，所有公式来源于 Jack Daniels《丹尼尔斯跑步方程式》及运动生理学研究文献。

#### VDOT（丹尼尔斯 VO2max 估算）

通过比赛成绩估算有氧能力。给定距离（米）和时间（分钟）：

```
速度 v       = 距离 / 时间                                   (米/分)
VO2          = -4.60 + 0.182258 × v + 0.000104 × v²        (ml/kg/min)
%VO2max      = 0.8 + 0.1894393 × e^(-0.012778 × t)
                   + 0.2989558 × e^(-0.1932605 × t)
VDOT         = VO2 / %VO2max
```

%VO2max 曲线反映了运动持续时间越长，使用的最大摄氧量比例越低。

#### 训练配速（基于 VDOT）

每个训练区间对应特定的 %VO2max，通过反解 VO2 方程（求解二次方程）得到配速：

| 区间 | %VO2max | 目的 |
|---|---|---|
| 轻松跑 | 54–62% | 有氧基础、恢复 |
| 马拉松配速 | 78% | 比赛专项耐力 |
| 乳酸阈值 | 85% | 稳态乳酸清除 |
| 间歇 | 96% | 最大摄氧量刺激 |
| 重复跑 | 111% | 速度与跑步经济性 |

#### 训练负荷评分

每次跑步根据强度和时间计算负荷得分：

```
强度比     = VO2比例 / 0.85
训练负荷   = (持续小时数) × 强度比² × 100
```

0.85 为乳酸阈值标准化基准 — 在阈值强度下每小时得分为 100。

`VO2比例` 通过心率或配速推算：

- **心率法：** `VO2比例 = max(0, 1.67 × (平均心率 / 最大心率) - 0.67)`
- **配速法：** `VO2比例 = VO2(配速) / VDOT`

#### 训练负荷 — ACWR（急性/慢性工作负荷比）

使用 EWMA（指数加权移动平均）追踪伤病风险：

```
EWMA_今天 = 今日负荷 × λ + (1 - λ) × EWMA_昨天

急性 λ = 2 / (7 + 1)  = 0.25      (7天窗口)
慢性 λ = 2 / (28 + 1) = 0.069     (28天窗口)

ACWR = 急性 EWMA / 慢性 EWMA
```

| ACWR | 区间 | 含义 |
|---|---|---|
| < 0.80 | 训练不足 | 体能下降，刺激不够 |
| 0.80–1.30 | 最佳区间 | 适应性最优负荷 |
| 1.30–1.50 | 警告 | 伤病风险升高 |
| > 1.50 | 危险 | 高伤病风险，应减少负荷 |

参考文献：Gabbett (2016), Hulin et al. (2014), Williams et al. (2017) EWMA 方法。

#### 恢复时间估算

估算每次跑步后的完全恢复时间：

```
时长系数      = (时长 > 90分钟) ? 1 + 0.005 × (时长 - 90) : 1.0
调整后得分    = 训练负荷 × 时长系数
基础恢复小时  = 0.45 × 调整后得分^0.85
体能折扣      = max(0.80, 1.10 - VDOT / 200)
恢复小时      = min(96, 基础恢复 × 体能折扣)
```

VDOT 越高（越强）→ 恢复越快。超过 90 分钟的长跑有额外恢复惩罚。最大恢复上限 96 小时。

#### 丹尼尔斯训练区间

根据 VO2 比例将每次跑步分类：

| 区间 | VO2 比例 | 说明 |
|---|---|---|
| 恢复跑 | < 59% | 轻松恢复慢跑 |
| 轻松跑 | 59–75% | 有氧基础构建 |
| 马拉松配速 | 75–83% | 马拉松配速训练 |
| 乳酸阈值 | 83–92% | 节奏跑 / 乳酸阈值 |
| 间歇 | 92–105% | 最大摄氧量间歇 |
| 重复跑 | > 105% | 冲刺 / 经济性训练 |

---

### 快速启动

#### H2（零配置）

```powershell
.\start_hermes.bat
```

#### PostgreSQL + OAuth + 管理员

```powershell
.\start_hermes_postgres.ps1
```

**`start_hermes_postgres.ps1` 是唯一需要编辑的配置文件** — PostgreSQL 密码、Strava API 密钥、Google OAuth 密钥、管理员账号全部在这里配置。

#### 前端开发

```powershell
cd frontend
npm install
npm run dev
```

开发服务器运行在 `http://localhost:3000`，支持热更新。API 请求自动代理到后端 `:8080`。

#### 构建前端

```powershell
cd frontend
npm run build
```

---

### 开始之前

#### 1. 安装 Java 17+

下载地址：https://adoptium.net（推荐 Temurin 17 LTS）

#### 2. 安装 Node.js 18+（前端开发用）

下载地址：https://nodejs.org

---

### 配置 — `start_hermes_postgres.ps1`

| 配置项 | 环境变量 | 说明 |
|---|---|---|
| 数据库 | `APP_DB_URL`, `APP_DB_DRIVER`, `APP_DB_USERNAME`, `APP_DB_PASSWORD` | PostgreSQL 连接信息 |
| Strava | `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI`, `APP_DATA_ENCRYPTION_KEY` | Strava 登录 + 活动同步 |
| Google | `APP_GOOGLE_CLIENT_ID`, `APP_GOOGLE_CLIENT_SECRET`, `APP_GOOGLE_REDIRECT_URI` | Google 登录 |
| 管理员 | `APP_BOOTSTRAP_ADMIN_EMAIL`, `APP_BOOTSTRAP_ADMIN_PASSWORD` | 启动时自动创建管理员 |

#### Stripe 收款（可选）

可通过 **Stripe Checkout** 售卖 **Pro**（AI 扫描额度）。用户在 Stripe 托管页付款；Webhook 在数据库中延长 Pro。

1. 在 [Stripe 控制台](https://dashboard.stripe.com/) 创建 **产品** 与 **一次性 Price**（单价对应「1 个月」；结账时 Hermes 会把 **数量** 设为购买月数）。
2. 将 Price id（`price_...`）写入 `STRIPE_PRICE_PRO_MONTHLY`。
3. **开发者 → API 密钥** → `STRIPE_SECRET_KEY`。
4. **开发者 → Webhook** → 地址 `https://你的域名/api/billing/webhook`，事件勾选 `checkout.session.completed`，复制签名密钥 → `STRIPE_WEBHOOK_SECRET`。
5. 设置 **`APP_PUBLIC_BASE_URL`** 为用户实际访问的站点根 URL（生产示例：`https://app.example.com`），以便支付完成后跳回 `/profile`。
6. 可选：`APP_BILLING_PRICE_LABEL`（如 `¥39/月`）仅在个人主页展示。

| 环境变量 | 说明 |
|---|---|
| `STRIPE_SECRET_KEY` | 密钥 |
| `STRIPE_WEBHOOK_SECRET` | Webhook 签名密钥 |
| `STRIPE_PRICE_PRO_MONTHLY` | 单价对应 1 个月的 Price id |
| `APP_PUBLIC_BASE_URL` | 公网访问的根 URL |
| `APP_BILLING_PRICE_LABEL` | 可选的界面标价文案 |

本地调试：`stripe listen --forward-to localhost:8080/api/billing/webhook`。

#### 邮箱验证（密码注册）

使用邮箱+密码注册时，系统会发送**验证链接**。未完成验证前登录会返回 `EMAIL_NOT_VERIFIED`。

| 环境变量 | 说明 |
|---|---|
| `SPRING_MAIL_HOST` | SMTP 服务器（开发环境可留空，将**跳过**验证、注册后直接可登录） |
| `SPRING_MAIL_PORT` | 一般为 `587` |
| `SPRING_MAIL_USERNAME` / `SPRING_MAIL_PASSWORD` | SMTP 账号 |
| `APP_MAIL_FROM` | 发件人（需与邮服策略一致） |
| `APP_PUBLIC_BASE_URL` | 与收款配置相同，用于邮件内链接 |

验证地址：`GET /api/auth/verify-email?token=…`，成功后跳转到 `/login?verified=1`。

#### 公网部署（安全）

- **`HERMES_ENV=production`** — 若启用 Strava（已配置 `STRAVA_CLIENT_ID`），必须使用 **随机长串** 作为 **`STRAVA_WEBHOOK_VERIFY_TOKEN`**，不能使用默认的 `hermes-strava-webhook`，否则进程会拒绝启动。
- **HTTPS** — 在反向代理或负载均衡上终结 TLS；仅当全站长期走 HTTPS 时再将 **`APP_ENABLE_HSTS`** 设为 `true`。
- **反向代理** — 已启用 `forward-headers` 策略，请让代理传入正确的 **`X-Forwarded-*`**。
- **跨域** — 若前端与 API 不同域，设置 **`APP_CORS_ALLOWED_ORIGINS`**（逗号分隔）。
- **数据库** — 生产环境用 **PostgreSQL**；勿把 **H2** 暴露到公网。
- **Webhook** — Strava/Garmin 推送按 **IP 限速**；Garmin 的 **callbackURL** 仅允许 **HTTPS 且 `*.garmin.com`**，降低 SSRF 风险；Stripe 依赖 **签名**，不限速以免重试失败。
- **建表** — 成熟环境可将 **`APP_JPA_DDL_AUTO`** 从 `update` 改为 `validate` 并配合迁移工具管理表结构。

---

### 数据库

#### H2（默认）

无需配置，数据库文件自动生成在 `backend\hermes_db_v2.mv.db`。

#### PostgreSQL

安装 PostgreSQL 15+，创建 `hermes` 数据库，然后在 `start_hermes_postgres.ps1` 中填入凭据并运行。

#### H2 迁移到 PostgreSQL

```powershell
$env:APP_DB_URL      = "jdbc:postgresql://localhost:5432/hermes"
$env:APP_DB_USERNAME = "hermes"
$env:APP_DB_PASSWORD = "<你的密码>"
.\migrate_h2_to_postgres.bat
```

---

### 登录方式

| 登录方式 | 配置 |
|---|---|
| 邮箱 | 无需配置 |
| 管理员 | 在 `start_hermes_postgres.ps1` 中设置账号密码 |
| Google | Google Cloud OAuth 应用 + `start_hermes_postgres.ps1` 中填入密钥 |
| Strava | Strava 开发者应用 + `start_hermes_postgres.ps1` 中填入密钥 |

---

### Garmin Connect 账号导入

直接从 Garmin Connect 账号拉取跑步活动 — 无需手动导出文件。使用 [GarminDB](https://github.com/tcgoetz/GarminDB) 的 `garth` 认证库通过 Garmin SSO 登录并下载 FIT 文件。

#### 安装

安装 Python 3.9+ 和所需依赖：

```bash
pip install -r .tools/requirements-garmin.txt
```

#### 使用方法

1. 打开 Hermes **个人主页**
2. 在「数据连接」中找到 **Garmin Connect** 卡片，点击「从 Garmin 导入」
3. 输入 Garmin Connect 邮箱和密码
4. 选择要拉取的最近活动数量（10–200）
5. 点击「开始导入」 — Hermes 会下载 FIT 文件、解析 GPS 和运动数据、保存跑步活动

凭据仅用于当前导入会话，**不会存储**在服务器上。重复活动会按 Garmin 活动 ID 自动跳过，非跑步活动会被过滤。

---

### Garmin / COROS 文件自动导入

支持 `GPX`、`TCX`、`FIT`、`ZIP` 文件，自动监控文件夹。

1. 复制 `.tools\hermes_sync_config.example.json` 为 `.tools\hermes_sync_config.json`
2. 填写 Hermes 邮箱/密码
3. 将文件放入 `imports\garmin` 或 `imports\coros`
4. 启动 Hermes — 处理后的文件移入 `imports\processed\`

---

### 注意事项

- **保持终端窗口打开**，关闭则后端停止。
- **修改配置后需重启后端**。
- **不要把密钥提交到 Git**。
- **`APP_DATA_ENCRYPTION_KEY` 请使用强密钥**。

---

### 常见问题

**`ERR_CONNECTION_REFUSED`** — 运行 `.\start_hermes.bat` 启动后端。

**`java` 找不到** — 前往 https://adoptium.net 安装 Java 17。

**OAuth 回调失败** — 确认后端运行在 `localhost:8080`，回调地址完全匹配。

**前端修改未生效** — 在 `frontend/` 中运行 `npm run build`，然后刷新页面。

---

### Regression Checklist — Page-Break and Data-Loss Scenarios

Run this manually after any change to auth, import, upload, or third-party integration flows.

#### 1. Expired session during active use

**Trigger**: In browser DevTools (Network tab), block or stub any API call to return `401` while on a page with edits in progress (e.g. open the import modal in Settings, then force a `401` on the batch endpoint).

**Expected behavior**:
- App redirects to `/login?return=<current-path>&reason=expired`
- Login page shows the "session expired" notice (not a blank page)
- After re-login, app navigates back to the original route

**Failure indicator**: Blank page, hard redirect to `/login` with no notice, or loss of the return path.

#### 2. Partial batch import (one valid + one invalid file)

**Trigger**: Upload a valid `.gpx` file and an oversized or zero-byte file in the same import batch.

**Expected behavior**:
- Response returns `200` with `importedActivities >= 1` and `rejectedFiles` listing the bad file with a reason
- Settings import modal stays open and shows "X file(s) were skipped" with the rejected filenames
- Modal does NOT close as if everything succeeded

**Failure indicator**: Modal closes after any `200`, or rejected files silently disappear.

#### 3. Weather provider outage

**Trigger**: Block the `api.open-meteo.com` fetch (via DevTools or host-file block) and open any page with the weather bar.

**Expected behavior**:
- Weather bar shows the error/empty state (e.g. "Weather unavailable") rather than a blank area
- The rest of the page loads and functions normally

**Failure indicator**: Blank strip, JS error in console causing page crash, or infinite loading spinner.

#### 4. Malformed analytics response

**Trigger**: Stub `GET /api/activities/{id}/analytics` to return `500` or invalid JSON, then open a Run Detail page.

**Expected behavior**:
- Run Detail page renders (hero, map, performance metrics visible)
- An inline error card appears above the analytics sections with a "Reload" action
- No blank white sections, no uncaught JS exceptions

**Failure indicator**: Blank analytics panels with no explanation, or a white-screen crash.

#### 5. Batch file count cap

**Trigger**: Submit more than 50 files in a single import batch request.

**Expected behavior**:
- Backend returns `400` with a JSON body containing `error` explaining the limit
- Frontend shows the error in the import modal without closing it

**Failure indicator**: Server accepts the request, or frontend shows a generic "Import failed" without the limit explanation.
