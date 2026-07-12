(() => {
  const $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  function setStep(step) {
    const s = Number(step) || 1;
    document.querySelectorAll('.lesson-nav button').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.step) === s));
    const fill = $('basisProgressFill');
    if (fill) fill.style.width = `${(s / 7) * 100}%`;
    const text = $('basisProgressText');
    if (text) text.textContent = `Level ${s} / 7`;
    const target = document.querySelector(`[data-step="${s}"].lesson-step`);
    if (target) target.scrollIntoView({behavior: 'smooth', block: 'start'});
  }

  function gaussian(alpha, l, r) {
    return Math.pow(r, l) * Math.exp(-alpha * r * r);
  }

  function updateGaussianLab() {
    const a1 = Number($('alpha1')?.value || 0.75);
    const a2 = Number($('alpha2')?.value || 2.4);
    const c2 = Number($('coef2')?.value || 0.45);
    const l = Number($('angularL')?.value || 0);
    const W = 760, H = 270, pad = 38;
    const points = [];
    let maxAbs = 0;
    for (let i = 0; i <= 140; i++) {
      const r = i / 140 * 5.2;
      const y = gaussian(a1, l, r) + c2 * gaussian(a2, l, r);
      points.push([r, y]);
      maxAbs = Math.max(maxAbs, Math.abs(y));
    }
    maxAbs = maxAbs || 1;
    const x = r => pad + (r / 5.2) * (W - 2*pad);
    const y = v => H/2 - (v / maxAbs) * (H/2 - pad);
    const path = points.map(([r, v], i) => `${i ? 'L' : 'M'} ${x(r).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
    const prim1 = points.map(([r], i) => `${i ? 'L' : 'M'} ${x(r).toFixed(1)} ${y(gaussian(a1,l,r)).toFixed(1)}`).join(' ');
    const prim2 = points.map(([r], i) => `${i ? 'L' : 'M'} ${x(r).toFixed(1)} ${y(c2*gaussian(a2,l,r)).toFixed(1)}`).join(' ');
    const overlap = Math.pow((2*Math.sqrt(a1*a2))/(a1+a2), 1.5);
    const diversity = clamp(1 - Math.abs(overlap), 0, 1);
    const warning = overlap > 0.92 ? 'High overlap: the two primitives are nearly redundant; this is how linear dependence begins.' : overlap < 0.35 ? 'Low overlap: one primitive adds a genuinely different radial scale.' : 'Moderate overlap: useful contraction flexibility without being identical.';
    const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gaussian primitive and contraction plot">
      <rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="#fbfdff"></rect>
      <line x1="${pad}" x2="${W-pad}" y1="${H/2}" y2="${H/2}" stroke="#d0d5dd"></line>
      <line x1="${pad}" x2="${pad}" y1="${pad}" y2="${H-pad}" stroke="#d0d5dd"></line>
      <path d="${prim1}" fill="none" stroke="#93c5fd" stroke-width="3" stroke-dasharray="6 6"></path>
      <path d="${prim2}" fill="none" stroke="#f97316" stroke-width="3" stroke-dasharray="5 5"></path>
      <path d="${path}" fill="none" stroke="#174ea6" stroke-width="5" stroke-linecap="round"></path>
      <text x="${pad+8}" y="26" class="axis-label">radial envelope: r^l exp(-αr²), contracted sum in blue</text>
      <text x="${W-pad-110}" y="${H-18}" class="axis-label">r →</text>
    </svg>`;
    if ($('gaussianPlot')) $('gaussianPlot').innerHTML = svg;
    if ($('labReadout')) $('labReadout').innerHTML = `<strong>Shape readout:</strong> α₁=${a1.toFixed(2)}, α₂=${a2.toFixed(2)}, d₂=${c2.toFixed(2)}, ℓ=${l}. Primitive overlap ≈ ${overlap.toFixed(3)}; radial diversity score ${(100*diversity).toFixed(0)}%. ${warning}`;
  }

  const advice = {
    'neutral-dft': {
      minimal: ['Low', 'Too cramped for reliable bonding. Use at least polarized double-ζ.'],
      svp: ['Good starter', 'Reasonable for quick DFT geometries; confirm energies with triple-ζ.'],
      tzvp: ['Strong', 'A balanced routine choice for geometry and many thermochemical trends.'],
      'aug-tz': ['Overkill but safe', 'Diffuse functions may be unnecessary unless tails/response matter.'],
      'qz-extrap': ['Benchmark', 'More than needed for routine geometry, useful for reference data.']
    },
    anion: {
      minimal: ['Fail', 'No diffuse tail: the extra electron is artificially confined.'],
      svp: ['Risky', 'Still usually lacks diffuse functions.'],
      tzvp: ['Incomplete', 'Triple-ζ helps but diffuse functions are the key missing ingredient.'],
      'aug-tz': ['Good', 'Augmentation gives the density a physical tail.'],
      'qz-extrap': ['Excellent', 'Use augmented cardinal sets and check convergence.']
    },
    rydberg: {
      minimal: ['Fail', 'Rydberg orbitals require very diffuse functions.'],
      svp: ['Fail', 'Valence-only functions cannot represent the extended excited electron.'],
      tzvp: ['Risky', 'Angular/radial flexibility helps but missing diffuse shells dominate the error.'],
      'aug-tz': ['Good', 'Diffuse functions are mandatory; sometimes doubly augmented sets are needed.'],
      'qz-extrap': ['Excellent', 'Use augmented systematic sets and inspect orbital extent.']
    },
    noncovalent: {
      minimal: ['Fail', 'BSSE and missing polarization dominate.'],
      svp: ['Screening only', 'Use counterpoise if comparing dimers; triple-ζ is safer.'],
      tzvp: ['Good', 'Often reasonable with dispersion correction and BSSE checks.'],
      'aug-tz': ['Strong', 'Diffuse functions improve long-range density and weak binding.'],
      'qz-extrap': ['Benchmark', 'Best for high-quality interaction energies.']
    },
    correlated: {
      minimal: ['Fail', 'Correlation energy converges slowly with angular momentum.'],
      svp: ['Insufficient', 'Not systematic enough for benchmark correlation.'],
      tzvp: ['Useful', 'Good single-point tier but not a final CBS answer.'],
      'aug-tz': ['Strong', 'Use cc-pVXZ/aug-cc-pVXZ ladders and extrapolate.'],
      'qz-extrap': ['Excellent', 'Systematic cardinal extrapolation is the right strategy.']
    },
    'transition-metal': {
      minimal: ['Fail', 'd-shell energetics require polarization, balanced valence, and often relativistic/ECP treatment.'],
      svp: ['Screening only', 'May work for rough structures but spin gaps are fragile.'],
      tzvp: ['Good start', 'Use def2-TZVP/QZVP or specialized sets, inspect semicore and ECP choices.'],
      'aug-tz': ['Case-dependent', 'Diffuse is less central than balanced d/semi-core/relativistic treatment unless charged.'],
      'qz-extrap': ['High-level', 'Use matched ECP/relativistic Hamiltonian and check spin-state convergence.']
    }
  };

  function updateGame() {
    const scenario = $('scenarioSelect')?.value || 'neutral-dft';
    const choice = $('basisChoice')?.value || 'svp';
    const [rank, text] = advice[scenario][choice];
    if ($('basisGameResult')) $('basisGameResult').innerHTML = `<strong>${rank}</strong><p>${text}</p>`;
  }

  function init() {
    document.querySelectorAll('.lesson-nav button').forEach(btn => btn.addEventListener('click', () => setStep(btn.dataset.step)));
    ['alpha1','alpha2','coef2','angularL'].forEach(id => $(id)?.addEventListener('input', updateGaussianLab));
    ['scenarioSelect','basisChoice'].forEach(id => $(id)?.addEventListener('input', updateGame));
    updateGaussianLab();
    updateGame();
    const fill = $('basisProgressFill');
    if (fill) fill.style.width = `${100/7}%`;
    document.querySelector('.lesson-nav button[data-step="1"]')?.classList.add('active');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
