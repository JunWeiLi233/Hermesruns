import { memo } from 'react';
import adidasLogo from '../assets/brand-logos/adidas.png';
import altraLogo from '../assets/brand-logos/altra.svg';
import brooksLogo from '../assets/brand-logos/brooks.svg';
import dayanLogo from '../assets/brand-logos/dayan.svg';
import erkeLogo from '../assets/brand-logos/erke.jpg';
import logo361 from '../assets/brand-logos/361.webp';
import asicsLogo from '../assets/brand-logos/asics.webp';
import hokaLogo from '../assets/brand-logos/hoka.svg';
import inov8Logo from '../assets/brand-logos/inov-8.svg';
import macondoLogo from '../assets/brand-logos/macondo.svg';
import merrellLogo from '../assets/brand-logos/merrell.svg';
import mizunoLogo from '../assets/brand-logos/mizuno.svg';
import newBalanceLogo from '../assets/brand-logos/new-balance.png';
import nikeLogo from '../assets/brand-logos/nike.webp';
import nordaLogo from '../assets/brand-logos/norda.svg';
import onLogo from '../assets/brand-logos/on.svg';
import pumaLogo from '../assets/brand-logos/puma.png';
import qiaodanLogo from '../assets/brand-logos/qiaodan.svg';
import reebokLogo from '../assets/brand-logos/reebok.svg';
import salomonLogo from '../assets/brand-logos/salomon.svg';
import sauconyLogo from '../assets/brand-logos/saucony.png';
import skechersLogo from '../assets/brand-logos/skechers.svg';
import topoLogo from '../assets/brand-logos/topo-athletic.svg';
import underArmourLogo from '../assets/brand-logos/under-armour.svg';
import volantiLogo from '../assets/brand-logos/volanti.svg';
import xtepLogo from '../assets/brand-logos/xtep.png';

const BRAND_LOGO_ASSETS = {
  '361': logo361,
  adidas: adidasLogo,
  altra: altraLogo,
  asics: asicsLogo,
  brooks: brooksLogo,
  dayan: dayanLogo,
  '\u5927\u9cb6': dayanLogo,
  erke: erkeLogo,
  hoka: hokaLogo,
  inov8: inov8Logo,
  macondo: macondoLogo,
  '\u9a6c\u5b54\u591a': macondoLogo,
  merrell: merrellLogo,
  mizuno: mizunoLogo,
  newbalance: newBalanceLogo,
  nike: nikeLogo,
  norda: nordaLogo,
  on: onLogo,
  puma: pumaLogo,
  qiaodan: qiaodanLogo,
  '\u4e54\u4e39': qiaodanLogo,
  '\u4e2d\u56fd\u4e54\u4e39': qiaodanLogo,
  reebok: reebokLogo,
  salomon: salomonLogo,
  saucony: sauconyLogo,
  skechers: skechersLogo,
  topoathletic: topoLogo,
  underarmour: underArmourLogo,
  ua: underArmourLogo,
  volanti: volantiLogo,
  '\u6c83\u5170\u8fea': volantiLogo,
  '\u7279\u6b65': xtepLogo,
  xtep: xtepLogo,
};

function normalizeBrandKey(brand) {
  return (brand || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s!.,'"-]+/g, '');
}

function brandLogoSpec(brand) {
  const key = normalizeBrandKey(brand);
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
  if (key === 'lining' || key.includes('\u674e\u5b81')) return make({ bg: '#dc2626', fg: '#ffffff', text: 'LI' });
  if (key === 'anta' || key.includes('\u5b89\u8e0f')) return make({ bg: '#f97316', fg: '#ffffff', text: 'ANTA' });
  if (key === 'bmai' || key.includes('\u5fc5\u8fc8')) return make({ bg: '#43218a', fg: '#ffffff', text: 'BMAI' });
  if (key === 'dowin' || key.includes('\u591a\u5a01')) return make({ bg: '#dc2626', fg: '#ffffff', text: 'DW' });
  if (key === 'xtep' || key.includes('\u7279\u6b65')) return make({ bg: '#2563eb', fg: '#ffffff', text: 'XTEP' });
  if (key === 'skechers') return make({ bg: '#06b6d4', fg: '#ffffff', text: 'S' });
  if (key === 'erke') return make({ bg: '#60a5fa', fg: '#0b1220', text: 'ERKE' });
  if (key === 'peak' || key.includes('\u5339\u514b')) return make({ bg: '#ef4444', fg: '#ffffff', text: 'PEAK' });
  if (key === 'qiaodan' || key.includes('\u4e54\u4e39')) return make({ bg: '#111827', fg: '#ffffff', text: 'QD' });
  if (key === 'warrior') return make({ bg: '#dc2626', fg: '#ffffff', text: 'WAR' });
  if (key === 'doublestar') return make({ bg: '#64748b', fg: '#ffffff', text: 'DS' });

  return null;
}

function getBrandLogoAsset(brand) {
  return BRAND_LOGO_ASSETS[normalizeBrandKey(brand)] || null;
}

function buildFallbackBrandDataUrl(spec) {
  const encodedText = encodeURIComponent(spec.text);
  const encodedBg = encodeURIComponent(spec.bg);
  const encodedFg = encodeURIComponent(spec.fg);
  const fontSize = spec.fontSize;
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect x="10" y="10" width="100" height="100" rx="28" fill="${encodedBg}"/><text x="60" y="64" text-anchor="middle" dominant-baseline="middle" fill="${encodedFg}" font-family="system-ui,Segoe UI,Arial" font-size="${fontSize * 2.7}" font-weight="800">${encodedText}</text></svg>`;
}

export function getShoeBrandLogoBackgroundStyle(brand, cssVarName = '--add-shoes-brand-bg-image') {
  const asset = getBrandLogoAsset(brand);
  if (asset) {
    return {
      [cssVarName]: `url("${asset}")`,
    };
  }

  const spec = brandLogoSpec(brand);
  if (!spec) return undefined;
  return {
    [cssVarName]: `url("${buildFallbackBrandDataUrl(spec)}")`,
  };
}

const ShoeBrandLogo = memo(function ShoeBrandLogo({ brand, fallbackEmoji }) {
  const asset = getBrandLogoAsset(brand);
  if (asset) {
    return (
      <img
        className="shoe-brand-logo-svg shoe-brand-logo-img"
        src={asset}
        alt={`${brand} logo`}
        loading="lazy"
        decoding="async"
      />
    );
  }

  const spec = brandLogoSpec(brand);
  if (!spec) return <span className="shoe-brand-logo-fallback">{fallbackEmoji || 'S'}</span>;

  return (
    <svg className="shoe-brand-logo-svg" viewBox="0 0 40 40" role="img" aria-label={`${brand} logo`}>
      <rect x="2" y="2" width="36" height="36" rx="10" fill={spec.bg} />
      <text
        x="20"
        y="25"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={spec.fg}
        fontFamily={/[\u4e00-\u9fff]/.test(spec.text) ? '\'Microsoft YaHei\',\'PingFang SC\',system-ui,Segoe UI,Arial' : 'system-ui,Segoe UI,Arial'}
        fontSize={spec.fontSize}
        fontWeight="800"
      >
        {spec.text}
      </text>
    </svg>
  );
});

export default ShoeBrandLogo;
