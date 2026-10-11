import { createElement, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Database, FileCheck2, LockKeyhole, ShieldCheck } from 'lucide-react';
import AppIcon from '../../components/AppIcon';
import AuthDotField from '../../components/AuthDotField';
import FooterNavLinks from '../../components/FooterNavLinks';
import HermesLogo from '../../components/HermesLogo';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../../utils/supportContact';

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
      updated: 'Last updated: April 11, 2026',
    },
    privacy: {
      eyebrow: 'HermesRuns legal',
      title: 'Privacy Policy',
      intro: 'This Privacy Policy explains what HermesRuns collects, how it uses that information, and the choices you have when you use the product.',
      sections: [
        {
          heading: 'What we collect',
          body: 'HermesRuns may collect account details such as your name, email address, language preferences, connected-provider identifiers, and the training data you sync or upload, including activities, routes, pace, heart-rate, and related performance metrics. It also collects the shoe photos you choose to scan, the zones and effort ratings you set, your device’s location if you allow it on the weather page, and, if you connect Garmin Connect, your Garmin sign-in details, stored encrypted, to import your data.',
        },
        {
          heading: 'How we use data',
          body: 'We use your information to authenticate your account, sync activities, generate coaching insights, personalize dashboards, improve product reliability, investigate issues, and communicate essential account or service updates.',
        },
        {
          heading: 'How data is shared',
          body: 'HermesRuns does not sell your personal data. Information may be shared only with service providers or infrastructure partners that help operate the product, or when disclosure is required for legal compliance, security, or fraud prevention.',
        },
        {
          heading: 'Who processes your data',
          body: 'Railway hosts the app and its database. Cloudflare carries all traffic to hermesruns.com and forwards mail sent to our support address. Resend sends account emails, such as verification and password reset, to your email address. Google provides Sign in with Google, reCAPTCHA on the sign-up page, and the Gemini API, which receives a shoe photo when you choose to scan one. Open-Meteo and the US National Weather Service receive the location and time of your runs, or your device’s location when you open the weather page, and return weather and elevation. Your browser loads map tiles from OpenStreetMap and training videos from YouTube in its privacy-enhanced mode. When you connect Strava or Garmin Connect, HermesRuns exchanges data with them to import your activities. When the optional Supporter plan opens, Stripe will process payments; HermesRuns never sees your card details.',
        },
        {
          heading: 'Retention and security',
          body: 'We keep data only as long as reasonably necessary to operate HermesRuns, satisfy legal obligations, resolve disputes, and protect the service. We use practical administrative and technical safeguards, but no storage or transmission method can be guaranteed to be perfectly secure.',
        },
        {
          heading: 'Your choices',
          body: `You can export all of your data, with or without GPS tracks, or delete your account at any time in Settings, Account. Disconnecting Strava deletes the runs synced from Strava. For anything else, write to ${SUPPORT_EMAIL}. Depending on where you live, you may also have the right to access or correct your data.`,
        },
        {
          heading: 'Cookies and local storage',
          body: 'HermesRuns keeps you signed in with a token in your browser’s local storage and sets no advertising or analytics cookies. Google reCAPTCHA on the sign-up page may set its own cookies.',
        },
        {
          heading: 'Policy updates',
          body: 'If this Privacy Policy changes materially, HermesRuns may update the effective date and surface the revised version through the product or related account channels so you can review the latest terms.',
        },
      ],
      updated: 'Last updated: October 10, 2026',
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
      updated: '最后更新：2026 年 4 月 11 日',
    },
    privacy: {
      eyebrow: 'HermesRuns 法务说明',
      title: '隐私政策',
      intro: '本隐私政策说明 HermesRuns 会收集哪些信息、如何使用这些信息，以及你在使用产品时拥有的选择权。',
      sections: [
        {
          heading: '我们收集的信息',
          body: 'HermesRuns 可能收集账户资料，例如姓名、邮箱、语言偏好、第三方连接标识，以及你同步或上传的训练数据，包括活动记录、路线、配速、心率和相关表现指标。此外还包括你选择识别的鞋子照片、你设定的区间和自觉强度、你在天气页允许时设备的位置；如果你连接 Garmin Connect，还有加密保存的 Garmin 登录信息，用于导入你的数据。',
        },
        {
          heading: '数据的使用方式',
          body: '这些信息用于账户登录验证、活动同步、生成教练洞察、个性化页面展示、提升产品稳定性、排查故障，以及发送必要的账户或服务通知。',
        },
        {
          heading: '数据共享方式',
          body: 'HermesRuns 不会出售你的个人数据。只有在运营产品所需的服务提供商协助、或出于法律合规、安全防护、反欺诈等必要场景下，相关信息才可能被共享。',
        },
        {
          heading: '谁会处理你的数据',
          body: 'Railway 托管应用和数据库。Cloudflare 承载访问 hermesruns.com 的全部流量，并转发发到客服邮箱的邮件。Resend 向你的邮箱发送账户邮件，例如验证邮件和重置密码邮件。Google 提供“使用 Google 登录”、注册页上的 reCAPTCHA，以及 Gemini API：当你选择识别鞋子照片时，它会收到这张照片。Open-Meteo 和美国国家气象局会收到你跑步的位置和时间，或你打开天气页时设备的位置，并返回天气和海拔数据。你的浏览器会从 OpenStreetMap 加载地图，并以隐私增强模式从 YouTube 加载训练视频。当你连接 Strava 或 Garmin Connect 时，HermesRuns 会与它们交换数据，以导入你的活动。可选的支持者方案开放后，将由 Stripe 处理付款，HermesRuns 不会看到你的银行卡信息。',
        },
        {
          heading: '保存期限与安全',
          body: '我们仅在为运行 HermesRuns、履行法律义务、处理争议和保护服务所合理需要的期限内保留数据。我们会采取实际可行的管理和技术措施，但任何存储或传输方式都无法保证绝对安全。',
        },
        {
          heading: '你的权利与选择',
          body: `你可以随时在“设置 → 账户”中导出全部数据（可选含 GPS 轨迹），或删除账户。断开 Strava 会删除从 Strava 同步的跑步记录。其他问题请写信至 ${SUPPORT_EMAIL}。根据你所在地区，你可能还有查阅或更正数据的权利。`,
        },
        {
          heading: '浏览器存储与 Cookie',
          body: 'HermesRuns 用浏览器本地存储中的令牌保持你的登录状态，不设置任何广告或分析 Cookie。注册页上的 Google reCAPTCHA 可能会设置它自己的 Cookie。',
        },
        {
          heading: '政策更新',
          body: '如果本隐私政策发生重要变更，HermesRuns 可能会更新生效日期，并通过产品内入口或相关账户渠道展示最新版内容，方便你查看最新说明。',
        },
      ],
      updated: '最后更新：2026 年 10 月 10 日',
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
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { lang } = useI18n();

  const dictionary = lang === 'zh-CN' ? LEGAL_COPY.zh : LEGAL_COPY.en;
  const page = useMemo(() => dictionary[variant] || dictionary.terms, [dictionary, variant]);
  const isPrivacy = variant === 'privacy';
  const privacySignals = useMemo(() => {
    if (!isPrivacy) return [];
    return [
      { icon: Database, label: page.sections[0]?.heading, value: '01' },
      { icon: ShieldCheck, label: page.sections[2]?.heading, value: '02' },
      { icon: LockKeyhole, label: page.sections[3]?.heading, value: '03' },
      { icon: FileCheck2, label: page.sections[4]?.heading, value: '04' },
    ].filter((item) => item.label);
  }, [isPrivacy, page.sections]);

  return (
    <div className={`legal-page legal-page--${variant} auth-page--liquid-glass`}>
      <AuthDotField />
      <div className="legal-page-shell">
        <header className="legal-page-header">
          <button
            type="button"
            className="legal-page-back"
            onClick={() => navigate(isAuthenticated ? '/profile' : '/')}
          >
            <AppIcon name="arrow_back" className="runner-dashboard-side-link-icon" />
            <span>{isAuthenticated ? dictionary.backApp : dictionary.backHome}</span>
          </button>
          <HermesLogo tone="light" />
        </header>

        <main className="legal-page-content">
          <section className="legal-page-hero legal-page-hero--editorial" aria-labelledby="legal-page-title">
            <div className="legal-page-hero-copy">
              <span className="legal-page-kicker">
                <i className="legal-page-kicker-dot" aria-hidden="true" />
                {page.eyebrow}
              </span>
              <h1 id="legal-page-title">{page.title}</h1>
              <p>{page.intro}</p>
              <div className="legal-page-hero-meta">
                <span>{page.updated}</span>
                <span aria-hidden="true">·</span>
                <span>{page.sections.length} {dictionary.sectionsLabel}</span>
              </div>
            </div>

            {isPrivacy && (
              <aside className="privacy-hero-panel" aria-label={page.sections[2]?.heading || page.title}>
                <div className="privacy-hero-panel-ring" aria-hidden="true">
                  <ShieldCheck size={28} strokeWidth={1.7} />
                </div>
                <div className="privacy-hero-panel-copy">
                  <span>{page.updated}</span>
                  <strong>{page.sections[2]?.heading}</strong>
                  <p>{page.sections[2]?.body}</p>
                </div>
              </aside>
            )}
          </section>

          {isPrivacy && (
            <section className="privacy-signal-strip" aria-label={page.title}>
              {privacySignals.map((signal) => (
                <article className="privacy-signal" key={signal.label}>
                  {createElement(signal.icon, { size: 18, strokeWidth: 1.7, 'aria-hidden': true })}
                  <span>{signal.value}</span>
                  <strong>{signal.label}</strong>
                </article>
              ))}
            </section>
          )}

          <section className="legal-page-sections legal-page-sections--editorial" aria-label={page.title}>
            {page.sections.map((section, index) => (
              <article key={section.heading} className="legal-page-row">
                <span className="legal-page-row-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')} / {String(page.sections.length).padStart(2, '0')}
                </span>
                <div className="legal-page-row-copy">
                  <h2>{section.heading}</h2>
                  <p>{renderLegalBody(section.body)}</p>
                </div>
              </article>
            ))}
          </section>
        </main>

        <footer className="legal-page-footer">
          <p className="legal-page-signoff">{dictionary.signoff}</p>
          <span>{page.updated}</span>
          <FooterNavLinks />
        </footer>
      </div>
    </div>
  );
}
