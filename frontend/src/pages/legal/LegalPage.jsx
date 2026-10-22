import { useMemo } from 'react';
import { NavLink } from 'react-router';
import HermesLogo from '../../components/HermesLogo';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/i18nContextState';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../../utils/supportContact';
import './legal-document.css';

const LEGAL_COPY = {
  en: {
    terms: {
      eyebrow: 'HermesRuns legal',
      title: 'Terms of Service',
      intro: 'These Terms govern your access to HermesRuns, including training insights, workout planning, account features, and connected activity imports.',
      sections: [
        {
          heading: 'Using HermesRuns responsibly',
          body: 'You may use HermesRuns only for lawful personal or internal coaching purposes. You agree not to misuse the service, interfere with platform operations, scrape private data, or attempt unauthorized access to other accounts or admin tools.',
        },
        {
          heading: 'Accounts and connected data',
          body: 'You are responsible for the accuracy of the information you provide and for maintaining the security of your login credentials. When you connect services such as Strava or upload workout files, you confirm that you have the right to share that data with HermesRuns.',
        },
        {
          heading: 'Training guidance disclaimer',
          body: 'HermesRuns provides informational coaching support, readiness estimates, analytics, and planning suggestions. It is not medical advice, diagnosis, or emergency guidance. You remain responsible for listening to your body and speaking with a qualified professional when symptoms, injuries, or health concerns arise.',
        },
        {
          heading: 'Routes and outdoor safety',
          body: 'Suggested routes, maps, weather, elevation, and training targets may be incomplete or out of date. A suggested route does not guarantee public access, a suitable surface, or safe traffic and weather conditions. Check local conditions, access restrictions, and your own ability before setting out, and adjust or stop your activity when needed.',
        },
        {
          heading: 'Coaches, teams, and messages',
          body: 'You are responsible for the messages, workouts, and other content you share, and for having permission to share information about other people. Do not post abusive, unlawful, or infringing content. Review access requests and team sharing permissions before granting them. Advice from another user is that user’s contribution and should be assessed against your circumstances; it is not a substitute for qualified medical advice.',
        },
        {
          heading: 'Connected and third-party services',
          body: 'Connected services, map and weather providers, and AI-assisted features depend on third parties and may change or become unavailable. Their own terms and privacy policies may apply when you use their services. Imports, shoe recognition, and other automated results can contain errors; review them before relying on them. Disconnecting an integration or deleting your HermesRuns account does not delete your account with the external provider.',
        },
        {
          heading: 'Service availability',
          body: 'We may update, improve, pause, or remove features when needed for reliability, safety, or product evolution. We try to keep HermesRuns available, but uninterrupted access, perfect synchronization, and error-free analytics cannot be guaranteed at all times.',
        },
        {
          heading: 'Content and ownership',
          body: 'HermesRuns retains ownership of the software, design system, and platform content. You retain ownership of your training data and personal content, while granting HermesRuns the limited rights needed to store, process, and display that information inside the service.',
        },
        {
          heading: 'Termination',
          body: `We may suspend or terminate accounts that violate these Terms, threaten platform security, or abuse the service. You may stop using HermesRuns at any time. Questions about these Terms can be sent to ${SUPPORT_EMAIL}.`,
        },
      ],
      updated: 'Last updated: October 17, 2026',
    },
    privacy: {
      eyebrow: 'HermesRuns legal',
      title: 'Privacy Policy',
      intro: 'This Privacy Policy explains what HermesRuns collects, how it uses that information, and the choices you have when you use the product.',
      sections: [
        {
          heading: 'What we collect',
          body: 'HermesRuns collects the account details you provide, such as your name, email address, and preferences, and data from services you connect or files you upload. This can include activities, GPS routes, pace, heart rate, training plans, shoes, zones, and effort ratings. If you enable Garmin wellness imports, it can also include sleep stages and scores, heart-rate variability (HRV), stress, blood oxygen, respiration, and other available wellness measurements. We also process messages, team memberships, coaching relationships, and sharing permissions. The weather page uses your device’s location if you permit it. If you save Garmin Connect credentials, we store your Garmin email address and an encrypted copy of your Garmin password to support imports.',
        },
        {
          heading: 'How we use data',
          body: 'We use your information to authenticate your account, sync activities and optional wellness data, generate training insights and planning suggestions, personalize dashboards, and provide messaging, team, and coaching features. We also use it to improve product reliability, investigate issues, protect the service, and communicate essential account or service updates. Automated estimates and recommendations are informational and can be inaccurate.',
        },
        {
          heading: 'How data is shared',
          body: 'HermesRuns does not sell your personal data. We share information with providers that help operate the product, with other users through the sharing and messaging features you use, and where needed for legal compliance, security, or fraud prevention. Messages and shared workouts are visible to authorized conversation recipients. Your name, role, and membership may be visible to other team members or staff according to the team’s settings.',
        },
        {
          heading: 'Coach and team access',
          body: 'Direct access to your training data depends on the relationships you approve. Team access to athlete data requires a separate sharing permission; joining or administering a team alone does not grant access to that data. Access may be read-only or include coaching actions, with additional wellness fields limited by the permissions you grant. You can review and revoke direct access and team sharing permissions in the coaching and team controls. If someone has access through more than one relationship or team, each applicable permission needs to be revoked to end their access. Revoking access prevents further access through that permission; it cannot recall information a recipient has already seen or copied.',
        },
        {
          heading: 'Who processes your data',
          body: 'Railway hosts the app and its PostgreSQL database. Cloudflare provides DNS and web proxying for hermesruns.com and routes incoming support email. Resend sends account emails, such as verification and password reset, using the verified mail.hermesruns.com domain. Google sign-in, Google reCAPTCHA, and Strava connections are configured in production. Google processes information needed for the sign-in and anti-abuse features you use; Strava exchanges activity and connection data with HermesRuns when you connect your account.',
        },
        {
          heading: 'Hosting and processing locations',
          body: 'The production app and its PostgreSQL database are hosted on Railway in California, United States (us-west2). Resend sends account email from Northern Virginia, United States (us-east-1), and stores email data in the United States. Its sending region does not determine where email data is stored. External services have their own processing arrangements; the locations listed here do not guarantee that all processing by every provider remains in the United States.',
        },
        {
          heading: 'Maps, weather, and optional imports',
          body: 'When you use weather and elevation features, Open-Meteo and the US National Weather Service receive location and, where needed, activity time to provide weather information; Open-Meteo services also provide elevation. Route planning sends a location and search radius to OpenStreetMap Overpass services, including maps.mail.ru and overpass-api.de. Your browser loads map tiles from OpenStreetMap and training videos from YouTube in its privacy-enhanced mode; direct requests to external services expose connection information such as your IP address. If you choose Garmin Connect imports, HermesRuns exchanges data with Garmin to import activities and any wellness data you enable. These optional imports depend on your account connection and choices.',
        },
        {
          heading: 'AI and payment availability',
          body: 'AI shoe scanning, AI shoe-name normalization, and Stripe payments are not enabled in the current production configuration. Google Gemini, Anthropic Claude, Letta, and Stripe are not active providers for these features. If these features are introduced, we will update this policy to explain the providers and information involved.',
        },
        {
          heading: 'Retention and security',
          body: 'We keep data only as long as reasonably necessary to operate HermesRuns, satisfy legal obligations, resolve disputes, and protect the service. We use practical administrative and technical safeguards, but no storage or transmission method can be guaranteed to be perfectly secure.',
        },
        {
          heading: 'Your choices',
          body: `In Settings, Account, you can download the data available through the export tool, with or without GPS tracks, or request account deletion. The export includes account details, runs, shoes, saved races, and supported training-plan and workspace records. It is not a complete copy of every data category: wellness series such as sleep, HRV, and stress, and muscle-training logs are not currently included. Disconnecting Strava deletes runs imported from Strava while keeping runs imported from your own files. You can disable Garmin wellness sync separately; disabling sync does not itself delete previously imported data. Account deletion removes your account and associated records from the app’s active data stores, but does not delete accounts you hold with external providers or copies already obtained by other users. For data not covered by the export tool, corrections, or other privacy requests, contact ${SUPPORT_EMAIL}. Depending on where you live, you may have additional rights concerning your data.`,
        },
        {
          heading: 'Cookies and local storage',
          body: 'HermesRuns uses browser local storage and session storage for sign-in, preferences, and functional caches, including profile and activity information and training plans. Some cached information can remain on your device between visits. You can clear it through your browser’s site-data controls; this may sign you out and remove saved preferences or offline data. HermesRuns sets no advertising or analytics cookies. Google reCAPTCHA on the sign-up page may set its own cookies, and external services you choose to use operate under their own privacy policies.',
        },
        {
          heading: 'Policy updates',
          body: 'If this Privacy Policy changes materially, HermesRuns may update the effective date and surface the revised version through the product or related account channels so you can review the latest terms.',
        },
      ],
      updated: 'Last updated: October 17, 2026',
    },
    backHome: 'Back to HermesRuns',
    backApp: 'Back to profile',
    sectionsLabel: 'sections',
    signoff: 'Do you run today?',
  },
  zh: {
    terms: {
      eyebrow: 'HermesRuns 法务说明',
      title: '服务条款',
      intro: '本条款适用于你访问和使用 HermesRuns 的方式，包括训练洞察、训练安排、账户功能，以及连接导入的跑步数据。',
      sections: [
        {
          heading: '合理使用 HermesRuns',
          body: '你只能将 HermesRuns 用于合法的个人训练或内部教练用途，不得滥用服务、干扰平台运行、抓取他人私有数据，或尝试未授权访问其他账户与管理工具。',
        },
        {
          heading: '账户与连接数据',
          body: '你需要对自己提供的信息准确性和登录凭据安全负责。当你连接 Strava 等服务或上传训练文件时，代表你确认自己有权将这些数据提供给 HermesRuns。',
        },
        {
          heading: '训练建议免责声明',
          body: 'HermesRuns 提供的是信息型训练辅助、状态评估、分析结果与计划建议，并不构成医疗建议、诊断或紧急指导。出现伤病、异常症状或健康疑虑时，你仍应优先依据自身状态并咨询合格专业人士。',
        },
        {
          heading: '路线与户外安全',
          body: '推荐路线、地图、天气、海拔及训练目标可能不完整或未及时更新。推荐路线并不保证道路可公开通行、路面适宜，或交通与天气条件安全。出发前请核实当地情况、通行限制和自身能力，并在需要时调整或停止活动。',
        },
        {
          heading: '教练、团队与消息',
          body: '你需要对自己分享的消息、训练及其他内容负责，并确保有权分享涉及他人的信息。请勿发布辱骂性、违法或侵权内容。批准前请仔细查看访问请求及团队共享权限。其他用户提供的建议属于该用户的内容，你应结合自身情况判断其适用性；这些建议不能替代合格专业人士的医疗建议。',
        },
        {
          heading: '连接服务与第三方服务',
          body: '连接服务、地图与天气服务，以及 AI 辅助功能依赖第三方，可能发生变更或无法使用。使用第三方服务时，其自身条款和隐私政策也可能适用。导入数据、鞋子识别及其他自动化结果可能出错，请在依赖这些结果前核对。断开连接或删除 HermesRuns 账户不会删除你在外部服务商处的账户。',
        },
        {
          heading: '服务可用性',
          body: '为保证可靠性、安全性或产品演进，我们可能会更新、调整、暂停或移除部分功能。HermesRuns 会尽力保持可用，但无法保证服务始终不中断，也无法保证同步与分析在任何时候都完全无误。',
        },
        {
          heading: '内容与所有权',
          body: 'HermesRuns 保留软件、设计系统与平台内容的所有权。你的训练数据和个人内容仍归你所有，但你授予 HermesRuns 在服务内存储、处理和展示这些内容所需的有限权利。',
        },
        {
          heading: '终止与联系',
          body: `如果账户违反本条款、威胁平台安全或滥用服务，我们可以暂停或终止访问。你也可以随时停止使用 HermesRuns。如对本条款有疑问，可联系 ${SUPPORT_EMAIL}。`,
        },
      ],
      updated: '最后更新：2026 年 10 月 17 日',
    },
    privacy: {
      eyebrow: 'HermesRuns 法务说明',
      title: '隐私政策',
      intro: '本隐私政策说明 HermesRuns 会收集哪些信息、如何使用这些信息，以及你在使用产品时拥有的选择权。',
      sections: [
        {
          heading: '我们收集的信息',
          body: 'HermesRuns 会收集你提供的账户资料，例如姓名、邮箱和偏好设置，以及来自你连接的服务或上传文件的数据。这些数据可能包括活动记录、GPS 路线、配速、心率、训练计划、跑鞋、区间及自觉强度。如果你启用 Garmin 健康数据导入，还可能包括睡眠阶段与评分、心率变异性（HRV）、压力、血氧、呼吸及其他可用的健康指标。我们也会处理消息、团队成员关系、教练关系及共享权限。天气页会在你允许时使用设备位置。如果你保存 Garmin Connect 登录凭据，我们会保存你的 Garmin 邮箱地址，以及加密的 Garmin 密码，以支持数据导入。',
        },
        {
          heading: '数据的使用方式',
          body: '这些信息用于账户登录验证、同步活动与可选健康数据、生成训练洞察与计划建议、个性化页面展示，以及提供消息、团队和教练功能。我们也会用这些信息提升产品稳定性、排查故障、保护服务，并发送必要的账户或服务通知。自动化评估和建议仅供参考，可能存在误差。',
        },
        {
          heading: '数据共享方式',
          body: 'HermesRuns 不会出售你的个人数据。我们会与协助运营产品的服务商共享信息，通过你使用的共享及消息功能与其他用户共享信息，以及在法律合规、安全防护或反欺诈需要时共享信息。消息和共享训练对有权访问该会话的接收者可见。根据团队设置，你的姓名、角色及成员关系可能对其他成员或团队管理人员可见。',
        },
        {
          heading: '教练与团队访问权限',
          body: '其他人对你训练数据的直接访问取决于你批准的关系。团队访问运动员数据需要单独的共享授权；仅加入或管理团队并不代表可以访问这些数据。权限可以是只读，也可以包含教练操作；额外健康字段的访问范围取决于你的授权。你可以在教练及团队相关控制中查看并撤销直接访问和团队共享权限。如果同一个人通过多个关系或团队获得访问权限，需要撤销所有适用授权才能结束其访问。撤销权限会阻止通过该授权继续访问，但无法收回接收者已经看过或复制的信息。',
        },
        {
          heading: '谁会处理你的数据',
          body: 'Railway 托管应用及其 PostgreSQL 数据库。Cloudflare 为 hermesruns.com 提供 DNS 和网页代理，并路由发往客服邮箱的来信。Resend 使用已验证的 mail.hermesruns.com 域名发送账户邮件，例如验证邮件和重置密码邮件。生产环境已配置 Google 登录、Google reCAPTCHA 及 Strava 连接。Google 会处理你使用的登录与防滥用功能所需的信息；当你连接 Strava 账户时，Strava 会与 HermesRuns 交换活动及连接数据。',
        },
        {
          heading: '托管与数据处理地点',
          body: '生产环境的应用及其 PostgreSQL 数据库托管在 Railway 的美国加利福尼亚州区域（us-west2）。Resend 从美国北弗吉尼亚区域（us-east-1）发送账户邮件，并在美国存储邮件数据。发信区域不决定邮件数据的存储地点。外部服务有各自的数据处理安排；此处列出的地点并不保证所有服务商的全部处理都在美国境内进行。',
        },
        {
          heading: '地图、天气与可选导入',
          body: '当你使用天气和海拔功能时，Open-Meteo 和美国国家气象局会收到位置，并在需要时收到活动时间，以提供天气信息；Open-Meteo 服务也提供海拔数据。路线规划会将位置与搜索半径发送至 OpenStreetMap Overpass 服务，包括 maps.mail.ru 和 overpass-api.de。你的浏览器会从 OpenStreetMap 加载地图，并以隐私增强模式从 YouTube 加载训练视频；直接向外部服务发起请求会向其提供 IP 地址等连接信息。如果你选择使用 Garmin Connect 导入，HermesRuns 会与 Garmin 交换数据，以导入活动及你启用的健康数据。这些可选导入取决于你的账户连接和选择。',
        },
        {
          heading: 'AI 与付款功能状态',
          body: '当前生产配置未启用 AI 鞋子识别、AI 跑鞋名称标准化或 Stripe 付款。Google Gemini、Anthropic Claude、Letta 和 Stripe 目前并未为这些功能提供处理服务。如果今后推出这些功能，我们会更新本政策，说明涉及的服务商及信息。',
        },
        {
          heading: '保存期限与安全',
          body: '我们仅在为运行 HermesRuns、履行法律义务、处理争议和保护服务所合理需要的期限内保留数据。我们会采取实际可行的管理和技术措施，但任何存储或传输方式都无法保证绝对安全。',
        },
        {
          heading: '你的权利与选择',
          body: `你可以在“设置 → 账户”中下载导出工具所支持的数据（可选含 GPS 轨迹），或申请删除账户。导出内容包括账户资料、跑步记录、跑鞋、已保存的赛事，以及受支持的训练计划和工作区记录。这并非所有数据类别的完整副本：睡眠、HRV、压力等健康时间序列及肌肉训练日志目前不在导出范围内。断开 Strava 会删除从 Strava 导入的跑步记录，并保留从你自己的文件导入的记录。你可以单独关闭 Garmin 健康数据同步；关闭同步本身不会删除之前导入的数据。删除账户会移除应用当前数据存储中的账户及关联记录，但不会删除你在外部服务商处的账户，也无法收回其他用户已获得的副本。如需导出工具未覆盖的数据、更正信息或提出其他隐私请求，请联系 ${SUPPORT_EMAIL}。根据你所在地区，你可能还拥有其他有关个人数据的权利。`,
        },
        {
          heading: '浏览器存储与 Cookie',
          body: 'HermesRuns 使用浏览器本地存储和会话存储来维持登录、保存偏好及功能缓存，包括个人主页与活动信息和训练计划。部分缓存可能在多次访问之间保留在你的设备上。你可以通过浏览器的网站数据设置清除这些信息；这可能会使你退出登录，并移除已保存的偏好或离线数据。HermesRuns 不设置广告或分析 Cookie。注册页上的 Google reCAPTCHA 可能会设置它自己的 Cookie，你选择使用的外部服务也有各自的隐私政策。',
        },
        {
          heading: '政策更新',
          body: '如果本隐私政策发生重要变更，HermesRuns 可能会更新生效日期，并通过产品内入口或相关账户渠道展示最新版内容，方便你查看最新说明。',
        },
      ],
      updated: '最后更新：2026 年 10 月 17 日',
    },
    backHome: '返回 HermesRuns',
    backApp: '返回个人主页',
    sectionsLabel: '小节',
    signoff: '今天，你跑步了吗？',
  },
};

