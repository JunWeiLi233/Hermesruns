import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const analysisSource = readFileSync(path.join(here, "../Analysis.jsx"), 'utf8');
const englishComponents = readFileSync(path.join(here, "../../../i18n/locales/en/components.js"), 'utf8');
const chineseComponents = readFileSync(path.join(here, "../../../i18n/locales/zh-CN/components.js"), 'utf8');

assert.match(
  analysisSource,
  /const localizedCoachAdvice = injuryStatus\?\.risk === 'LOW'/,
  'Analysis should localize the low-risk coach advice by the returned risk level.',
);
assert.match(
  analysisSource,
  /\{localizedCoachAdvice\}/,
  'Analysis should render the localized coach advice instead of the raw backend sentence.',
);
assert.match(
  englishComponents,
  /"stitch_injury_prevention_coach_advice_low": "Your risk signals look manageable\. Keep training but stay mindful of recovery and movement quality\."/,
  'English should retain the original low-risk coach advice.',
);
assert.match(
  chineseComponents,
  /"stitch_injury_prevention_coach_advice_low": "你的风险信号目前在可控范围内。继续训练，但要留意恢复和动作质量。"/,
  'Chinese should provide a localized low-risk coach advice sentence.',
);

console.log('[PASS] Analysis low-risk coach advice localization guardrails passed.');
