(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const radians = degrees => degrees * Math.PI / 180;
  const degrees = angle => angle * 180 / Math.PI;
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  const finite = (...values) => values.every(Number.isFinite);

  const PASSPORT_CASES = Object.freeze({
    'gaussian-family': {
      title: 'Run A · Energy drops, then stalls',
      brief: 'Observed: the normalized trial energy has a stable minimum, but adding non-Gaussian directions has not yet been tested.',
      method: 'variational',
      layer: 'ansatz',
      diagnostic: 'Rayleigh upper bound and stationarity',
      diagnosticStamp: 'Rayleigh + stationarity',
      evidenceStamp: 'Enlarge trial family',
      evidence: 'Show normalization, the Rayleigh upper bound, a stable minimum, and what happens when the trial family is enlarged.',
      caveat: 'A variational upper bound does not by itself guarantee an accurate wavefunction or an accurate energy difference.'
    },
    'six-site-subspace': {
      title: 'Run B · Roots drift as coordinates are added',
      brief: 'Observed: the lowest value decreases as coordinate directions are added, while a residual remains outside the current space.',
      method: 'representation-truncation',
      layer: 'representation',
      diagnostic: 'Nested Ritz energy and external residual',
      diagnosticStamp: 'Ritz + external residual',
      evidenceStamp: 'Nested finite oracle',
      evidence: 'Use nested spaces, monotone Ritz energies, an external residual, and comparison with the declared six-site oracle.',
      caveat: 'Convergence to the full six-site matrix is not convergence to a continuum or complete-basis-set limit.'
    },
    'weak-two-level': {
      title: 'Run C · Two retained orders nearly agree',
      brief: 'Observed: two truncated energy formulas are close at the current coupling, but no order scan or finite oracle has yet been shown.',
      method: 'perturbation',
      layer: 'series-truncation',
      diagnostic: 'Coupling-to-gap ratio and retained-order drift',
      diagnosticStamp: '|λV/Δ| + order drift',
      evidenceStamp: 'Order scan + exact 2×2',
      evidence: 'Inspect the coupling-to-gap ratio and compare successive retained orders against exact diagonalization in this finite model.',
      caveat: 'A small ratio is a local diagnostic, not a universal proof that every observable or geometry is converged.'
    },
    'harmonic-replacement': {
      title: 'Run D · Solver converges, transfer fails',
      brief: 'Observed: a quadratic Hamiltonian is solved to a tiny residual, yet predictions drift away from an anharmonic benchmark off equilibrium.',
      method: 'model-replacement',
      layer: 'model',
      diagnostic: 'Transfer against the omitted anharmonic physics',
      diagnosticStamp: 'Transfer test',
      evidenceStamp: 'Anharmonic benchmark',
      evidence: 'Benchmark against the omitted anharmonic Hamiltonian over the coordinate and energy range relevant to the intended prediction.',
      caveat: 'Solving the quadratic replacement exactly removes solver error but does not remove the omitted-physics model error.'
    }
  });

  const CAMPAIGN_CASES = Object.freeze({
    'ground-upper-bound': {
      title: 'Dossier A · Three refinements, one claim',
      brief: 'Initial brief: three increasingly costly runs report E=0.586 → 0.382 → 0.268 while an unresolved-coupling measure falls 0.500 → 0.372 → 0.289. Choose the analysis framework before requesting the next artifact.',
      expected: { method: 'variational-ritz', diagnostic: 'rayleigh-residual', evidence: 'nested-convergence' },
      artifacts: [
        'Artifact unlocked: E(n) decreases 0.586 → 0.382 → 0.268 as a nested space grows; this pattern is consistent with a finite Ritz sequence under the stated nesting hypothesis.',
        'Diagnostic unlocked: the external residual falls 0.500 → 0.372 → 0.289, so energy and unresolved coupling must be judged together.',
        'Evidence unlocked: n=5 is the smallest space meeting the fixed energy/residual targets without exceeding the cost budget.'
      ],
      feedback: {
        method: 'A normalized ground-state trial in a nested finite space supports a variational/Ritz analysis.',
        diagnostic: 'The Rayleigh value and external residual distinguish a low number from a resolved finite-space root.',
        evidence: 'A nested convergence table with fixed targets and cost makes the finite claim auditable.'
      },
      caveat: 'Passing the six-site-style target remains a finite-model statement, not a continuum or complete-basis result.'
    },
    'overlap-collapse': {
      title: 'Dossier B · Stable entries, unstable coefficients',
      brief: 'Initial brief: adding a second, almost redundant direction leaves every printed matrix entry finite but makes coefficients and the reported low root highly sensitive. Choose the mathematical problem before selecting a diagnostic.',
      expected: { method: 'generalized-eigenproblem', diagnostic: 'overlap-spectrum', evidence: 'threshold-stability' },
      artifacts: [
        'Artifact unlocked: the coefficient problem carries a nonidentity positive metric, so replacing Hc=ESc by an ordinary eigenproblem changes the problem.',
        'Diagnostic unlocked: eig(S)=[0.020,1.980] and κ₂=99 expose a nearly duplicated direction even though individual matrix entries look finite.',
        'Evidence unlocked: pruning at 0.03 preserves the declared observable within 0.003 across a nearby threshold scan.'
      ],
      feedback: {
        method: 'Keep the overlap metric explicit or transform it with a controlled positive-definite procedure.',
        diagnostic: 'Smallest eig(S) and condition number expose amplification that a raw overlap entry alone does not quantify.',
        evidence: 'A threshold scan must test retained observables, not merely report a smaller matrix.'
      },
      caveat: 'The 0.03 cutoff is justified only for this artifact and observable; it is not a universal basis-set threshold.'
    },
    'error-cancellation': {
      title: 'Dossier C · Good final number, costly path',
      brief: 'Initial brief: the final result is only 0.010 from a reference, but successive controlled refinements move it by 0.050, 0.030, and 0.010 with mixed signs. Choose the audit framework before judging the agreement.',
      expected: { method: 'error-budget-audit', diagnostic: 'signed-components', evidence: 'targeted-next-run' },
      artifacts: [
        'Artifact unlocked: four related runs define a telescoping path from numerical result through representation and model limits to a reference.',
        'Diagnostic unlocked: components −0.050, +0.030, and +0.010 yield net −0.010 but absolute burden 0.090; cancellation is carrying the apparent agreement.',
        'Evidence unlocked: spend the next run on the dominant solver layer, then repeat the signed ledger rather than trusting the net error alone.'
      ],
      feedback: {
        method: 'Use a signed error-budget audit because the question is which computational layer creates the apparent agreement.',
        diagnostic: 'Signed components and their absolute burden reveal cancellation hidden by the net difference.',
        evidence: 'A targeted next run on the dominant layer is more informative than indiscriminately increasing every cost.'
      },
      caveat: 'The deterministic telescope is not a statistical uncertainty estimate, and another path of limits can produce another decomposition.'
    }
  });

  const ERROR_CASES = Object.freeze({
    reinforcing: { title: 'Run table 05', values: [-74.95, -75.00, -75.03, -75.04], expected: { dominant: 'solver', cancellation: 'no', nextAction: 'tighten-solver' } },
    cancellation: { title: 'Run table 12', values: [-75.05, -75.00, -75.03, -75.04], expected: { dominant: 'solver', cancellation: 'yes', nextAction: 'tighten-solver' } },
    'converged-not-accurate': { title: 'Run table 18', values: [-75.001, -75.000, -75.002, -75.080], expected: { dominant: 'model', cancellation: 'no', nextAction: 'improve-model' } }
  });

  const OVERLAP_CASES = Object.freeze({
    stable: { values: [-1, -0.2, 0.4, 0.3], expectedAction: 'retain', thresholdRange: [0.005, 0.1], referenceEnergy: -1.0074252446456542 },
    duplicate: { values: [-1, -0.99, -0.98, 0.98], expectedAction: 'prune', thresholdRange: [0.02, 0.05], referenceEnergy: -1.0 }
  });

  const RESIDUAL_CASES = Object.freeze({
    valid: {
      title: 'Run A · certificate request 17',
      angles: [20, 35],
      expected: 'certify',
      claim: 'Claim: the supplied μ, residual, and known E₁ justify a conditional finite-model lower/upper bracket.',
      reason: 'The stated finite spectrum supplies E₁ and μ<E₁, so the conditional bracket is available.'
    },
    'gap-fail': {
      title: 'Run B · certificate request 23',
      angles: [80, 90],
      expected: 'reject',
      claim: 'Claim: the same Temple-type lower expression remains a valid certificate for this trial.',
      reason: 'μ crosses E₁, so the Temple-type lower expression is unavailable.'
    },
    'wrong-root': {
      title: 'Run C · certificate request 31',
      angles: [89, 0],
      expected: 'missing-evidence',
      claim: 'Request: a production report gives a tiny residual but no target-root separation. Is that enough to identify the intended ground root?',
      reason: 'A tiny residual near E₁ does not identify the ground target; target-root separation and bracket width must be reported.'
    }
  });

  const GAME_STORAGE_KEY = 'project-xc-approximation-games-v2';
  const MISSION_IDS = Object.freeze([
    'approximation-passport', 'dimensionless-scaling', 'rayleigh-quotient', 'variational-gaussian',
    'basis-truncation', 'nonorthogonal-basis', 'nondegenerate-perturbation', 'degenerate-perturbation',
    'series-budget', 'error-decomposition', 'residual-bounds', 'approximation-case-file'
  ]);
  const NOTEBOOK_ENTRIES = Object.freeze({
    'approximation-passport': ['classification', 'unstated approximation layer', 'passport consistency', 'explicit diagnostic and caveat'],
    'dimensionless-scaling': ['nondimensionalization', 'anharmonic spectrum', 'target ω and g', 'spectral calculation after scale matching'],
    'rayleigh-quotient': ['finite Rayleigh search', 'directions outside the 2×2 model', 'stationarity residual', 'both extrema located before reveal'],
    'variational-gaussian': ['restricted variational family', 'non-Gaussian directions', 'virial balance and reciprocal widths', 'family enlargement'],
    'basis-truncation': ['nested Ritz projection', 'discarded coordinates', 'energy excess plus external residual', 'smallest adequate space under cost'],
    'nonorthogonal-basis': ['metric-aware eigensolve', 'unstable near-null direction', 'overlap spectrum and observable drift', 'threshold scan'],
    'nondegenerate-perturbation': ['finite-order expansion', 'higher orders', 'withheld-point error', 'maximal safe trust range'],
    'degenerate-perturbation': ['subspace diagonalization', 'states outside the degenerate manifold', 'off-diagonal residual and invariants', 'basis rotation plus identity case'],
    'series-budget': ['asymptotic truncation', 'factorial tail', 'term-size stop and reference error', 'transfer across couplings'],
    'error-decomposition': ['signed error telescope', 'uncomputed layer refinements', 'components and absolute burden', 'targeted next calculation'],
    'residual-bounds': ['finite spectral certification', 'unknown target separation outside the model', 'residual, gap, and bracket width', 'certify/reject/missing-evidence decision'],
    'approximation-case-file': ['staged research audit', 'claim-dependent omitted layers', 'linked dossier diagnostics', 'budgeted evidence chain']
  });

  const game = {
    cleared: new Set(),
    passport: { cleared: new Set(), attempts: {} },
    rayleigh: { minimum: false, maximum: false, attempts: 0 },
    gaussian: { diffuse: false, prediction: false, narrow: false, minimum: false, attempts: 0 },
    overlap: { cleared: new Set() },
    perturbation: { revealed: false },
    degenerate: { aligned: false, rotated: false, identity: false, alignedAngle: null, attempts: 0 },
    series: { cleared: new Set(), revealed: false, attempts: {} },
    errors: { cleared: new Set() },
    residual: { cleared: new Set() },
    boss: { cleared: new Set(), stage: {}, budget: {}, answers: {} }
  };

  function requireFinite(label, ...values) {
    if (!finite(...values)) throw new RangeError(`${label} requires finite numbers`);
  }

  function evaluateApproximationPassport(caseId, selection = {}) {
    const caseFile = PASSPORT_CASES[caseId];
    if (!caseFile) throw new RangeError(`unknown approximation-passport case: ${caseId}`);
    const methodCorrect = selection.method === caseFile.method;
    const layerCorrect = selection.layer === caseFile.layer;
    return {
      caseId,
      title: caseFile.title,
      correct: methodCorrect && layerCorrect,
      fields: {
        method: { actual: selection.method || '', expected: caseFile.method, correct: methodCorrect },
        layer: { actual: selection.layer || '', expected: caseFile.layer, correct: layerCorrect }
      },
      evidence: caseFile.evidence,
      caveat: caseFile.caveat
    };
  }

  function dimensionlessQuartic(mass, forceConstant, beta, hbar = 1) {
    requireFinite('dimensionlessQuartic', mass, forceConstant, beta, hbar);
    if (mass <= 0 || forceConstant <= 0 || hbar <= 0 || beta < 0) throw new RangeError('dimensionlessQuartic requires m,k,hbar>0 and beta>=0');
    const omega = Math.sqrt(forceConstant / mass);
    const lengthScale = Math.sqrt(hbar / (mass * omega));
    const energyScale = hbar * omega;
    const g = beta * hbar / (mass * mass * omega ** 3);
    const harmonicPotential = q => 0.5 * q * q;
    const dimensionlessPotential = q => harmonicPotential(q) + g * q ** 4;
    const points = Array.from({ length: 161 }, (_unused, index) => {
      const q = -2.4 + 4.8 * index / 160;
      return { q, harmonic: harmonicPotential(q), full: dimensionlessPotential(q) };
    });
    return { mass, forceConstant, beta, hbar, omega, lengthScale, energyScale, g, harmonicPotential, dimensionlessPotential, points };
  }

  function evaluateScalingChallenge(mass, forceConstant, beta, unsolved = '') {
    const model = dimensionlessQuartic(mass, forceConstant, beta, 1);
    const target = { omega: 2, g: 0.025 };
    const omegaError = Math.abs(model.omega - target.omega);
    const gError = Math.abs(model.g - target.g);
    const scaleCorrect = omegaError <= 5e-4 && gError <= 5e-5;
    const reasoningCorrect = unsolved === 'spectrum';
    return { model, target, omegaError, gError, scaleCorrect, reasoningCorrect, correct: scaleCorrect && reasoningCorrect };
  }

  function normalizedVector(x, y, fallback) {
    const norm = Math.hypot(x, y);
    if (norm < 1e-15) return [...fallback];
    let vector = [x / norm, y / norm];
    if (Math.abs(vector[0]) > 1e-14 ? vector[0] < 0 : vector[1] < 0) vector = vector.map(value => -value);
    return vector;
  }

  function symmetricEigen2x2(a, b, d) {
    requireFinite('symmetricEigen2x2', a, b, d);
    const center = 0.5 * (a + d);
    const radius = Math.hypot(0.5 * (a - d), b);
    const values = [center - radius, center + radius];
    if (radius < 1e-15) return { values, vectors: [[1, 0], [0, 1]], degenerate: true };
    const lowerFallback = Math.abs(a - values[0]) <= Math.abs(d - values[0]) ? [1, 0] : [0, 1];
    const upperFallback = Math.abs(a - values[1]) <= Math.abs(d - values[1]) ? [1, 0] : [0, 1];
    return {
      values,
      vectors: [normalizedVector(b, values[0] - a, lowerFallback), normalizedVector(b, values[1] - a, upperFallback)],
      degenerate: Math.abs(values[1] - values[0]) < 1e-13
    };
  }

  function rayleighQuotient2(a, b, d, angleDegrees) {
    requireFinite('rayleighQuotient2', a, b, d, angleDegrees);
    const angle = radians(angleDegrees);
    const vector = [Math.cos(angle), Math.sin(angle)];
    const transformed = [a * vector[0] + b * vector[1], b * vector[0] + d * vector[1]];
    const energy = vector[0] * transformed[0] + vector[1] * transformed[1];
    const residual = [transformed[0] - energy * vector[0], transformed[1] - energy * vector[1]];
    return { a, b, d, angleDegrees, vector, transformed, energy, residual, residualNorm: Math.hypot(...residual), spectrum: symmetricEigen2x2(a, b, d) };
  }

  function gaussianVariational(alpha) {
    requireFinite('gaussianVariational', alpha);
    if (alpha <= 0) throw new RangeError('gaussianVariational requires alpha>0');
    const kinetic = alpha / 4;
    const potential = 1 / (4 * alpha);
    const energy = kinetic + potential;
    return {
      alpha, kinetic, potential, energy, exactGround: 0.5, upperError: energy - 0.5,
      virialRatio: kinetic / potential,
      stationary: Math.abs(alpha - 1) < 1e-12,
      virialBalanced: Math.abs(kinetic - potential) < 1e-12
    };
  }

  function basisTruncation(size) {
    if (!Number.isInteger(size) || size < 1 || size > 6) throw new RangeError('basisTruncation size must be an integer from 1 to 6');
    const energy = 2 - 2 * Math.cos(Math.PI / (size + 1));
    const fullEnergy = 2 - 2 * Math.cos(Math.PI / 7);
    const residualNorm = size === 6 ? 0 : Math.sqrt(2 / (size + 1)) * Math.sin(size * Math.PI / (size + 1));
    const sequence = Array.from({ length: 6 }, (_unused, index) => {
      const n = index + 1;
      return {
        size: n,
        energy: 2 - 2 * Math.cos(Math.PI / (n + 1)),
        residualNorm: n === 6 ? 0 : Math.sqrt(2 / (n + 1)) * Math.sin(n * Math.PI / (n + 1))
      };
    });
    return { size, energy, fullEnergy, energyError: energy - fullEnergy, residualNorm, sequence, convergedFiniteModel: size === 6 };
  }

  function evaluateBasisBudget(size) {
    const model = basisTruncation(size);
    const requirements = { energyError: 0.08, residualNorm: 0.3, maxSize: 5, smallestAdequate: 5 };
    const energyPass = model.energyError <= requirements.energyError;
    const residualPass = model.residualNorm <= requirements.residualNorm;
    const costPass = size <= requirements.maxSize;
    return { model, requirements, energyPass, residualPass, costPass, correct: energyPass && residualPass && costPass && size === requirements.smallestAdequate };
  }

  function generalizedEigen2(h11, h12, h22, overlap) {
    requireFinite('generalizedEigen2', h11, h12, h22, overlap);
    if (Math.abs(overlap) >= 1) throw new RangeError('generalizedEigen2 requires |s|<1 so S is positive definite');
    const A = 1 - overlap * overlap;
    const B = 2 * overlap * h12 - h11 - h22;
    const C = h11 * h22 - h12 * h12;
    const discriminant = Math.max(0, B * B - 4 * A * C);
    const root = Math.sqrt(discriminant);
    const values = [(-B - root) / (2 * A), (-B + root) / (2 * A)];
    const minimumOverlap = 1 - Math.abs(overlap);
    const maximumOverlap = 1 + Math.abs(overlap);
    const conditionNumber = maximumOverlap / minimumOverlap;
    return {
      h11, h12, h22, overlap,
      values,
      overlapEigenvalues: [minimumOverlap, maximumOverlap],
      determinantOverlap: A,
      conditionNumber,
      nearDependent: minimumOverlap <= 0.020000000000001 || conditionNumber > 100,
      teachingThreshold: 0.02,
      polynomial: { A, B, C }
    };
  }

  function evaluateOverlapRescue(caseId, action, threshold) {
    const caseFile = OVERLAP_CASES[caseId];
    if (!caseFile) throw new RangeError(`unknown overlap rescue case: ${caseId}`);
    requireFinite('evaluateOverlapRescue', threshold);
    const [h11, h12, h22, overlap] = caseFile.values;
    const model = generalizedEigen2(h11, h12, h22, overlap);
    const thresholdPass = threshold >= caseFile.thresholdRange[0] - 1e-12 && threshold <= caseFile.thresholdRange[1] + 1e-12;
    const observableAt = trialThreshold => {
      const trialPruned = action === 'prune' && model.overlapEigenvalues[0] <= trialThreshold;
      const observable = trialPruned ? h11 : model.values[0];
      return { threshold: trialThreshold, pruned: trialPruned, observable, drift: Math.abs(observable - caseFile.referenceEnergy) };
    };
    const thresholdScan = [...new Set([Math.max(0, threshold - 0.005), threshold, threshold + 0.005].map(value => Number(value.toFixed(6))))].map(observableAt);
    const selected = thresholdScan.find(point => Math.abs(point.threshold - threshold) < 1e-12) || observableAt(threshold);
    const maximumObservableDrift = Math.max(...thresholdScan.map(point => point.drift));
    const actionCorrect = action === caseFile.expectedAction;
    const stabilityPass = maximumObservableDrift <= (caseId === 'duplicate' ? 0.005 : 1e-10);
    return {
      caseId, model, threshold, action,
      pruned: selected.pruned,
      observableAfter: selected.observable,
      observableDrift: selected.drift,
      thresholdScan,
      maximumObservableDrift,
      actionCorrect,
      thresholdPass,
      stabilityPass,
      correct: actionCorrect && thresholdPass && stabilityPass
    };
  }

  function perturbationTwoLevel(gap, coupling, lambda) {
    requireFinite('perturbationTwoLevel', gap, coupling, lambda);
    if (gap <= 0) throw new RangeError('perturbationTwoLevel requires a positive unperturbed gap');
    const x = lambda * coupling;
    const radical = Math.sqrt(gap * gap + 4 * x * x);
    const exactLower = 0.5 * (gap - radical);
    const exactUpper = 0.5 * (gap + radical);
    const order0 = 0;
    const order2 = -x * x / gap;
    const order4 = order2 + x ** 4 / gap ** 3;
    return {
      gap, coupling, lambda, x, exactLower, exactUpper, order0, order2, order4,
      ratio: Math.abs(x / gap),
      error0: Math.abs(order0 - exactLower),
      error2: Math.abs(order2 - exactLower),
      error4: Math.abs(order4 - exactLower)
    };
  }

  function evaluatePerturbationTrust(order, maximumLambda) {
    const numericOrder = Number(order), range = Number(maximumLambda);
    const model = perturbationTwoLevel(2, 0.5, range);
    const error = numericOrder === 2 ? model.error2 : numericOrder === 4 ? model.error4 : Infinity;
    const tolerance = 5e-5;
    const safe = error <= tolerance;
    const maximal = Math.abs(range - 0.6) < 1e-12;
    return { order: numericOrder, maximumLambda: range, withheldLambda: range, error, tolerance, safe, maximal, correct: numericOrder === 4 && safe && maximal };
  }

  function degeneratePerturbation(w11, w12, w22, angleDegrees = 0) {
    requireFinite('degeneratePerturbation', w11, w12, w22, angleDegrees);
    const spectrum = symmetricEigen2x2(w11, w12, w22);
    const angle = radians(angleDegrees);
    const c = Math.cos(angle), s = Math.sin(angle);
    const r11 = c * c * w11 + 2 * c * s * w12 + s * s * w22;
    const r22 = s * s * w11 - 2 * c * s * w12 + c * c * w22;
    const r12 = (w22 - w11) * c * s + w12 * (c * c - s * s);
    const splitting = spectrum.values[1] - spectrum.values[0];
    const exactScalar = w12 === 0 && w11 === w22;
    const numericallyUnresolved = !exactScalar && Math.abs(splitting) < 1e-12;
    let preferredAngle = null;
    if (!exactScalar) {
      const vector = spectrum.vectors[0];
      preferredAngle = ((degrees(Math.atan2(vector[1], vector[0])) % 180) + 180) % 180;
    }
    return {
      w11, w12, w22, angleDegrees,
      shifts: spectrum.values,
      splitting,
      trace: w11 + w22,
      determinant: w11 * w22 - w12 * w12,
      rotated: [[r11, r12], [r12, r22]],
      offDiagonalResidual: Math.abs(r12),
      coincident: exactScalar,
      exactScalar,
      numericallyUnresolved,
      preferredAngle
    };
  }

  function factorial(value) {
    let result = 1;
    for (let item = 2; item <= value; item += 1) result *= item;
    return result;
  }

  function asymptoticIntegral(g, intervals = 20000) {
    requireFinite('asymptoticIntegral', g, intervals);
    if (g < 0 || !Number.isInteger(intervals) || intervals < 100 || intervals % 2) throw new RangeError('asymptoticIntegral requires g>=0 and an even interval count >=100');
    if (g === 0) return 1;
    const upper = 30;
    const h = upper / intervals;
    const integrand = t => Math.exp(-t) / (1 + g * t);
    let sum = integrand(0) + integrand(upper);
    for (let index = 1; index < intervals; index += 1) sum += (index % 2 ? 4 : 2) * integrand(index * h);
    return sum * h / 3;
  }

  function asymptoticSeriesModel(g, order, maxOrder = 14) {
    requireFinite('asymptoticSeriesModel', g, order, maxOrder);
    if (g < 0 || !Number.isInteger(order) || !Number.isInteger(maxOrder) || maxOrder < 0 || order < 0 || order > maxOrder || maxOrder > 20) {
      throw new RangeError('asymptoticSeriesModel requires g>=0 and 0<=order<=maxOrder<=20');
    }
    const reference = asymptoticIntegral(g);
    let sum = 0;
    const partials = [];
    for (let n = 0; n <= maxOrder; n += 1) {
      const term = (n % 2 ? -1 : 1) * factorial(n) * g ** n;
      sum += term;
      partials.push({ order: n, term, sum, error: Math.abs(sum - reference), signedError: sum - reference });
    }
    const best = partials.reduce((current, item) => item.error < current.error ? item : current, partials[0]);
    return { g, order, maxOrder, reference, partials, selected: partials[order], bestOrder: best.order, bestError: best.error, tailBound: Math.exp(-30) };
  }

  function errorDecomposition(numerical, basisLimit, modelLimit, reference) {
    requireFinite('errorDecomposition', numerical, basisLimit, modelLimit, reference);
    const components = {
      solver: numerical - basisLimit,
      representation: basisLimit - modelLimit,
      model: modelLimit - reference
    };
    const signedSum = components.solver + components.representation + components.model;
    const totalError = numerical - reference;
    const absoluteBurden = Math.abs(components.solver) + Math.abs(components.representation) + Math.abs(components.model);
    const cancellation = absoluteBurden > 1e-14 && Math.abs(totalError) < 0.75 * absoluteBurden;
    const dominant = Object.entries(components).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0][0];
    return { numerical, basisLimit, modelLimit, reference, components, signedSum, totalError, absoluteBurden, cancellation, dominant };
  }

  function evaluateErrorLedger(caseId, answers = {}) {
    const caseFile = ERROR_CASES[caseId];
    if (!caseFile) throw new RangeError(`unknown error-ledger case: ${caseId}`);
    const model = errorDecomposition(...caseFile.values);
    const fields = {
      dominant: answers.dominant === caseFile.expected.dominant,
      cancellation: answers.cancellation === caseFile.expected.cancellation,
      nextAction: answers.nextAction === caseFile.expected.nextAction
    };
    return { caseId, model, expected: caseFile.expected, fields, correct: Object.values(fields).every(Boolean) };
  }

  function residualCertificate(thetaDegrees, highStateMixDegrees) {
    requireFinite('residualCertificate', thetaDegrees, highStateMixDegrees);
    const theta = radians(thetaDegrees), phi = radians(highStateMixDegrees);
    const coefficients = [Math.cos(theta), Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi)];
    const energies = [0, 1.5, 4];
    const probabilities = coefficients.map(value => value * value);
    const rayleigh = probabilities.reduce((sum, probability, index) => sum + probability * energies[index], 0);
    const variance = probabilities.reduce((sum, probability, index) => sum + probability * (energies[index] - rayleigh) ** 2, 0);
    const residualNorm = Math.sqrt(Math.max(0, variance));
    const nextLevel = energies[1];
    const applicable = rayleigh < nextLevel - 1e-12;
    const lowerBound = applicable ? rayleigh - variance / (nextLevel - rayleigh) : null;
    return {
      thetaDegrees, highStateMixDegrees, coefficients, probabilities, energies,
      exactGround: 0, nextLevel, rayleigh, variance, residualNorm,
      upperBound: rayleigh, lowerBound, applicable
    };
  }

  function evaluateResidualClaim(caseId, decision) {
    const caseFile = RESIDUAL_CASES[caseId];
    if (!caseFile) throw new RangeError(`unknown residual claim case: ${caseId}`);
    const model = residualCertificate(...caseFile.angles);
    return { caseId, decision, expected: caseFile.expected, reason: caseFile.reason, model, correct: decision === caseFile.expected };
  }

  function evaluateApproximationCase(caseId, answers = {}) {
    const caseFile = CAMPAIGN_CASES[caseId];
    if (!caseFile) throw new RangeError(`unknown approximation campaign case: ${caseId}`);
    const fields = {};
    for (const key of ['method', 'diagnostic', 'evidence']) {
      fields[key] = {
        actual: answers[key] || '',
        expected: caseFile.expected[key],
        correct: answers[key] === caseFile.expected[key],
        feedback: caseFile.feedback[key]
      };
    }
    const score = Object.values(fields).filter(field => field.correct).length;
    return { caseId, title: caseFile.title, fields, score, total: 3, complete: Object.values(fields).every(field => field.actual), correct: score === 3, caveat: caseFile.caveat };
  }

  function inputNumber(id, fallback) {
    const raw = $(id)?.value;
    if (typeof raw !== 'string' || raw.trim() === '') return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }

  function setResult(id, state, html) {
    const node = $(id);
    if (!node) return;
    node.innerHTML = html;
    node.dataset.state = state;
  }

  function restoreGameState() {
    let saved;
    try { saved = JSON.parse(window.localStorage.getItem(GAME_STORAGE_KEY) || 'null'); } catch (_error) { saved = null; }
    if (!saved || saved.version !== 2) return;
    const validMissions = new Set(MISSION_IDS);
    const list = value => Array.isArray(value) ? value : [];
    game.cleared = new Set(list(saved.cleared).filter(id => validMissions.has(id)));
    game.passport.cleared = new Set(list(saved.passport).filter(id => Object.hasOwn(PASSPORT_CASES, id)));
    game.overlap.cleared = new Set(list(saved.overlap).filter(id => Object.hasOwn(OVERLAP_CASES, id)));
    game.series.cleared = new Set(list(saved.series).filter(value => ['0.1', '0.2', '0.4'].includes(String(value))));
    game.errors.cleared = new Set(list(saved.errors).filter(id => Object.hasOwn(ERROR_CASES, id)));
    game.residual.cleared = new Set(list(saved.residual).filter(id => Object.hasOwn(RESIDUAL_CASES, id)));
    game.boss.cleared = new Set(list(saved.boss).filter(id => Object.hasOwn(CAMPAIGN_CASES, id)));
    if (game.cleared.has('rayleigh-quotient')) Object.assign(game.rayleigh, { minimum: true, maximum: true });
    if (game.cleared.has('variational-gaussian')) Object.assign(game.gaussian, { diffuse: true, prediction: true, narrow: true, minimum: true });
    if (game.cleared.has('nondegenerate-perturbation')) game.perturbation.revealed = true;
    if (game.cleared.has('degenerate-perturbation')) Object.assign(game.degenerate, { aligned: true, rotated: true, identity: true });
    const campaignRestored = game.boss.cleared.size === Object.keys(CAMPAIGN_CASES).length && MISSION_IDS.slice(0, -1).every(id => game.cleared.has(id));
    if (!campaignRestored) game.cleared.delete('approximation-case-file');
  }

  function saveGameState() {
    try {
      window.localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify({
        version: 2,
        cleared: [...game.cleared],
        passport: [...game.passport.cleared],
        overlap: [...game.overlap.cleared],
        series: [...game.series.cleared],
        errors: [...game.errors.cleared],
        residual: [...game.residual.cleared],
        boss: [...game.boss.cleared]
      }));
    } catch (_error) { /* storage can be unavailable in privacy contexts */ }
  }

  function renderNotebook() {
    const node = $('approxNotebookList');
    if (!node) return;
    const entries = MISSION_IDS.filter(id => game.cleared.has(id));
    if (!entries.length) {
      node.innerHTML = '<p class="help-text">No game evidence recorded yet.</p>';
      return;
    }
    node.innerHTML = entries.map(id => {
      const [operation, omitted, diagnostic, evidence] = NOTEBOOK_ENTRIES[id];
      return `<article><strong>${esc(id.replaceAll('-', ' '))}</strong><span>${esc(operation)}</span><span>${esc(omitted)}</span><span>${esc(diagnostic)}</span><span>${esc(evidence)}</span></article>`;
    }).join('');
  }

  function renderGameProgress() {
    const completed = new Set(window.ProjectXCAcademy?.completedMissions('qc-approximations') || []);
    document.querySelectorAll('.academy-complete[data-game-gate]').forEach(button => {
      const earned = game.cleared.has(button.dataset.mission);
      const legacyCompleted = completed.has(button.dataset.mission);
      button.dataset.defaultGameLabel ||= `Complete mission · ${button.dataset.badge || button.dataset.mission}`;
      button.disabled = !earned && !legacyCompleted;
      button.dataset.gameGate = earned ? 'earned' : legacyCompleted ? 'legacy-complete' : 'locked';
      if (!legacyCompleted) {
        button.textContent = earned
          ? button.dataset.defaultGameLabel.replace('Complete mission', 'Record earned seal')
          : button.dataset.defaultGameLabel.replace('Complete mission', 'Locked seal');
      }
      button.title = earned ? 'Game evidence earned; activate to record or remove this Academy mission.' : legacyCompleted ? 'Previously completed progress is preserved.' : 'Clear this laboratory decision challenge to unlock its workshop seal.';
    });
    if ($('approxPassportScore')) $('approxPassportScore').textContent = `${game.passport.cleared.size} / 4 case files cleared`;
    if ($('overlapStage')) $('overlapStage').textContent = `Rescue artifacts cleared: ${game.overlap.cleared.size} / 2`;
    if ($('seriesStage')) $('seriesStage').textContent = `Coupling dossiers cleared: ${game.series.cleared.size} / 3`;
    if ($('errorStage')) $('errorStage').textContent = `Run tables cleared: ${game.errors.cleared.size} / 3`;
    if ($('residualStage')) $('residualStage').textContent = `Claim files cleared: ${game.residual.cleared.size} / 3`;
    const prerequisites = MISSION_IDS.slice(0, 11).filter(id => game.cleared.has(id)).length;
    if ($('approxBossScore')) $('approxBossScore').textContent = `Dossiers cleared: ${game.boss.cleared.size} / 3 · notebook prerequisites: ${prerequisites} / 11`;
    renderNotebook();
  }

  function earnMission(missionId) {
    if (!MISSION_IDS.includes(missionId)) throw new RangeError(`unknown Approximation mission: ${missionId}`);
    game.cleared.add(missionId);
    saveGameState();
    renderGameProgress();
    maybeEarnBoss();
  }

  function maybeEarnBoss() {
    const prerequisites = MISSION_IDS.slice(0, 11).every(id => game.cleared.has(id));
    if (prerequisites && game.boss.cleared.size === Object.keys(CAMPAIGN_CASES).length && !game.cleared.has('approximation-case-file')) {
      game.cleared.add('approximation-case-file');
      saveGameState();
      renderGameProgress();
      setResult('approxBossFeedback', 'success', '<strong>Campaign seal earned.</strong> Three staged dossiers and all eleven notebook prerequisites are complete. The surviving caveats remain part of the claim.');
    }
  }

  function resetGameState() {
    game.cleared.clear();
    game.passport.cleared.clear();
    game.passport.attempts = {};
    Object.assign(game.rayleigh, { minimum: false, maximum: false, attempts: 0 });
    Object.assign(game.gaussian, { diffuse: false, prediction: false, narrow: false, minimum: false, attempts: 0 });
    game.overlap.cleared.clear();
    game.perturbation.revealed = false;
    Object.assign(game.degenerate, { aligned: false, rotated: false, identity: false, alignedAngle: null, attempts: 0 });
    game.series.cleared.clear();
    game.series.revealed = false;
    game.series.attempts = {};
    game.errors.cleared.clear();
    game.errors.revealedCase = null;
    game.residual.cleared.clear();
    game.residual.revealedCase = null;
    game.boss.cleared.clear();
    game.boss.stage = {};
    game.boss.budget = {};
    game.boss.answers = {};
    try { window.localStorage.removeItem(GAME_STORAGE_KEY); } catch (_error) { /* ignore */ }

    const assign = (id, value) => { if ($(id)) $(id).value = String(value); };
    assign('approxPassportCase', 'gaussian-family'); assign('approxPassportMethod', ''); assign('approxPassportLayer', '');
    assign('scaleMass', 1); assign('scaleForce', 1); assign('scaleBeta', 0.1); assign('scaleUnsolved', '');
    assign('rayleighA', 1); assign('rayleighB', 0.2); assign('rayleighD', 3); assign('rayleighAngle', 20);
    assign('gaussianAlpha', 0.25); assign('gaussianReciprocal', '');
    assign('basisSize', 3);
    assign('overlapCase', 'stable'); assign('overlapThreshold', 0.03); assign('overlapAction', '');
    assign('perturbGap', 2); assign('perturbCoupling', 0.5); assign('perturbLambda', 0.4); assign('perturbOrderChoice', ''); assign('perturbRangeChoice', '');
    assign('degeneratePreset', 'split'); assign('degenerateW11', 1); assign('degenerateW12', 0.5); assign('degenerateW22', -1); assign('degenerateAngle', 0);
    assign('seriesCase', 0.1); assign('seriesOrder', 4);
    assign('errorCase', 'reinforcing'); assign('errorDominant', ''); assign('errorCancellation', ''); assign('errorNextAction', '');
    assign('residualCase', 'valid'); assign('residualDecision', '');
    assign('approxBossCase', 'ground-upper-bound'); assign('approxBossMethod', ''); assign('approxBossDiagnostic', ''); assign('approxBossEvidence', '');
    if ($('rayleighRevealActions')) $('rayleighRevealActions').hidden = true;
    if ($('gaussianOptimize')) $('gaussianOptimize').hidden = true;
    if ($('degenerateAlign')) $('degenerateAlign').hidden = true;
    if ($('seriesBest')) $('seriesBest').hidden = true;

    updatePassportPrompt();
    updateScaling();
    updateRayleigh();
    updateGaussian();
    renderGaussianStage();
    updateBasis();
    syncOverlapCase();
    updatePerturbation();
    updateDegenerate();
    renderDegenerateStage();
    syncSeriesCase();
    updateErrorCase();
    syncResidualCase();
    syncBoss();
    renderGameProgress();
  }

  let svgSerial = 0;
  function svg(width, height, body, label, extra = '') {
    const serial = ++svgSerial;
    const hatchId = `approx-hatch-${serial}`;
    const dotsId = `approx-dots-${serial}`;
    const scopedBody = body.replaceAll('url(#approx-hatch)', `url(#${hatchId})`).replaceAll('url(#approx-dots)', `url(#${dotsId})`);
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}" ${extra}>
      <defs>
        <pattern id="${hatchId}" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#fff1f2"></rect><line x1="0" y1="0" x2="0" y2="10" stroke="#e11d48" stroke-width="3"></line></pattern>
        <pattern id="${dotsId}" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#f0fdfa"></rect><circle cx="3" cy="3" r="2" fill="#0f766e"></circle></pattern>
      </defs>
      <rect width="${width}" height="${height}" rx="18" fill="#fcfdff"></rect>${scopedBody}</svg>`;
  }

  function mapLinear(value, fromMin, fromMax, toMin, toMax) {
    return toMin + (value - fromMin) * (toMax - toMin) / (fromMax - fromMin || 1);
  }

  function pathFrom(points, xMap, yMap) {
    return points.map((point, index) => `${index ? 'L' : 'M'} ${xMap(point[0]).toFixed(2)} ${yMap(point[1]).toFixed(2)}`).join(' ');
  }

  function axes(width, height, left, right, top, bottom, xLabel, yLabel) {
    return `<line class="approx-axis" x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}"></line>
      <line class="approx-axis" x1="${left}" x2="${left}" y1="${top}" y2="${bottom}"></line>
      <text x="${(left + right) / 2}" y="${height - 12}" text-anchor="middle" class="axis-label">${esc(xLabel)}</text>
      <text x="18" y="${(top + bottom) / 2}" class="axis-label">${esc(yLabel)}</text>`;
  }

  const PASSPORT_METHOD_LABELS = {
    variational: 'Variational',
    'representation-truncation': 'Representation',
    perturbation: 'Perturbative',
    'model-replacement': 'Model replacement',
    'numerical-solver': 'Solver only'
  };
  const PASSPORT_LAYER_LABELS = {
    ansatz: 'Trial family',
    representation: 'Finite space',
    'series-truncation': 'Series order',
    model: 'Model physics',
    solver: 'Solver convergence'
  };

  function setPassportStamp(id, heading, value = '', state = '') {
    const node = $(id);
    if (!node) return;
    node.innerHTML = value ? `<small>${esc(heading)}</small><strong>${esc(value)}</strong>` : esc(heading);
    if (state) node.dataset.state = state;
    else delete node.dataset.state;
  }

  function updatePassportPrompt() {
    const caseId = $('approxPassportCase')?.value || 'gaussian-family';
    const caseFile = PASSPORT_CASES[caseId];
    if ($('approxPassportTitle')) $('approxPassportTitle').textContent = caseFile.title;
    if ($('approxPassportBrief')) $('approxPassportBrief').textContent = caseFile.brief;
    if ($('approxPassportMethod')) $('approxPassportMethod').value = '';
    if ($('approxPassportLayer')) $('approxPassportLayer').value = '';
    setPassportStamp('approxStampMethod', 'METHOD');
    setPassportStamp('approxStampLayer', 'OMISSION');
    setPassportStamp('approxStampDiagnostic', 'DIAGNOSTIC');
    setPassportStamp('approxStampEvidence', 'EVIDENCE');
    const already = game.passport.cleared.has(caseId);
    setResult('approxPassportFeedback', already ? 'success' : 'neutral', already ? '<strong>Case already cleared.</strong> Re-audit it or open another research brief.' : '<strong>Commit before reveal.</strong> Choose the operation and omitted layer. The first miss gives a reasoning hint; only a later miss reveals labels.');
  }

  function auditPassport() {
    const caseId = $('approxPassportCase')?.value || 'gaussian-family';
    const caseFile = PASSPORT_CASES[caseId];
    const method = $('approxPassportMethod')?.value || '';
    const layer = $('approxPassportLayer')?.value || '';
    const result = evaluateApproximationPassport(caseId, { method, layer });
    game.passport.attempts[caseId] = (game.passport.attempts[caseId] || 0) + 1;
    const reveal = game.passport.attempts[caseId] >= 2;
    if (result.correct) {
      setPassportStamp('approxStampMethod', 'METHOD', PASSPORT_METHOD_LABELS[result.fields.method.expected], 'pass');
      setPassportStamp('approxStampLayer', 'OMISSION', PASSPORT_LAYER_LABELS[result.fields.layer.expected], 'pass');
      setPassportStamp('approxStampDiagnostic', 'DIAGNOSTIC', caseFile.diagnosticStamp, 'evidence');
      setPassportStamp('approxStampEvidence', 'EVIDENCE', caseFile.evidenceStamp, 'evidence');
      game.passport.cleared.add(caseId);
      saveGameState();
      renderGameProgress();
      setResult('approxPassportFeedback', 'success', `<strong>Passport cleared.</strong> ${esc(caseFile.evidence)} <em>${esc(caseFile.caveat)}</em>`);
      if (game.passport.cleared.size === Object.keys(PASSPORT_CASES).length) earnMission('approximation-passport');
      return;
    }
    setPassportStamp('approxStampMethod', 'METHOD', PASSPORT_METHOD_LABELS[method] || 'No committed answer', 'revise');
    setPassportStamp('approxStampLayer', 'OMISSION', PASSPORT_LAYER_LABELS[layer] || 'No committed answer', 'revise');
    setPassportStamp('approxStampDiagnostic', 'DIAGNOSTIC', reveal ? caseFile.diagnosticStamp : 'Locked after a first miss', reveal ? 'evidence' : 'revise');
    setPassportStamp('approxStampEvidence', 'EVIDENCE', reveal ? caseFile.evidenceStamp : 'Locked after a first miss', reveal ? 'evidence' : 'revise');
    const hint = result.fields.method.correct ? 'The operation is right; ask what directions or physics it cannot restore.' : result.fields.layer.correct ? 'The omitted layer is right; classify the mathematical operation that created it.' : `Hint: focus on the diagnostic “${caseFile.diagnostic}” and separate the operation from what it omits.`;
    const answer = reveal ? ` Expected operation: ${PASSPORT_METHOD_LABELS[result.fields.method.expected]}; expected omission: ${PASSPORT_LAYER_LABELS[result.fields.layer.expected]}.` : '';
    setResult('approxPassportFeedback', 'needs-work', `<strong>Passport needs revision.</strong> ${esc(hint)}${esc(answer)} Retry before moving to another file.`);
  }

  function updateScaling() {
    const mass = inputNumber('scaleMass', 1), force = inputNumber('scaleForce', 1), beta = inputNumber('scaleBeta', 0.1);
    const model = dimensionlessQuartic(mass, force, beta, 1);
    if ($('scaleMassValue')) $('scaleMassValue').textContent = mass.toFixed(2);
    if ($('scaleForceValue')) $('scaleForceValue').textContent = force.toFixed(2);
    if ($('scaleBetaValue')) $('scaleBetaValue').textContent = beta.toFixed(3);
    const width = 720, height = 390, left = 70, right = 690, top = 48, bottom = 326;
    const maxY = Math.max(...model.points.map(point => point.full));
    const xMap = value => mapLinear(value, -2.4, 2.4, left, right);
    const yMap = value => mapLinear(value, 0, maxY, bottom, top);
    const harmonic = pathFrom(model.points.map(point => [point.q, point.harmonic]), xMap, yMap);
    const full = pathFrom(model.points.map(point => [point.q, point.full]), xMap, yMap);
    const body = `${axes(width, height, left, right, top, bottom, 'dimensionless coordinate q', 'V/(ℏω)')}
      <path d="${harmonic}" fill="none" stroke="#312e81" stroke-width="4" stroke-dasharray="13 7"></path>
      <path d="${full}" fill="none" stroke="#0f766e" stroke-width="5"></path>
      <line x1="${xMap(0)}" x2="${xMap(0)}" y1="${top}" y2="${bottom}" stroke="#cbd5e1" stroke-dasharray="3 6"></line>
      <text x="${left}" y="28" class="metric-label">g=${model.g.toFixed(5)} · shape is controlled by g</text>`;
    if ($('scalingPlot')) $('scalingPlot').innerHTML = svg(width, height, body, 'Dimensionless harmonic and quartic oscillator potentials');
    setResult('scalingReadout', 'neutral', `<strong>Scale map:</strong> ω=${model.omega.toFixed(5)}, ℓ=${model.lengthScale.toFixed(5)}, ℏω=${model.energyScale.toFixed(5)}, and g=${model.g.toFixed(6)}. Telemetry is not a verdict: commit the inverse design below.`);
  }

  function lockScalingChallenge() {
    const result = evaluateScalingChallenge(inputNumber('scaleMass', 1), inputNumber('scaleForce', 1), inputNumber('scaleBeta', 0.1), $('scaleUnsolved')?.value || '');
    if (result.correct) {
      setResult('scalingChallengeFeedback', 'success', '<strong>Inverse design cleared.</strong> Both ω and g match within the fixed tolerances, and the remaining task is the anharmonic spectrum—not another choice of units.');
      earnMission('dimensionless-scaling');
      return;
    }
    const checks = [`ω target ${result.omegaError <= 5e-4 ? '✓' : '✗'}`, `g target ${result.gError <= 5e-5 ? '✓' : '✗'}`, `missing calculation ${result.reasoningCorrect ? '✓' : '✗'}`];
    setResult('scalingChallengeFeedback', 'needs-work', `<strong>Design not locked.</strong> ${checks.join(' · ')}. Retune all three parameters; matching only the potential shape does not determine the eigenvalues.`);
  }

  function updateRayleigh() {
    const a = inputNumber('rayleighA', 1), b = inputNumber('rayleighB', 0.2), d = inputNumber('rayleighD', 3), angle = inputNumber('rayleighAngle', 20);
    const model = rayleighQuotient2(a, b, d, angle);
    if ($('rayleighAngleValue')) $('rayleighAngleValue').textContent = `${angle.toFixed(1)}°`;
    const samples = Array.from({ length: 181 }, (_unused, index) => {
      const theta = index;
      return [theta, rayleighQuotient2(a, b, d, theta).energy];
    });
    const width = 720, height = 390, left = 70, right = 690, top = 48, bottom = 326;
    const minY = model.spectrum.values[0] - 0.08 * Math.max(1, model.spectrum.values[1] - model.spectrum.values[0]);
    const maxY = model.spectrum.values[1] + 0.08 * Math.max(1, model.spectrum.values[1] - model.spectrum.values[0]);
    const xMap = value => mapLinear(value, 0, 180, left, right);
    const yMap = value => mapLinear(value, minY, maxY, bottom, top);
    const curve = pathFrom(samples, xMap, yMap);
    const body = `${axes(width, height, left, right, top, bottom, 'trial-vector angle θ (degrees)', 'Rayleigh value')}
      <line x1="${left}" x2="${right}" y1="${yMap(model.spectrum.values[0])}" y2="${yMap(model.spectrum.values[0])}" stroke="#0f766e" stroke-width="2" stroke-dasharray="3 6"></line>
      <line x1="${left}" x2="${right}" y1="${yMap(model.spectrum.values[1])}" y2="${yMap(model.spectrum.values[1])}" stroke="#e11d48" stroke-width="2" stroke-dasharray="13 7"></line>
      <path d="${curve}" fill="none" stroke="#312e81" stroke-width="5"></path>
      <circle cx="${xMap(((angle % 180) + 180) % 180)}" cy="${yMap(model.energy)}" r="8" fill="#f59e0b" stroke="#78350f" stroke-width="3"></circle>
      <text x="${left}" y="27" class="metric-label">λ₀=${model.spectrum.values[0].toFixed(5)} · λ₁=${model.spectrum.values[1].toFixed(5)}</text>`;
    if ($('rayleighPlot')) $('rayleighPlot').innerHTML = svg(width, height, body, 'Rayleigh quotient landscape over normalized two-state trial vectors');
    setResult('rayleighReadout', model.residualNorm < 5e-4 ? 'warning' : 'neutral', `<strong>Trial audit:</strong> R=${model.energy.toFixed(7)} lies in [${model.spectrum.values[0].toFixed(7)}, ${model.spectrum.values[1].toFixed(7)}]; ‖Hc−Rc‖=${model.residualNorm.toExponential(3)}. ${model.residualNorm < 5e-4 ? 'A stationary candidate is close enough to classify and lock.' : 'Rotate manually; a nonzero residual means this direction is not an eigenvector.'}`);
  }

  function lockRayleigh(which) {
    const model = rayleighQuotient2(inputNumber('rayleighA', 1), inputNumber('rayleighB', 0.2), inputNumber('rayleighD', 3), inputNumber('rayleighAngle', 20));
    const index = which === 'minimum' ? 0 : 1;
    const energyDistance = Math.abs(model.energy - model.spectrum.values[index]);
    game.rayleigh.attempts += 1;
    if (model.residualNorm <= 5e-4 && energyDistance <= 1e-5) {
      game.rayleigh[which] = true;
      const count = Number(game.rayleigh.minimum) + Number(game.rayleigh.maximum);
      if ($('rayleighStage')) $('rayleighStage').textContent = `Stationary directions locked: ${count} / 2`;
      setResult('rayleighReadout', 'success', `<strong>${which === 'minimum' ? 'Minimum' : 'Maximum'} stationary direction locked.</strong> Residual ${model.residualNorm.toExponential(2)} and energy distance ${energyDistance.toExponential(2)} pass the fixed tolerances.`);
      if (count === 2) earnMission('rayleigh-quotient');
      return;
    }
    if (game.rayleigh.attempts >= 2 && $('rayleighRevealActions')) $('rayleighRevealActions').hidden = false;
    setResult('rayleighReadout', 'needs-work', `<strong>${which} not locked.</strong> Residual=${model.residualNorm.toExponential(2)} and distance to the classified rail=${energyDistance.toExponential(2)}. Search for a stationary direction${game.rayleigh.attempts >= 2 ? ', or inspect the now-unlocked reveal only after your attempt' : ''}.`);
  }

  function alignRayleigh(which) {
    const a = inputNumber('rayleighA', 1), b = inputNumber('rayleighB', 0.2), d = inputNumber('rayleighD', 3);
    const spectrum = symmetricEigen2x2(a, b, d);
    const vector = spectrum.vectors[which];
    let angle = degrees(Math.atan2(vector[1], vector[0]));
    angle = ((angle % 180) + 180) % 180;
    if ($('rayleighAngle')) $('rayleighAngle').value = angle.toFixed(6);
    updateRayleigh();
  }

  function updateGaussian() {
    const alpha = inputNumber('gaussianAlpha', 0.25);
    const model = gaussianVariational(alpha);
    if ($('gaussianAlphaValue')) $('gaussianAlphaValue').textContent = alpha.toFixed(3);
    const samples = Array.from({ length: 201 }, (_unused, index) => {
      const logAlpha = -1 + 2 * index / 200;
      const value = 10 ** logAlpha;
      return [logAlpha, gaussianVariational(value).energy];
    });
    const width = 720, height = 390, left = 70, right = 690, top = 48, bottom = 326;
    const xMap = value => mapLinear(value, -1, 1, left, right);
    const yMap = value => mapLinear(value, 0.45, 2.8, bottom, top);
    const curve = pathFrom(samples, xMap, yMap);
    const selectedX = Math.log10(alpha);
    const body = `${axes(width, height, left, right, top, bottom, 'log₁₀ α', 'trial energy')}
      <rect x="${xMap(-0.1)}" y="${top}" width="${xMap(0.1) - xMap(-0.1)}" height="${bottom - top}" fill="url(#approx-dots)" opacity=".32"></rect>
      <line x1="${left}" x2="${right}" y1="${yMap(0.5)}" y2="${yMap(0.5)}" stroke="#0f766e" stroke-width="3" stroke-dasharray="3 6"></line>
      <path d="${curve}" fill="none" stroke="#312e81" stroke-width="5"></path>
      <circle cx="${xMap(selectedX)}" cy="${yMap(model.energy)}" r="8" fill="#f59e0b" stroke="#78350f" stroke-width="3"></circle>
      <text x="${left}" y="27" class="metric-label">E(α)=α/4+1/(4α) · exact model ground 1/2</text>`;
    if ($('gaussianPlot')) $('gaussianPlot').innerHTML = svg(width, height, body, 'Gaussian harmonic-oscillator variational energy landscape');
    setResult('gaussianReadout', 'neutral', `<strong>Width telemetry:</strong> T=${model.kinetic.toFixed(6)}, V=${model.potential.toFixed(6)}, E=${model.energy.toFixed(6)}, upper error=${model.upperError.toExponential(3)}. ${model.virialBalanced ? 'T=V; commit this as the minimum only after both reciprocal samples are recorded.' : `T/V=${model.virialRatio.toFixed(4)}; narrowing and broadening carry opposite penalties.`}`);
  }

  function renderGaussianStage() {
    if ($('gaussianStage')) $('gaussianStage').textContent = `Evidence: diffuse ${Number(game.gaussian.diffuse)} · reciprocal prediction ${Number(game.gaussian.prediction)} · narrow ${Number(game.gaussian.narrow)} · minimum ${Number(game.gaussian.minimum)}`;
  }

  function commitGaussianPrediction() {
    game.gaussian.prediction = $('gaussianReciprocal')?.value === '4';
    renderGaussianStage();
    setResult('gaussianReadout', game.gaussian.prediction ? 'success' : 'needs-work', game.gaussian.prediction ? '<strong>Reciprocal prediction recorded.</strong> E(0.25)=E(4); now record both sides from the instrument.' : '<strong>Prediction not accepted.</strong> Use the displayed symmetry E(α)=E(1/α) without moving to the minimum.');
  }

  function recordGaussianSample() {
    const alpha = inputNumber('gaussianAlpha', 0.25);
    const diffusePartner = Math.abs(alpha - 0.25) <= 0.05;
    const narrowPartner = game.gaussian.prediction && Math.abs(alpha - 4) <= 0.05;
    if (diffusePartner) game.gaussian.diffuse = true;
    if (narrowPartner) game.gaussian.narrow = true;
    renderGaussianStage();
    const recorded = diffusePartner || narrowPartner;
    setResult('gaussianReadout', recorded ? 'success' : 'needs-work', recorded ? `<strong>Reciprocal sample recorded at α=${alpha.toFixed(2)}.</strong> The pair must contain both 0.25 and 4.00.` : '<strong>Sample not counted.</strong> Record the starting point α=0.25 and the committed reciprocal partner α=4.00 before searching the balance.');
  }

  function lockGaussianMinimum() {
    const alpha = inputNumber('gaussianAlpha', 0.25);
    const prerequisites = game.gaussian.diffuse && game.gaussian.prediction && game.gaussian.narrow;
    game.gaussian.attempts += 1;
    if (prerequisites && Math.abs(alpha - 1) <= 0.02) {
      game.gaussian.minimum = true;
      renderGaussianStage();
      setResult('gaussianReadout', 'success', '<strong>Variational path cleared.</strong> Reciprocal samples bracketed the manually located T=V minimum; exact agreement occurs because this special family contains the finite-model ground state.');
      earnMission('variational-gaussian');
      return;
    }
    if (game.gaussian.attempts >= 2 && $('gaussianOptimize')) $('gaussianOptimize').hidden = false;
    setResult('gaussianReadout', 'needs-work', `<strong>Minimum not locked.</strong> ${prerequisites ? 'Move until α≈1 and T/V≈1.' : 'Record diffuse and reciprocal-narrow samples and commit the reciprocal prediction first.'}${game.gaussian.attempts >= 2 ? ' The reveal helper is now available, but it does not earn the seal by itself.' : ''}`);
  }

  function updateBasis() {
    const size = Math.round(inputNumber('basisSize', 3));
    const model = basisTruncation(size);
    if ($('basisSizeValue')) $('basisSizeValue').textContent = String(size);
    const width = 720, height = 410, left = 72, right = 688, top = 48, middle = 225, bottom = 350;
    const xMap = value => mapLinear(value, 1, 6, left, right);
    const yEnergy = value => mapLinear(value, model.fullEnergy - 0.05, 2.1, middle - 20, top);
    const yResidual = value => mapLinear(value, 0, 1.05, bottom, middle + 28);
    const energyPath = pathFrom(model.sequence.map(item => [item.size, item.energy]), xMap, yEnergy);
    const residualPath = pathFrom(model.sequence.map(item => [item.size, item.residualNorm]), xMap, yResidual);
    const selected = model.sequence[size - 1];
    const body = `<line class="approx-axis" x1="${left}" x2="${right}" y1="${middle - 20}" y2="${middle - 20}"></line>
      <line class="approx-axis" x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}"></line>
      <path d="${energyPath}" fill="none" stroke="#312e81" stroke-width="5"></path>
      <line x1="${left}" x2="${right}" y1="${yEnergy(model.fullEnergy)}" y2="${yEnergy(model.fullEnergy)}" stroke="#0f766e" stroke-width="3" stroke-dasharray="3 6"></line>
      <path d="${residualPath}" fill="none" stroke="#d97706" stroke-width="4" stroke-dasharray="13 7"></path>
      ${model.sequence.map(item => `<circle cx="${xMap(item.size)}" cy="${yEnergy(item.energy)}" r="${item.size === size ? 8 : 5}" fill="${item.size === size ? '#f59e0b' : '#fff'}" stroke="#312e81" stroke-width="3"></circle><rect x="${xMap(item.size) - (item.size === size ? 7 : 4)}" y="${yResidual(item.residualNorm) - (item.size === size ? 7 : 4)}" width="${item.size === size ? 14 : 8}" height="${item.size === size ? 14 : 8}" fill="${item.size === size ? '#f59e0b' : '#fff'}" stroke="#9a3412" stroke-width="2"></rect>`).join('')}
      <text x="${left}" y="28" class="metric-label">upper panel: Ritz energy · lower panel: external residual</text>
      <text x="${(left + right) / 2}" y="${height - 15}" text-anchor="middle" class="axis-label">nested subspace size n</text>`;
    if ($('basisPlot')) $('basisPlot').innerHTML = svg(width, height, body, 'Nested six-site Ritz energy and external residual convergence');
    const verdict = evaluateBasisBudget(size);
    setResult('basisReadout', 'neutral', `<strong>Subspace n=${size} telemetry:</strong> E=${model.energy.toFixed(8)}, finite-oracle excess=${model.energyError.toExponential(3)} (${verdict.energyPass ? 'passes' : 'fails'} 0.080), external residual=${model.residualNorm.toExponential(3)} (${verdict.residualPass ? 'passes' : 'fails'} 0.300), cost ${verdict.costPass ? 'within' : 'over'} budget. Submit the smallest adequate space.`);
  }

  function submitBasisBudget() {
    const result = evaluateBasisBudget(Math.round(inputNumber('basisSize', 3)));
    if (result.correct) {
      setResult('basisReadout', 'success', '<strong>Cost-constrained Ritz mission cleared.</strong> n=5 is the smallest nested space meeting both fixed diagnostics while remaining within the five-vector budget.');
      earnMission('basis-truncation');
      return;
    }
    const reason = !result.energyPass || !result.residualPass ? 'At least one fixed scientific target fails.' : !result.costPass ? 'The six-vector oracle is accurate but exceeds the cost budget.' : 'A smaller adequate space exists.';
    setResult('basisReadout', 'needs-work', `<strong>Space not accepted.</strong> ${reason} Compare energy excess, residual, and cost together.`);
  }

  function syncOverlapCase() {
    const caseId = $('overlapCase')?.value || 'stable';
    const caseFile = OVERLAP_CASES[caseId];
    const ids = ['overlapH11', 'overlapH12', 'overlapH22', 'overlapS'];
    caseFile.values.forEach((value, index) => { if ($(ids[index])) $(ids[index]).value = String(value); });
    if ($('overlapAction')) $('overlapAction').value = '';
    updateOverlap();
  }

  function updateOverlap() {
    const overlap = inputNumber('overlapS', 0.3);
    const h11 = inputNumber('overlapH11', -1), h12 = inputNumber('overlapH12', -0.2), h22 = inputNumber('overlapH22', 0.4);
    const threshold = inputNumber('overlapThreshold', 0.03);
    const model = generalizedEigen2(h11, h12, h22, overlap);
    if ($('overlapSValue')) $('overlapSValue').textContent = overlap.toFixed(3);
    if ($('overlapThresholdValue')) $('overlapThresholdValue').textContent = threshold.toFixed(3);
    const width = 720, height = 390, left = 65, split = 470, right = 690, top = 52, bottom = 325;
    const samples = Array.from({ length: 191 }, (_unused, index) => {
      const s = -0.95 + 1.9 * index / 190;
      const m = generalizedEigen2(h11, h12, h22, s);
      return { s, min: m.overlapEigenvalues[0], max: m.overlapEigenvalues[1], logCondition: Math.log10(m.conditionNumber) };
    });
    const xMap = value => mapLinear(value, -0.95, 0.95, left, split - 25);
    const yMap = value => mapLinear(value, 0, 2, bottom, top);
    const minPath = pathFrom(samples.map(item => [item.s, item.min]), xMap, yMap);
    const maxPath = pathFrom(samples.map(item => [item.s, item.max]), xMap, yMap);
    const conditionPath = pathFrom(samples.map(item => [item.s, item.logCondition / 2]), xMap, yMap);
    const energyMin = Math.min(...model.values), energyMax = Math.max(...model.values);
    const railY = value => mapLinear(value, energyMin - 0.2 * Math.max(1, energyMax - energyMin), energyMax + 0.2 * Math.max(1, energyMax - energyMin), bottom, top);
    const rootGap = Math.abs(model.values[1] - model.values[0]);
    const groupedRoots = rootGap < 1e-10;
    let body = `<line class="approx-axis" x1="${left}" x2="${split - 25}" y1="${bottom}" y2="${bottom}"></line>
      <line class="approx-axis" x1="${left}" x2="${left}" y1="${top}" y2="${bottom}"></line>
      <path d="${minPath}" fill="none" stroke="#e11d48" stroke-width="4"></path>
      <path d="${maxPath}" fill="none" stroke="#0f766e" stroke-width="4" stroke-dasharray="13 7"></path>
      <path d="${conditionPath}" fill="none" stroke="#d97706" stroke-width="3" stroke-dasharray="3 6"></path>
      <line x1="${xMap(overlap)}" x2="${xMap(overlap)}" y1="${top}" y2="${bottom}" stroke="#312e81" stroke-width="3"></line>
      <text x="${left}" y="28" class="metric-label">overlap spectrum and log₁₀ κ/2</text>
      <text x="${split}" y="28" class="metric-label">generalized energy rails</text>`;
    if (groupedRoots) {
      const groupedY = railY((model.values[0] + model.values[1]) / 2);
      const rootStatus = rootGap === 0 ? 'exactly coincident roots' : `display-grouped · Δ=${rootGap.toExponential(2)}`;
      body += `<line data-generalized-energy="grouped" x1="${split}" x2="${right}" y1="${groupedY}" y2="${groupedY}" stroke="#312e81" stroke-width="6"></line>
        <path d="M ${split + 12} ${groupedY - 34} h 12 v 68 h -12" fill="none" stroke="#d97706" stroke-width="3" stroke-dasharray="3 5"></path>
        <text x="${split + 34}" y="${groupedY - 22}" class="axis-label">E₀=${model.values[0].toFixed(6)}</text>
        <text x="${split + 34}" y="${groupedY + 34}" class="axis-label">E₁=${model.values[1].toFixed(6)}</text>
        <text x="${split + 34}" y="${groupedY + 5}" class="metric-label">${rootStatus}</text>`;
    } else {
      body += `<line data-generalized-energy="lower" x1="${split}" x2="${right}" y1="${railY(model.values[0])}" y2="${railY(model.values[0])}" stroke="#312e81" stroke-width="5"></line>
        <line data-generalized-energy="upper" x1="${split}" x2="${right}" y1="${railY(model.values[1])}" y2="${railY(model.values[1])}" stroke="#0f766e" stroke-width="5" stroke-dasharray="13 7"></line>
        <text x="${split + 8}" y="${railY(model.values[0]) - 9}" class="axis-label">E₀=${model.values[0].toFixed(4)}</text>
        <text x="${split + 8}" y="${railY(model.values[1]) - 9}" class="axis-label">E₁=${model.values[1].toFixed(4)}</text>`;
    }
    if ($('overlapPlot')) $('overlapPlot').innerHTML = svg(width, height, body, 'Overlap eigenvalues, conditioning, and generalized energy levels', `data-generalized-root-lines="${groupedRoots ? 1 : 2}"`);
    setResult('overlapReadout', 'neutral', `<strong>Metric telemetry:</strong> eig(S)=[${model.overlapEigenvalues.map(value => value.toFixed(5)).join(', ')}], κ₂=${model.conditionNumber.toFixed(2)}, det(S)=${model.determinantOverlap.toFixed(5)}; generalized energies [${model.values.map(value => value.toFixed(6)).join(', ')}]. Choose an action and validate the observable under the threshold.`);
  }

  function submitOverlapRescue() {
    const caseId = $('overlapCase')?.value || 'stable';
    const result = evaluateOverlapRescue(caseId, $('overlapAction')?.value || '', inputNumber('overlapThreshold', 0.03));
    if (result.correct) {
      game.overlap.cleared.add(caseId);
      saveGameState();
      renderGameProgress();
      setResult('overlapReadout', 'success', `<strong>Rescue accepted for this artifact.</strong> Action, threshold range, and three-point observable scan pass; max |Δobservable| across threshold ±0.005 is ${result.maximumObservableDrift.toExponential(2)}. This cutoff remains case- and observable-specific.`);
      if (game.overlap.cleared.size === Object.keys(OVERLAP_CASES).length) earnMission('nonorthogonal-basis');
      return;
    }
    const checks = [`action ${result.actionCorrect ? '✓' : '✗'}`, `threshold ${result.thresholdPass ? '✓' : '✗'}`, `observable stability ${result.stabilityPass ? '✓' : '✗'}`];
    setResult('overlapReadout', 'needs-work', `<strong>Rescue not justified.</strong> ${checks.join(' · ')}. Grade the retained physics, not only κ₂ or matrix dimension.`);
  }

  function updatePerturbation() {
    const gap = inputNumber('perturbGap', 2), coupling = inputNumber('perturbCoupling', 0.5), lambda = inputNumber('perturbLambda', 0.4);
    const model = perturbationTwoLevel(gap, coupling, lambda);
    if ($('perturbGapValue')) $('perturbGapValue').textContent = gap.toFixed(2);
    if ($('perturbCouplingValue')) $('perturbCouplingValue').textContent = coupling.toFixed(2);
    if ($('perturbLambdaValue')) $('perturbLambdaValue').textContent = lambda.toFixed(2);
    const revealed = game.perturbation.revealed;
    if ($('perturbExactKey')) $('perturbExactKey').hidden = !revealed;
    if ($('perturbationCaption')) $('perturbationCaption').textContent = revealed
      ? 'The exact two-level curve and inset audit the committed finite-model claim; they are not a many-state molecular oracle.'
      : 'Commit an order and trust range before the exact finite-model oracle and error inset appear.';
    const samples = Array.from({ length: 151 }, (_unused, index) => {
      const l = index / 150;
      const m = perturbationTwoLevel(gap, coupling, l);
      return { lambda: l, exact: m.exactLower, order2: m.order2, order4: m.order4, error2: m.error2, error4: m.error4 };
    });
    const values = samples.flatMap(item => [item.exact, item.order2, item.order4, 0]);
    const minY = Math.min(...values), maxY = Math.max(...values);
    const width = 720, height = 390, left = 70, right = 690, top = 48, bottom = 326;
    const xMap = value => mapLinear(value, 0, 1, left, right);
    const yMap = value => mapLinear(value, minY - 0.08 * Math.max(0.1, maxY - minY), maxY + 0.08 * Math.max(0.1, maxY - minY), bottom, top);
    let body = `${axes(width, height, left, right, top, bottom, 'coupling scale λ', 'lower-state energy')}
      <path d="${pathFrom(samples.map(item => [item.lambda, item.order2]), xMap, yMap)}" fill="none" stroke="#312e81" stroke-width="4" stroke-dasharray="13 7"></path>
      <path d="${pathFrom(samples.map(item => [item.lambda, item.order4]), xMap, yMap)}" fill="none" stroke="#e11d48" stroke-width="4" stroke-dasharray="3 6"></path>`;
    if (game.perturbation.revealed) {
      const insetX = value => mapLinear(value, 0, 1, 500, 680);
      const insetY = value => mapLinear(value, -8, -1, 150, 68);
      const error2 = pathFrom(samples.map(item => [item.lambda, Math.log10(Math.max(item.error2, 1e-8))]), insetX, insetY);
      const error4 = pathFrom(samples.map(item => [item.lambda, Math.log10(Math.max(item.error4, 1e-8))]), insetX, insetY);
      body += `<path d="${pathFrom(samples.map(item => [item.lambda, item.exact]), xMap, yMap)}" fill="none" stroke="#0f766e" stroke-width="5"></path>
        <circle cx="${xMap(lambda)}" cy="${yMap(model.exactLower)}" r="8" fill="#f59e0b" stroke="#78350f" stroke-width="3"></circle>
        <rect x="490" y="52" width="198" height="112" rx="10" fill="#fff" stroke="#94a3b8"></rect>
        <path d="${error2}" fill="none" stroke="#312e81" stroke-width="3" stroke-dasharray="13 7"></path>
        <path d="${error4}" fill="none" stroke="#e11d48" stroke-width="3" stroke-dasharray="3 6"></path>
        <text x="500" y="64" class="axis-label">error inset · log₁₀|ΔE|</text>`;
    }
    body += `<text x="${left}" y="28" class="metric-label">${game.perturbation.revealed ? 'finite oracle revealed after commitment' : 'oracle hidden · compare retained orders first'}</text>`;
    if ($('perturbationPlot')) $('perturbationPlot').innerHTML = svg(width, height, body, 'Two-level retained perturbative orders with a commit-then-reveal finite oracle');
    const verdict = model.ratio < 0.1 ? 'weak in this finite model' : model.ratio < 0.3 ? 'intermediate: inspect orders' : 'large enough that low-order trust is risky';
    const detail = game.perturbation.revealed ? ` Exact=${model.exactLower.toFixed(8)}; errors: second ${model.error2.toExponential(2)}, fourth ${model.error4.toExponential(2)}.` : ' The exact finite-model energy and errors remain hidden until a trust-range commitment.';
    setResult('perturbationReadout', 'neutral', `<strong>Retained-order telemetry:</strong> |λV/Δ|=${model.ratio.toFixed(4)} (${verdict}); E⁽²⁾=${model.order2.toFixed(8)}, through fourth=${model.order4.toFixed(8)}.${detail}`);
  }

  function restorePerturbationMissionModel() {
    if ($('perturbGap')) $('perturbGap').value = '2';
    if ($('perturbCoupling')) $('perturbCoupling').value = '0.5';
    game.perturbation.revealed = false;
    updatePerturbation();
    setResult('perturbationReadout', 'neutral', '<strong>Fixed mission model restored.</strong> The graded trust claim uses Δ=2.00 and V=0.50; the exact curve is hidden again until commitment.');
  }

  function commitPerturbationTrust() {
    const gap = inputNumber('perturbGap', 2), coupling = inputNumber('perturbCoupling', 0.5);
    const fixedMissionModel = Math.abs(gap - 2) <= 1e-12 && Math.abs(coupling - 0.5) <= 1e-12;
    if (!fixedMissionModel) {
      setResult('perturbationReadout', 'needs-work', `<strong>Professor exploration is not graded.</strong> The visible Hamiltonian has Δ=${gap.toFixed(2)}, V=${coupling.toFixed(2)}, while this fixed-target mission certifies Δ=2.00, V=0.50. Return to the fixed mission model before committing.`);
      return;
    }
    const result = evaluatePerturbationTrust($('perturbOrderChoice')?.value || '', $('perturbRangeChoice')?.value || '');
    game.perturbation.revealed = true;
    updatePerturbation();
    if (result.correct) {
      setResult('perturbationReadout', 'success', `<strong>Order budget cleared.</strong> Fourth order is the least retained choice that supports the maximal tested λ≤0.6 range at the withheld point: error=${result.error.toExponential(3)} ≤ ${result.tolerance.toExponential(1)}.`);
      earnMission('nondegenerate-perturbation');
      return;
    }
    const reason = !result.safe ? `withheld error ${result.error.toExponential(3)} exceeds ${result.tolerance.toExponential(1)}` : !result.maximal ? 'the claim is safe but not the largest supported tested range' : 'the retained order is not the accepted cost/accuracy choice';
    setResult('perturbationReadout', 'needs-work', `<strong>Trust claim rejected after reveal.</strong> ${reason}. Use the error inset, revise, and do not turn the coupling ratio into a theorem.`);
  }

  function updateDegenerate() {
    const preset = $('degeneratePreset')?.value || 'split';
    const angle = inputNumber('degenerateAngle', 0);
    const values = preset === 'same' ? [0.7, 0, 0.7] : [inputNumber('degenerateW11', 1), inputNumber('degenerateW12', 0.5), inputNumber('degenerateW22', -1)];
    const model = degeneratePerturbation(values[0], values[1], values[2], angle);
    if ($('degenerateAngleValue')) $('degenerateAngleValue').textContent = `${angle.toFixed(1)}°`;
    for (const id of ['degenerateW11', 'degenerateW12', 'degenerateW22']) if ($(id)) $(id).disabled = preset === 'same';
    const width = 720, height = 380, left = 90, right = 660, center = 190;
    let body = `<line x1="${left}" x2="${center + 70}" y1="190" y2="190" stroke="#64748b" stroke-width="5" stroke-dasharray="13 7"></line><text x="${left}" y="168" class="axis-label">unperturbed E₀ ×2</text>`;
    if (model.coincident) {
      body += `<line data-degenerate-energy="coincident" x1="${center + 190}" x2="${right}" y1="190" y2="190" stroke="#0f766e" stroke-width="6"></line>
        <path d="M ${center + 170} 153 h 12 v 74 h -12 M ${center + 182} 190 h 8" fill="none" stroke="#e11d48" stroke-width="3" stroke-dasharray="3 5"></path>
        <text x="${center + 202}" y="160" class="metric-label">shift 1 = ${model.shifts[0].toFixed(3)}</text><text x="${center + 202}" y="226" class="metric-label">shift 2 = ${model.shifts[1].toFixed(3)}</text><text x="${center + 202}" y="184" class="axis-label">exact scalar W · no preferred direction</text>`;
    } else if (model.numericallyUnresolved) {
      body += `<line data-degenerate-energy="lower-unresolved" x1="${center + 190}" x2="${right}" y1="205" y2="205" stroke="#312e81" stroke-width="5"></line>
        <line data-degenerate-energy="upper-unresolved" x1="${center + 190}" x2="${right}" y1="175" y2="175" stroke="#0f766e" stroke-width="5" stroke-dasharray="13 7"></line>
        <path d="M ${center + 170} 175 h 12 v 30 h -12" fill="none" stroke="#d97706" stroke-width="3" stroke-dasharray="3 5"></path>
        <text x="${center + 202}" y="164" class="metric-label">w₊=${model.shifts[1].toExponential(3)}</text><text x="${center + 202}" y="226" class="metric-label">w₋=${model.shifts[0].toExponential(3)}</text><text x="${center + 202}" y="194" class="axis-label">display-separated · numerically unresolved, not exact</text>`;
    } else {
      const maxAbs = Math.max(Math.abs(model.shifts[0]), Math.abs(model.shifts[1]), 1);
      const y = value => 190 - 105 * value / maxAbs;
      body += `<line data-degenerate-energy="lower" x1="${center + 190}" x2="${right}" y1="${y(model.shifts[0])}" y2="${y(model.shifts[0])}" stroke="#312e81" stroke-width="6"></line>
        <line data-degenerate-energy="upper" x1="${center + 190}" x2="${right}" y1="${y(model.shifts[1])}" y2="${y(model.shifts[1])}" stroke="#0f766e" stroke-width="6" stroke-dasharray="13 7"></line>
        <text x="${center + 202}" y="${y(model.shifts[0]) - 10}" class="metric-label">w₋=${model.shifts[0].toFixed(4)}</text><text x="${center + 202}" y="${y(model.shifts[1]) - 10}" class="metric-label">w₊=${model.shifts[1].toFixed(4)}</text>`;
    }
    body += `<text x="${left}" y="35" class="metric-label">diagonalize W inside the complete degenerate subspace</text>`;
    const distinctLevelState = model.coincident ? '1' : model.numericallyUnresolved ? '2-unresolved' : '2';
    if ($('degeneratePlot')) $('degeneratePlot').innerHTML = svg(width, height, body, 'First-order shifts from diagonalizing a two-state degenerate perturbation', `data-distinct-levels="${distinctLevelState}"`);
    const interpretation = model.coincident
      ? 'Exact scalar-matrix case: one true energy line and no preferred basis.'
      : model.numericallyUnresolved
        ? `Two distinct computed shifts have Δ=${model.splitting.toExponential(3)}, below the display tolerance; they are numerically unresolved, not exactly degenerate, and the computed preferred direction is fragile.`
        : 'Lock a diagonal basis manually, rotate away from it, then verify invariants.';
    setResult('degenerateReadout', 'neutral', `<strong>Rotated W(${angle.toFixed(1)}°):</strong> [[${model.rotated[0][0].toFixed(5)}, ${model.rotated[0][1].toFixed(5)}], [${model.rotated[1][0].toFixed(5)}, ${model.rotated[1][1].toFixed(5)}]]. Off-diagonal residual=${model.offDiagonalResidual.toExponential(3)}; invariant shifts [${model.shifts.map(value => value.toFixed(6)).join(', ')}]. ${interpretation}`);
  }

  function renderDegenerateStage() {
    if ($('degenerateStage')) $('degenerateStage').textContent = `Stages: diagonal basis ${Number(game.degenerate.aligned)} · rotated invariants ${Number(game.degenerate.rotated)} · identity case ${Number(game.degenerate.identity)}`;
  }

  function lockDegenerateBasis() {
    const preset = $('degeneratePreset')?.value || 'split';
    const angle = inputNumber('degenerateAngle', 0);
    const model = degeneratePerturbation(inputNumber('degenerateW11', 1), inputNumber('degenerateW12', 0.5), inputNumber('degenerateW22', -1), angle);
    game.degenerate.attempts += 1;
    if (preset === 'split' && model.offDiagonalResidual <= 5e-4) {
      game.degenerate.aligned = true;
      game.degenerate.alignedAngle = angle;
      renderDegenerateStage();
      setResult('degenerateReadout', 'success', `<strong>Diagonal basis locked.</strong> Off-diagonal residual ${model.offDiagonalResidual.toExponential(2)} passes; now rotate at least 15° away and verify that physical shifts remain invariant.`);
      return;
    }
    if (game.degenerate.attempts >= 2 && $('degenerateAlign')) $('degenerateAlign').hidden = false;
    setResult('degenerateReadout', 'needs-work', `<strong>Basis not locked.</strong> Use the split case and reduce the off-diagonal residual below 5×10⁻⁴.${game.degenerate.attempts >= 2 ? ' A reveal helper is now available but cannot clear the stage alone.' : ''}`);
  }

  function verifyDegenerateInvariants() {
    const preset = $('degeneratePreset')?.value || 'split';
    const angle = inputNumber('degenerateAngle', 0);
    const model = degeneratePerturbation(inputNumber('degenerateW11', 1), inputNumber('degenerateW12', 0.5), inputNumber('degenerateW22', -1), angle);
    const rawDifference = game.degenerate.alignedAngle === null ? 0 : Math.abs(angle - game.degenerate.alignedAngle) % 180;
    const difference = Math.min(rawDifference, 180 - rawDifference);
    if (game.degenerate.aligned && preset === 'split' && difference >= 15 && model.offDiagonalResidual > 0.05) {
      game.degenerate.rotated = true;
      renderDegenerateStage();
      setResult('degenerateReadout', 'success', `<strong>Invariant transfer verified.</strong> A ${difference.toFixed(1)}° basis change restores an off-diagonal element while trace, determinant, and shifts remain unchanged. Now test the identity case.`);
      return;
    }
    setResult('degenerateReadout', 'needs-work', '<strong>Invariant stage not cleared.</strong> First lock a diagonal split basis, then rotate at least 15° away so basis-dependent entries visibly change.');
  }

  function confirmDegenerateIdentity() {
    const preset = $('degeneratePreset')?.value || 'split';
    const model = degeneratePerturbation(0.7, 0, 0.7, inputNumber('degenerateAngle', 0));
    if (game.degenerate.aligned && game.degenerate.rotated && preset === 'same' && model.coincident) {
      game.degenerate.identity = true;
      renderDegenerateStage();
      setResult('degenerateReadout', 'success', '<strong>Degenerate-subspace mission cleared.</strong> The split case required a diagonal basis; the identity case has coincident shifts and no preferred orientation.');
      earnMission('degenerate-perturbation');
      return;
    }
    setResult('degenerateReadout', 'needs-work', '<strong>Identity conclusion not accepted.</strong> Complete the split-basis and rotated-invariant stages first, then select the exact no-splitting identity case.');
  }

  function alignDegenerate() {
    const preset = $('degeneratePreset')?.value || 'split';
    if (preset === 'same') return updateDegenerate();
    const model = degeneratePerturbation(inputNumber('degenerateW11', 1), inputNumber('degenerateW12', 0.5), inputNumber('degenerateW22', -1), 0);
    if ($('degenerateAngle')) $('degenerateAngle').value = model.preferredAngle.toFixed(8);
    updateDegenerate();
  }

  function syncSeriesCase() {
    const value = $('seriesCase')?.value || '0.1';
    if ($('seriesG')) $('seriesG').value = value;
    if ($('seriesOrder')) $('seriesOrder').value = '4';
    game.series.revealed = false;
    if ($('seriesBest')) $('seriesBest').hidden = true;
    updateSeries();
  }

  function updateSeries() {
    const g = inputNumber('seriesG', 0.1), order = Math.round(inputNumber('seriesOrder', 4));
    const model = asymptoticSeriesModel(g, order, 14);
    if ($('seriesGValue')) $('seriesGValue').textContent = g.toFixed(3);
    if ($('seriesOrderValue')) $('seriesOrderValue').textContent = String(order);
    if ($('seriesTermKey')) $('seriesTermKey').hidden = game.series.revealed;
    if ($('seriesErrorKey')) $('seriesErrorKey').hidden = !game.series.revealed;
    if ($('seriesBestKey')) $('seriesBestKey').hidden = !game.series.revealed;
    if ($('seriesCaption')) $('seriesCaption').textContent = game.series.revealed
      ? 'The revealed error uses the finite numerical integral reference and documented tail bound; the best marker is oracle-specific.'
      : 'Before commitment, the plot exposes only term magnitudes; the numerical reference, error curve, and best marker remain hidden.';
    const logs = model.partials.map(item => Math.log10(Math.max(game.series.revealed ? item.error : Math.abs(item.term), 1e-14)));
    const minLog = Math.min(-1, ...logs) - 0.4, maxLog = Math.max(1, ...logs) + 0.4;
    const width = 720, height = 390, left = 70, right = 690, top = 48, bottom = 326;
    const xMap = value => mapLinear(value, 0, 14, left, right);
    const yMap = value => mapLinear(value, minLog, maxLog, bottom, top);
    const curve = pathFrom(model.partials.map((_item, index) => [index, logs[index]]), xMap, yMap);
    const body = `${axes(width, height, left, right, top, bottom, 'truncation order N', game.series.revealed ? 'log₁₀ absolute error' : 'log₁₀ |term|')}
      <path d="${curve}" fill="none" stroke="#312e81" stroke-width="5"></path>
      ${model.partials.map((_item, index) => `<circle cx="${xMap(index)}" cy="${yMap(logs[index])}" r="${index === order || (game.series.revealed && index === model.bestOrder) ? 8 : 4}" fill="${game.series.revealed && index === model.bestOrder ? '#0f766e' : index === order ? '#f59e0b' : '#fff'}" stroke="${game.series.revealed && index === model.bestOrder ? '#064e3b' : '#78350f'}" stroke-width="2"></circle>`).join('')}
      ${game.series.revealed ? `<line x1="${xMap(model.bestOrder)}" x2="${xMap(model.bestOrder)}" y1="${top}" y2="${bottom}" stroke="#0f766e" stroke-width="2" stroke-dasharray="3 6"></line>` : ''}
      <text x="${left}" y="28" class="metric-label">${game.series.revealed ? `reference revealed · best displayed order ${model.bestOrder}` : 'reference hidden · infer a stop from term behavior'}</text>`;
    if ($('seriesPlot')) $('seriesPlot').innerHTML = svg(width, height, body, game.series.revealed ? 'Reference error by asymptotic truncation order' : 'Term magnitudes before committing an asymptotic stopping order');
    if (game.series.revealed) {
      const trend = order > model.bestOrder ? 'Past the best displayed order: adding terms has reversed the improvement.' : order === model.bestOrder ? 'This is the best displayed finite order.' : 'The selected stop is earlier than the best displayed finite order.';
      setResult('seriesReadout', 'neutral', `<strong>Revealed order N=${order}:</strong> partial=${model.selected.sum.toFixed(9)}, finite numerical reference=${model.reference.toFixed(9)}, |error|=${model.selected.error.toExponential(3)}. ${trend}`);
    } else {
      const next = model.partials[Math.min(order + 1, model.maxOrder)];
      setResult('seriesReadout', 'neutral', `<strong>Commit-before-reveal telemetry:</strong> |term N=${order}|=${Math.abs(model.selected.term).toExponential(3)}; |next term|=${Math.abs(next.term).toExponential(3)}. The reference value, error curve, and best marker are hidden.`);
    }
  }

  function commitSeriesOrder() {
    const key = String($('seriesCase')?.value || '0.1');
    const g = Number(key), order = Math.round(inputNumber('seriesOrder', 4));
    const model = asymptoticSeriesModel(g, order, 14);
    game.series.attempts[key] = (game.series.attempts[key] || 0) + 1;
    game.series.revealed = true;
    updateSeries();
    if (order === model.bestOrder) {
      game.series.cleared.add(key);
      saveGameState();
      renderGameProgress();
      setResult('seriesReadout', 'success', `<strong>Stopping decision cleared for g=${g.toFixed(2)}.</strong> N=${order} is the best displayed finite stop; adding all terms is not the goal of an asymptotic expansion.`);
      if (game.series.cleared.size === 3) earnMission('series-budget');
      return;
    }
    if ($('seriesBest')) $('seriesBest').hidden = false;
    setResult('seriesReadout', 'needs-work', `<strong>Stopping decision missed after reveal.</strong> N=${order}, while the finite-reference scan places the best displayed stop at N=${model.bestOrder}. Use the term trend, revise, and transfer the rule to the next coupling.`);
  }

  function updateErrorCase() {
    const caseId = $('errorCase')?.value || 'reinforcing';
    const caseFile = ERROR_CASES[caseId];
    ['errorNumerical', 'errorBasis', 'errorModel', 'errorReference'].forEach((id, index) => { if ($(id)) $(id).value = caseFile.values[index]; });
    for (const id of ['errorDominant', 'errorCancellation', 'errorNextAction']) if ($(id)) $(id).value = '';
    game.errors.revealedCase = null;
    updateErrorBudget();
  }

  function updateErrorBudget() {
    const caseId = $('errorCase')?.value || 'reinforcing';
    const values = [inputNumber('errorNumerical', -74.95), inputNumber('errorBasis', -75), inputNumber('errorModel', -75.03), inputNumber('errorReference', -75.04)];
    const model = errorDecomposition(...values);
    if (game.errors.revealedCase !== caseId) {
      if ($('errorPlot')) $('errorPlot').innerHTML = svg(720, 390, '<rect x="48" y="54" width="624" height="282" rx="18" fill="url(#approx-dots)" opacity=".22"></rect><rect x="92" y="104" width="536" height="164" rx="14" fill="#fff" stroke="#94a3b8" stroke-width="3" stroke-dasharray="13 7"></rect><text x="360" y="172" text-anchor="middle" class="metric-label">signed ledger locked</text><text x="360" y="214" text-anchor="middle" class="axis-label">commit three decisions before decomposition</text>', 'Locked signed error ledger before the learner commits dominant layer, cancellation diagnosis, and next calculation');
      setResult('errorReadout', 'neutral', `<strong>Run table:</strong> E_num=${values[0].toFixed(5)}, E_basis=${values[1].toFixed(5)}, E_model=${values[2].toFixed(5)}, E_ref=${values[3].toFixed(5)}. Build the signed telescope on paper or mentally, then audit.`);
      return;
    }
    const items = [['solver', model.components.solver], ['representation', model.components.representation], ['model', model.components.model]];
    const maxAbs = Math.max(...items.map(item => Math.abs(item[1])), Math.abs(model.totalError), 1e-6);
    const width = 720, height = 390, zero = 360, scale = 270 / maxAbs;
    const body = `<line x1="${zero}" x2="${zero}" y1="45" y2="335" stroke="#64748b" stroke-width="3"></line>
      <text x="${zero - 8}" y="30" text-anchor="end" class="axis-label">negative</text><text x="${zero + 8}" y="30" class="axis-label">positive</text>
      ${items.map(([name, value], index) => {
        const y = 78 + 74 * index;
        const widthBar = Math.abs(value) * scale;
        const x = value >= 0 ? zero : zero - widthBar;
        const fill = name === 'solver' ? '#312e81' : name === 'representation' ? '#0f766e' : 'url(#approx-hatch)';
        return `<text x="48" y="${y + 19}" class="metric-label">${name}</text><rect x="${x}" y="${y}" width="${Math.max(2, widthBar)}" height="28" rx="6" fill="${fill}" stroke="#334155" stroke-width="2"></rect><text x="${value >= 0 ? x + widthBar + 8 : x - 8}" y="${y + 20}" text-anchor="${value >= 0 ? 'start' : 'end'}" class="axis-label">${value >= 0 ? '+' : ''}${value.toFixed(5)}</text>`;
      }).join('')}
      <line x1="48" x2="672" y1="308" y2="308" stroke="#cbd5e1"></line>
      <text x="48" y="345" class="metric-label">net total ${model.totalError >= 0 ? '+' : ''}${model.totalError.toFixed(5)} · absolute burden ${model.absoluteBurden.toFixed(5)}</text>`;
    if ($('errorPlot')) $('errorPlot').innerHTML = svg(width, height, body, 'Signed solver, representation, and model error components');
    setResult('errorReadout', 'neutral', `<strong>Revealed ledger:</strong> δ_solver=${model.components.solver.toFixed(6)} + δ_repr=${model.components.representation.toFixed(6)} + δ_model=${model.components.model.toFixed(6)} = δ_total=${model.totalError.toFixed(6)}. Dominant absolute component: ${model.dominant}. ${model.cancellation ? 'Cancellation warning: the small net error hides larger opposed components.' : 'No strong cancellation under the displayed diagnostic.'} These signed differences are not statistical uncertainties.`);
  }

  function submitErrorAudit() {
    const caseId = $('errorCase')?.value || 'reinforcing';
    const result = evaluateErrorLedger(caseId, {
      dominant: $('errorDominant')?.value || '',
      cancellation: $('errorCancellation')?.value || '',
      nextAction: $('errorNextAction')?.value || ''
    });
    game.errors.revealedCase = caseId;
    updateErrorBudget();
    if (result.correct) {
      game.errors.cleared.add(caseId);
      saveGameState();
      renderGameProgress();
      setResult('errorReadout', 'success', `<strong>Error-ledger run cleared.</strong> Dominant layer, cancellation state, and targeted next calculation all follow from the signed telescope. Net δ=${result.model.totalError.toFixed(5)}; absolute burden=${result.model.absoluteBurden.toFixed(5)}.`);
      if (game.errors.cleared.size === Object.keys(ERROR_CASES).length) earnMission('error-decomposition');
      return;
    }
    const checks = [`dominant layer ${result.fields.dominant ? '✓' : '✗'}`, `cancellation ${result.fields.cancellation ? '✓' : '✗'}`, `next calculation ${result.fields.nextAction ? '✓' : '✗'}`];
    setResult('errorReadout', 'needs-work', `<strong>Ledger audit needs revision.</strong> ${checks.join(' · ')}. The revealed bars show signed components; target the largest unresolved layer rather than celebrating a small net total.`);
  }

  function syncResidualCase() {
    const caseId = $('residualCase')?.value || 'valid';
    const caseFile = RESIDUAL_CASES[caseId];
    if ($('residualTheta')) $('residualTheta').value = String(caseFile.angles[0]);
    if ($('residualMix')) $('residualMix').value = String(caseFile.angles[1]);
    if ($('residualDecision')) $('residualDecision').value = '';
    if ($('residualClaim')) $('residualClaim').textContent = caseFile.claim;
    game.residual.revealedCase = null;
    updateResidual();
  }

  function updateResidual() {
    const caseId = $('residualCase')?.value || 'valid';
    const theta = inputNumber('residualTheta', 20), phi = inputNumber('residualMix', 35);
    const model = residualCertificate(theta, phi);
    const revealed = game.residual.revealedCase === caseId;
    if ($('residualThetaValue')) $('residualThetaValue').textContent = `${theta.toFixed(1)}°`;
    if ($('residualMixValue')) $('residualMixValue').textContent = `${phi.toFixed(1)}°`;
    const lowerForScale = model.lowerBound === null ? 0 : model.lowerBound;
    const minE = Math.min(-0.4, lowerForScale - 0.15), maxE = Math.max(4.2, model.rayleigh + 0.2);
    const width = 720, height = 390, left = 120, right = 650, top = 48, bottom = 326;
    const y = value => mapLinear(value, minE, maxE, bottom, top);
    const targetGapKnown = caseId !== 'wrong-root' || revealed;
    let body = '';
    if (targetGapKnown) {
      body += `<line x1="${left + 100}" x2="${right - 30}" y1="${y(0)}" y2="${y(0)}" stroke="#0f766e" stroke-width="5"></line><text x="${left}" y="${y(0) + 6}" class="metric-label">exact E₀=0</text>
        <line x1="${left + 100}" x2="${right - 30}" y1="${y(1.5)}" y2="${y(1.5)}" stroke="#64748b" stroke-width="3" stroke-dasharray="13 7"></line><text x="${left}" y="${y(1.5) + 6}" class="metric-label">E₁=1.5</text>`;
    } else {
      body += `<rect x="${left + 32}" y="${top + 14}" width="${right - left - 64}" height="58" rx="10" fill="url(#approx-dots)" opacity=".5" stroke="#64748b" stroke-width="2"></rect><text x="${(left + right) / 2}" y="${top + 49}" text-anchor="middle" class="metric-label">target-root separation not supplied</text>`;
    }
    body += `<line x1="${left + 100}" x2="${right - 30}" y1="${y(model.rayleigh)}" y2="${y(model.rayleigh)}" stroke="#312e81" stroke-width="6"></line><text x="${right - 35}" y="${Math.max(top + (targetGapKnown ? 18 : 88), y(model.rayleigh) - 12)}" text-anchor="end" class="metric-label">μ=${model.rayleigh.toFixed(4)}</text>`;
    if (revealed && model.applicable) {
      body += `<line x1="${left + 135}" x2="${left + 135}" y1="${y(model.lowerBound)}" y2="${y(model.rayleigh)}" stroke="#d97706" stroke-width="5"></line><path d="M ${left + 122} ${y(model.lowerBound)} h 26 M ${left + 122} ${y(model.rayleigh)} h 26" stroke="#d97706" stroke-width="4"></path><text x="${left + 155}" y="${y(model.lowerBound) + 6}" class="axis-label">Temple lower ${model.lowerBound.toFixed(4)}</text>`;
    } else if (revealed) {
      body += `<rect x="${left + 105}" y="${top + 15}" width="${right - left - 145}" height="54" rx="10" fill="url(#approx-hatch)" stroke="#e11d48"></rect><text x="${left + 125}" y="${top + 48}" class="metric-label">certificate unavailable: μ is not below E₁</text>`;
    } else if (caseId !== 'wrong-root') {
      body += `<text x="${left + 120}" y="${top + 48}" class="metric-label">conditional bracket hidden until claim commitment</text>`;
    }
    body += `<text x="${left}" y="28" class="metric-label">variance = residual² = ${model.variance.toExponential(3)}</text>`;
    if ($('residualPlot')) $('residualPlot').innerHTML = svg(width, height, body, 'Variational upper value and commit-then-reveal conditional residual certificate');
    let verdict;
    if (!revealed) verdict = caseId === 'wrong-root' ? 'The target-root separation and bracket width are not in the supplied production report.' : 'The conditional bracket verdict is withheld until you commit.';
    else if (caseId === 'wrong-root' && model.applicable) verdict = `Oracle reveal: this trial sits near E₁; the formal finite-model bracket is [${model.lowerBound.toFixed(6)}, ${model.upperBound.toFixed(6)}], but its width shows why the tiny residual alone did not identify a useful ground-root approximation.`;
    else if (caseId === 'wrong-root') verdict = 'Professor exploration: this custom trial violates μ<E₁, so no Temple-type lower bracket is available; it is not the fixed claim-file evidence.';
    else verdict = model.applicable ? `Because μ&lt;E₁, the finite-model bracket is [${model.lowerBound.toFixed(6)}, ${model.upperBound.toFixed(6)}].` : 'Because μ≥E₁, this Temple-type lower bracket is not available.';
    setResult('residualReadout', 'neutral', `<strong>Trial evidence:</strong> c=(${model.coefficients.map(value => value.toFixed(4)).join(', ')}), μ=${model.rayleigh.toFixed(6)}, ‖r‖=${model.residualNorm.toExponential(3)}, variance=${model.variance.toExponential(3)}. ${verdict} A residual without target-root separation can certify the wrong state.`);
  }

  function restoreResidualClaimFile() {
    syncResidualCase();
    setResult('residualReadout', 'neutral', '<strong>Claim-file trial restored.</strong> The graded decision now matches the displayed fixed dossier evidence; the oracle remains hidden until commitment.');
  }

  function submitResidualClaim() {
    const caseId = $('residualCase')?.value || 'valid';
    const caseFile = RESIDUAL_CASES[caseId];
    const theta = inputNumber('residualTheta', caseFile.angles[0]), phi = inputNumber('residualMix', caseFile.angles[1]);
    const fixedClaimFile = Math.abs(theta - caseFile.angles[0]) <= 1e-12 && Math.abs(phi - caseFile.angles[1]) <= 1e-12;
    if (!fixedClaimFile) {
      setResult('residualReadout', 'needs-work', `<strong>Professor exploration is not graded.</strong> The visible trial (θ=${theta.toFixed(2)}°, φ=${phi.toFixed(2)}°) differs from claim file ${caseId}. Return to the claim-file trial before committing a dossier decision.`);
      return;
    }
    const result = evaluateResidualClaim(caseId, $('residualDecision')?.value || '');
    game.residual.revealedCase = caseId;
    updateResidual();
    if (result.correct) {
      game.residual.cleared.add(caseId);
      saveGameState();
      renderGameProgress();
      setResult('residualReadout', 'success', `<strong>Claim file cleared.</strong> ${esc(result.reason)} μ=${result.model.rayleigh.toFixed(5)}, ‖r‖=${result.model.residualNorm.toExponential(2)}.`);
      if (game.residual.cleared.size === Object.keys(RESIDUAL_CASES).length) earnMission('residual-bounds');
      return;
    }
    setResult('residualReadout', 'needs-work', `<strong>Claim rejected.</strong> ${esc(result.reason)} Distinguish bracket hypotheses from residual size and target-root identity, then revise.`);
  }

  function syncBoss() {
    const caseId = $('approxBossCase')?.value || 'ground-upper-bound';
    const caseFile = CAMPAIGN_CASES[caseId];
    const stage = game.boss.cleared.has(caseId) ? 3 : (game.boss.stage[caseId] || 0);
    const answers = game.boss.answers[caseId] || {};
    if ($('approxBossTitle')) $('approxBossTitle').textContent = caseFile.title;
    if ($('approxBossMethod')) $('approxBossMethod').value = answers.method || '';
    if ($('approxBossDiagnostic')) $('approxBossDiagnostic').value = answers.diagnostic || '';
    if ($('approxBossEvidence')) $('approxBossEvidence').value = answers.evidence || '';
    if ($('approxBossBudget')) $('approxBossBudget').textContent = `Investigation tokens: ${game.boss.budget[caseId] ?? 4} / 4`;
    if ($('approxBossMethod')) $('approxBossMethod').disabled = stage !== 0;
    if ($('approxBossDiagnostic')) $('approxBossDiagnostic').disabled = stage !== 1;
    if ($('approxBossEvidence')) $('approxBossEvidence').disabled = stage !== 2;
    if ($('approxBossArtifact')) $('approxBossArtifact').textContent = stage === 0 ? caseFile.brief : stage === 1 ? caseFile.artifacts[0] : stage === 2 ? `${caseFile.artifacts[0]} ${caseFile.artifacts[1]}` : caseFile.artifacts.join(' ');
    if ($('approxBossAudit')) $('approxBossAudit').textContent = stage === 0 ? 'Commit method' : stage === 1 ? 'Commit diagnostic' : stage === 2 ? 'Commit evidence' : 'Dossier cleared';
    if ($('approxBossAudit')) $('approxBossAudit').disabled = stage === 3;
    setResult('approxBossFeedback', stage === 3 ? 'success' : 'neutral', stage === 3 ? `<strong>Dossier already cleared.</strong> ${esc(caseFile.caveat)}` : '<strong>Evolving dossier.</strong> Each correct commitment unlocks the next artifact; a wrong commitment spends one token.');
  }

  function auditBoss() {
    const caseId = $('approxBossCase')?.value || 'ground-upper-bound';
    const caseFile = CAMPAIGN_CASES[caseId];
    let stage = game.boss.stage[caseId] || 0;
    if (game.boss.cleared.has(caseId)) return;
    const fields = ['method', 'diagnostic', 'evidence'];
    const controls = ['approxBossMethod', 'approxBossDiagnostic', 'approxBossEvidence'];
    const field = fields[stage];
    const actual = $(controls[stage])?.value || '';
    const correct = actual === caseFile.expected[field];
    if (!correct) {
      game.boss.budget[caseId] = (game.boss.budget[caseId] ?? 4) - 1;
      const exhausted = game.boss.budget[caseId] <= 0;
      const feedback = caseFile.feedback[field];
      if (exhausted) {
        game.boss.stage[caseId] = 0;
        game.boss.budget[caseId] = 4;
        game.boss.answers[caseId] = {};
        for (const id of controls) if ($(id)) $(id).value = '';
      }
      syncBoss();
      setResult('approxBossFeedback', 'needs-work', `<strong>${field} commitment rejected${exhausted ? '; dossier reset with a fresh four-token budget' : ''}.</strong> ${esc(feedback)} No answer slug is revealed; use the surviving artifact and revise.`);
      return;
    }
    game.boss.answers[caseId] ||= {};
    game.boss.answers[caseId][field] = actual;
    stage += 1;
    game.boss.stage[caseId] = stage;
    if (stage === 3) {
      game.boss.cleared.add(caseId);
      saveGameState();
      renderGameProgress();
      syncBoss();
      const prerequisites = MISSION_IDS.slice(0, 11).filter(id => game.cleared.has(id)).length;
      setResult('approxBossFeedback', 'success', `<strong>Dossier cleared.</strong> ${esc(caseFile.artifacts[2])} <em>${esc(caseFile.caveat)}</em> Notebook prerequisites: ${prerequisites}/11.`);
      maybeEarnBoss();
      return;
    }
    syncBoss();
    setResult('approxBossFeedback', 'success', `<strong>${field} commitment accepted.</strong> ${esc(caseFile.artifacts[stage - 1])} The next decision is now unlocked.`);
  }

  function bindInputs(ids, callback) {
    ids.forEach(id => {
      $(id)?.addEventListener('input', callback);
      $(id)?.addEventListener('change', callback);
    });
  }

  function init() {
    restoreGameState();

    $('approxPassportCase')?.addEventListener('change', updatePassportPrompt);
    $('approxPassportAudit')?.addEventListener('click', auditPassport);
    bindInputs(['scaleMass', 'scaleForce', 'scaleBeta'], updateScaling);
    $('scalingLock')?.addEventListener('click', lockScalingChallenge);

    bindInputs(['rayleighAngle'], updateRayleigh);
    bindInputs(['rayleighA', 'rayleighB', 'rayleighD'], () => {
      if (!game.cleared.has('rayleigh-quotient')) Object.assign(game.rayleigh, { minimum: false, maximum: false });
      updateRayleigh();
    });
    $('rayleighLockMin')?.addEventListener('click', () => lockRayleigh('minimum'));
    $('rayleighLockMax')?.addEventListener('click', () => lockRayleigh('maximum'));
    $('rayleighMinimize')?.addEventListener('click', () => alignRayleigh(0));
    $('rayleighMaximize')?.addEventListener('click', () => alignRayleigh(1));

    bindInputs(['gaussianAlpha'], updateGaussian);
    $('gaussianCommitPrediction')?.addEventListener('click', commitGaussianPrediction);
    $('gaussianRecord')?.addEventListener('click', recordGaussianSample);
    $('gaussianLockMinimum')?.addEventListener('click', lockGaussianMinimum);
    $('gaussianOptimize')?.addEventListener('click', () => { if ($('gaussianAlpha')) $('gaussianAlpha').value = '1'; updateGaussian(); });

    bindInputs(['basisSize'], updateBasis);
    $('basisSubmit')?.addEventListener('click', submitBasisBudget);

    $('overlapCase')?.addEventListener('change', syncOverlapCase);
    bindInputs(['overlapS', 'overlapH11', 'overlapH12', 'overlapH22', 'overlapThreshold'], updateOverlap);
    $('overlapSubmit')?.addEventListener('click', submitOverlapRescue);

    bindInputs(['perturbGap', 'perturbCoupling', 'perturbLambda'], () => {
      if (!game.cleared.has('nondegenerate-perturbation')) game.perturbation.revealed = false;
      updatePerturbation();
    });
    $('perturbMissionModel')?.addEventListener('click', restorePerturbationMissionModel);
    for (const id of ['perturbOrderChoice', 'perturbRangeChoice']) $(id)?.addEventListener('change', () => {
      updatePerturbation();
    });
    $('perturbCommit')?.addEventListener('click', commitPerturbationTrust);

    bindInputs(['degeneratePreset', 'degenerateW11', 'degenerateW12', 'degenerateW22', 'degenerateAngle'], updateDegenerate);
    $('degenerateLock')?.addEventListener('click', lockDegenerateBasis);
    $('degenerateCheckInvariants')?.addEventListener('click', verifyDegenerateInvariants);
    $('degenerateIdentity')?.addEventListener('click', confirmDegenerateIdentity);
    $('degenerateAlign')?.addEventListener('click', alignDegenerate);

    $('seriesCase')?.addEventListener('change', syncSeriesCase);
    bindInputs(['seriesOrder'], updateSeries);
    $('seriesCommit')?.addEventListener('click', commitSeriesOrder);
    $('seriesBest')?.addEventListener('click', () => {
      const model = asymptoticSeriesModel(inputNumber('seriesG', 0.1), 0, 14);
      if ($('seriesOrder')) $('seriesOrder').value = String(model.bestOrder);
      updateSeries();
    });

    $('errorCase')?.addEventListener('change', updateErrorCase);
    bindInputs(['errorNumerical', 'errorBasis', 'errorModel', 'errorReference'], () => {
      game.errors.revealedCase = null;
      updateErrorBudget();
    });
    $('errorAudit')?.addEventListener('click', submitErrorAudit);

    $('residualCase')?.addEventListener('change', syncResidualCase);
    bindInputs(['residualTheta', 'residualMix'], () => {
      game.residual.revealedCase = null;
      updateResidual();
    });
    $('residualAudit')?.addEventListener('click', submitResidualClaim);
    $('residualRestoreCase')?.addEventListener('click', restoreResidualClaimFile);
    $('residualGround')?.addEventListener('click', () => { if ($('residualTheta')) $('residualTheta').value = '0'; game.residual.revealedCase = null; updateResidual(); });

    $('approxBossCase')?.addEventListener('change', syncBoss);
    $('approxBossAudit')?.addEventListener('click', auditBoss);

    updatePassportPrompt();
    updateScaling();
    updateRayleigh();
    updateGaussian();
    renderGaussianStage();
    updateBasis();
    syncOverlapCase();
    updatePerturbation();
    updateDegenerate();
    renderDegenerateStage();
    syncSeriesCase();
    updateErrorCase();
    syncResidualCase();
    syncBoss();

    window.ProjectXCAcademy?.bindChapter({ chapterId: 'qc-approximations', totalMissions: 12 });
    renderGameProgress();
    document.querySelectorAll('.academy-complete[data-game-gate]').forEach(button => button.addEventListener('click', () => window.setTimeout(() => {
      renderGameProgress();
      if (button.disabled) {
        const heading = button.closest('.academy-lesson')?.querySelector('h2');
        if (heading) {
          heading.tabIndex = -1;
          heading.focus();
        }
      }
    }, 0)));
    $('resetChapterProgress')?.addEventListener('click', resetGameState);
  }

  window.QCApproximationModels = Object.freeze({
    evaluateApproximationPassport,
    dimensionlessQuartic,
    evaluateScalingChallenge,
    symmetricEigen2x2,
    rayleighQuotient2,
    gaussianVariational,
    basisTruncation,
    evaluateBasisBudget,
    generalizedEigen2,
    evaluateOverlapRescue,
    perturbationTwoLevel,
    evaluatePerturbationTrust,
    degeneratePerturbation,
    asymptoticIntegral,
    asymptoticSeriesModel,
    errorDecomposition,
    evaluateErrorLedger,
    residualCertificate,
    evaluateResidualClaim,
    evaluateApproximationCase
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