function renderLegalBody(body) {
  const [beforeSupport, afterSupport] = String(body).split(SUPPORT_EMAIL);
  if (afterSupport === undefined) return body;

  return (
    <>
      {beforeSupport}
      <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>
      {afterSupport}
    </>
  );
}

export default function LegalPage({ variant = 'terms' }) {
  const { isAuthenticated } = useAuth();
  const { lang, t } = useI18n();

  const dictionary = lang === 'zh-CN' ? LEGAL_COPY.zh : LEGAL_COPY.en;
  const page = useMemo(() => dictionary[variant] || dictionary.terms, [dictionary, variant]);
  return (
    <div className="legal-document">
      <header className="legal-document-header">
        <NavLink className="legal-document-back" to={isAuthenticated ? '/profile' : '/'} reloadDocument={isAuthenticated}>
          <span aria-hidden="true">←</span>
          {isAuthenticated ? dictionary.backApp : dictionary.backHome}
        </NavLink>
        <HermesLogo showIcon={false} />
      </header>

      <main className="legal-document-main" aria-labelledby="legal-document-title">
        <h1 id="legal-document-title">{page.title}</h1>
        <p className="legal-document-updated">{page.updated}</p>
        <p className="legal-document-intro">{page.intro}</p>
        {page.sections.map((section, index) => (
          <section className="legal-document-section" key={section.heading} aria-labelledby={`${variant}-${index + 1}`}>
            <h2 id={`${variant}-${index + 1}`}>{section.heading}</h2>
            <p>{renderLegalBody(section.body)}</p>
          </section>
        ))}
      </main>

      <footer className="legal-document-footer">
        <p className="legal-document-signoff">{dictionary.signoff}</p>
        <nav aria-label={page.eyebrow}>
          <NavLink to="/terms">{t('landing.stitch_footer_terms')}</NavLink>
          <NavLink to="/privacy">{t('landing.stitch_footer_privacy')}</NavLink>
          <a href={SUPPORT_MAILTO}>{t('landing.stitch_footer_support')}</a>
        </nav>
      </footer>
    </div>
  );
}
