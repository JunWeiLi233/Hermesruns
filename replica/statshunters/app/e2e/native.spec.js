import { test, expect, fixture, owner, password, screen } from './fixtures.js';

async function nativeLogin(page) {
  // This unrelated module is intentionally disabled in the disposable server.
  // Supply only its global unit-bootstrap DTO; every Explorer API stays real.
  let units='metric', revision=1;
  await page.route('**/api/training/me', async route => {
    if (route.request().method()==='PATCH') {units=route.request().postDataJSON().units || units;revision++;}
    await route.fulfill({json: {id: 'native-test-owner', units, revision, zone: 'America/New_York'}});
  });
  const response = await page.request.post('/api/auth/login', {data: {email: owner, password}});
  expect(response.ok()).toBeTruthy();
  const session = await response.json();
  expect(session.token).toBeTruthy();
  await page.addInitScript(({token, email}) => {
    if(sessionStorage.getItem('native-fixture-initialized'))return;
    sessionStorage.setItem('native-fixture-initialized','1');
    if (/^\/heatmap\/(unsubscribe|verify-report-email|reset-password|deletion)\/?$/.test(location.pathname)) {
      localStorage.removeItem('hermes_jwt');localStorage.removeItem('hermes_email');localStorage.removeItem('hermes_role');return;
    }
    localStorage.setItem('hermes_jwt', token);
    localStorage.setItem('hermes_email', email);
    localStorage.setItem('hermes_role', 'USER');
    if (!localStorage.getItem('hermes_lang')) localStorage.setItem('hermes_lang', 'en');
    if (!localStorage.getItem('hermes_theme')) localStorage.setItem('hermes_theme', 'light');
  }, {token: session.token, email: owner});
  return session.token;
}

