import worldRaceCatalog from '../data/worldRaceCatalog.js';

const SAFE_RACE_TARGET_LABELS = {
  '5k': { zh: '5 公里', en: '5K' },
  '10k': { zh: '10 公里', en: '10K' },
  half: { zh: '半程马拉松', en: 'Half Marathon' },
  marathon: { zh: '全程马拉松', en: 'Marathon' },
};

const SAFE_COUNTRY_LABELS = {
  China: { zh: '中国', en: 'China' },
  Japan: { zh: '日本', en: 'Japan' },
  'United States': { zh: '美国', en: 'United States' },
  'United Kingdom': { zh: '英国', en: 'United Kingdom' },
  Germany: { zh: '德国', en: 'Germany' },
  France: { zh: '法国', en: 'France' },
  Netherlands: { zh: '荷兰', en: 'Netherlands' },
  Belgium: { zh: '比利时', en: 'Belgium' },
  Italy: { zh: '意大利', en: 'Italy' },
  Spain: { zh: '西班牙', en: 'Spain' },
  Portugal: { zh: '葡萄牙', en: 'Portugal' },
  Finland: { zh: '芬兰', en: 'Finland' },
  Norway: { zh: '挪威', en: 'Norway' },
  Australia: { zh: '澳大利亚', en: 'Australia' },
  'New Zealand': { zh: '新西兰', en: 'New Zealand' },
  Singapore: { zh: '新加坡', en: 'Singapore' },
  'South Korea': { zh: '韩国', en: 'South Korea' },
  Malaysia: { zh: '马来西亚', en: 'Malaysia' },
  India: { zh: '印度', en: 'India' },
  Poland: { zh: '波兰', en: 'Poland' },
  Thailand: { zh: '泰国', en: 'Thailand' },
  Canada: { zh: '加拿大', en: 'Canada' },
  Mexico: { zh: '墨西哥', en: 'Mexico' },
  Argentina: { zh: '阿根廷', en: 'Argentina' },
  Brazil: { zh: '巴西', en: 'Brazil' },
  Chile: { zh: '智利', en: 'Chile' },
  Sweden: { zh: '瑞典', en: 'Sweden' },
  Denmark: { zh: '丹麦', en: 'Denmark' },
  Austria: { zh: '奥地利', en: 'Austria' },
  'Czech Republic': { zh: '捷克', en: 'Czech Republic' },
  Greece: { zh: '希腊', en: 'Greece' },
  Israel: { zh: '以色列', en: 'Israel' },
  Turkey: { zh: '土耳其', en: 'Turkey' },
  'United Arab Emirates': { zh: '阿联酋', en: 'United Arab Emirates' },
  Qatar: { zh: '卡塔尔', en: 'Qatar' },
  'South Africa': { zh: '南非', en: 'South Africa' },
  Kenya: { zh: '肯尼亚', en: 'Kenya' },
  Morocco: { zh: '摩洛哥', en: 'Morocco' },
};

const LOCALIZED_COUNTRY_LABELS = {
  ...SAFE_COUNTRY_LABELS,
  Ireland: { zh: '爱尔兰', en: 'Ireland' },
  Switzerland: { zh: '瑞士', en: 'Switzerland' },
  Vietnam: { zh: '越南', en: 'Vietnam' },
  Indonesia: { zh: '印度尼西亚', en: 'Indonesia' },
};

