'use strict';

(() => {
  const EPS = 1e-12;
  const ZPE_KCAL_MOL_PER_CM = 0.0014295718;

  function finiteNumber(value) { return typeof value === 'number' && Number.isFinite(value); }
  function validVector(vector, length = null) {
    return Array.isArray(vector) && (length === null || vector.length === length) && vector.length > 0 && vector.every(finiteNumber);
  }
  function validMatrix2(matrix, symmetric = false, tolerance = 1e-10) {
    return Array.isArray(matrix) && matrix.length === 2 && matrix.every(row => validVector(row, 2)) && (!symmetric || Math.abs(matrix[0][1] - matrix[1][0]) <= tolerance);
  }
  function vectorNorm(vector) {
    if (!validVector(vector)) throw new Error('finite vector required');
    return Math.hypot(...vector);
  }
  function dot(left, right) {
    if (!validVector(left) || !validVector(right, left.length)) throw new Error('compatible vectors required');
    return left.reduce((sum, value, index) => sum + value * right[index], 0);
  }
  function matVec(matrix, vector) {
    if (!validMatrix2(matrix) || !validVector(vector, 2)) throw new Error('two-dimensional matrix/vector required');
    return matrix.map(row => dot(row, vector));
  }
  function outer(left, right) { return left.map(a => right.map(b => a * b)); }
  function addMatrix(left, right, rightScale = 1) {
    if (!validMatrix2(left) || !validMatrix2(right)) throw new Error('two matrices required');
    return left.map((row, i) => row.map((value, j) => value + rightScale * right[i][j]));
  }
  function scaleMatrix(matrix, scale) {
    if (!validMatrix2(matrix) || !finiteNumber(scale)) throw new Error('finite matrix scale required');
    return matrix.map(row => row.map(value => value * scale));
  }
  function symmetryResidual(matrix) {
    return validMatrix2(matrix) ? Math.abs(matrix[0][1] - matrix[1][0]) : Infinity;
  }

  function symmetricEigen2(matrix, tolerance = 1e-10) {
    if (!validMatrix2(matrix, true, tolerance)) return { valid: false, values: [], vectors: [] };
    const a = matrix[0][0];
    const b = (matrix[0][1] + matrix[1][0]) / 2;
    const d = matrix[1][1];
    const center = (a + d) / 2;
    const radius = Math.hypot((a - d) / 2, b);
    const angle = Math.atan2(2 * b, a - d) / 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return { valid: true, values: [center - radius, center + radius], vectors: [[-s, c], [c, s]] };
  }

  function quadraticSurface(model, point) {
    if (!model || !finiteNumber(model.offset) || !validVector(model.linear, 2) || !validMatrix2(model.hessian, true) || !validVector(point, 2)) return { valid: false };
    const hp = matVec(model.hessian, point);
    const gradient = model.linear.map((value, i) => value + hp[i]);
    const energy = model.offset + dot(model.linear, point) + 0.5 * dot(point, hp);
    return { valid: true, energy, gradient, force: gradient.map(value => -value), hessian: model.hessian.map(row => row.slice()) };
  }

  function directionalDerivative(gradient, direction) {
    if (!validVector(gradient) || !validVector(direction, gradient.length)) return { valid: false };
    const norm = vectorNorm(direction);
    if (norm <= EPS) return { valid: false };
    const normalized = direction.map(value => value / norm);
    return { valid: true, direction: normalized, value: dot(gradient, normalized) };
  }

  function stationaryGradientLedger(input, residualTolerance = 1e-7) {
    const names = ['nuclear', 'oneElectron', 'twoElectron', 'overlapPulay', 'scfResidual'];
    if (!input || names.some(name => !finiteNumber(input[name])) || input.scfResidual < 0 || !finiteNumber(residualTolerance) || residualTolerance <= 0) return { valid: false, stationary: false };
    const withoutPulay = input.nuclear + input.oneElectron + input.twoElectron;
    return {
      valid: true,
      stationary: input.scfResidual <= residualTolerance,
      total: withoutPulay + input.overlapPulay,
      withoutPulay,
      pulayContribution: input.overlapPulay,
      scfResidual: input.scfResidual,
      residualTolerance
    };
  }

  function polynomialEnergy(coefficients, coordinate) {
    if (!validVector(coefficients) || !finiteNumber(coordinate)) return NaN;
    return coefficients.reduceRight((value, coefficient) => value * coordinate + coefficient, 0);
  }
  function polynomialDerivative(coefficients, coordinate) {
    if (!validVector(coefficients) || !finiteNumber(coordinate)) return NaN;
    let derivative = 0;
    for (let power = coefficients.length - 1; power >= 1; power -= 1) derivative = derivative * coordinate + power * coefficients[power];
    return derivative;
  }
  function centralDifferenceDerivative(energyFunction, coordinate, step) {
    if (typeof energyFunction !== 'function' || !finiteNumber(coordinate) || !finiteNumber(step) || step <= 0) throw new Error('finite positive difference step required');
    const plus = energyFunction(coordinate + step);
    const minus = energyFunction(coordinate - step);
    if (!finiteNumber(plus) || !finiteNumber(minus)) throw new Error('finite energies required');
    return (plus - minus) / (2 * step);
  }

  function solveSymmetric2(matrix, rhs) {
    if (!validMatrix2(matrix, true) || !validVector(rhs, 2)) return { valid: false };
    const determinant = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
    if (Math.abs(determinant) <= 1e-10) return { valid: false };
    return {
      valid: true,
      value: [
        (rhs[0] * matrix[1][1] - matrix[0][1] * rhs[1]) / determinant,
        (matrix[0][0] * rhs[1] - rhs[0] * matrix[1][0]) / determinant
      ],
      determinant
    };
  }
  function clampVector(vector, radius) {
    const norm = vectorNorm(vector);
    if (norm <= radius) return { value: vector.slice(), clipped: false };
    return { value: vector.map(component => component * radius / norm), clipped: true };
  }
  function optimizationStep(gradient, hessian, method, options = {}) {
    if (!validVector(gradient, 2) || !validMatrix2(hessian, true)) return { valid: false };
    const trustRadius = finiteNumber(options.trustRadius) && options.trustRadius > 0 ? options.trustRadius : Infinity;
    let raw;
    if (method === 'steepest') {
      const stepSize = finiteNumber(options.stepSize) && options.stepSize > 0 ? options.stepSize : 0.1;
      raw = gradient.map(value => -stepSize * value);
    } else if (method === 'newton') {
      const solved = solveSymmetric2(hessian, gradient.map(value => -value));
      if (!solved.valid) return { valid: false, reason: 'singular-hessian' };
      raw = solved.value;
    } else return { valid: false, reason: 'unknown-method' };
    const bounded = clampVector(raw, trustRadius);
    return { valid: true, method, rawStep: raw, step: bounded.value, clipped: bounded.clipped, norm: vectorNorm(bounded.value), predictedChange: predictedQuadraticChange(gradient, hessian, bounded.value) };
  }
  function predictedQuadraticChange(gradient, hessian, step) {
    if (!validVector(gradient, 2) || !validMatrix2(hessian, true) || !validVector(step, 2)) return NaN;
    return dot(gradient, step) + 0.5 * dot(step, matVec(hessian, step));
  }
  function trustRatio(actualReduction, predictedReduction, stepOnBoundary = false) {
    if (!finiteNumber(actualReduction) || !finiteNumber(predictedReduction) || predictedReduction <= 0 || typeof stepOnBoundary !== 'boolean') return { valid: false };
    const ratio = actualReduction / predictedReduction;
    let action = 'accept-keep';
    if (ratio < 0.25) action = 'reject-shrink';
    else if (ratio > 0.75 && stepOnBoundary) action = 'accept-expand';
    return { valid: true, ratio, action };
  }

  function bfgsUpdate(hessian, displacement, gradientChange, tolerance = 1e-10) {
    if (!validMatrix2(hessian, true) || !validVector(displacement, 2) || !validVector(gradientChange, 2)) return { valid: false, reason: 'invalid-data' };
    const bs = matVec(hessian, displacement);
    const sBs = dot(displacement, bs);
    const curvature = dot(displacement, gradientChange);
    if (curvature <= tolerance || sBs <= tolerance) return { valid: false, reason: 'nonpositive-curvature', curvature, sBs };
    const removed = scaleMatrix(outer(bs, bs), 1 / sBs);
    const added = scaleMatrix(outer(gradientChange, gradientChange), 1 / curvature);
    const matrix = addMatrix(addMatrix(hessian, removed, -1), added);
    const eigen = symmetricEigen2(matrix);
    return { valid: true, matrix, curvature, sBs, positiveDefinite: eigen.valid && eigen.values[0] > tolerance, eigenvalues: eigen.values };
  }

  function finiteDifferenceHessian2(gradientFunction, point, step) {
    if (typeof gradientFunction !== 'function' || !validVector(point, 2) || !finiteNumber(step) || step <= 0) return { valid: false };
    const matrix = [[0, 0], [0, 0]];
    for (let column = 0; column < 2; column += 1) {
      const plus = point.slice(); const minus = point.slice();
      plus[column] += step; minus[column] -= step;
      const gPlus = gradientFunction(plus); const gMinus = gradientFunction(minus);
      if (!validVector(gPlus, 2) || !validVector(gMinus, 2)) return { valid: false };
      for (let row = 0; row < 2; row += 1) matrix[row][column] = (gPlus[row] - gMinus[row]) / (2 * step);
    }
    return { valid: true, matrix, symmetryResidual: symmetryResidual(matrix) };
  }
  function hessianInertia(hessian, tolerance = 1e-6) {
    if (!finiteNumber(tolerance) || tolerance <= 0) return { valid: false };
    const eigen = symmetricEigen2(hessian);
    if (!eigen.valid) return { valid: false, symmetryResidual: symmetryResidual(hessian) };
    const negative = eigen.values.filter(value => value < -tolerance).length;
    const positive = eigen.values.filter(value => value > tolerance).length;
    const nearZero = eigen.values.length - negative - positive;
    return { valid: true, values: eigen.values, vectors: eigen.vectors, negative, positive, nearZero, tolerance };
  }
  function massWeightedHessian(hessian, masses) {
    if (!validMatrix2(hessian, true) || !validVector(masses, 2) || masses.some(mass => mass <= 0)) return null;
    return hessian.map((row, i) => row.map((value, j) => value / Math.sqrt(masses[i] * masses[j])));
  }
  function normalModes2(hessian, masses) {
    const weighted = massWeightedHessian(hessian, masses);
    if (!weighted) return { valid: false };
    const eigen = symmetricEigen2(weighted);
    if (!eigen.valid) return { valid: false };
    const cartesianVectors = eigen.values.map((_, mode) => {
      const raw = [eigen.vectors[0][mode] / Math.sqrt(masses[0]), eigen.vectors[1][mode] / Math.sqrt(masses[1])];
      const norm = Math.hypot(...raw);
      return raw.map(value => value / norm);
    });
    return { valid: true, weightedHessian: weighted, values: eigen.values, massWeightedVectors: eigen.vectors, cartesianVectors };
  }

  function stationaryPointAudit(input) {
    if (!input || !validVector(input.gradient) || !validVector(input.eigenvalues) || !Number.isInteger(input.atomCount) || input.atomCount < 2 || typeof input.linear !== 'boolean') return { valid: false, kind: 'invalid' };
    const tolerance = finiteNumber(input.tolerance) && input.tolerance > 0 ? input.tolerance : 1e-5;
    const gradientTolerance = finiteNumber(input.gradientTolerance) && input.gradientTolerance > 0 ? input.gradientTolerance : 1e-4;
    const gradientNorm = vectorNorm(input.gradient);
    const expectedModeCount = 3 * input.atomCount - (input.linear ? 5 : 6);
    const negative = input.eigenvalues.filter(value => value < -tolerance).length;
    const nearZero = input.eigenvalues.filter(value => Math.abs(value) <= tolerance).length;
    const modeCountMatches = input.eigenvalues.length === expectedModeCount;
    let kind;
    if (!modeCountMatches) kind = 'invalid-mode-count';
    else if (gradientNorm > gradientTolerance) kind = 'not-stationary';
    else if (nearZero > 0) kind = 'unresolved-near-zero';
    else if (negative === 0) kind = 'minimum';
    else if (negative === 1) kind = 'first-order-saddle';
    else kind = 'higher-order-saddle';
    return { valid: true, kind, gradientNorm, negative, nearZero, expectedModeCount, modeCountMatches, tolerance, gradientTolerance };
  }
  function zpeKcalMol(wavenumbers) {
    if (!Array.isArray(wavenumbers) || wavenumbers.some(value => !finiteNumber(value) || value < 0)) return NaN;
    return wavenumbers.reduce((sum, value) => sum + value, 0) * ZPE_KCAL_MOL_PER_CM;
  }

  function doubleWellSurface(point, parameters = {}) {
    if (!validVector(point, 2)) return { valid: false };
    const barrier = finiteNumber(parameters.barrier) && parameters.barrier > 0 ? parameters.barrier : 1;
    const transverse = finiteNumber(parameters.transverse) ? parameters.transverse : 1;
    const [x, y] = point;
    return {
      valid: true,
      energy: barrier * (x * x - 1) ** 2 + 0.5 * transverse * y * y,
      gradient: [4 * barrier * x * (x * x - 1), transverse * y],
      hessian: [[4 * barrier * (3 * x * x - 1), 0], [0, transverse]]
    };
  }
  function traceIrc(direction, parameters = {}, options = {}) {
    if (![1, -1].includes(direction)) return { valid: false, points: [] };
    const displacement = finiteNumber(options.displacement) && options.displacement > 0 ? options.displacement : 0.05;
    let step = finiteNumber(options.step) && options.step > 0 ? options.step : 0.08;
    const maxSteps = Number.isInteger(options.maxSteps) && options.maxSteps > 0 ? options.maxSteps : 160;
    const tolerance = finiteNumber(options.tolerance) && options.tolerance > 0 ? options.tolerance : 1e-8;
    let point = [direction * displacement, 0];
    const points = [[0, 0], point.slice()];
    for (let iteration = 0; iteration < maxSteps; iteration += 1) {
      const state = doubleWellSurface(point, parameters);
      const norm = vectorNorm(state.gradient);
      if (norm <= tolerance) break;
      let candidate = point.map((value, index) => value - step * state.gradient[index]);
      let next = doubleWellSurface(candidate, parameters);
      let backtracks = 0;
      while (next.energy > state.energy && backtracks < 20) {
        step *= 0.5;
        candidate = point.map((value, index) => value - step * state.gradient[index]);
        next = doubleWellSurface(candidate, parameters);
        backtracks += 1;
      }
      if (next.energy > state.energy) return { valid: false, points, reason: 'descent-failed' };
      point = candidate;
      points.push(point.slice());
    }
    const end = doubleWellSurface(point, parameters);
    return { valid: vectorNorm(end.gradient) <= Math.max(tolerance, 1e-7), points, endpoint: point.slice(), endpointGradientNorm: vectorNorm(end.gradient) };
  }
  function auditIrcEndpoints(plusPoints, minusPoints, tolerance = 1e-3) {
    if (!Array.isArray(plusPoints) || !Array.isArray(minusPoints) || !plusPoints.length || !minusPoints.length || !validVector(plusPoints.at(-1), 2) || !validVector(minusPoints.at(-1), 2)) return { valid: false };
    const plus = plusPoints.at(-1); const minus = minusPoints.at(-1);
    const plusMinimum = Math.abs(plus[0] - 1) <= tolerance && Math.abs(plus[1]) <= tolerance;
    const minusMinimum = Math.abs(minus[0] + 1) <= tolerance && Math.abs(minus[1]) <= tolerance;
    return { valid: true, plus, minus, distinct: plus[0] * minus[0] < 0, connectedMinima: plusMinimum && minusMinimum };
  }
  function zpeCorrectedBarrier(electronicTransition, electronicReactant, transitionFrequencies, reactantFrequencies) {
    if (![electronicTransition, electronicReactant].every(finiteNumber)) return NaN;
    const transitionZpe = zpeKcalMol(transitionFrequencies);
    const reactantZpe = zpeKcalMol(reactantFrequencies);
    return Number.isFinite(transitionZpe) && Number.isFinite(reactantZpe) ? electronicTransition - electronicReactant + transitionZpe - reactantZpe : NaN;
  }

  const PES_DOSSIERS = Object.freeze({
    'surface-a': Object.freeze({ model: { offset: 0, linear: [-1.2, 0], hessian: [[1.4, 0.2], [0.2, 1]] }, point: [0, 0] }),
    'surface-b': Object.freeze({ model: { offset: 0.3, linear: [0, 1.1], hessian: [[1, -0.1], [-0.1, 1.8]] }, point: [0, 0] }),
    'surface-c': Object.freeze({ model: { offset: -0.4, linear: [0, 0], hessian: [[2, 0], [0, 1]] }, point: [0, 0] })
  });
  const GRADIENT_DOSSIERS = Object.freeze({
    'gradient-a': Object.freeze({ nuclear: 0.21, oneElectron: -0.33, twoElectron: 0.19, overlapPulay: -0.08, scfResidual: 1e-10 }),
    'gradient-b': Object.freeze({ nuclear: 0.11, oneElectron: -0.24, twoElectron: 0.13, overlapPulay: 0, scfResidual: 2e-11 }),
    'gradient-c': Object.freeze({ nuclear: 0.18, oneElectron: -0.20, twoElectron: 0.04, overlapPulay: -0.01, scfResidual: 2e-3 })
  });
  const VALIDATION_DOSSIERS = Object.freeze({
    'validation-a': Object.freeze({ coefficients: [1, -0.7, 0.5, 0.2, 0.1], coordinate: 0.3, step: 1e-3 }),
    'validation-b': Object.freeze({ coefficients: [1, -0.7, 0.5, 0.2, 0.1], coordinate: 0.3, step: 0.4 }),
    'validation-c': Object.freeze({ coefficients: [1, -0.7, 0.5, 0.2, 0.1], coordinate: 0.3, step: 1e-14 })
  });
  const OPTIMIZATION_DOSSIERS = Object.freeze({
    'optimization-a': Object.freeze({ gradient: [2, -1], hessian: [[4, 0], [0, 2]], trustRadius: 2 }),
    'optimization-b': Object.freeze({ gradient: [1, 0.2], hessian: [[1e-4, 0], [0, 2]], trustRadius: 0.4 }),
    'optimization-c': Object.freeze({ gradient: [0.3, -0.2], hessian: [[-1, 0], [0, 2]], trustRadius: 0.5 })
  });
  const TRUST_DOSSIERS = Object.freeze({
    'trust-a': Object.freeze({ hessian: [[1, 0], [0, 1]], displacement: [1, 0], gradientChange: [2, 0.5], actualReduction: 0.95, predictedReduction: 1, boundary: true }),
    'trust-b': Object.freeze({ hessian: [[1, 0], [0, 1]], displacement: [1, 0], gradientChange: [-1, 0.1], actualReduction: 0.7, predictedReduction: 1, boundary: false }),
    'trust-c': Object.freeze({ hessian: [[1, 0], [0, 1]], displacement: [0.5, 0.2], gradientChange: [0.8, 0.4], actualReduction: 0.1, predictedReduction: 1, boundary: false })
  });
  const HESSIAN_DOSSIERS = Object.freeze({
    'hessian-a': Object.freeze({ hessian: [[2, 0.4], [0.4, 1.5]], tolerance: 1e-6 }),
    'hessian-b': Object.freeze({ hessian: [[-4, 0], [0, 1]], tolerance: 1e-6 }),
    'hessian-c': Object.freeze({ hessian: [[1, 0.3], [0.1, 2]], tolerance: 1e-6 }),
    'hessian-d': Object.freeze({ hessian: [[1e-9, 0], [0, 1]], tolerance: 1e-6 })
  });
  const MODE_DOSSIERS = Object.freeze({
    'modes-a': Object.freeze({ hessian: [[1, -1], [-1, 1]], masses: [1, 1], referenceMasses: [1, 1] }),
    'modes-b': Object.freeze({ hessian: [[1, -1], [-1, 1]], masses: [1, 2], referenceMasses: [1, 1] }),
    'modes-c': Object.freeze({ hessian: [[1, -1], [-1, 1]], masses: [1, 0], referenceMasses: [1, 1] })
  });
  const STATIONARY_DOSSIERS = Object.freeze({
    'stationary-a': Object.freeze({ gradient: [1e-7, -2e-7], eigenvalues: [0.5, 1.2, 2.1], atomCount: 3, linear: false, tolerance: 1e-5 }),
    'stationary-b': Object.freeze({ gradient: [0, 0], eigenvalues: [-0.8, 0.5, 1.1], atomCount: 3, linear: false, tolerance: 1e-5 }),
    'stationary-c': Object.freeze({ gradient: [0, 0], eigenvalues: [-0.8, -0.2, 1.1], atomCount: 3, linear: false, tolerance: 1e-5 }),
    'stationary-d': Object.freeze({ gradient: [0, 0], eigenvalues: [-1e-8, 0.5, 1.1], atomCount: 3, linear: false, tolerance: 1e-5 }),
    'stationary-e': Object.freeze({ gradient: [0, 0], eigenvalues: [0.5, 1.1], atomCount: 3, linear: false, tolerance: 1e-5 })
  });
  const IRC_DOSSIERS = Object.freeze({
    'irc-a': Object.freeze({ parameters: { barrier: 1, transverse: 1 }, electronicBarrierKcalMol: 1, directions: 2 }),
    'irc-b': Object.freeze({ parameters: { barrier: 1, transverse: -1 }, electronicBarrierKcalMol: 1, directions: 2 }),
    'irc-c': Object.freeze({ parameters: { barrier: 1, transverse: 1 }, electronicBarrierKcalMol: 1, directions: 1 })
  });
  const GEOMETRY_CASE_FILES = Object.freeze({
    'geometry-case-a': Object.freeze({ target: 'minimum', gradientNorm: 2e-6, negativeModes: 0, finiteDifferenceError: 2e-7 }),
    'geometry-case-b': Object.freeze({ target: 'transition-state', gradientNorm: 4e-6, negativeModes: 1, reactionModeOverlap: 0.93, distinctIrcEndpoints: true }),
    'geometry-case-c': Object.freeze({ target: 'frequency-audit', gradientNorm: 8e-6, lowestEigenvalue: -8e-7, tolerance: 1e-5, externalModeOverlap: 0.82 })
  });

  function outcome(correct, details = {}) { return { correct: Boolean(correct), ...details }; }
  function evaluatePesMission(caseId, choice) {
    const item = PES_DOSSIERS[caseId]; if (!item) return outcome(false);
    const state = quadraticSurface(item.model, item.point); const forceNorm = vectorNorm(state.force);
    let derived = 'stationary';
    if (forceNorm > 1e-8) {
      const axis = Math.abs(state.force[0]) >= Math.abs(state.force[1]) ? 0 : 1;
      derived = `${state.force[axis] >= 0 ? 'positive' : 'negative'}-q${axis + 1}`;
    }
    return outcome(choice === derived, { derived, state });
  }
  function evaluateGradientMission(caseId, choice) {
    const item = GRADIENT_DOSSIERS[caseId]; if (!item) return outcome(false);
    const ledger = stationaryGradientLedger(item);
    const derived = !ledger.stationary ? 'reconverge-electronic-state' : Math.abs(item.overlapPulay) > 1e-12 ? 'include-pulay' : 'stationary-explicit-complete';
    return outcome(choice === derived, { derived, ledger });
  }
  function evaluateValidationMission(caseId, choice) {
    const item = VALIDATION_DOSSIERS[caseId]; if (!item) return outcome(false);
    const analytic = polynomialDerivative(item.coefficients, item.coordinate);
    const numeric = centralDifferenceDerivative(value => polynomialEnergy(item.coefficients, value), item.coordinate, item.step);
    const error = Math.abs(numeric - analytic);
    const derived = item.step > 0.1 ? 'step-too-large' : item.step < 1e-9 ? 'step-too-small' : error <= 1e-5 ? 'validated-window' : 'step-too-large';
    return outcome(choice === derived, { derived, analytic, numeric, error });
  }
  function evaluateOptimizationMission(caseId, choice) {
    const item = OPTIMIZATION_DOSSIERS[caseId]; if (!item) return outcome(false);
    const inertia = hessianInertia(item.hessian, 1e-6);
    const determinant = item.hessian[0][0] * item.hessian[1][1] - item.hessian[0][1] * item.hessian[1][0];
    const derived = inertia.negative > 0 ? 'reject-indefinite-model' : Math.abs(determinant) < 1e-3 ? 'steepest-descent' : 'trust-newton';
    return outcome(choice === derived, { derived, inertia, newton: optimizationStep(item.gradient, item.hessian, 'newton', { trustRadius: item.trustRadius }), steepest: optimizationStep(item.gradient, item.hessian, 'steepest', { trustRadius: item.trustRadius, stepSize: 0.15 }) });
  }
  function evaluateTrustMission(caseId, choice) {
    const item = TRUST_DOSSIERS[caseId]; if (!item) return outcome(false);
    const update = bfgsUpdate(item.hessian, item.displacement, item.gradientChange);
    const trust = trustRatio(item.actualReduction, item.predictedReduction, item.boundary);
    const derived = !update.valid ? 'skip-bfgs' : trust.action === 'reject-shrink' ? 'reject-shrink' : trust.action === 'accept-expand' ? 'accept-expand-bfgs' : 'accept-keep-bfgs';
    return outcome(choice === derived, { derived, update, trust });
  }
  function evaluateHessianMission(caseId, choice) {
    const item = HESSIAN_DOSSIERS[caseId]; if (!item) return outcome(false);
    const inertia = hessianInertia(item.hessian, item.tolerance);
    let derived = 'reject-asymmetric';
    if (inertia.valid) derived = inertia.nearZero ? 'unresolved-near-zero' : inertia.negative === 0 ? 'positive-definite' : inertia.negative === 1 ? 'one-negative-mode' : 'multiple-negative-modes';
    return outcome(choice === derived, { derived, inertia });
  }
  function evaluateModesMission(caseId, choice) {
    const item = MODE_DOSSIERS[caseId]; if (!item) return outcome(false);
    const modes = normalModes2(item.hessian, item.masses);
    let derived = 'reject-masses';
    if (modes.valid) {
      const reference = normalModes2(item.hessian, item.referenceMasses);
      derived = modes.values[1] < reference.values[1] - 1e-10 ? 'heavier-isotope-lowers-frequency' : 'translation-stretch';
    }
    return outcome(choice === derived, { derived, modes });
  }
  function evaluateStationaryMission(caseId, choice) {
    const item = STATIONARY_DOSSIERS[caseId]; if (!item) return outcome(false);
    const audit = stationaryPointAudit(item);
    return outcome(choice === audit.kind, { derived: audit.kind, audit });
  }
  function evaluateIrcMission(caseId, choice) {
    const item = IRC_DOSSIERS[caseId]; if (!item) return outcome(false);
    const inertia = hessianInertia(doubleWellSurface([0, 0], item.parameters).hessian, 1e-6);
    let derived = 'trace-both-directions'; let endpoints = null;
    if (inertia.negative > 1) derived = 'higher-order-saddle';
    else if (item.directions === 2) {
      const plus = traceIrc(1, item.parameters); const minus = traceIrc(-1, item.parameters);
      endpoints = auditIrcEndpoints(plus.points, minus.points);
      derived = plus.valid && minus.valid && endpoints.connectedMinima ? 'validated-irc' : 'trace-both-directions';
    }
    return outcome(choice === derived, { derived, inertia, endpoints });
  }
  function evaluateGeometryCase(caseId, stage, choice) {
    const item = GEOMETRY_CASE_FILES[caseId];
    if (!item || !Number.isInteger(stage) || stage < 0 || stage > 2 || typeof choice !== 'string') return outcome(false);
    let derived = '';
    if (item.target === 'minimum') {
      if (stage === 0) derived = 'minimum-optimization';
      if (stage === 1) derived = 'gradient-and-hessian';
      if (stage === 2 && item.gradientNorm < 1e-5 && item.negativeModes === 0 && item.finiteDifferenceError < 1e-5) derived = 'tight-gradient-positive-modes-fd';
    } else if (item.target === 'transition-state') {
      if (stage === 0) derived = 'transition-state-search';
      if (stage === 1 && item.negativeModes === 1 && item.reactionModeOverlap > 0.8) derived = 'one-imaginary-reaction-mode';
      if (stage === 2 && item.distinctIrcEndpoints) derived = 'two-sided-irc-endpoints';
    } else if (item.target === 'frequency-audit') {
      if (stage === 0) derived = 'frequency-recheck';
      if (stage === 1 && Math.abs(item.lowestEigenvalue) <= item.tolerance && item.externalModeOverlap > 0.5) derived = 'near-zero-mode-contamination';
      if (stage === 2) derived = 'tighter-grid-projection-repeat';
    }
    return outcome(choice === derived, { derived });
  }

  const publicModels = Object.freeze({
    vectorNorm, symmetricEigen2, quadraticSurface, directionalDerivative, stationaryGradientLedger,
    polynomialEnergy, polynomialDerivative, centralDifferenceDerivative, optimizationStep,
    predictedQuadraticChange, trustRatio, bfgsUpdate, finiteDifferenceHessian2, hessianInertia,
    massWeightedHessian, normalModes2, stationaryPointAudit, zpeKcalMol, doubleWellSurface,
    traceIrc, auditIrcEndpoints, zpeCorrectedBarrier
  });
  const testModels = Object.freeze({ ...publicModels, evaluatePesMission, evaluateGradientMission, evaluateValidationMission, evaluateOptimizationMission, evaluateTrustMission, evaluateHessianMission, evaluateModesMission, evaluateStationaryMission, evaluateIrcMission, evaluateGeometryCase });
  if (typeof window === 'object' && window) window.QCGeometryModels = publicModels;
  if (typeof module === 'object' && module && module.exports) module.exports = testModels;

  if (typeof document === 'undefined' || !document.getElementById) return;

  const GAME_STORAGE_KEY = 'project-xc-geometry-games-v1';
  const CHAPTER_ID = 'qc-geometry';
  const MISSION_IDS = Object.freeze([
    'pes-forces', 'analytic-gradient', 'gradient-validation', 'geometry-optimization', 'trust-bfgs',
    'hessian-curvature', 'normal-modes', 'stationary-points', 'transition-state-irc', 'geometry-case-file'
  ]);
  const CASE_IDS = Object.freeze({
    pes: Object.freeze(Object.keys(PES_DOSSIERS)), gradient: Object.freeze(Object.keys(GRADIENT_DOSSIERS)),
    validation: Object.freeze(Object.keys(VALIDATION_DOSSIERS)), optimization: Object.freeze(Object.keys(OPTIMIZATION_DOSSIERS)),
    trust: Object.freeze(Object.keys(TRUST_DOSSIERS)), hessian: Object.freeze(Object.keys(HESSIAN_DOSSIERS)),
    modes: Object.freeze(Object.keys(MODE_DOSSIERS)), stationary: Object.freeze(Object.keys(STATIONARY_DOSSIERS)),
    irc: Object.freeze(Object.keys(IRC_DOSSIERS)), boss: Object.freeze(Object.keys(GEOMETRY_CASE_FILES))
  });
  const DOSSIER_TABLES = Object.freeze({ pes: PES_DOSSIERS, gradient: GRADIENT_DOSSIERS, validation: VALIDATION_DOSSIERS, optimization: OPTIMIZATION_DOSSIERS, trust: TRUST_DOSSIERS, hessian: HESSIAN_DOSSIERS, modes: MODE_DOSSIERS, stationary: STATIONARY_DOSSIERS, irc: IRC_DOSSIERS, boss: GEOMETRY_CASE_FILES });
  const MISSION_CASE_MAP = Object.freeze({ pes: 'pes-forces', gradient: 'analytic-gradient', validation: 'gradient-validation', optimization: 'geometry-optimization', trust: 'trust-bfgs', hessian: 'hessian-curvature', modes: 'normal-modes', stationary: 'stationary-points', irc: 'transition-state-irc' });
  const SCORE_LABELS = Object.freeze({ pes: ['pesStage', 'Surfaces'], gradient: ['gradientStage', 'Ledgers'], validation: ['validationStage', 'Steps'], optimization: ['optimizationStage', 'Steps'], trust: ['trustStage', 'Trust files'], hessian: ['hessianStage', 'Hessians'], modes: ['modesStage', 'Mode files'], stationary: ['stationaryStage', 'Spectra'], irc: ['ircStage', 'Paths'] });
  const NOTEBOOK_ENTRIES = Object.freeze({
    'pes-forces': ['PES gradient/force walk', 'Global basin and molecular accuracy', 'Directional derivative and force sign', 'Local downhill evidence; force = −gradient'],
    'analytic-gradient': ['Stationary HF derivative ledger', 'Nonvariational response and higher derivatives', 'SCF residual plus every derivative term', 'Pulay/overlap contribution retained when basis moves'],
    'gradient-validation': ['Analytic/central-difference comparison', 'Proof that both routes are independently correct', 'Step-size error window', 'Large-h truncation and tiny-h cancellation remain'],
    'geometry-optimization': ['Curvature-aware geometry step', 'Global minimum guarantee', 'Hessian inertia, conditioning, and predicted change', 'Trust-limited local model only'],
    'trust-bfgs': ['Secant Hessian update and trust decision', 'Exact curvature and basin identity', 'sᵀy and actual/predicted reduction', 'Unsafe updates skipped; rejected steps shrink trust'],
    'hessian-curvature': ['Second-derivative inertia audit', 'Automatic physical labels for zero modes', 'Symmetry, finite-difference check, and eigenvalue tolerance', 'Near-zero curvature remains unresolved'],
    'normal-modes': ['Mass-weighted normal-mode analysis', 'Full molecular translation/rotation projection', 'Diatomic zero/stretch eigenvalue and isotope trend', 'Teaching spring model only'],
    'stationary-points': ['Gradient + vibrational classification', 'Anharmonic/thermal/free-energy corrections', 'Mode count, inertia tolerance, and harmonic ZPE', 'Tiny imaginary modes need numerical diagnosis'],
    'transition-state-irc': ['One-mode saddle and two-sided IRC', 'Global mechanism, kinetics, and recrossing', 'Negative-mode identity and distinct endpoints', 'Harmonic ZPE/IRC scope retained'],
    'geometry-case-file': ['Target → diagnostic → validation chain', 'Method/basis/environment/global-mechanism certainty', 'Cross-checked fixed dossier artifacts', 'Stationary geometry remains model- and threshold-dependent']
  });

  function dossierFingerprint(bucket, caseId) {
    const dossier = DOSSIER_TABLES[bucket]?.[caseId]; if (!dossier) return '';
    let hash = 2166136261;
    for (const character of JSON.stringify(dossier)) { hash ^= character.codePointAt(0); hash = Math.imul(hash, 16777619) >>> 0; }
    return hash.toString(36);
  }
  function makeGameState() {
    const state = { cleared: new Set(), revealed: {}, transcripts: {}, boss: { cleared: new Set(), stage: {}, budget: {}, answers: {} } };
    for (const bucket of Object.keys(MISSION_CASE_MAP)) { state[bucket] = new Set(); state.revealed[bucket] = new Set(); state.transcripts[bucket] = {}; }
    return state;
  }
  const game = makeGameState();
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const finite = value => Number.isFinite(value) ? value : 0;
  const list = value => Array.isArray(value) ? value : [];
  function validChoice(value) { return typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(value); }
  function setHidden(id, hidden) { const node = $(id); if (node) node.hidden = hidden; }
  function setResult(id, state, html) { const node = $(id); if (!node) return; node.dataset.state = state; node.innerHTML = html; }
  function deriveCleared() {
    game.cleared.clear();
    for (const [bucket, missionId] of Object.entries(MISSION_CASE_MAP)) if (CASE_IDS[bucket].every(id => game[bucket].has(id))) game.cleared.add(missionId);
    if (MISSION_IDS.slice(0, 9).every(id => game.cleared.has(id)) && CASE_IDS.boss.every(id => game.boss.cleared.has(id))) game.cleared.add('geometry-case-file');
  }
  function validateCaseTranscript(bucket, record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
    return CASE_IDS[bucket].includes(record.id) && validChoice(record.choice) && record.fingerprint === dossierFingerprint(bucket, record.id) && CONFIGS[bucket].evaluator(record.id, record.choice).correct;
  }
  function validateBossRecord(caseId, stage, answers) {
    return Number.isInteger(stage) && stage >= 0 && stage <= 2 && Array.isArray(answers) && answers.length === stage && answers.every((answer, index) => validChoice(answer) && evaluateGeometryCase(caseId, index, answer).correct);
  }
  function restoreGameState() {
    let saved = null; try { saved = JSON.parse(window.localStorage.getItem(GAME_STORAGE_KEY) || 'null'); } catch (_error) { saved = null; }
    if (!saved || typeof saved !== 'object' || Array.isArray(saved) || saved.version !== 2) { deriveCleared(); return; }
    for (const bucket of Object.keys(MISSION_CASE_MAP)) {
      for (const record of list(saved[bucket])) if (validateCaseTranscript(bucket, record)) { game[bucket].add(record.id); game.transcripts[bucket][record.id] = { choice: record.choice, fingerprint: record.fingerprint }; }
      for (const id of list(saved.revealed?.[bucket])) if (CASE_IDS[bucket].includes(id)) game.revealed[bucket].add(id);
      for (const id of game[bucket]) game.revealed[bucket].add(id);
    }
    deriveCleared();
    if (!MISSION_IDS.slice(0, 9).every(id => game.cleared.has(id))) return;
    const savedBoss = saved.boss && typeof saved.boss === 'object' && !Array.isArray(saved.boss) ? saved.boss : {};
    for (const caseId of CASE_IDS.boss) {
      if (savedBoss.fingerprints?.[caseId] !== dossierFingerprint('boss', caseId)) continue;
      const answers = list(savedBoss.answers?.[caseId]).filter(validChoice);
      if (list(savedBoss.cleared).includes(caseId) && answers.length === 3 && answers.every((answer, stage) => evaluateGeometryCase(caseId, stage, answer).correct)) { game.boss.cleared.add(caseId); game.boss.answers[caseId] = answers.slice(); game.boss.budget[caseId] = 4; continue; }
      const stage = savedBoss.stage?.[caseId];
      if (validateBossRecord(caseId, stage, answers)) { game.boss.stage[caseId] = stage; game.boss.answers[caseId] = answers.slice(); const budget = savedBoss.budget?.[caseId]; game.boss.budget[caseId] = Number.isInteger(budget) && budget >= 1 && budget <= 4 ? budget : 4; }
    }
    deriveCleared();
  }
  function saveGameState() {
    const fingerprints = Object.fromEntries(CASE_IDS.boss.map(caseId => [caseId, dossierFingerprint('boss', caseId)]));
    const state = { version: 2, revealed: {}, boss: { cleared: [...game.boss.cleared], stage: { ...game.boss.stage }, budget: { ...game.boss.budget }, answers: { ...game.boss.answers }, fingerprints } };
    for (const bucket of Object.keys(MISSION_CASE_MAP)) { state[bucket] = [...game[bucket]].map(id => ({ id, ...game.transcripts[bucket][id] })); state.revealed[bucket] = [...game.revealed[bucket]]; }
    try { window.localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(state)); } catch (_error) { /* session-only fallback */ }
  }
  function recordCase(bucket, caseId, choice) { game[bucket].add(caseId); game.transcripts[bucket][caseId] = { choice, fingerprint: dossierFingerprint(bucket, caseId) }; game.revealed[bucket].add(caseId); deriveCleared(); saveGameState(); renderGameProgress(); syncBoss(); }

  function renderNotebook() {
    const node = $('geometryNotebookList'); if (!node) return;
    const entries = MISSION_IDS.filter(id => game.cleared.has(id));
    if (!entries.length) { node.innerHTML = '<p class="help-text">No geometry evidence recorded yet.</p>'; return; }
    node.innerHTML = entries.map(id => { const [operation, omitted, diagnostic, evidence] = NOTEBOOK_ENTRIES[id]; return `<article><strong>${esc(id.replaceAll('-', ' '))}</strong><span>${esc(operation)}</span><span>${esc(omitted)}</span><span>${esc(diagnostic)}</span><span>${esc(evidence)}</span></article>`; }).join('');
  }
  let reconcilingCanonical = false;
  function rejectUnsupportedCanonicalProgress() {
    const academy = window.ProjectXCAcademy; if (!academy || reconcilingCanonical) return;
    const unsupported = academy.completedMissions(CHAPTER_ID).filter(id => MISSION_IDS.includes(id) && !game.cleared.has(id));
    if (!unsupported.length) return;
    reconcilingCanonical = true; try { unsupported.forEach(id => academy.setMission(CHAPTER_ID, id, false, MISSION_IDS)); } finally { reconcilingCanonical = false; }
  }
  function renderGameProgress() {
    rejectUnsupportedCanonicalProgress();
    document.querySelectorAll('.academy-complete[data-game-gate]').forEach(button => {
      const earned = game.cleared.has(button.dataset.mission);
      button.dataset.defaultGameLabel ||= `Complete mission · ${button.dataset.badge || button.dataset.mission}`;
      button.disabled = !earned; button.dataset.gameGate = earned ? 'earned' : 'locked';
      button.textContent = earned ? button.dataset.defaultGameLabel.replace('Complete mission', 'Record earned seal') : button.dataset.defaultGameLabel.replace('Complete mission', 'Locked seal');
      button.title = earned ? 'Laboratory evidence earned; activate to record or remove this Academy mission.' : 'Clear every neutral dossier in this laboratory to unlock its seal.';
    });
    for (const [bucket, [id, label]] of Object.entries(SCORE_LABELS)) if ($(id)) $(id).textContent = `${label} cleared: ${game[bucket].size} / ${CASE_IDS[bucket].length}`;
    if ($('geometryBossScore')) $('geometryBossScore').textContent = `Cases: ${game.boss.cleared.size} / 3 · prerequisites: ${MISSION_IDS.slice(0, 9).filter(id => game.cleared.has(id)).length} / 9`;
    renderNotebook();
  }

  let svgSerial = 0;
  function svg(body, label, height = 270) {
    const serial = ++svgSerial;
    return `<svg viewBox="0 0 680 ${height}" role="img" aria-label="${esc(label)}"><defs><pattern id="geo-hatch-${serial}" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="#fff7ed"></rect><line x1="0" y1="0" x2="0" y2="9" stroke="#ea580c" stroke-width="3"></line></pattern><marker id="geo-arrow-${serial}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#4338ca"></path></marker><marker id="geo-arrow-teal-${serial}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#0f766e"></path></marker></defs><rect width="680" height="${height}" rx="18" fill="#fbfdff"></rect>${body.replaceAll('url(#geo-hatch)', `url(#geo-hatch-${serial})`).replaceAll('url(#geo-arrow)', `url(#geo-arrow-${serial})`).replaceAll('url(#geo-arrow-teal)', `url(#geo-arrow-teal-${serial})`)}</svg>`;
  }
  function setPlot(id, html) { const node = $(id); if (node) node.innerHTML = html; }
  function matrixMarkup(matrix, x, y, title) {
    const values = validMatrix2(matrix) ? matrix : [[NaN, NaN], [NaN, NaN]];
    return `<text x="${x + 82}" y="${y + 18}" text-anchor="middle" class="geometry-plot-title">${esc(title)}</text><path class="geometry-bracket" d="M${x + 20},${y + 30} h-10 v80 h10 M${x + 145},${y + 30} h10 v80 h-10"></path>${values.map((row, i) => row.map((value, j) => `<text x="${x + 48 + j * 70}" y="${y + 58 + i * 36}" text-anchor="middle" class="geometry-matrix-value">${Number.isFinite(value) ? value.toFixed(3) : 'invalid'}</text>`).join('')).join('')}`;
  }
  function linePath(points, xMap, yMap) { return points.map((point, index) => `${index ? 'L' : 'M'}${xMap(point, index)},${yMap(point, index)}`).join(' '); }
  function isRevealed(bucket, id) { return game.revealed[bucket].has(id) || game[bucket].has(id); }

  function renderPes() {
    const id = $('pesCase')?.value || CASE_IDS.pes[0]; const item = PES_DOSSIERS[id]; const state = quadraticSurface(item.model, item.point); const revealed = isRevealed('pes', id);
    if ($('pesConstraint')) $('pesConstraint').textContent = `q=[${item.point.map(v => v.toFixed(2)).join(', ')}], l=[${item.model.linear.map(v => v.toFixed(2)).join(', ')}], H=[[${item.model.hessian[0].join(', ')}],[${item.model.hessian[1].join(', ')}]]; force = −gradient.`;
    const contours = [55, 82, 109, 136].map((radius, index) => `<ellipse cx="340" cy="138" rx="${radius * 1.65}" ry="${radius * 0.72}" class="geometry-contour c${index}"></ellipse>`).join('');
    const gx = state.gradient[0] * 55; const gy = -state.gradient[1] * 55; const fx = state.force[0] * 55; const fy = -state.force[1] * 55;
    const arrows = `<path class="geometry-vector coral" marker-end="url(#geo-arrow)" d="M340,138 L${340 + gx},${138 + gy}"></path><text x="${350 + gx}" y="${132 + gy}" class="geometry-label">∇E</text>${revealed ? `<path class="geometry-vector teal" marker-end="url(#geo-arrow-teal)" d="M340,138 L${340 + fx},${138 + fy}"></path><text x="${350 + fx}" y="${152 + fy}" class="geometry-oracle">F</text>` : ''}`;
    setPlot('pesPlot', svg(`${contours}<line class="geometry-axis" x1="70" x2="610" y1="138" y2="138"></line><line class="geometry-axis" x1="340" x2="340" y1="35" y2="235"></line><circle class="geometry-point" cx="340" cy="138" r="8"></circle>${arrows}<text x="340" y="258" text-anchor="middle" class="${revealed ? 'geometry-oracle' : 'geometry-muted'}">${revealed ? `∇E=[${state.gradient.map(v => v.toFixed(3)).join(', ')}] · F=[${state.force.map(v => v.toFixed(3)).join(', ')}]` : 'Commit to reveal the force certificate'}</text>`, 'quadratic potential-energy contours with gradient and force'));
    setHidden('pesOracleKey', !revealed);
  }
  function renderGradient() {
    const id = $('gradientCase')?.value || CASE_IDS.gradient[0]; const item = GRADIENT_DOSSIERS[id]; const result = stationaryGradientLedger(item); const revealed = isRevealed('gradient', id);
    if ($('gradientConstraint')) $('gradientConstraint').textContent = `ENNˣ=${item.nuclear.toFixed(3)}, E1eˣ=${item.oneElectron.toFixed(3)}, E2eˣ=${item.twoElectron.toFixed(3)}, −Tr[X Sˣ]=${item.overlapPulay.toFixed(3)} Ha/bohr; SCF residual=${item.scfResidual.toExponential(1)}, gate=1.0e−7.`;
    const terms = [['NN', item.nuclear, '#c7d2fe'], ['1e', item.oneElectron, '#fda4af'], ['2e', item.twoElectron, '#fde68a'], ['Pulay', item.overlapPulay, 'url(#geo-hatch)']];
    const bars = terms.map(([name, value, fill], index) => { const height = Math.abs(value) * 220; const y = value >= 0 ? 135 - height : 135; return `<rect x="${100 + index * 120}" y="${y}" width="72" height="${height}" fill="${fill}" stroke="#334155" stroke-width="2"></rect><text x="${136 + index * 120}" y="250" text-anchor="middle">${name}</text><text x="${136 + index * 120}" y="${value >= 0 ? y - 7 : y + height + 14}" text-anchor="middle">${value.toFixed(3)}</text>`; }).join('');
    setPlot('gradientPlot', svg(`<line class="geometry-axis" x1="65" x2="615" y1="135" y2="135"></line>${bars}<text x="340" y="28" text-anchor="middle" class="${revealed ? 'geometry-oracle' : 'geometry-muted'}">${revealed ? `total=${result.total.toFixed(3)} Ha/bohr · without Pulay=${result.withoutPulay.toFixed(3)} · stationary=${result.stationary ? 'yes' : 'no'}` : 'All terms visible; signed total sealed'}</text>`, 'stationary analytic-gradient contribution ledger'));
    setHidden('gradientOracleKey', !revealed);
  }
  function renderValidation() {
    const id = $('validationCase')?.value || CASE_IDS.validation[0]; const item = VALIDATION_DOSSIERS[id]; const result = evaluateValidationMission(id, ''); const revealed = isRevealed('validation', id);
    if ($('validationConstraint')) $('validationConstraint').textContent = `E(x)=Σ aₙxⁿ with a=[${item.coefficients.join(', ')}], x=${item.coordinate}, selected h=${item.step.toExponential(1)}.`;
    const steps = Array.from({ length: 37 }, (_, index) => 10 ** (-15 + index * 14 / 36));
    const analytic = polynomialDerivative(item.coefficients, item.coordinate);
    const errors = steps.map(step => Math.max(1e-17, Math.abs(centralDifferenceDerivative(value => polynomialEnergy(item.coefficients, value), item.coordinate, step) - analytic)));
    const xMap = step => 70 + (Math.log10(step) + 15) * 520 / 14; const yMap = error => 220 - (Math.log10(error) + 17) * 165 / 16;
    const selectedX = xMap(item.step); const selectedY = yMap(Math.max(1e-17, result.error));
    setPlot('validationPlot', svg(`<line class="geometry-axis" x1="70" x2="590" y1="220" y2="220"></line><line class="geometry-axis" x1="70" x2="70" y1="45" y2="220"></line><path class="geometry-curve indigo" d="${linePath(steps, xMap, (_, i) => yMap(errors[i]))}"></path><text x="80" y="42">cancellation</text><text x="585" y="42" text-anchor="end">truncation</text>${revealed ? `<circle class="geometry-point teal" cx="${selectedX}" cy="${selectedY}" r="8"></circle><text x="340" y="256" text-anchor="middle" class="geometry-oracle">analytic=${result.analytic.toFixed(8)} · central=${result.numeric.toFixed(8)} · |error|=${result.error.toExponential(2)}</text>` : '<text x="340" y="256" text-anchor="middle" class="geometry-muted">Commit to mark the selected step and error</text>'}`, 'central finite-difference error versus step size'));
    setHidden('validationOracleKey', !revealed);
  }
  function renderOptimization() {
    const id = $('optimizationCase')?.value || CASE_IDS.optimization[0]; const item = OPTIMIZATION_DOSSIERS[id]; const revealed = isRevealed('optimization', id); const steepest = optimizationStep(item.gradient, item.hessian, 'steepest', { stepSize: 0.15, trustRadius: item.trustRadius }); const newton = optimizationStep(item.gradient, item.hessian, 'newton', { trustRadius: item.trustRadius }); const inertia = hessianInertia(item.hessian, 1e-6);
    if ($('optimizationConstraint')) $('optimizationConstraint').textContent = `g=[${item.gradient.join(', ')}], H=[[${item.hessian[0].join(', ')}],[${item.hessian[1].join(', ')}]], trust radius Δ=${item.trustRadius.toFixed(2)}.`;
    const arrow = (step, cls, label, marker) => step?.valid ? `<path class="geometry-vector ${cls}" marker-end="${marker}" d="M340,145 L${340 + step.step[0] * 100},${145 - step.step[1] * 100}"></path><text x="${350 + step.step[0] * 100}" y="${137 - step.step[1] * 100}">${label}</text>` : '';
    setPlot('optimizationPlot', svg(`<circle cx="340" cy="145" r="${Math.min(110, item.trustRadius * 90)}" class="geometry-trust-circle"></circle><line class="geometry-axis" x1="80" x2="600" y1="145" y2="145"></line><line class="geometry-axis" x1="340" x2="340" y1="35" y2="235"></line>${arrow(steepest, 'indigo', 'SD', 'url(#geo-arrow)')}${arrow(newton, 'coral', 'N', 'url(#geo-arrow)')}<text x="340" y="258" text-anchor="middle" class="${revealed ? 'geometry-oracle' : 'geometry-muted'}">${revealed ? `inertia (−,0,+)=(${inertia.negative},${inertia.nearZero},${inertia.positive}) · ΔEpred(N)=${newton.valid ? newton.predictedChange.toFixed(3) : 'invalid'}` : 'Both proposals visible; curvature certificate sealed'}</text>`, 'steepest-descent and trust-limited Newton step plane'));
    setHidden('optimizationOracleKey', !revealed);
  }
  function renderTrust() {
    const id = $('trustCase')?.value || CASE_IDS.trust[0]; const item = TRUST_DOSSIERS[id]; const revealed = isRevealed('trust', id); const update = bfgsUpdate(item.hessian, item.displacement, item.gradientChange); const ratio = trustRatio(item.actualReduction, item.predictedReduction, item.boundary);
    if ($('trustConstraint')) $('trustConstraint').textContent = `s=[${item.displacement.join(', ')}], y=[${item.gradientChange.join(', ')}], actual reduction=${item.actualReduction.toFixed(2)}, predicted=${item.predictedReduction.toFixed(2)}, boundary=${item.boundary ? 'yes' : 'no'}.`;
    const origin = [260, 180]; const vector = (values, cls, label, marker) => `<path class="geometry-vector ${cls}" marker-end="${marker}" d="M${origin[0]},${origin[1]} L${origin[0] + values[0] * 100},${origin[1] - values[1] * 80}"></path><text x="${origin[0] + values[0] * 105}" y="${origin[1] - values[1] * 84}">${label}</text>`;
    setPlot('trustPlot', svg(`<line class="geometry-axis" x1="75" x2="610" y1="180" y2="180"></line><line class="geometry-axis" x1="260" x2="260" y1="45" y2="225"></line>${vector(item.displacement, 'indigo', 's', 'url(#geo-arrow)')}${vector(item.gradientChange, 'coral', 'y', 'url(#geo-arrow)')}<rect x="455" y="82" width="150" height="92" rx="12" class="geometry-ledger-box"></rect><text x="530" y="110" text-anchor="middle">actual / predicted</text><text x="530" y="142" text-anchor="middle" class="geometry-plot-title">${item.actualReduction.toFixed(2)} / ${item.predictedReduction.toFixed(2)}</text><text x="340" y="255" text-anchor="middle" class="${revealed ? 'geometry-oracle' : 'geometry-muted'}">${revealed ? `sᵀy=${finite(update.curvature).toFixed(3)} · ρ=${ratio.valid ? ratio.ratio.toFixed(3) : 'invalid'} · ${update.valid ? ratio.action : 'skip update'}` : 'Commit to reveal curvature and trust certificates'}</text>`, 'BFGS secant vectors and trust reduction ratio'));
    setHidden('trustOracleKey', !revealed);
  }
  function renderHessian() {
    const id = $('hessianCase')?.value || CASE_IDS.hessian[0]; const item = HESSIAN_DOSSIERS[id]; const revealed = isRevealed('hessian', id); const inertia = hessianInertia(item.hessian, item.tolerance);
    if ($('hessianConstraint')) $('hessianConstraint').textContent = `H=[[${item.hessian[0].join(', ')}],[${item.hessian[1].join(', ')}]], eigenvalue zero tolerance=${item.tolerance.toExponential(1)}.`;
    const vectors = inertia.valid ? inertia.values.map((value, mode) => { const vx = inertia.vectors[0][mode]; const vy = inertia.vectors[1][mode]; return `<path class="geometry-vector ${value < -item.tolerance ? 'coral' : 'indigo'} ${mode ? 'dashed' : ''}" marker-end="url(#geo-arrow)" d="M480,135 L${480 + vx * 95},${135 - vy * 95}"></path><text x="${490 + vx * 100}" y="${130 - vy * 100}">λ${mode + 1}</text>`; }).join('') : '<text x="480" y="140" text-anchor="middle" class="geometry-muted">asymmetric</text>';
    setPlot('hessianPlot', svg(`${matrixMarkup(item.hessian, 85, 65, 'Hessian H')}<line class="geometry-axis" x1="365" x2="625" y1="135" y2="135"></line><line class="geometry-axis" x1="480" x2="480" y1="45" y2="225"></line>${vectors}<text x="340" y="255" text-anchor="middle" class="${revealed ? 'geometry-oracle' : 'geometry-muted'}">${revealed ? (inertia.valid ? `eigenvalues=[${inertia.values.map(v => v.toExponential(2)).join(', ')}] · inertia=(${inertia.negative},${inertia.nearZero},${inertia.positive})` : `rejected: symmetry residual ${inertia.symmetryResidual.toExponential(2)}`) : 'Commit to reveal eigenvalues and inertia'}</text>`, 'Hessian matrix and curvature eigen-directions'));
    setHidden('hessianOracleKey', !revealed);
  }
  function renderModes() {
    const id = $('modesCase')?.value || CASE_IDS.modes[0]; const item = MODE_DOSSIERS[id]; const revealed = isRevealed('modes', id); const modes = normalModes2(item.hessian, item.masses);
    if ($('modesConstraint')) $('modesConstraint').textContent = `H=[[${item.hessian[0].join(', ')}],[${item.hessian[1].join(', ')}]], masses=[${item.masses.join(', ')}]; require mᵢ>0.`;
    const massRadius = mass => Number.isFinite(mass) && mass > 0 ? 20 + 7 * Math.sqrt(mass) : 24;
    let arrows = '';
    if (revealed && modes.valid) { const stretch = modes.cartesianVectors[1]; arrows = `<path class="geometry-vector teal" marker-end="url(#geo-arrow-teal)" d="M235,140 L${235 + stretch[0] * 70},140"></path><path class="geometry-vector teal" marker-end="url(#geo-arrow-teal)" d="M445,140 L${445 + stretch[1] * 70},140"></path>`; }
    setPlot('modesPlot', svg(`<line x1="260" x2="420" y1="140" y2="140" class="geometry-spring"></line><circle cx="235" cy="140" r="${massRadius(item.masses[0])}" class="geometry-mass indigo"></circle><circle cx="445" cy="140" r="${massRadius(item.masses[1])}" class="geometry-mass coral"></circle><text x="235" y="145" text-anchor="middle">m₁</text><text x="445" y="145" text-anchor="middle">m₂</text>${arrows}<text x="340" y="55" text-anchor="middle">M⁻¹ᐟ² H M⁻¹ᐟ²</text><text x="340" y="235" text-anchor="middle" class="${revealed ? 'geometry-oracle' : 'geometry-muted'}">${revealed ? (modes.valid ? `λ=[${modes.values.map(v => v.toFixed(4)).join(', ')}] · stretch analytic=${(1 / item.masses[0] + 1 / item.masses[1]).toFixed(4)}` : 'rejected: every mass must be positive') : 'Commit to reveal translation/stretch certificate'}</text>`, 'finite diatomic mass-weighted translation and stretch modes'));
    setHidden('modesOracleKey', !revealed);
  }
  function renderStationary() {
    const id = $('stationaryCase')?.value || CASE_IDS.stationary[0]; const item = STATIONARY_DOSSIERS[id]; const revealed = isRevealed('stationary', id); const audit = stationaryPointAudit(item); const realFrequencies = item.eigenvalues.filter(value => value > item.tolerance).map(value => Math.sqrt(value) * 1000); const zpe = zpeKcalMol(realFrequencies);
    if ($('stationaryConstraint')) $('stationaryConstraint').textContent = `||g||=${vectorNorm(item.gradient).toExponential(2)} (gate 1.0e−4), eigenvalues=[${item.eigenvalues.map(v => v.toExponential(2)).join(', ')}], zero tolerance=${item.tolerance.toExponential(1)}, N=${item.atomCount} ${item.linear ? 'linear' : 'nonlinear'} → expected modes=${3 * item.atomCount - (item.linear ? 5 : 6)}; ZPE uses real modes only.`;
    const zeroY = 150; const bars = item.eigenvalues.map((value, index) => { const height = Math.min(105, Math.abs(value) * 70); const x = 145 + index * 170; const y = value >= 0 ? zeroY - height : zeroY; return `<line x1="${x}" x2="${x + 80}" y1="${y}" y2="${y}" class="geometry-frequency ${value < -item.tolerance ? 'coral dashed' : Math.abs(value) <= item.tolerance ? 'amber dotted' : 'indigo'}"></line><text x="${x + 40}" y="${value >= 0 ? y - 10 : y + 25}" text-anchor="middle">${value.toExponential(1)}</text>`; }).join('');
    setPlot('stationaryPlot', svg(`<line class="geometry-axis" x1="70" x2="610" y1="${zeroY}" y2="${zeroY}"></line>${bars}<text x="72" y="143">λ=0</text><text x="340" y="245" text-anchor="middle" class="${revealed ? 'geometry-oracle' : 'geometry-muted'}">${revealed ? `${audit.kind.replaceAll('-', ' ')} · inertia negative=${audit.negative}, near-zero=${audit.nearZero} · harmonic ZPE=${zpe.toFixed(3)} kcal/mol` : 'Commit to reveal classification and harmonic ZPE'}</text>`, 'vibrational curvature spectrum and stationary-point classification'));
    setHidden('stationaryOracleKey', !revealed);
  }
  function renderIrc() {
    const id = $('ircCase')?.value || CASE_IDS.irc[0]; const item = IRC_DOSSIERS[id]; const revealed = isRevealed('irc', id); const saddle = doubleWellSurface([0, 0], item.parameters); const inertia = hessianInertia(saddle.hessian, 1e-6); const plus = traceIrc(1, item.parameters); const minus = traceIrc(-1, item.parameters); const endpoints = auditIrcEndpoints(plus.points, minus.points); const barrier = zpeCorrectedBarrier(item.electronicBarrierKcalMol, 0, [500, 1000], [600, 900, 1100]);
    if ($('ircConstraint')) $('ircConstraint').textContent = `Finite dossier: x,y dimensionless and electronic E in kcal/mol (barrier=${item.electronicBarrierKcalMol.toFixed(3)} kcal/mol). Saddle H=[[${saddle.hessian[0].join(', ')}],[${saddle.hessian[1].join(', ')}]] kcal/mol per coordinate²; significant negative modes=${inertia.negative}; requested branches=${item.directions}; imaginary mode excluded from TS ZPE.`;
    const xs = Array.from({ length: 101 }, (_, i) => -1.4 + 2.8 * i / 100); const energies = xs.map(x => doubleWellSurface([x, 0], item.parameters).energy); const xMap = x => 70 + (x + 1.4) * 540 / 2.8; const yMap = energy => 220 - Math.max(-0.2, Math.min(2.2, energy)) * 75;
    const branches = revealed && item.directions === 2 ? `<path class="geometry-curve coral dashed" d="${linePath(plus.points, point => xMap(point[0]), point => yMap(doubleWellSurface(point, item.parameters).energy))}"></path><path class="geometry-curve teal" d="${linePath(minus.points, point => xMap(point[0]), point => yMap(doubleWellSurface(point, item.parameters).energy))}"></path>` : '';
    setPlot('ircPlot', svg(`<line class="geometry-axis" x1="70" x2="610" y1="220" y2="220"></line><path class="geometry-curve indigo" d="${linePath(xs, xMap, (_, i) => yMap(energies[i]))}"></path><circle class="geometry-point coral" cx="${xMap(0)}" cy="${yMap(1)}" r="8"></circle>${branches}<text x="${xMap(-1)}" y="238" text-anchor="middle">minimum A</text><text x="${xMap(1)}" y="238" text-anchor="middle">minimum B</text><text x="340" y="25" text-anchor="middle" class="${revealed ? 'geometry-oracle' : 'geometry-muted'}">${revealed ? `inertia negatives=${inertia.negative} · endpoints distinct=${endpoints.distinct ? 'yes' : 'no'} · ΔE‡+ΔZPE=${barrier.toFixed(3)} kcal/mol` : 'Saddle and requested branches visible; connectivity sealed'}</text>`, 'double-well surface and two-sided intrinsic reaction paths'));
    setHidden('ircOracleKey', !revealed);
  }

  const CONFIGS = Object.freeze({
    pes: { select: 'pesCase', decision: 'pesDecision', readout: 'pesReadout', audit: 'pesAudit', evaluator: evaluatePesMission, render: renderPes },
    gradient: { select: 'gradientCase', decision: 'gradientDecision', readout: 'gradientReadout', audit: 'gradientAudit', evaluator: evaluateGradientMission, render: renderGradient },
    validation: { select: 'validationCase', decision: 'validationDecision', readout: 'validationReadout', audit: 'validationAudit', evaluator: evaluateValidationMission, render: renderValidation },
    optimization: { select: 'optimizationCase', decision: 'optimizationDecision', readout: 'optimizationReadout', audit: 'optimizationAudit', evaluator: evaluateOptimizationMission, render: renderOptimization },
    trust: { select: 'trustCase', decision: 'trustDecision', readout: 'trustReadout', audit: 'trustAudit', evaluator: evaluateTrustMission, render: renderTrust },
    hessian: { select: 'hessianCase', decision: 'hessianDecision', readout: 'hessianReadout', audit: 'hessianAudit', evaluator: evaluateHessianMission, render: renderHessian },
    modes: { select: 'modesCase', decision: 'modesDecision', readout: 'modesReadout', audit: 'modesAudit', evaluator: evaluateModesMission, render: renderModes },
    stationary: { select: 'stationaryCase', decision: 'stationaryDecision', readout: 'stationaryReadout', audit: 'stationaryAudit', evaluator: evaluateStationaryMission, render: renderStationary },
    irc: { select: 'ircCase', decision: 'ircDecision', readout: 'ircReadout', audit: 'ircAudit', evaluator: evaluateIrcMission, render: renderIrc }
  });
  function resultDetails(bucket, result) {
    if (bucket === 'pes') return `Gradient=[${result.state.gradient.map(v => v.toFixed(3)).join(', ')}], force=[${result.state.force.map(v => v.toFixed(3)).join(', ')}].`;
    if (bucket === 'gradient') return `Total derivative=${result.ledger.total.toFixed(3)} Ha/bohr; without Pulay=${result.ledger.withoutPulay.toFixed(3)}; stationary gate=${result.ledger.stationary ? 'pass' : 'fail'}.`;
    if (bucket === 'validation') return `Analytic=${result.analytic.toFixed(8)}, central=${result.numeric.toFixed(8)}, |error|=${result.error.toExponential(2)}.`;
    if (bucket === 'optimization') return `Hessian inertia (−,0,+)=(${result.inertia.negative},${result.inertia.nearZero},${result.inertia.positive}); Newton predicted change=${result.newton.valid ? result.newton.predictedChange.toFixed(3) : 'invalid'}.`;
    if (bucket === 'trust') return `sᵀy=${finite(result.update.curvature).toFixed(3)}; ρ=${result.trust.valid ? result.trust.ratio.toFixed(3) : 'invalid'}.`;
    if (bucket === 'hessian') return result.inertia.valid ? `Eigenvalues=[${result.inertia.values.map(v => v.toExponential(2)).join(', ')}]; inertia=(${result.inertia.negative},${result.inertia.nearZero},${result.inertia.positive}).` : `Hessian symmetry residual=${finite(result.inertia.symmetryResidual).toExponential(2)}.`;
    if (bucket === 'modes') return result.modes.valid ? `Mass-weighted eigenvalues=[${result.modes.values.map(v => v.toFixed(4)).join(', ')}].` : 'Nonpositive masses invalidate mass weighting.';
    if (bucket === 'stationary') return `Gradient norm=${result.audit.gradientNorm.toExponential(2)}; negative=${result.audit.negative}; near-zero=${result.audit.nearZero}; expected modes=${result.audit.expectedModeCount}.`;
    if (bucket === 'irc') return `Saddle negative modes=${result.inertia.negative}; ${result.endpoints ? `distinct endpoints=${result.endpoints.distinct ? 'yes' : 'no'}` : 'two branches not certified'}.`;
    return '';
  }
  function auditBucket(bucket) {
    const config = CONFIGS[bucket]; const caseId = $(config.select)?.value || CASE_IDS[bucket][0]; const choice = $(config.decision)?.value || '';
    if (!choice) return setResult(config.readout, 'needs-work', '<strong>Commit a decision.</strong> Empty submissions do not spend an attempt.');
    const result = config.evaluator(caseId, choice); game.revealed[bucket].add(caseId); config.render(); const details = resultDetails(bucket, result);
    if (!result.correct) { saveGameState(); return setResult(config.readout, 'needs-work', `<strong>Decision rejected.</strong> ${esc(details)} Revise the interpretation; no answer slug is revealed.`); }
    recordCase(bucket, caseId, choice); setResult(config.readout, 'success', `<strong>Evidence accepted.</strong> ${esc(details)} ${game[bucket].size === CASE_IDS[bucket].length ? 'This laboratory seal is now earned.' : 'Inspect the next neutral dossier.'}`);
  }

  function bossPrerequisites() { return MISSION_IDS.slice(0, 9).every(id => game.cleared.has(id)); }
  function bossArtifact(caseId, stage, cleared) {
    const file = GEOMETRY_CASE_FILES[caseId];
    if (cleared) return `<p><strong>Closed dossier.</strong> Target ${esc(file.target)}; gradient norm ${finite(file.gradientNorm).toExponential(2)}. Validation remains attached to the method/basis/environment caveat.</p>`;
    if (stage === 0) return `<p><strong>Target artifact:</strong> requested study=${esc(file.target)}; current gradient norm=${finite(file.gradientNorm).toExponential(2)}. Choose the workflow that matches the scientific target.</p>`;
    if (stage === 1) {
      if (file.target === 'minimum') return `<p><strong>Diagnostic artifact:</strong> negative modes=${file.negativeModes}; analytic/finite-difference gradient mismatch=${file.finiteDifferenceError.toExponential(2)}.</p>`;
      if (file.target === 'transition-state') return `<p><strong>Diagnostic artifact:</strong> negative modes=${file.negativeModes}; imaginary-mode/reaction-vector overlap=${file.reactionModeOverlap.toFixed(2)}.</p>`;
      return `<p><strong>Diagnostic artifact:</strong> lowest eigenvalue=${file.lowestEigenvalue.toExponential(2)}; zero tolerance=${file.tolerance.toExponential(1)}; external-mode overlap=${file.externalModeOverlap.toFixed(2)}.</p>`;
    }
    return `<p><strong>Validation design:</strong> select evidence that directly tests the target and dominant risk. Retain method, basis, numerical, coordinate, harmonic, and connectivity limits.</p>`;
  }
  function syncBoss() {
    const caseId = $('geometryBossCase')?.value || CASE_IDS.boss[0]; const cleared = game.boss.cleared.has(caseId); const stage = cleared ? 3 : (game.boss.stage[caseId] || 0); const budget = game.boss.budget[caseId] || 4; const ready = bossPrerequisites(); const controls = [$('geometryBossTarget'), $('geometryBossDiagnostic'), $('geometryBossEvidence')]; const answers = game.boss.answers[caseId] || [];
    if ($('geometryBossArtifactTitle')) $('geometryBossArtifactTitle').textContent = cleared ? 'Closed dossier artifact' : `Case ${caseId.slice(-1).toUpperCase()} · stage ${Math.min(stage + 1, 3)} artifact`;
    if ($('geometryBossArtifact')) $('geometryBossArtifact').innerHTML = ready ? bossArtifact(caseId, stage, cleared) : '<p>Earn Levels 1–9 to open this fixed dossier. Canonical progress without chapter evidence cannot unlock it.</p>';
    if ($('geometryBossStage')) $('geometryBossStage').textContent = cleared ? 'Dossier cleared · caveat retained' : `Stage ${stage + 1} / 3 · ${['target/workflow', 'dominant diagnostic', 'validation package'][stage]}`;
    if ($('geometryBossBudget')) $('geometryBossBudget').textContent = `Evidence budget: ${budget} attempt${budget === 1 ? '' : 's'}`;
    controls.forEach((control, index) => { if (!control) return; if (index < stage || cleared) control.value = answers[index] || ''; else if (index > stage) control.value = ''; control.disabled = !ready || cleared || index !== stage; });
    if ($('geometryBossAudit')) $('geometryBossAudit').disabled = !ready || cleared;
    if (!ready) setResult('geometryBossFeedback', 'neutral', 'Earn Levels 1–9 before opening the final board.');
    else if (cleared) setResult('geometryBossFeedback', 'success', '<strong>Dossier already cleared.</strong> Its evidence and caveat remain visible.');
    else setResult('geometryBossFeedback', 'neutral', `Stage ${stage + 1}: commit the ${['target/workflow', 'dominant diagnostic', 'validation package'][stage]}. Later fields stay locked.`);
    renderGameProgress();
  }
  function resetBossCase() {
    const caseId = $('geometryBossCase')?.value || CASE_IDS.boss[0]; game.boss.cleared.delete(caseId); game.boss.stage[caseId] = 0; game.boss.budget[caseId] = 4; delete game.boss.answers[caseId]; for (const id of ['geometryBossTarget', 'geometryBossDiagnostic', 'geometryBossEvidence']) if ($(id)) $(id).value = ''; deriveCleared(); saveGameState(); syncBoss();
  }
  function auditBoss() {
    if (!bossPrerequisites()) return setResult('geometryBossFeedback', 'needs-work', '<strong>Board locked.</strong> Earn all nine prerequisite laboratories first.');
    const caseId = $('geometryBossCase')?.value || CASE_IDS.boss[0]; if (game.boss.cleared.has(caseId)) return;
    const stage = game.boss.stage[caseId] || 0; const controlIds = ['geometryBossTarget', 'geometryBossDiagnostic', 'geometryBossEvidence']; const choice = $(controlIds[stage])?.value || '';
    if (!choice) return setResult('geometryBossFeedback', 'needs-work', '<strong>Commit the unlocked stage.</strong> Empty submissions do not spend an attempt.');
    const result = evaluateGeometryCase(caseId, stage, choice);
    if (!result.correct) { const nextBudget = (game.boss.budget[caseId] || 4) - 1; const exhausted = nextBudget <= 0; game.boss.budget[caseId] = exhausted ? 4 : nextBudget; if (exhausted) { game.boss.stage[caseId] = 0; delete game.boss.answers[caseId]; for (const id of controlIds) if ($(id)) $(id).value = ''; } saveGameState(); syncBoss(); return setResult('geometryBossFeedback', 'needs-work', `<strong>Commitment rejected${exhausted ? '; dossier reset' : ''}.</strong> Re-read the visible artifact. No answer slug is revealed.`); }
    const answers = game.boss.answers[caseId] || []; answers[stage] = choice; answers.length = stage + 1; game.boss.answers[caseId] = answers; game.boss.stage[caseId] = stage + 1;
    if (stage + 1 === 3) { game.boss.cleared.add(caseId); game.boss.budget[caseId] = 4; deriveCleared(); saveGameState(); syncBoss(); setResult('geometryBossFeedback', 'success', '<strong>Dossier cleared.</strong> The evidence chain and surviving caveat remain visible.'); return; }
    saveGameState(); syncBoss(); setResult('geometryBossFeedback', 'success', '<strong>Stage accepted.</strong> Inspect the newly opened artifact and commit the next field.');
  }

  function resetGameState() {
    game.cleared.clear(); for (const bucket of Object.keys(MISSION_CASE_MAP)) { game[bucket].clear(); game.revealed[bucket].clear(); game.transcripts[bucket] = {}; } game.boss.cleared.clear(); game.boss.stage = {}; game.boss.budget = {}; game.boss.answers = {};
    try { window.localStorage.removeItem(GAME_STORAGE_KEY); } catch (_error) { /* ignore */ }
    window.ProjectXCAcademy?.resetChapter(CHAPTER_ID);
    for (const [bucket, config] of Object.entries(CONFIGS)) { if ($(config.select)) $(config.select).value = CASE_IDS[bucket][0]; if ($(config.decision)) $(config.decision).value = ''; setResult(config.readout, 'neutral', 'Fresh chapter state restored; commit the displayed dossier to reveal its certificate.'); config.render(); }
    if ($('geometryBossCase')) $('geometryBossCase').value = CASE_IDS.boss[0]; for (const id of ['geometryBossTarget', 'geometryBossDiagnostic', 'geometryBossEvidence']) if ($(id)) $(id).value = ''; syncBoss(); renderGameProgress();
  }
  function bindLessonKeyboardNavigation() {
    const buttons = [...document.querySelectorAll('.academy-lesson-nav button[data-step]')];
    buttons.forEach((button, index) => button.addEventListener('keydown', event => { if (event.repeat) return; let next = null; if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % buttons.length; if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length; if (event.key === 'Home') next = 0; if (event.key === 'End') next = buttons.length - 1; if (next === null) return; event.preventDefault(); buttons[next].focus(); }));
  }
  function init() {
    restoreGameState();
    for (const [bucket, config] of Object.entries(CONFIGS)) { $(config.select)?.addEventListener('change', () => { if ($(config.decision)) $(config.decision).value = ''; config.render(); }); $(config.audit)?.addEventListener('click', () => auditBucket(bucket)); config.render(); }
    $('geometryBossCase')?.addEventListener('change', () => { for (const id of ['geometryBossTarget', 'geometryBossDiagnostic', 'geometryBossEvidence']) if ($(id)) $(id).value = ''; syncBoss(); });
    $('geometryBossAudit')?.addEventListener('click', auditBoss); $('geometryResetBossCase')?.addEventListener('click', resetBossCase);
    syncBoss(); window.ProjectXCAcademy?.bindChapter({ chapterId: CHAPTER_ID, totalMissions: 10 }); window.addEventListener('project-xc-academy-progress', renderGameProgress); renderGameProgress();
    document.querySelectorAll('.academy-complete[data-game-gate]').forEach(button => { button.addEventListener('click', event => { if (game.cleared.has(button.dataset.mission)) return; event.preventDefault(); event.stopImmediatePropagation(); renderGameProgress(); const heading = button.closest('.academy-lesson')?.querySelector('h2'); if (heading) { heading.tabIndex = -1; heading.focus(); } }, true); button.addEventListener('click', () => window.setTimeout(() => { renderGameProgress(); if (button.disabled) { const heading = button.closest('.academy-lesson')?.querySelector('h2'); if (heading) { heading.tabIndex = -1; heading.focus(); } } }, 0)); });
    $('resetChapterProgress')?.addEventListener('click', resetGameState); bindLessonKeyboardNavigation();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