test('N01 native Hermes heatmap keeps filters history statistics and refresh under the main route', async ({page}, info) => {
  await nativeLogin(page);
  await page.goto('/heatmap');
  await expect(page.getByRole('heading', {name: 'Places become familiar.'})).toBeVisible();
  expect(page.url()).not.toContain('/explorer/');
  await expect(page.locator('iframe')).toHaveCount(0);
  const navigation=page.getByRole('navigation', {name: 'Heatmap workspace'});
  await expect(page.getByRole('link', {name: 'Recorded GPS map'})).toHaveAttribute('href', '/heatmap/recorded');
  await screen(page, info, 'native-heatmap');
  await navigation.getByRole('link', {name: 'Activities', exact: true}).click();
  await page.getByRole('radio', {name: 'Table', exact: true}).check();
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByRole('link', {name: /^Filters/}).click();
  await page.getByLabel('Activity name', {exact: true}).fill('café');
  await page.getByRole('button', {name: 'Apply filters', exact: true}).click();
  await expect(page.getByRole('link', {name: 'Invented café 🚲', exact: true})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Invented dawn run', exact: true})).toHaveCount(0);
  await screen(page, info, 'native-filtered-history');
  await navigation.getByRole('link', {name: 'Statistics', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Small days add up.'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', {name: 'Small days add up.'})).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/heatmap/statistics');
  await screen(page, info, 'native-statistics');
});

test('N02 native file import from an empty workspace uses canonical jobs and survives main-route refresh', async ({page}, info) => {
  const token=await nativeLogin(page);
  await page.goto('/heatmap');
  await expect(page.getByRole('heading', {name: 'A map made of your own days outside'})).toBeVisible();
  await page.getByRole('button', {name: 'Add activity files', exact: true}).first().click();
  await page.getByLabel('FIT, GPX or TCX activity files').setInputFiles('../public/examples/independent-loop.gpx');
  await page.getByRole('checkbox', {name: 'I have permission to store and analyze these independently sourced activity files.'}).check();
  await page.getByRole('button', {name: 'Import files', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'From file to familiar ground.'})).toBeVisible();
  expect(new URL(page.url()).pathname).toMatch(/^\/heatmap\/jobs\//);
  await fixture(page.request, 'tick');
  await expect(page.getByText('complete', {exact: true}).first()).toBeVisible();
  const canonical=await page.request.get('/api/activities/analysis',{headers:{Authorization:`Bearer ${token}`}});
  expect(canonical.ok()).toBeTruthy();
  expect(await canonical.text()).toContain('Sunday reservoir circuit');
  await page.goto('/heatmap');
  await expect(page.getByRole('link', {name: 'Sunday reservoir circuit', exact: true}).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', {name: 'Sunday reservoir circuit', exact: true}).first()).toBeVisible();
  await screen(page, info, 'native-imported-map');
});

test('N03 public native opt-out works signed out and never becomes a Hermes login credential', async ({page}, info) => {
  const token=await nativeLogin(page);
  const response=await page.request.post('/api/explorer/email-preferences/verification', {headers: {'Authorization': `Bearer ${token}`, 'X-Explorer-Request': '1'}, data: {email: 'native.report@example.test'}});
  expect(response.ok()).toBeTruthy();
  await fixture(page.request, 'tick');
  const mails=await fixture(page.request, 'mail');
  const mail=mails.find(item=>item.subject==='Verify your Explorer report address');
  expect(mail.text).toContain('/heatmap/unsubscribe?token=');
  const capability=mail.text.match(/unsubscribe\?token=([a-f0-9]+)/)[1];
  await page.context().clearCookies();
  await page.addInitScript(()=>{localStorage.removeItem('hermes_jwt');localStorage.removeItem('hermes_email');localStorage.removeItem('hermes_role');});
  await page.goto(`/heatmap/unsubscribe?token=${capability}`);
  await page.getByRole('button', {name: 'Unsubscribe', exact: true}).click();
  await expect(page.getByText('Report email is turned off.', {exact: true})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('hermes_jwt'))).toBeNull();
  expect(new URL(page.url()).search).toBe('');
  await screen(page, info, 'native-public-unsubscribe');
  await page.getByRole('link',{name:'Privacy',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Privacy & removal',exact:true})).toBeVisible();
  await screen(page,info,'native-public-privacy');
});

test('N04 native preferences coordinate Hermes units language and appearance', async ({page}, info) => {
  await nativeLogin(page);
  await page.goto('/heatmap/settings');
  await page.getByRole('radio', {name: 'Miles', exact: true}).check();
  await page.getByLabel('Appearance', {exact: true}).selectOption('dark');
  await page.getByLabel('Language', {exact: true}).selectOption('zh-CN');
  await page.getByRole('button', {name: 'Save preferences', exact: true}).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('body')).toHaveClass(/theme-midnight/);
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('hermes_unit'))).toBe('mile');
  await page.getByRole('navigation', {name: '热力图工作区'}).getByRole('link', {name: '统计', exact: true}).click();
  await expect(page.getByRole('heading', {name: '每一天，都算数。'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', {name: '每一天，都算数。'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('hermes_unit'))).toBe('mile');
  await screen(page, info, 'native-preferences-chinese-dark');
});

test('N05 native deletion revokes Hermes access and preserves its public completion receipt', async ({page}, info) => {
  info.annotations.push({type:'expected-status',description:'401'});
  const token=await nativeLogin(page);
  await page.goto('/heatmap/settings');
  await page.getByRole('button', {name:'Delete account', exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Type DELETE to confirm', {exact:true}).fill('DELETE');
  await dialog.getByLabel('Account password', {exact:true}).fill(password);
  await dialog.getByRole('button', {name:'Delete account permanently', exact:true}).click();
  await expect(page.getByText('Access is revoked. Stored data cleanup is still in progress.')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/heatmap/deletion');
  expect(await page.evaluate(()=>localStorage.getItem('hermes_jwt'))).toBeNull();
  const denied=await page.request.get('/api/activities/analysis',{headers:{Authorization:`Bearer ${token}`}});
  expect(denied.status()).toBe(401);
  await fixture(page.request,'tick');
  await expect(page.getByText('Account and stored history have been deleted.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Account and stored history have been deleted.')).toBeVisible();
  await screen(page,info,'native-deletion-complete');
});
