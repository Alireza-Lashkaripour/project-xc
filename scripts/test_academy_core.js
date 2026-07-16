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
const FOUNDATION_MISSION_IDS = ['scale', 'state', 'probability', 'phase', 'operators', 'schrodinger', 'box', 'uncertainty', 'spin', 'many-electron-bridge'];
const MATH_MISSION_IDS = ['complex-amplitudes', 'vector-coordinates', 'projection', 'basis-rotation', 'matrix-representation', 'eigensystem', 'hermitian-unitary', 'tensor-products', 'fourier-pairs', 'variational-bridge'];
const ATOM_MISSION_IDS = ['model-map', 'quantum-numbers', 'coulomb-spectrum', 'radial-structure', 'angular-structure', 'dipole-transitions', 'screening', 'configurations', 'periodic-patterns', 'term-symbols', 'fine-structure', 'atomic-case-file'];
const APPROXIMATION_MISSION_IDS = ['approximation-passport', 'dimensionless-scaling', 'rayleigh-quotient', 'variational-gaussian', 'basis-truncation', 'nonorthogonal-basis', 'nondegenerate-perturbation', 'degenerate-perturbation', 'series-budget', 'error-decomposition', 'residual-bounds', 'approximation-case-file'];
const MANY_ELECTRON_MISSION_IDS = ['fermion-exchange', 'spin-orbital-occupancy', 'determinant-parity', 'determinant-overlap', 'one-body-selection', 'two-body-selection', 'spin-adaptation', 'one-rdm', 'two-rdm', 'many-electron-case-file'];
const HARTREE_FOCK_MISSION_IDS = ['hf-variational-manifold', 'coulomb-exchange', 'fock-assembly', 'roothaan-hall', 'density-projector', 'orbital-stationarity', 'scf-fixed-point', 'scf-pathology', 'scf-stabilization', 'diis', 'reference-spin', 'hf-case-file'];
const BASIS_BADGE_IDS = [
  'orbital-alphabet', 'gaussian-sculptor', 'ao-cartographer', 'contraction-smith', 'matrix-runner', 'family-scout',
  'basis-loadout-designer', 'bsse-duelist', 'conditioning-guardian', 'cbs-extrapolator', 'scaling-survivor',
  'basis-strategist', 'integral-engine-unlocked', 'gaussian-product-wizard', 'one-electron-operator-tuner',
  'boys-function-spelunker', 'eri-tensor-raider', 'integral-grandmaster'
];
const BASIS_LEGACY_BADGE_ALIASES = Object.freeze({
  'Orbital alphabet': 'orbital-alphabet',
  'Gaussian sculptor': 'gaussian-sculptor',
  'AO cartographer': 'ao-cartographer',
  'Contraction smith': 'contraction-smith',
  'Matrix runner': 'matrix-runner',
  'Family scout': 'family-scout',
  'Basis loadout designer': 'basis-loadout-designer',
  'BSSE duelist': 'bsse-duelist',
  'Conditioning guardian': 'conditioning-guardian',
  'CBS extrapolator': 'cbs-extrapolator',
  'Scaling survivor': 'scaling-survivor',
  'Basis strategist': 'basis-strategist',
  'Integral engine unlocked': 'integral-engine-unlocked',
  'Gaussian product wizard': 'gaussian-product-wizard',
  'One-electron operator tuner': 'one-electron-operator-tuner',
  'Boys function spelunker': 'boys-function-spelunker',
  'ERI tensor raider': 'eri-tensor-raider',
  'Integral grandmaster': 'integral-grandmaster'
});
const liveChapter = {
  id: 'qc-foundations',
  status: 'live',
  levels: 10,
  progress: { kind: 'academy-missions', total: 10, mission_ids: FOUNDATION_MISSION_IDS, label: 'Academy missions' }
};
const mathChapter = {
  id: 'qc-math-language',
  status: 'live',
  levels: 10,
  progress: { kind: 'academy-missions', total: 10, mission_ids: MATH_MISSION_IDS, label: 'Academy missions' }
};
const atomChapter = {
  id: 'qc-atoms',
  status: 'live',
  levels: 12,
  progress: { kind: 'academy-missions', total: 12, mission_ids: ATOM_MISSION_IDS, label: 'Atomic Structure missions' }
};
const approximationChapter = {
  id: 'qc-approximations',
  status: 'live',
  levels: 12,
  progress: { kind: 'academy-missions', total: 12, mission_ids: APPROXIMATION_MISSION_IDS, label: 'Approximation Thinking missions' }
};
const manyElectronChapter = {
  id: 'qc-many-electron',
  status: 'live',
  levels: 10,
  progress: { kind: 'academy-missions', total: 10, mission_ids: MANY_ELECTRON_MISSION_IDS, label: 'Many-Electron Wavefunctions missions' }
};
const hartreeFockChapter = {
  id: 'qc-hartree-fock',
  status: 'live',
  levels: 12,
  progress: { kind: 'academy-missions', total: 12, mission_ids: HARTREE_FOCK_MISSION_IDS, label: 'Hartree–Fock and SCF missions' }
};
const basisChapter = {
  id: 'qc-basis-sets',
  status: 'existing-tool',
  levels: 18,
  progress: {
    kind: 'legacy-badges',
    storage_key: BASIS_KEY,
    total: 18,
    badge_ids: BASIS_BADGE_IDS,
    legacy_badge_aliases: BASIS_LEGACY_BADGE_ALIASES,
    label: 'Basis Quest missions'
  }
};

