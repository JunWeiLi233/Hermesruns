function dismissalKey(email) {
  const account = String(email || localStorage.getItem('hermes_email') || 'local').trim().toLowerCase();
  return `hermes.settings.completion.dismissed:${account}`;
}

export function isCompletionCardDismissed(email) {
  try {
    return localStorage.getItem(dismissalKey(email)) === '1';
  } catch {
    return false;
  }
}

export function dismissCompletionCard(email) {
  try {
    localStorage.setItem(dismissalKey(email), '1');
  } catch {
    // The component still dismisses the card for this visit if storage is blocked.
  }
}
