export function intervalFixture({ missingHr = false, unknown = false } = {}) {
  let cursor = 0;
  const segments = [];
  for (let rep = 0; rep < 6; rep += 1) {
    const seconds = 100 + rep * 10;
    segments.push({
      id: `w${rep + 1}`, kind: unknown ? 'unknown' : 'work', label: `Rep ${rep + 1}`, targetPaceSecondsPerKm: null,
      startSeconds: cursor, endSeconds: cursor + seconds,
      measurements: { elapsedDurationSeconds: seconds, durationSeconds: seconds - 5, distanceMeters: 400 + rep * 50,
        averageHeartRate: missingHr && rep % 2 ? null : 150 + rep,
        hrCoverageSeconds: missingHr && rep % 2 ? 0 : seconds - 5, measurementProvenance: 'source-lap' },
      provenance: unknown ? 'unavailable' : 'imported',
    });
    cursor += seconds;
    if (rep < 5) {
      segments.push({
        id: `r${rep + 1}`, kind: unknown ? 'unknown' : 'recovery', label: 'Rest', targetPaceSecondsPerKm: null,
        startSeconds: cursor, endSeconds: cursor + 60,
        measurements: { elapsedDurationSeconds: 60, durationSeconds: 50, distanceMeters: 100, averageHeartRate: 120, hrCoverageSeconds: 50, measurementProvenance: 'source-lap' },
        provenance: unknown ? 'unavailable' : 'imported',
      });
      cursor += 60;
    }
  }
  return {
    activityId: 9,
    source: { provider: 'GARMIN', distanceMeters: 3650, elapsedDurationSeconds: 1050, durationSeconds: 970, movingTimeSeconds: 970, importedLapsSupported: true },
    declarations: { segments: null, comparison: { workout: '6 reps', route: null, terrain: null, surface: 'track', weather: null } },
    sourceSegments: structuredClone(segments),
    measurements: { durationSeconds: 970, elapsedDurationSeconds: 1050, distanceMeters: 3650, averageHeartRate: null, hrCoverageSeconds: 0 },
    recorded: { rpe: { value: null, provenance: 'unavailable' }, conditions: {} },
    measurementRules: { heartRateIntegration: 'trapezoid-adjacent-valid-endpoints', maximumIntegratedGapSeconds: 10, coverageDenominator: 'elapsed-boundary-span' },
    segments,
  };
}

export function stationaryWorkFixture() {
  const fixture = intervalFixture();
  fixture.source = { ...fixture.source, distanceMeters: 1000, durationSeconds: 300, elapsedDurationSeconds: 300, movingTimeSeconds: 240 };
  fixture.segments = [
    { ...fixture.segments[0], id: 'moving-work', kind: 'work', startSeconds: 0, endSeconds: 240, label: 'Moving work',
      measurements: { ...fixture.segments[0].measurements, durationSeconds: 240, elapsedDurationSeconds: 240, distanceMeters: 1000, averageHeartRate: null, hrCoverageSeconds: 0 } },
    { ...fixture.segments[2], id: 'stationary-work', kind: 'work', startSeconds: 240, endSeconds: 300, label: 'Stationary work',
      measurements: { ...fixture.segments[2].measurements, durationSeconds: 60, elapsedDurationSeconds: 60, distanceMeters: 0, averageHeartRate: null, hrCoverageSeconds: 0 } },
  ];
  fixture.sourceSegments = structuredClone(fixture.segments);
  fixture.measurements = { ...fixture.measurements, durationSeconds: 300, elapsedDurationSeconds: 300, distanceMeters: 1000 };
  return fixture;
}
