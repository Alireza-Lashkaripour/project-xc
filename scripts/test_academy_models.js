#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'site', 'assets', 'qc-foundations.js'), 'utf8');

// Keep chapter initialization dormant while loading the exported pure models.
global.window = {};
global.document = {
  readyState: 'loading',
  addEventListener() {},
  getElementById() { return null; }
};
vm.runInThisContext(source, { filename: 'qc-foundations.js' });

const models = global.window.QCFoundationsModels;
if (!models) throw new Error('QCFoundationsModels was not exported');

let checks = 0;
function assert(condition, message) {
  checks += 1;
  if (!condition) throw new Error(message);
}
function near(actual, expected, tolerance, message) {
  assert(Math.abs(actual - expected) <= tolerance, `${message}: got ${actual}, expected ${expected} ± ${tolerance}`);
}

for (const shape of ['gaussian', 'exponential', 'two-lobe']) {
  for (const width of [0.4, 1.0, 2.4]) {
    const model = models.normalizationModel(shape, width, 1.37);
    assert(model.rawArea > 0, `${shape} raw area must be positive`);
    near(model.normalizedArea, 1, 2e-12, `${shape} normalized area`);
    near(model.normFactor ** 2 * model.rawArea, 1, 2e-12, `${shape} normalization identity`);
  }
}

for (const angle of [0, Math.PI / 3, Math.PI, 1.91 * Math.PI]) {
  const globalPhase = models.phaseModel('global', angle, 2.1);
  const difference = Math.max(...globalPhase.current.map((point, index) => Math.abs(point[1] - globalPhase.reference[index][1])));
  near(difference, 0, 1e-15, 'global phase density invariance');
  near(models.trapz(globalPhase.current), 1, 2e-12, 'global phase normalized density');
}
const relativeA = models.phaseModel('relative', 0, 2.1);
const relativeB = models.phaseModel('relative', Math.PI / 2, 2.1);
const relativeDifference = Math.max(...relativeA.current.map((point, index) => Math.abs(point[1] - relativeB.current[index][1])));
assert(relativeDifference > 0.05, 'relative phase must visibly change interference density');
near(models.trapz(relativeB.current), 1, 2e-12, 'relative phase normalized density');

for (const n of [1, 2, 4, 7]) {
  for (const length of [0.5, 1, 2.75]) {
    const model = models.boxModel(n, length);
    assert(model.nodes.length === n - 1, `box n=${n} must have n-1 interior nodes`);
    near(model.energyRatio, n * n / (length * length), 1e-14, 'box energy ratio');
    near(model.densityArea, 1, 2e-12, 'box state normalization');
    near(model.wavelength, 2 * length / n, 1e-14, 'box wavelength');
  }
}

for (const sigmaX of [0.25, 0.8, 1.7, 2.8]) {
  const model = models.uncertaintyModel(sigmaX, -0.35, 1.2);
  near(model.sigmaP, 1 / (2 * sigmaX), 1e-14, 'Gaussian momentum standard deviation');
  near(model.product, 0.5, 1e-14, 'minimum uncertainty product in hbar units');
}

const spinCases = [
  [0, 0, 'z', 1],
  [180, 0, 'z', 0],
  [90, 0, 'x', 1],
  [90, 90, 'y', 1],
  [55, 35, 'z', (1 + Math.cos(55 * Math.PI / 180)) / 2]
];
for (const [theta, phi, axis, expectedPlus] of spinCases) {
  const model = models.spinModel(theta, phi, axis, 200);
  near(model.pPlus + model.pMinus, 1, 1e-14, 'spin probabilities sum to one');
  near(model.pPlus, expectedPlus, 1e-12, `spin +${axis} probability`);
  near(model.expectedPlus + model.expectedMinus, 200, 1e-10, 'spin expected counts conserve trials');
}

console.log('Project XC Academy model tests OK');
console.log(`- deterministic assertions: ${checks}`);
console.log('- normalization, phase, box, uncertainty, and spin models: OK');
