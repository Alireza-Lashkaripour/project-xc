(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  const radians = degrees => degrees * Math.PI / 180;
  const degrees = angle => angle * 180 / Math.PI;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const normSquared = vector => dot(vector, vector);

  function inputNumber(id, fallback) {
    const raw = $(id)?.value;
    if (typeof raw !== 'string' || raw.trim() === '') return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }

  function trapz(points) {
    let area = 0;
    for (let index = 1; index < points.length; index += 1) {
      const [x0, y0] = points[index - 1];
      const [x1, y1] = points[index];
      area += 0.5 * (y0 + y1) * (x1 - x0);
    }
    return area;
  }

  function sample(min, max, count, fn) {
    return Array.from({ length: count }, (_unused, index) => {
      const x = min + index * (max - min) / (count - 1);
      return [x, fn(x)];
    });
  }

  function moments(points) {
    const area = trapz(points);
    const mean = trapz(points.map(([x, y]) => [x, x * y])) / area;
    const variance = trapz(points.map(([x, y]) => [x, (x - mean) ** 2 * y])) / area;
    return { area, mean, variance };
  }

  function complexFromPolar(magnitude, phaseDegrees) {
    const phase = radians(phaseDegrees);
    const re = magnitude * Math.cos(phase);
    const im = magnitude * Math.sin(phase);
    return { re, im, modulusSquared: re * re + im * im, phase };
  }

  function projectionModel(vx, vy, angleDegrees) {
    const angle = radians(angleDegrees);
    const vector = [vx, vy];
    const basis = [Math.cos(angle), Math.sin(angle)];
    const coefficient = dot(vector, basis);
    const projection = [coefficient * basis[0], coefficient * basis[1]];
    const residual = [vx - projection[0], vy - projection[1]];
    return {
      vector,
      basis,
      coefficient,
      projection,
      residual,
      orthogonality: dot(residual, basis),
      normSquared: normSquared(vector),
      projectionNormSquared: normSquared(projection),
      residualNormSquared: normSquared(residual)
    };
  }

  function rotationModel(vx, vy, angleDegrees) {
    const angle = radians(angleDegrees);
    const c = Math.cos(angle), s = Math.sin(angle);
    const matrix = [[c, -s], [s, c]];
    const coordinates = [c * vx + s * vy, -s * vx + c * vy];
    const reconstructed = [
      c * coordinates[0] - s * coordinates[1],
      s * coordinates[0] + c * coordinates[1]
    ];
    const orthogonalityError = Math.max(
      Math.abs(c * c + s * s - 1),
      Math.abs((-s) * (-s) + c * c - 1),
      Math.abs(c * (-s) + s * c)
    );
    return {
      matrix,
      coordinates,
      reconstructed,
      normOriginal: Math.hypot(vx, vy),
      normCoordinates: Math.hypot(...coordinates),
      determinant: c * c + s * s,
      orthogonalityError,
      basis: [[c, s], [-s, c]]
    };
  }

  function symmetricEigen2x2(a, b, d) {
    const center = 0.5 * (a + d);
    const radius = 0.5 * Math.hypot(a - d, 2 * b);
    const theta = radius === 0 ? 0 : 0.5 * Math.atan2(2 * b, a - d);
    const c = Math.cos(theta), s = Math.sin(theta);
    return {
      values: [center - radius, center + radius],
      vectors: [[-s, c], [c, s]],
      angle: theta
    };
  }

  function eigenPuzzleModel(a, b, d, angleDegrees) {
    const angle = radians(angleDegrees);
    const vector = [Math.cos(angle), Math.sin(angle)];
    const transformed = [a * vector[0] + b * vector[1], b * vector[0] + d * vector[1]];
    const rayleigh = dot(vector, transformed);
    const residual = [transformed[0] - rayleigh * vector[0], transformed[1] - rayleigh * vector[1]];
    const spectrum = symmetricEigen2x2(a, b, d);
    return { vector, transformed, rayleigh, residual, residualNorm: Math.hypot(...residual), spectrum };
  }

  function normalDensity(x, mean, sigma) {
    return Math.exp(-0.5 * ((x - mean) / sigma) ** 2) / (Math.sqrt(2 * Math.PI) * sigma);
  }

  function fourierGaussianModel(sigmaX, k0) {
    const safeSigmaX = Math.max(1e-6, sigmaX);
    const sigmaK = 1 / (2 * safeSigmaX);
    const position = sample(-8 * safeSigmaX, 8 * safeSigmaX, 801, x => normalDensity(x, 0, safeSigmaX));
    const momentum = sample(k0 - 8 * sigmaK, k0 + 8 * sigmaK, 801, k => normalDensity(k, k0, sigmaK));
    const positionMoments = moments(position);
    const momentumMoments = moments(momentum);
    return {
      sigmaX: safeSigmaX,
      sigmaK,
      k0,
      widthProduct: safeSigmaX * sigmaK,
      position,
      momentum,
      positionArea: positionMoments.area,
      momentumArea: momentumMoments.area,
      positionMean: positionMoments.mean,
      momentumMean: momentumMoments.mean,
      positionVariance: positionMoments.variance,
      momentumVariance: momentumMoments.variance
    };
  }

  function svg(width, height, body, label, markerId) {
    const marker = markerId ? `<defs><marker id="${markerId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"></path></marker></defs>` : '';
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">${marker}<rect width="${width}" height="${height}" rx="16" fill="#fbfdff"></rect>${body}</svg>`;
  }

  function vectorLine(cx, cy, scale, vector, color, markerId, dash = '') {
    const x = cx + scale * vector[0], y = cy - scale * vector[1];
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="5" stroke-linecap="round" marker-end="url(#${markerId})" ${dash ? `stroke-dasharray="${dash}"` : ''}></line>`;
  }

  function coordinatePlane(width, height, cx, cy) {
    return `<line x1="34" x2="${width - 34}" y1="${cy}" y2="${cy}" stroke="#cbd5e1" stroke-width="1.5"></line><line x1="${cx}" x2="${cx}" y1="28" y2="${height - 28}" stroke="#cbd5e1" stroke-width="1.5"></line><text x="${width - 52}" y="${cy - 9}" class="axis-label">x</text><text x="${cx + 10}" y="58" class="axis-label">y</text>`;
  }

  function updateProjection() {
    const vx = inputNumber('projectionVX', 3), vy = inputNumber('projectionVY', 2);
    const angle = inputNumber('projectionAngle', 25);
    const model = projectionModel(vx, vy, angle);
    const width = 680, height = 360, cx = 330, cy = 185;
    const scale = 105 / Math.max(Math.hypot(vx, vy), 1);
    const guide = [model.basis[0] * 3.2, model.basis[1] * 3.2];
    const body = `${coordinatePlane(width, height, cx, cy)}
      <line x1="${cx - guide[0] * scale}" y1="${cy + guide[1] * scale}" x2="${cx + guide[0] * scale}" y2="${cy - guide[1] * scale}" stroke="#8b5cf6" stroke-width="2" stroke-dasharray="7 6"></line>
      ${vectorLine(cx, cy, scale, model.vector, '#174ea6', 'projection-arrow')}
      ${vectorLine(cx, cy, scale, model.projection, '#7c3aed', 'projection-arrow')}
      <line x1="${cx + model.projection[0] * scale}" y1="${cy - model.projection[1] * scale}" x2="${cx + vx * scale}" y2="${cy - vy * scale}" stroke="#f97316" stroke-width="4" stroke-dasharray="7 5"></line>
      <text x="40" y="34" class="axis-label">blue v · violet projection · orange residual</text>`;
    if ($('projectionPlot')) $('projectionPlot').innerHTML = svg(width, height, body, 'Vector projection and orthogonal residual', 'projection-arrow');
    if ($('projectionReadout')) $('projectionReadout').innerHTML = `<strong>Projection coefficient:</strong> θ=${angle.toFixed(1)}°; ⟨u|v⟩=${model.coefficient.toFixed(4)}. The residual is orthogonal within ${Math.abs(model.orthogonality).toExponential(2)}, and ‖v‖²=${model.normSquared.toFixed(4)}=${model.projectionNormSquared.toFixed(4)}+${model.residualNormSquared.toFixed(4)}.`;
  }

  function updateRotation() {
    const vx = inputNumber('rotationVX', 2.4), vy = inputNumber('rotationVY', 1.2);
    const angle = inputNumber('rotationAngle', 35);
    const model = rotationModel(vx, vy, angle);
    const width = 680, height = 360, cx = 330, cy = 185;
    const scale = 105 / Math.max(Math.hypot(vx, vy), 1);
    const [e1, e2] = model.basis;
    const body = `${coordinatePlane(width, height, cx, cy)}
      <line x1="${cx - e1[0] * 145}" y1="${cy + e1[1] * 145}" x2="${cx + e1[0] * 145}" y2="${cy - e1[1] * 145}" stroke="#7c3aed" stroke-width="3"></line>
      <line x1="${cx - e2[0] * 145}" y1="${cy + e2[1] * 145}" x2="${cx + e2[0] * 145}" y2="${cy - e2[1] * 145}" stroke="#f97316" stroke-width="3"></line>
      ${vectorLine(cx, cy, scale, [vx, vy], '#174ea6', 'rotation-arrow')}
      <text x="40" y="34" class="axis-label">blue physical vector · violet e₁′ · orange e₂′</text>`;
    if ($('rotationPlot')) $('rotationPlot').innerHTML = svg(width, height, body, 'Passive rotation of coordinates for a fixed vector', 'rotation-arrow');
    if ($('rotationReadout')) $('rotationReadout').innerHTML = `<strong>Same vector, new coordinates:</strong> θ=${angle.toFixed(1)}°; (${vx.toFixed(3)}, ${vy.toFixed(3)}) → (${model.coordinates[0].toFixed(3)}, ${model.coordinates[1].toFixed(3)}). Reconstructing returns (${model.reconstructed[0].toFixed(3)}, ${model.reconstructed[1].toFixed(3)}); norm change=${Math.abs(model.normOriginal - model.normCoordinates).toExponential(2)}.`;
  }

  const MATRIX_PRESETS = Object.freeze({
    coupled: [2, 1, 2],
    diagonal: [1, 0, 4],
    'near-degenerate': [1, 0.08, 1.05]
  });

  function applyMatrixPreset() {
    const preset = MATRIX_PRESETS[$('matrixPreset')?.value];
    if (preset) ['matrixA', 'matrixB', 'matrixD'].forEach((id, index) => { if ($(id)) $(id).value = preset[index]; });
    updateEigenPuzzle();
  }

  function updateEigenPuzzle() {
    const a = inputNumber('matrixA', 2), b = inputNumber('matrixB', 1), d = inputNumber('matrixD', 2);
    const angle = inputNumber('eigenAngle', 18);
    const model = eigenPuzzleModel(a, b, d, angle);
    const width = 680, height = 360, cx = 260, cy = 190;
    const maxLength = Math.max(Math.hypot(...model.transformed), Math.abs(model.rayleigh), 1);
    const scale = 105 / maxLength;
    const rayleighVector = model.vector.map(value => model.rayleigh * value);
    const body = `${coordinatePlane(520, height, cx, cy)}
      ${vectorLine(cx, cy, scale, model.vector, '#174ea6', 'eigen-arrow')}
      ${vectorLine(cx, cy, scale, model.transformed, '#f97316', 'eigen-arrow')}
      ${vectorLine(cx, cy, scale, rayleighVector, '#7c3aed', 'eigen-arrow', '7 5')}
      <text x="36" y="34" class="axis-label">blue v · orange Av · violet λ(v)v</text>
      <rect x="520" y="58" width="135" height="92" rx="12" fill="#eff6ff" stroke="#bfdbfe"></rect>
      <text x="536" y="87" class="axis-label">eigenvalues</text>
      <text x="536" y="116" class="metric-label">${model.spectrum.values[0].toFixed(4)}</text>
      <text x="536" y="140" class="metric-label">${model.spectrum.values[1].toFixed(4)}</text>
      <rect x="520" y="178" width="135" height="92" rx="12" fill="#fff7ed" stroke="#fed7aa"></rect>
      <text x="536" y="207" class="axis-label">residual ‖r‖</text>
      <text x="536" y="244" class="metric-label">${model.residualNorm.toFixed(5)}</text>`;
    if ($('eigenPlot')) $('eigenPlot').innerHTML = svg(width, height, body, 'Symmetric matrix eigenvector residual puzzle', 'eigen-arrow');
    if ($('eigenReadout')) $('eigenReadout').innerHTML = `<strong>Rayleigh quotient:</strong> θ=${angle.toFixed(2)}°; λ(v)=${model.rayleigh.toFixed(6)}; residual ‖Av−λv‖=${model.residualNorm.toExponential(3)}. ${model.residualNorm < 1e-7 ? 'This direction is an eigenvector.' : 'Rotate v until Av and v become parallel.'}`;
  }

  function alignEigenvector() {
    const a = inputNumber('matrixA', 2), b = inputNumber('matrixB', 1), d = inputNumber('matrixD', 2);
    const current = radians(inputNumber('eigenAngle', 18));
    const spectrum = symmetricEigen2x2(a, b, d);
    if (Math.abs(spectrum.values[1] - spectrum.values[0]) < 1e-12) {
      updateEigenPuzzle();
      return;
    }
    const distance = vector => Math.acos(Math.min(1, Math.abs(Math.cos(current) * vector[0] + Math.sin(current) * vector[1])));
    const chosen = distance(spectrum.vectors[0]) <= distance(spectrum.vectors[1]) ? spectrum.vectors[0] : spectrum.vectors[1];
    let angle = degrees(Math.atan2(chosen[1], chosen[0]));
    if (angle < 0) angle += 180;
    if ($('eigenAngle')) $('eigenAngle').value = angle.toFixed(6);
    updateEigenPuzzle();
  }

  function updateFourier() {
    const sigmaX = inputNumber('fourierSigmaX', 0.8);
    const k0 = inputNumber('fourierK0', 1.2);
    const target = inputNumber('fourierTarget', 0.75);
    const model = fourierGaussianModel(sigmaX, k0);
    const width = 740, height = 350, pad = 42, gap = 38;
    const panelWidth = (width - 2 * pad - gap) / 2;
    const top = 58, bottom = height - 48, panelHeight = bottom - top;
    const xExtent = Math.max(4, 3 * model.sigmaX);
    const kExtent = Math.max(4, Math.abs(model.k0) + 3 * model.sigmaK);
    const positionPlot = sample(-xExtent, xExtent, 801, x => normalDensity(x, 0, model.sigmaX));
    const momentumPlot = sample(-kExtent, kExtent, 801, k => normalDensity(k, model.k0, model.sigmaK));
    const positionMax = Math.max(...positionPlot.map(point => point[1])) * 1.08;
    const momentumMax = Math.max(...momentumPlot.map(point => point[1])) * 1.08;
    const xMap = x => pad + (x + xExtent) / (2 * xExtent) * panelWidth;
    const kMap = k => pad + panelWidth + gap + (k + kExtent) / (2 * kExtent) * panelWidth;
    const yPosition = value => bottom - value / positionMax * panelHeight;
    const yMomentum = value => bottom - value / momentumMax * panelHeight;
    const path = (points, xFn, yFn) => points.map(([x, y], index) => `${index ? 'L' : 'M'} ${xFn(x).toFixed(2)} ${yFn(y).toFixed(2)}`).join(' ');
    const body = `<rect x="${pad}" y="${top}" width="${panelWidth}" height="${panelHeight}" rx="12" fill="#f8fbff" stroke="#dbeafe"></rect>
      <rect x="${pad + panelWidth + gap}" y="${top}" width="${panelWidth}" height="${panelHeight}" rx="12" fill="#fffaf4" stroke="#fed7aa"></rect>
      <path d="${path(positionPlot, xMap, yPosition)}" fill="none" stroke="#174ea6" stroke-width="4"></path>
      <path d="${path(momentumPlot, kMap, yMomentum)}" fill="none" stroke="#f97316" stroke-width="4"></path>
      <text x="${pad + 8}" y="35" class="axis-label">x density · σₓ=${model.sigmaX.toFixed(3)}</text>
      <text x="${pad + panelWidth + gap + 8}" y="35" class="axis-label">k density · k₀=${model.k0.toFixed(2)} · σₖ=${model.sigmaK.toFixed(3)}</text>
      <text x="${pad + panelWidth - 24}" y="${height - 18}" class="axis-label">x</text>
      <text x="${width - pad - 24}" y="${height - 18}" class="axis-label">k</text>`;
    if ($('fourierPlot')) $('fourierPlot').innerHTML = svg(width, height, body, 'Gaussian position and Fourier-space probability densities');
    const gapValue = Math.abs(model.sigmaK - target);
    if ($('fourierReadout')) $('fourierReadout').innerHTML = `<strong>Symmetric Fourier convention:</strong> k₀=${model.k0.toFixed(2)}; σₓσₖ=${model.widthProduct.toFixed(6)}. Target σₖ=${target.toFixed(3)}; current σₖ=${model.sigmaK.toFixed(3)}; gap=${gapValue.toFixed(4)}. ${gapValue < 0.005 ? 'Target matched.' : 'Adjust σₓ: narrowing one distribution broadens its Fourier partner.'}`;
  }

  function matchFourierTarget() {
    const target = Math.max(0.05, inputNumber('fourierTarget', 0.75));
    if ($('fourierSigmaX')) $('fourierSigmaX').value = (1 / (2 * target)).toFixed(4);
    updateFourier();
  }

  function init() {
    const bindings = [
      [['projectionVX', 'projectionVY', 'projectionAngle'], updateProjection],
      [['rotationVX', 'rotationVY', 'rotationAngle'], updateRotation],
      [['matrixA', 'matrixB', 'matrixD', 'eigenAngle'], updateEigenPuzzle],
      [['fourierSigmaX', 'fourierK0', 'fourierTarget'], updateFourier]
    ];
    bindings.forEach(([ids, update]) => {
      ids.forEach(id => {
        $(id)?.addEventListener('input', update);
        $(id)?.addEventListener('change', update);
      });
      update();
    });
    ['matrixA', 'matrixB', 'matrixD'].forEach(id => {
      $(id)?.addEventListener('input', () => { if ($('matrixPreset')) $('matrixPreset').value = 'custom'; });
    });
    $('matrixPreset')?.addEventListener('change', applyMatrixPreset);
    $('alignEigenvector')?.addEventListener('click', alignEigenvector);
    $('matchFourierTarget')?.addEventListener('click', matchFourierTarget);
    ProjectXCAcademy.bindChapter({ chapterId: 'qc-math-language', totalMissions: 10 });
  }

  window.QCMathLanguageModels = Object.freeze({
    complexFromPolar,
    projectionModel,
    rotationModel,
    symmetricEigen2x2,
    eigenPuzzleModel,
    fourierGaussianModel,
    trapz
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