const LOCALIZED_CITY_LABELS = {
  Tokyo: '东京',
  Osaka: '大阪',
  Boston: '波士顿',
  Chicago: '芝加哥',
  'New York City': '纽约',
  'Big Sur': '大瑟尔',
  Honolulu: '檀香山',
  London: '伦敦',
  Manchester: '曼彻斯特',
  Berlin: '柏林',
  Munich: '慕尼黑',
  Paris: '巴黎',
  'Nice-Cannes': '尼斯-戛纳',
  Amsterdam: '阿姆斯特丹',
  Rotterdam: '鹿特丹',
  Rome: '罗马',
  Milan: '米兰',
  Barcelona: '巴塞罗那',
  Valencia: '瓦伦西亚',
  Lisbon: '里斯本',
  Porto: '波尔图',
  Melbourne: '墨尔本',
  'Gold Coast': '黄金海岸',
  Queenstown: '皇后镇',
  Shanghai: '上海',
  Xiamen: '厦门',
  Wuxi: '无锡',
  Gyeongju: '庆州',
  Bangkok: '曼谷',
  'New Delhi': '新德里',
  'Durban-Pietermaritzburg': '德班-彼得马里茨堡',
  Nairobi: '内罗毕',
  Marrakech: '马拉喀什',
  Vancouver: '温哥华',
  'Buenos Aires': '布宜诺斯艾利斯',
  Santiago: '圣地亚哥',
  Stockholm: '斯德哥尔摩',
  Copenhagen: '哥本哈根',
  Helsinki: '赫尔辛基',
  Bergen: '卑尔根',
  Brussels: '布鲁塞尔',
  Vienna: '维也纳',
  Warsaw: '华沙',
  Prague: '布拉格',
  Athens: '雅典',
  Jerusalem: '耶路撒冷',
  Istanbul: '伊斯坦布尔',
  Dubai: '迪拜',
  Doha: '多哈',
  Toronto: '多伦多',
  'Mexico City': '墨西哥城',
  'Rio de Janeiro': '里约热内卢',
  Beijing: '北京',
  'Hong Kong': '香港',
  Taipei: '台北',
  Seoul: '首尔',
  Singapore: '新加坡',
  'Kuala Lumpur': '吉隆坡',
  Mumbai: '孟买',
  Sydney: '悉尼',
  Auckland: '奥克兰',
  'Cape Town': '开普敦',
  'Los Angeles': '洛杉矶',
  'Washington, D.C.': '华盛顿',
  Fukuoka: '福冈',
  Guangzhou: '广州',
  Chengdu: '成都',
  Wuhan: '武汉',
  Qingdao: '青岛',
  Shenzhen: '深圳',
  Chongqing: '重庆',
  Hangzhou: '杭州',
  Dalian: '大连',
  Busan: '釜山',
  Dublin: '都柏林',
  Zurich: '苏黎世',
  Jakarta: '雅加达',
  'Ho Chi Minh City': '胡志明市',
};

const LOCALIZED_RACE_LABELS = {
  'tokyo-marathon': '东京马拉松',
  'osaka-marathon': '大阪马拉松',
  'boston-marathon': '波士顿马拉松',
  'chicago-marathon': '芝加哥马拉松',
  'new-york-city-marathon': '纽约马拉松',
  'big-sur-marathon': '大瑟尔国际马拉松',
  'honolulu-marathon': '檀香山马拉松',
  'london-marathon': '伦敦马拉松',
  'manchester-marathon': '曼彻斯特马拉松',
  'berlin-marathon': '柏林马拉松',
  'munich-marathon': '慕尼黑马拉松',
  'paris-marathon': '巴黎马拉松',
  'nice-cannes-marathon': '滨海阿尔卑斯马拉松',
  'amsterdam-marathon': '阿姆斯特丹马拉松',
  'rotterdam-marathon': '鹿特丹马拉松',
  'rome-marathon': '罗马马拉松',
  'milan-marathon': '米兰马拉松',
  'barcelona-marathon': '巴塞罗那马拉松',
  'valencia-marathon': '瓦伦西亚马拉松',
  'lisbon-marathon': '里斯本马拉松',
  'porto-marathon': '波尔图马拉松',
  'melbourne-marathon': '墨尔本马拉松',
  'gold-coast-marathon': '黄金海岸马拉松',
  'queenstown-marathon': '皇后镇马拉松',
  'shanghai-marathon': '上海马拉松',
  'xiamen-marathon': '厦门马拉松',
  'wuxi-marathon': '无锡马拉松',
  'gyeongju-marathon': '庆州樱花马拉松',
  'bangkok-marathon': '曼谷马拉松',
  'delhi-half-marathon': '德里半程马拉松',
  'comrades-marathon': '同志马拉松',
  'nairobi-city-marathon': '内罗毕城市马拉松',
  'marrakech-marathon': '马拉喀什马拉松',
  'vancouver-marathon': '温哥华马拉松',
  'buenos-aires-marathon': '布宜诺斯艾利斯马拉松',
  'santiago-marathon': '圣地亚哥马拉松',
  'stockholm-marathon': '斯德哥尔摩马拉松',
  'copenhagen-marathon': '哥本哈根马拉松',
  'helsinki-marathon': '赫尔辛基马拉松',
  'bergen-marathon': '卑尔根城市马拉松',
  'brussels-marathon': '布鲁塞尔机场马拉松',
  'vienna-marathon': '维也纳城市马拉松',
  'warsaw-marathon': '华沙马拉松',
  'prague-marathon': '布拉格马拉松',
  'athens-marathon': '雅典马拉松',
  'jerusalem-marathon': '耶路撒冷马拉松',
  'istanbul-marathon': '伊斯坦布尔马拉松',
  'dubai-marathon': '迪拜马拉松',
  'doha-marathon': '多哈马拉松',
  'toronto-waterfront-marathon': '多伦多湖滨马拉松',
  'mexico-city-marathon': '墨西哥城马拉松',
  'rio-marathon': '里约马拉松',
  'beijing-marathon': '北京马拉松',
  'hong-kong-marathon': '香港马拉松',
  'taipei-marathon': '台北马拉松',
  'seoul-marathon': '首尔马拉松',
  'singapore-marathon': '新加坡渣打马拉松',
  'kuala-lumpur-marathon': '吉隆坡渣打马拉松',
  'mumbai-marathon': '塔塔孟买马拉松',
  'sydney-marathon': '悉尼马拉松',
  'auckland-marathon': '奥克兰马拉松',
  'cape-town-marathon': '开普敦马拉松',
  'nairobi-marathon': '内罗毕马拉松',
  'los-angeles-marathon': '洛杉矶马拉松',
  'marine-corps-marathon': '海军陆战队马拉松',
  'fukuoka-marathon': '福冈马拉松',
  'guangzhou-marathon': '广州马拉松',
  'chengdu-marathon': '成都马拉松',
  'wuhan-marathon': '武汉马拉松',
  'qingdao-marathon': '青岛马拉松',
  'shenzhen-marathon': '深圳马拉松',
  'chongqing-marathon': '重庆马拉松',
  'hangzhou-marathon': '杭州马拉松',
  'dalian-marathon': '大连马拉松',
  'busan-marathon': '釜山马拉松',
  'dublin-marathon': '都柏林马拉松',
  'zurich-marathon': '苏黎世马拉松',
  'jakarta-marathon': '雅加达马拉松',
  'ho-chi-minh-city-marathon': '胡志明市马拉松',
  'nyrr-brooklyn-half': 'NYRR 布鲁克林半马',
  'nyrr-united-half': '联合航空纽约半马',
};

