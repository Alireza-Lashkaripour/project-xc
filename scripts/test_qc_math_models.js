#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'site', 'assets', 'qc-math-language.js'), 'utf8');

global.window = {};
global.document = {
  readyState: 'loading',
  addEventListener() {},
  getElementById() { return null; }
};
vm.runInThisContext(source, { filename: 'qc-math-language.js' });

const models = global.window.QCMathLanguageModels;
if (!models) throw new Error('QCMathLanguageModels was not exported');

let checks = 0;
function assert(condition, message) {
  checks += 1;
  if (!condition) throw new Error(message);
}
function near(actual, expected, tolerance, message) {
  assert(Number.isFinite(actual), `${message}: ${actual} is not finite`);
  assert(Math.abs(actual - expected) <= tolerance, `${message}: got ${actual}, expected ${expected} ± ${tolerance}`);
}
function vectorNear(actual, expected, tolerance, message) {
  assert(actual.length === expected.length, `${message}: vector lengths differ`);
  actual.forEach((value, index) => near(value, expected[index], tolerance, `${message}[${index}]`));
}

for (const [magnitude, phase, expected] of [
  [2, 0, [2, 0]],
  [3, 90, [0, 3]],
  [1.5, 180, [-1.5, 0]],
  [4, 270, [0, -4]]
]) {
  const z = models.complexFromPolar(magnitude, phase);
  near(z.re, expected[0], 1e-12, `complex real part at ${phase}°`);
  near(z.im, expected[1], 1e-12, `complex imaginary part at ${phase}°`);
  near(z.modulusSquared, magnitude ** 2, 1e-12, `complex modulus squared at ${phase}°`);
}

for (const [vx, vy, angle] of [
  [3, 4, 0],
  [3, 4, 90],
  [-2.5, 1.2, 37],
  [0.8, -3.1, 143]
]) {
  const model = models.projectionModel(vx, vy, angle);
  vectorNear([
    model.projection[0] + model.residual[0],
    model.projection[1] + model.residual[1]
  ], [vx, vy], 1e-12, 'projection reconstruction');
  near(model.orthogonality, 0, 1e-12, 'projection residual orthogonality');
  near(model.normSquared, model.projectionNormSquared + model.residualNormSquared, 1e-11, 'Pythagorean projection identity');
  near(model.basis[0] ** 2 + model.basis[1] ** 2, 1, 1e-12, 'projection basis normalization');
}

for (const [vx, vy, angle] of [
  [2, 1, 0],
  [2, 1, 90],
  [-1.7, 3.4, 28],
  [0.2, -4.1, 211]
]) {
  const model = models.rotationModel(vx, vy, angle);
  vectorNear(model.reconstructed, [vx, vy], 1e-12, 'passive basis-change round trip');
  near(model.normOriginal, model.normCoordinates, 1e-12, 'basis-change norm invariance');
  near(model.determinant, 1, 1e-12, 'rotation determinant');
  near(model.orthogonalityError, 0, 1e-12, 'rotation orthogonality');
  near(model.coordinates[0], vx * model.basis[0][0] + vy * model.basis[0][1], 1e-12, 'first passive coordinate is the e1-prime dot product');
  near(model.coordinates[1], vx * model.basis[1][0] + vy * model.basis[1][1], 1e-12, 'second passive coordinate is the e2-prime dot product');
}

const quarterTurn = models.rotationModel(1, 0, 90);
vectorNear(quarterTurn.coordinates, [0, -1], 1e-12, 'advertised passive 90-degree sign convention');

