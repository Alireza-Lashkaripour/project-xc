(() => {
  'use strict';

  const EPS = 1e-10;

  function finiteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function choose(n, k) {
    if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0 || k > n) throw new Error('choose requires integers 0 <= k <= n');
    let value = 1;
    for (let i = 1; i <= Math.min(k, n - k); i += 1) value = value * (n - i + 1) / i;
    return value;
  }

  function permutationParity(values) {
    if (!Array.isArray(values) || values.some(value => !Number.isInteger(value) || value < 0)) {
      return { valid: false, zero: false, sign: null, parity: null, inversions: null, canonical: [] };
    }
    const canonical = values.slice().sort((a, b) => a - b);
    if (new Set(values).size !== values.length) {
      return { valid: true, zero: true, sign: 0, parity: null, inversions: null, canonical };
    }
    let inversions = 0;
    for (let i = 0; i < values.length; i += 1) {
      for (let j = i + 1; j < values.length; j += 1) if (values[i] > values[j]) inversions += 1;
    }
    const parity = inversions % 2;
    return { valid: true, zero: false, sign: parity ? -1 : 1, parity, inversions, canonical };
  }

  function occupationState(size, occupied) {
    if (!Number.isInteger(size) || size < 1 || !Array.isArray(occupied) || occupied.some(index => !Number.isInteger(index) || index < 0 || index >= size)) {
      return { valid: false, zero: false, bits: [], electrons: 0, occupied: [] };
    }
    const parity = permutationParity(occupied);
    if (parity.zero) return { valid: true, zero: true, bits: Array(size).fill(0), electrons: 0, occupied: parity.canonical };
    const bits = Array(size).fill(0);
    parity.canonical.forEach(index => { bits[index] = 1; });
    return { valid: true, zero: false, bits, electrons: occupied.length, occupied: parity.canonical, sign: parity.sign };
  }

  function validBits(bits) {
    return Array.isArray(bits) && bits.length > 0 && bits.every(value => value === 0 || value === 1);
  }

  function applyAnnihilation(bits, index) {
    if (!validBits(bits) || !Number.isInteger(index) || index < 0 || index >= bits.length) throw new Error('invalid annihilation state or orbital');
    if (!bits[index]) return { zero: true, phase: 0, bits: bits.slice() };
    const lower = bits.slice(0, index).reduce((sum, value) => sum + value, 0);
    const next = bits.slice();
    next[index] = 0;
    return { zero: false, phase: lower % 2 ? -1 : 1, bits: next };
  }

  function applyCreation(bits, index) {
    if (!validBits(bits) || !Number.isInteger(index) || index < 0 || index >= bits.length) throw new Error('invalid creation state or orbital');
    if (bits[index]) return { zero: true, phase: 0, bits: bits.slice() };
    const lower = bits.slice(0, index).reduce((sum, value) => sum + value, 0);
    const next = bits.slice();
    next[index] = 1;
    return { zero: false, phase: lower % 2 ? -1 : 1, bits: next };
  }

  function excitationProfile(left, right) {
    if (!validBits(left) || !validBits(right) || left.length !== right.length) return { valid: false, rank: null, holes: [], particles: [] };
    const leftCount = left.reduce((sum, value) => sum + value, 0);
    const rightCount = right.reduce((sum, value) => sum + value, 0);
    if (leftCount !== rightCount) return { valid: false, rank: null, holes: [], particles: [] };
    const holes = [], particles = [];
    for (let index = 0; index < left.length; index += 1) {
      if (right[index] && !left[index]) holes.push(index);
      if (left[index] && !right[index]) particles.push(index);
    }
    return { valid: holes.length === particles.length, rank: holes.length, holes, particles };
  }

  function validateSquareMatrix(matrix) {
    if (!Array.isArray(matrix) || !matrix.length || matrix.some(row => !Array.isArray(row) || row.length !== matrix.length || row.some(value => !finiteNumber(value)))) {
      throw new Error('expected a finite square matrix');
    }
    return matrix.length;
  }

  function determinantOverlap(matrix) {
    const size = validateSquareMatrix(matrix);
    const work = matrix.map(row => row.slice());
    let determinant = 1;
    for (let column = 0; column < size; column += 1) {
      let pivot = column;
      for (let row = column + 1; row < size; row += 1) if (Math.abs(work[row][column]) > Math.abs(work[pivot][column])) pivot = row;
      if (Math.abs(work[pivot][column]) < 1e-14) return 0;
      if (pivot !== column) {
        [work[pivot], work[column]] = [work[column], work[pivot]];
        determinant *= -1;
      }
      const diagonal = work[column][column];
      determinant *= diagonal;
      for (let row = column + 1; row < size; row += 1) {
        const factor = work[row][column] / diagonal;
        for (let next = column + 1; next < size; next += 1) work[row][next] -= factor * work[column][next];
      }
    }
    return determinant;
  }

  function symmetricEigenvalues(matrix, tolerance = 1e-13) {
    const size = validateSquareMatrix(matrix);
    const work = matrix.map((row, i) => row.map((value, j) => (value + matrix[j][i]) / 2));
    for (let sweep = 0; sweep < 100 * size * size; sweep += 1) {
      let p = 0, q = Math.min(1, size - 1), maximum = 0;
      for (let i = 0; i < size; i += 1) {
        for (let j = i + 1; j < size; j += 1) {
          if (Math.abs(work[i][j]) > maximum) { maximum = Math.abs(work[i][j]); p = i; q = j; }
        }
      }
      if (maximum <= tolerance || size === 1) break;
      const angle = 0.5 * Math.atan2(2 * work[p][q], work[q][q] - work[p][p]);
      const cosine = Math.cos(angle), sine = Math.sin(angle);
      const app = cosine * cosine * work[p][p] - 2 * sine * cosine * work[p][q] + sine * sine * work[q][q];
      const aqq = sine * sine * work[p][p] + 2 * sine * cosine * work[p][q] + cosine * cosine * work[q][q];
      for (let k = 0; k < size; k += 1) {
        if (k === p || k === q) continue;
        const akp = work[k][p], akq = work[k][q];
        work[k][p] = work[p][k] = cosine * akp - sine * akq;
        work[k][q] = work[q][k] = sine * akp + cosine * akq;
      }
      work[p][p] = app;
      work[q][q] = aqq;
      work[p][q] = work[q][p] = 0;
    }
    return work.map((row, index) => row[index]).sort((a, b) => b - a);
  }

  function gramDiagnostics(matrix, threshold = 1e-6) {
    const size = validateSquareMatrix(matrix);
    if (!finiteNumber(threshold) || threshold <= 0) throw new Error('Gram threshold must be positive');
    let symmetryResidual = 0;
    for (let i = 0; i < size; i += 1) for (let j = 0; j < size; j += 1) symmetryResidual = Math.max(symmetryResidual, Math.abs(matrix[i][j] - matrix[j][i]));
    const eigenvalues = symmetricEigenvalues(matrix);
    const minimum = Math.min(...eigenvalues), maximum = Math.max(...eigenvalues.map(Math.abs), EPS);
    return {
      determinant: determinantOverlap(matrix),
      eigenvalues,
      symmetryResidual,
      positiveDefinite: symmetryResidual <= 1e-10 && minimum > 1e-12,
      nearSingular: minimum <= threshold * maximum,
      conditionEstimate: minimum > 0 ? maximum / minimum : Infinity,
      threshold
    };
  }

  function operatorConnectivity(left, right) {
    const profile = excitationProfile(left, right);
    return { ...profile, oneBodyAllowed: profile.valid && profile.rank <= 1, twoBodyAllowed: profile.valid && profile.rank <= 2 };
  }

  function oneBodyElement(bra, ket, matrix) {
    if (!validBits(bra) || !validBits(ket) || bra.length !== ket.length || validateSquareMatrix(matrix) !== bra.length) throw new Error('one-body element dimensions do not match');
    if (bra.reduce((sum, value) => sum + value, 0) !== ket.reduce((sum, value) => sum + value, 0)) return 0;
    let value = 0;
    for (let q = 0; q < ket.length; q += 1) {
      const annihilated = applyAnnihilation(ket, q);
      if (annihilated.zero) continue;
      for (let p = 0; p < ket.length; p += 1) {
        const created = applyCreation(annihilated.bits, p);
        if (created.zero || created.bits.some((bit, index) => bit !== bra[index])) continue;
        value += matrix[p][q] * annihilated.phase * created.phase;
      }
    }
    return value;
  }

  function singleDeterminantEnergy(occupied, oneElectronDiagonal, coulombMatrix, exchangeMatrix) {
    if (!Array.isArray(occupied) || new Set(occupied).size !== occupied.length || occupied.some(index => !Number.isInteger(index) || index < 0)) throw new Error('occupied orbitals must be unique nonnegative indices');
    const size = validateSquareMatrix(coulombMatrix);
    if (validateSquareMatrix(exchangeMatrix) !== size || !Array.isArray(oneElectronDiagonal) || oneElectronDiagonal.length !== size || oneElectronDiagonal.some(value => !finiteNumber(value)) || occupied.some(index => index >= size)) throw new Error('determinant energy dimensions do not match');
    const oneBody = occupied.reduce((sum, index) => sum + oneElectronDiagonal[index], 0);
    let coulomb = 0, exchange = 0;
    for (let i = 0; i < occupied.length; i += 1) {
      for (let j = i + 1; j < occupied.length; j += 1) {
        coulomb += coulombMatrix[occupied[i]][occupied[j]];
        exchange -= exchangeMatrix[occupied[i]][occupied[j]];
      }
    }
    return { oneBody, coulomb, exchange, twoBody: coulomb + exchange, total: oneBody + coulomb + exchange };
  }

  function spinCoupling(c1, c2) {
    if (!finiteNumber(c1) || !finiteNumber(c2)) throw new Error('spin-coupling coefficients must be finite real numbers');
    const norm = c1 * c1 + c2 * c2;
    if (norm <= EPS) throw new Error('spin-coupling state must be nonzero');
    const singletWeight = (c1 - c2) ** 2 / (2 * norm);
    const tripletWeight = (c1 + c2) ** 2 / (2 * norm);
    return { norm, singletWeight, tripletWeight, s2: 2 * tripletWeight, classification: singletWeight > 1 - 1e-10 ? 'singlet' : tripletWeight > 1 - 1e-10 ? 'triplet' : 'mixture' };
  }

  function normalizeCiState(state) {
    if (!state || !Array.isArray(state.determinants) || !state.determinants.length || !Array.isArray(state.coefficients) || state.coefficients.length !== state.determinants.length) throw new Error('CI state requires matching determinants and coefficients');
    const size = state.determinants[0].length;
    if (!size || state.determinants.some(bits => !validBits(bits) || bits.length !== size) || state.coefficients.some(value => !finiteNumber(value))) throw new Error('invalid CI state');
    const electrons = state.determinants[0].reduce((sum, value) => sum + value, 0);
    if (state.determinants.some(bits => bits.reduce((sum, value) => sum + value, 0) !== electrons)) throw new Error('CI determinants must share an electron number');
    const labels = state.determinants.map(bits => bits.join(''));
    if (new Set(labels).size !== labels.length) throw new Error('CI determinant list must be unique');
    const norm = state.coefficients.reduce((sum, value) => sum + value * value, 0);
    if (norm <= EPS) throw new Error('CI coefficient vector must be nonzero');
    return { determinants: state.determinants.map(bits => bits.slice()), coefficients: state.coefficients.map(value => value / Math.sqrt(norm)), size, electrons };
  }

  function oneRDM(state) {
    const ci = normalizeCiState(state);
    const index = new Map(ci.determinants.map((bits, item) => [bits.join(''), item]));
    const gamma = Array.from({ length: ci.size }, () => Array(ci.size).fill(0));
    for (let ketIndex = 0; ketIndex < ci.determinants.length; ketIndex += 1) {
      const ket = ci.determinants[ketIndex];
      for (let q = 0; q < ci.size; q += 1) {
        const annihilated = applyAnnihilation(ket, q);
        if (annihilated.zero) continue;
        for (let p = 0; p < ci.size; p += 1) {
          const created = applyCreation(annihilated.bits, p);
          if (created.zero) continue;
          const braIndex = index.get(created.bits.join(''));
          if (braIndex === undefined) continue;
          gamma[p][q] += ci.coefficients[braIndex] * ci.coefficients[ketIndex] * annihilated.phase * created.phase;
        }
      }
    }
    return gamma;
  }

  function twoRDM(state) {
    const ci = normalizeCiState(state);
    const index = new Map(ci.determinants.map((bits, item) => [bits.join(''), item]));
    const gamma2 = Array.from({ length: ci.size }, () => Array.from({ length: ci.size }, () => Array.from({ length: ci.size }, () => Array(ci.size).fill(0))));
    for (let ketIndex = 0; ketIndex < ci.determinants.length; ketIndex += 1) {
      const ket = ci.determinants[ketIndex];
      for (let r = 0; r < ci.size; r += 1) {
        const first = applyAnnihilation(ket, r);
        if (first.zero) continue;
        for (let s = 0; s < ci.size; s += 1) {
          const second = applyAnnihilation(first.bits, s);
          if (second.zero) continue;
          for (let q = 0; q < ci.size; q += 1) {
            const third = applyCreation(second.bits, q);
            if (third.zero) continue;
            for (let p = 0; p < ci.size; p += 1) {
              const fourth = applyCreation(third.bits, p);
              if (fourth.zero) continue;
              const braIndex = index.get(fourth.bits.join(''));
              if (braIndex === undefined) continue;
              gamma2[p][q][r][s] += ci.coefficients[braIndex] * ci.coefficients[ketIndex] * first.phase * second.phase * third.phase * fourth.phase;
            }
          }
        }
      }
    }
    return gamma2;
  }

  function auditOneRDM(gamma, electrons, tolerance = 1e-9) {
    const size = validateSquareMatrix(gamma);
    if (!Number.isInteger(electrons) || electrons < 0 || electrons > size) throw new Error('invalid 1-RDM electron number');
    let hermitianResidual = 0;
    for (let p = 0; p < size; p += 1) for (let q = 0; q < size; q += 1) hermitianResidual = Math.max(hermitianResidual, Math.abs(gamma[p][q] - gamma[q][p]));
    const occupations = symmetricEigenvalues(gamma);
    const trace = gamma.reduce((sum, row, index) => sum + row[index], 0);
    let idempotencyResidual = 0;
    for (let p = 0; p < size; p += 1) {
      for (let q = 0; q < size; q += 1) {
        let square = 0;
        for (let r = 0; r < size; r += 1) square += gamma[p][r] * gamma[r][q];
        idempotencyResidual = Math.max(idempotencyResidual, Math.abs(square - gamma[p][q]));
      }
    }
    return {
      hermitian: hermitianResidual <= tolerance,
      hermitianResidual,
      trace,
      traceCorrect: Math.abs(trace - electrons) <= tolerance,
      occupations,
      pauliAllowed: occupations.every(value => value >= -tolerance && value <= 1 + tolerance),
      idempotent: idempotencyResidual <= tolerance,
      idempotencyResidual
    };
  }

  function rdmDiagnostics(input) {
    let gamma, gamma2, electrons;
    if (input && Array.isArray(input.determinants)) {
      const ci = normalizeCiState(input);
      gamma = oneRDM(ci);
      gamma2 = twoRDM(ci);
      electrons = ci.electrons;
    } else {
      gamma = input?.gamma;
      gamma2 = input?.gamma2;
      electrons = input?.electrons;
    }
    const size = validateSquareMatrix(gamma);
    if (!Number.isInteger(electrons) || electrons < 0 || !Array.isArray(gamma2) || gamma2.length !== size) throw new Error('invalid RDM diagnostics input');
    const trace1 = gamma.reduce((sum, row, index) => sum + row[index], 0);
    let trace2 = 0, contractionResidual = 0, antisymmetryResidual = 0;
    for (let p = 0; p < size; p += 1) {
      for (let q = 0; q < size; q += 1) {
        trace2 += gamma2[p][q][p][q];
        for (let r = 0; r < size; r += 1) {
          for (let s = 0; s < size; s += 1) {
            antisymmetryResidual = Math.max(antisymmetryResidual, Math.abs(gamma2[p][q][r][s] + gamma2[q][p][r][s]), Math.abs(gamma2[p][q][r][s] + gamma2[p][q][s][r]));
          }
        }
      }
      for (let r = 0; r < size; r += 1) {
        let contraction = 0;
        for (let q = 0; q < size; q += 1) contraction += gamma2[p][q][r][q];
        contractionResidual = Math.max(contractionResidual, Math.abs(contraction - (electrons - 1) * gamma[p][r]));
      }
    }
    return { electrons, gamma, gamma2, trace1, trace2, contractionResidual, antisymmetryResidual, oneRdmAudit: auditOneRDM(gamma, electrons) };
  }

  const EXCHANGE_DOSSIERS = Object.freeze({
    'exchange-a': { amplitudes: [0.6, -0.6] },
    'exchange-b': { amplitudes: [0.4, 0.4] },
    'exchange-c': { amplitudes: [0.7, 0.2] }
  });
  const OCCUPANCY_DOSSIERS = Object.freeze({
    'occupancy-a': { size: 4, electrons: 2 },
    'occupancy-b': { size: 6, electrons: 3 },
    'occupancy-c': { size: 8, electrons: 4 }
  });
  const OVERLAP_DOSSIERS = Object.freeze({
    'overlap-a': { matrix: [[1, 0], [0, 1]] },
    'overlap-b': { matrix: [[1, 0.6], [0.6, 1]] },
    'overlap-c': { matrix: [[1, 0.99999], [0.99999, 1]] },
    'overlap-d': { matrix: [[1, 1], [1, 1]] }
  });
  const SELECTION_DOSSIERS = Object.freeze({
    'connection-a': { left: [1, 1, 0, 0, 0, 0], right: [1, 1, 0, 0, 0, 0] },
    'connection-b': { left: [1, 1, 0, 0, 0, 0], right: [1, 0, 1, 0, 0, 0] },
    'connection-c': { left: [1, 1, 0, 0, 0, 0], right: [0, 0, 1, 1, 0, 0] },
    'connection-d': { left: [1, 1, 1, 0, 0, 0], right: [0, 0, 0, 1, 1, 1] }
  });
  const SPIN_DOSSIERS = Object.freeze({
    'spin-a': { coefficients: [1, -1] },
    'spin-b': { coefficients: [1, 1] },
    'spin-c': { coefficients: [1, 0] }
  });
  const BOSS_DOSSIERS = Object.freeze({
    'boss-a': { order: [0, 2, 2] },
    'boss-b': { left: [1, 1, 0, 0], right: [1, 0, 1, 0] },
    'boss-c': { state: { determinants: [[1, 0, 0, 1], [0, 1, 1, 0]], coefficients: [1, -1] } }
  });

  function verdict(classification, choice, extra = {}) {
    return { ...extra, choice, correct: choice === classification };
  }

  function exchangeClassification(amplitudes) {
    const symmetricResidual = Math.abs(amplitudes[1] - amplitudes[0]);
    const antisymmetricResidual = Math.abs(amplitudes[1] + amplitudes[0]);
    if (antisymmetricResidual <= EPS && symmetricResidual > EPS) return 'antisymmetric';
    if (symmetricResidual <= EPS && antisymmetricResidual > EPS) return 'symmetric';
    return 'neither';
  }

  function evaluateExchangeCase(caseId, choice) {
    const item = EXCHANGE_DOSSIERS[caseId];
    if (!item) return verdict(null, choice, { valid: false });
    const exchangeResidual = { symmetric: Math.abs(item.amplitudes[1] - item.amplitudes[0]), antisymmetric: Math.abs(item.amplitudes[1] + item.amplitudes[0]) };
    return verdict(exchangeClassification(item.amplitudes), choice, { valid: true, amplitudes: item.amplitudes.slice(), exchangeResidual });
  }

  function evaluateOccupancyMission(caseId, occupied, predictedCount) {
    const item = OCCUPANCY_DOSSIERS[caseId];
    if (!item) return { valid: false, correct: false };
    const state = occupationState(item.size, occupied);
    const exactCount = choose(item.size, item.electrons);
    return { valid: true, state, exactCount, correct: state.valid && !state.zero && state.electrons === item.electrons && predictedCount === exactCount };
  }

  function evaluateParityMission(order, predictedSign) {
    const result = permutationParity(order);
    return { ...result, predictedSign, correct: result.valid && !result.zero && predictedSign === result.sign };
  }

  function overlapClassification(diagnostics, matrix) {
    if (!diagnostics.positiveDefinite) return 'reject-dependent';
    if (diagnostics.nearSingular) return 'scan-threshold';
    const identityResidual = Math.max(...matrix.flatMap((row, p) => row.map((value, q) => Math.abs(value - (p === q ? 1 : 0)))));
    return identityResidual <= EPS ? 'accept-normalized' : 'renormalize';
  }

  function evaluateOverlapMission(caseId, decision) {
    const item = OVERLAP_DOSSIERS[caseId];
    if (!item) return { valid: false, correct: false };
    const diagnostics = gramDiagnostics(item.matrix, 1e-4);
    return verdict(overlapClassification(diagnostics, item.matrix), decision, { valid: true, matrix: item.matrix.map(row => row.slice()), diagnostics });
  }

  function selectionDiagnostics(caseId) {
    const item = SELECTION_DOSSIERS[caseId];
    return item ? operatorConnectivity(item.left, item.right) : null;
  }

  function evaluateSelectionMission(caseId, decision) {
    const diagnostics = selectionDiagnostics(caseId);
    if (!diagnostics) return { valid: false, correct: false };
    const classification = diagnostics.rank <= 1 ? 'one-and-two' : diagnostics.rank === 2 ? 'two-only' : 'neither';
    return verdict(classification, decision, { ...diagnostics });
  }

  function evaluateOneBodyMission(caseId, decision) {
    const diagnostics = selectionDiagnostics(caseId);
    if (!diagnostics) return { valid: false, correct: false };
    const classification = diagnostics.oneBodyAllowed ? 'allowed' : 'forbidden';
    return verdict(classification, decision, { valid: true, rank: diagnostics.rank, structurallyAllowed: diagnostics.oneBodyAllowed });
  }

  function evaluateTwoBodyMission(caseId, decision, energyInterpretation) {
    const diagnostics = selectionDiagnostics(caseId);
    if (!diagnostics) return { valid: false, correct: false };
    const classification = diagnostics.twoBodyAllowed ? 'allowed' : 'forbidden';
    const structuralCorrect = decision === classification;
    const interpretationCorrect = energyInterpretation === 'coulomb-minus-exchange';
    return { valid: true, choice: decision, rank: diagnostics.rank, structurallyAllowed: diagnostics.twoBodyAllowed, structuralCorrect, interpretationCorrect, correct: structuralCorrect && interpretationCorrect };
  }

  function spinClassification(model) {
    if (model.singletWeight >= 1 - EPS) return 'singlet';
    if (model.tripletWeight >= 1 - EPS) return 'triplet';
    return 'mixture';
  }

  function evaluateSpinMission(caseId, decision) {
    const item = SPIN_DOSSIERS[caseId];
    if (!item) return { valid: false, correct: false };
    const model = spinCoupling(...item.coefficients);
    return verdict(spinClassification(model), decision, { valid: true, model });
  }

  function evaluateRdmMission(caseId, decision) {
    const data = oneRdmData(caseId);
    if (!data) return { valid: false, correct: false };
    const audit = auditOneRDM(data.gamma, 2);
    const classification = !audit.traceCorrect ? 'reject-trace' : audit.idempotent ? 'idempotent' : 'fractional';
    return verdict(classification, decision, { valid: true, audit });
  }

  function evaluateTwoRdmMission(caseId, decision) {
    const data = twoRdmData(caseId);
    if (!data) return { valid: false, correct: false };
    if (!data.gamma2) return verdict('missing-pair-evidence', decision, { valid: true, diagnostics: null });
    const diagnostics = rdmDiagnostics({ gamma: data.gamma, gamma2: data.gamma2, electrons: 2 });
    const consistent = Math.abs(diagnostics.trace2 - 2) <= 1e-9 && diagnostics.contractionResidual <= 1e-9 && diagnostics.antisymmetryResidual <= 1e-9;
    return verdict(consistent ? 'certify-necessary' : 'reject-contraction', decision, { valid: true, diagnostics });
  }

  function bossChoice(caseId, stage) {
    const dossier = BOSS_DOSSIERS[caseId];
    if (!dossier || !Number.isInteger(stage) || stage < 0 || stage > 2) return null;
    if (dossier.order) {
      const state = occupationState(Math.max(...dossier.order) + 1, dossier.order);
      if (stage === 0) return 'wedge-state';
      if (stage === 1) return permutationParity(dossier.order).zero ? 'zero-determinant' : 'excitation-rank';
      return state.zero ? 'canonical-occupancy' : 'one-body-integral';
    }
    if (dossier.left) {
      const connectivity = operatorConnectivity(dossier.left, dossier.right);
      if (stage === 0) return 'determinant-pair';
      if (stage === 1) return connectivity.rank === 1 ? 'excitation-rank' : 'natural-occupations';
      return connectivity.oneBodyAllowed ? 'one-body-integral' : 'two-rdm-contraction';
    }
    const diagnostics = rdmDiagnostics(dossier.state);
    if (stage === 0) return 'multi-determinant-state';
    if (stage === 1) return diagnostics.oneRdmAudit.idempotent ? 'excitation-rank' : 'natural-occupations';
    return diagnostics.contractionResidual <= 1e-9 ? 'two-rdm-contraction' : 'canonical-occupancy';
  }

  function evaluateManyElectronCase(caseId, stage, choice) {
    const classification = bossChoice(caseId, stage);
    return classification ? verdict(classification, choice, { valid: true, stage }) : { valid: false, correct: false };
  }

  const publicModels = Object.freeze({
    choose, permutationParity, occupationState, applyCreation, applyAnnihilation, excitationProfile,
    determinantOverlap, gramDiagnostics, operatorConnectivity, oneBodyElement, singleDeterminantEnergy,
    spinCoupling, oneRDM, twoRDM, auditOneRDM, rdmDiagnostics
  });
  const testModels = Object.freeze({
    ...publicModels, evaluateExchangeCase, evaluateOccupancyMission, evaluateParityMission,
    evaluateOverlapMission, evaluateSelectionMission, evaluateOneBodyMission, evaluateTwoBodyMission,
    evaluateSpinMission, evaluateRdmMission, evaluateTwoRdmMission, evaluateManyElectronCase
  });

  window.QCManyElectronModels = publicModels;
  if (typeof module === 'object' && module && module.exports) module.exports = testModels;

  const GAME_STORAGE_KEY = 'project-xc-many-electron-games-v1';
  const MISSION_IDS = Object.freeze([
    'fermion-exchange', 'spin-orbital-occupancy', 'determinant-parity', 'determinant-overlap',
    'one-body-selection', 'two-body-selection', 'spin-adaptation', 'one-rdm', 'two-rdm',
    'many-electron-case-file'
  ]);
  const CASE_IDS = Object.freeze({
    exchange: Object.keys(EXCHANGE_DOSSIERS),
    occupancy: Object.keys(OCCUPANCY_DOSSIERS),
    parity: ['1,0,2', '2,0,3,1', '3,2,1,0'],
    overlap: Object.keys(OVERLAP_DOSSIERS),
    oneBody: Object.keys(SELECTION_DOSSIERS),
    twoBody: Object.keys(SELECTION_DOSSIERS),
    spin: Object.keys(SPIN_DOSSIERS),
    oneRdm: ['one-rdm-a', 'one-rdm-b', 'one-rdm-c'],
    twoRdm: ['two-rdm-a', 'two-rdm-b', 'two-rdm-c'],
    boss: Object.keys(BOSS_DOSSIERS)
  });
  const MISSION_CASE_MAP = Object.freeze({
    exchange: 'fermion-exchange', occupancy: 'spin-orbital-occupancy', parity: 'determinant-parity',
    overlap: 'determinant-overlap', oneBody: 'one-body-selection', twoBody: 'two-body-selection',
    spin: 'spin-adaptation', oneRdm: 'one-rdm', twoRdm: 'two-rdm'
  });
  const NOTEBOOK_ENTRIES = Object.freeze({
    'fermion-exchange': ['Exchange the total spin-coordinate arguments.', 'No classical particle identity labels.', 'Swap residual under η=±1.', 'Total antisymmetry; spatial symmetry alone is insufficient.'],
    'spin-orbital-occupancy': ['Create a fixed-N occupation bitstring.', 'No duplicate spin-orbital occupancy.', 'Electron count and C(M,N).', 'One determinant is not the full fixed-N space.'],
    'determinant-parity': ['Canonicalize occupied-orbital order.', 'No phase-free reordering.', 'Inversion parity.', 'Global sign is conventional; relative CI phases matter.'],
    'determinant-overlap': ['Take det of the occupied-orbital overlap matrix.', 'Orthonormality is not assumed silently.', 'Gram spectrum and determinant.', 'A near-singular cutoff is a numerical diagnostic, not universal.'],
    'one-body-selection': ['Count substitutions between determinants.', 'Do not evaluate forbidden connections.', 'One-body excitation-rank filter.', 'Allowed by rank does not guarantee a nonzero integral.'],
    'two-body-selection': ['Apply the two-body rank filter and pair expectation.', 'No orbital optimization or SCF stationarity.', 'Rank≤2 plus J−K ledger.', 'A supplied determinant expectation is not an HF solution.'],
    'spin-adaptation': ['Combine D₁ and D₂ with a declared ordering.', 'Do not infer spin from M_S alone.', 'Singlet/triplet weights and ⟨S²⟩.', 'Displayed coefficient signs depend on determinant convention.'],
    'one-rdm': ['Contract a normalized finite CI state to γ.', 'Do not reconstruct the full wavefunction from γ.', 'Trace, spectrum, and idempotency.', 'Fractional occupations diagnose non-single-determinant character in this model.'],
    'two-rdm': ['Contract Γ back to (N−1)γ.', 'Do not call a few checks complete N-representability.', 'Pair trace, antisymmetry, contraction.', 'Exact CI generation proves the example; arbitrary candidates need stronger conditions.'],
    'many-electron-case-file': ['Stage representation → diagnostic → evidence.', 'No method-name or final-number shortcut.', 'Three recovered dossiers under a token budget.', 'Finite determinant algebra still precedes orbital optimization.']
  });
  const BOSS_FILES = Object.freeze({
    'boss-a': {
      title: 'Case file A · repeated-index transcript',
      artifacts: [
        'Initial brief: a creation sequence contains one repeated spin-orbital index; no canonical bitstring or norm is reported.',
        'Transcript unlocked: a†₀a†₂a†₂|0⟩. The second creation at p=2 acts on an already occupied spin orbital.',
        'Diagnostic unlocked: fermionic creation returns the zero vector before any normalization is attempted.',
        'Evidence unlocked: canonical occupancy plus the explicit Pauli action supports rejection. Caveat: this diagnoses the supplied algebra, not orbital quality.'
      ]
    },
    'boss-b': {
      title: 'Case file B · transition claim',
      artifacts: [
        'Initial brief: two equal-N determinants accompany a claimed one-body transition; no substitution audit or integral is supplied.',
        'State record unlocked: |1100⟩ and |1010⟩ in the same canonical four-spin-orbital basis.',
        'Diagnostic unlocked: the pair differs by one substitution, so one-body connectivity is structurally allowed.',
        'Evidence unlocked: the actual signed one-body integral and symmetry evidence are still required. Rank allowance alone is not a nonzero value.'
      ]
    },
    'boss-c': {
      title: 'Case file C · occupation-spectrum claim',
      artifacts: [
        'Initial brief: four spin-orbital occupations are reported as 0.5; the generating state and pair consistency are omitted.',
        'State record unlocked: a normalized equal-weight superposition of |1001⟩ and |0110⟩.',
        'Diagnostic unlocked: γ has trace 2 and natural occupations (0.5,0.5,0.5,0.5), so it is non-idempotent.',
        'Evidence unlocked: the CI-generated Γ contracts exactly to γ. Caveat: trace/contraction checks are not a complete arbitrary 2-RDM N-representability proof.'
      ]
    }
  });

  const game = {
    cleared: new Set(),
    exchange: new Set(), occupancy: new Set(), parity: new Set(), overlap: new Set(),
    oneBody: new Set(), twoBody: new Set(), spin: new Set(), oneRdm: new Set(), twoRdm: new Set(),
    revealed: { exchange: new Set(), occupancy: new Set(), parity: new Set(), overlap: new Set(), oneBody: new Set(), twoBody: new Set(), spin: new Set(), oneRdm: new Set(), twoRdm: new Set() },
    boss: { cleared: new Set(), stage: {}, budget: {}, answers: {} }
  };

  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const list = value => Array.isArray(value) ? value : [];

  function setResult(id, state, html) {
    const node = $(id);
    if (!node) return;
    node.innerHTML = html;
    node.dataset.state = state;
  }

  function setHidden(id, hidden) {
    const node = $(id);
    if (node) node.hidden = hidden;
  }

  function restoreGameState() {
    let saved;
    try { saved = JSON.parse(window.localStorage.getItem(GAME_STORAGE_KEY) || 'null'); } catch (_error) { saved = null; }
    if (!saved || saved.version !== 1) return;
    for (const [bucket, validIds] of Object.entries(CASE_IDS)) {
      if (bucket === 'boss') continue;
      game[bucket] = new Set(list(saved[bucket]).filter(id => validIds.includes(id)));
    }
    game.boss.cleared = new Set(list(saved.boss).filter(id => CASE_IDS.boss.includes(id)));
    game.boss.stage = saved.bossStage && typeof saved.bossStage === 'object' && !Array.isArray(saved.bossStage) ? Object.fromEntries(Object.entries(saved.bossStage).filter(([id, stage]) => CASE_IDS.boss.includes(id) && Number.isInteger(stage) && stage >= 0 && stage <= 2)) : {};
    game.boss.budget = saved.bossBudget && typeof saved.bossBudget === 'object' && !Array.isArray(saved.bossBudget) ? Object.fromEntries(Object.entries(saved.bossBudget).filter(([id, budget]) => CASE_IDS.boss.includes(id) && Number.isInteger(budget) && budget >= 1 && budget <= 4)) : {};
    game.boss.answers = {};
    const savedAnswers = saved.bossAnswers && typeof saved.bossAnswers === 'object' && !Array.isArray(saved.bossAnswers) ? saved.bossAnswers : {};
    for (const id of CASE_IDS.boss) {
      const required = game.boss.cleared.has(id) ? 3 : (game.boss.stage[id] || 0);
      if (!required) continue;
      const answers = list(savedAnswers[id]).slice(0, required);
      const valid = answers.length === required && answers.every((answer, stage) => typeof answer === 'string' && evaluateManyElectronCase(id, stage, answer).correct);
      if (valid) game.boss.answers[id] = answers;
      else {
        game.boss.cleared.delete(id);
        delete game.boss.stage[id];
        delete game.boss.budget[id];
      }
    }
    game.cleared.clear();
    for (const [bucket, mission] of Object.entries(MISSION_CASE_MAP)) if (game[bucket].size === CASE_IDS[bucket].length) game.cleared.add(mission);
    if (game.boss.cleared.size === CASE_IDS.boss.length && MISSION_IDS.slice(0, 9).every(id => game.cleared.has(id))) game.cleared.add('many-electron-case-file');
  }

  function saveGameState() {
    try {
      window.localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify({
        version: 1,
        exchange: [...game.exchange], occupancy: [...game.occupancy], parity: [...game.parity], overlap: [...game.overlap],
        oneBody: [...game.oneBody], twoBody: [...game.twoBody], spin: [...game.spin], oneRdm: [...game.oneRdm], twoRdm: [...game.twoRdm],
        boss: [...game.boss.cleared], bossStage: game.boss.stage, bossBudget: game.boss.budget, bossAnswers: game.boss.answers
      }));
    } catch (_error) { /* browser storage may be unavailable */ }
  }

  function renderNotebook() {
    const node = $('manyNotebookList');
    if (!node) return;
    const entries = MISSION_IDS.filter(id => game.cleared.has(id));
    if (!entries.length) {
      node.innerHTML = '<p class="help-text">No fermion evidence recorded yet.</p>';
      return;
    }
    node.innerHTML = entries.map(id => {
      const [operation, omitted, diagnostic, evidence] = NOTEBOOK_ENTRIES[id];
      return `<article><strong>${esc(id.replaceAll('-', ' '))}</strong><span>${esc(operation)}</span><span>${esc(omitted)}</span><span>${esc(diagnostic)}</span><span>${esc(evidence)}</span></article>`;
    }).join('');
  }

  let reconcilingCanonical = false;
  function rejectUnsupportedCanonicalProgress() {
    const academy = window.ProjectXCAcademy;
    if (!academy || reconcilingCanonical) return;
    const unsupported = academy.completedMissions('qc-many-electron').filter(id => MISSION_IDS.includes(id) && !game.cleared.has(id));
    if (!unsupported.length) return;
    reconcilingCanonical = true;
    try { unsupported.forEach(id => academy.setMission('qc-many-electron', id, false)); }
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
    const scoreIds = {
      exchange: ['exchangeStage', 'Dossiers'], occupancy: ['occupancyStage', 'Forges'], parity: ['parityStage', 'Ordering files'], overlap: ['overlapStage', 'Artifacts'],
      oneBody: ['oneBodyStage', 'Pairs'], twoBody: ['twoBodyStage', 'Pairs'], spin: ['spinStage', 'Spin files'], oneRdm: ['oneRdmStage', '1-RDM dossiers'], twoRdm: ['twoRdmStage', 'Pair dossiers']
    };
    for (const [bucket, [id, label]] of Object.entries(scoreIds)) if ($(id)) $(id).textContent = `${label} cleared: ${game[bucket].size} / ${CASE_IDS[bucket].length}${bucket === 'twoBody' ? ' · direct−exchange interpretation required' : ''}`;
    const prerequisites = MISSION_IDS.slice(0, 9).filter(id => game.cleared.has(id)).length;
    if ($('manyBossScore')) $('manyBossScore').textContent = `Dossiers cleared: ${game.boss.cleared.size} / 3 · notebook prerequisites: ${prerequisites} / 9`;
    renderNotebook();
  }

  function recordCase(bucket, caseId) {
    game[bucket].add(caseId);
    game.revealed[bucket].add(caseId);
    if (game[bucket].size === CASE_IDS[bucket].length) game.cleared.add(MISSION_CASE_MAP[bucket]);
    saveGameState();
    renderGameProgress();
    maybeEarnBoss();
  }

  function maybeEarnBoss() {
    if (game.boss.cleared.size === CASE_IDS.boss.length && MISSION_IDS.slice(0, 9).every(id => game.cleared.has(id))) {
      game.cleared.add('many-electron-case-file');
      saveGameState();
      renderGameProgress();
    }
  }

  let svgSerial = 0;
  function svg(width, height, body, label) {
    const serial = ++svgSerial;
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}"><defs><pattern id="many-hatch-${serial}" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#fff7ed"></rect><line x1="0" y1="0" x2="0" y2="10" stroke="#ea580c" stroke-width="3"></line></pattern></defs><rect width="${width}" height="${height}" rx="18" fill="#fbfdff"></rect>${body.replaceAll('url(#many-hatch)', `url(#many-hatch-${serial})`)}</svg>`;
  }

  function renderExchange() {
    const caseId = $('exchangeCase')?.value || 'exchange-a';
    const item = EXCHANGE_DOSSIERS[caseId];
    const revealed = game.revealed.exchange.has(caseId) || game.exchange.has(caseId);
    const [a, b] = item.amplitudes;
    const y = value => 145 - value * 120;
    const classification = exchangeClassification(item.amplitudes);
    const oracle = revealed ? `<text x="340" y="52" text-anchor="middle" class="many-plot-oracle">η = ${classification === 'antisymmetric' ? '−1' : classification === 'symmetric' ? '+1' : 'not an eigenstate'}</text>` : '';
    $('exchangePlot').innerHTML = svg(680, 250, `<line class="many-axis" x1="70" x2="610" y1="145" y2="145"></line><line class="many-axis" x1="180" x2="180" y1="35" y2="220"></line><line class="many-axis" x1="500" x2="500" y1="35" y2="220"></line><circle class="many-point indigo" cx="180" cy="${y(a)}" r="12"></circle><circle class="many-point coral" cx="500" cy="${y(b)}" r="12"></circle><text x="180" y="235" text-anchor="middle">Ψ(x₁,x₂) = ${a.toFixed(2)}</text><text x="500" y="235" text-anchor="middle">Ψ(x₂,x₁) = ${b.toFixed(2)}</text>${oracle}`, 'two supplied amplitudes under coordinate exchange');
    setHidden('exchangeOracleKey', !revealed);
  }

  function auditExchange() {
    const caseId = $('exchangeCase')?.value || 'exchange-a';
    const decision = $('exchangeDecision')?.value || '';
    if (!decision) return setResult('exchangeReadout', 'needs-work', '<strong>Commit a class.</strong> Empty submissions do not spend an attempt.');
    const result = evaluateExchangeCase(caseId, decision);
    game.revealed.exchange.add(caseId);
    renderExchange();
    if (!result.correct) return setResult('exchangeReadout', 'needs-work', `<strong>Revise the exchange class.</strong> Residuals: symmetric ${result.exchangeResidual.symmetric.toFixed(2)}, antisymmetric ${result.exchangeResidual.antisymmetric.toFixed(2)}. The test applies to the total spin-coordinate amplitude.`);
    recordCase('exchange', caseId);
    setResult('exchangeReadout', 'success', `<strong>Passport stamped.</strong> The supplied total amplitude is ${esc(exchangeClassification(EXCHANGE_DOSSIERS[caseId].amplitudes))} under exchange. ${game.exchange.size === 3 ? 'All three exchange dossiers are now cleared.' : 'Inspect the next dossier.'}`);
  }

  function occupancyDefaults(caseId) {
    return { 'occupancy-a': '0,3', 'occupancy-b': '0,2,5', 'occupancy-c': '0,2,5,7' }[caseId];
  }

  function parseOccupied() {
    const raw = $('occupancyOrbitals')?.value || '';
    if (!raw.trim()) return [];
    return raw.split(',').map(value => Number(value.trim()));
  }

  function renderOccupancy() {
    const caseId = $('occupancyCase')?.value || 'occupancy-a';
    const item = OCCUPANCY_DOSSIERS[caseId];
    const state = occupationState(item.size, parseOccupied());
    const revealed = game.revealed.occupancy.has(caseId) || game.occupancy.has(caseId);
    const cells = Array.from({ length: item.size }, (_, index) => {
      const occupied = state.valid && !state.zero && state.bits[index];
      const x = 70 + index * 72;
      return `<rect class="many-orbital ${occupied ? 'occupied' : ''}" x="${x}" y="82" width="52" height="62" rx="10"></rect><text x="${x + 26}" y="72" text-anchor="middle">p=${index}</text><text x="${x + 26}" y="121" text-anchor="middle" class="many-bit">${occupied ? '1' : '0'}</text>`;
    }).join('');
    const exact = revealed ? `<text x="340" y="205" text-anchor="middle" class="many-plot-oracle">C(${item.size},${item.electrons}) = ${choose(item.size, item.electrons)}</text>` : '<text x="340" y="205" text-anchor="middle" class="many-muted">determinant-space count hidden until commitment</text>';
    $('occupancyPlot').innerHTML = svg(Math.max(680, 140 + item.size * 72), 240, `${cells}${exact}`, 'ordered spin-orbital occupation bitstring');
    setHidden('occupancyCountKey', !revealed);
  }

  function auditOccupancy() {
    const caseId = $('occupancyCase')?.value || 'occupancy-a';
    const count = Number($('occupancyCount')?.value);
    const result = evaluateOccupancyMission(caseId, parseOccupied(), count);
    game.revealed.occupancy.add(caseId);
    renderOccupancy();
    if (!result.state.valid) return setResult('occupancyReadout', 'needs-work', '<strong>Invalid orbital index.</strong> Use integers inside the displayed M-spin-orbital range.');
    if (result.state.zero) return setResult('occupancyReadout', 'needs-work', '<strong>Pauli zero.</strong> A repeated creation index annihilates the determinant; revise the sequence.');
    if (result.state.electrons !== OCCUPANCY_DOSSIERS[caseId].electrons) return setResult('occupancyReadout', 'needs-work', `<strong>Wrong fixed-N sector.</strong> Built N=${result.state.electrons}; this dossier requires N=${OCCUPANCY_DOSSIERS[caseId].electrons}.`);
    if (!result.correct) return setResult('occupancyReadout', 'needs-work', `<strong>Bitstring accepted; count revised.</strong> Independent bitstring enumeration gives ${result.exactCount}.`);
    recordCase('occupancy', caseId);
    setResult('occupancyReadout', 'success', `<strong>Forge cleared.</strong> Canonical occupation |${result.state.bits.join('')}⟩ is valid and the fixed-N sector has ${result.exactCount} determinants.`);
  }

  function renderParity() {
    const caseId = $('parityCase')?.value || '1,0,2';
    const order = caseId.split(',').map(Number);
    const result = permutationParity(order);
    const revealed = game.revealed.parity.has(caseId) || game.parity.has(caseId);
    const spacing = 480 / Math.max(1, order.length - 1);
    const paths = order.map((value, index) => {
      const x1 = 100 + index * spacing;
      const x2 = 100 + result.canonical.indexOf(value) * spacing;
      return `<line class="many-permutation-line" x1="${x1}" y1="70" x2="${x2}" y2="185"></line><text x="${x1}" y="52" text-anchor="middle">${value}</text>`;
    }).join('');
    const bottom = result.canonical.map((value, index) => `<text x="${100 + index * spacing}" y="214" text-anchor="middle">${value}</text>`).join('');
    const oracle = revealed ? `<text x="340" y="245" text-anchor="middle" class="many-plot-oracle">${result.inversions} inversions → sign ${result.sign > 0 ? '+1' : '−1'}</text>` : '<text x="340" y="245" text-anchor="middle" class="many-muted">parity oracle hidden</text>';
    $('parityPlot').innerHTML = svg(680, 270, `${paths}${bottom}${oracle}`, 'orbital ordering connected to canonical order');
    setHidden('parityOracleKey', !revealed);
  }

  function auditParity() {
    const caseId = $('parityCase')?.value || '1,0,2';
    const order = caseId.split(',').map(Number);
    const predicted = Number($('paritySign')?.value);
    if (![1, -1].includes(predicted)) return setResult('parityReadout', 'needs-work', '<strong>Commit a sign.</strong>');
    const result = evaluateParityMission(order, predicted);
    game.revealed.parity.add(caseId);
    renderParity();
    if (!result.correct) return setResult('parityReadout', 'needs-work', `<strong>Parity mismatch.</strong> The ordering has ${result.inversions} inversions; regroup crossings in pairs and revise.`);
    recordCase('parity', caseId);
    setResult('parityReadout', 'success', `<strong>Sign ledger cleared.</strong> ${result.inversions} inversion${result.inversions === 1 ? '' : 's'} give relative sign ${result.sign > 0 ? '+1' : '−1'}.`);
  }

  function renderOverlap() {
    const caseId = $('overlapCase')?.value || 'overlap-a';
    const item = OVERLAP_DOSSIERS[caseId];
    const diagnostics = gramDiagnostics(item.matrix, 1e-4);
    const revealed = game.revealed.overlap.has(caseId) || game.overlap.has(caseId);
    const matrix = `<text x="130" y="60" class="many-matrix">G = [ ${item.matrix[0][0].toFixed(5)}  ${item.matrix[0][1].toFixed(5)} ]</text><text x="130" y="92" class="many-matrix">    [ ${item.matrix[1][0].toFixed(5)}  ${item.matrix[1][1].toFixed(5)} ]</text>`;
    let spectrum = '<text x="400" y="155" class="many-muted">spectrum and det G hidden</text>';
    if (revealed) spectrum = diagnostics.eigenvalues.map((value, index) => `<rect class="many-spectrum-bar ${index ? 'secondary' : ''}" x="380" y="${64 + index * 62}" width="${Math.max(2, value * 110)}" height="26" rx="6"></rect><text x="370" y="${83 + index * 62}" text-anchor="end">λ${index + 1}</text><text x="${390 + Math.max(2, value * 110)}" y="${83 + index * 62}">${value.toPrecision(5)}</text>`).join('') + `<text x="400" y="220" class="many-plot-oracle">det G = ${diagnostics.determinant.toExponential(4)}</text>`;
    $('overlapPlot').innerHTML = svg(680, 250, `${matrix}${spectrum}`, 'two by two Gram matrix and withheld spectrum');
    setHidden('overlapSpectrumKey', !revealed);
    setHidden('overlapDetKey', !revealed);
  }

  function auditOverlap() {
    const caseId = $('overlapCase')?.value || 'overlap-a';
    const decision = $('overlapDecision')?.value || '';
    if (!decision) return setResult('overlapReadout', 'needs-work', '<strong>Commit an action.</strong>');
    const result = evaluateOverlapMission(caseId, decision);
    game.revealed.overlap.add(caseId);
    renderOverlap();
    if (!result.correct) return setResult('overlapReadout', 'needs-work', `<strong>Action rejected.</strong> det G=${result.diagnostics.determinant.toExponential(3)}, λmin=${Math.min(...result.diagnostics.eigenvalues).toExponential(3)}. Distinguish nonunit norm, numerical warning, and exact dependence.`);
    recordCase('overlap', caseId);
    const boundary = result.diagnostics.nearSingular ? 'Threshold scanning is evidence about numerical stability, not a universal physical cutoff.' : 'The determinant follows the declared finite overlap matrix.';
    setResult('overlapReadout', 'success', `<strong>Overlap artifact cleared.</strong> det G=${result.diagnostics.determinant.toExponential(4)}. ${boundary}`);
  }

  function renderSelection(kind) {
    const prefix = kind === 'oneBody' ? 'oneBody' : 'twoBody';
    const caseId = $(`${prefix}Case`)?.value || 'connection-a';
    const { left, right } = SELECTION_DOSSIERS[caseId];
    const revealed = game.revealed[kind].has(caseId) || game[kind].has(caseId);
    const rank = excitationProfile(left, right).rank;
    const row = (bits, y, label) => bits.map((bit, index) => `<rect class="many-orbital ${bit ? 'occupied' : ''} ${left[index] !== right[index] ? 'changed' : ''}" x="${130 + index * 70}" y="${y}" width="48" height="42" rx="8"></rect><text x="${154 + index * 70}" y="${y + 28}" text-anchor="middle" class="many-bit">${bit}</text>`).join('') + `<text x="105" y="${y + 28}" text-anchor="end">${label}</text>`;
    let body = row(left, 55, 'bra') + row(right, 135, 'ket');
    if (revealed) body += `<text x="340" y="225" text-anchor="middle" class="many-plot-oracle">excitation rank = ${rank} · ${kind === 'oneBody' ? `one-body ${rank <= 1 ? 'allowed' : 'forced zero'}` : `two-body ${rank <= 2 ? 'allowed' : 'forced zero'}`}</text>`;
    else body += '<text x="340" y="225" text-anchor="middle" class="many-muted">rank certificate hidden until commitment</text>';
    if (kind === 'twoBody') {
      body += renderTwoBodyEnergy(revealed);
      $('twoBodyPlot').innerHTML = svg(680, 515, body, 'selected determinant-pair connectivity and signed supplied determinant energy ledger');
    } else {
      $('oneBodyPlot').innerHTML = svg(680, 255, body, 'one-body determinant connectivity');
    }
    setHidden(`${prefix}RankKey`, !revealed);
  }

  function renderTwoBodyEnergy(revealed) {
    const energy = singleDeterminantEnergy([0, 1], [-1, -0.8, 0.2], [[0.4, 0.6, 0.1], [0.6, 0.5, 0.2], [0.1, 0.2, 0.3]], [[0.4, 0.2, 0], [0.2, 0.5, 0.05], [0, 0.05, 0.3]]);
    const values = [['h', energy.oneBody, 'indigo'], ['J', energy.coulomb, 'amber'], ['−K', energy.exchange, 'hatched']];
    const bars = values.map(([label, value, type], index) => {
      const x = 120 + index * 150, base = 360, height = Math.abs(value) * 40;
      const y = value >= 0 ? base - height : base;
      return `<rect class="many-energy-bar ${type}"${type === 'hatched' ? ' fill="url(#many-hatch)"' : ''} x="${x}" y="${y}" width="70" height="${height}" rx="7"></rect><text x="${x + 35}" y="485" text-anchor="middle">${label} ${value.toFixed(2)}</text>`;
    }).join('');
    const total = revealed ? `<line class="many-total-line" x1="540" x2="620" y1="${360 - energy.total * 35}" y2="${360 - energy.total * 35}"></line><text x="580" y="485" text-anchor="middle">total ${energy.total.toFixed(2)}</text>` : '<text x="580" y="485" text-anchor="middle" class="many-muted">total hidden</text>';
    setHidden('twoBodyOracleKey', !revealed);
    return `<line class="many-axis" x1="80" x2="640" y1="270" y2="270"></line><text x="340" y="300" text-anchor="middle" class="many-muted">fixed supplied-determinant expectation ledger</text><line class="many-axis" x1="80" x2="640" y1="360" y2="360"></line>${bars}${total}`;
  }

  function auditOneBody() {
    const caseId = $('oneBodyCase')?.value || 'connection-a';
    const decision = $('oneBodyDecision')?.value || '';
    if (!decision) return setResult('oneBodyReadout', 'needs-work', '<strong>Commit a structural decision.</strong>');
    const result = evaluateOneBodyMission(caseId, decision);
    game.revealed.oneBody.add(caseId);
    renderSelection('oneBody');
    if (!result.correct) return setResult('oneBodyReadout', 'needs-work', `<strong>Rank filter rejected.</strong> The pair differs by ${result.rank} substitution${result.rank === 1 ? '' : 's'}; a one-body operator changes at most one occupation.`);
    recordCase('oneBody', caseId);
    setResult('oneBodyReadout', 'success', `<strong>Connectivity classified.</strong> Rank ${result.rank} is ${result.structurallyAllowed ? 'structurally allowed' : 'forced to zero'} for a one-body operator. Actual integrals may impose additional zeros.`);
  }

  function auditTwoBody() {
    const caseId = $('twoBodyCase')?.value || 'connection-a';
    const decision = $('twoBodyDecision')?.value || '';
    const interpretation = $('energyInterpretation')?.value || '';
    if (!decision || !interpretation) return setResult('twoBodyReadout', 'needs-work', '<strong>Commit both fields.</strong> Structural rank and physical interpretation are separate evidence.');
    const result = evaluateTwoBodyMission(caseId, decision, interpretation);
    game.revealed.twoBody.add(caseId);
    renderSelection('twoBody');
    if (!result.structuralCorrect) return setResult('twoBodyReadout', 'needs-work', `<strong>Structural decision rejected.</strong> Rank ${result.rank}; a two-body operator can alter at most two occupations.`);
    if (!result.interpretationCorrect) return setResult('twoBodyReadout', 'needs-work', '<strong>Interpretation rejected.</strong> The ledger is an exact expectation in supplied orbitals: one-body + J − K. No stationarity or self-consistent optimization was performed.');
    recordCase('twoBody', caseId);
    setResult('twoBodyReadout', 'success', `<strong>Pair-operator dossier cleared.</strong> Rank ${result.rank} passes the two-body filter, and the displayed J−K ledger is not mislabeled as Hartree–Fock.`);
  }

  function renderSpin() {
    const caseId = $('spinCase')?.value || 'spin-a';
    const item = SPIN_DOSSIERS[caseId];
    const model = spinCoupling(...item.coefficients);
    const revealed = game.revealed.spin.has(caseId) || game.spin.has(caseId);
    const normalized = item.coefficients.map(value => value / Math.sqrt(item.coefficients[0] ** 2 + item.coefficients[1] ** 2));
    let body = `<line class="many-axis" x1="80" x2="600" y1="140" y2="140"></line><rect class="many-coefficient indigo" x="130" y="${normalized[0] >= 0 ? 140 - Math.abs(normalized[0]) * 80 : 140}" width="80" height="${Math.abs(normalized[0]) * 80}"></rect><rect class="many-coefficient coral" x="270" y="${normalized[1] >= 0 ? 140 - Math.abs(normalized[1]) * 80 : 140}" width="80" height="${Math.abs(normalized[1]) * 80}"></rect><text x="170" y="225" text-anchor="middle">D₁ ${normalized[0].toFixed(3)}</text><text x="310" y="225" text-anchor="middle">D₂ ${normalized[1].toFixed(3)}</text>`;
    if (revealed) body += `<rect class="many-weight singlet" x="440" y="${180 - model.singletWeight * 100}" width="55" height="${model.singletWeight * 100}"></rect><rect class="many-weight triplet" x="525" y="${180 - model.tripletWeight * 100}" width="55" height="${model.tripletWeight * 100}"></rect><text x="467" y="225" text-anchor="middle">¹S ${model.singletWeight.toFixed(2)}</text><text x="552" y="225" text-anchor="middle">³S ${model.tripletWeight.toFixed(2)}</text><text x="510" y="42" text-anchor="middle" class="many-plot-oracle">⟨S²⟩=${model.s2.toFixed(2)}</text>`;
    else body += '<text x="510" y="115" text-anchor="middle" class="many-muted">spin weights hidden</text>';
    $('spinPlot').innerHTML = svg(680, 250, body, 'determinant coefficients and withheld spin weights');
    setHidden('spinWeightKey', !revealed);
  }

  function auditSpin() {
    const caseId = $('spinCase')?.value || 'spin-a';
    const decision = $('spinDecision')?.value || '';
    if (!decision) return setResult('spinReadout', 'needs-work', '<strong>Commit a spin diagnosis.</strong>');
    const result = evaluateSpinMission(caseId, decision);
    game.revealed.spin.add(caseId);
    renderSpin();
    if (!result.correct) return setResult('spinReadout', 'needs-work', `<strong>Spin diagnosis rejected.</strong> Under the declared determinant ordering, the revealed weights are singlet ${result.model.singletWeight.toFixed(2)} and triplet ${result.model.tripletWeight.toFixed(2)}.`);
    recordCase('spin', caseId);
    setResult('spinReadout', 'success', `<strong>Spin file cleared.</strong> ${esc(spinClassification(result.model))} with ⟨S²⟩=${result.model.s2.toFixed(2)} under the declared D₁/D₂ convention.`);
  }

  function oneRdmData(caseId) {
    if (caseId === 'one-rdm-a') {
      const gamma = oneRDM({ determinants: [[1, 0, 0, 1]], coefficients: [1] });
      return { gamma, electrons: 2, audit: auditOneRDM(gamma, 2) };
    }
    if (caseId === 'one-rdm-b') {
      const gamma = oneRDM({ determinants: [[1, 0, 0, 1], [0, 1, 1, 0]], coefficients: [1, -1] });
      return { gamma, electrons: 2, audit: auditOneRDM(gamma, 2) };
    }
    if (caseId !== 'one-rdm-c') return null;
    const gamma = [[1, 0, 0], [0, 0.7, 0], [0, 0, 0.6]];
    return { gamma, electrons: 2, audit: auditOneRDM(gamma, 2) };
  }

  function renderOneRdm() {
    const caseId = $('oneRdmCase')?.value || 'one-rdm-a';
    const data = oneRdmData(caseId);
    const revealed = game.revealed.oneRdm.has(caseId) || game.oneRdm.has(caseId);
    const width = 500 / data.audit.occupations.length;
    const suppliedDiagonal = data.gamma.map((row, index) => row[index].toFixed(2)).join(', ');
    let body = `<text x="340" y="28" text-anchor="middle" class="many-matrix">supplied diagonal γ_pp = (${suppliedDiagonal})</text><rect x="80" y="45" width="520" height="140" rx="12" fill="#eef2ff"></rect><line class="many-pauli-line" x1="80" x2="600" y1="45" y2="45"></line><line class="many-axis" x1="80" x2="600" y1="185" y2="185"></line>`;
    if (revealed) body += data.audit.occupations.map((value, index) => `<circle class="many-point teal" cx="${100 + index * width}" cy="${185 - Math.max(0, Math.min(1.25, value)) * 140}" r="10"></circle><text x="${100 + index * width}" y="218" text-anchor="middle">n${index + 1}=${value.toFixed(2)}</text>`).join('') + `<text x="340" y="248" text-anchor="middle" class="many-plot-oracle">Tr γ=${data.audit.trace.toFixed(2)} · ||γ²−γ||∞=${data.audit.idempotencyResidual.toExponential(2)}</text>`;
    else body += '<text x="340" y="120" text-anchor="middle" class="many-muted">trace and idempotency certificate hidden until commitment</text>';
    $('oneRdmPlot').innerHTML = svg(680, 275, body, 'natural spin-orbital occupation spectrum');
    setHidden('oneRdmOccupationKey', !revealed);
    setHidden('oneRdmTraceKey', !revealed);
  }

  function auditOneRdmMission() {
    const caseId = $('oneRdmCase')?.value || 'one-rdm-a';
    const decision = $('oneRdmDecision')?.value || '';
    if (!decision) return setResult('oneRdmReadout', 'needs-work', '<strong>Commit a 1-RDM diagnosis.</strong>');
    const result = evaluateRdmMission(caseId, decision);
    const data = oneRdmData(caseId);
    game.revealed.oneRdm.add(caseId);
    renderOneRdm();
    if (!result.correct) return setResult('oneRdmReadout', 'needs-work', `<strong>Diagnosis rejected.</strong> Tr γ=${data.audit.trace.toFixed(2)}, Pauli bounds ${data.audit.pauliAllowed ? 'pass' : 'fail'}, idempotency residual ${data.audit.idempotencyResidual.toExponential(2)}.`);
    recordCase('oneRdm', caseId);
    setResult('oneRdmReadout', 'success', `<strong>1-RDM dossier cleared.</strong> Trace=${data.audit.trace.toFixed(2)} and ${data.audit.idempotent ? 'idempotent determinant occupations' : !data.audit.traceCorrect ? 'the trace mismatch requires rejection' : 'fractional occupations expose non-single-determinant character'}.`);
  }

  function twoRdmData(caseId) {
    const state = { determinants: [[1, 0, 0, 1], [0, 1, 1, 0]], coefficients: [1, -1] };
    const exact = rdmDiagnostics(state);
    if (caseId === 'two-rdm-a') return { supplied: true, gamma: exact.gamma, gamma2: exact.gamma2, diagnostics: exact };
    if (caseId === 'two-rdm-c') return { supplied: false, gamma: exact.gamma, gamma2: null, diagnostics: null };
    if (caseId !== 'two-rdm-b') return null;
    const corrupted = exact.gamma2.map(level1 => level1.map(level2 => level2.map(row => row.slice())));
    corrupted[0][3][0][3] += 0.2;
    return { supplied: true, gamma: exact.gamma, gamma2: corrupted, diagnostics: rdmDiagnostics({ gamma: exact.gamma, gamma2: corrupted, electrons: 2 }) };
  }

  function renderTwoRdm() {
    const caseId = $('twoRdmCase')?.value || 'two-rdm-a';
    const data = twoRdmData(caseId);
    const revealed = game.revealed.twoRdm.has(caseId) || game.twoRdm.has(caseId);
    const pairEntries = [];
    if (data.supplied) {
      for (let p = 0; p < data.gamma2.length; p += 1) for (let q = 0; q < data.gamma2.length; q += 1) {
        const value = data.gamma2[p][q][p][q];
        if (Math.abs(value) > EPS) pairEntries.push(`Γ${p}${q},${p}${q}=${value.toFixed(2)}`);
      }
    }
    let body = `<rect class="many-certificate ${data.supplied ? 'supplied' : 'missing'}" x="55" y="65" width="160" height="105" rx="14"></rect><text x="135" y="108" text-anchor="middle">${data.supplied ? 'Γ supplied' : 'Γ absent'}</text><text x="135" y="138" text-anchor="middle">γ supplied</text><path class="many-contract-arrow" d="M 235 116 L 300 116"></path>`;
    if (data.supplied) {
      body += `<text x="320" y="62" class="many-matrix">supplied nonzero pair diagonal:</text><text x="320" y="92" class="many-matrix">${pairEntries.slice(0, 2).join(' · ')}</text><text x="320" y="122" class="many-matrix">${pairEntries.slice(2).join(' · ')}</text><text x="320" y="152" class="many-matrix">γ₀₀=${data.gamma[0][0].toFixed(2)}</text>`;
    } else body += '<text x="450" y="115" text-anchor="middle" class="many-matrix">one-body record only</text>';
    if (revealed && data.supplied) body += `<text x="340" y="202" text-anchor="middle" class="many-plot-oracle">Tr Γ=${data.diagnostics.trace2.toFixed(2)} · target 2.00 · contraction residual ${data.diagnostics.contractionResidual.toExponential(2)}</text>`;
    else if (revealed) body += '<text x="450" y="202" text-anchor="middle" class="many-plot-oracle">certificate withheld: no Γ</text>';
    else body += '<text x="450" y="202" text-anchor="middle" class="many-muted">trace/contraction certificate hidden</text>';
    $('twoRdmPlot').innerHTML = svg(680, 245, body, 'pair-density trace and contraction certificate');
    setHidden('twoRdmTraceKey', !revealed || !data.supplied);
    setHidden('twoRdmContractKey', !revealed);
  }

  function auditTwoRdmMission() {
    const caseId = $('twoRdmCase')?.value || 'two-rdm-a';
    const decision = $('twoRdmDecision')?.value || '';
    if (!decision) return setResult('twoRdmReadout', 'needs-work', '<strong>Commit a pair-certificate decision.</strong>');
    const result = evaluateTwoRdmMission(caseId, decision);
    const data = twoRdmData(caseId);
    game.revealed.twoRdm.add(caseId);
    renderTwoRdm();
    if (!result.correct) {
      const evidence = data.supplied ? `Tr Γ=${data.diagnostics.trace2.toFixed(2)}, contraction residual ${data.diagnostics.contractionResidual.toExponential(2)}` : 'the pair-density object is absent';
      return setResult('twoRdmReadout', 'needs-work', `<strong>Certificate decision rejected.</strong> ${evidence}.`);
    }
    recordCase('twoRdm', caseId);
    const caveat = !data.supplied ? 'One-body evidence cannot establish pair consistency.' : data.diagnostics.contractionResidual <= 1e-9 ? 'It passes the stated necessary checks because both RDMs came from the normalized finite CI state; this is not a general shortcut to full N-representability.' : 'The corrupted pair record is inconsistent with the supplied γ.';
    setResult('twoRdmReadout', 'success', `<strong>Pair dossier cleared.</strong> ${caveat}`);
  }

  function syncBoss() {
    const caseId = $('manyBossCase')?.value || 'boss-a';
    const file = BOSS_FILES[caseId];
    const cleared = game.boss.cleared.has(caseId);
    const stage = cleared ? 3 : (game.boss.stage[caseId] || 0);
    const budget = game.boss.budget[caseId] || 4;
    if ($('manyBossTitle')) $('manyBossTitle').textContent = file.title;
    if ($('manyBossArtifact')) $('manyBossArtifact').textContent = file.artifacts[stage];
    if ($('manyBossStage')) $('manyBossStage').textContent = cleared ? 'Dossier cleared · caveat retained' : `Stage ${stage + 1} / 3 · ${budget} token${budget === 1 ? '' : 's'}`;
    const controls = [$('manyBossRepresentation'), $('manyBossDiagnostic'), $('manyBossEvidence')];
    const answers = game.boss.answers[caseId] || [];
    controls.forEach((control, index) => {
      if (!control) return;
      if (index < stage || cleared) control.value = answers[index] || '';
      else if (index > stage) control.value = '';
      control.disabled = cleared || index !== stage;
    });
    if ($('manyBossAudit')) $('manyBossAudit').disabled = cleared;
    if (cleared) setResult('manyBossFeedback', 'success', '<strong>Dossier already cleared.</strong> Its final evidence and caveat remain visible.');
    else if (stage === 0) setResult('manyBossFeedback', 'neutral', 'Stage 1: commit the representation. Later fields stay locked.');
    else if (stage === 1) setResult('manyBossFeedback', 'neutral', 'Stage 2: representation locked; commit the diagnostic.');
    else setResult('manyBossFeedback', 'neutral', 'Stage 3: prior commitments locked; commit the surviving evidence.');
    renderGameProgress();
  }

  function resetBossCase() {
    const caseId = $('manyBossCase')?.value || 'boss-a';
    game.boss.cleared.delete(caseId);
    game.boss.stage[caseId] = 0;
    game.boss.budget[caseId] = 4;
    delete game.boss.answers[caseId];
    for (const id of ['manyBossRepresentation', 'manyBossDiagnostic', 'manyBossEvidence']) if ($(id)) $(id).value = '';
    game.cleared.delete('many-electron-case-file');
    saveGameState();
    syncBoss();
  }

  function auditBoss() {
    const caseId = $('manyBossCase')?.value || 'boss-a';
    if (game.boss.cleared.has(caseId)) return;
    const stage = game.boss.stage[caseId] || 0;
    const controls = ['manyBossRepresentation', 'manyBossDiagnostic', 'manyBossEvidence'];
    const choice = $(controls[stage])?.value || '';
    if (!choice) return setResult('manyBossFeedback', 'needs-work', '<strong>Commit the unlocked stage.</strong> Empty submissions do not spend a token.');
    const result = evaluateManyElectronCase(caseId, stage, choice);
    if (!result.correct) {
      const nextBudget = (game.boss.budget[caseId] || 4) - 1;
      const exhausted = nextBudget <= 0;
      game.boss.budget[caseId] = exhausted ? 4 : nextBudget;
      if (exhausted) {
        game.boss.stage[caseId] = 0;
        delete game.boss.answers[caseId];
        for (const id of controls) if ($(id)) $(id).value = '';
      }
      saveGameState();
      syncBoss();
      return setResult('manyBossFeedback', 'needs-work', `<strong>Commitment rejected${exhausted ? '; dossier reset' : ''}.</strong> Re-read the surviving artifact. No answer slug is revealed.`);
    }
    const answers = game.boss.answers[caseId] || [];
    answers[stage] = choice;
    answers.length = stage + 1;
    game.boss.answers[caseId] = answers;
    const nextStage = stage + 1;
    game.boss.stage[caseId] = nextStage;
    if (nextStage === 3) {
      game.boss.cleared.add(caseId);
      game.boss.budget[caseId] = 4;
      saveGameState();
      syncBoss();
      setResult('manyBossFeedback', 'success', `<strong>Dossier cleared.</strong> ${esc(BOSS_FILES[caseId].artifacts[3])}`);
      maybeEarnBoss();
      return;
    }
    saveGameState();
    syncBoss();
    setResult('manyBossFeedback', 'success', `<strong>Stage accepted.</strong> ${esc(BOSS_FILES[caseId].artifacts[nextStage])} Commit the next unlocked field.`);
  }

  function resetGameState() {
    game.cleared.clear();
    for (const bucket of Object.keys(MISSION_CASE_MAP)) {
      game[bucket].clear();
      game.revealed[bucket].clear();
    }
    game.boss.cleared.clear();
    game.boss.stage = {};
    game.boss.budget = {};
    game.boss.answers = {};
    try { window.localStorage.removeItem(GAME_STORAGE_KEY); } catch (_error) { /* ignore */ }
    const defaults = {
      exchangeCase: 'exchange-a', exchangeDecision: '', occupancyCase: 'occupancy-a', occupancyOrbitals: '0,3', occupancyCount: '',
      parityCase: '1,0,2', paritySign: '', overlapCase: 'overlap-a', overlapDecision: '', oneBodyCase: 'connection-a', oneBodyDecision: '',
      twoBodyCase: 'connection-a', twoBodyDecision: '', energyInterpretation: '', spinCase: 'spin-a', spinDecision: '', oneRdmCase: 'one-rdm-a', oneRdmDecision: '',
      twoRdmCase: 'two-rdm-a', twoRdmDecision: '', manyBossCase: 'boss-a', manyBossRepresentation: '', manyBossDiagnostic: '', manyBossEvidence: ''
    };
    for (const [id, value] of Object.entries(defaults)) if ($(id)) $(id).value = value;
    for (const id of ['exchangeReadout', 'occupancyReadout', 'parityReadout', 'overlapReadout', 'oneBodyReadout', 'twoBodyReadout', 'spinReadout', 'oneRdmReadout', 'twoRdmReadout']) setResult(id, 'neutral', 'Fresh chapter state restored; commit the displayed dossier to reveal its oracle.');
    renderExchange(); renderOccupancy(); renderParity(); renderOverlap(); renderSelection('oneBody'); renderSelection('twoBody'); renderSpin(); renderOneRdm(); renderTwoRdm(); syncBoss(); renderGameProgress();
  }

  function bindCase(selectId, decisionIds, render, extra) {
    $(selectId)?.addEventListener('change', () => {
      for (const id of decisionIds) if ($(id)) $(id).value = '';
      if (extra) extra();
      render();
    });
  }

  function bindLessonKeyboardNavigation() {
    const buttons = [...document.querySelectorAll('.academy-lesson-nav button[data-step]')];
    buttons.forEach((button, index) => {
      button.addEventListener('keydown', event => {
        if (event.repeat) return;
        let next = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % buttons.length;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = buttons.length - 1;
        if (next === null) return;
        event.preventDefault();
        buttons[next].focus();
      });
    });
  }

  function init() {
    restoreGameState();
    bindCase('exchangeCase', ['exchangeDecision'], renderExchange);
    $('exchangeAudit')?.addEventListener('click', auditExchange);
    bindCase('occupancyCase', ['occupancyCount'], renderOccupancy, () => { if ($('occupancyOrbitals')) $('occupancyOrbitals').value = occupancyDefaults($('occupancyCase').value); });
    $('occupancyOrbitals')?.addEventListener('input', renderOccupancy);
    $('occupancyAudit')?.addEventListener('click', auditOccupancy);
    bindCase('parityCase', ['paritySign'], renderParity);
    $('parityAudit')?.addEventListener('click', auditParity);
    bindCase('overlapCase', ['overlapDecision'], renderOverlap);
    $('overlapAudit')?.addEventListener('click', auditOverlap);
    bindCase('oneBodyCase', ['oneBodyDecision'], () => renderSelection('oneBody'));
    $('oneBodyAudit')?.addEventListener('click', auditOneBody);
    bindCase('twoBodyCase', ['twoBodyDecision'], () => renderSelection('twoBody'));
    $('twoBodyAudit')?.addEventListener('click', auditTwoBody);
    bindCase('spinCase', ['spinDecision'], renderSpin);
    $('spinAudit')?.addEventListener('click', auditSpin);
    bindCase('oneRdmCase', ['oneRdmDecision'], renderOneRdm);
    $('oneRdmAudit')?.addEventListener('click', auditOneRdmMission);
    bindCase('twoRdmCase', ['twoRdmDecision'], renderTwoRdm);
    $('twoRdmAudit')?.addEventListener('click', auditTwoRdmMission);
    $('manyBossCase')?.addEventListener('change', () => {
      for (const id of ['manyBossRepresentation', 'manyBossDiagnostic', 'manyBossEvidence']) if ($(id)) $(id).value = '';
      syncBoss();
    });
    $('manyBossAudit')?.addEventListener('click', auditBoss);
    $('manyBossReset')?.addEventListener('click', resetBossCase);

    renderExchange(); renderOccupancy(); renderParity(); renderOverlap(); renderSelection('oneBody'); renderSelection('twoBody'); renderSpin(); renderOneRdm(); renderTwoRdm(); syncBoss();
    window.ProjectXCAcademy?.bindChapter({ chapterId: 'qc-many-electron', totalMissions: 10 });
    window.addEventListener('project-xc-academy-progress', renderGameProgress);
    renderGameProgress();
    document.querySelectorAll('.academy-complete[data-game-gate]').forEach(button => button.addEventListener('click', () => window.setTimeout(() => {
      renderGameProgress();
      if (button.disabled) {
        const heading = button.closest('.academy-lesson')?.querySelector('h2');
        if (heading) { heading.tabIndex = -1; heading.focus(); }
      }
    }, 0)));
    $('resetChapterProgress')?.addEventListener('click', resetGameState);
    bindLessonKeyboardNavigation();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
