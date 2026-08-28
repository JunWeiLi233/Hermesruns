export const SITE_URL = 'https://hermesruns.com';
export const SOCIAL_IMAGE_URL = `${SITE_URL}/images/hermes-og-image.svg`;
export const SOURCE_REPOSITORY_URL = 'https://github.com/JunWeiLi233/Hermesruns';

const HOME_FEATURES = Object.freeze([
  'VO2max estimation and training zones',
  'Race finish time predictions',
  'Interactive route heatmaps',
  'Shoe mileage tracking',
  'Strava activity synchronization',
]);

const SEO_COPY = Object.freeze({
  en: Object.freeze({
    home: Object.freeze({
      title: 'Running Analytics with Strava Sync | Hermes',
      description: 'Analyze runs with VO2max estimates, pace zones, race predictions, route heatmaps, and shoe mileage tracking. Connect Strava and train with better context.',
      imageAlt: 'Hermes running analytics for training load, race predictions, and shoe mileage',
    }),
    terms: Object.freeze({
      title: 'Terms of Service and Use | Hermes',
      description: 'Read the Hermes Terms of Service for running analytics, training insights, connected activity imports, account use, and responsible access to the platform.',
      imageAlt: 'Hermes terms of service',
    }),
    privacy: Object.freeze({
      title: 'Privacy Policy and Data Practices | Hermes',
      description: 'Learn how Hermes handles account details, Strava activity imports, training metrics, retention, security safeguards, and your privacy choices.',
      imageAlt: 'Hermes privacy policy and data practices',
    }),
    private: Object.freeze({
      title: 'Hermes Running Analytics | Private App',
      description: 'Private Hermes account area for running analytics, training plans, activity data, and personal settings.',
      imageAlt: 'Hermes private running analytics app',
    }),
  }),
  'zh-CN': Object.freeze({
    home: Object.freeze({
      title: '跑步数据分析与 Strava 同步 | Hermes',
      description: 'Hermes 用 VO2max 估算、训练配速区间、比赛成绩预测、路线热力图和跑鞋里程管理，帮助跑者读懂每一次训练。连接 Strava，开始训练。',
      imageAlt: 'Hermes 跑步数据分析、比赛预测与跑鞋里程管理',
    }),
    terms: Object.freeze({
      title: '服务条款与账户使用 | Hermes',
      description: '查看 Hermes 服务条款，了解跑步分析、训练洞察、活动数据导入、账户使用方式，以及安全、负责地使用平台的要求。',
      imageAlt: 'Hermes 服务条款',
    }),
    privacy: Object.freeze({
      title: '隐私政策与数据说明 | Hermes',
      description: '了解 Hermes 如何处理账户信息、Strava 活动导入、训练指标、数据保留、安全措施，以及你可以行使的隐私选择权。',
      imageAlt: 'Hermes 隐私政策与数据说明',
    }),
    private: Object.freeze({
      title: 'Hermes 跑步数据分析 | 私人账户',
      description: 'Hermes 私人账户区域，用于查看跑步分析、训练计划、活动数据和个人设置。',
      imageAlt: 'Hermes 私人跑步数据分析应用',
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
        name: 'Hermes',
        url: `${SITE_URL}/`,
        logo: SOCIAL_IMAGE_URL,
        sameAs: [SOURCE_REPOSITORY_URL],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: 'Hermes Running Analytics',
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: metadata.language,
      },
      {
        '@type': 'WebApplication',
        '@id': `${SITE_URL}/#webapplication`,
        name: 'Hermes Running Analytics',
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
