export const SITE_URL = 'https://hermesruns.com';
export const SOCIAL_IMAGE_URL = `${SITE_URL}/og-image.png`;
export const LOGO_URL = `${SITE_URL}/apple-touch-icon.png`;
export const SOURCE_REPOSITORY_URL = 'https://github.com/JunWeiLi233/Hermesruns';

const HOME_FEATURES = Object.freeze([
  'Daily run, workout or rest call',
  'VO2max estimation and training zones',
  'Race finish time predictions',
  'Interactive route heatmaps',
  'Shoe mileage tracking',
  'Strava sync and GPX, FIT and TCX file import',
]);

const SEO_COPY = Object.freeze({
  en: Object.freeze({
    home: Object.freeze({
      title: 'Running Analytics You Can Check | HermesRuns',
      description: 'A daily run, workout or rest call, plus VO2max, pace zones, race predictions and shoe mileage, worked out from your runs with published formulas.',
      imageAlt: 'HermesRuns: running analytics you can check',
    }),
    terms: Object.freeze({
      title: 'Terms of Service and Use | HermesRuns',
      description: 'Read the HermesRuns Terms of Service for running analytics, training insights, connected activity imports, account use, and responsible access to the platform.',
      imageAlt: 'HermesRuns terms of service',
    }),
    privacy: Object.freeze({
      title: 'Privacy Policy and Data Practices | HermesRuns',
      description: 'Learn how HermesRuns handles account details, Strava activity imports, training metrics, retention, security safeguards, and your privacy choices.',
      imageAlt: 'HermesRuns privacy policy and data practices',
    }),
    private: Object.freeze({
      title: 'HermesRuns Running Analytics | Private App',
      description: 'Private HermesRuns account area for running analytics, training plans, activity data, and personal settings.',
      imageAlt: 'HermesRuns private running analytics app',
    }),
  }),
  'zh-CN': Object.freeze({
    home: Object.freeze({
      title: '可核对的跑步数据分析 | HermesRuns',
      description: '每天告诉你该跑、该练还是该休息，并给出 VO2max、配速区间、比赛预测和跑鞋里程。全部基于你的跑步数据，公式公开可查。',
      imageAlt: 'HermesRuns：可核对的跑步数据分析',
    }),
    terms: Object.freeze({
      title: '服务条款与账户使用 | HermesRuns',
      description: '查看 HermesRuns 服务条款，了解跑步分析、训练洞察、活动数据导入、账户使用方式，以及安全、负责地使用平台的要求。',
      imageAlt: 'HermesRuns 服务条款',
    }),
    privacy: Object.freeze({
      title: '隐私政策与数据说明 | HermesRuns',
      description: '了解 HermesRuns 如何处理账户信息、Strava 活动导入、训练指标、数据保留、安全措施，以及你可以行使的隐私选择权。',
      imageAlt: 'HermesRuns 隐私政策与数据说明',
    }),
    private: Object.freeze({
      title: 'HermesRuns 跑步数据分析 | 私人账户',
      description: 'HermesRuns 私人账户区域，用于查看跑步分析、训练计划、活动数据和个人设置。',
      imageAlt: 'HermesRuns 私人跑步数据分析应用',
    }),
  }),
});

function normalizePathname(pathname) {
  const normalized = String(pathname || '/').trim().replace(/\/+$/, '');
  return normalized || '/';
}

function routeForPath(pathname) {
  if (pathname === '/') return 'home';
  if (pathname === '/terms') return 'terms';
  if (pathname === '/privacy') return 'privacy';
  return 'private';
}

function buildHomeStructuredData(metadata) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'HermesRuns',
        url: `${SITE_URL}/`,
        logo: LOGO_URL,
        sameAs: [SOURCE_REPOSITORY_URL],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: 'HermesRuns',
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: metadata.language,
      },
      {
        '@type': 'WebApplication',
        '@id': `${SITE_URL}/#webapplication`,
        name: 'HermesRuns',
        url: `${SITE_URL}/`,
        description: metadata.description,
        image: SOCIAL_IMAGE_URL,
        applicationCategory: 'SportsApplication',
        operatingSystem: 'Web',
        browserRequirements: 'Requires JavaScript and a modern web browser.',
        featureList: HOME_FEATURES,
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: metadata.language,
      },
    ],
  };
}

function buildLegalStructuredData(metadata) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${metadata.url}#webpage`,
    url: metadata.url,
    name: metadata.title,
    description: metadata.description,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    dateModified: '2026-04-11',
    inLanguage: metadata.language,
  };
}

export function getSeoMetadata(pathname = '/', language = 'en') {
  const normalizedLanguage = language === 'zh-CN' ? 'zh-CN' : 'en';
  const normalizedPath = normalizePathname(pathname);
  const route = routeForPath(normalizedPath);
  const copy = SEO_COPY[normalizedLanguage][route];
  const indexable = route !== 'private';
  const url = `${SITE_URL}${normalizedPath}`;
  const metadata = {
    ...copy,
    indexable,
    language: normalizedLanguage === 'zh-CN' ? 'zh-CN' : 'en',
    locale: normalizedLanguage === 'zh-CN' ? 'zh_CN' : 'en_US',
    path: normalizedPath,
    route,
    url,
    canonicalUrl: indexable ? url : null,
    robots: indexable
      ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
      : 'noindex,nofollow,noarchive',
    openGraphType: 'website',
    structuredData: null,
  };

  metadata.structuredData = route === 'home' ? buildHomeStructuredData({
      ...copy,
      language: normalizedLanguage === 'zh-CN' ? 'zh-CN' : 'en',
    }) : indexable ? buildLegalStructuredData(metadata) : null;

  return metadata;
}
