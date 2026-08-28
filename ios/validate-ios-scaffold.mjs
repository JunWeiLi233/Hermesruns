import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, 'HermesRuns');
const testRoot = join(here, 'HermesRunsTests');
const projectFile = join(here, 'HermesRuns.xcodeproj', 'project.pbxproj');
const schemeFile = join(here, 'HermesRuns.xcodeproj', 'xcshareddata', 'xcschemes', 'HermesRuns.xcscheme');

const requiredFiles = [
  'HermesRunsApp.swift',
  'Models/HermesModels.swift',
  'Networking/HermesAPIClient.swift',
  'Storage/KeychainStore.swift',
  'Stores/SessionStore.swift',
  'Theme/HermesTheme.swift',
  'Views/RootView.swift',
  'Views/LoginView.swift',
  'Views/ForgotPasswordView.swift',
  'Views/RunDetailView.swift',
  'Views/MainTabView.swift',
  'Views/TodayView.swift',
  'Views/RunsView.swift',
  'Views/RunDetailView.swift',
  'Views/ShoesView.swift',
  'Views/ShoeEditorView.swift',
  'Views/MoreView.swift',
  'Views/MuscleTrainingView.swift',
  'Views/WellnessView.swift',
  'Views/StravaSyncView.swift',
  'Views/ImportDataView.swift',
  'Views/AnalysisView.swift',
  'Views/RacesView.swift',
  'Views/RaceEditorView.swift',
  'Views/RaceDetailView.swift',
  'Views/ScheduleView.swift',
  'Views/RewardsView.swift',
  'Views/ProfileView.swift',
  'Views/WeatherView.swift',
  'Views/SettingsView.swift',
  'Resources/Info.plist',
];

assert.ok(existsSync(projectFile), 'The iOS Xcode project must exist.');
assert.ok(existsSync(schemeFile), 'The shared HermesRuns scheme must exist.');
assert.ok(existsSync(projectRoot), 'The HermesRuns app source directory must exist.');
assert.ok(existsSync(join(testRoot, 'HermesRunsTests.swift')), 'The XCTest source must exist.');

for (const relativePath of requiredFiles) {
  assert.ok(existsSync(join(projectRoot, relativePath)), `Missing iOS source: ${relativePath}`);
}

const project = readFileSync(projectFile, 'utf8');
const scheme = readFileSync(schemeFile, 'utf8');
assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER = com\.hermesruns\.ios;/);
assert.match(project, /IPHONEOS_DEPLOYMENT_TARGET = 16\.0;/);
assert.match(project, /HermesRunsApp\.swift/);
assert.match(project, /Info\.plist/);
assert.match(scheme, /BlueprintName = "HermesRuns"/);
assert.match(scheme, /BlueprintName = "HermesRunsTests"/);
for (const relativePath of requiredFiles.filter((file) => file.endsWith('.swift'))) {
  assert.ok(project.includes(relativePath.split('/').at(-1)), `Xcode project does not reference ${relativePath}`);
}

const infoPlist = readFileSync(join(projectRoot, 'Resources/Info.plist'), 'utf8');
assert.match(infoPlist, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
assert.match(infoPlist, /<plist version="1\.0">[\s\S]*<\/plist>/);

const app = readFileSync(join(projectRoot, 'HermesRunsApp.swift'), 'utf8');
const client = readFileSync(join(projectRoot, 'Networking/HermesAPIClient.swift'), 'utf8');
const tabs = readFileSync(join(projectRoot, 'Views/MainTabView.swift'), 'utf8');
const login = readFileSync(join(projectRoot, 'Views/LoginView.swift'), 'utf8');
const settings = readFileSync(join(projectRoot, 'Views/SettingsView.swift'), 'utf8');
assert.match(app, /@main/);
assert.match(login, /openSignup/);
assert.match(login, /signup/);
assert.match(client, /\/api\/auth\/login/);
assert.match(client, /\/api\/auth\/password-reset\/request/);
assert.match(client, /\/api\/today\/dashboard/);
assert.match(client, /\/api\/profile\/me\/name/);
assert.match(client, /\/api\/profile\/preferences/);
assert.match(client, /\/api\/import\/batch/);
assert.match(client, /\/api\/coach\/schedule/);
assert.match(client, /\/api\/activities\/analysis/);
assert.match(client, /\/api\/activities\/.*analytics/);
assert.match(client, /\/api\/activities\/.*telemetry/);
assert.match(client, /\/api\/activities\/.*points/);
assert.match(client, /\/api\/shoes/);
assert.match(client, /\/retire/);
assert.match(client, /\/api\/races/);
assert.match(client, /\/api\/races\/course-map/);
assert.match(client, /\/api\/training\/muscle\/profile/);
assert.match(client, /\/api\/training\/muscle\/plan/);
assert.match(client, /\/api\/training\/muscle\/today/);
assert.match(client, /\/api\/injury-risk\/status/);
assert.match(client, /\/api\/injury-risk\/soreness/);
assert.match(client, /\/api\/auth\/strava\/status/);
assert.match(client, /\/api\/auth\/strava\/link-url/);
assert.match(client, /\/api\/strava\/sync/);
assert.match(client, /\/api\/auth\/strava\/sync-status/);
assert.match(tabs, /TodayView/);
assert.match(tabs, /RunsView/);
assert.match(tabs, /ShoesView/);
assert.match(tabs, /MoreView/);
const runs = readFileSync(join(projectRoot, 'Views/RunsView.swift'), 'utf8');
assert.match(runs, /RunDetailView/);
const runDetail = readFileSync(join(projectRoot, 'Views/RunDetailView.swift'), 'utf8');
assert.match(runDetail, /postRunReview/);
const shoes = readFileSync(join(projectRoot, 'Views/ShoesView.swift'), 'utf8');
assert.match(shoes, /ShoeEditorView/);
const races = readFileSync(join(projectRoot, 'Views/RacesView.swift'), 'utf8');
const raceDetail = readFileSync(join(projectRoot, 'Views/RaceDetailView.swift'), 'utf8');
assert.match(races, /RaceEditorView/);
assert.match(races, /RaceDetailView/);
assert.match(raceDetail, /fetchRaceCourseMap/);
const more = readFileSync(join(projectRoot, 'Views/MoreView.swift'), 'utf8');
assert.match(more, /MuscleTrainingView/);
const muscle = readFileSync(join(projectRoot, 'Views/MuscleTrainingView.swift'), 'utf8');
assert.match(muscle, /updateMuscleCheckIn/);
const wellness = readFileSync(join(projectRoot, 'Views/WellnessView.swift'), 'utf8');
assert.match(wellness, /logSoreness/);
const strava = readFileSync(join(projectRoot, 'Views/StravaSyncView.swift'), 'utf8');
const imports = readFileSync(join(projectRoot, 'Views/ImportDataView.swift'), 'utf8');
assert.match(strava, /startStravaSync/);
assert.match(imports, /importActivityFiles/);
assert.match(more, /ImportDataView/);
assert.match(settings, /saveProfileSettings/);
assert.match(settings, /weeklyDigestEnabled/);
assert.match(project, /HermesRunsTests\.swift/);

console.log('[PASS] HermesRuns iOS scaffold contract passed.');
