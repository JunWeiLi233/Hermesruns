import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSeoMetadata, SITE_URL, SOURCE_REPOSITORY_URL } from './seoMetadata.js';
import en from '../i18n/locales/en/publicLanding.js';
import zh from '../i18n/locales/zh-CN/publicLanding.js';
import { SUPPORT_EMAIL } from './supportContact.js';

function objects(value) {
  if (!value || typeof value !== 'object') return [];
  return [value, ...Object.values(value).flatMap(objects)];
}

for (const [language, copy] of [['en', en], ['zh-CN', zh]]) {
  test(`${language} homepage connects its page, website, publisher and application`, () => {
    const metadata = getSeoMetadata('/', language);
    const nodes = metadata.structuredData['@graph'];
    const app = nodes.find((node) => node['@type'] === 'WebApplication');
    const page = nodes.find((node) => node['@type'] === 'WebPage');
    assert.ok(page, 'The homepage must identify the page separately from the application');
    assert.equal(page.url, metadata.canonicalUrl);
    assert.equal(page.name, metadata.title);
    assert.equal(page.description, metadata.description);
    assert.equal(page.inLanguage, language);
    assert.equal(page.mainEntity['@id'], app['@id']);
    assert.equal(app.mainEntityOfPage['@id'], page['@id']);
    assert.equal(page.isPartOf['@id'], `${SITE_URL}/#website`);
  });

  test(`${language} application features and free offer match visible copy`, () => {
    const graph = getSeoMetadata('/', language).structuredData['@graph'];
    const app = graph.find((node) => node['@type'] === 'WebApplication');
    assert.deepEqual(app.featureList, [
      copy.home_feat_adapt_eyebrow, copy.home_feat_coach_eyebrow,
      copy.home_feat_race_eyebrow, copy.home_plan_free_item_3, copy.home_plan_free_item_4,
    ]);
    assert.equal(app.offers['@type'], 'Offer');
    assert.equal(app.offers.name, copy.home_plan_free_name);
    assert.equal(app.offers.price, 0);
    assert.equal(copy.home_plan_free_price, `$${app.offers.price}`);
    assert.equal(app.offers.url, `${SITE_URL}/#pricing`);
    assert.equal(app.aggregateRating, undefined, 'No real published rating is available');
    assert.equal(app.review, undefined, 'No review should be invented for eligibility');
    const organization = graph.find((node) => node['@type'] === 'Organization');
    assert.equal(organization.email, SUPPORT_EMAIL);
    assert.ok(!organization.sameAs?.includes(SOURCE_REPOSITORY_URL), 'Source code does not establish publisher identity');
  });

  for (const route of ['/terms', '/privacy']) {
    test(`${language} ${route} identifies its own page and website`, () => {
      const metadata = getSeoMetadata(route, language);
      const page = metadata.structuredData;
      assert.equal(page['@type'], 'WebPage');
      assert.equal(page['@id'], `${metadata.canonicalUrl}#webpage`);
      assert.equal(page.url, metadata.canonicalUrl);
      assert.equal(page.inLanguage, language);
      assert.equal(page.dateModified, '2026-10-17');
      assert.equal(page.isPartOf['@type'], 'WebSite');
      assert.equal(page.isPartOf.url, `${SITE_URL}/`);
      assert.equal(page.isPartOf.publisher['@type'], 'Organization');
      assert.equal(page.isPartOf.publisher.email, SUPPORT_EMAIL);
      assert.ok(!objects(page).some((node) => ['WebApplication', 'Offer'].includes(node['@type'])));
    });
  }
}

test('public JSON-LD uses absolute URLs, supported types and resolved entity references', () => {
  const allowed = new Set(['Organization', 'WebSite', 'WebPage', 'WebApplication', 'Offer']);
  for (const language of ['en', 'zh-CN']) {
    for (const route of ['/', '/terms', '/privacy']) {
      const data = getSeoMetadata(route, language).structuredData;
      assert.equal(data['@context'], 'https://schema.org');
      const nodes = objects(data);
      const definitions = nodes.filter((node) => node['@id'] && node['@type']);
      const ids = new Set(definitions.map((node) => node['@id']));
      assert.equal(ids.size, definitions.length, 'Each entity needs a unique definition');
      for (const node of nodes) {
        if (node['@type']) assert.ok(allowed.has(node['@type']), node['@type']);
        if (node['@id']) {
          assert.match(node['@id'], /^https:\/\//);
          assert.ok(ids.has(node['@id']), `Unresolved entity: ${node['@id']}`);
        }
        for (const field of ['url', 'logo', 'image']) {
          if (node[field]) assert.match(node[field], /^https:\/\//);
        }
      }
    }
  }
});

test('private and unknown routes do not publish structured data', () => {
  for (const route of ['/login', '/signup', '/profile', '/runs/123', '/unknown']) {
    assert.equal(getSeoMetadata(route).structuredData, null);
  }
});
