import { useEffect, useState } from 'react';
import adidasLogo from '../assets/brand-logos/adidas.webp';
import erkeLogo from '../assets/brand-logos/erke.webp';
import logo361 from '../assets/brand-logos/361.webp';
import asicsLogo from '../assets/brand-logos/asics.webp';
import newBalanceLogo from '../assets/brand-logos/new-balance.webp';
import nikeLogo from '../assets/brand-logos/nike.webp';
import pairanshaoLogo from '../assets/brand-logos/pairanshao-user.webp';
import pumaLogo from '../assets/brand-logos/puma-reference.webp';
import sauconyLogo from '../assets/brand-logos/saucony.webp';
import xtepLogo from '../assets/brand-logos/xtep.webp';
import altraLogo from '../assets/brand-logos/altra-user.webp';
import antaLogo from '../assets/brand-logos/anta-user.webp';
import bmaiLogo from '../assets/brand-logos/bmai-user.webp';
import brooksLogo from '../assets/brand-logos/brooks-user.webp';
import craftLogo from '../assets/brand-logos/craft-reference.webp';
import dayanLogo from '../assets/brand-logos/dayan-dynafish.webp';
import diadoraLogo from '../assets/brand-logos/diadora-reference.webp';
import doWinLogo from '../assets/brand-logos/do-win-user.webp';
import hokaLogo from '../assets/brand-logos/hoka.svg';
import inov8Logo from '../assets/brand-logos/inov8-user.webp';
import liningLogo from '../assets/brand-logos/lining-user.webp';
import macondoLogo from '../assets/brand-logos/macondo-reference.webp';
import laSportivaLogo from '../assets/brand-logos/la-sportiva-user.webp';
import merrellLogo from '../assets/brand-logos/merrell-user.webp';
import mizunoLogo from '../assets/brand-logos/mizuno-reference.webp';
import nordaLogo from '../assets/brand-logos/norda-user.webp';
import mountToCoastLogo from '../assets/brand-logos/mount-to-coast.webp';
import onLogo from '../assets/brand-logos/on-background-removed.webp';
import peakLogo from '../assets/brand-logos/peak-user.webp';
import qiaodanLogo from '../assets/brand-logos/qiaodan-user.webp';
import reebokLogo from '../assets/brand-logos/reebok-reference.webp';
import salomonLogo from '../assets/brand-logos/salomon-reference.webp';
import skechersLogo from '../assets/brand-logos/skechers-user.webp';
import topoAthleticLogo from '../assets/brand-logos/topo-athletic-user.webp';
import underArmourLogo from '../assets/brand-logos/under-armour-reference.webp';
import volantiLogo from '../assets/brand-logos/volanti-user.webp';
import karhuLogo from '../assets/brand-logos/karhu-reference.webp';
import kiprunLogo from '../assets/brand-logos/kiprun-background-removed.webp';
import kailasLogo from '../assets/brand-logos/kailas-reference.webp';
import radLogo from '../assets/brand-logos/rad-reference.webp';
import northFaceLogo from '../assets/brand-logos/the-north-face-reference.webp';
import haierLogo from '../assets/brand-logos/haier.webp';
import sonicCatLogo from '../assets/brand-logos/sonic-cat.webp';
import veirunLogo from '../assets/brand-logos/veirun.webp';
import pelliotLogo from '../assets/brand-logos/pelliot.webp';
import tracksmithLogo from '../assets/brand-logos/tracksmith.webp';
import tanSheZheLogo from '../assets/brand-logos/tanshezhe-user.webp';
import { getShoeBrandAssetKey, getShoeBrandFallbackSpec } from '../utils/shoeBrandLogo';
import removeBackground, { bgRemovedCache } from '../utils/removeBackground';

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
  kailas: kailasLogo,
  rad: radLogo,
  thenorthface: northFaceLogo,
  norda: nordaLogo,
  mounttocoast: mountToCoastLogo,
  on: onLogo,
  派燃烧: pairanshaoLogo,
  peak: peakLogo,
  qiaodan: qiaodanLogo,
  reebok: reebokLogo,
  salomon: salomonLogo,
  skechers: skechersLogo,
  soniccat: sonicCatLogo,
  topoathletic: topoAthleticLogo,
  underarmour: underArmourLogo,
  volanti: volantiLogo,
  haier: haierLogo,
  veirun: veirunLogo,
  pelliot: pelliotLogo,
  tracksmith: tracksmithLogo,
  弹射者: tanSheZheLogo,
};

function getBrandLogoAsset(brand) {
  return BRAND_LOGO_ASSETS[getShoeBrandAssetKey(brand)] || null;
}

export function hasShoeBrandLogo(brand) {
  const brandName = typeof brand === 'string' ? brand : brand?.brand;
  const explicitLogoUrl = typeof brand === 'object' ? brand?.logoUrl : '';
  return Boolean(explicitLogoUrl || getBrandLogoAsset(brandName));
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

function BackgroundRemovedBrandLogo({ src, brand, loading }) {
  const shouldRemoveBackground = ['lasportiva', 'skechers', 'kiprun'].includes(getShoeBrandAssetKey(brand));
  const imageClassName = `shoe-brand-logo-svg shoe-brand-logo-img${getShoeBrandAssetKey(brand) === 'bmai' ? ' shoe-brand-logo-img--bmai' : ''}`;
  const [processedSrc, setProcessedSrc] = useState(() => (
    shouldRemoveBackground ? bgRemovedCache[src] || null : null
  ));

  useEffect(() => {
    if (!shouldRemoveBackground || !src) {
      setProcessedSrc(null);
      return undefined;
    }
    if (bgRemovedCache[src]) {
      setProcessedSrc(bgRemovedCache[src]);
      return undefined;
    }

    let cancelled = false;
    removeBackground(src).then((result) => {
      if (cancelled) return;
      bgRemovedCache[src] = result;
      setProcessedSrc(result);
    });

    return () => {
      cancelled = true;
    };
  }, [shouldRemoveBackground, src]);

  return (
    <img
      className={imageClassName}
      src={shouldRemoveBackground ? processedSrc || src : src}
      alt={`${brand} logo`}
      width="256"
      height="256"
      loading={loading}
      decoding="async"
    />
  );
}

export default function ShoeBrandLogo({ brand, fallbackEmoji, logoUrl, loading = 'lazy' }) {
  if (logoUrl) {
    return (
      <BackgroundRemovedBrandLogo src={logoUrl} brand={brand} loading={loading} />
    );
  }

  const asset = getBrandLogoAsset(brand);
  if (asset) {
    return (
      <BackgroundRemovedBrandLogo src={asset} brand={brand} loading={loading} />
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
