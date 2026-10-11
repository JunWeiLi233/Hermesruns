/** The words for a best effort, shared by the run page and the Profile page. `t` is the translator from useI18n. */

/** "5 km", "1 mile", "Half marathon": the name of a distance by the key the server sends. */
export function distanceName(t, key) {
  return t(`best_efforts.distance_${key}`);
}

/** "PR", "2nd", "3rd", "#4": where an effort ranks among the runner's efforts at that distance. */
export function placeName(t, rank) {
  if (rank === 1) return t('best_efforts.place_pr');
  if (rank === 2) return t('best_efforts.place_2nd');
  if (rank === 3) return t('best_efforts.place_3rd');
  return t('best_efforts.place_number', { n: rank });
}

/** The class a place pill takes, so the top three can be told apart by more than their words. */
export function placeTone(rank) {
  if (rank === 1) return 'is-pr';
  if (rank === 2 || rank === 3) return 'is-podium';
  return 'is-other';
}
