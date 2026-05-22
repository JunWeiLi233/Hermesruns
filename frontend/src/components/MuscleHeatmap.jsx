import { memo, useMemo } from 'react';
import Body from 'react-muscle-highlighter';

const COLORS = [
  'var(--mt-heatmap-intensity-1)',
  'var(--mt-heatmap-intensity-2)',
  'var(--mt-heatmap-intensity-3)',
];

const ALL_SLUGS = new Set([
  'abs',
  'adductors',
  'ankles',
  'biceps',
  'calves',
  'chest',
  'deltoids',
  'feet',
  'forearm',
  'gluteal',
  'hamstring',
  'hands',
  'hair',
  'head',
  'knees',
  'lower-back',
  'neck',
  'obliques',
  'quadriceps',
  'tibialis',
  'trapezius',
  'triceps',
  'upper-back',
]);

const FRONT_SLUGS = new Set([
  'abs',
  'adductors',
  'ankles',
  'biceps',
  'calves',
  'chest',
  'deltoids',
  'feet',
  'forearm',
  'hands',
  'head',
  'knees',
  'neck',
  'obliques',
  'quadriceps',
  'tibialis',
  'trapezius',
  'triceps',
]);

const BACK_SLUGS = new Set([
  'calves',
  'deltoids',
  'forearm',
  'gluteal',
  'hair',
  'hamstring',
  'head',
  'lower-back',
  'neck',
  'trapezius',
  'triceps',
  'upper-back',
]);

function normalizeHeatmapData(data) {
  if (!Array.isArray(data)) return [];
  const bySlug = new Map();
  for (const entry of data) {
    if (!entry?.slug || !ALL_SLUGS.has(entry.slug)) continue;
    const intensity = Math.max(1, Math.min(3, Number(entry.intensity) || 1));
    const current = bySlug.get(entry.slug);
    if (!current || intensity > current.intensity) {
      bySlug.set(entry.slug, { ...entry, intensity });
    }
  }
  return Array.from(bySlug.values());
}

function resolveViews(data, side) {
  if (side === 'front') return { front: true, back: false };
  if (side === 'back') return { front: false, back: true };
  const hasFront = data.some((part) => FRONT_SLUGS.has(part.slug));
  const hasBack = data.some((part) => BACK_SLUGS.has(part.slug));
  return {
    front: hasFront || !hasBack,
    back: hasBack,
  };
}

function HeatmapBody({ side, data, scale, label }) {
  return (
    <div className="muscle-heatmap-cell">
      <div className="muscle-heatmap__body" aria-hidden="true">
        <Body
          data={data}
          side={side}
          gender="male"
          scale={scale}
          colors={COLORS}
          border="var(--mt-heatmap-border)"
          defaultFill="var(--mt-heatmap-default-fill)"
          defaultStroke="var(--mt-heatmap-default-stroke)"
          defaultStrokeWidth={0.8}
        />
      </div>
      <span className="muscle-heatmap-caption">{label}</span>
    </div>
  );
}

function MuscleHeatmap({
  data = [],
  side = 'auto',
  scale = 0.58,
  ariaLabel,
  frontLabel = 'Front',
  backLabel = 'Back',
}) {
  const normalizedData = useMemo(() => normalizeHeatmapData(data), [data]);
  const views = useMemo(() => resolveViews(normalizedData, side), [normalizedData, side]);

  return (
    <div
      className="muscle-heatmap-figure"
      role={ariaLabel ? 'group' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : 'true'}
    >
      {views.front && (
        <HeatmapBody side="front" data={normalizedData} scale={scale} label={frontLabel} />
      )}
      {views.back && (
        <HeatmapBody side="back" data={normalizedData} scale={scale} label={backLabel} />
      )}
    </div>
  );
}

export default memo(MuscleHeatmap);
