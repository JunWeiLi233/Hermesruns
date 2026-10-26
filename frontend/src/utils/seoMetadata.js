import { PUBLIC_HOME_COPY, PUBLIC_FREE_PLAN_PRICE, PUBLIC_HOME_REVIEW_DATE } from './publicHomeCopy.js';
import { SUPPORT_EMAIL } from './supportContact.js';

export const SITE_URL = 'https://hermesruns.com';
export const SOCIAL_IMAGE_URL = `${SITE_URL}/og-image.png`;
export const LOGO_URL = `${SITE_URL}/apple-touch-icon.png`;
export const SOURCE_REPOSITORY_URL = 'https://github.com/JunWeiLi233/Hermesruns';

const SEO_COPY = Object.freeze({
  en: Object.freeze({
    home: Object.freeze({
      ...PUBLIC_HOME_COPY.en,
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
      ...PUBLIC_HOME_COPY['zh-CN'],
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

// The tab, the history and a screen reader tell pages apart by their title. A page that is not public keeps the generic
// description and its noindex robots; only the title is its own. The names are the ones the navigation uses.
const PAGE_TITLES = Object.freeze({
  en: Object.freeze({
    login: 'Sign in',
    signup: 'Create your account',
    forgotPassword: 'Reset your password',
    home: 'Home',
    runs: 'Runs',
    run: 'Run',
    analysis: 'Analysis',
    heatmap: 'Heatmap',
    weather: 'Weather Engine',
    prediction: 'Race prediction',
    todayRun: "Today's run",
    rewards: 'Rewards',
    trainingLog: 'Training log',
    paceCurve: 'Pace curve',
    vo2maxEstimates: 'VO2max estimates',
    trends: 'Trends',
    qualitySessions: 'Quality sessions',
    settings: 'Settings',
    importData: 'Import data',
    shoes: 'Shoes',
    addShoes: 'Add shoes',
    shoeCatalog: 'Shoe catalog',
    races: 'Races',
    raceDetails: 'Race details',
    schedule: 'Schedule',
    muscleTraining: 'Muscle training',
    admin: 'Admin',
    team: 'Coaching & teams',
  }),
  'zh-CN': Object.freeze({
    login: '登录',
    signup: '创建账户',
    forgotPassword: '重置密码',
    home: '主页',
    runs: '跑步记录',
    run: '跑步详情',
    analysis: '分析',
    heatmap: '热力图',
    weather: '天气引擎',
    prediction: '比赛预测',
    todayRun: '今日训练',
    rewards: '奖励',
    trainingLog: '训练日志',
    paceCurve: '配速曲线',
    vo2maxEstimates: 'VO2max 估算',
    trends: '趋势',
    qualitySessions: '质量训练课',
    settings: '设置',
    importData: '导入数据',
    shoes: '跑鞋',
    addShoes: '添加跑鞋',
    shoeCatalog: '跑鞋库',
    races: '赛事',
    raceDetails: '赛事详情',
    schedule: '计划',
    muscleTraining: '肌肉训练',
    admin: '管理',
    team: '教练与团队',
  }),
});

const PREDICTION_DISTANCE_NAMES = Object.freeze({
  en: Object.freeze({ '5k': '5K', '10k': '10K', half: 'Half marathon', marathon: 'Marathon' }),
  'zh-CN': Object.freeze({ '5k': '5 公里', '10k': '10 公里', half: '半程马拉松', marathon: '马拉松' }),
});

const PAGE_KEYS_BY_PATH = Object.freeze({
  '/login': 'login',
  '/signup': 'signup',
  '/forgot-password': 'forgotPassword',
  '/profile': 'home',
  '/profile/team': 'team',
  '/runs': 'runs',
  '/analysis': 'analysis',
  '/heatmap': 'heatmap',
  '/weather': 'weather',
  '/weather-engine': 'weather',
  '/today-run': 'todayRun',
  '/rewards': 'rewards',
  '/training-log': 'trainingLog',
  '/analysis/pace-curve': 'paceCurve',
  '/analysis/vo2max-estimates': 'vo2maxEstimates',
  '/analysis/trends': 'trends',
  '/analysis/quality-sessions': 'qualitySessions',
  '/settings': 'settings',
  '/settings/import-data': 'importData',
  '/shoes': 'shoes',
  '/shoes/add': 'addShoes',
  '/add-shoes': 'addShoes',
  '/shoe-catalog': 'shoeCatalog',
  '/races': 'races',
  '/schedule': 'schedule',
  '/muscle-training': 'muscleTraining',
  '/admin': 'admin',
  '/workflows': 'admin',
});

function pageKeyForPath(pathname) {
  if (Object.hasOwn(PAGE_KEYS_BY_PATH, pathname)) return PAGE_KEYS_BY_PATH[pathname];
  if (/^\/(?:training|training-plan)(?:\/|$)/.test(pathname)) return 'schedule';
  if (/^\/runs\/[^/]+$/.test(pathname)) return 'run';
  if (/^\/analysis\/[^/]+$/.test(pathname)) return 'analysis';
  if (/^\/races\/details\/[^/]+$/.test(pathname)) return 'raceDetails';
  if (/^\/settings\/[^/]+$/.test(pathname)) return 'settings';
  if (/^\/dashboard(\/|$)/.test(pathname)) return 'admin';
  return null;
}

/** "Runs | HermesRuns" for a page that is not public, or null for an address that is not one of the app's pages. */
export function getPageTitle(pathname = '/', language = 'en') {
  const normalizedLanguage = language === 'zh-CN' ? 'zh-CN' : 'en';
  const names = PAGE_TITLES[normalizedLanguage];
  const normalizedPath = normalizePathname(pathname);
  const prediction = /^\/prediction\/([^/]+)$/.exec(normalizedPath);
  if (prediction) {
    const distance = PREDICTION_DISTANCE_NAMES[normalizedLanguage][prediction[1]];
    if (!distance) return `${names.prediction} | HermesRuns`;
    return normalizedLanguage === 'zh-CN' ? `${distance}预测 | HermesRuns` : `${distance} prediction | HermesRuns`;
  }
  const key = pageKeyForPath(normalizedPath);
  return key ? `${names[key]} | HermesRuns` : null;
}

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

function buildOrganization() {
  return {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: 'HermesRuns',
    url: `${SITE_URL}/`,
    logo: LOGO_URL,
    email: SUPPORT_EMAIL,
  };
}

function buildWebsite(metadata) {
  return {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: `${SITE_URL}/`,
    name: 'HermesRuns',
    publisher: { '@id': `${SITE_URL}/#organization` },
    inLanguage: metadata.language,
  };
}

function buildHomeStructuredData(metadata) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      buildOrganization(),
      buildWebsite(metadata),
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
        featureList: metadata.features,
        offers: {
          '@type': 'Offer',
          name: metadata.freePlanName,
          price: PUBLIC_FREE_PLAN_PRICE,
          url: `${SITE_URL}/#pricing`,
        },
        publisher: { '@id': `${SITE_URL}/#organization` },
        mainEntityOfPage: { '@id': `${SITE_URL}/#webpage` },
        inLanguage: metadata.language,
      },
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/#webpage`,
        url: metadata.url,
        name: metadata.title,
        description: metadata.description,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        mainEntity: { '@id': `${SITE_URL}/#webapplication` },
        dateModified: PUBLIC_HOME_REVIEW_DATE,
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
    isPartOf: { ...buildWebsite(metadata), publisher: buildOrganization() },
    dateModified: '2026-10-17',
    inLanguage: metadata.language,
  };
}

export function getSeoMetadata(pathname = '/', language = 'en') {
  const normalizedLanguage = language === 'zh-CN' ? 'zh-CN' : 'en';
  const normalizedPath = normalizePathname(pathname);
  const route = routeForPath(normalizedPath);
  const copy = SEO_COPY[normalizedLanguage][route];
  const pageTitle = route === 'private' ? getPageTitle(normalizedPath, normalizedLanguage) : null;
  const indexable = route !== 'private';
  const url = `${SITE_URL}${normalizedPath}`;
  const metadata = {
    ...copy,
    title: pageTitle || copy.title,
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

  metadata.structuredData = route === 'home' ? buildHomeStructuredData(metadata)
    : indexable ? buildLegalStructuredData(metadata) : null;

  return metadata;
}
