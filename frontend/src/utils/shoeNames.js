const BRAND_ZH_MAP = {
  nike: '耐克',
  adidas: '阿迪达斯',
  asics: '亚瑟士',
  newbalance: '新百伦',
  hoka: 'HOKA',
  brooks: '布鲁克斯',
  saucony: '索康尼',
  on: '昂跑',
  mizuno: '美津浓',
  altra: '奥创',
  puma: '彪马',
  reebok: '锐步',
  underarmour: '安德玛',
  ua: '安德玛',
  skechers: '斯凯奇',
  anta: '安踏',
  lining: '李宁',
  lining: '李宁',
  xtep: '特步',
  peak: '匹克',
  erke: '鸿星尔克',
  qiaodan: '乔丹',
  warrior: '回力',
  doublestar: '双星',
  '361': '361°',
  '361°': '361°',
};

const MODEL_ZH_TOKEN_MAP = {
  pegasus: '飞马',
  revolution: '革命',
  quest: '探索',
  structure: 'Structure',
  vomero: 'Vomero',
  alphafly: 'Alphafly',
  vaporfly: 'Vaporfly',
  invincible: 'Invincible',
  winflo: 'Winflo',
  novablast: 'NOVABLAST',
  superblast: 'SUPERBLAST',
  metaspeed: 'METASPEED',
  kayano: 'GEL-KAYANO',
  cumulus: 'GEL-CUMULUS',
  nimbus: 'GEL-NIMBUS',
  boston: 'Boston',
  adios: 'Adios',
  supernova: 'Supernova',
  ultraboost: 'Ultraboost',
  adizero: 'ADIZERO',
  clifton: 'Clifton',
  mach: 'Mach',
  rocket: 'Rocket',
  bondi: 'Bondi',
  arahi: 'Arahi',
  glycerin: 'Glycerin',
  ghost: 'Ghost',
  adrenaline: 'Adrenaline',
  endorphin: 'Endorphin',
  triumph: 'Triumph',
  kinvara: 'Kinvara',
  speed: 'Speed',
  pro: 'Pro',
};

const PINYIN_CHAR_MAP = {
  '赤': 'chi', '焰': 'yan', '飞': 'fei', '电': 'dian', '绝': 'jue', '影': 'ying',
  '烈': 'lie', '骏': 'jun', '竞': 'jing', '速': 'su', '训': 'xun', '练': 'lian',
  '超': 'chao', '轻': 'qing', '先': 'xian', '锋': 'feng', '启': 'qi', '程': 'cheng',
  '马': 'ma', '赫': 'he', '风': 'feng', '行': 'xing', '战': 'zhan', '神': 'shen',
  '猎': 'lie', '隼': 'sun', '彗': 'hui', '星': 'xing', '龙': 'long', '雀': 'que',
  '凌': 'ling', '波': 'bo', '玄': 'xuan', '弓': 'gong', '缓': 'huan', '震': 'zhen',
  '稳': 'wen', '定': 'ding', '越': 'yue', '野': 'ye', '耐': 'nai', '克': 'ke',
  '阿': 'a', '迪': 'di', '达': 'da', '斯': 'si', '亚': 'ya', '瑟': 'se', '士': 'shi',
  '新': 'xin', '百': 'bai', '伦': 'lun', '布': 'bu', '鲁': 'lu', '索': 'suo', '康': 'kang',
  '尼': 'ni', '昂': 'ang', '美': 'mei', '津': 'jin', '浓': 'nong', '奥': 'ao', '创': 'chuang',
  '彪': 'biao', '锐': 'rui', '步': 'bu', '安': 'an', '德': 'de', '玛': 'ma', '李': 'li',
  '宁': 'ning', '特': 'te', '匹': 'pi', '鸿': 'hong', '尔': 'er', '乔': 'qiao', '丹': 'dan',
  '回': 'hui', '力': 'li', '双': 'shuang',
};

function normalizeKey(value) {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[!.,\-_/]/g, '');
}

function hasChinese(value) {
  return /[\u4e00-\u9fff]/.test(value || '');
}

function titleCaseWords(value) {
  return (value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function transliterateChineseToPinyin(value) {
  if (!hasChinese(value)) return value || '';
  const chunks = [];
  for (const char of (value || '')) {
    if (PINYIN_CHAR_MAP[char]) {
      chunks.push(PINYIN_CHAR_MAP[char]);
    } else if (/[0-9a-zA-Z]/.test(char)) {
      chunks.push(char);
    } else if (/\s/.test(char)) {
      chunks.push(' ');
    }
  }
  return titleCaseWords(chunks.join(' ').replace(/\s+/g, ' ').trim()) || (value || '');
}

export function localizeShoeBrand(brand, lang = 'en') {
  const raw = (brand || '').trim();
  if (!raw) return '';
  if (lang === 'zh-CN') {
    if (hasChinese(raw)) return raw;
    return BRAND_ZH_MAP[normalizeKey(raw)] || raw;
  }
  if (hasChinese(raw)) return transliterateChineseToPinyin(raw);
  return raw;
}

export function localizeShoeModel(model, lang = 'en') {
  const raw = (model || '').trim();
  if (!raw) return '';
  if (lang === 'zh-CN') {
    if (hasChinese(raw)) return raw;
    const parts = raw.split(/\s+/).map((part) => {
      const cleaned = part.toLowerCase().replace(/[^a-z0-9+]/g, '');
      return MODEL_ZH_TOKEN_MAP[cleaned] || part;
    });
    return parts.join(' ');
  }
  if (hasChinese(raw)) return transliterateChineseToPinyin(raw);
  return raw;
}

export function formatShoeDisplayName({ brand, model, nickname, lang = 'en' }) {
  const localizedBrand = localizeShoeBrand(brand, lang);
  const localizedModel = localizeShoeModel(model, lang);
  const joined = [localizedBrand, localizedModel].filter(Boolean).join(' ').trim();
  return joined || nickname || '—';
}
