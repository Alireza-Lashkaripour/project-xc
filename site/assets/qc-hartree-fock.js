'use strict';

(() => {
  const EPS = 1e-10;

  function finiteNumber(value) { return typeof value === 'number' && Number.isFinite(value); }
  function validMatrix(matrix, rows = null, columns = null) {
    if (!Array.isArray(matrix) || matrix.length === 0 || !matrix.every(Array.isArray)) return false;
    const width = matrix[0].length;
    return width > 0 && matrix.every(row => row.length === width && row.every(finiteNumber)) && (rows === null || matrix.length === rows) && (columns === null || width === columns);
  }
  function cloneMatrix(matrix) { return matrix.map(row => row.slice()); }
  function transpose(matrix) { return matrix[0].map((_, column) => matrix.map(row => row[column])); }
  function matMul(left, right) {
    if (!validMatrix(left) || !validMatrix(right) || left[0].length !== right.length) throw new Error('incompatible matrices');
    return left.map(row => right[0].map((_, column) => row.reduce((sum, value, k) => sum + value * right[k][column], 0)));
  }
  function matAdd(left, right, scale = 1) {
    if (!validMatrix(left) || !validMatrix(right, left.length, left[0].length)) throw new Error('incompatible matrices');
    return left.map((row, i) => row.map((value, j) => value + scale * right[i][j]));
  }
  function frobenius(matrix) { return Math.sqrt(matrix.flat().reduce((sum, value) => sum + value * value, 0)); }
  function traceProduct(left, right) {
    if (!validMatrix(left) || !validMatrix(right, left.length, left[0].length) || left.length !== left[0].length) throw new Error('trace product requires same-size square matrices');
    let value = 0;
    for (let p = 0; p < left.length; p += 1) for (let q = 0; q < left.length; q += 1) value += left[p][q] * right[q][p];
    return value;
  }
  function symmetryResidual(matrix) {
    if (!validMatrix(matrix) || matrix.length !== matrix[0].length) return Infinity;
    let residual = 0;
    for (let i = 0; i < matrix.length; i += 1) for (let j = i + 1; j < matrix.length; j += 1) residual = Math.max(residual, Math.abs(matrix[i][j] - matrix[j][i]));
    return residual;
  }
  function column(matrix, index) { return matrix.map(row => row[index]); }
  function dot(left, right) { return left.reduce((sum, value, i) => sum + value * right[i], 0); }
  function matVec(matrix, vector) { return matrix.map(row => dot(row, vector)); }
  function outer(left, right) { return left.map(a => right.map(b => a * b)); }

  function symmetricEigen2(matrix, tolerance = EPS) {
    if (!validMatrix(matrix, 2, 2) || symmetryResidual(matrix) > tolerance) return { valid: false, values: [], vectors: [] };
    const a = matrix[0][0];
    const b = (matrix[0][1] + matrix[1][0]) / 2;
    const d = matrix[1][1];
    const center = (a + d) / 2;
    const radius = Math.hypot((a - d) / 2, b);
    const angle = Math.atan2(2 * b, a - d) / 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const vectors = [[-s, c], [c, s]];
    return { valid: true, values: [center - radius, center + radius], vectors };
  }

  function generalizedEigen2(fock, overlap, tolerance = EPS) {
    if (!validMatrix(fock, 2, 2) || !validMatrix(overlap, 2, 2) || symmetryResidual(fock) > tolerance || symmetryResidual(overlap) > tolerance) return { valid: false, reason: 'symmetric-two-by-two-required' };
    const metric = symmetricEigen2(overlap, tolerance);
    if (!metric.valid || metric.values[0] <= tolerance) return { valid: false, reason: 'overlap-not-positive-definite' };
    const metricVectors = metric.vectors;
    const inverseRootDiagonal = [[1 / Math.sqrt(metric.values[0]), 0], [0, 1 / Math.sqrt(metric.values[1])]];
    const x = matMul(metricVectors, matMul(inverseRootDiagonal, transpose(metricVectors)));
    const orthogonalFock = matMul(transpose(x), matMul(fock, x));
    const canonical = symmetricEigen2(orthogonalFock, tolerance * 10);
    if (!canonical.valid) return { valid: false, reason: 'orthogonalized-fock-invalid' };
    const coefficients = matMul(x, canonical.vectors);
    const residuals = canonical.values.map((energy, orbital) => {
      const c = column(coefficients, orbital);
      const fc = matVec(fock, c);
      const sc = matVec(overlap, c);
      return Math.hypot(...fc.map((value, i) => value - energy * sc[i]));
    });
    const metricDifference = matAdd(matMul(transpose(coefficients), matMul(overlap, coefficients)), [[1, 0], [0, 1]], -1);
    const metricResidual = frobenius(metricDifference);
    return { valid: true, values: canonical.values, coefficients, overlapValues: metric.values, residuals, metricResidual };
  }

  function densityProjector(coefficients, occupiedIndices) {
    if (!validMatrix(coefficients) || !Array.isArray(occupiedIndices) || occupiedIndices.length === 0 || new Set(occupiedIndices).size !== occupiedIndices.length || occupiedIndices.some(index => !Number.isInteger(index) || index < 0 || index >= coefficients[0].length)) throw new Error('invalid occupied coefficient columns');
    const size = coefficients.length;
    const density = Array.from({ length: size }, () => Array(size).fill(0));
    for (const orbital of occupiedIndices) {
      const c = column(coefficients, orbital);
      const contribution = outer(c, c);
      for (let p = 0; p < size; p += 1) for (let q = 0; q < size; q += 1) density[p][q] += contribution[p][q];
    }
    return density;
  }

  function auditDensity(density, overlap, occupiedCount, tolerance = 1e-8) {
    if (!validMatrix(density) || density.length !== density[0].length || !validMatrix(overlap, density.length, density.length) || !Number.isInteger(occupiedCount) || occupiedCount < 0) return { valid: false };
    const closure = matAdd(matMul(density, matMul(overlap, density)), density, -1);
    const electrons = traceProduct(density, overlap);
    const closureResidual = frobenius(closure);
    return {
      valid: true,
      electrons,
      traceCorrect: Math.abs(electrons - occupiedCount) <= tolerance,
      closureResidual,
      idempotent: closureResidual <= tolerance,
      hermitian: symmetryResidual(density) <= tolerance
    };
  }

  function coulombExchange(coulomb, exchange, sameSpin) {
    if (!finiteNumber(coulomb) || !finiteNumber(exchange) || coulomb < 0 || exchange < 0 || typeof sameSpin !== 'boolean') return { valid: false };
    const exchangeContribution = sameSpin ? -exchange : 0;
    return { valid: true, coulomb, exchange: exchangeContribution, total: coulomb + exchangeContribution };
  }

  function validTensor4(tensor, size) {
    return Array.isArray(tensor) && tensor.length === size && tensor.every(layer => Array.isArray(layer) && layer.length === size && layer.every(plane => Array.isArray(plane) && plane.length === size && plane.every(row => Array.isArray(row) && row.length === size && row.every(finiteNumber))));
  }
  function antisymmetrizedIntegralResidual(integrals) {
    if (!Array.isArray(integrals) || !validTensor4(integrals, integrals.length)) return Infinity;
    const size = integrals.length;
    let residual = 0;
    for (let p = 0; p < size; p += 1) for (let r = 0; r < size; r += 1) for (let q = 0; q < size; q += 1) for (let s = 0; s < size; s += 1) {
      const value = integrals[p][r][q][s];
      residual = Math.max(residual, Math.abs(value + integrals[r][p][q][s]), Math.abs(value + integrals[p][r][s][q]), Math.abs(value - integrals[q][s][p][r]));
    }
    return residual;
  }

  function buildFock(coreHamiltonian, density, antisymmetrizedIntegrals) {
    if (!validMatrix(coreHamiltonian) || coreHamiltonian.length !== coreHamiltonian[0].length || !validMatrix(density, coreHamiltonian.length, coreHamiltonian.length) || !validTensor4(antisymmetrizedIntegrals, coreHamiltonian.length)) throw new Error('invalid Fock-build data');
    const size = coreHamiltonian.length;
    const fock = cloneMatrix(coreHamiltonian);
    for (let p = 0; p < size; p += 1) for (let q = 0; q < size; q += 1) {
      for (let r = 0; r < size; r += 1) for (let s = 0; s < size; s += 1) fock[p][q] += density[r][s] * antisymmetrizedIntegrals[p][r][q][s];
    }
    return fock;
  }

  function hfEnergy(coreHamiltonian, fock, density) {
    if (!validMatrix(coreHamiltonian) || !validMatrix(fock, coreHamiltonian.length, coreHamiltonian[0].length) || !validMatrix(density, coreHamiltonian.length, coreHamiltonian[0].length)) throw new Error('invalid HF energy data');
    return 0.5 * traceProduct(density, matAdd(coreHamiltonian, fock));
  }

  function commutatorResidual(fock, density, overlap) {
    if (!validMatrix(fock) || fock.length !== fock[0].length || !validMatrix(density, fock.length, fock.length) || !validMatrix(overlap, fock.length, fock.length)) return { valid: false, norm: Infinity };
    const residual = matAdd(matMul(fock, matMul(density, overlap)), matMul(overlap, matMul(density, fock)), -1);
    return { valid: true, matrix: residual, norm: frobenius(residual) };
  }

  function rotationSlice(hessianSlice, theta) {
    if (!validMatrix(hessianSlice, 2, 2) || symmetryResidual(hessianSlice) > EPS || !finiteNumber(theta)) return { valid: false };
    const a = hessianSlice[0][0];
    const b = hessianSlice[0][1];
    const d = hessianSlice[1][1];
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    return {
      valid: true,
      energy: a * c * c + d * s * s + 2 * b * s * c,
      derivative: (d - a) * Math.sin(2 * theta) + 2 * b * Math.cos(2 * theta),
      curvature: 2 * (d - a) * Math.cos(2 * theta) - 4 * b * Math.sin(2 * theta)
    };
  }

  function classifyStationarity(hessianSlice, theta, tolerance = 1e-8) {
    const slice = rotationSlice(hessianSlice, theta);
    if (!slice.valid) return { valid: false, stationary: false, kind: 'invalid' };
    const stationary = Math.abs(slice.derivative) <= tolerance;
    let kind = 'not-stationary';
    if (stationary && slice.curvature > tolerance) kind = 'local-minimum-slice';
    else if (stationary && slice.curvature < -tolerance) kind = 'local-maximum-slice';
    else if (stationary) kind = 'flat-stationary-slice';
    return { ...slice, stationary, kind, downhillDirection: stationary ? 'none-first-order' : (slice.derivative > 0 ? 'negative-theta' : 'positive-theta') };
  }

  function validScfParameters(parameters) {
    return parameters && finiteNumber(parameters.delta) && finiteNumber(parameters.interaction) && finiteNumber(parameters.coupling) && parameters.coupling > 0;
  }
  function twoLevelScfOutput(input, parameters) {
    if (!finiteNumber(input) || !validScfParameters(parameters)) return NaN;
    const difference = parameters.delta - 2 * parameters.interaction * input;
    return difference / Math.sqrt(difference * difference + 4 * parameters.coupling * parameters.coupling);
  }
  function twoLevelEnergy(densityCoordinate, parameters) {
    const x = Math.max(-1, Math.min(1, densityCoordinate));
    return -0.5 * parameters.delta * x - parameters.coupling * Math.sqrt(Math.max(0, 1 - x * x)) + 0.5 * parameters.interaction * x * x;
  }
  function dampValue(oldValue, rawValue, oldWeight) {
    if (![oldValue, rawValue, oldWeight].every(finiteNumber) || oldWeight < 0 || oldWeight >= 1) return NaN;
    return oldWeight * oldValue + (1 - oldWeight) * rawValue;
  }
  function iterateTwoLevelScf(initial, parameters, iterations, oldWeight = 0) {
    if (!finiteNumber(initial) || !validScfParameters(parameters) || !Number.isInteger(iterations) || iterations < 1 || !finiteNumber(oldWeight) || oldWeight < 0 || oldWeight >= 1) return [];
    const history = [];
    let input = initial;
    for (let cycle = 1; cycle <= iterations; cycle += 1) {
      const rawOutput = twoLevelScfOutput(input, parameters);
      const signedResidual = rawOutput - input;
      const output = dampValue(input, rawOutput, oldWeight);
      history.push({ cycle, input, rawOutput, output, signedResidual, residual: Math.abs(signedResidual), energy: twoLevelEnergy(input, parameters) });
      input = output;
    }
    return history;
  }

  function classifyScfLog(log, densityTolerance = 1e-6, energyTolerance = 1e-8) {
    if (!log || !Array.isArray(log.energy) || !Array.isArray(log.densityResidual) || !Array.isArray(log.density) || log.energy.length < 3 || log.energy.length !== log.densityResidual.length || log.energy.length !== log.density.length || ![...log.energy, ...log.densityResidual, ...log.density].every(finiteNumber)) return { valid: false, kind: 'invalid' };
    const last = log.energy.length - 1;
    const deltaEnergy = Math.abs(log.energy[last] - log.energy[last - 1]);
    const residual = Math.abs(log.densityResidual[last]);
    if (residual <= densityTolerance && deltaEnergy <= energyTolerance) return { valid: true, kind: 'converged', deltaEnergy, residual };
    if (deltaEnergy <= energyTolerance && residual > densityTolerance) return { valid: true, kind: 'false-plateau', deltaEnergy, residual };
    const densityTail = log.density.slice(-4);
    const twoCycle = densityTail.length === 4 && Math.abs(densityTail[0] - densityTail[2]) <= 1e-8 && Math.abs(densityTail[1] - densityTail[3]) <= 1e-8 && Math.abs(densityTail[0] - densityTail[1]) > densityTolerance;
    if (twoCycle) return { valid: true, kind: 'oscillatory', deltaEnergy, residual };
    const residualTail = log.densityResidual.slice(-3).map(Math.abs);
    const increasing = residualTail[1] > residualTail[0] && residualTail[2] > residualTail[1] && residualTail[2] > 2 * residualTail[0];
    if (increasing) return { valid: true, kind: 'divergent', deltaEnergy, residual };
    return { valid: true, kind: 'stalled', deltaEnergy, residual };
  }

  function levelShiftFock(fock, occupiedProjector, shift) {
    if (!validMatrix(fock) || fock.length !== fock[0].length || !validMatrix(occupiedProjector, fock.length, fock.length) || !finiteNumber(shift) || shift < 0) throw new Error('invalid level-shift data');
    const complement = occupiedProjector.map((row, i) => row.map((value, j) => (i === j ? 1 : 0) - value));
    return matAdd(fock, complement, shift);
  }

  function solveLinear(matrix, vector, tolerance = 1e-12) {
    const size = vector.length;
    const augmented = matrix.map((row, i) => [...row, vector[i]]);
    for (let columnIndex = 0; columnIndex < size; columnIndex += 1) {
      let pivot = columnIndex;
      for (let row = columnIndex + 1; row < size; row += 1) if (Math.abs(augmented[row][columnIndex]) > Math.abs(augmented[pivot][columnIndex])) pivot = row;
      if (Math.abs(augmented[pivot][columnIndex]) <= tolerance) return null;
      [augmented[columnIndex], augmented[pivot]] = [augmented[pivot], augmented[columnIndex]];
      const scale = augmented[columnIndex][columnIndex];
      for (let j = columnIndex; j <= size; j += 1) augmented[columnIndex][j] /= scale;
      for (let row = 0; row < size; row += 1) if (row !== columnIndex) {
        const factor = augmented[row][columnIndex];
        for (let j = columnIndex; j <= size; j += 1) augmented[row][j] -= factor * augmented[columnIndex][j];
      }
    }
    return augmented.map(row => row[size]);
  }

  function diisCoefficients(residuals, tolerance = 1e-12) {
    if (!Array.isArray(residuals) || residuals.length < 2 || !residuals.every(Array.isArray) || residuals.some(row => row.length !== residuals[0].length || row.length === 0 || !row.every(finiteNumber))) return { valid: false, reason: 'invalid-residuals' };
    const count = residuals.length;
    const matrix = Array.from({ length: count + 1 }, () => Array(count + 1).fill(0));
    for (let i = 0; i < count; i += 1) for (let j = 0; j < count; j += 1) matrix[i][j] = dot(residuals[i], residuals[j]);
    for (let i = 0; i < count; i += 1) matrix[i][count] = matrix[count][i] = 1;
    const right = Array(count + 1).fill(0);
    right[count] = 1;
    const solution = solveLinear(matrix, right, tolerance);
    if (!solution || solution.slice(0, count).some(value => !finiteNumber(value))) return { valid: false, reason: 'singular-history' };
    const coefficients = solution.slice(0, count);
    const mixed = diisMix(residuals, coefficients);
    return { valid: true, coefficients, residualNorm: Math.sqrt(dot(mixed, mixed)) };
  }
  function diisMix(vectors, coefficients) {
    if (!Array.isArray(vectors) || vectors.length === 0 || !Array.isArray(coefficients) || coefficients.length !== vectors.length || vectors.some(vector => !Array.isArray(vector) || vector.length !== vectors[0].length || !vector.every(finiteNumber)) || !coefficients.every(finiteNumber)) throw new Error('invalid DIIS mix');
    return vectors[0].map((_, component) => vectors.reduce((sum, vector, i) => sum + coefficients[i] * vector[component], 0));
  }

  function uhfSpinS2(nAlpha, nBeta, alphaBetaOverlap) {
    if (!Number.isInteger(nAlpha) || !Number.isInteger(nBeta) || nAlpha < nBeta || nBeta < 0 || !Array.isArray(alphaBetaOverlap) || alphaBetaOverlap.length !== nAlpha || alphaBetaOverlap.some(row => !Array.isArray(row) || row.length !== nBeta || !row.every(finiteNumber))) return { valid: false };
    const rowNorms = alphaBetaOverlap.map(row => row.reduce((sum, value) => sum + value * value, 0));
    const columnNorms = Array.from({ length: nBeta }, (_, columnIndex) => alphaBetaOverlap.reduce((sum, row) => sum + row[columnIndex] * row[columnIndex], 0));
    if ([...rowNorms, ...columnNorms].some(norm => norm > 1 + EPS)) return { valid: false };
    const ms = (nAlpha - nBeta) / 2;
    const overlapSquared = alphaBetaOverlap.flat().reduce((sum, value) => sum + value * value, 0);
    const s2 = ms * (ms + 1) + nBeta - overlapSquared;
    const target = ms * (ms + 1);
    return { valid: true, ms, target, s2, contamination: s2 - target, overlapSquared };
  }

  function zeroTensor4(size) { return Array.from({ length: size }, () => Array.from({ length: size }, () => Array.from({ length: size }, () => Array(size).fill(0)))); }
  function fockDossier(asymmetric = false) {
    const integrals = zeroTensor4(2);
    const pair = 0.4;
    integrals[0][1][0][1] = pair;
    integrals[1][0][0][1] = -pair;
    integrals[0][1][1][0] = -pair;
    integrals[1][0][1][0] = pair;
    if (asymmetric) {
      integrals[0][0][1][0] = 0.05;
      integrals[1][0][0][0] = 0.12;
    }
    return {
      h: [[-1, 0], [0, -0.8]],
      density: [[1, 0], [0, 1]],
      integrals,
      integralLabel: asymmetric ? 'raw ERIs: g₀₀₁₀=0.050; g₁₀₀₀=0.120' : 'independent ERI: ⟨01||01⟩=0.400; partners generated by antisymmetry'
    };
  }

  const VARIATION_DOSSIERS = Object.freeze({
    'variation-a': { slice: [[-1, 0], [0, 0.5]], theta: 0 },
    'variation-b': { slice: [[1, 0], [0, -0.5]], theta: 0 },
    'variation-c': { slice: [[-1, 0.2], [0.2, 0.5]], theta: 0 }
  });
  const COULOMB_DOSSIERS = Object.freeze({
    'coulomb-a': { j: 0.8, k: 0.3, sameSpin: true },
    'coulomb-b': { j: 0.8, k: 0.3, sameSpin: false },
    'coulomb-c': { j: 0.7, k: 0.7, sameSpin: true }
  });
  const FOCK_DOSSIERS = Object.freeze({ 'fock-a': fockDossier(false), 'fock-b': fockDossier(true) });
  const ROOTHAAN_DOSSIERS = Object.freeze({
    'roothaan-a': { fock: [[-1, 0.2], [0.2, 0.5]], overlap: [[1, 0.2], [0.2, 1]] },
    'roothaan-b': { fock: [[-1, 0.2], [0.2, 0.5]], overlap: [[1, 1], [1, 1]] }
  });
  const DENSITY_DOSSIERS = Object.freeze({
    'density-a': { density: [[1, 0], [0, 0]], overlap: [[1, 0], [0, 1]], occupied: 1 },
    'density-b': { density: [[0.7, 0], [0, 0.3]], overlap: [[1, 0], [0, 1]], occupied: 1 }
  });
  const STATIONARITY_DOSSIERS = Object.freeze({
    'stationarity-a': { slice: [[-1, 0], [0, 0.5]], theta: 0 },
    'stationarity-b': { slice: [[-1, 0.2], [0.2, 0.5]], theta: 0 },
    'stationarity-c': { slice: [[1, 0], [0, -0.5]], theta: 0 }
  });
  const FIXED_DOSSIERS = Object.freeze({
    'fixed-a': { initial: 0, parameters: { delta: 1, interaction: 0.2, coupling: 0.3 }, iterations: 80, oldWeight: 0 },
    'fixed-b': { initial: 0.4, parameters: { delta: 0, interaction: 1.2, coupling: 0.2 }, iterations: 12, oldWeight: 0 }
  });
  const PATHOLOGY_DOSSIERS = Object.freeze({
    'pathology-a': { energy: [-1, -1.1, -1.10000000001], densityResidual: [0.2, 1e-4, 1e-9], density: [0.2, 0.3, 0.300000001] },
    'pathology-b': { energy: [-1, -1.000000000001, -1.000000000002], densityResidual: [0.3, 0.28, 0.27], density: [0.5, -0.5, 0.5] },
    'pathology-c': { energy: [-1, -0.9, -1, -0.9, -1], densityResidual: [0.4, 0.4, 0.4, 0.4, 0.4], density: [0.6, -0.6, 0.6, -0.6, 0.6] },
    'pathology-d': { energy: [-1, -0.8, -0.4, 0.5], densityResidual: [0.1, 0.2, 0.5, 1.1], density: [0.1, 0.3, 0.7, 1.5] }
  });
  const STABILIZATION_DOSSIERS = Object.freeze({
    'stabilize-a': { log: PATHOLOGY_DOSSIERS['pathology-c'], virtualGap: 0.4, dampingWeight: 0.75 },
    'stabilize-b': { log: { energy: [-1, -1.01, -1.015], densityResidual: [0.3, 0.25, 0.22], density: [0.1, 0.2, 0.25] }, virtualGap: 0.03, fock: [[-1, 0], [0, -0.97]], occupiedProjector: [[1, 0], [0, 0]], shift: 0.5 },
    'stabilize-c': { log: PATHOLOGY_DOSSIERS['pathology-a'], virtualGap: 0.5 }
  });
  const DIIS_DOSSIERS = Object.freeze({
    'diis-a': { residuals: [[1, 0], [0, 2]] },
    'diis-b': { residuals: [[1, 0], [1, 0]] }
  });
  const REFERENCE_DOSSIERS = Object.freeze({
    'reference-a': { nAlpha: 2, nBeta: 2, requireCommonOrbitals: true, requireSpinPurity: true, brokenSymmetryTarget: false, overlap: [[1, 0], [0, 1]] },
    'reference-b': { nAlpha: 3, nBeta: 2, requireCommonOrbitals: true, requireSpinPurity: true, brokenSymmetryTarget: false, overlap: [[1, 0], [0, 1], [0, 0]] },
    'reference-c': { nAlpha: 1, nBeta: 1, requireCommonOrbitals: false, requireSpinPurity: false, brokenSymmetryTarget: true, overlap: [[0.65]] }
  });

  const HF_CASE_FILES = Object.freeze({
    'hf-boss-a': { reference: REFERENCE_DOSSIERS['reference-a'], log: PATHOLOGY_DOSSIERS['pathology-b'] },
    'hf-boss-b': { reference: REFERENCE_DOSSIERS['reference-c'], log: PATHOLOGY_DOSSIERS['pathology-a'] },
    'hf-boss-c': { reference: REFERENCE_DOSSIERS['reference-b'], log: PATHOLOGY_DOSSIERS['pathology-c'] }
  });

  function verdict(classification, choice, extra = {}) { return { ...extra, valid: classification !== null, correct: classification !== null && choice === classification }; }
  function evaluateVariationMission(id, choice) {
    const dossier = VARIATION_DOSSIERS[id];
    if (!dossier) return { valid: false, correct: false };
    const result = classifyStationarity(dossier.slice, dossier.theta);
    return verdict(result.kind, choice, { stationary: result.stationary, derivative: result.derivative, curvature: result.curvature });
  }
  function evaluateCoulombMission(id, choice) {
    const dossier = COULOMB_DOSSIERS[id];
    if (!dossier) return { valid: false, correct: false };
    const pair = coulombExchange(dossier.j, dossier.k, dossier.sameSpin);
    const classification = dossier.sameSpin ? (Math.abs(pair.total) <= EPS ? 'self-cancelled' : 'same-spin-j-minus-k') : 'opposite-spin-j-only';
    return verdict(classification, choice, { total: pair.total, exchange: pair.exchange });
  }
  function evaluateFockMission(id, choice) {
    const dossier = FOCK_DOSSIERS[id];
    if (!dossier) return { valid: false, correct: false };
    const fock = buildFock(dossier.h, dossier.density, dossier.integrals);
    const residual = symmetryResidual(fock);
    const integralResidual = antisymmetrizedIntegralResidual(dossier.integrals);
    const accepted = residual <= 1e-10 && integralResidual <= 1e-10;
    return verdict(accepted ? 'hermitian-density-dependent' : 'reject-nonhermitian-build', choice, { fock, symmetryResidual: residual, integralResidual });
  }
  function evaluateRoothaanMission(id, choice) {
    const dossier = ROOTHAAN_DOSSIERS[id];
    if (!dossier) return { valid: false, correct: false };
    const result = generalizedEigen2(dossier.fock, dossier.overlap);
    const certified = result.valid && Math.max(...result.residuals) <= 1e-8 && result.metricResidual <= 1e-8;
    return verdict(certified ? 'solve-generalized' : 'reject-overlap-metric', choice, result.valid ? { values: result.values, residuals: result.residuals, metricResidual: result.metricResidual } : { reason: result.reason });
  }
  function evaluateDensityMission(id, choice) {
    const dossier = DENSITY_DOSSIERS[id];
    if (!dossier) return { valid: false, correct: false };
    const result = auditDensity(dossier.density, dossier.overlap, dossier.occupied);
    const classification = result.valid && result.traceCorrect && result.idempotent && result.hermitian ? 'projector-closed' : 'not-a-determinant-projector';
    return verdict(classification, choice, result);
  }
  function evaluateStationarityMission(id, choice) {
    const dossier = STATIONARITY_DOSSIERS[id];
    if (!dossier) return { valid: false, correct: false };
    const result = classifyStationarity(dossier.slice, dossier.theta);
    const classification = !result.stationary ? 'occupied-virtual-gradient' : (result.kind === 'local-maximum-slice' ? 'unstable-stationary-slice' : 'stationary-slice');
    return verdict(classification, choice, result);
  }
  function evaluateFixedPointMission(id, choice) {
    const dossier = FIXED_DOSSIERS[id];
    if (!dossier) return { valid: false, correct: false };
    const history = iterateTwoLevelScf(dossier.initial, dossier.parameters, dossier.iterations, dossier.oldWeight);
    const converged = history.at(-1).residual <= 1e-8;
    return verdict(converged ? 'self-consistent-fixed-point' : 'not-self-consistent', choice, { history, residual: history.at(-1).residual });
  }
  function evaluatePathologyMission(id, choice) {
    const dossier = PATHOLOGY_DOSSIERS[id];
    if (!dossier) return { valid: false, correct: false };
    const result = classifyScfLog(dossier);
    return verdict(result.kind, choice, result);
  }
  function stabilizationClass(dossier) {
    const diagnosis = classifyScfLog(dossier.log).kind;
    if (diagnosis === 'converged') return 'no-intervention';
    if (diagnosis === 'oscillatory') return 'density-damping';
    if (dossier.virtualGap < 0.08) return 'virtual-level-shift';
    return 'rebuild-or-change-guess';
  }
  function stabilizationEvidence(dossier) {
    const strategy = stabilizationClass(dossier);
    if (strategy === 'density-damping') {
      const raw = dossier.log.density.slice();
      const mixed = [];
      raw.forEach((value, index) => mixed.push(index ? dampValue(mixed[index - 1], value, dossier.dampingWeight) : value));
      const maxStep = series => Math.max(0, ...series.slice(1).map((value, index) => Math.abs(value - series[index])));
      return { strategy, raw, mixed, beforeStep: maxStep(raw), afterStep: maxStep(mixed), dampingWeight: dossier.dampingWeight };
    }
    if (strategy === 'virtual-level-shift') {
      const shifted = levelShiftFock(dossier.fock, dossier.occupiedProjector, dossier.shift);
      return { strategy, beforeGap: dossier.fock[1][1] - dossier.fock[0][0], afterGap: shifted[1][1] - shifted[0][0], shift: dossier.shift };
    }
    const last = dossier.log.energy.length - 1;
    return { strategy, finalResidual: Math.abs(dossier.log.densityResidual[last]), finalDeltaEnergy: Math.abs(dossier.log.energy[last] - dossier.log.energy[last - 1]) };
  }
  function evaluateStabilizationMission(id, choice) {
    const dossier = STABILIZATION_DOSSIERS[id];
    if (!dossier) return { valid: false, correct: false };
    const evidence = stabilizationEvidence(dossier);
    return verdict(evidence.strategy, choice, { ...evidence, diagnosis: classifyScfLog(dossier.log).kind, virtualGap: dossier.virtualGap });
  }
  function evaluateDiisMission(id, choice) {
    const dossier = DIIS_DOSSIERS[id];
    if (!dossier) return { valid: false, correct: false };
    const result = diisCoefficients(dossier.residuals);
    return verdict(result.valid ? 'usable-residual-subspace' : 'singular-residual-history', choice, result);
  }
  function referenceConstraintLabel(dossier) {
    if (dossier.brokenSymmetryTarget) return 'Target constraint: alpha/beta orbital relaxation is allowed to test a broken-symmetry solution.';
    if (dossier.nAlpha === dossier.nBeta && dossier.requireCommonOrbitals && dossier.requireSpinPurity) return 'Target constraint: paired closed shell with common spatial orbitals and spin purity required.';
    if (dossier.requireCommonOrbitals && dossier.requireSpinPurity) return 'Target constraint: spin-pure open shell with common closed-shell spatial orbitals required.';
    return 'Target constraint: alpha/beta orbital relaxation is allowed.';
  }
  function referenceClass(dossier) {
    if (dossier.brokenSymmetryTarget || !dossier.requireCommonOrbitals) return 'uhf-reference';
    if (dossier.nAlpha === dossier.nBeta) return 'rhf-reference';
    if (dossier.requireSpinPurity) return 'rohf-reference';
    return 'uhf-reference';
  }
  function evaluateReferenceMission(id, choice) {
    const dossier = REFERENCE_DOSSIERS[id];
    if (!dossier) return { valid: false, correct: false };
    const spin = uhfSpinS2(dossier.nAlpha, dossier.nBeta, dossier.overlap);
    return verdict(referenceClass(dossier), choice, { s2: spin.s2, target: spin.target, contamination: spin.contamination });
  }
  function bossChoice(id, stage) {
    const file = HF_CASE_FILES[id];
    if (!file || !Number.isInteger(stage) || stage < 0 || stage > 2) return null;
    if (stage === 0) return referenceClass(file.reference);
    if (stage === 1) {
      const spin = uhfSpinS2(file.reference.nAlpha, file.reference.nBeta, file.reference.overlap);
      if (spin.valid && spin.contamination > 0.1) return 'spin-contamination';
      const diagnosis = classifyScfLog(file.log).kind;
      if (diagnosis === 'oscillatory') return 'two-cycle';
      return 'density-residual';
    }
    const diagnostic = bossChoice(id, 1);
    if (diagnostic === 'density-residual') return 'energy-density-residual';
    if (diagnostic === 'spin-contamination') return 's2-and-stability-scan';
    if (diagnostic === 'two-cycle') return 'residual-history-and-intervention-scan';
    return null;
  }
  function evaluateHfCase(id, stage, choice) {
    const classification = bossChoice(id, stage);
    return classification === null ? { valid: false, correct: false } : verdict(classification, choice, { stage });
  }

  const publicModels = Object.freeze({
    symmetricEigen2, generalizedEigen2, densityProjector, auditDensity, coulombExchange, antisymmetrizedIntegralResidual, buildFock,
    hfEnergy, commutatorResidual, rotationSlice, classifyStationarity, twoLevelScfOutput,
    iterateTwoLevelScf, classifyScfLog, dampValue, levelShiftFock, diisCoefficients, diisMix, uhfSpinS2
  });
  const testModels = Object.freeze({
    ...publicModels, evaluateVariationMission, evaluateCoulombMission, evaluateFockMission,
    evaluateRoothaanMission, evaluateDensityMission, evaluateStationarityMission,
    evaluateFixedPointMission, evaluatePathologyMission, evaluateStabilizationMission,
    evaluateDiisMission, evaluateReferenceMission, evaluateHfCase
  });

  if (typeof window === 'object' && window) window.QCHartreeFockModels = publicModels;
  if (typeof module === 'object' && module && module.exports) module.exports = testModels;

  if (typeof document === 'undefined' || !document.getElementById) return;

  const GAME_STORAGE_KEY = 'project-xc-hartree-fock-games-v1';
  const CHAPTER_ID = 'qc-hartree-fock';
  const MISSION_IDS = Object.freeze([
    'hf-variational-manifold', 'coulomb-exchange', 'fock-assembly', 'roothaan-hall',
    'density-projector', 'orbital-stationarity', 'scf-fixed-point', 'scf-pathology',
    'scf-stabilization', 'diis', 'reference-spin', 'hf-case-file'
  ]);
  const CASE_IDS = Object.freeze({
    variation: Object.freeze(Object.keys(VARIATION_DOSSIERS)), coulomb: Object.freeze(Object.keys(COULOMB_DOSSIERS)),
    fock: Object.freeze(Object.keys(FOCK_DOSSIERS)), roothaan: Object.freeze(Object.keys(ROOTHAAN_DOSSIERS)),
    density: Object.freeze(Object.keys(DENSITY_DOSSIERS)), stationarity: Object.freeze(Object.keys(STATIONARITY_DOSSIERS)),
    fixed: Object.freeze(Object.keys(FIXED_DOSSIERS)), pathology: Object.freeze(Object.keys(PATHOLOGY_DOSSIERS)),
    stabilization: Object.freeze(Object.keys(STABILIZATION_DOSSIERS)), diis: Object.freeze(Object.keys(DIIS_DOSSIERS)),
    reference: Object.freeze(Object.keys(REFERENCE_DOSSIERS)), boss: Object.freeze(Object.keys(HF_CASE_FILES))
  });
  const DOSSIER_TABLES = Object.freeze({
    variation: VARIATION_DOSSIERS, coulomb: COULOMB_DOSSIERS, fock: FOCK_DOSSIERS,
    roothaan: ROOTHAAN_DOSSIERS, density: DENSITY_DOSSIERS, stationarity: STATIONARITY_DOSSIERS,
    fixed: FIXED_DOSSIERS, pathology: PATHOLOGY_DOSSIERS, stabilization: STABILIZATION_DOSSIERS,
    diis: DIIS_DOSSIERS, reference: REFERENCE_DOSSIERS, boss: HF_CASE_FILES
  });
  function dossierFingerprint(bucket, caseId) {
    const dossier = DOSSIER_TABLES[bucket]?.[caseId];
    if (!dossier) return '';
    let hash = 2166136261;
    for (const character of JSON.stringify(dossier)) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(36);
  }
  const MISSION_CASE_MAP = Object.freeze({
    variation: 'hf-variational-manifold', coulomb: 'coulomb-exchange', fock: 'fock-assembly',
    roothaan: 'roothaan-hall', density: 'density-projector', stationarity: 'orbital-stationarity',
    fixed: 'scf-fixed-point', pathology: 'scf-pathology', stabilization: 'scf-stabilization',
    diis: 'diis', reference: 'reference-spin'
  });
  const SCORE_LABELS = Object.freeze({
    variation: ['variationStage', 'Dossiers'], coulomb: ['coulombStage', 'Pairs'], fock: ['fockStage', 'Builds'],
    roothaan: ['roothaanStage', 'Metrics'], density: ['densityStage', 'Densities'], stationarity: ['stationarityStage', 'Gates'],
    fixed: ['fixedStage', 'Runs'], pathology: ['pathologyStage', 'Logs'], stabilization: ['stabilizationStage', 'Recoveries'],
    diis: ['diisStage', 'Subspaces'], reference: ['referenceStage', 'References']
  });
  const NOTEBOOK_ENTRIES = Object.freeze({
    'hf-variational-manifold': ['Occupied–virtual orbital rotation', 'All other determinant and basis directions', 'dE/dθ and local curvature', 'Stationarity on the supplied slice; global/stability claim survives'],
    'coulomb-exchange': ['J/K pair construction', 'Correlation beyond one determinant', 'Spin relation and J−K cancellation', 'Signed pair ledger; exchange is same-spin only'],
    'fock-assembly': ['F[D]=h+G[D]', 'Post-HF correlation and complete-basis effects', 'Hermiticity and density dependence', 'Rebuild F after D changes'],
    'roothaan-hall': ['FC=SCε', 'AO linear-dependence remediation details', 'S positive-definiteness and residuals', 'CᵀSC=I for every retained root'],
    'density-projector': ['D=CoccCoccᵀ', 'Ensemble/fractional-occupation models', 'Tr(DS) and DSD−D', 'Spin-summed RHF convention checked separately'],
    'orbital-stationarity': ['Occupied–virtual stationarity audit', 'Full orbital-stability Hessian and correlation', 'Fov / first derivative plus curvature slice', 'Stationary is not automatically stable or globally lowest'],
    'scf-fixed-point': ['Nonlinear density update', 'Real molecular integral evaluation', '|xout−xin| fixed-point residual', 'Pedagogical two-level map only'],
    'scf-pathology': ['Energy+density convergence triage', 'Universal thresholds and physical state identity', 'Residual history and cycle pattern', 'A flat energy alone is insufficient'],
    'scf-stabilization': ['Damping/temporary level shift', 'Guarantee of desired stationary state', 'Update-step contraction or orthonormal gap change', 'A fresh residual-checked rerun and state-character checks remain'],
    diis: ['Constrained residual extrapolation', 'Variational energy guarantee', 'Pulay-system rank and mixed residual', 'Prune singular histories and verify the final fixed point'],
    'reference-spin': ['RHF/ROHF/UHF reference audit', 'Correlation and universal reference ranking', 'Nα/Nβ, orbital constraints, and ⟨S²⟩', 'Interpret broken symmetry with stability and state character'],
    'hf-case-file': ['Reference → diagnostic → evidence chain', 'Correlation/global stability/basis completeness', 'Cross-checked fixed dossier artifacts', 'Converged HF remains one finite-basis stationary determinant']
  });

  function makeGameState() {
    const state = { cleared: new Set(), revealed: {}, transcripts: {}, boss: { cleared: new Set(), stage: {}, budget: {}, answers: {} } };
    for (const bucket of Object.keys(MISSION_CASE_MAP)) {
      state[bucket] = new Set();
      state.revealed[bucket] = new Set();
      state.transcripts[bucket] = {};
    }
    return state;
  }
  const game = makeGameState();
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const finite = value => Number.isFinite(value) ? value : 0;
  function setHidden(id, hidden) { const node = $(id); if (node) node.hidden = hidden; }
  function setResult(id, state, html) { const node = $(id); if (!node) return; node.dataset.state = state; node.innerHTML = html; }
  function list(value) { return Array.isArray(value) ? value : []; }
  function validChoice(value) { return typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(value); }
  function deriveCleared() {
    game.cleared.clear();
    for (const [bucket, missionId] of Object.entries(MISSION_CASE_MAP)) {
      if (CASE_IDS[bucket].every(id => game[bucket].has(id))) game.cleared.add(missionId);
    }
    const prerequisites = MISSION_IDS.slice(0, 11).every(id => game.cleared.has(id));
    if (prerequisites && CASE_IDS.boss.every(id => game.boss.cleared.has(id))) game.cleared.add('hf-case-file');
  }
  function validateBossRecord(caseId, stage, answers) {
    if (!Number.isInteger(stage) || stage < 0 || stage > 2 || !Array.isArray(answers) || answers.length !== stage) return false;
    return answers.every((answer, index) => validChoice(answer) && evaluateHfCase(caseId, index, answer).correct);
  }
  function validateCaseTranscript(bucket, record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
    const { id, choice, fingerprint } = record;
    return CASE_IDS[bucket].includes(id) && validChoice(choice) && fingerprint === dossierFingerprint(bucket, id) && CONFIGS[bucket].evaluator(id, choice).correct;
  }
  function restoreGameState() {
    let saved = null;
    try { saved = JSON.parse(window.localStorage.getItem(GAME_STORAGE_KEY) || 'null'); } catch (_error) { saved = null; }
    if (!saved || typeof saved !== 'object' || Array.isArray(saved) || saved.version !== 2) { deriveCleared(); return; }
    for (const bucket of Object.keys(MISSION_CASE_MAP)) {
      for (const record of list(saved[bucket])) {
        if (!validateCaseTranscript(bucket, record)) continue;
        game[bucket].add(record.id);
        game.transcripts[bucket][record.id] = { choice: record.choice, fingerprint: record.fingerprint };
      }
      for (const id of list(saved.revealed?.[bucket])) if (CASE_IDS[bucket].includes(id)) game.revealed[bucket].add(id);
      for (const id of game[bucket]) game.revealed[bucket].add(id);
    }
    deriveCleared();
    const prerequisites = MISSION_IDS.slice(0, 11).every(id => game.cleared.has(id));
    if (!prerequisites) return;
    const savedBoss = saved.boss && typeof saved.boss === 'object' && !Array.isArray(saved.boss) ? saved.boss : {};
    for (const caseId of CASE_IDS.boss) {
      if (savedBoss.fingerprints?.[caseId] !== dossierFingerprint('boss', caseId)) continue;
      const markedCleared = list(savedBoss.cleared).includes(caseId);
      const answers = list(savedBoss.answers?.[caseId]).filter(validChoice);
      if (markedCleared && answers.length === 3 && answers.every((answer, stage) => evaluateHfCase(caseId, stage, answer).correct)) {
        game.boss.cleared.add(caseId);
        game.boss.answers[caseId] = answers.slice(0, 3);
        game.boss.budget[caseId] = 4;
        continue;
      }
      const stage = savedBoss.stage?.[caseId];
      if (validateBossRecord(caseId, stage, answers)) {
        game.boss.stage[caseId] = stage;
        game.boss.answers[caseId] = answers.slice();
        const budget = savedBoss.budget?.[caseId];
        game.boss.budget[caseId] = Number.isInteger(budget) && budget >= 1 && budget <= 4 ? budget : 4;
      }
    }
    deriveCleared();
  }
  function saveGameState() {
    const fingerprints = Object.fromEntries(CASE_IDS.boss.map(caseId => [caseId, dossierFingerprint('boss', caseId)]));
    const state = { version: 2, revealed: {}, boss: { cleared: [...game.boss.cleared], stage: { ...game.boss.stage }, budget: { ...game.boss.budget }, answers: { ...game.boss.answers }, fingerprints } };
    for (const bucket of Object.keys(MISSION_CASE_MAP)) {
      state[bucket] = [...game[bucket]].map(id => ({ id, ...game.transcripts[bucket][id] }));
      state.revealed[bucket] = [...game.revealed[bucket]];
    }
    try { window.localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(state)); } catch (_error) { /* blocked storage remains session-local */ }
  }
  function recordCase(bucket, caseId, choice) {
    game[bucket].add(caseId);
    game.transcripts[bucket][caseId] = { choice, fingerprint: dossierFingerprint(bucket, caseId) };
    game.revealed[bucket].add(caseId);
    deriveCleared();
    saveGameState();
    renderGameProgress();
    syncBoss();
  }

  function renderNotebook() {
    const node = $('hfNotebookList');
    if (!node) return;
    const entries = MISSION_IDS.filter(id => game.cleared.has(id));
    if (!entries.length) { node.innerHTML = '<p class="help-text">No HF/SCF evidence recorded yet.</p>'; return; }
    node.innerHTML = entries.map(id => {
      const [operation, omitted, diagnostic, evidence] = NOTEBOOK_ENTRIES[id];
      return `<article><strong>${esc(id.replaceAll('-', ' '))}</strong><span>${esc(operation)}</span><span>${esc(omitted)}</span><span>${esc(diagnostic)}</span><span>${esc(evidence)}</span></article>`;
    }).join('');
  }
  let reconcilingCanonical = false;
  function rejectUnsupportedCanonicalProgress() {
    const academy = window.ProjectXCAcademy;
    if (!academy || reconcilingCanonical) return;
    const unsupported = academy.completedMissions(CHAPTER_ID).filter(id => MISSION_IDS.includes(id) && !game.cleared.has(id));
    if (!unsupported.length) return;
    reconcilingCanonical = true;
    try { unsupported.forEach(id => academy.setMission(CHAPTER_ID, id, false, MISSION_IDS)); }
    finally { reconcilingCanonical = false; }
  }
  function renderGameProgress() {
    rejectUnsupportedCanonicalProgress();
    document.querySelectorAll('.academy-complete[data-game-gate]').forEach(button => {
      const earned = game.cleared.has(button.dataset.mission);
      button.dataset.defaultGameLabel ||= `Complete mission · ${button.dataset.badge || button.dataset.mission}`;
      button.disabled = !earned;
      button.dataset.gameGate = earned ? 'earned' : 'locked';
      button.textContent = earned ? button.dataset.defaultGameLabel.replace('Complete mission', 'Record earned seal') : button.dataset.defaultGameLabel.replace('Complete mission', 'Locked seal');
      button.title = earned ? 'Laboratory evidence earned; activate to record or remove this Academy mission.' : 'Clear this decision laboratory to unlock its seal.';
    });
    for (const [bucket, [id, label]] of Object.entries(SCORE_LABELS)) if ($(id)) $(id).textContent = `${label} cleared: ${game[bucket].size} / ${CASE_IDS[bucket].length}`;
    const prerequisites = MISSION_IDS.slice(0, 11).filter(id => game.cleared.has(id)).length;
    if ($('hfBossScore')) $('hfBossScore').textContent = `Cases: ${game.boss.cleared.size} / 3 · prerequisites: ${prerequisites} / 11`;
    renderNotebook();
  }

  let svgSerial = 0;
  function svg(body, label, height = 270) {
    const serial = ++svgSerial;
    return `<svg viewBox="0 0 680 ${height}" role="img" aria-label="${esc(label)}"><defs><pattern id="hf-hatch-${serial}" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#fff7ed"></rect><line x1="0" y1="0" x2="0" y2="10" stroke="#ea580c" stroke-width="3"></line></pattern><marker id="hf-arrow-${serial}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#4338ca"></path></marker></defs><rect width="680" height="${height}" rx="18" fill="#fbfdff"></rect>${body.replaceAll('url(#hf-hatch)', `url(#hf-hatch-${serial})`).replaceAll('url(#hf-arrow)', `url(#hf-arrow-${serial})`)}</svg>`;
  }
  function matrixMarkup(matrix, x, y, title, masked = false) {
    const rows = matrix.map((row, i) => row.map((value, j) => `<text x="${x + 48 + j * 74}" y="${y + 56 + i * 38}" text-anchor="middle" class="hf-matrix-value">${masked ? '?' : finite(value).toFixed(3)}</text>`).join('')).join('');
    return `<text x="${x + 84}" y="${y + 18}" text-anchor="middle" class="hf-plot-title">${esc(title)}</text><path class="hf-bracket" d="M${x + 22},${y + 30} h-10 v82 h10 M${x + 146},${y + 30} h10 v82 h-10"></path>${rows}`;
  }
  function linePath(values, x0, x1, y0, y1, minValue = null, maxValue = null) {
    const lo = minValue ?? Math.min(...values);
    const hi = maxValue ?? Math.max(...values);
    const span = Math.max(1e-12, hi - lo);
    return values.map((value, i) => `${i ? 'L' : 'M'}${x0 + (x1 - x0) * i / Math.max(1, values.length - 1)},${y1 - (y1 - y0) * (value - lo) / span}`).join(' ');
  }
  function setPlot(id, html) { const node = $(id); if (node) node.innerHTML = html; }

  function renderVariation() {
    const id = $('variationCase')?.value || 'variation-a';
    const item = VARIATION_DOSSIERS[id];
    const result = classifyStationarity(item.slice, item.theta);
    const revealed = game.revealed.variation.has(id) || game.variation.has(id);
    const angles = Array.from({ length: 65 }, (_, i) => -Math.PI / 2 + Math.PI * i / 64);
    const energies = angles.map(angle => rotationSlice(item.slice, angle).energy);
    const lo = Math.min(...energies); const hi = Math.max(...energies); const y = value => 210 - 145 * (value - lo) / Math.max(1e-9, hi - lo);
    const path = energies.map((value, i) => `${i ? 'L' : 'M'}${60 + i * 560 / 64},${y(value)}`).join(' ');
    const oracle = revealed ? `<text x="340" y="34" text-anchor="middle" class="hf-plot-oracle">dE/dθ = ${result.derivative.toFixed(3)} · d²E/dθ² = ${result.curvature.toFixed(3)}</text>` : '';
    setPlot('variationPlot', svg(`<line class="hf-axis" x1="60" x2="620" y1="220" y2="220"></line><line class="hf-axis" x1="340" x2="340" y1="52" y2="226"></line><path class="hf-curve indigo" d="${path}"></path><circle class="hf-point coral" cx="340" cy="${y(result.energy)}" r="10"></circle><text x="60" y="246">−π/2</text><text x="340" y="246" text-anchor="middle">θ = 0</text><text x="620" y="246" text-anchor="end">+π/2</text>${oracle}`, 'finite occupied-virtual orbital rotation energy'));
    setHidden('variationOracleKey', !revealed);
  }
  function renderCoulomb() {
    const id = $('coulombCase')?.value || 'coulomb-a'; const item = COULOMB_DOSSIERS[id]; const result = coulombExchange(item.j, item.k, item.sameSpin); const revealed = game.revealed.coulomb.has(id) || game.coulomb.has(id);
    const scale = 140; const jHeight = item.j * scale; const kHeight = item.k * scale;
    setPlot('coulombPlot', svg(`<line class="hf-axis" x1="70" x2="610" y1="210" y2="210"></line><rect class="hf-bar amber" x="145" y="${210 - jHeight}" width="110" height="${jHeight}"></rect><rect x="285" y="${210 - kHeight}" width="110" height="${kHeight}" fill="${item.sameSpin ? 'url(#hf-hatch)' : '#e5e7eb'}"></rect><text x="200" y="232" text-anchor="middle">J = ${item.j.toFixed(2)}</text><text x="340" y="232" text-anchor="middle">${item.sameSpin ? '−K' : 'K excluded'} = ${item.k.toFixed(2)}</text><text x="520" y="88" text-anchor="middle">spin relation</text><text x="520" y="116" text-anchor="middle" class="hf-plot-title">${item.sameSpin ? 'same spin' : 'opposite spin'}</text>${revealed ? `<text x="520" y="172" text-anchor="middle" class="hf-plot-oracle">pair total = ${result.total.toFixed(3)}</text>` : ''}`, 'Coulomb and exchange pair ledger'));
    setHidden('coulombOracleKey', !revealed);
  }
  function renderFock() {
    const id = $('fockCase')?.value || 'fock-a';
    const item = FOCK_DOSSIERS[id];
    const fock = buildFock(item.h, item.density, item.integrals);
    const meanField = matAdd(fock, item.h, -1);
    const revealed = game.revealed.fock.has(id) || game.fock.has(id);
    const residual = symmetryResidual(fock);
    const integralResidual = antisymmetrizedIntegralResidual(item.integrals);
    const certificate = revealed ? `||F−Fᵀ||max=${residual.toExponential(1)} · ERI symmetry=${integralResidual.toExponential(1)}` : 'Commit to reveal the Fock and integral-symmetry certificate';
    setPlot('fockPlot', svg(`<text x="340" y="30" text-anchor="middle" class="hf-muted">${esc(item.integralLabel)}</text>${matrixMarkup(item.h, 0, 55, 'h')}${matrixMarkup(item.density, 170, 55, 'Dˢᵒ')}${matrixMarkup(meanField, 340, 55, 'G[Dˢᵒ]')}${matrixMarkup(fock, 510, 55, 'F', !revealed)}<text x="340" y="228" text-anchor="middle" class="${revealed ? 'hf-plot-oracle' : 'hf-muted'}">${certificate}</text>`, 'core, full spin-orbital density, mean-field, and Fock matrices'));
    setHidden('fockOracleKey', !revealed);
  }
  function renderRoothaan() {
    const id = $('roothaanCase')?.value || 'roothaan-a'; const item = ROOTHAAN_DOSSIERS[id]; const result = generalizedEigen2(item.fock, item.overlap); const revealed = game.revealed.roothaan.has(id) || game.roothaan.has(id);
    const rejection = result.reason === 'overlap-not-positive-definite' ? 'overlap metric is singular or non-positive' : result.reason;
    const certificate = revealed ? (result.valid ? `max ||Fc−εSc||=${Math.max(...result.residuals).toExponential(1)} · ||CᵀSC−I||F=${result.metricResidual.toExponential(1)}` : `Rejected: ${rejection}`) : 'Commit to inspect the AO metric and residuals';
    setPlot('roothaanPlot', svg(`${matrixMarkup(item.fock, 90, 58, 'F')}${matrixMarkup(item.overlap, 430, 58, 'S')}<path class="hf-arrow" marker-end="url(#hf-arrow)" d="M270,115 H400"></path><text x="340" y="38" text-anchor="middle" class="hf-plot-title">F C = S C ε</text><text x="340" y="226" text-anchor="middle" class="${revealed ? 'hf-plot-oracle' : 'hf-muted'}">${esc(certificate)}</text>`, 'Roothaan-Hall generalized eigenproblem'));
    setHidden('roothaanOracleKey', !revealed);
  }
  function renderDensity() {
    const id = $('densityCase')?.value || 'density-a'; const item = DENSITY_DOSSIERS[id]; const audit = auditDensity(item.density, item.overlap, item.occupied); const closure = matMul(item.density, matMul(item.overlap, item.density)); const revealed = game.revealed.density.has(id) || game.density.has(id);
    setPlot('densityPlot', svg(`${matrixMarkup(item.density, 85, 56, 'D')}${matrixMarkup(closure, 425, 56, 'D S D', !revealed)}<path class="hf-arrow" marker-end="url(#hf-arrow)" d="M265,115 H395"></path><text x="340" y="226" text-anchor="middle" class="${revealed ? 'hf-plot-oracle' : 'hf-muted'}">${revealed ? `Tr(DS) = ${audit.electrons.toFixed(3)} · ||DSD−D|| = ${audit.closureResidual.toExponential(2)}` : 'Commit to reveal the metric-closure certificate'}</text>`, 'density projector in a nonorthogonal metric'));
    setHidden('densityOracleKey', !revealed);
  }
  function renderStationarity() {
    const id = $('stationarityCase')?.value || 'stationarity-a'; const item = STATIONARITY_DOSSIERS[id]; const result = classifyStationarity(item.slice, item.theta); const revealed = game.revealed.stationarity.has(id) || game.stationarity.has(id);
    setPlot('stationarityPlot', svg(`${matrixMarkup(item.slice, 255, 58, 'orbital-rotation slice')}<text x="110" y="92" class="hf-plot-title">occupied</text><text x="525" y="92" class="hf-plot-title">virtual</text><path class="hf-arrow" marker-end="url(#hf-arrow)" d="M150,115 H235"></path><path class="hf-arrow" marker-end="url(#hf-arrow)" d="M445,115 H510"></path><text x="340" y="228" text-anchor="middle" class="${revealed ? 'hf-plot-oracle' : 'hf-muted'}">${revealed ? `occupied–virtual derivative = ${result.derivative.toFixed(3)} · curvature = ${result.curvature.toFixed(3)}` : 'Commit to reveal the stationarity certificate'}</text>`, 'occupied-virtual orbital stationarity block'));
    setHidden('stationarityOracleKey', !revealed);
  }
  function renderFixed() {
    const id = $('fixedCase')?.value || 'fixed-a'; const item = FIXED_DOSSIERS[id]; const history = iterateTwoLevelScf(item.initial, item.parameters, item.iterations, item.oldWeight); const displayed = history.length > 24 ? history.filter((_, i) => i % Math.ceil(history.length / 24) === 0 || i === history.length - 1) : history; const inputs = displayed.map(entry => entry.input); const outputs = displayed.map(entry => entry.rawOutput); const revealed = game.revealed.fixed.has(id) || game.fixed.has(id);
    setPlot('fixedPlot', svg(`<line class="hf-axis" x1="58" x2="622" y1="130" y2="130"></line><path class="hf-curve indigo" d="${linePath(inputs, 60, 620, 50, 215, -1, 1)}"></path><path class="hf-curve coral dashed" d="${linePath(outputs, 60, 620, 50, 215, -1, 1)}"></path><text x="60" y="240">cycle 1</text><text x="620" y="240" text-anchor="end">cycle ${history.length}</text><text x="340" y="32" text-anchor="middle" class="${revealed ? 'hf-plot-oracle' : 'hf-muted'}">${revealed ? `final |xout−xin| = ${history.at(-1).residual.toExponential(3)}` : 'Input and raw-output paths; residual certificate sealed'}</text>`, 'two-level nonlinear SCF fixed-point history'));
    setHidden('fixedOracleKey', !revealed);
  }
  function renderPathology() {
    const id = $('pathologyCase')?.value || 'pathology-a'; const item = PATHOLOGY_DOSSIERS[id]; const result = classifyScfLog(item); const revealed = game.revealed.pathology.has(id) || game.pathology.has(id); const deltaEnergy = item.energy.map((value, i) => i ? Math.abs(value - item.energy[i - 1]) : 0); const combined = [...deltaEnergy, ...item.densityResidual.map(Math.abs)]; const max = Math.max(...combined, 1e-12);
    setPlot('pathologyPlot', svg(`<line class="hf-axis" x1="58" x2="622" y1="218" y2="218"></line><path class="hf-curve indigo" d="${linePath(deltaEnergy, 60, 620, 55, 210, 0, max)}"></path><path class="hf-curve coral dashed" d="${linePath(item.densityResidual.map(Math.abs), 60, 620, 55, 210, 0, max)}"></path><text x="60" y="240">first record</text><text x="620" y="240" text-anchor="end">last record</text><text x="340" y="32" text-anchor="middle" class="${revealed ? 'hf-plot-oracle' : 'hf-muted'}">${revealed ? `diagnosis: ${esc(result.kind.replaceAll('-', ' '))}` : 'Commit to reveal the convergence diagnosis'}</text>`, 'SCF energy-change and density-residual history'));
    setHidden('pathologyOracleKey', !revealed);
  }
  function renderStabilization() {
    const id = $('stabilizationCase')?.value || 'stabilize-a';
    const item = STABILIZATION_DOSSIERS[id];
    const evidence = stabilizationEvidence(item);
    const revealed = game.revealed.stabilization.has(id) || game.stabilization.has(id);
    const raw = item.log.density;
    const minimum = Math.min(-1, ...raw);
    const maximum = Math.max(1, ...raw);
    const traceEnd = revealed && evidence.strategy === 'virtual-level-shift' ? 390 : 620;
    let interventionMarkup = '';
    let certificate = 'Raw pathology and declared gap supplied';
    if (revealed && evidence.strategy === 'density-damping') {
      interventionMarkup = `<path class="hf-curve indigo" d="${linePath(evidence.mixed, 60, traceEnd, 55, 210, minimum, maximum)}"></path>`;
      certificate = `old-w ${evidence.dampingWeight.toFixed(2)}: max step ${evidence.beforeStep.toFixed(2)}→${evidence.afterStep.toFixed(2)}; rerun residual`;
    } else if (revealed && evidence.strategy === 'virtual-level-shift') {
      const gapScale = 130 / Math.max(evidence.afterGap, evidence.beforeGap, 1e-6);
      const beforeHeight = evidence.beforeGap * gapScale;
      const afterHeight = evidence.afterGap * gapScale;
      interventionMarkup = `<line class="hf-axis" x1="455" x2="635" y1="210" y2="210"></line><rect x="485" y="${210 - beforeHeight}" width="44" height="${beforeHeight}" fill="#fbbf24" stroke="#92400e" stroke-width="2"></rect><rect x="565" y="${210 - afterHeight}" width="44" height="${afterHeight}" fill="#c7d2fe" stroke="#4338ca" stroke-width="2"></rect><text x="507" y="230" text-anchor="middle">before</text><text x="587" y="230" text-anchor="middle">shifted</text>`;
      certificate = `orthonormal gap ${evidence.beforeGap.toFixed(2)}→${evidence.afterGap.toFixed(2)} Ha; temporary shift`;
    } else if (revealed) {
      certificate = `gates pass: residual ${evidence.finalResidual.toExponential(1)} · |ΔE| ${evidence.finalDeltaEnergy.toExponential(1)} Ha`;
    }
    setPlot('stabilizationPlot', svg(`<line class="hf-axis" x1="58" x2="${traceEnd + 2}" y1="130" y2="130"></line><path class="hf-curve coral dashed" d="${linePath(raw, 60, traceEnd, 55, 210, minimum, maximum)}"></path>${interventionMarkup}<text x="60" y="240">history start</text><text x="${traceEnd}" y="240" text-anchor="end">gap = ${item.virtualGap.toFixed(2)} Ha</text><text x="340" y="32" text-anchor="middle" class="${revealed ? 'hf-plot-oracle' : 'hf-muted'}">${esc(certificate)}</text>`, 'raw SCF history and intervention-specific evidence'));
    setHidden('stabilizationOracleKey', !revealed);
  }
  function renderDiis() {
    const id = $('diisCase')?.value || 'diis-a'; const item = DIIS_DOSSIERS[id]; const result = diisCoefficients(item.residuals); const revealed = game.revealed.diis.has(id) || game.diis.has(id); const originX = 340; const originY = 205; const arrows = item.residuals.map((residual, i) => `<path class="hf-vector ${i ? 'coral' : 'indigo'}" marker-end="url(#hf-arrow)" d="M${originX},${originY} L${originX + residual[0] * 110},${originY - residual[1] * 70}"></path><text x="${originX + residual[0] * 120}" y="${originY - residual[1] * 75}">e${i + 1}</text>`).join(''); let mixed = '';
    if (revealed && result.valid) { const vector = diisMix(item.residuals, result.coefficients); mixed = `<path class="hf-vector teal" d="M${originX},${originY} L${originX + vector[0] * 110},${originY - vector[1] * 70}"></path>`; }
    const certificate = revealed ? (result.valid ? `c = [${result.coefficients.map(value => value.toFixed(3)).join(', ')}] · ||e|| = ${result.residualNorm.toFixed(3)}` : 'singular residual history') : 'Residual vectors supplied; constrained mix sealed';
    setPlot('diisPlot', svg(`<line class="hf-axis" x1="80" x2="610" y1="205" y2="205"></line><line class="hf-axis" x1="340" x2="340" y1="45" y2="230"></line>${arrows}${mixed}<text x="340" y="32" text-anchor="middle" class="${revealed ? 'hf-plot-oracle' : 'hf-muted'}">${esc(certificate)}</text>`, 'DIIS residual-vector subspace'));
    setHidden('diisOracleKey', !revealed);
  }
  function renderReference() {
    const id = $('referenceCase')?.value || 'reference-a';
    const item = REFERENCE_DOSSIERS[id];
    const spin = uhfSpinS2(item.nAlpha, item.nBeta, item.overlap);
    const revealed = game.revealed.reference.has(id) || game.reference.has(id);
    const alpha = Array.from({ length: item.nAlpha }, (_, i) => `<rect class="hf-orbital indigo" x="${95 + i * 55}" y="105" width="38" height="58"></rect><text x="${114 + i * 55}" y="140" text-anchor="middle">α</text>`).join('');
    const beta = Array.from({ length: item.nBeta }, (_, i) => `<rect x="${400 + i * 55}" y="105" width="38" height="58" fill="url(#hf-hatch)"></rect><text x="${419 + i * 55}" y="140" text-anchor="middle">β</text>`).join('');
    if ($('referenceConstraint')) $('referenceConstraint').textContent = referenceConstraintLabel(item);
    setPlot('referencePlot', svg(`<text x="165" y="76" text-anchor="middle" class="hf-plot-title">Nα = ${item.nAlpha}</text><text x="475" y="76" text-anchor="middle" class="hf-plot-title">Nβ = ${item.nBeta}</text>${alpha}${beta}<text x="340" y="205" text-anchor="middle">Σ|Sαβ|² = ${spin.overlapSquared.toFixed(3)}</text><text x="340" y="238" text-anchor="middle" class="${revealed ? 'hf-plot-oracle' : 'hf-muted'}">${revealed ? `⟨S²⟩ = ${spin.s2.toFixed(3)} · target = ${spin.target.toFixed(3)}` : 'Reference and spin certificate sealed'}</text>`, 'reference occupancy and UHF spin diagnostic'));
    setHidden('referenceOracleKey', !revealed);
  }

  const CONFIGS = Object.freeze({
    variation: { select: 'variationCase', decision: 'variationDecision', readout: 'variationReadout', audit: 'variationAudit', evaluator: evaluateVariationMission, render: renderVariation },
    coulomb: { select: 'coulombCase', decision: 'coulombDecision', readout: 'coulombReadout', audit: 'coulombAudit', evaluator: evaluateCoulombMission, render: renderCoulomb },
    fock: { select: 'fockCase', decision: 'fockDecision', readout: 'fockReadout', audit: 'fockAudit', evaluator: evaluateFockMission, render: renderFock },
    roothaan: { select: 'roothaanCase', decision: 'roothaanDecision', readout: 'roothaanReadout', audit: 'roothaanAudit', evaluator: evaluateRoothaanMission, render: renderRoothaan },
    density: { select: 'densityCase', decision: 'densityDecision', readout: 'densityReadout', audit: 'densityAudit', evaluator: evaluateDensityMission, render: renderDensity },
    stationarity: { select: 'stationarityCase', decision: 'stationarityDecision', readout: 'stationarityReadout', audit: 'stationarityAudit', evaluator: evaluateStationarityMission, render: renderStationarity },
    fixed: { select: 'fixedCase', decision: 'fixedDecision', readout: 'fixedReadout', audit: 'fixedAudit', evaluator: evaluateFixedPointMission, render: renderFixed },
    pathology: { select: 'pathologyCase', decision: 'pathologyDecision', readout: 'pathologyReadout', audit: 'pathologyAudit', evaluator: evaluatePathologyMission, render: renderPathology },
    stabilization: { select: 'stabilizationCase', decision: 'stabilizationDecision', readout: 'stabilizationReadout', audit: 'stabilizationAudit', evaluator: evaluateStabilizationMission, render: renderStabilization },
    diis: { select: 'diisCase', decision: 'diisDecision', readout: 'diisReadout', audit: 'diisAudit', evaluator: evaluateDiisMission, render: renderDiis },
    reference: { select: 'referenceCase', decision: 'referenceDecision', readout: 'referenceReadout', audit: 'referenceAudit', evaluator: evaluateReferenceMission, render: renderReference }
  });
  function resultDetails(bucket, result) {
    if (bucket === 'variation' || bucket === 'stationarity') return `dE/dθ = ${finite(result.derivative).toFixed(3)}; curvature = ${finite(result.curvature).toFixed(3)}.`;
    if (bucket === 'coulomb') return `Signed pair total = ${finite(result.total).toFixed(3)}.`;
    if (bucket === 'fock') return `Fock Hermiticity residual = ${finite(result.symmetryResidual).toExponential(2)}; antisymmetrized-integral permutation residual = ${finite(result.integralResidual).toExponential(2)}.`;
    if (bucket === 'roothaan') return result.values ? `Orbital values = ${result.values.map(value => value.toFixed(4)).join(', ')}; metric residual = ${finite(result.metricResidual).toExponential(2)}.` : `Metric status: ${esc(result.reason === 'overlap-not-positive-definite' ? 'overlap metric is singular or non-positive' : (result.reason || 'invalid'))}.`;
    if (bucket === 'density') return `Tr(DS) = ${finite(result.electrons).toFixed(3)}; closure residual = ${finite(result.closureResidual).toExponential(2)}.`;
    if (bucket === 'fixed') return `Final output–input residual = ${finite(result.residual).toExponential(3)}.`;
    if (bucket === 'pathology') return `Last density residual = ${finite(result.residual).toExponential(3)}.`;
    if (bucket === 'stabilization') {
      if (Number.isFinite(result.afterStep)) return `Maximum displayed update step: ${result.beforeStep.toFixed(3)} → ${result.afterStep.toFixed(3)} with old-density weight ${result.dampingWeight.toFixed(2)}; rerun residual evidence is still required.`;
      if (Number.isFinite(result.afterGap)) return `Orthonormal occupied–virtual gap: ${result.beforeGap.toFixed(3)} → ${result.afterGap.toFixed(3)} Ha under a temporary ${result.shift.toFixed(2)} Ha virtual shift.`;
      return `Declared gates already pass: final density residual ${finite(result.finalResidual).toExponential(2)} and |ΔE| ${finite(result.finalDeltaEnergy).toExponential(2)} Ha.`;
    }
    if (bucket === 'diis') return result.coefficients ? `Coefficients = [${result.coefficients.map(value => value.toFixed(3)).join(', ')}].` : 'The Pulay system is singular.';
    if (bucket === 'reference') return `⟨S²⟩ = ${finite(result.s2).toFixed(3)}; target = ${finite(result.target).toFixed(3)}.`;
    return '';
  }
  function auditBucket(bucket) {
    const config = CONFIGS[bucket]; const caseId = $(config.select)?.value || CASE_IDS[bucket][0]; const choice = $(config.decision)?.value || '';
    if (!choice) return setResult(config.readout, 'needs-work', '<strong>Commit a decision.</strong> Empty submissions do not spend an attempt.');
    const result = config.evaluator(caseId, choice);
    game.revealed[bucket].add(caseId); config.render();
    const details = resultDetails(bucket, result);
    if (!result.correct) { saveGameState(); return setResult(config.readout, 'needs-work', `<strong>Decision rejected.</strong> ${details} Revise the scientific interpretation; no answer slug is revealed.`); }
    recordCase(bucket, caseId, choice);
    setResult(config.readout, 'success', `<strong>Evidence accepted.</strong> ${details} ${game[bucket].size === CASE_IDS[bucket].length ? 'This laboratory seal is now earned.' : 'Inspect the next neutral dossier.'}`);
  }

  function bossArtifact(caseId, stage, cleared) {
    const file = HF_CASE_FILES[caseId]; const reference = file.reference; const spin = uhfSpinS2(reference.nAlpha, reference.nBeta, reference.overlap); const log = file.log;
    if (cleared) return `<p><strong>Closed dossier.</strong> Nα=${reference.nAlpha}, Nβ=${reference.nBeta}; final density residual ${Math.abs(log.densityResidual.at(-1)).toExponential(2)}; ⟨S²⟩=${spin.s2.toFixed(3)}. The finite-basis/stability/correlation caveat remains attached.</p>`;
    if (stage === 0) return `<p><strong>State contract:</strong> Nα=${reference.nAlpha}, Nβ=${reference.nBeta}; common-orbital requirement ${reference.requireCommonOrbitals ? 'yes' : 'no'}; spin-purity target ${reference.requireSpinPurity ? 'yes' : 'no'}; broken-symmetry probe ${reference.brokenSymmetryTarget ? 'requested' : 'not requested'}.</p>`;
    if (stage === 1) return `<p><strong>Diagnostic artifact:</strong> energies [${log.energy.map(value => value.toFixed(6)).join(', ')}]; density residuals [${log.densityResidual.map(value => value.toExponential(2)).join(', ')}]; Σ|Sαβ|²=${spin.overlapSquared.toFixed(3)}; target S(S+1)=${spin.target.toFixed(3)}.</p>`;
    return `<p><strong>Evidence design:</strong> reported state must retain the chosen reference rationale, full residual history, restart/intervention comparison when applicable, and any spin/stability warning. Choose the package that directly tests this dossier's dominant risk.</p>`;
  }
  function bossPrerequisites() { return MISSION_IDS.slice(0, 11).every(id => game.cleared.has(id)); }
  function syncBoss() {
    const caseId = $('hfBossCase')?.value || 'hf-boss-a'; const cleared = game.boss.cleared.has(caseId); const stage = cleared ? 3 : (game.boss.stage[caseId] || 0); const budget = game.boss.budget[caseId] || 4; const ready = bossPrerequisites(); const controls = [$('hfBossReference'), $('hfBossDiagnostic'), $('hfBossEvidence')]; const answers = game.boss.answers[caseId] || [];
    if ($('hfBossArtifactTitle')) $('hfBossArtifactTitle').textContent = cleared ? 'Closed dossier artifact' : `Case ${caseId.slice(-1).toUpperCase()} · stage ${Math.min(stage + 1, 3)} artifact`;
    if ($('hfBossArtifact')) $('hfBossArtifact').innerHTML = ready ? bossArtifact(caseId, stage, cleared) : '<p>Earn Levels 1–11 to open this fixed dossier. Canonical progress without chapter evidence cannot unlock it.</p>';
    if ($('hfBossStage')) $('hfBossStage').textContent = cleared ? 'Dossier cleared · caveat retained' : `Stage ${stage + 1} / 3 · ${['reference choice', 'dominant diagnostic', 'evidence package'][stage]}`;
    if ($('hfBossBudget')) $('hfBossBudget').textContent = `Evidence budget: ${budget} attempt${budget === 1 ? '' : 's'}`;
    controls.forEach((control, index) => { if (!control) return; if (index < stage || cleared) control.value = answers[index] || ''; else if (index > stage) control.value = ''; control.disabled = !ready || cleared || index !== stage; });
    if ($('hfBossAudit')) $('hfBossAudit').disabled = !ready || cleared;
    if (!ready) setResult('hfBossFeedback', 'neutral', 'Earn Levels 1–11 before opening the final board.');
    else if (cleared) setResult('hfBossFeedback', 'success', '<strong>Dossier already cleared.</strong> Its evidence and surviving caveat remain visible.');
    else if (stage === 0) setResult('hfBossFeedback', 'neutral', 'Stage 1: commit the reference/model choice. Later fields stay locked.');
    else if (stage === 1) setResult('hfBossFeedback', 'neutral', 'Stage 2: reference locked; commit the dominant diagnostic.');
    else setResult('hfBossFeedback', 'neutral', 'Stage 3: prior commitments locked; commit the sufficient evidence package.');
    renderGameProgress();
  }
  function resetBossCase() {
    const caseId = $('hfBossCase')?.value || 'hf-boss-a'; game.boss.cleared.delete(caseId); game.boss.stage[caseId] = 0; game.boss.budget[caseId] = 4; delete game.boss.answers[caseId]; for (const id of ['hfBossReference', 'hfBossDiagnostic', 'hfBossEvidence']) if ($(id)) $(id).value = ''; deriveCleared(); saveGameState(); syncBoss();
  }
  function auditBoss() {
    if (!bossPrerequisites()) return setResult('hfBossFeedback', 'needs-work', '<strong>Board locked.</strong> Earn all eleven prerequisite laboratories first.');
    const caseId = $('hfBossCase')?.value || 'hf-boss-a'; if (game.boss.cleared.has(caseId)) return;
    const stage = game.boss.stage[caseId] || 0; const controlIds = ['hfBossReference', 'hfBossDiagnostic', 'hfBossEvidence']; const choice = $(controlIds[stage])?.value || '';
    if (!choice) return setResult('hfBossFeedback', 'needs-work', '<strong>Commit the unlocked stage.</strong> Empty submissions do not spend an attempt.');
    const result = evaluateHfCase(caseId, stage, choice);
    if (!result.correct) {
      const nextBudget = (game.boss.budget[caseId] || 4) - 1; const exhausted = nextBudget <= 0; game.boss.budget[caseId] = exhausted ? 4 : nextBudget;
      if (exhausted) { game.boss.stage[caseId] = 0; delete game.boss.answers[caseId]; for (const id of controlIds) if ($(id)) $(id).value = ''; }
      saveGameState(); syncBoss(); return setResult('hfBossFeedback', 'needs-work', `<strong>Commitment rejected${exhausted ? '; dossier reset' : ''}.</strong> Re-read the visible artifact. No answer slug is revealed.`);
    }
    const answers = game.boss.answers[caseId] || []; answers[stage] = choice; answers.length = stage + 1; game.boss.answers[caseId] = answers; game.boss.stage[caseId] = stage + 1;
    if (stage + 1 === 3) { game.boss.cleared.add(caseId); game.boss.budget[caseId] = 4; deriveCleared(); saveGameState(); syncBoss(); setResult('hfBossFeedback', 'success', '<strong>Dossier cleared.</strong> The evidence chain and surviving caveat remain visible.'); return; }
    saveGameState(); syncBoss(); setResult('hfBossFeedback', 'success', '<strong>Stage accepted.</strong> Inspect the newly opened artifact and commit the next field.');
  }

  function resetGameState() {
    game.cleared.clear();
    for (const bucket of Object.keys(MISSION_CASE_MAP)) { game[bucket].clear(); game.revealed[bucket].clear(); game.transcripts[bucket] = {}; }
    game.boss.cleared.clear(); game.boss.stage = {}; game.boss.budget = {}; game.boss.answers = {};
    try { window.localStorage.removeItem(GAME_STORAGE_KEY); } catch (_error) { /* ignore */ }
    window.ProjectXCAcademy?.resetChapter(CHAPTER_ID);
    for (const [bucket, config] of Object.entries(CONFIGS)) { if ($(config.select)) $(config.select).value = CASE_IDS[bucket][0]; if ($(config.decision)) $(config.decision).value = ''; setResult(config.readout, 'neutral', 'Fresh chapter state restored; commit the displayed dossier to reveal its certificate.'); config.render(); }
    if ($('hfBossCase')) $('hfBossCase').value = 'hf-boss-a'; for (const id of ['hfBossReference', 'hfBossDiagnostic', 'hfBossEvidence']) if ($(id)) $(id).value = ''; syncBoss(); renderGameProgress();
  }
  function bindLessonKeyboardNavigation() {
    const buttons = [...document.querySelectorAll('.academy-lesson-nav button[data-step]')];
    buttons.forEach((button, index) => {
      button.addEventListener('keydown', event => {
        if (event.repeat) return; let next = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % buttons.length;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
        if (event.key === 'Home') next = 0; if (event.key === 'End') next = buttons.length - 1;
        if (next === null) return; event.preventDefault(); buttons[next].focus();
      });
    });
  }
  function init() {
    restoreGameState();
    for (const [bucket, config] of Object.entries(CONFIGS)) {
      $(config.select)?.addEventListener('change', () => { if ($(config.decision)) $(config.decision).value = ''; config.render(); });
      $(config.audit)?.addEventListener('click', () => auditBucket(bucket)); config.render();
    }
    $('hfBossCase')?.addEventListener('change', () => { for (const id of ['hfBossReference', 'hfBossDiagnostic', 'hfBossEvidence']) if ($(id)) $(id).value = ''; syncBoss(); });
    $('hfBossAudit')?.addEventListener('click', auditBoss); $('hfResetBossCase')?.addEventListener('click', resetBossCase);
    syncBoss(); window.ProjectXCAcademy?.bindChapter({ chapterId: CHAPTER_ID, totalMissions: 12 }); window.addEventListener('project-xc-academy-progress', renderGameProgress); renderGameProgress();
    document.querySelectorAll('.academy-complete[data-game-gate]').forEach(button => {
      button.addEventListener('click', event => {
        if (game.cleared.has(button.dataset.mission)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        renderGameProgress();
        const heading = button.closest('.academy-lesson')?.querySelector('h2');
        if (heading) { heading.tabIndex = -1; heading.focus(); }
      }, true);
      button.addEventListener('click', () => window.setTimeout(() => { renderGameProgress(); if (button.disabled) { const heading = button.closest('.academy-lesson')?.querySelector('h2'); if (heading) { heading.tabIndex = -1; heading.focus(); } } }, 0));
    });
    $('resetChapterProgress')?.addEventListener('click', resetGameState); bindLessonKeyboardNavigation();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
