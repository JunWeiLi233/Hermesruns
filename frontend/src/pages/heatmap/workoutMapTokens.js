// Rendering tokens for the independently authored recorded-workout map.
export const MAP_TOKENS = Object.freeze({
  defaultColor: '#ff3038', hoverColor: '#ef1818', highlightColor: '#151b22',
  lineWeight: 1.6, hoverExtra: 1, opacity: .86, hitRadius: 7, hitCell: 64,
  tileSize: 256, heatHalo: 2, heatCeiling: 64, heatAlpha: .9, heatFalloff: 1.15, heatPriority: .1,
  overlapLimit: 8, heatYieldWorkouts: 8, hitYieldWorkouts: 24,
  coverageZoom:14,coverageFill:'#e69b25',coverageOutline:'#80530d',coverageOpacity:.24,coverageWeight:1,coverageMaxCells:5000,
  readThrottleRetries:1,readThrottleDefaultMs:60000,readThrottleMaxMs:60000,
  heatStops: [[0, 106, 101, 246], [.45, 120, 75, 225], [.72, 204, 49, 139], [1, 248, 35, 43]],
  geometryZoom:20,fitPadding:36,padding: .25, initialZoom: 14, worldCenter: [20, 0], worldZoom: 2,
});
export const DEFAULT_MAP_PREFERENCES = Object.freeze({mode:'lines',basemap:'streets',weight:MAP_TOKENS.lineWeight,
  color:MAP_TOKENS.defaultColor,hoverColor:MAP_TOKENS.hoverColor,highlightColor:MAP_TOKENS.highlightColor});
