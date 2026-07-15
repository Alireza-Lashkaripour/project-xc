#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'site', 'assets', 'qc-approximations.js');
if (!fs.existsSync(sourcePath)) throw new Error('RED: site/assets/qc-approximations.js does not exist');
const source = fs.readFileSync(sourcePath, 'utf8');

global.window = {};
global.document = {
  readyState: 'loading',
  addEventListener() {},
  getElementById() { return null; },
  querySelectorAll() { return []; }
};
vm.runInThisContext(source, { filename: 'qc-approximations.js' });

const models = global.window.QCApproximationModels;
if (!models) throw new Error('QCApproximationModels was not exported');

let checks = 0;
function assert(condition, message) {
  checks += 1;
  if (!condition) throw new Error(message);
}
function equal(actual, expected, message) {
  assert(Object.is(actual, expected), `${message}: got ${actual}, expected ${expected}`);
}
function near(actual, expected, tolerance, message) {
  assert(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${message}: got ${actual}, expected ${expected} ± ${tolerance}`);
}
function throws(fn, message) {
  let failed = false;
  try { fn(); } catch (_error) { failed = true; }
  assert(failed, message);
}

const expectedApi = [
  'evaluateApproximationPassport', 'dimensionlessQuartic', 'symmetricEigen2x2', 'rayleighQuotient2',
  'gaussianVariational', 'basisTruncation', 'generalizedEigen2', 'perturbationTwoLevel',
  'degeneratePerturbation', 'asymptoticIntegral', 'asymptoticSeriesModel', 'errorDecomposition',
  'residualCertificate', 'evaluateApproximationCase'
];
for (const name of expectedApi) assert(typeof models[name] === 'function', `${name} production API must be exported`);

// Level 1: method class and omitted layer are two independent passport fields.
const passportCases = [
  ['gaussian-family', 'variational', 'ansatz'],
  ['six-site-subspace', 'representation-truncation', 'representation'],
  ['weak-two-level', 'perturbation', 'series-truncation'],
  ['harmonic-replacement', 'model-replacement', 'model']
];
for (const [caseId, method, layer] of passportCases) {
  const correct = models.evaluateApproximationPassport(caseId, { method, layer });
  assert(correct.correct, `${caseId} correct passport`);
  equal(correct.fields.method.correct, true, `${caseId} method field`);
  equal(correct.fields.layer.correct, true, `${caseId} layer field`);
  const wrongMethod = models.evaluateApproximationPassport(caseId, { method: 'numerical-solver', layer });
  assert(!wrongMethod.correct && !wrongMethod.fields.method.correct && wrongMethod.fields.layer.correct, `${caseId} isolates wrong method`);
  const wrongLayer = models.evaluateApproximationPassport(caseId, { method, layer: 'solver' });
  assert(!wrongLayer.correct && wrongLayer.fields.method.correct && !wrongLayer.fields.layer.correct, `${caseId} isolates wrong layer`);
  assert(correct.evidence.length > 20 && correct.caveat.length > 20, `${caseId} supplies evidence and caveat`);
}
throws(() => models.evaluateApproximationPassport('unknown', {}), 'unknown passport case must throw');

// Level 2: dimensionless quartic scaling.
const scaled = models.dimensionlessQuartic(1, 1, 0.1, 1);
near(scaled.omega, 1, 1e-15, 'unit oscillator omega');
near(scaled.lengthScale, 1, 1e-15, 'unit oscillator length');
near(scaled.energyScale, 1, 1e-15, 'unit oscillator energy');
near(scaled.g, 0.1, 1e-15, 'unit oscillator quartic coupling');
near(scaled.dimensionlessPotential(2), 0.5 * 4 + 0.1 * 16, 1e-15, 'dimensionless quartic potential');
for (const [m, k, beta, hbar] of [[2, 8, 0.5, 1], [3.5, 0.7, 0.03, 2], [0.4, 5, 1.2, 0.5]]) {
  const model = models.dimensionlessQuartic(m, k, beta, hbar);
  const omega = Math.sqrt(k / m);
  near(model.omega, omega, 1e-14, 'omega scaling');
  near(model.lengthScale, Math.sqrt(hbar / (m * omega)), 1e-14, 'length scaling');
  near(model.g, beta * hbar / (m * m * omega ** 3), 1e-13, 'quartic dimensionless coupling');
  assert(model.points.length >= 101 && model.points.every(point => Number.isFinite(point.q) && Number.isFinite(point.full)), 'quartic plot points finite');
}
throws(() => models.dimensionlessQuartic(0, 1, 1), 'zero mass must throw');
throws(() => models.dimensionlessQuartic(1, -1, 1), 'negative force constant must throw');
throws(() => models.dimensionlessQuartic(1, 1, -0.1), 'unbounded negative beta is outside exposed model');

// Level 3: exact two-dimensional Rayleigh landscape.
const spectrum = models.symmetricEigen2x2(1, 0.2, 3);
near(spectrum.values[0], 2 - Math.sqrt(1.04), 1e-14, 'lower 2x2 eigenvalue');
near(spectrum.values[1], 2 + Math.sqrt(1.04), 1e-14, 'upper 2x2 eigenvalue');
near(spectrum.values[0] + spectrum.values[1], 4, 1e-14, '2x2 trace invariant');
near(spectrum.values[0] * spectrum.values[1], 3 - 0.04, 1e-14, '2x2 determinant invariant');
for (const index of [0, 1]) {
  const vector = spectrum.vectors[index];
  near(Math.hypot(...vector), 1, 1e-14, `eigenvector ${index} normalized`);
  const angle = Math.atan2(vector[1], vector[0]) * 180 / Math.PI;
  const rayleigh = models.rayleighQuotient2(1, 0.2, 3, angle);
  near(rayleigh.energy, spectrum.values[index], 1e-12, `stationary Rayleigh value ${index}`);
  near(rayleigh.residualNorm, 0, 1e-12, `stationary residual ${index}`);
}
for (let angle = -180; angle <= 180; angle += 3) {
  const model = models.rayleighQuotient2(1, 0.2, 3, angle);
  assert(model.energy >= spectrum.values[0] - 1e-13 && model.energy <= spectrum.values[1] + 1e-13, `Rayleigh value bounded at ${angle} degrees`);
  near(Math.hypot(...model.vector), 1, 1e-14, `Rayleigh trial normalized at ${angle}`);
  near(Math.hypot(...model.residual), model.residualNorm, 1e-14, `Rayleigh residual norm at ${angle}`);
}
const degenerateSpectrum = models.symmetricEigen2x2(2, 0, 2);
near(degenerateSpectrum.values[0], 2, 1e-15, 'degenerate lower eigenvalue');
near(degenerateSpectrum.values[1], 2, 1e-15, 'degenerate upper eigenvalue');
assert(degenerateSpectrum.degenerate, 'identity-proportional matrix is degenerate');
throws(() => models.symmetricEigen2x2(1, Infinity, 2), 'nonfinite matrix entry must throw');

// Level 4: analytic Gaussian variational family.
for (const alpha of [0.1, 0.2, 0.5, 1, 2, 5, 10]) {
  const model = models.gaussianVariational(alpha);
  near(model.kinetic, alpha / 4, 1e-15, `Gaussian kinetic alpha=${alpha}`);
  near(model.potential, 1 / (4 * alpha), 1e-15, `Gaussian potential alpha=${alpha}`);
  near(model.energy, model.kinetic + model.potential, 1e-15, `Gaussian total alpha=${alpha}`);
  assert(model.energy >= 0.5 - 1e-15, `Gaussian upper bound alpha=${alpha}`);
  near(model.energy, models.gaussianVariational(1 / alpha).energy, 1e-14, `Gaussian alpha reciprocal symmetry ${alpha}`);
}
const optimum = models.gaussianVariational(1);
near(optimum.energy, 0.5, 1e-15, 'Gaussian exact optimum energy');
near(optimum.kinetic, optimum.potential, 1e-15, 'Gaussian virial balance');
assert(optimum.stationary && optimum.virialBalanced, 'Gaussian optimum flags');
throws(() => models.gaussianVariational(0), 'nonpositive Gaussian width must throw');

// Level 5: one fixed six-site Hamiltonian and nested principal Ritz spaces.
let previousEnergy = Infinity;
const fullOracle = 2 - 2 * Math.cos(Math.PI / 7);
for (let size = 1; size <= 6; size += 1) {
  const model = models.basisTruncation(size);
  near(model.energy, 2 - 2 * Math.cos(Math.PI / (size + 1)), 1e-14, `chain Ritz energy n=${size}`);
  near(model.fullEnergy, fullOracle, 1e-14, `chain full oracle n=${size}`);
  assert(model.energy <= previousEnergy + 1e-14, `nested Ritz energy nonincreasing n=${size}`);
  assert(model.energy >= model.fullEnergy - 1e-14, `nested Ritz upper estimate n=${size}`);
  if (size < 6) near(model.residualNorm, Math.sqrt(2 / (size + 1)) * Math.sin(size * Math.PI / (size + 1)), 1e-14, `chain boundary residual n=${size}`);
  else near(model.residualNorm, 0, 1e-15, 'full chain residual');
  near(model.energyError, model.energy - model.fullEnergy, 1e-15, `chain finite error n=${size}`);
  previousEnergy = model.energy;
}
assert(models.basisTruncation(6).convergedFiniteModel, 'full six-site model converged flag');
throws(() => models.basisTruncation(0), 'basis size zero must throw');
throws(() => models.basisTruncation(7), 'basis above declared full size must throw');
throws(() => models.basisTruncation(2.5), 'noninteger basis size must throw');

// Level 6: generalized symmetric-definite 2x2 eigenproblem.
const ordinary = models.generalizedEigen2(1, 0.2, 3, 0);
near(ordinary.values[0], spectrum.values[0], 1e-14, 's=0 generalized lower equals ordinary');
near(ordinary.values[1], spectrum.values[1], 1e-14, 's=0 generalized upper equals ordinary');
for (const s of [-0.95, -0.6, -0.2, 0, 0.2, 0.6, 0.95]) {
  const model = models.generalizedEigen2(-1, -0.2, 0.4, s);
  const sortedOverlap = [1 - Math.abs(s), 1 + Math.abs(s)];
  near(model.overlapEigenvalues[0], sortedOverlap[0], 1e-14, `overlap minimum s=${s}`);
  near(model.overlapEigenvalues[1], sortedOverlap[1], 1e-14, `overlap maximum s=${s}`);
  near(model.conditionNumber, (1 + Math.abs(s)) / (1 - Math.abs(s)), 1e-12, `overlap condition s=${s}`);
  for (const value of model.values) {
    near((1 - s * s) * value * value + (2 * s * -0.2 - (-1) - 0.4) * value + ((-1) * 0.4 - 0.04), 0, 2e-12, `generalized characteristic residual s=${s}`);
  }
  assert(model.values[0] <= model.values[1], `generalized roots ordered s=${s}`);
}
assert(models.generalizedEigen2(-1, -0.2, 0.4, 0.99).nearDependent, 'near dependent overlap warning');
throws(() => models.generalizedEigen2(1, 0, 2, 1), '|s|=1 must throw');
throws(() => models.generalizedEigen2(1, 0, 2, -1.1), '|s|>1 must throw');

// Level 7: exact two-level energy versus perturbative truncations.
for (const [gap, coupling, lambda] of [[2, 0.5, 0], [2, 0.5, 0.2], [1, 0.3, 1], [4, -0.7, 0.8]]) {
  const model = models.perturbationTwoLevel(gap, coupling, lambda);
  const x = lambda * coupling;
  near(model.exactLower, (gap - Math.sqrt(gap * gap + 4 * x * x)) / 2, 1e-14, 'two-level exact lower');
  near(model.exactUpper, (gap + Math.sqrt(gap * gap + 4 * x * x)) / 2, 1e-14, 'two-level exact upper');
  near(model.order2, -x * x / gap, 1e-15, 'two-level second order');
  near(model.order4, -x * x / gap + x ** 4 / gap ** 3, 1e-15, 'two-level fourth order');
  near(model.ratio, Math.abs(x / gap), 1e-15, 'coupling-gap ratio');
  near(model.exactLower + model.exactUpper, gap, 1e-14, 'two-level trace');
}
const weak = models.perturbationTwoLevel(2, 0.5, 0.02);
assert(weak.error4 < weak.error2, 'fourth order improves sufficiently weak case');
throws(() => models.perturbationTwoLevel(0, 1, 1), 'zero gap must throw');

// Level 8: diagonalize the perturbation within the full degenerate subspace.
const split = models.degeneratePerturbation(1, 0.5, -1, 0);
near(split.shifts[0], -Math.sqrt(1.25), 1e-14, 'degenerate lower shift');
near(split.shifts[1], Math.sqrt(1.25), 1e-14, 'degenerate upper shift');
near(split.trace, 0, 1e-15, 'degenerate trace');
near(split.determinant, -1.25, 1e-15, 'degenerate determinant');
for (let angle = 0; angle <= 180; angle += 7.5) {
  const model = models.degeneratePerturbation(1, 0.5, -1, angle);
  near(model.rotated[0][0] + model.rotated[1][1], split.trace, 2e-14, `rotated trace ${angle}`);
  near(model.rotated[0][0] * model.rotated[1][1] - model.rotated[0][1] ** 2, split.determinant, 3e-14, `rotated determinant ${angle}`);
  near(model.shifts[0], split.shifts[0], 2e-14, `rotation-invariant lower shift ${angle}`);
  near(model.shifts[1], split.shifts[1], 2e-14, `rotation-invariant upper shift ${angle}`);
}
const same = models.degeneratePerturbation(0.7, 0, 0.7, 37);
assert(same.coincident, 'scalar perturbation preserves exact degeneracy');
near(same.splitting, 0, 1e-15, 'scalar perturbation zero splitting');
equal(same.preferredAngle, null, 'exact degeneracy has no preferred direction');
near(same.rotated[0][1], 0, 1e-14, 'scalar perturbation remains diagonal in every basis');

// Level 9: factorial asymptotic expansion and finite numerical reference.
near(models.asymptoticIntegral(0), 1, 1e-15, 'asymptotic integral at g=0');
near(models.asymptoticIntegral(1), 0.5963473623231941, 3e-12, 'asymptotic integral at g=1');
for (const g of [0.05, 0.1, 0.2, 0.5, 1]) {
  const model = models.asymptoticSeriesModel(g, Math.min(4, 14), 14);
  assert(model.reference > 0 && model.reference <= 1, `positive integral reference g=${g}`);
  equal(model.partials.length, 15, `partial count g=${g}`);
  near(model.partials[0].sum, 1, 1e-15, `zeroth partial g=${g}`);
  near(model.partials[1].sum, 1 - g, 1e-15, `first partial g=${g}`);
  near(model.partials[2].sum, 1 - g + 2 * g * g, 1e-14, `second partial g=${g}`);
  assert(model.bestOrder >= 0 && model.bestOrder <= 14, `best order range g=${g}`);
  const bestError = Math.min(...model.partials.map(item => item.error));
  near(model.bestError, bestError, 1e-15, `best observed error g=${g}`);
  equal(model.selected.order, 4, `selected order g=${g}`);
}
const divergent = models.asymptoticSeriesModel(0.5, 14, 14);
assert(divergent.partials[14].error > divergent.bestError * 1000, 'late factorial terms become much worse');
throws(() => models.asymptoticSeriesModel(-0.1, 2), 'negative g outside exposed integral model');
throws(() => models.asymptoticSeriesModel(0.1, 15, 14), 'selected order beyond maximum must throw');

// Level 10: signed errors telescope; absolute burdens do not cancel.
for (const values of [
  [-74.95, -75.0, -75.03, -75.04],
  [-75.05, -75.0, -75.03, -75.04],
  [1.2, 1.0, 1.3, 1.1]
]) {
  const model = models.errorDecomposition(...values);
  near(model.components.solver, values[0] - values[1], 1e-14, 'solver difference');
  near(model.components.representation, values[1] - values[2], 1e-14, 'representation difference');
  near(model.components.model, values[2] - values[3], 1e-14, 'model difference');
  near(model.signedSum, model.totalError, 1e-14, 'signed error telescope');
  near(model.totalError, values[0] - values[3], 1e-14, 'direct total error');
  assert(model.absoluteBurden + 1e-15 >= Math.abs(model.totalError), 'absolute burden bounds net signed error');
}
assert(models.errorDecomposition(-75.05, -75.0, -75.03, -75.04).cancellation, 'opposed components flag cancellation');
assert(!models.errorDecomposition(-74.95, -75.0, -75.03, -75.04).cancellation, 'same-sign components do not flag cancellation');
throws(() => models.errorDecomposition(1, 2, NaN, 4), 'nonfinite error layer must throw');

// Level 11: finite three-level residual and conditional Temple-type bracket.
const exactTrial = models.residualCertificate(0, 73);
near(exactTrial.rayleigh, 0, 1e-15, 'ground trial Rayleigh value');
near(exactTrial.variance, 0, 1e-15, 'ground trial variance');
near(exactTrial.residualNorm, 0, 1e-15, 'ground trial residual');
near(exactTrial.lowerBound, 0, 1e-15, 'ground trial lower bound');
assert(exactTrial.applicable, 'ground trial satisfies gap condition');
for (const [theta, phi] of [[5, 0], [15, 20], [25, 50], [35, 80]]) {
  const model = models.residualCertificate(theta, phi);
  near(model.coefficients.reduce((sum, value) => sum + value * value, 0), 1, 1e-14, `residual trial normalized ${theta}/${phi}`);
  near(model.residualNorm ** 2, model.variance, 2e-14, `variance-residual identity ${theta}/${phi}`);
  assert(model.rayleigh >= model.exactGround - 1e-14, `variational upper bound ${theta}/${phi}`);
  if (model.applicable) {
    assert(model.lowerBound <= model.exactGround + 2e-13, `Temple lower below exact ground ${theta}/${phi}`);
    assert(model.lowerBound <= model.rayleigh, `Temple bracket ordered ${theta}/${phi}`);
  }
}
const noGap = models.residualCertificate(70, 90);
assert(!noGap.applicable, 'high-energy trial fails mu<E1 gap condition');
equal(noGap.lowerBound, null, 'failed gap condition suppresses lower certificate');

// Level 12: each campaign file grades method, diagnostic, and evidence separately.
const bossCases = [
  ['weak-isolated', 'nondegenerate-perturbation', 'coupling-gap-ratio', 'order-stability'],
  ['degenerate-pair', 'degenerate-perturbation', 'subspace-offdiagonal', 'basis-invariance'],
  ['ground-upper-bound', 'variational-ritz', 'rayleigh-residual', 'nested-convergence'],
  ['overlap-collapse', 'generalized-eigenproblem', 'overlap-spectrum', 'threshold-stability'],
  ['factorial-tail', 'asymptotic-truncation', 'least-term', 'order-scan']
];
for (const [caseId, method, diagnostic, evidence] of bossCases) {
  const correct = models.evaluateApproximationCase(caseId, { method, diagnostic, evidence });
  equal(correct.score, 3, `${caseId} full score`);
  equal(correct.total, 3, `${caseId} total fields`);
  assert(correct.complete && correct.correct, `${caseId} complete/correct`);
  assert(Object.values(correct.fields).every(field => field.correct && field.feedback.length > 15), `${caseId} field feedback`);
  assert(correct.caveat.length > 25, `${caseId} caveat`);
  const partial = models.evaluateApproximationCase(caseId, { method, diagnostic: 'wrong', evidence: 'wrong' });
  equal(partial.score, 1, `${caseId} partial field score`);
  assert(!partial.correct && partial.fields.method.correct && !partial.fields.diagnostic.correct && !partial.fields.evidence.correct, `${caseId} isolates boss field errors`);
}
throws(() => models.evaluateApproximationCase('unknown', {}), 'unknown boss case must throw');

console.log('Project XC Approximation Thinking model tests OK');
console.log(`- deterministic assertions: ${checks}`);
console.log('- Scaling, variational, basis, overlap, perturbation, asymptotic, error, residual, and boss contracts: OK');
