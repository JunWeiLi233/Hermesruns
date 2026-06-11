const BRAND_ALIASES = {
  '361°': '361',
  '鸿星尔克': 'erke',
  '彪马': 'puma',
  '特步': 'xtep',
};

export function normalizeShoeBrandKey(brand) {
  return (brand || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s!.,'"-]+/g, '');
}

export function getShoeBrandAssetKey(brand) {
  const normalized = normalizeShoeBrandKey(brand);
  return BRAND_ALIASES[brand] || BRAND_ALIASES[normalized] || normalized || null;
}

export function getShoeBrandFallbackSpec(brand) {
  const key = getShoeBrandAssetKey(brand);
  const make = ({ bg, fg, text }) => ({
    bg,
    fg,
    text,
    fontSize: /[\u4e00-\u9fff]/.test(text) ? 12 : 13,
  });

  if (key === 'nike') return make({ bg: '#f97316', fg: '#ffffff', text: 'NIKE' });
  if (key === 'adidas') return make({ bg: '#111827', fg: '#ffffff', text: 'ADID' });
  if (key === 'asics') return make({ bg: '#2563eb', fg: '#ffffff', text: 'ASICS' });
  if (key === 'newbalance') return make({ bg: '#fbbf24', fg: '#0f172a', text: 'NB' });
  if (key === 'hoka') return make({ bg: '#22c55e', fg: '#ffffff', text: 'HOKA' });
  if (key === 'brooks') return make({ bg: '#3b82f6', fg: '#ffffff', text: 'BROOKS' });
  if (key === 'saucony') return make({ bg: '#ef4444', fg: '#ffffff', text: 'SAU' });
  if (key === 'on') return make({ bg: '#e5e7eb', fg: '#0f172a', text: 'ON' });
  if (key === 'mizuno') return make({ bg: '#8b5cf6', fg: '#ffffff', text: 'M' });
  if (key === 'altra') return make({ bg: '#a16207', fg: '#ffffff', text: 'AL' });
  if (key === 'puma') return make({ bg: '#0f172a', fg: '#ffffff', text: 'PUMA' });
  if (key === 'reebok') return make({ bg: '#f59e0b', fg: '#0f172a', text: 'REEB' });
  if (key === 'underarmour' || key === 'ua') return make({ bg: '#111827', fg: '#ffffff', text: 'UA' });
  if (key === '361' || key.includes('361')) return make({ bg: '#1d4ed8', fg: '#ffffff', text: '361' });
  if (key === 'lining') return make({ bg: '#dc2626', fg: '#ffffff', text: 'LI' });
  if (key === 'anta') return make({ bg: '#f97316', fg: '#ffffff', text: 'ANTA' });
  if (key === 'xtep') return make({ bg: '#2563eb', fg: '#ffffff', text: 'XTEP' });
  if (key === 'skechers') return make({ bg: '#06b6d4', fg: '#ffffff', text: 'S' });
  if (key === 'erke') return make({ bg: '#60a5fa', fg: '#0b1220', text: 'ERKE' });
  if (key === 'peak') return make({ bg: '#ef4444', fg: '#ffffff', text: 'PEAK' });
  if (key === 'qiaodan') return make({ bg: '#111827', fg: '#ffffff', text: 'QD' });
  if (key === 'warrior') return make({ bg: '#dc2626', fg: '#ffffff', text: 'WAR' });
  if (key === 'doublestar') return make({ bg: '#64748b', fg: '#ffffff', text: 'DS' });

  return null;
}