for (const [a, b, d, expected] of [
  [2, 0, 5, [2, 5]],
  [2, 1, 2, [1, 3]],
  [1, 1e-5, 1, [0.99999, 1.00001]],
  [-1, 0.75, 4, [(-1 + 4 - Math.sqrt(27.25)) / 2, (-1 + 4 + Math.sqrt(27.25)) / 2]]
]) {
  const spectrum = models.symmetricEigen2x2(a, b, d);
  near(spectrum.values[0], expected[0], 1e-11, 'lower symmetric eigenvalue');
  near(spectrum.values[1], expected[1], 1e-11, 'upper symmetric eigenvalue');
  near(spectrum.values[0] + spectrum.values[1], a + d, 1e-11, 'eigenvalue trace identity');
  near(spectrum.values[0] * spectrum.values[1], a * d - b * b, 1e-10, 'eigenvalue determinant identity');
  near(spectrum.vectors[0][0] * spectrum.vectors[1][0] + spectrum.vectors[0][1] * spectrum.vectors[1][1], 0, 1e-11, 'symmetric eigenvectors orthogonal');
  for (let index = 0; index < 2; index += 1) {
    const v = spectrum.vectors[index];
    const candidateAngle = Math.atan2(v[1], v[0]) * 180 / Math.PI;
    const puzzle = models.eigenPuzzleModel(a, b, d, candidateAngle);
    near(puzzle.residualNorm, 0, 1e-10, `eigenvector ${index} residual`);
    near(puzzle.rayleigh, spectrum.values[index], 1e-10, `eigenvector ${index} Rayleigh quotient`);
  }
}

for (const sigmaX of [0.25, 0.5, 1, 2.5]) {
  const model = models.fourierGaussianModel(sigmaX, 1.3);
  near(model.sigmaK, 1 / (2 * sigmaX), 1e-14, 'Gaussian Fourier width');
  near(model.widthProduct, 0.5, 1e-14, 'Gaussian Fourier width product');
  near(model.positionArea, 1, 3e-14, 'position density normalization');
  near(model.momentumArea, 1, 3e-14, 'momentum density normalization');
  near(model.positionMean, 0, 2e-12, 'position-space center');
  near(model.positionVariance, sigmaX ** 2, 2e-12, 'position variance');
  near(model.momentumMean, 1.3, 2e-12, 'momentum-space center');
  near(model.momentumVariance, model.sigmaK ** 2, 2e-12, 'momentum variance');
}

const degenerateSpectrum = models.symmetricEigen2x2(1, 0, 1);
near(degenerateSpectrum.values[0], 1, 1e-12, 'degenerate lower eigenvalue');
near(degenerateSpectrum.values[1], 1, 1e-12, 'degenerate upper eigenvalue');
const degenerateDirection = models.eigenPuzzleModel(1, 0, 1, 37);
near(degenerateDirection.rayleigh, 1, 1e-12, 'degenerate-space Rayleigh quotient');
near(degenerateDirection.residualNorm, 0, 1e-12, 'every direction is an eigenvector of a scalar matrix');
assert(typeof models.nearestEigenvectorAngle === 'function', 'nearestEigenvectorAngle model must be exported for deterministic UI testing');
near(models.nearestEigenvectorAngle(2, 0, 2, 18), 18, 1e-12, 'degenerate reveal keeps the already-valid candidate direction');
near(models.nearestEigenvectorAngle(2, 1, 2, 18), 45, 1e-10, 'nondegenerate reveal chooses the nearest eigendirection');

const puzzleAtEigenvector = models.eigenPuzzleModel(2, 1, 2, 45);
near(puzzleAtEigenvector.rayleigh, 3, 1e-12, '45° coupled-matrix Rayleigh quotient');
near(puzzleAtEigenvector.residualNorm, 0, 1e-12, '45° coupled-matrix eigenvector residual');
const puzzleOffAxis = models.eigenPuzzleModel(2, 1, 2, 0);
assert(puzzleOffAxis.residualNorm > 0.9, 'off-eigenvector candidate must have a visible residual');

console.log('Project XC Mathematical Language model tests OK');
console.log(`- deterministic assertions: ${checks}`);
console.log('- complex, projection, rotation, eigensystem, and Fourier models: OK');
