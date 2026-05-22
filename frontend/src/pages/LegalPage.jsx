import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../components/AppIcon';
import FooterNavLinks from '../components/FooterNavLinks';
import HermesLogo from '../components/HermesLogo';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';

const LEGAL_COPY = {
  en: {
    terms: {
      eyebrow: 'Hermes legal',
      title: 'Terms of Service',
      intro: 'These Terms govern your access to Hermes, including training insights, workout planning, account features, and connected activity imports.',
      sections: [
        {
          heading: 'Using Hermes responsibly',
          body: 'You may use Hermes only for lawful personal or internal coaching purposes. You agree not to misuse the service, interfere with platform operations, scrape private data, or attempt unauthorized access to other accounts or admin tools.',
        },
        {
          heading: 'Accounts and connected data',
          body: 'You are responsible for the accuracy of the information you provide and for maintaining the security of your login credentials. When you connect services such as Strava or upload workout files, you confirm that you have the right to share that data with Hermes.',
        },
        {
          heading: 'Training guidance disclaimer',
          body: 'Hermes provides informational coaching support, readiness estimates, analytics, and planning suggestions. It is not medical advice, diagnosis, or emergency guidance. You remain responsible for listening to your body and speaking with a qualified professional when symptoms, injuries, or health concerns arise.',
        },
        {
          heading: 'Service availability',
          body: 'We may update, improve, pause, or remove features when needed for reliability, safety, or product evolution. We try to keep Hermes available, but uninterrupted access, perfect synchronization, and error-free analytics cannot be guaranteed at all times.',
        },
        {
          heading: 'Content and ownership',
          body: 'Hermes retains ownership of the software, design system, and platform content. You retain ownership of your training data and personal content, while granting Hermes the limited rights needed to store, process, and display that information inside the service.',
        },
        {
          heading: 'Termination',
          body: 'We may suspend or terminate accounts that violate these Terms, threaten platform security, or abuse the service. You may stop using Hermes at any time. Questions about these Terms can be sent to support@hermes.run.',
        },
      ],
      updated: 'Last updated: April 11, 2026',
    },
    privacy: {
      eyebrow: 'Hermes legal',
      title: 'Privacy Policy',
      intro: 'This Privacy Policy explains what Hermes collects, how it uses that information, and the choices you have when you use the product.',
      sections: [
        {
          heading: 'What we collect',
          body: 'Hermes may collect account details such as your name, email address, language preferences, connected-provider identifiers, and the training data you sync or upload, including activities, routes, pace, heart-rate, and related performance metrics.',
        },
        {
          heading: 'How we use data',
          body: 'We use your information to authenticate your account, sync activities, generate coaching insights, personalize dashboards, improve product reliability, investigate issues, and communicate essential account or service updates.',
        },
        {
          heading: 'How data is shared',
          body: 'Hermes does not sell your personal data. Information may be shared only with service providers or infrastructure partners that help operate the product, or when disclosure is required for legal compliance, security, or fraud prevention.',
        },
        {
          heading: 'Retention and security',
          body: 'We keep data only as long as reasonably necessary to operate Hermes, satisfy legal obligations, resolve disputes, and protect the service. We use practical administrative and technical safeguards, but no storage or transmission method can be guaranteed to be perfectly secure.',
        },
        {
          heading: 'Your choices',
          body: 'You can disconnect integrations, update profile details, and request help with account-related privacy questions through support@hermes.run. Depending on your region, you may also have rights to access, correct, export, or delete certain personal information.',
        },
        {
          heading: 'Policy updates',
          body: 'If this Privacy Policy changes materially, Hermes may update the effective date and surface the revised version through the product or related account channels so you can review the latest terms.',
        },
      ],
      updated: 'Last updated: April 11, 2026',
    },
    backHome: 'Back to Hermes',
    backApp: 'Back to profile',
  },
  zh: {
    terms: {
      eyebrow: 'Hermes 法务说明',
      title: '服务条款',
      intro: '本条款适用于你访问和使用 Hermes 的方式，包括训练洞察、训练安排、账户功能，以及连接导入的跑步数据。',
      sections: [
        {
          heading: '合理使用 Hermes',
          body: '你只能将 Hermes 用于合法的个人训练或内部教练用途，不得滥用服务、干扰平台运行、抓取他人私有数据，或尝试未授权访问其他账户与管理工具。',
        },
        {
          heading: '账户与连接数据',
          body: '你需要对自己提供的信息准确性和登录凭据安全负责。当你连接 Strava 等服务或上传训练文件时，代表你确认自己有权将这些数据提供给 Hermes。',
        },
        {
          heading: '训练建议免责声明',
          body: 'Hermes 提供的是信息型训练辅助、状态评估、分析结果与计划建议，并不构成医疗建议、诊断或紧急指导。出现伤病、异常症状或健康疑虑时，你仍应优先依据自身状态并咨询合格专业人士。',
        },
        {
          heading: '服务可用性',
          body: '为保证可靠性、安全性或产品演进，我们可能会更新、调整、暂停或移除部分功能。Hermes 会尽力保持可用，但无法保证服务始终不中断，也无法保证同步与分析在任何时候都完全无误。',
        },
        {
          heading: '内容与所有权',
          body: 'Hermes 保留软件、设计系统与平台内容的所有权。你的训练数据和个人内容仍归你所有，但你授予 Hermes 在服务内存储、处理和展示这些内容所需的有限权利。',
        },
        {
          heading: '终止与联系',
          body: '如果账户违反本条款、威胁平台安全或滥用服务，我们可以暂停或终止访问。你也可以随时停止使用 Hermes。如对本条款有疑问，可联系 support@hermes.run。',
        },
      ],
      updated: '最后更新：2026 年 4 月 11 日',
    },
    privacy: {
      eyebrow: 'Hermes 法务说明',
      title: '隐私政策',
      intro: '本隐私政策说明 Hermes 会收集哪些信息、如何使用这些信息，以及你在使用产品时拥有的选择权。',
      sections: [
        {
          heading: '我们收集的信息',
          body: 'Hermes 可能收集账户资料，例如姓名、邮箱、语言偏好、第三方连接标识，以及你同步或上传的训练数据，包括活动记录、路线、配速、心率和相关表现指标。',
        },
        {
          heading: '数据的使用方式',
          body: '这些信息用于账户登录验证、活动同步、生成教练洞察、个性化页面展示、提升产品稳定性、排查故障，以及发送必要的账户或服务通知。',
        },
        {
          heading: '数据共享方式',
          body: 'Hermes 不会出售你的个人数据。只有在运营产品所需的服务提供商协助、或出于法律合规、安全防护、反欺诈等必要场景下，相关信息才可能被共享。',
        },
        {
          heading: '保存期限与安全',
          body: '我们仅在为运行 Hermes、履行法律义务、处理争议和保护服务所合理需要的期限内保留数据。我们会采取实际可行的管理和技术措施，但任何存储或传输方式都无法保证绝对安全。',
        },
        {
          heading: '你的权利与选择',
          body: '你可以断开第三方连接、更新个人资料，也可以通过 support@hermes.run 咨询与账户隐私相关的问题。根据你所在地区，可能还享有访问、更正、导出或删除部分个人信息的权利。',
        },
        {
          heading: '政策更新',
          body: '如果本隐私政策发生重要变更，Hermes 可能会更新生效日期，并通过产品内入口或相关账户渠道展示最新版内容，方便你查看最新说明。',
        },
      ],
      updated: '最后更新：2026 年 4 月 11 日',
    },
    backHome: '返回 Hermes',
    backApp: '返回个人主页',
  },
};

export default function LegalPage({ variant = 'terms' }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { lang } = useI18n();

  const dictionary = lang === 'zh-CN' ? LEGAL_COPY.zh : LEGAL_COPY.en;
  const page = useMemo(() => dictionary[variant] || dictionary.terms, [dictionary, variant]);

  return (
    <div className="legal-page">
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
          <HermesLogo dark />
        </header>

        <main className="legal-page-content">
          <section className="legal-page-hero">
            <span className="legal-page-eyebrow">{page.eyebrow}</span>
            <h1>{page.title}</h1>
            <p>{page.intro}</p>
          </section>

          <section className="legal-page-sections">
            {page.sections.map((section) => (
              <article key={section.heading} className="legal-page-card">
                <h2>{section.heading}</h2>
                <p>{section.body}</p>
              </article>
            ))}
          </section>
        </main>

        <footer className="legal-page-footer">
          <span>{page.updated}</span>
          <FooterNavLinks />
        </footer>
      </div>
    </div>
  );
}