const initialBadges = JSON.stringify(['Orbital alphabet', 'gaussian-sculptor', 'Orbital alphabet', 'retired-badge', '', 42]);
const { academy, localStorage, events } = loadCore({ [BASIS_KEY]: initialBadges });
assert(academy, 'ProjectXCAcademy must be exported');
assert(typeof academy.chapterProgress === 'function', 'chapterProgress API must be exported');
assert(typeof academy.normalizeLegacyBadges === 'function', 'legacy badge normalization API must be exported');
equal(
  Array.from(academy.normalizeLegacyBadges(JSON.parse(initialBadges), BASIS_BADGE_IDS, BASIS_LEGACY_BADGE_ALIASES)).join(','),
  'orbital-alphabet,gaussian-sculptor',
  'legacy labels must migrate in memory to stable ids while unknown badges are filtered'
);

academy.setMission('qc-foundations', 'scale', true);
academy.setMission('qc-math-language', 'complex-amplitudes', true);
academy.setMission('qc-atoms', 'model-map', true);
academy.setMission('qc-approximations', 'approximation-passport', true);
academy.setMission('qc-many-electron', 'fermion-exchange', true);
academy.setMission('qc-hartree-fock', 'hf-variational-manifold', true);
academy.setMission('qc-foundations', 'retired-mission', true);
academy.setMission('qc-atoms', 'retired-atomic-mission', true);
academy.setMission('qc-approximations', 'retired-approximation-mission', true);
academy.setMission('qc-many-electron', 'retired-many-electron-mission', true);
academy.setMission('qc-hartree-fock', 'retired-hartree-fock-mission', true);
const liveProgress = academy.chapterProgress(liveChapter);
equal(liveProgress.completed, 1, 'stale mission ids must not inflate live Academy progress');
equal(liveProgress.total, 10, 'live Academy mission total');
equal(liveProgress.kind, 'academy-missions', 'live progress kind');
equal(liveProgress.readOnly, false, 'live progress must be writable');
const mathProgress = academy.chapterProgress(mathChapter);
equal(mathProgress.completed, 1, 'second live chapter mission count');
equal(mathProgress.total, 10, 'second live chapter mission total');
const atomProgress = academy.chapterProgress(atomChapter);
equal(atomProgress.completed, 1, 'atomic progress must count only authoritative mission ids');
equal(atomProgress.total, 12, 'atomic mission total');
const approximationProgress = academy.chapterProgress(approximationChapter);
equal(approximationProgress.completed, 1, 'approximation progress must count only authoritative mission ids');
equal(approximationProgress.total, 12, 'approximation mission total');
const manyElectronProgress = academy.chapterProgress(manyElectronChapter);
equal(manyElectronProgress.completed, 1, 'many-electron progress must count only authoritative mission ids');
equal(manyElectronProgress.total, 10, 'many-electron mission total');
const hartreeFockProgress = academy.chapterProgress(hartreeFockChapter);
equal(hartreeFockProgress.completed, 1, 'Hartree–Fock progress must count only authoritative mission ids');
equal(hartreeFockProgress.total, 12, 'Hartree–Fock mission total');
assert(typeof academy.reconcileChapterMissions === 'function', 'mission reconciliation API must be exported');
academy.reconcileChapterMissions('qc-foundations', FOUNDATION_MISSION_IDS);
assert(!academy.completedMissions('qc-foundations').includes('retired-mission'), 'chapter reconciliation must migrate stale mission ids out of durable state');

const basisProgress = academy.chapterProgress(basisChapter);
equal(basisProgress.completed, 2, 'legacy Basis badges must be filtered and deduplicated');
equal(basisProgress.total, 18, 'legacy Basis mission total');
equal(basisProgress.kind, 'legacy-badges', 'legacy progress kind');
equal(basisProgress.label, 'Basis Quest missions', 'legacy progress label');
equal(basisProgress.readOnly, true, 'legacy bridge must be read-only');
localStorage.setItem(BASIS_KEY, JSON.stringify(['retired-badge']));
equal(academy.chapterProgress(basisChapter).completed, 0, 'unknown legacy badges must not inflate Academy progress');
equal(localStorage.getItem(BASIS_KEY), JSON.stringify(['retired-badge']), 'Academy legacy bridge must remain read-only while filtering');
localStorage.setItem(BASIS_KEY, initialBadges);

