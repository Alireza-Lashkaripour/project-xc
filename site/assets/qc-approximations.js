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
      title: 'Gaussian trial family for a harmonic ground state',
      method: 'variational',
      layer: 'ansatz',
      diagnostic: 'Rayleigh upper bound and stationarity',
      diagnosticStamp: 'Rayleigh + stationarity',
      evidenceStamp: 'Enlarge trial family',
      evidence: 'Show normalization, the Rayleigh upper bound, a stable minimum, and what happens when the trial family is enlarged.',
      caveat: 'A variational upper bound does not by itself guarantee an accurate wavefunction or an accurate energy difference.'
    },
    'six-site-subspace': {
      title: 'Lowest root in the first n sites of a fixed six-site Hamiltonian',
      method: 'representation-truncation',
      layer: 'representation',
      diagnostic: 'Nested Ritz energy and external residual',
      diagnosticStamp: 'Ritz + external residual',
      evidenceStamp: 'Nested finite oracle',
      evidence: 'Use nested spaces, monotone Ritz energies, an external residual, and comparison with the declared six-site oracle.',
      caveat: 'Convergence to the full six-site matrix is not convergence to a continuum or complete-basis-set limit.'
    },
    'weak-two-level': {
      title: 'Weak off-diagonal coupling to one isolated level',
      method: 'perturbation',
      layer: 'series-truncation',
      diagnostic: 'Coupling-to-gap ratio and retained-order drift',
      diagnosticStamp: '|λV/Δ| + order drift',
      evidenceStamp: 'Order scan + exact 2×2',
      evidence: 'Inspect the coupling-to-gap ratio and compare successive retained orders against exact diagonalization in this finite model.',
      caveat: 'A small ratio is a local diagnostic, not a universal proof that every observable or geometry is converged.'
    },
    'harmonic-replacement': {
      title: 'Replace an anharmonic potential by its quadratic expansion',
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
    'weak-isolated': {
      title: 'Weak, isolated state coupling',
      expected: { method: 'nondegenerate-perturbation', diagnostic: 'coupling-gap-ratio', evidence: 'order-stability' },
      feedback: {
        method: 'Use nondegenerate perturbation theory only because the target is isolated before the coupling is applied.',
        diagnostic: 'The dimensionless coupling-to-gap ratio tests the local small parameter rather than the raw coupling alone.',
        evidence: 'Compare retained orders and, where possible, a finite exact or higher-level reference.'
      },
      caveat: 'Order stability for one energy does not certify wavefunctions, derivatives, or a path that approaches a crossing.'
    },
    'degenerate-pair': {
      title: 'Exactly degenerate pair with a coupled perturbation',
      expected: { method: 'degenerate-perturbation', diagnostic: 'subspace-offdiagonal', evidence: 'basis-invariance' },
      feedback: {
        method: 'Diagonalize the perturbation in the complete degenerate subspace before assigning first-order shifts.',
        diagnostic: 'A nonzero off-diagonal element in the chosen basis proves that reading only diagonal entries is basis dependent.',
        evidence: 'Rotate the basis and verify that trace, determinant, and the two physical shifts remain invariant.'
      },
      caveat: 'A truncated degenerate subspace can still miss nearby states; exact degeneracy also means no preferred orientation when the restricted perturbation is proportional to identity.'
    },
    'ground-upper-bound': {
      title: 'Ground-state estimate from a nested trial space',
      expected: { method: 'variational-ritz', diagnostic: 'rayleigh-residual', evidence: 'nested-convergence' },
      feedback: {
        method: 'Use a normalized admissible variational/Ritz trial because the requested root is the ground state.',
        diagnostic: 'Report both the Rayleigh value and residual; a low energy alone can hide an unresolved direction.',
        evidence: 'Enlarge a truly nested space and show monotone upper estimates together with a stated finite or external target.'
      },
      caveat: 'The upper-bound property has hypotheses and does not turn an arbitrary nonvariational energy correction into a bound.'
    },
    'overlap-collapse': {
      title: 'Two nearly duplicate nonorthogonal basis functions',
      expected: { method: 'generalized-eigenproblem', diagnostic: 'overlap-spectrum', evidence: 'threshold-stability' },
      feedback: {
        method: 'Keep the metric explicit through Hc=ESc or transform with a controlled positive-definite overlap treatment.',
        diagnostic: 'Inspect the smallest overlap eigenvalue and condition number rather than overlap entries in isolation.',
        evidence: 'Vary the near-dependence threshold and show that retained physical results—not merely matrix dimensions—are stable.'
      },
      caveat: 'There is no universal overlap cutoff; deleting directions changes the representation and can remove chemically important flexibility.'
    },
    'factorial-tail': {
      title: 'Factorially growing perturbation coefficients',
      expected: { method: 'asymptotic-truncation', diagnostic: 'least-term', evidence: 'order-scan' },
      feedback: {
        method: 'Treat the expansion as asymptotic and choose a finite truncation instead of assuming its infinite sum converges.',
        diagnostic: 'Track the least term and actual partial-sum error in a model with a reference value.',
        evidence: 'Scan order at several coupling values and expose where adding terms reverses the improvement.'
      },
      caveat: 'The least-term rule is an asymptotic guide; a rigorous remainder or resummation requires additional analytic information.'
    }
  });

  const ERROR_CASES = Object.freeze({
    reinforcing: { title: 'All layers reinforce', values: [-74.95, -75.00, -75.03, -75.04] },
    cancellation: { title: 'Large components cancel', values: [-75.05, -75.00, -75.03, -75.04] },
    'converged-not-accurate': { title: 'Solver converged; model misses', values: [-75.001, -75.000, -75.002, -75.080] }
  });

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

  function degeneratePerturbation(w11, w12, w22, angleDegrees = 0) {
    requireFinite('degeneratePerturbation', w11, w12, w22, angleDegrees);
    const spectrum = symmetricEigen2x2(w11, w12, w22);
    const angle = radians(angleDegrees);
    const c = Math.cos(angle), s = Math.sin(angle);
    const r11 = c * c * w11 + 2 * c * s * w12 + s * s * w22;
    const r22 = s * s * w11 - 2 * c * s * w12 + c * c * w22;
    const r12 = (w22 - w11) * c * s + w12 * (c * c - s * s);
    const splitting = spectrum.values[1] - spectrum.values[0];
    const coincident = Math.abs(splitting) < 1e-12;
    let preferredAngle = null;
    if (!coincident) {
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
      coincident,
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
    numerical: 'Solver only'
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
    if ($('approxPassportMethod')) $('approxPassportMethod').value = '';
    if ($('approxPassportLayer')) $('approxPassportLayer').value = '';
    setPassportStamp('approxStampMethod', 'METHOD');
    setPassportStamp('approxStampLayer', 'OMISSION');
    setPassportStamp('approxStampDiagnostic', 'DIAGNOSTIC');
    setPassportStamp('approxStampEvidence', 'EVIDENCE');
    if ($('approxPassportFeedback')) {
      $('approxPassportFeedback').textContent = 'Choose both the operation and the dominant omitted layer, then audit the claim.';
      delete $('approxPassportFeedback').dataset.state;
    }
  }

  function auditPassport() {
    const caseId = $('approxPassportCase')?.value || 'gaussian-family';
    const caseFile = PASSPORT_CASES[caseId];
    const result = evaluateApproximationPassport(caseId, {
      method: $('approxPassportMethod')?.value,
      layer: $('approxPassportLayer')?.value
    });
    setPassportStamp('approxStampMethod', 'METHOD', PASSPORT_METHOD_LABELS[result.fields.method.expected], result.fields.method.correct ? 'pass' : 'revise');
    setPassportStamp('approxStampLayer', 'OMISSION', PASSPORT_LAYER_LABELS[result.fields.layer.expected], result.fields.layer.correct ? 'pass' : 'revise');
    setPassportStamp('approxStampDiagnostic', 'DIAGNOSTIC', caseFile.diagnosticStamp, 'evidence');
    setPassportStamp('approxStampEvidence', 'EVIDENCE', caseFile.evidenceStamp, 'evidence');
    if ($('approxPassportFeedback')) {
      $('approxPassportFeedback').innerHTML = `<strong>${result.correct ? 'Passport cleared.' : 'Passport needs revision.'}</strong> Method ${result.fields.method.correct ? '✓' : `→ ${esc(result.fields.method.expected)}`} · omitted layer ${result.fields.layer.correct ? '✓' : `→ ${esc(result.fields.layer.expected)}`}. <span>${esc(result.evidence)}</span> <em>${esc(result.caveat)}</em>`;
      $('approxPassportFeedback').dataset.state = result.correct ? 'success' : 'needs-work';
    }
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
    if ($('scalingReadout')) $('scalingReadout').innerHTML = `<strong>Scale map:</strong> ω=${model.omega.toFixed(5)}, ℓ=${model.lengthScale.toFixed(5)}, ℏω=${model.energyScale.toFixed(5)}, and g=${model.g.toFixed(6)}. The plot compares potentials only; it does not solve the anharmonic spectrum.`;
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
    if ($('rayleighReadout')) $('rayleighReadout').innerHTML = `<strong>Trial audit:</strong> R=${model.energy.toFixed(7)} lies in [${model.spectrum.values[0].toFixed(7)}, ${model.spectrum.values[1].toFixed(7)}]; ‖Hc−Rc‖=${model.residualNorm.toExponential(3)}. ${model.residualNorm < 1e-7 ? 'Stationary eigenvector found.' : 'A nonzero residual means this direction is not an eigenvector.'}`;
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
    const alpha = inputNumber('gaussianAlpha', 1);
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
    if ($('gaussianReadout')) $('gaussianReadout').innerHTML = `<strong>Width audit:</strong> T=${model.kinetic.toFixed(6)}, V=${model.potential.toFixed(6)}, E=${model.energy.toFixed(6)}, upper error=${model.upperError.toExponential(3)}. ${model.virialBalanced ? 'T=V and this special trial family reaches the exact model ground.' : `T/V=${model.virialRatio.toFixed(4)}; narrowing and broadening carry opposite penalties.`}`;
  }

  function updateBasis() {
    const size = Math.round(inputNumber('basisSize', 3));
    const tolerance = 10 ** inputNumber('basisTolerance', -2);
    const model = basisTruncation(size);
    if ($('basisSizeValue')) $('basisSizeValue').textContent = String(size);
    if ($('basisToleranceValue')) $('basisToleranceValue').textContent = tolerance.toExponential(1);
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
    const meets = model.energyError <= tolerance && model.residualNorm <= Math.sqrt(tolerance);
    if ($('basisReadout')) $('basisReadout').innerHTML = `<strong>Subspace n=${size}:</strong> E=${model.energy.toFixed(8)}, finite-oracle excess=${model.energyError.toExponential(3)}, external residual=${model.residualNorm.toExponential(3)}. ${meets ? 'The selected teaching tolerances are met.' : 'At least one selected teaching tolerance is not met.'} ${size === 6 ? 'The residual is zero only against the declared six-site matrix.' : 'Enlarge the same nested space to continue the Ritz sequence.'}`;
  }

  function updateOverlap() {
    const overlap = inputNumber('overlapS', 0.3);
    const h11 = inputNumber('overlapH11', -1), h12 = inputNumber('overlapH12', -0.2), h22 = inputNumber('overlapH22', 0.4);
    const model = generalizedEigen2(h11, h12, h22, overlap);
    if ($('overlapSValue')) $('overlapSValue').textContent = overlap.toFixed(3);
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
    const body = `<line class="approx-axis" x1="${left}" x2="${split - 25}" y1="${bottom}" y2="${bottom}"></line>
      <line class="approx-axis" x1="${left}" x2="${left}" y1="${top}" y2="${bottom}"></line>
      <path d="${minPath}" fill="none" stroke="#e11d48" stroke-width="4"></path>
      <path d="${maxPath}" fill="none" stroke="#0f766e" stroke-width="4" stroke-dasharray="13 7"></path>
      <path d="${conditionPath}" fill="none" stroke="#d97706" stroke-width="3" stroke-dasharray="3 6"></path>
      <line x1="${xMap(overlap)}" x2="${xMap(overlap)}" y1="${top}" y2="${bottom}" stroke="#312e81" stroke-width="3"></line>
      <line x1="${split}" x2="${right}" y1="${railY(model.values[0])}" y2="${railY(model.values[0])}" stroke="#312e81" stroke-width="5"></line>
      <line x1="${split}" x2="${right}" y1="${railY(model.values[1])}" y2="${railY(model.values[1])}" stroke="#0f766e" stroke-width="5" stroke-dasharray="13 7"></line>
      <text x="${left}" y="28" class="metric-label">overlap spectrum and log₁₀ κ/2</text>
      <text x="${split}" y="28" class="metric-label">generalized energy rails</text>
      <text x="${split + 8}" y="${railY(model.values[0]) - 9}" class="axis-label">E₀=${model.values[0].toFixed(4)}</text>
      <text x="${split + 8}" y="${railY(model.values[1]) - 9}" class="axis-label">E₁=${model.values[1].toFixed(4)}</text>`;
    if ($('overlapPlot')) $('overlapPlot').innerHTML = svg(width, height, body, 'Overlap eigenvalues, conditioning, and generalized energy levels');
    if ($('overlapReadout')) $('overlapReadout').innerHTML = `<strong>Metric audit:</strong> eig(S)=[${model.overlapEigenvalues.map(value => value.toFixed(5)).join(', ')}], κ₂=${model.conditionNumber.toFixed(2)}, det(S)=${model.determinantOverlap.toFixed(5)}; generalized energies [${model.values.map(value => value.toFixed(6)).join(', ')}]. ${model.nearDependent ? 'Near-dependence warning: test any threshold as a representation choice.' : 'The exposed overlap metric remains away from the teaching warning threshold.'}`;
  }

  function updatePerturbation() {
    const gap = inputNumber('perturbGap', 2), coupling = inputNumber('perturbCoupling', 0.5), lambda = inputNumber('perturbLambda', 0.4);
    const model = perturbationTwoLevel(gap, coupling, lambda);
    if ($('perturbGapValue')) $('perturbGapValue').textContent = gap.toFixed(2);
    if ($('perturbCouplingValue')) $('perturbCouplingValue').textContent = coupling.toFixed(2);
    if ($('perturbLambdaValue')) $('perturbLambdaValue').textContent = lambda.toFixed(2);
    const samples = Array.from({ length: 151 }, (_unused, index) => {
      const l = index / 150;
      const m = perturbationTwoLevel(gap, coupling, l);
      return { lambda: l, exact: m.exactLower, order2: m.order2, order4: m.order4 };
    });
    const values = samples.flatMap(item => [item.exact, item.order2, item.order4, 0]);
    const minY = Math.min(...values), maxY = Math.max(...values);
    const width = 720, height = 390, left = 70, right = 690, top = 48, bottom = 326;
    const xMap = value => mapLinear(value, 0, 1, left, right);
    const yMap = value => mapLinear(value, minY - 0.08 * Math.max(0.1, maxY - minY), maxY + 0.08 * Math.max(0.1, maxY - minY), bottom, top);
    const body = `${axes(width, height, left, right, top, bottom, 'coupling scale λ', 'lower-state energy')}
      <path d="${pathFrom(samples.map(item => [item.lambda, item.exact]), xMap, yMap)}" fill="none" stroke="#0f766e" stroke-width="5"></path>
      <path d="${pathFrom(samples.map(item => [item.lambda, item.order2]), xMap, yMap)}" fill="none" stroke="#312e81" stroke-width="4" stroke-dasharray="13 7"></path>
      <path d="${pathFrom(samples.map(item => [item.lambda, item.order4]), xMap, yMap)}" fill="none" stroke="#e11d48" stroke-width="4" stroke-dasharray="3 6"></path>
      <circle cx="${xMap(lambda)}" cy="${yMap(model.exactLower)}" r="8" fill="#f59e0b" stroke="#78350f" stroke-width="3"></circle>
      <text x="${left}" y="28" class="metric-label">exact diagonalization vs retained orders</text>`;
    if ($('perturbationPlot')) $('perturbationPlot').innerHTML = svg(width, height, body, 'Two-level exact and perturbative lower-state energies');
    const verdict = model.ratio < 0.1 ? 'weak in this finite model' : model.ratio < 0.3 ? 'intermediate: inspect orders' : 'large enough that low-order trust is risky';
    if ($('perturbationReadout')) $('perturbationReadout').innerHTML = `<strong>Order audit:</strong> |λV/Δ|=${model.ratio.toFixed(4)} (${verdict}). Exact=${model.exactLower.toFixed(8)}; E⁽²⁾=${model.order2.toFixed(8)} (error ${model.error2.toExponential(2)}); through fourth=${model.order4.toFixed(8)} (error ${model.error4.toExponential(2)}).`;
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
        <text x="${center + 202}" y="160" class="metric-label">shift 1 = ${model.shifts[0].toFixed(3)}</text><text x="${center + 202}" y="226" class="metric-label">shift 2 = ${model.shifts[1].toFixed(3)}</text><text x="${center + 202}" y="184" class="axis-label">same E · no preferred direction</text>`;
    } else {
      const maxAbs = Math.max(Math.abs(model.shifts[0]), Math.abs(model.shifts[1]), 1);
      const y = value => 190 - 105 * value / maxAbs;
      body += `<line data-degenerate-energy="lower" x1="${center + 190}" x2="${right}" y1="${y(model.shifts[0])}" y2="${y(model.shifts[0])}" stroke="#312e81" stroke-width="6"></line>
        <line data-degenerate-energy="upper" x1="${center + 190}" x2="${right}" y1="${y(model.shifts[1])}" y2="${y(model.shifts[1])}" stroke="#0f766e" stroke-width="6" stroke-dasharray="13 7"></line>
        <text x="${center + 202}" y="${y(model.shifts[0]) - 10}" class="metric-label">w₋=${model.shifts[0].toFixed(4)}</text><text x="${center + 202}" y="${y(model.shifts[1]) - 10}" class="metric-label">w₊=${model.shifts[1].toFixed(4)}</text>`;
    }
    body += `<text x="${left}" y="35" class="metric-label">diagonalize W inside the complete degenerate subspace</text>`;
    if ($('degeneratePlot')) $('degeneratePlot').innerHTML = svg(width, height, body, 'First-order shifts from diagonalizing a two-state degenerate perturbation', `data-distinct-levels="${model.coincident ? 1 : 2}"`);
    if ($('degenerateReadout')) $('degenerateReadout').innerHTML = `<strong>Rotated W(${angle.toFixed(1)}°):</strong> [[${model.rotated[0][0].toFixed(5)}, ${model.rotated[0][1].toFixed(5)}], [${model.rotated[1][0].toFixed(5)}, ${model.rotated[1][1].toFixed(5)}]]. Off-diagonal residual=${model.offDiagonalResidual.toExponential(3)}; invariant shifts [${model.shifts.map(value => value.toFixed(6)).join(', ')}]. ${model.coincident ? 'The perturbation is proportional to identity: one true energy line and no preferred basis.' : 'Reading the two rotated diagonal entries as shifts is valid only when the off-diagonal residual vanishes.'}`;
  }

  function alignDegenerate() {
    const preset = $('degeneratePreset')?.value || 'split';
    if (preset === 'same') return updateDegenerate();
    const model = degeneratePerturbation(inputNumber('degenerateW11', 1), inputNumber('degenerateW12', 0.5), inputNumber('degenerateW22', -1), 0);
    if ($('degenerateAngle')) $('degenerateAngle').value = model.preferredAngle.toFixed(8);
    updateDegenerate();
  }

  function updateSeries() {
    const g = inputNumber('seriesG', 0.2), order = Math.round(inputNumber('seriesOrder', 4));
    const model = asymptoticSeriesModel(g, order, 14);
    if ($('seriesGValue')) $('seriesGValue').textContent = g.toFixed(3);
    if ($('seriesOrderValue')) $('seriesOrderValue').textContent = String(order);
    const logErrors = model.partials.map(item => Math.log10(Math.max(item.error, 1e-14)));
    const minLog = Math.min(-1, ...logErrors) - 0.4, maxLog = Math.max(1, ...logErrors) + 0.4;
    const width = 720, height = 390, left = 70, right = 690, top = 48, bottom = 326;
    const xMap = value => mapLinear(value, 0, 14, left, right);
    const yMap = value => mapLinear(value, minLog, maxLog, bottom, top);
    const curve = pathFrom(model.partials.map((item, index) => [index, logErrors[index]]), xMap, yMap);
    const body = `${axes(width, height, left, right, top, bottom, 'truncation order N', 'log₁₀ absolute error')}
      <path d="${curve}" fill="none" stroke="#312e81" stroke-width="5"></path>
      ${model.partials.map((item, index) => `<circle cx="${xMap(index)}" cy="${yMap(logErrors[index])}" r="${index === order || index === model.bestOrder ? 8 : 4}" fill="${index === model.bestOrder ? '#0f766e' : index === order ? '#f59e0b' : '#fff'}" stroke="${index === model.bestOrder ? '#064e3b' : '#78350f'}" stroke-width="2"></circle>`).join('')}
      <line x1="${xMap(model.bestOrder)}" x2="${xMap(model.bestOrder)}" y1="${top}" y2="${bottom}" stroke="#0f766e" stroke-width="2" stroke-dasharray="3 6"></line>
      <text x="${left}" y="28" class="metric-label">best displayed order ${model.bestOrder} · factorial coefficients eventually grow</text>`;
    if ($('seriesPlot')) $('seriesPlot').innerHTML = svg(width, height, body, 'Error by truncation order for a factorial asymptotic series');
    const trend = order > model.bestOrder ? 'Past the best displayed order: adding terms has reversed the improvement.' : order === model.bestOrder ? 'This is the best displayed finite order.' : 'More displayed orders may still improve this coupling, but convergence is not promised.';
    if ($('seriesReadout')) $('seriesReadout').innerHTML = `<strong>Order N=${order}:</strong> partial=${model.selected.sum.toFixed(9)}, numerical integral=${model.reference.toFixed(9)}, signed error=${model.selected.signedError.toExponential(3)}, |error|=${model.selected.error.toExponential(3)}. ${trend} The quadrature tail bound is below ${model.tailBound.toExponential(2)}.`;
  }

  function updateErrorCase() {
    const caseId = $('errorCase')?.value || 'reinforcing';
    const caseFile = ERROR_CASES[caseId];
    ['errorNumerical', 'errorBasis', 'errorModel', 'errorReference'].forEach((id, index) => { if ($(id)) $(id).value = caseFile.values[index]; });
    updateErrorBudget();
  }

  function updateErrorBudget() {
    const values = [inputNumber('errorNumerical', -74.95), inputNumber('errorBasis', -75), inputNumber('errorModel', -75.03), inputNumber('errorReference', -75.04)];
    const model = errorDecomposition(...values);
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
    if ($('errorReadout')) $('errorReadout').innerHTML = `<strong>Ledger closes:</strong> δ_solver=${model.components.solver.toFixed(6)} + δ_repr=${model.components.representation.toFixed(6)} + δ_model=${model.components.model.toFixed(6)} = δ_total=${model.totalError.toFixed(6)}. Dominant absolute component: ${model.dominant}. ${model.cancellation ? 'Cancellation warning: the small net error hides larger opposed components.' : 'No strong cancellation under the displayed diagnostic.'} These signed differences are not statistical uncertainties.`;
  }

  function updateResidual() {
    const theta = inputNumber('residualTheta', 20), phi = inputNumber('residualMix', 35);
    const model = residualCertificate(theta, phi);
    if ($('residualThetaValue')) $('residualThetaValue').textContent = `${theta.toFixed(1)}°`;
    if ($('residualMixValue')) $('residualMixValue').textContent = `${phi.toFixed(1)}°`;
    const lowerForScale = model.lowerBound === null ? 0 : model.lowerBound;
    const minE = Math.min(-0.4, lowerForScale - 0.15), maxE = Math.max(4.2, model.rayleigh + 0.2);
    const width = 720, height = 390, left = 120, right = 650, top = 48, bottom = 326;
    const y = value => mapLinear(value, minE, maxE, bottom, top);
    let body = `<line x1="${left + 100}" x2="${right - 30}" y1="${y(0)}" y2="${y(0)}" stroke="#0f766e" stroke-width="5"></line><text x="${left}" y="${y(0) + 6}" class="metric-label">exact E₀=0</text>
      <line x1="${left + 100}" x2="${right - 30}" y1="${y(1.5)}" y2="${y(1.5)}" stroke="#64748b" stroke-width="3" stroke-dasharray="13 7"></line><text x="${left}" y="${y(1.5) + 6}" class="metric-label">E₁=1.5</text>
      <line x1="${left + 100}" x2="${right - 30}" y1="${y(model.rayleigh)}" y2="${y(model.rayleigh)}" stroke="#312e81" stroke-width="6"></line><text x="${right - 20}" y="${y(model.rayleigh) + 6}" text-anchor="end" class="metric-label">μ upper=${model.rayleigh.toFixed(4)}</text>`;
    if (model.applicable) {
      body += `<line x1="${left + 135}" x2="${left + 135}" y1="${y(model.lowerBound)}" y2="${y(model.rayleigh)}" stroke="#d97706" stroke-width="5"></line><path d="M ${left + 122} ${y(model.lowerBound)} h 26 M ${left + 122} ${y(model.rayleigh)} h 26" stroke="#d97706" stroke-width="4"></path><text x="${left + 155}" y="${y(model.lowerBound) + 6}" class="axis-label">Temple lower ${model.lowerBound.toFixed(4)}</text>`;
    } else {
      body += `<rect x="${left + 105}" y="${top + 15}" width="${right - left - 145}" height="54" rx="10" fill="url(#approx-hatch)" stroke="#e11d48"></rect><text x="${left + 125}" y="${top + 48}" class="metric-label">certificate unavailable: μ is not below E₁</text>`;
    }
    body += `<text x="${left}" y="28" class="metric-label">variance = residual² = ${model.variance.toExponential(3)}</text>`;
    if ($('residualPlot')) $('residualPlot').innerHTML = svg(width, height, body, 'Variational upper and conditional Temple-type lower energy certificate');
    if ($('residualReadout')) $('residualReadout').innerHTML = `<strong>Trial certificate:</strong> c=(${model.coefficients.map(value => value.toFixed(4)).join(', ')}), μ=${model.rayleigh.toFixed(6)}, ‖r‖=${model.residualNorm.toExponential(3)}, variance=${model.variance.toExponential(3)}. ${model.applicable ? `Because μ&lt;E₁, the finite-model bracket is [${model.lowerBound.toFixed(6)}, ${model.upperBound.toFixed(6)}].` : 'Because μ≥E₁, this Temple-type lower bracket is not available.'} A residual without target-root separation can certify the wrong state.`;
  }

  function syncBoss() {
    const caseId = $('approxBossCase')?.value || 'weak-isolated';
    const caseFile = CAMPAIGN_CASES[caseId];
    if ($('approxBossTitle')) $('approxBossTitle').textContent = caseFile.title;
    for (const id of ['approxBossMethod', 'approxBossDiagnostic', 'approxBossEvidence']) if ($(id)) $(id).value = '';
    if ($('approxBossFeedback')) {
      $('approxBossFeedback').textContent = 'Choose the method, diagnostic, and validation evidence, then review the campaign.';
      delete $('approxBossFeedback').dataset.state;
    }
  }

  function auditBoss() {
    const caseId = $('approxBossCase')?.value || 'weak-isolated';
    const result = evaluateApproximationCase(caseId, {
      method: $('approxBossMethod')?.value,
      diagnostic: $('approxBossDiagnostic')?.value,
      evidence: $('approxBossEvidence')?.value
    });
    const labels = { method: 'method', diagnostic: 'diagnostic', evidence: 'evidence' };
    if ($('approxBossFeedback')) {
      $('approxBossFeedback').innerHTML = `<strong>${result.correct ? 'Campaign approved' : `Campaign remains open · ${result.score}/${result.total}`}.</strong> ${Object.entries(result.fields).map(([key, field]) => `${field.correct ? '✓' : '✗'} ${labels[key]}${field.correct ? '' : ` → ${esc(field.expected)}`}: ${esc(field.feedback)}`).join(' · ')} <em>${esc(result.caveat)}</em>`;
      $('approxBossFeedback').dataset.state = result.correct ? 'success' : 'needs-work';
    }
  }

  function bindInputs(ids, callback) {
    ids.forEach(id => {
      $(id)?.addEventListener('input', callback);
      $(id)?.addEventListener('change', callback);
    });
  }

  function init() {
    $('approxPassportCase')?.addEventListener('change', updatePassportPrompt);
    $('approxPassportAudit')?.addEventListener('click', auditPassport);
    bindInputs(['scaleMass', 'scaleForce', 'scaleBeta'], updateScaling);
    bindInputs(['rayleighA', 'rayleighB', 'rayleighD', 'rayleighAngle'], updateRayleigh);
    $('rayleighMinimize')?.addEventListener('click', () => alignRayleigh(0));
    $('rayleighMaximize')?.addEventListener('click', () => alignRayleigh(1));
    bindInputs(['gaussianAlpha'], updateGaussian);
    $('gaussianOptimize')?.addEventListener('click', () => { if ($('gaussianAlpha')) $('gaussianAlpha').value = '1'; updateGaussian(); });
    bindInputs(['basisSize', 'basisTolerance'], updateBasis);
    bindInputs(['overlapS', 'overlapH11', 'overlapH12', 'overlapH22'], updateOverlap);
    bindInputs(['perturbGap', 'perturbCoupling', 'perturbLambda'], updatePerturbation);
    bindInputs(['degeneratePreset', 'degenerateW11', 'degenerateW12', 'degenerateW22', 'degenerateAngle'], updateDegenerate);
    $('degenerateAlign')?.addEventListener('click', alignDegenerate);
    bindInputs(['seriesG', 'seriesOrder'], updateSeries);
    $('seriesBest')?.addEventListener('click', () => {
      const model = asymptoticSeriesModel(inputNumber('seriesG', 0.2), 0, 14);
      if ($('seriesOrder')) $('seriesOrder').value = String(model.bestOrder);
      updateSeries();
    });
    $('errorCase')?.addEventListener('change', updateErrorCase);
    bindInputs(['errorNumerical', 'errorBasis', 'errorModel', 'errorReference'], updateErrorBudget);
    bindInputs(['residualTheta', 'residualMix'], updateResidual);
    $('residualGround')?.addEventListener('click', () => { if ($('residualTheta')) $('residualTheta').value = '0'; updateResidual(); });
    $('approxBossCase')?.addEventListener('change', syncBoss);
    $('approxBossAudit')?.addEventListener('click', auditBoss);

    updatePassportPrompt();
    updateScaling();
    updateRayleigh();
    updateGaussian();
    updateBasis();
    updateOverlap();
    updatePerturbation();
    updateDegenerate();
    updateSeries();
    updateErrorCase();
    updateResidual();
    syncBoss();
    window.ProjectXCAcademy?.bindChapter({ chapterId: 'qc-approximations', totalMissions: 12 });
  }

  window.QCApproximationModels = Object.freeze({
    evaluateApproximationPassport,
    dimensionlessQuartic,
    symmetricEigen2x2,
    rayleighQuotient2,
    gaussianVariational,
    basisTruncation,
    generalizedEigen2,
    perturbationTwoLevel,
    degeneratePerturbation,
    asymptoticIntegral,
    asymptoticSeriesModel,
    errorDecomposition,
    residualCertificate,
    evaluateApproximationCase
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
