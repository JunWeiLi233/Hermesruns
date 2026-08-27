const BRAND_ALIASES = {
  '361°': '361',
  '鸿星尔克': 'erke',
  '彪马': 'puma',
  '特步': 'xtep',
  '李宁': 'lining',
  '安踏': 'anta',
  '匹克': 'peak',
  '中国乔丹': 'qiaodan',
  '乔丹': 'qiaodan',
  '必迈': 'bmai',
  '大雁': 'dayan',
  '大鲶': 'dayan',
  '多威': 'dowin',
  '马孔多': 'macondo',
  '沃兰迪': 'volanti',
  '沃尔朗迪': 'volanti',
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

  // These catalog brands do not yet have a verified local image asset. Keep a
  // brand-specific text mark in the shared resolver so catalog entries never
  // regress to a raw emoji while avoiding unverified marketplace image reuse.
  const catalogBrandMark = {
    伯希和: { bg: '#0f766e', fg: '#ffffff', text: '伯希和' },
    思凯乐: { bg: '#2563eb', fg: '#ffffff', text: '思凯乐' },
    uprun: { bg: '#4f46e5', fg: '#ffffff', text: 'UP' },
    海尔斯: { bg: '#1d4ed8', fg: '#ffffff', text: 'HEALTH' },
    辛逸: { bg: '#0891b2', fg: '#ffffff', text: '辛逸' },
    弹射者: { bg: '#ea580c', fg: '#ffffff', text: '弹射者' },
    威量: { bg: '#7c3aed', fg: '#ffffff', text: '威量' },
    音速猫: { bg: '#111827', fg: '#ffffff', text: '音速猫' },
    星火力: { bg: '#dc2626', fg: '#ffffff', text: 'MAX' },
    领跑梦想: { bg: '#ca8a04', fg: '#ffffff', text: 'LPMX' },
    燃动力: { bg: '#c2410c', fg: '#ffffff', text: '燃动力' },
    天赐之翼: { bg: '#0f766e', fg: '#ffffff', text: 'WING' },
    双星: { bg: '#475569', fg: '#ffffff', text: '双星' },
    双星八特: { bg: '#334155', fg: '#ffffff', text: '八特' },
    onemix: { bg: '#059669', fg: '#ffffff', text: 'ONEMIX' },
    freetie: { bg: '#0284c7', fg: '#ffffff', text: 'FREETIE' },
    派燃烧: { bg: '#be123c', fg: '#ffffff', text: '派燃烧' },
    强风跑霸: { bg: '#92400e', fg: '#ffffff', text: 'SUPWIND' },
    申亚: { bg: '#047857', fg: '#ffffff', text: '申亚' },
    轻跑者: { bg: '#7e22ce', fg: '#ffffff', text: '轻跑者' },
    喜得龙: { bg: '#0369a1', fg: '#ffffff', text: 'XDLONG' },
    r2realrun: { bg: '#111827', fg: '#ffffff', text: 'R2' },
    rad: { bg: '#334155', fg: '#ffffff', text: 'R.A.D' },
    nnormal: { bg: '#18181b', fg: '#ffffff', text: 'NN' },
    vj: { bg: '#0f766e', fg: '#ffffff', text: 'VJ' },
    kailas: { bg: '#0369a1', fg: '#ffffff', text: 'KAILAS' },
    mounttocoast: { bg: '#155e75', fg: '#ffffff', text: 'MTC' },
    thenorthface: { bg: '#b91c1c', fg: '#ffffff', text: 'TNF' },
    tracksmith: { bg: '#1e293b', fg: '#ffffff', text: 'TS' },
  }[key];
  if (catalogBrandMark) return make(catalogBrandMark);

  return null;
}