function getLocalizedCatalogMatch(race) {
  if (race?.id && LOCALIZED_RACE_LABELS[race.id]) {
    return worldRaceCatalog.find((entry) => entry.id === race.id) || race;
  }
  return worldRaceCatalog.find((entry) => entry.name === race?.name) || null;
}

export function getSafeRaceTargetLabel(targetKey, lang) {
  const entry = SAFE_RACE_TARGET_LABELS[targetKey];
  if (!entry) return targetKey;
  return lang === 'en' ? entry.en : entry.zh;
}

export function getSafeCountryLabel(country, lang) {
  const entry = SAFE_COUNTRY_LABELS[country];
  if (!entry) return country;
  return lang === 'en' ? entry.en : entry.zh;
}

export function getLocalizedCountryLabel(country, lang) {
  const entry = LOCALIZED_COUNTRY_LABELS[country];
  if (!entry) return getSafeCountryLabel(country, lang);
  return lang === 'en' ? entry.en : entry.zh;
}

export function getLocalizedCityLabel(city, lang) {
  if (lang === 'en') return city;
  return LOCALIZED_CITY_LABELS[city] || city;
}

export function getLocalizedRaceLabel(race, lang) {
  if (lang === 'en') return race?.name || '';
  if (race?.id && LOCALIZED_RACE_LABELS[race.id]) return LOCALIZED_RACE_LABELS[race.id];
  const catalogMatch = getLocalizedCatalogMatch(race);
  if (catalogMatch && LOCALIZED_RACE_LABELS[catalogMatch.id]) return LOCALIZED_RACE_LABELS[catalogMatch.id];
  return race?.name || '';
}

export function getLocalizedRaceLocation(race, lang) {
  if (lang === 'en') return race?.location || '';
  const catalogMatch = getLocalizedCatalogMatch(race);
  const city = race?.city || catalogMatch?.city || '';
  const country = race?.country || catalogMatch?.country || '';
  const cityLabel = city ? getLocalizedCityLabel(city, lang) : '';
  const countryLabel = country ? getLocalizedCountryLabel(country, lang) : '';
  if (cityLabel && countryLabel) return `${cityLabel} · ${countryLabel}`;
  return cityLabel || countryLabel || race?.location || '';
}
