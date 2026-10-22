import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseActivityFile } from '../replica/intervals-icu/app/data/model.mjs';

const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { JSDOM, requestInterceptor } = require('jsdom');
const requests = [];
const dom = new JSDOM('<!doctype html><body><main></main></body>', {
  url: 'https://fixture.invalid/', runScripts: 'dangerously',
  resources: { interceptors: [requestInterceptor(request => {
    requests.push(request.url);
    return Promise.resolve(new Response('', { status: 200 }));
  })] },
});
const previousParser = globalThis.DOMParser;
const types = [];
globalThis.DOMParser = class extends dom.window.DOMParser {
  parseFromString(source, type) { types.push(type); return super.parseFromString(source, type); }
};
const points = '<trkpt><time>2026-10-15T10:00:00Z</time><extensions><hr>130</hr></extensions></trkpt>'
  + '<trkpt><time>2026-10-15T10:01:00Z</time><extensions><hr>140</hr></extensions></trkpt>';
try {
  const markup = '<img src="https://fixture.invalid/probe" onerror="window.xmlExecuted=true"><script>window.xmlExecuted=true</script>';
  const encoded = markup.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const activity = parseActivityFile('literal.gpx', `<gpx><trk><name>${encoded}</name><trkseg>${points}</trkseg></trk></gpx>`);
  assert.equal(activity.title, markup, 'XML entities decode to a plain string, never an HTML node.');
  const heading = dom.window.document.createElement('h1');
  heading.textContent = activity.title;
  dom.window.document.querySelector('main').appendChild(heading);
  assert.equal(heading.textContent, markup);
  assert.equal(heading.children.length, 0);
  assert.equal(dom.window.document.querySelectorAll('img, script').length, 0);
  assert.equal(dom.window.xmlExecuted, undefined);
  assert.deepEqual(requests, []);
  assert.equal(activity.minutes, 1);
  assert.deepEqual(activity.samples.map(sample => sample.hr), [130, 140]);

  const cdata = parseActivityFile('cdata.gpx', `<gpx><trk><name><![CDATA[${markup}]]></name><trkseg>${points}</trkseg></trk></gpx>`);
  assert.equal(cdata.title, markup, 'CDATA remains text as well.');
  const tcx = parseActivityFile('namespaced.tcx', '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">'
    + '<Activities><Activity><Lap><Track><Trackpoint><Time>2026-10-15T10:00:00Z</Time><HeartRateBpm><Value>123</Value></HeartRateBpm></Trackpoint>'
    + '<Trackpoint><Time>2026-10-15T10:02:00Z</Time><HeartRateBpm><Value>145</Value></HeartRateBpm></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>');
  assert.equal(tcx.minutes, 2);
  assert.deepEqual(tcx.samples.map(sample => sample.hr), [123, 145]);
  assert.throws(() => parseActivityFile('broken.gpx', '<gpx><trk></gpx>'), /Invalid XML/);
  assert.throws(() => parseActivityFile('unordered.gpx', `<gpx><trkseg>${points.replace('10:01:00', '09:59:00')}</trkseg></gpx>`), /ordered timestamped/);
  assert.ok(types.length >= 5);
  assert.ok(types.every(type => type === 'application/xml'), 'Uploads must never use the text/html parser.');
  assert.deepEqual(requests, []);
  console.log('PASS activity uploads remain inert XML; GPX/TCX samples, literal markup and validation are preserved');
} finally {
  if (previousParser === undefined) delete globalThis.DOMParser;
  else globalThis.DOMParser = previousParser;
  dom.window.close();
}
