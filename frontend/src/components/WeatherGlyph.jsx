function iconA11y(title) {
  return title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true };
}

function iconKind(code) {
  const numericCode = Number(code);
  if (!Number.isFinite(numericCode)) return 'cloud';
  if (numericCode === 0) return 'sun';
  if (numericCode >= 1 && numericCode <= 2) return 'partly-cloudy';
  if (numericCode === 3) return 'cloud';
  if (numericCode >= 45 && numericCode <= 48) return 'fog';
  if (numericCode >= 51 && numericCode <= 57) return 'drizzle';
  if ((numericCode >= 61 && numericCode <= 67) || (numericCode >= 80 && numericCode <= 82)) return 'rain';
  if ((numericCode >= 71 && numericCode <= 77) || (numericCode >= 85 && numericCode <= 86)) return 'snow';
  if (numericCode >= 95 && numericCode <= 99) return 'storm';
  return 'cloud';
}

function BaseIcon({ className = '', title, children }) {
  const mergedClassName = ['weather-glyph', className].filter(Boolean).join(' ');
  return (
    <span className={mergedClassName} {...iconA11y(title)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

function SunGlyph(props) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.8v2.3M12 18.9v2.3M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.8 12h2.3M18.9 12h2.3M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
    </BaseIcon>
  );
}

function PartlyCloudyGlyph(props) {
  return (
    <BaseIcon {...props}>
      <circle cx="16.2" cy="7.2" r="2.8" fill="currentColor" fillOpacity="0.14" />
      <circle cx="16.2" cy="7.2" r="2.8" />
      <path d="M16.2 2.6v1.2M20.8 7.2h-1.2M19.5 3.9l-.9.9" />
      <path d="M6.5 18h10.3a3.3 3.3 0 0 0 .1-6.6 4.9 4.9 0 0 0-9.4-1.2A3.6 3.6 0 0 0 6.5 18Z" fill="currentColor" fillOpacity="0.08" />
      <path d="M6.5 18h10.3a3.3 3.3 0 0 0 .1-6.6 4.9 4.9 0 0 0-9.4-1.2A3.6 3.6 0 0 0 6.5 18Z" />
    </BaseIcon>
  );
}

function CloudGlyph(props) {
  return (
    <BaseIcon {...props}>
      <path d="M5.9 17.9h11a3.5 3.5 0 0 0 .2-7 5.1 5.1 0 0 0-9.8-1.2 3.7 3.7 0 0 0-1.4 8.2Z" fill="currentColor" fillOpacity="0.1" />
      <path d="M5.9 17.9h11a3.5 3.5 0 0 0 .2-7 5.1 5.1 0 0 0-9.8-1.2 3.7 3.7 0 0 0-1.4 8.2Z" />
      <path d="M8.1 20h8" strokeOpacity="0.38" />
    </BaseIcon>
  );
}

function FogGlyph(props) {
  return (
    <BaseIcon {...props}>
      <path d="M8 13.2h8a3 3 0 1 0-.1-6 4.6 4.6 0 0 0-8.8.9A3.3 3.3 0 0 0 8 13.2Z" />
      <path d="M5.5 16.3h13M7.2 19.4h9.6" />
    </BaseIcon>
  );
}

function DrizzleGlyph(props) {
  return (
    <BaseIcon {...props}>
      <path d="M7.9 12.8h8.5a3.5 3.5 0 0 0 .2-7 5.2 5.2 0 0 0-10-1.1 3.8 3.8 0 0 0 1.3 8.1Z" />
      <path d="M9 16.7l-.7 1.5M13 16.7l-.7 1.5M17 16.7l-.7 1.5" />
    </BaseIcon>
  );
}

function RainGlyph(props) {
  return (
    <BaseIcon {...props}>
      <path d="M7.9 12.6h8.5a3.5 3.5 0 0 0 .2-7 5.2 5.2 0 0 0-10-1.1 3.8 3.8 0 0 0 1.3 8.1Z" />
      <path d="M9.3 16.1 8 20M13 16.1 11.7 20M16.7 16.1 15.4 20" />
    </BaseIcon>
  );
}

function SnowGlyph(props) {
  return (
    <BaseIcon {...props}>
      <path d="M7.9 12.3h8.5a3.5 3.5 0 0 0 .2-7 5.2 5.2 0 0 0-10-1.1 3.8 3.8 0 0 0 1.3 8.1Z" />
      <path d="M9.5 16.2v3.3M7.9 17.8h3.2M8.3 16.6l2.4 2.4M10.7 16.6l-2.4 2.4" />
      <path d="M15.5 16.2v3.3M13.9 17.8h3.2M14.3 16.6l2.4 2.4M16.7 16.6l-2.4 2.4" />
    </BaseIcon>
  );
}

function StormGlyph(props) {
  return (
    <BaseIcon {...props}>
      <path d="M7.9 12.5h8.5a3.5 3.5 0 0 0 .2-7 5.2 5.2 0 0 0-10-1.1 3.8 3.8 0 0 0 1.3 8.1Z" />
      <path d="m12.7 13.8-2.4 4.2h2.4l-1 3.2 4-5h-2.5l1.2-2.4" />
    </BaseIcon>
  );
}

const COMPONENTS = {
  sun: SunGlyph,
  'partly-cloudy': PartlyCloudyGlyph,
  cloud: CloudGlyph,
  fog: FogGlyph,
  drizzle: DrizzleGlyph,
  rain: RainGlyph,
  snow: SnowGlyph,
  storm: StormGlyph,
};

export function WeatherGlyph({ code, className = '', title }) {
  const Component = COMPONENTS[iconKind(code)] || CloudGlyph;
  return <Component className={className} title={title} />;
}

export function TemperatureGlyph({ className = '', title }) {
  return (
    <BaseIcon className={className} title={title}>
      <path d="M10.5 5.5a1.5 1.5 0 1 1 3 0v7.1a4.1 4.1 0 1 1-3 0Z" />
      <path d="M12 14.2v4.3" />
      <path d="M12 18.5a2 2 0 1 0 0 .1Z" />
    </BaseIcon>
  );
}
