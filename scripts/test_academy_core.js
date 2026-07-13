#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'site', 'assets', 'academy-core.js'), 'utf8');

let checks = 0;
function assert(condition, message) {
  checks += 1;
  if (!condition) throw new Error(message);
}
function equal(actual, expected, message) {
  assert(Object.is(actual, expected), `${message}: got ${actual}, expected ${expected}`);
}

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); }
  };
}

function loadCore(initialStorage = {}) {
  const localStorage = createStorage(initialStorage);
  const events = [];
  const context = {
    console,
    Date,
    JSON,
    Math,
    Object,
    Set,
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    window: {
      localStorage,
      dispatchEvent(event) { events.push(event); return true; }
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'academy-core.js' });
  return { academy: context.window.ProjectXCAcademy, localStorage, events };
}

const BASIS_KEY = 'project-xc-basis-quest-badges-v2';
const liveChapter = {
  id: 'qc-foundations',
  status: 'live',
  levels: 10,
  progress: { kind: 'academy-missions', total: 10, label: 'Academy missions' }
};
const mathChapter = {
  id: 'qc-math-language',
  status: 'live',
  levels: 10,
  progress: { kind: 'academy-missions', total: 10, label: 'Academy missions' }
};
const basisChapter = {
  id: 'qc-basis-sets',
  status: 'existing-tool',
  levels: 18,
  progress: {
    kind: 'legacy-badges',
    storage_key: BASIS_KEY,
    total: 18,
    label: 'Basis Quest missions'
  }
};

const initialBadges = JSON.stringify(['Orbital alphabet', 'Gaussian sculptor', 'Orbital alphabet', '', 42]);
const { academy, localStorage, events } = loadCore({ [BASIS_KEY]: initialBadges });
assert(academy, 'ProjectXCAcademy must be exported');
assert(typeof academy.chapterProgress === 'function', 'chapterProgress API must be exported');

academy.setMission('qc-foundations', 'scale', true);
academy.setMission('qc-math-language', 'complex-amplitudes', true);
const liveProgress = academy.chapterProgress(liveChapter);
equal(liveProgress.completed, 1, 'live Academy mission count');
equal(liveProgress.total, 10, 'live Academy mission total');
equal(liveProgress.kind, 'academy-missions', 'live progress kind');
equal(liveProgress.readOnly, false, 'live progress must be writable');
const mathProgress = academy.chapterProgress(mathChapter);
equal(mathProgress.completed, 1, 'second live chapter mission count');
equal(mathProgress.total, 10, 'second live chapter mission total');

const basisProgress = academy.chapterProgress(basisChapter);
equal(basisProgress.completed, 2, 'legacy Basis badges must be filtered and deduplicated');
equal(basisProgress.total, 18, 'legacy Basis mission total');
equal(basisProgress.kind, 'legacy-badges', 'legacy progress kind');
equal(basisProgress.label, 'Basis Quest missions', 'legacy progress label');
equal(basisProgress.readOnly, true, 'legacy bridge must be read-only');

const beforeReset = localStorage.getItem(BASIS_KEY);
academy.resetChapter('qc-foundations');
equal(academy.completedMissions('qc-foundations').length, 0, 'chapter reset must clear only the selected chapter');
equal(academy.completedMissions('qc-math-language').length, 1, 'chapter reset must preserve other Academy chapters');
academy.setMission('qc-foundations', 'scale', true);
academy.resetAll();
equal(localStorage.getItem(BASIS_KEY), beforeReset, 'Academy reset must preserve Basis Quest badges');
equal(academy.completedMissions('qc-foundations').length, 0, 'Academy reset must clear Foundations missions');
equal(academy.completedMissions('qc-math-language').length, 0, 'Academy reset must clear Mathematical Language missions');
assert(events.length >= 4, 'progress operations must dispatch update events');

academy.setMission('qc-foundations', 'scale', true);
academy.setMission('qc-math-language', 'complex-amplitudes', true);
const summary = academy.summarizeCurriculum({ tracks: [{ chapters: [liveChapter, mathChapter, basisChapter] }] });
equal(summary.completed, 4, 'combined available-mission completion count');
equal(summary.available, 38, 'combined available-mission total');
equal(summary.fraction, 4 / 38, 'combined progress fraction');

localStorage.setItem(BASIS_KEY, '{malformed json');
equal(academy.chapterProgress(basisChapter).completed, 0, 'malformed legacy storage must recover safely');
localStorage.setItem(BASIS_KEY, JSON.stringify(Array.from({ length: 30 }, (_, index) => `Badge ${index}`)));
equal(academy.chapterProgress(basisChapter).completed, 18, 'legacy completion must be capped at metadata total');

equal(academy.chapterProgress({ id: 'qc-molecular-orbitals', status: 'existing-tool', levels: 12 }), null, 'tool without a progress contract must not invent progress');

console.log('Project XC Academy progress tests OK');
console.log(`- deterministic assertions: ${checks}`);
console.log('- Multi-chapter Academy missions, read-only Basis bridge, malformed recovery, summary, and reset isolation: OK');
