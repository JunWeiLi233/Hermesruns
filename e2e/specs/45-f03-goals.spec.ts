// F03 Set a goal and track it. Recon path: Progress -> Add Goal (sport, timeframe, metric, value) -> progress on Progress and on the run.
// Goals are milestone M6 and are not built; HermesRuns has only a race goal time on a saved race. These cases keep their numbers and
// are skipped until the screens exist. Nothing here is run; when M6 lands, fill the bodies in and remove .fixme.
import { test } from '../fixtures/test.ts';

test.describe('F03 goals (not built, M6)', () => {
  test.fixme('F03-H1 add a weekly distance goal: it shows on Home with 0 % progress, and fills as runs are imported', async () => {});
  test.fixme('F03-H2 add a monthly and an annual goal in time, run count and elevation; each reaches 100 % and says it is met', async () => {});
  test.fixme('F03-H3 a goal counts runs that were uploaded before it was created (the recon: Strava does)', async () => {});
  test.fixme('F03-H4 the run page says how much of the goal this run covered', async () => {});
  test.fixme('F03-E1 no goal yet: suggested goals from your own history are offered', async () => {});
  test.fixme('F03-E2 refused values: zero, negative, empty, a fraction of a run, a goal in the past, emoji, 10 000 characters', async () => {});
  test.fixme('F03-E3 double click on Save makes one goal; two tabs; refresh mid-way; edit and delete a goal', async () => {});
  test.fixme('F03-E4 a goal that crosses a time-zone or daylight-saving boundary counts the right days', async () => {});
  test.fixme('F03-N1 another runner cannot read, edit or delete your goal (404), and a signed-out caller gets 401', async () => {});
});
