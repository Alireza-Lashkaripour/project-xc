(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const TAU = 2 * Math.PI;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);

  function svg(width, height, body, label) {
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  }

  function background(width, height) {
    return `<rect x="0" y="0" width="${width}" height="${height}" rx="16" fill="#fbfdff"></rect>`;
  }

  function axes(width, height, pad, zeroY = height - pad) {
    return `${background(width, height)}<line x1="${pad}" x2="${width - pad}" y1="${zeroY}" y2="${zeroY}" stroke="#cbd5e1" stroke-width="1.5"></line><line x1="${pad}" x2="${pad}" y1="${pad}" y2="${height - pad}" stroke="#cbd5e1" stroke-width="1.5"></line>`;
  }

  function pathFrom(points, xMap, yMap) {
    return points.map(([x, y], index) => `${index ? 'L' : 'M'} ${xMap(x).toFixed(2)} ${yMap(y).toFixed(2)}`).join(' ');
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

  function normalizationModel(shape, width, scale) {
    const amplitude = x => {
      if (shape === 'exponential') return scale * Math.exp(-Math.abs(x) / width);
      if (shape === 'two-lobe') return scale * (x / width) * Math.exp(-x * x / (2 * width * width));
      return scale * Math.exp(-x * x / (4 * width * width));
    };
    const raw = sample(-6, 6, 321, x => amplitude(x) ** 2);
    const rawArea = trapz(raw);
    const normFactor = 1 / Math.sqrt(rawArea);
    const normalized = raw.map(([x, density]) => [x, density / rawArea]);
    return { raw, normalized, rawArea, normalizedArea: trapz(normalized), normFactor };
  }

  function updateNormalization() {
    const shape = $('normShape')?.value || 'gaussian';
    const width = Number($('normWidth')?.value || 1);
    const scale = Number($('normScale')?.value || 1);
    const model = normalizationModel(shape, width, scale);
    const widthPx = 720, height = 320, pad = 46;
    const maxY = Math.max(...model.raw.map(point => point[1]), ...model.normalized.map(point => point[1]), 0.01) * 1.08;
    const xMap = x => pad + (x + 6) / 12 * (widthPx - 2 * pad);
    const yMap = y => height - pad - y / maxY * (height - 2 * pad);
    const body = `${axes(widthPx, height, pad)}
      <path d="${pathFrom(model.raw, xMap, yMap)}" fill="none" stroke="#f97316" stroke-width="3" stroke-dasharray="7 5"></path>
      <path d="${pathFrom(model.normalized, xMap, yMap)}" fill="none" stroke="#174ea6" stroke-width="5" stroke-linecap="round"></path>
      <text x="${pad + 8}" y="28" class="axis-label">orange raw density · blue normalized density</text>
      <text x="${widthPx - 78}" y="${height - 16}" class="axis-label">x →</text>`;
    if ($('normalizationPlot')) $('normalizationPlot').innerHTML = svg(widthPx, height, body, 'Raw and normalized probability density');
    if ($('normalizationReadout')) {
      $('normalizationReadout').innerHTML = `<strong>Numerical normalization:</strong> raw area = ${model.rawArea.toFixed(5)} on x∈[−6,6]. Multiply the raw amplitude by N=${model.normFactor.toFixed(5)}; the displayed normalized density then integrates to ${model.normalizedArea.toFixed(6)}.`;
    }
  }

  function normalizedDensity(points) {
    const area = trapz(points);
    return points.map(([x, value]) => [x, value / area]);
  }

  function phaseModel(mode, angle, waveNumber) {
    const makeDensity = relativeAngle => sample(-5, 5, 401, x => {
      const envelope = Math.exp(-x * x / (2 * 1.35 * 1.35));
      const aRe = envelope * Math.cos(waveNumber * x);
      const aIm = envelope * Math.sin(waveNumber * x);
      const bRe0 = envelope * Math.cos(-waveNumber * x);
      const bIm0 = envelope * Math.sin(-waveNumber * x);
      const bRe = bRe0 * Math.cos(relativeAngle) - bIm0 * Math.sin(relativeAngle);
      const bIm = bRe0 * Math.sin(relativeAngle) + bIm0 * Math.cos(relativeAngle);
      const re = aRe + bRe;
      const im = aIm + bIm;
      return re * re + im * im;
    });
    const reference = normalizedDensity(makeDensity(0));
    if (mode === 'relative') return { reference, current: normalizedDensity(makeDensity(angle)) };
    // Multiplication of the complete state by exp(i angle) cannot alter its density.
    return { reference, current: reference.map(point => [...point]) };
  }

  function updatePhase() {
    const mode = $('phaseMode')?.value || 'global';
    const angle = Number($('phaseAngle')?.value || 0);
    const waveNumber = Number($('phaseWaveNumber')?.value || 2.1);
    const model = phaseModel(mode, angle, waveNumber);
    const width = 720, height = 320, pad = 46;
    const maxY = Math.max(...model.reference.map(point => point[1]), ...model.current.map(point => point[1]), 0.01) * 1.08;
    const xMap = x => pad + (x + 5) / 10 * (width - 2 * pad);
    const yMap = y => height - pad - y / maxY * (height - 2 * pad);
    const maxDifference = Math.max(...model.current.map((point, index) => Math.abs(point[1] - model.reference[index][1])));
    const body = `${axes(width, height, pad)}
      <path d="${pathFrom(model.reference, xMap, yMap)}" fill="none" stroke="#94a3b8" stroke-width="4" stroke-dasharray="7 6"></path>
      <path d="${pathFrom(model.current, xMap, yMap)}" fill="none" stroke="#174ea6" stroke-width="4" stroke-linecap="round"></path>
      <text x="${pad + 8}" y="28" class="axis-label">gray dashed δ=0 reference · blue current density</text>
      <text x="${width - 78}" y="${height - 16}" class="axis-label">x →</text>`;
    if ($('phasePlot')) $('phasePlot').innerHTML = svg(width, height, body, 'Global phase and relative phase probability density');
    const degrees = angle * 180 / Math.PI;
    if ($('phaseReadout')) {
      $('phaseReadout').innerHTML = mode === 'global'
        ? `<strong>Global phase ${degrees.toFixed(1)}°:</strong> the maximum density change is ${maxDifference.toExponential(2)} (numerical zero). The state vector changed representation, but every position probability stayed fixed.`
        : `<strong>Relative phase ${degrees.toFixed(1)}°:</strong> the interference density changes by as much as ${maxDifference.toFixed(4)} relative density units. Relative phase moves constructive and destructive fringes.`;
    }
  }

  function boxModel(n, length) {
    const amplitude = Math.sqrt(2 / length);
    const points = sample(0, length, 321, x => amplitude * Math.sin(n * Math.PI * x / length));
    const density = points.map(([x, value]) => [x, value * value]);
    return {
      points,
      density,
      amplitude,
      energyRatio: n * n / (length * length),
      wavelength: 2 * length / n,
      nodes: Array.from({ length: n - 1 }, (_unused, index) => (index + 1) * length / n),
      densityArea: trapz(density)
    };
  }

  function updateBox() {
    const n = Number($('boxN')?.value || 1);
    const length = Number($('boxLength')?.value || 1);
    const display = $('boxDisplay')?.value || 'both';
    const model = boxModel(n, length);
    const width = 720, height = 330, pad = 50;
    const xMap = x => pad + x / length * (width - 2 * pad);
    const yMap = y => height / 2 - y / (model.amplitude * 1.15) * (height / 2 - pad);
    const densityVisual = model.density.map(([x, value]) => [x, value / (model.amplitude * model.amplitude) * model.amplitude * 0.8]);
    const nodeLines = model.nodes.map(node => `<line x1="${xMap(node)}" x2="${xMap(node)}" y1="${pad}" y2="${height - pad}" stroke="#7c3aed" stroke-width="1.5" stroke-dasharray="4 5"></line>`).join('');
    const wave = display !== 'density' ? `<path d="${pathFrom(model.points, xMap, yMap)}" fill="none" stroke="#174ea6" stroke-width="4"></path>` : '';
    const density = display !== 'wave' ? `<path d="${pathFrom(densityVisual, xMap, yMap)}" fill="none" stroke="#f97316" stroke-width="4"></path>` : '';
    const body = `${background(width, height)}
      <line x1="${pad}" x2="${width - pad}" y1="${height / 2}" y2="${height / 2}" stroke="#cbd5e1" stroke-width="1.5"></line>
      <line x1="${pad}" x2="${pad}" y1="${pad}" y2="${height - pad}" stroke="#111827" stroke-width="4"></line>
      <line x1="${width - pad}" x2="${width - pad}" y1="${pad}" y2="${height - pad}" stroke="#111827" stroke-width="4"></line>
      ${nodeLines}${wave}${density}
      <text x="${pad + 8}" y="28" class="axis-label">blue ψₙ · orange rescaled |ψₙ|² · violet interior nodes</text>
      <text x="${pad - 8}" y="${height - 16}" class="axis-label">0</text>
      <text x="${width - pad - 8}" y="${height - 16}" class="axis-label">L</text>`;
    if ($('boxPlot')) $('boxPlot').innerHTML = svg(width, height, body, 'Particle in a one-dimensional infinite box');
    if ($('boxReadout')) {
      $('boxReadout').innerHTML = `<strong>State n=${n}:</strong> ${model.nodes.length} interior node${model.nodes.length === 1 ? '' : 's'}, wavelength 2L/n=${model.wavelength.toFixed(3)}, and E/E₁(L=1)=${model.energyRatio.toFixed(3)}. Numerical ∫|ψ|²dx=${model.densityArea.toFixed(6)}.`;
    }
  }

  function normalDensity(x, mean, sigma) {
    return Math.exp(-0.5 * ((x - mean) / sigma) ** 2) / (Math.sqrt(2 * Math.PI) * sigma);
  }

  function uncertaintyModel(sigmaX, center, k0) {
    const sigmaP = 1 / (2 * sigmaX);
    return {
      sigmaX,
      sigmaP,
      product: sigmaX * sigmaP,
      center,
      k0,
      position: sample(-6, 6, 321, x => normalDensity(x, center, sigmaX)),
      momentum: sample(-10, 10, 321, p => normalDensity(p, k0, sigmaP)),
      fwhmX: 2 * Math.sqrt(2 * Math.log(2)) * sigmaX,
      fwhmP: 2 * Math.sqrt(2 * Math.log(2)) * sigmaP
    };
  }

  function updateUncertainty() {
    const sigmaX = Number($('uncertaintySigma')?.value || 0.8);
    const center = Number($('uncertaintyCenter')?.value || 0);
    const k0 = Number($('uncertaintyK')?.value || 1.2);
    const model = uncertaintyModel(sigmaX, center, k0);
    const width = 740, height = 340, pad = 42, gap = 36;
    const panelWidth = (width - 2 * pad - gap) / 2;
    const panelTop = 50, panelBottom = height - 46, panelHeight = panelBottom - panelTop;
    const posMax = Math.max(...model.position.map(point => point[1])) * 1.08;
    const momMax = Math.max(...model.momentum.map(point => point[1])) * 1.08;
    const xPos = x => pad + (x + 6) / 12 * panelWidth;
    const xMom = p => pad + panelWidth + gap + (p + 10) / 20 * panelWidth;
    const yPos = value => panelBottom - value / posMax * panelHeight;
    const yMom = value => panelBottom - value / momMax * panelHeight;
    const body = `${background(width, height)}
      <rect x="${pad}" y="${panelTop}" width="${panelWidth}" height="${panelHeight}" rx="10" fill="#f8fbff" stroke="#dbeafe"></rect>
      <rect x="${pad + panelWidth + gap}" y="${panelTop}" width="${panelWidth}" height="${panelHeight}" rx="10" fill="#fffaf4" stroke="#fed7aa"></rect>
      <path d="${pathFrom(model.position, xPos, yPos)}" fill="none" stroke="#174ea6" stroke-width="4"></path>
      <path d="${pathFrom(model.momentum, xMom, yMom)}" fill="none" stroke="#f97316" stroke-width="4"></path>
      <text x="${pad + 8}" y="32" class="axis-label">position density · σₓ=${model.sigmaX.toFixed(2)}</text>
      <text x="${pad + panelWidth + gap + 8}" y="32" class="axis-label">momentum density · σₚ=${model.sigmaP.toFixed(2)} (ℏ=1)</text>
      <text x="${pad + panelWidth - 34}" y="${height - 17}" class="axis-label">x →</text>
      <text x="${width - pad - 34}" y="${height - 17}" class="axis-label">p →</text>`;
    if ($('uncertaintyPlot')) $('uncertaintyPlot').innerHTML = svg(width, height, body, 'Gaussian position and momentum uncertainty distributions');
    if ($('uncertaintyReadout')) {
      $('uncertaintyReadout').innerHTML = `<strong>Minimum-uncertainty packet:</strong> σₓ=${model.sigmaX.toFixed(3)}, σₚ=${model.sigmaP.toFixed(3)}ℏ, product=${model.product.toFixed(3)}ℏ. Position FWHM=${model.fwhmX.toFixed(3)}; momentum FWHM=${model.fwhmP.toFixed(3)}ℏ.`;
    }
  }

  function spinModel(thetaDegrees, phiDegrees, axis, trials) {
    const theta = thetaDegrees * Math.PI / 180;
    const phi = phiDegrees * Math.PI / 180;
    const vector = {
      x: Math.sin(theta) * Math.cos(phi),
      y: Math.sin(theta) * Math.sin(phi),
      z: Math.cos(theta)
    };
    const measurement = ({ x: { x: 1, y: 0, z: 0 }, y: { x: 0, y: 1, z: 0 }, z: { x: 0, y: 0, z: 1 } })[axis];
    const dot = vector.x * measurement.x + vector.y * measurement.y + vector.z * measurement.z;
    const pPlus = clamp((1 + dot) / 2, 0, 1);
    const pMinus = 1 - pPlus;
    return { vector, measurement, dot, pPlus, pMinus, expectedPlus: trials * pPlus, expectedMinus: trials * pMinus };
  }

  function updateSpin() {
    const theta = Number($('spinTheta')?.value || 55);
    const phi = Number($('spinPhi')?.value || 35);
    const axis = $('spinAxis')?.value || 'z';
    const trials = Number($('spinTrials')?.value || 200);
    const model = spinModel(theta, phi, axis, trials);
    const width = 720, height = 340, cx = 180, cy = 175, radius = 108;
    const endX = cx + model.vector.x * radius;
    const endY = cy - model.vector.z * radius;
    const axisEndX = cx + model.measurement.x * radius * 0.9;
    const axisEndY = cy - model.measurement.z * radius * 0.9;
    const barBase = 285, maxHeight = 185;
    const plusHeight = model.pPlus * maxHeight;
    const minusHeight = model.pMinus * maxHeight;
    const body = `${background(width, height)}
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="#eff6ff" stroke="#93c5fd" stroke-width="3"></circle>
      <ellipse cx="${cx}" cy="${cy}" rx="${radius}" ry="28" fill="none" stroke="#cbd5e1" stroke-dasharray="6 5"></ellipse>
      <line x1="${cx}" x2="${cx}" y1="${cy - radius}" y2="${cy + radius}" stroke="#cbd5e1"></line>
      <line x1="${cx}" x2="${axisEndX}" y1="${cy}" y2="${axisEndY}" stroke="#f97316" stroke-width="5" stroke-dasharray="7 5"></line>
      <line x1="${cx}" x2="${endX}" y1="${cy}" y2="${endY}" stroke="#174ea6" stroke-width="6" stroke-linecap="round"></line>
      <circle cx="${endX}" cy="${endY}" r="8" fill="#174ea6"></circle>
      <text x="${cx - 58}" y="30" class="axis-label">Bloch projection (x–z)</text>
      <text x="${cx + 10}" y="${cy - radius + 15}" class="axis-label">+z</text>
      <text x="${cx + radius - 22}" y="${cy - 8}" class="axis-label">+x</text>
      <text x="${cx - 62}" y="${height - 25}" class="axis-label">state y component ${model.vector.y.toFixed(2)}</text>
      <line x1="390" x2="680" y1="${barBase}" y2="${barBase}" stroke="#cbd5e1"></line>
      <rect x="435" y="${barBase - plusHeight}" width="82" height="${plusHeight}" rx="8" fill="#174ea6"></rect>
      <rect x="565" y="${barBase - minusHeight}" width="82" height="${minusHeight}" rx="8" fill="#f97316"></rect>
      <text x="443" y="${barBase - plusHeight - 9}" class="axis-label">${(100 * model.pPlus).toFixed(1)}%</text>
      <text x="573" y="${barBase - minusHeight - 9}" class="axis-label">${(100 * model.pMinus).toFixed(1)}%</text>
      <text x="447" y="${barBase + 24}" class="axis-label">+${esc(axis)}</text>
      <text x="577" y="${barBase + 24}" class="axis-label">−${esc(axis)}</text>
      <text x="416" y="40" class="axis-label">ideal measurement probabilities</text>`;
    if ($('spinPlot')) $('spinPlot').innerHTML = svg(width, height, body, 'Spin Bloch projection and measurement probabilities');
    if ($('spinReadout')) {
      $('spinReadout').innerHTML = `<strong>Measure along ${axis}:</strong> P(+${axis})=${model.pPlus.toFixed(4)}, P(−${axis})=${model.pMinus.toFixed(4)}, sum=${(model.pPlus + model.pMinus).toFixed(4)}. Across ${trials} identical preparations, expected counts are ${model.expectedPlus.toFixed(1)} and ${model.expectedMinus.toFixed(1)}.`;
    }
  }

  function init() {
    const bindings = [
      [['normShape', 'normWidth', 'normScale'], updateNormalization],
      [['phaseMode', 'phaseAngle', 'phaseWaveNumber'], updatePhase],
      [['boxN', 'boxLength', 'boxDisplay'], updateBox],
      [['uncertaintySigma', 'uncertaintyCenter', 'uncertaintyK'], updateUncertainty],
      [['spinTheta', 'spinPhi', 'spinAxis', 'spinTrials'], updateSpin]
    ];
    bindings.forEach(([ids, update]) => {
      ids.forEach(id => {
        $(id)?.addEventListener('input', update);
        $(id)?.addEventListener('change', update);
      });
      update();
    });
    ProjectXCAcademy.bindChapter({ chapterId: 'qc-foundations', totalMissions: 10 });
  }

  // Pure models are exposed read-only for deterministic browser QA.
  window.QCFoundationsModels = Object.freeze({ normalizationModel, phaseModel, boxModel, uncertaintyModel, spinModel, trapz });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