const beforeReset = localStorage.getItem(BASIS_KEY);
academy.resetChapter('qc-foundations');
equal(academy.completedMissions('qc-foundations').length, 0, 'chapter reset must clear only the selected chapter');
equal(academy.completedMissions('qc-math-language').length, 1, 'chapter reset must preserve other Academy chapters');
equal(academy.completedMissions('qc-atoms').length, 2, 'chapter reset must preserve Atomic Structure, including state pending reconciliation');
equal(academy.completedMissions('qc-approximations').length, 2, 'chapter reset must preserve Approximation Thinking, including state pending reconciliation');
equal(academy.completedMissions('qc-many-electron').length, 2, 'chapter reset must preserve Many-Electron Wavefunctions, including state pending reconciliation');
equal(academy.completedMissions('qc-hartree-fock').length, 2, 'chapter reset must preserve Hartree–Fock, including state pending reconciliation');
academy.setMission('qc-foundations', 'scale', true);
academy.resetAll();
equal(localStorage.getItem(BASIS_KEY), beforeReset, 'Academy reset must preserve Basis Quest badges');
equal(academy.completedMissions('qc-foundations').length, 0, 'Academy reset must clear Foundations missions');
equal(academy.completedMissions('qc-math-language').length, 0, 'Academy reset must clear Mathematical Language missions');
equal(academy.completedMissions('qc-atoms').length, 0, 'Academy reset must clear Atomic Structure missions');
equal(academy.completedMissions('qc-approximations').length, 0, 'Academy reset must clear Approximation Thinking missions');
equal(academy.completedMissions('qc-many-electron').length, 0, 'Academy reset must clear Many-Electron Wavefunctions missions');
equal(academy.completedMissions('qc-hartree-fock').length, 0, 'Academy reset must clear Hartree–Fock missions');
assert(events.length >= 4, 'progress operations must dispatch update events');

academy.setMission('qc-foundations', 'scale', true);
academy.setMission('qc-math-language', 'complex-amplitudes', true);
academy.setMission('qc-atoms', 'model-map', true);
academy.setMission('qc-approximations', 'approximation-passport', true);
academy.setMission('qc-many-electron', 'fermion-exchange', true);
academy.setMission('qc-hartree-fock', 'hf-variational-manifold', true);
academy.setMission('qc-math-language', 'renamed-away-mission', true);
academy.setMission('qc-atoms', 'renamed-atomic-mission', true);
academy.setMission('qc-approximations', 'renamed-approximation-mission', true);
academy.setMission('qc-many-electron', 'renamed-many-electron-mission', true);
academy.setMission('qc-hartree-fock', 'renamed-hartree-fock-mission', true);
equal(academy.chapterProgress(mathChapter).completed, 1, 'stale mission ids must remain excluded before curriculum migration');
assert(typeof academy.reconcileCurriculumMissions === 'function', 'curriculum-wide mission reconciliation API must be exported');
const curriculum = { tracks: [{ chapters: [liveChapter, mathChapter, approximationChapter, atomChapter, manyElectronChapter, hartreeFockChapter, basisChapter] }] };
academy.reconcileCurriculumMissions(curriculum);
assert(!academy.completedMissions('qc-math-language').includes('renamed-away-mission'), 'gateway reconciliation must migrate stale ids for every contracted chapter');
assert(!academy.completedMissions('qc-atoms').includes('renamed-atomic-mission'), 'gateway reconciliation must migrate stale Atomic Structure ids');
assert(!academy.completedMissions('qc-approximations').includes('renamed-approximation-mission'), 'gateway reconciliation must migrate stale Approximation Thinking ids');
assert(!academy.completedMissions('qc-many-electron').includes('renamed-many-electron-mission'), 'gateway reconciliation must migrate stale Many-Electron Wavefunctions ids');
assert(!academy.completedMissions('qc-hartree-fock').includes('renamed-hartree-fock-mission'), 'gateway reconciliation must migrate stale Hartree–Fock ids');
let rejectedUnknownMission = false;
try {
  academy.setMission('qc-foundations', 'not-in-contract', true, FOUNDATION_MISSION_IDS);
} catch (_error) {
  rejectedUnknownMission = true;
}
assert(rejectedUnknownMission, 'chapter-bound writes must reject mission ids outside the authoritative contract');
const summary = academy.summarizeCurriculum(curriculum);
equal(summary.completed, 8, 'combined available-mission completion count');
equal(summary.available, 84, 'combined available-mission total');
equal(summary.fraction, 8 / 84, 'combined progress fraction');

localStorage.setItem(BASIS_KEY, '{malformed json');
equal(academy.chapterProgress(basisChapter).completed, 0, 'malformed legacy storage must recover safely');
localStorage.setItem(BASIS_KEY, JSON.stringify([...BASIS_BADGE_IDS, 'retired-badge']));
equal(academy.chapterProgress(basisChapter).completed, 18, 'all authoritative legacy badge ids must count while unknown ids remain filtered');

equal(academy.chapterProgress({ id: 'qc-molecular-orbitals', status: 'existing-tool', levels: 12 }), null, 'tool without a progress contract must not invent progress');

console.log('Project XC Academy progress tests OK');
console.log(`- deterministic assertions: ${checks}`);
console.log('- Multi-chapter Academy missions, read-only Basis bridge, malformed recovery, summary, and reset isolation: OK');
