import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath) => readFileSync(path.join(here, relativePath), 'utf8');

const todayRun = read('./todayRun.js');
const todayPage = read('../pages/today-run/TodayRun.jsx');
const schedulePage = read('../pages/schedule/Schedule.jsx');
const profilePage = read('../pages/profile/ProfileDashboard.jsx');
const coachInsightPage = read('../pages/analysis/AnalysisInsightDetail.jsx');
const en = read('../i18n/locales/en/pages.js');
const zh = read('../i18n/locales/zh-CN/pages.js');

assert.match(todayRun, /resolvePersonalizedCoachRecommendation/);
assert.match(todayRun, /personalized\?\.reasons \|\| buildReasons/);
assert.match(todayPage, /coachPayload[\s\S]*unit/);
assert.match(schedulePage, /coachPayload: coachToday/);
assert.match(profilePage, /coachPayload: coachToday/);
assert.match(coachInsightPage, /apiJson\('\/api\/coach\/today'\)/);
assert.match(coachInsightPage, /buildMergedCoachSystemModel\([\s\S]*coachToday/);
assert.match(en, /"personalized_reason_goal_specific"/);
assert.match(zh, /"personalized_reason_goal_specific"/);

console.log('personalized coach planner integration smoke test passed');
