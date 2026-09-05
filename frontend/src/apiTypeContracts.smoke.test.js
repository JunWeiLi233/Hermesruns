import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

assert.equal(existsSync(path.join(root, 'src', 'api.ts')), true, 'The API client should be the first TypeScript migration seam.');
assert.equal(existsSync(path.join(root, 'src', 'api.js')), false, 'The untyped API client should not remain beside api.ts.');

const tsconfig = read('./tsconfig.json');
assert.match(tsconfig, /"strict"\s*:\s*true/);
assert.match(tsconfig, /"allowJs"\s*:\s*true/);
assert.match(tsconfig, /"noEmit"\s*:\s*true/);

const apiSource = read('./src/api.ts');
assert.match(apiSource, /export class ApiRequestError extends Error/);
assert.match(apiSource, /export async function apiJson<T = unknown>/);
assert.match(apiSource, /Promise<T>/);

const commonContracts = read('./src/contracts/api.ts');
assert.match(commonContracts, /export interface PaginatedResponse<T>/);
assert.match(commonContracts, /export type ApiErrorPayload/);

const predictionContracts = read('./src/contracts/prediction.ts');
assert.match(predictionContracts, /export interface PredictionWeatherAdjustment/);
assert.match(predictionContracts, /export interface RacePredictionSelection/);
assert.match(read('./src/pages/prediction/PredictionDetail.jsx'), /selectRacePrediction/);

const activityContracts = read('./src/contracts/activity.ts');
assert.match(activityContracts, /export interface ActivitySummary/);

const activityApi = read('./src/api/activityApi.ts');
assert.match(activityApi, /apiJson<unknown>\('\/api\/activities'/);
assert.match(activityApi, /Promise<ActivitySummary\[\]>/);
assert.match(read('./src/pages/prediction/PredictionDetail.jsx'), /fetchActivitySummaries/);

console.log('[PASS] Incremental TypeScript API and domain contract seam passed.');
