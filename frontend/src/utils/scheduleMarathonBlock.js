const DAY_MS = 24 * 60 * 60 * 1000;
const MARATHON_DISTANCE_THRESHOLD_KM = 40;

function roundDistanceKm(value) {
  const distance = Number(value);
  if (!Number.isFinite(distance) || distance <= 0) return null;
  return Math.round(distance * 10) / 10;
}

function parseDateOnly(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function normalizeDate(value) {
  if (!value) return new Date();
  if (value instanceof Date) return new Date(value);
  return new Date(`${value}T00:00:00`);
}

export function buildScheduleTargetBlockModel(activeBlock, options = {}) {
  if (!activeBlock || typeof activeBlock !== 'object') {
    return {
      hasActiveBlock: false,
      hasTargetRace: false,
      isMarathonBlock: false,
      raceDistanceKm: null,
      raceDistanceLabelKm: null,
      currentLongRunKm: null,
      countdownDays: null,
      countdownWeeks: null,
      targetRaceDate: null,
      weekIndex: null,
      name: '',
    };
  }

  const raceDistanceKm = roundDistanceKm(activeBlock.raceDistanceKm);
  const currentLongRunKm = roundDistanceKm(activeBlock.currentLongRunKm);
  const targetRaceDate = parseDateOnly(activeBlock.targetRaceDate);
  const today = normalizeDate(options.today);

  today.setHours(0, 0, 0, 0);

  const countdownDays = targetRaceDate
    ? Math.round((targetRaceDate.getTime() - today.getTime()) / DAY_MS)
    : null;

  return {
    hasActiveBlock: true,
    hasTargetRace: Boolean(targetRaceDate && raceDistanceKm),
    isMarathonBlock: Number(raceDistanceKm || 0) >= MARATHON_DISTANCE_THRESHOLD_KM,
    raceDistanceKm,
    raceDistanceLabelKm: raceDistanceKm != null ? raceDistanceKm.toFixed(1) : null,
    currentLongRunKm,
    countdownDays,
    countdownWeeks: countdownDays == null || countdownDays <= 0 ? countdownDays : Math.ceil(countdownDays / 7),
    targetRaceDate: targetRaceDate ? targetRaceDate.toISOString().slice(0, 10) : null,
    weekIndex: Number.isFinite(Number(activeBlock.weekIndex)) ? Number(activeBlock.weekIndex) : null,
    name: String(activeBlock.name || ''),
  };
}
