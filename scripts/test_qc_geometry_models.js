#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'site', 'assets', 'qc-geometry.js');
if (!fs.existsSync(sourcePath)) throw new Error('RED: site/assets/qc-geometry.js does not exist');
const source = fs.readFileSync(sourcePath, 'utf8');
const context = {
  console,
  module: { exports: {} },
  window: {},
  document: { readyState: 'loading', addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; } }
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'qc-geometry.js' });
const models = context.module.exports;
if (!models) throw new Error('QCGeometryModels test API was not exported');

let checks = 0;
function assert(condition, message) { checks += 1; if (!condition) throw new Error(message); }
function near(actual, expected, tolerance, message) {
  assert(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${message}: got ${actual}, expected ${expected} ± ${tolerance}`);
}
function deepNear(actual, expected, tolerance, message) {
  assert(Array.isArray(actual) && actual.length === expected.length, `${message}: shape`);
  actual.forEach((value, i) => Array.isArray(expected[i]) ? deepNear(value, expected[i], tolerance, `${message}[${i}]`) : near(value, expected[i], tolerance, `${message}[${i}]`));
}
function throws(action, message) { let didThrow = false; try { action(); } catch (_error) { didThrow = true; } assert(didThrow, message); }

const publicApi = [
  'vectorNorm', 'symmetricEigen2', 'quadraticSurface', 'directionalDerivative', 'stationaryGradientLedger',
  'polynomialEnergy', 'polynomialDerivative', 'centralDifferenceDerivative', 'optimizationStep',
  'predictedQuadraticChange', 'trustRatio', 'bfgsUpdate', 'finiteDifferenceHessian2', 'hessianInertia',
  'massWeightedHessian', 'normalModes2', 'stationaryPointAudit', 'zpeKcalMol', 'doubleWellSurface',
  'traceIrc', 'auditIrcEndpoints', 'zpeCorrectedBarrier'
];
const evaluatorApi = [
  'evaluatePesMission', 'evaluateGradientMission', 'evaluateValidationMission', 'evaluateOptimizationMission',
  'evaluateTrustMission', 'evaluateHessianMission', 'evaluateModesMission', 'evaluateStationaryMission',
  'evaluateIrcMission', 'evaluateGeometryCase'
];
for (const name of [...publicApi, ...evaluatorApi]) assert(typeof models[name] === 'function', `${name} test API must be exported`);
const actualPublic = Object.keys(context.window.QCGeometryModels || {}).sort();
assert(JSON.stringify(actualPublic) === JSON.stringify([...publicApi].sort()), `browser public API must be answer-free: ${JSON.stringify(actualPublic)}`);
const publicSurface = Object.entries(context.window.QCGeometryModels || {}).map(([key, value]) => `${key}\n${String(value)}`).join('\n');
for (const forbidden of ['DOSSIER', 'CASE_FILES', 'evaluatePesMission', 'evaluateGeometryCase', 'expectedAnswer', 'answerKey', 'bossRoutes']) {
  assert(!publicSurface.includes(forbidden), `browser public surface must not expose ${forbidden}`);
}

near(models.vectorNorm([3, 4]), 5, 1e-12, 'Euclidean vector norm');
throws(() => models.vectorNorm([1, NaN]), 'nonfinite vector rejected');

for (const matrix of [[[2, 1], [1, 2]], [[-4, 0], [0, 1]], [[1, 0], [0, 1]], [[3, -0.4], [-0.4, 2]]]) {
  const eigen = models.symmetricEigen2(matrix);
  assert(eigen.valid, 'symmetric eigensystem valid');
  near(eigen.values[0] + eigen.values[1], matrix[0][0] + matrix[1][1], 1e-11, 'eigen trace oracle');
  near(eigen.values[0] * eigen.values[1], matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0], 1e-11, 'eigen determinant oracle');
  eigen.values.forEach((value, rootIndex) => {
    const vector = [eigen.vectors[0][rootIndex], eigen.vectors[1][rootIndex]];
    const residual = [matrix[0][0] * vector[0] + matrix[0][1] * vector[1] - value * vector[0], matrix[1][0] * vector[0] + matrix[1][1] * vector[1] - value * vector[1]];
    near(Math.hypot(...residual), 0, 1e-10, 'eigenvector residual');
  });
}
assert(!models.symmetricEigen2([[1, 0.2], [0.3, 1]]).valid, 'asymmetric eigensystem rejected');

const surfaceModel = { offset: 1.2, linear: [-1, 0.5], hessian: [[2, 0.4], [0.4, 1.5]] };
const point = [0.3, -0.2];
const surface = models.quadraticSurface(surfaceModel, point);
near(surface.energy, 1.2 + (-1 * 0.3 + 0.5 * -0.2) + 0.5 * (2 * 0.3 ** 2 + 2 * 0.4 * 0.3 * -0.2 + 1.5 * (-0.2) ** 2), 1e-12, 'quadratic energy oracle');
deepNear(surface.gradient, [-1 + 2 * 0.3 + 0.4 * -0.2, 0.5 + 0.4 * 0.3 + 1.5 * -0.2], 1e-12, 'quadratic gradient oracle');
deepNear(surface.force, surface.gradient.map(value => -value), 1e-12, 'force is negative gradient');
const direction = models.directionalDerivative(surface.gradient, [3, 4]);
near(direction.value, surface.gradient[0] * 0.6 + surface.gradient[1] * 0.8, 1e-12, 'directional derivative oracle');
const step = 1e-5;
const plus = models.quadraticSurface(surfaceModel, point.map((value, i) => value + step * direction.direction[i])).energy;
const minus = models.quadraticSurface(surfaceModel, point.map((value, i) => value - step * direction.direction[i])).energy;
near((plus - minus) / (2 * step), direction.value, 1e-9, 'directional finite-difference oracle');

const ledger = models.stationaryGradientLedger({ nuclear: 0.21, oneElectron: -0.33, twoElectron: 0.19, overlapPulay: -0.08, scfResidual: 1e-10 });
assert(ledger.valid && ledger.stationary, 'stationary gradient ledger valid');
near(ledger.total, -0.01, 1e-12, 'all derivative terms sum');
near(ledger.withoutPulay, 0.07, 1e-12, 'omitted Pulay certificate');
assert(!models.stationaryGradientLedger({ nuclear: 0.2, oneElectron: 0, twoElectron: 0, overlapPulay: 0, scfResidual: 1e-3 }).stationary, 'unconverged electronic state flagged');
assert(!models.stationaryGradientLedger({ nuclear: NaN, oneElectron: 0, twoElectron: 0, overlapPulay: 0, scfResidual: 0 }).valid, 'nonfinite ledger rejected');

const coefficients = [1, -0.7, 0.5, 0.2, 0.1];
const x = 0.3;
const exactDerivative = -0.7 + 2 * 0.5 * x + 3 * 0.2 * x ** 2 + 4 * 0.1 * x ** 3;
near(models.polynomialDerivative(coefficients, x), exactDerivative, 1e-14, 'polynomial derivative');
near(models.centralDifferenceDerivative(value => models.polynomialEnergy(coefficients, value), x, 1e-3), exactDerivative, 4e-7, 'central finite difference useful window');
const coarseError = Math.abs(models.centralDifferenceDerivative(value => models.polynomialEnergy(coefficients, value), x, 0.4) - exactDerivative);
assert(coarseError > 1e-2, 'coarse finite difference exposes truncation');
const tinyError = Math.abs(models.centralDifferenceDerivative(value => models.polynomialEnergy(coefficients, value), x, 1e-14) - exactDerivative);
assert(tinyError > 1e-4, 'tiny finite difference exposes cancellation');
throws(() => models.centralDifferenceDerivative(value => value * value, 1, 0), 'zero difference step rejected');

const gradient = [2, -1];
const hessian = [[4, 0], [0, 2]];
const newton = models.optimizationStep(gradient, hessian, 'newton', { trustRadius: 2 });
assert(newton.valid && !newton.clipped, 'Newton step valid');
deepNear(newton.step, [-0.5, 0.5], 1e-12, 'Newton solve oracle');
near(models.predictedQuadraticChange(gradient, hessian, newton.step), -0.75, 1e-12, 'quadratic predicted change');
const clipped = models.optimizationStep([8, 0], [[1, 0], [0, 2]], 'newton', { trustRadius: 0.5 });
near(models.vectorNorm(clipped.step), 0.5, 1e-12, 'trust radius clips Newton step');
const steepest = models.optimizationStep([3, 4], hessian, 'steepest', { stepSize: 0.2, trustRadius: 0.6 });
near(models.vectorNorm(steepest.step), 0.6, 1e-12, 'trust radius clips steepest step');
assert(!models.optimizationStep([1, 0], [[1, 0], [0, 0]], 'newton', { trustRadius: 1 }).valid, 'singular Newton Hessian rejected');

const ratioExpand = models.trustRatio(0.95, 1, true);
near(ratioExpand.ratio, 0.95, 1e-12, 'trust ratio');
assert(ratioExpand.action === 'accept-expand', 'good boundary step expands trust radius');
assert(models.trustRatio(0.1, 1, false).action === 'reject-shrink', 'poor step shrinks trust radius');
assert(!models.trustRatio(1, 0, false).valid, 'nonpositive predicted reduction rejected');

const bfgs = models.bfgsUpdate([[1, 0], [0, 1]], [1, 0], [2, 0.5]);
assert(bfgs.valid && bfgs.curvature > 0 && bfgs.positiveDefinite, 'BFGS positive-curvature update');
deepNear(bfgs.matrix, [[2, 0.5], [0.5, 1.125]], 1e-12, 'BFGS independent matrix arithmetic');
assert(!models.bfgsUpdate([[1, 0], [0, 1]], [1, 0], [-1, 0]).valid, 'BFGS rejects nonpositive sTy');
assert(!models.bfgsUpdate([[1, 0.2], [0.3, 1]], [1, 0], [1, 0]).valid, 'BFGS rejects asymmetric model');

const gradientFunction = q => [2 * q[0] + 0.4 * q[1] - 1, 0.4 * q[0] + 1.5 * q[1] + 0.5];
const finiteHessian = models.finiteDifferenceHessian2(gradientFunction, [0.2, -0.3], 1e-5);
assert(finiteHessian.valid, 'finite-difference Hessian valid');
deepNear(finiteHessian.matrix, [[2, 0.4], [0.4, 1.5]], 1e-9, 'Hessian from gradient differences');
const positiveInertia = models.hessianInertia([[2, 0.4], [0.4, 1.5]], 1e-7);
assert(positiveInertia.valid && positiveInertia.positive === 2 && positiveInertia.negative === 0, 'positive Hessian inertia');
const saddleInertia = models.hessianInertia([[-4, 0], [0, 1]], 1e-7);
assert(saddleInertia.negative === 1 && saddleInertia.positive === 1, 'first-order saddle inertia');
assert(models.hessianInertia([[1e-9, 0], [0, 1]], 1e-6).nearZero === 1, 'near-zero curvature tolerance');

const weighted = models.massWeightedHessian([[1, -1], [-1, 1]], [1, 2]);
deepNear(weighted, [[1, -1 / Math.sqrt(2)], [-1 / Math.sqrt(2), 0.5]], 1e-12, 'mass-weighted Hessian');
const modes = models.normalModes2([[1, -1], [-1, 1]], [1, 2]);
assert(modes.valid, 'diatomic modes valid');
near(modes.values[0], 0, 1e-12, 'translation zero mode');
near(modes.values[1], 1 * (1 / 1 + 1 / 2), 1e-12, 'analytic stretch eigenvalue');
const lightModes = models.normalModes2([[1, -1], [-1, 1]], [1, 1]);
assert(modes.values[1] < lightModes.values[1], 'heavier isotope lowers squared frequency');
assert(!models.normalModes2([[1, -1], [-1, 1]], [1, 0]).valid, 'nonpositive mass rejected');

const minimumAudit = models.stationaryPointAudit({ gradient: [1e-7, -2e-7], eigenvalues: [0.5, 1.2, 2.1], atomCount: 3, linear: false, tolerance: 1e-5, gradientTolerance: 1e-5 });
assert(minimumAudit.kind === 'minimum' && minimumAudit.modeCountMatches, 'nonlinear triatomic minimum');
assert(models.stationaryPointAudit({ gradient: [0, 0], eigenvalues: [-0.8, 0.5, 1.1], atomCount: 3, linear: false }).kind === 'first-order-saddle', 'one negative mode TS');
assert(models.stationaryPointAudit({ gradient: [0, 0], eigenvalues: [-0.8, -0.2, 1.1], atomCount: 3, linear: false }).kind === 'higher-order-saddle', 'multiple negative modes');
assert(models.stationaryPointAudit({ gradient: [0, 0], eigenvalues: [-1e-8, 0.5, 1.1], atomCount: 3, linear: false, tolerance: 1e-5 }).kind === 'unresolved-near-zero', 'tiny imaginary mode unresolved');
const incompleteModes = models.stationaryPointAudit({ gradient: [0, 0], eigenvalues: [0.5, 1.1], atomCount: 3, linear: false, tolerance: 1e-5 });
assert(incompleteModes.kind === 'invalid-mode-count' && !incompleteModes.modeCountMatches && incompleteModes.expectedModeCount === 3, 'incomplete projected vibrational spectrum invalidates classification');
assert(models.stationaryPointAudit({ gradient: [1e-2, 0], eigenvalues: [0.5, 1, 2], atomCount: 3, linear: false }).kind === 'not-stationary', 'large gradient blocks stationary classification');
near(models.zpeKcalMol([1000, 1500, 3000]), 0.0014295718 * 5500, 3e-7, 'harmonic ZPE conversion');
assert(Number.isNaN(models.zpeKcalMol([1000, -20])), 'imaginary frequency excluded explicitly, not silently summed');

const saddle = models.doubleWellSurface([0, 0]);
near(saddle.energy, 1, 1e-12, 'double-well saddle energy');
deepNear(saddle.gradient, [0, 0], 1e-12, 'double-well saddle gradient');
deepNear(saddle.hessian, [[-4, 0], [0, 1]], 1e-12, 'double-well saddle Hessian');
for (const sign of [-1, 1]) {
  const p = [sign * 0.37, 0.18];
  const analytic = models.doubleWellSurface(p).gradient;
  const numeric = [0, 1].map(axis => {
    const plusPoint = p.slice(); const minusPoint = p.slice(); plusPoint[axis] += 1e-5; minusPoint[axis] -= 1e-5;
    return (models.doubleWellSurface(plusPoint).energy - models.doubleWellSurface(minusPoint).energy) / 2e-5;
  });
  deepNear(analytic, numeric, 2e-9, 'double-well independent gradient');
}
const pathPlus = models.traceIrc(1, {}, { displacement: 0.05, step: 0.08, maxSteps: 200, tolerance: 1e-8 });
const pathMinus = models.traceIrc(-1, {}, { displacement: 0.05, step: 0.08, maxSteps: 200, tolerance: 1e-8 });
assert(pathPlus.valid && pathMinus.valid, 'two IRC branches trace');
const endpoints = models.auditIrcEndpoints(pathPlus.points, pathMinus.points);
assert(endpoints.valid && endpoints.distinct && endpoints.connectedMinima, 'IRC connects distinct minima');
const electronicTsKcalMol = 1;
const electronicReactantKcalMol = 0;
near(models.zpeCorrectedBarrier(electronicTsKcalMol, electronicReactantKcalMol, [500, 1000], [600, 900, 1100]), electronicTsKcalMol - electronicReactantKcalMol + models.zpeKcalMol([500, 1000]) - models.zpeKcalMol([600, 900, 1100]), 1e-12, 'ZPE-corrected barrier with all energy inputs in kcal/mol');

const missionChoices = {
  evaluatePesMission: [['surface-a', 'positive-q1'], ['surface-b', 'negative-q2'], ['surface-c', 'stationary']],
  evaluateGradientMission: [['gradient-a', 'include-pulay'], ['gradient-b', 'stationary-explicit-complete'], ['gradient-c', 'reconverge-electronic-state']],
  evaluateValidationMission: [['validation-a', 'validated-window'], ['validation-b', 'step-too-large'], ['validation-c', 'step-too-small']],
  evaluateOptimizationMission: [['optimization-a', 'trust-newton'], ['optimization-b', 'steepest-descent'], ['optimization-c', 'reject-indefinite-model']],
  evaluateTrustMission: [['trust-a', 'accept-expand-bfgs'], ['trust-b', 'skip-bfgs'], ['trust-c', 'reject-shrink']],
  evaluateHessianMission: [['hessian-a', 'positive-definite'], ['hessian-b', 'one-negative-mode'], ['hessian-c', 'reject-asymmetric'], ['hessian-d', 'unresolved-near-zero']],
  evaluateModesMission: [['modes-a', 'translation-stretch'], ['modes-b', 'heavier-isotope-lowers-frequency'], ['modes-c', 'reject-masses']],
  evaluateStationaryMission: [['stationary-a', 'minimum'], ['stationary-b', 'first-order-saddle'], ['stationary-c', 'higher-order-saddle'], ['stationary-d', 'unresolved-near-zero'], ['stationary-e', 'invalid-mode-count']],
  evaluateIrcMission: [['irc-a', 'validated-irc'], ['irc-b', 'higher-order-saddle'], ['irc-c', 'trace-both-directions']]
};
for (const [name, cases] of Object.entries(missionChoices)) {
  for (const [caseId, choice] of cases) {
    assert(models[name](caseId, choice).correct, `${name} accepts derived choice for ${caseId}`);
    assert(!models[name](caseId, 'deliberately-wrong').correct, `${name} rejects wrong choice for ${caseId}`);
  }
  assert(!models[name]('unknown-case', cases[0][1]).correct, `${name} rejects unknown dossier`);
}
const bossChoices = [
  ['geometry-case-a', ['minimum-optimization', 'gradient-and-hessian', 'tight-gradient-positive-modes-fd']],
  ['geometry-case-b', ['transition-state-search', 'one-imaginary-reaction-mode', 'two-sided-irc-endpoints']],
  ['geometry-case-c', ['frequency-recheck', 'near-zero-mode-contamination', 'tighter-grid-projection-repeat']]
];
for (const [caseId, choices] of bossChoices) {
  choices.forEach((choice, stage) => assert(models.evaluateGeometryCase(caseId, stage, choice).correct, `boss ${caseId} stage ${stage}`));
  assert(!models.evaluateGeometryCase(caseId, 0, 'wrong').correct, `boss ${caseId} wrong stage rejected`);
}
assert(!models.evaluateGeometryCase('unknown', 0, bossChoices[0][1][0]).correct, 'unknown boss dossier rejected');

console.log('Project XC Geometry, Gradients, and Frequencies model tests OK');
console.log(`- deterministic assertions: ${checks}`);
console.log('- PES/force signs, gradient ledgers, finite differences, optimizers, BFGS, Hessians, modes, stationary points, IRC, ZPE, and neutral mission dossiers: OK');
