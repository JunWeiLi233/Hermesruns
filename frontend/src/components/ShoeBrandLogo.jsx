import adidasLogo from '../assets/brand-logos/adidas.png';
import erkeLogo from '../assets/brand-logos/erke.jpg';
import logo361 from '../assets/brand-logos/361.webp';
import asicsLogo from '../assets/brand-logos/asics.webp';
import newBalanceLogo from '../assets/brand-logos/new-balance.png';
import nikeLogo from '../assets/brand-logos/nike.webp';
import pumaLogo from '../assets/brand-logos/puma-reference.png';
import sauconyLogo from '../assets/brand-logos/saucony.png';
import xtepLogo from '../assets/brand-logos/xtep.png';
import altraLogo from '../assets/brand-logos/altra-user.png';
import antaLogo from '../assets/brand-logos/anta-user.png';
import bmaiLogo from '../assets/brand-logos/bmai-user.png';
import brooksLogo from '../assets/brand-logos/brooks-user.png';
import craftLogo from '../assets/brand-logos/craft-reference.png';
import dayanLogo from '../assets/brand-logos/dayan-dynafish.png';
import diadoraLogo from '../assets/brand-logos/diadora-reference.png';
import doWinLogo from '../assets/brand-logos/do-win-user.png';
import hokaLogo from '../assets/brand-logos/hoka.svg';
import inov8Logo from '../assets/brand-logos/inov8-user.png';
import liningLogo from '../assets/brand-logos/lining-user.png';
import macondoLogo from '../assets/brand-logos/macondo-reference.png';
import laSportivaLogo from '../assets/brand-logos/la-sportiva-user.png';
import merrellLogo from '../assets/brand-logos/merrell-user.png';
import mizunoLogo from '../assets/brand-logos/mizuno-reference.png';
import nordaLogo from '../assets/brand-logos/norda-user.png';
import onLogo from '../assets/brand-logos/on-background-removed.png';
import peakLogo from '../assets/brand-logos/peak-user.png';
import qiaodanLogo from '../assets/brand-logos/qiaodan-user.png';
import reebokLogo from '../assets/brand-logos/reebok-reference.png';
import salomonLogo from '../assets/brand-logos/salomon-reference.png';
import skechersLogo from '../assets/brand-logos/skechers-user.png';
import topoAthleticLogo from '../assets/brand-logos/topo-athletic-user.png';
import underArmourLogo from '../assets/brand-logos/under-armour-reference.png';
import volantiLogo from '../assets/brand-logos/volanti-user.png';
import karhuLogo from '../assets/brand-logos/karhu-reference.png';
import kiprunLogo from '../assets/brand-logos/kiprun-reference.png';
import { getShoeBrandAssetKey, getShoeBrandFallbackSpec } from '../utils/shoeBrandLogo';

const BRAND_LOGO_ASSETS = {
  '361': logo361,
  adidas: adidasLogo,
  asics: asicsLogo,
  erke: erkeLogo,
  newbalance: newBalanceLogo,
  nike: nikeLogo,
  puma: pumaLogo,
  saucony: sauconyLogo,
  xtep: xtepLogo,
  altra: altraLogo,
  anta: antaLogo,
  bmai: bmaiLogo,
  brooks: brooksLogo,
  craft: craftLogo,
  dayan: dayanLogo,
  diadora: diadoraLogo,
  dowin: doWinLogo,
  hoka: hokaLogo,
  inov8: inov8Logo,
  lasportiva: laSportivaLogo,
  lining: liningLogo,
  macondo: macondoLogo,
  merrell: merrellLogo,
  mizuno: mizunoLogo,
  karhu: karhuLogo,
  kiprun: kiprunLogo,
  norda: nordaLogo,
  on: onLogo,
  peak: peakLogo,
  qiaodan: qiaodanLogo,
  reebok: reebokLogo,
  salomon: salomonLogo,
  skechers: skechersLogo,
  topoathletic: topoAthleticLogo,
  underarmour: underArmourLogo,
  volanti: volantiLogo,
};

function getBrandLogoAsset(brand) {
  return BRAND_LOGO_ASSETS[getShoeBrandAssetKey(brand)] || null;
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

  const spec = getShoeBrandFallbackSpec(brand);
  if (!spec) return undefined;
  return {
    [cssVarName]: `url("${buildFallbackBrandDataUrl(spec)}")`,
  };
}

export default function ShoeBrandLogo({ brand, fallbackEmoji, logoUrl, loading = 'lazy' }) {
  if (logoUrl) {
    return (
      <img
        className="shoe-brand-logo-svg shoe-brand-logo-img"
        src={logoUrl}
        alt={`${brand} logo`}
        loading={loading}
        decoding="async"
      />
    );
  }

  const asset = getBrandLogoAsset(brand);
  if (asset) {
    return (
      <img
        className="shoe-brand-logo-svg shoe-brand-logo-img"
        src={asset}
        alt={`${brand} logo`}
        loading={loading}
        decoding="async"
      />
    );
  }

  const spec = getShoeBrandFallbackSpec(brand);
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
}
