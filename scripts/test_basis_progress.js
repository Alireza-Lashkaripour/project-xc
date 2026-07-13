#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'site', 'assets', 'basis-sets.js'), 'utf8');
const badges = [
  ['orbital-alphabet', 'Orbital alphabet'],
  ['gaussian-sculptor', 'Gaussian sculptor'],
  ['ao-cartographer', 'AO cartographer'],
  ['contraction-smith', 'Contraction smith'],
  ['matrix-runner', 'Matrix runner'],
  ['family-scout', 'Family scout'],
  ['basis-loadout-designer', 'Basis loadout designer'],
  ['bsse-duelist', 'BSSE duelist'],
  ['conditioning-guardian', 'Conditioning guardian'],
  ['cbs-extrapolator', 'CBS extrapolator'],
  ['scaling-survivor', 'Scaling survivor'],
  ['basis-strategist', 'Basis strategist'],
  ['integral-engine-unlocked', 'Integral engine unlocked'],
  ['gaussian-product-wizard', 'Gaussian product wizard'],
  ['one-electron-operator-tuner', 'One-electron operator tuner'],
  ['boys-function-spelunker', 'Boys function spelunker'],
  ['eri-tensor-raider', 'ERI tensor raider'],
  ['integral-grandmaster', 'Integral grandmaster']
];
const buttons = badges.map(([badgeId, badge]) => ({ dataset: { badgeId, badge, xp: '100' } }));
const STORAGE_KEY = 'project-xc-basis-quest-badges-v2';
let stored = null;
const localStorage = {
  getItem(key) { return key === STORAGE_KEY ? stored : null; },
  setItem(key, value) { if (key === STORAGE_KEY) stored = String(value); },
  removeItem(key) { if (key === STORAGE_KEY) stored = null; }
};
const context = {
  console,
  JSON,
  Math,
  Object,
  Set,
  Map,
  localStorage,
  window: {},
  document: {
    readyState: 'loading',
    addEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll(selector) {
      return selector === '.quest-complete[data-badge-id][data-badge]' ? buttons : [];
    }
  }
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'basis-sets.js' });

let checks = 0;
function assert(condition, message) {
  checks += 1;
  if (!condition) throw new Error(message);
}
function equal(actual, expected, message) {
  assert(Object.is(actual, expected), `${message}: got ${actual}, expected ${expected}`);
}

const api = context.window.ProjectXCBasisQuestProgress;
assert(api, 'Basis Quest progress API must be exported');
assert(typeof api.normalizeBadges === 'function', 'badge normalizer must be exported');
assert(typeof api.loadAndMigrateBadges === 'function', 'storage migration must be exported');

const mixed = ['Orbital alphabet', 'gaussian-sculptor', 'Orbital alphabet', 'retired-badge', '', 42];
equal(Array.from(api.normalizeBadges(mixed)).join(','), 'orbital-alphabet,gaussian-sculptor', 'legacy labels migrate and unknown values are filtered');
stored = JSON.stringify(mixed);
equal(Array.from(api.loadAndMigrateBadges()).join(','), 'orbital-alphabet,gaussian-sculptor', 'stored legacy labels load as stable ids');
equal(stored, JSON.stringify(['orbital-alphabet', 'gaussian-sculptor']), 'legacy storage is migrated once to stable ids by its owning tool');
const migrated = stored;
api.loadAndMigrateBadges();
equal(stored, migrated, 'already-migrated storage remains stable');

stored = JSON.stringify(['retired-badge']);
equal(api.loadAndMigrateBadges().length, 0, 'unknown historical badges do not count');
equal(stored, '[]', 'owning tool removes unknown historical badges during migration');
stored = '{malformed json';
equal(api.loadAndMigrateBadges().length, 0, 'malformed storage recovers safely');
equal(stored, '{malformed json', 'malformed storage is not overwritten implicitly');
stored = JSON.stringify(badges.map(([id]) => id));
equal(api.loadAndMigrateBadges().length, 18, 'all authoritative badges survive normalization');

console.log('Project XC Basis Quest progress tests OK');
console.log(`- deterministic assertions: ${checks}`);
console.log('- stable ids, legacy-label migration, unknown filtering, malformed recovery, and all-18 preservation: OK');
