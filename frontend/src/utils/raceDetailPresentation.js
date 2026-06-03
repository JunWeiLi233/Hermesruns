export function deriveRaceMapPresentation({
  city = '',
  imageUrl = '',
  overlayBounds = null,
  routePoints = [],
} = {}) {
  const hasAlignedOverlay = Boolean(
    imageUrl
      && overlayBounds
      && Array.isArray(routePoints)
      && routePoints.length > 0,
  );

  return {
    mode: hasAlignedOverlay ? 'aligned-overlay' : imageUrl ? 'detected-image' : 'city-map',
    shouldRenderLeaflet: hasAlignedOverlay || !imageUrl,
    title: `${city || 'Race'} city map`,
  };
}

export function deriveRaceElevationPresentation({
  alignedElevationSamples = [],
  totalClimbMeters = null,
  citedProfileImageUrl = '',
  citedProfileSource = '',
  imageDerivedProfileSamples = [],
} = {}) {
  if (Array.isArray(alignedElevationSamples) && alignedElevationSamples.length > 0) {
    return {
      mode: 'aligned-route-chart',
      chartProfile: alignedElevationSamples,
      totalClimbMeters,
      peakMeters: Math.max(...alignedElevationSamples),
      source: '',
    };
  }

  return {
    mode: citedProfileImageUrl || citedProfileSource || imageDerivedProfileSamples.length ? 'profile-image' : 'empty',
    chartProfile: null,
    totalClimbMeters: null,
    peakMeters: null,
    source: citedProfileSource,
  };
}
