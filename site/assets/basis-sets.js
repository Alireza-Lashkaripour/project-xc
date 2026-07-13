(() => {
  const $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const TOTAL_LEVELS = 12;
  const STORAGE_KEY = 'project-xc-basis-quest-badges-v2';
  const XP_TOTAL = 1200;

  function esc(v) { return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }
  function getBadges() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  }
  function setBadges(items) { localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(items)])); }
  function xpForBadge(name) {
    const btn = [...document.querySelectorAll('.quest-complete')].find(b => b.dataset.badge === name);
    return Number(btn?.dataset.xp || 0);
  }
  function renderBadges() {
    const badges = getBadges();
    const xp = badges.reduce((sum, b) => sum + xpForBadge(b), 0);
    const xpText = $('xpText');
    if (xpText) xpText.textContent = `XP ${Math.min(xp, XP_TOTAL)} / ${XP_TOTAL}`;
    const fill = $('basisProgressFill');
    if (fill) fill.style.width = `${clamp(xp / XP_TOTAL, 0, 1) * 100}%`;
    const shelf = $('badgeShelf');
    if (shelf) shelf.innerHTML = badges.length ? badges.map(b => `<span class="quest-badge">✓ ${esc(b)}</span>`).join('') : '<span class="quest-badge muted">No badges yet — complete a mission.</span>';
    document.querySelectorAll('.quest-complete').forEach(btn => {
      const done = badges.includes(btn.dataset.badge);
      btn.classList.toggle('done', done);
      btn.textContent = done ? `Completed: ${btn.dataset.badge}` : btn.dataset.originalText || btn.textContent;
    });
  }

  function completeMission(btn) {
    if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
    const badges = getBadges();
    if (!badges.includes(btn.dataset.badge)) badges.push(btn.dataset.badge);
    setBadges(badges);
    renderBadges();
  }

  function setStep(step) {
    const s = clamp(Number(step) || 1, 1, TOTAL_LEVELS);
    document.querySelectorAll('.lesson-nav button').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.step) === s));
    const text = $('basisProgressText');
    if (text) text.textContent = `Level ${s} / ${TOTAL_LEVELS}`;
    const target = document.querySelector(`[data-step="${s}"].lesson-step`);
    if (target) target.scrollIntoView({behavior: 'smooth', block: 'start'});
  }

  function gaussian(alpha, l, r) { return Math.pow(r, l) * Math.exp(-alpha * r * r); }
  function svgWrap(W, H, body, label='plot') { return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${body}</svg>`; }
  function axis(W,H,pad=38) { return `<rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="#fbfdff"></rect><line x1="${pad}" x2="${W-pad}" y1="${H-pad}" y2="${H-pad}" stroke="#d0d5dd"></line><line x1="${pad}" x2="${pad}" y1="${pad}" y2="${H-pad}" stroke="#d0d5dd"></line>`; }

  function updateGaussianLab() {
    const a1 = Number($('alpha1')?.value || 0.75), a2 = Number($('alpha2')?.value || 2.4), c2 = Number($('coef2')?.value || 0.45), l = Number($('angularL')?.value || 0);
    const W = 760, H = 280, pad = 42;
    const points = []; let maxAbs = 0;
    for (let i=0;i<=150;i++) { const r=i/150*5.4; const v=gaussian(a1,l,r)+c2*gaussian(a2,l,r); points.push([r,v]); maxAbs=Math.max(maxAbs,Math.abs(v)); }
    maxAbs = maxAbs || 1;
    const x = r => pad + (r/5.4)*(W-2*pad), y = v => H-pad - ((v/maxAbs+1)/2)*(H-2*pad);
    const path = points.map(([r,v],i)=>`${i?'L':'M'} ${x(r).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
    const p1 = points.map(([r],i)=>`${i?'L':'M'} ${x(r).toFixed(1)} ${y(gaussian(a1,l,r)).toFixed(1)}`).join(' ');
    const p2 = points.map(([r],i)=>`${i?'L':'M'} ${x(r).toFixed(1)} ${y(c2*gaussian(a2,l,r)).toFixed(1)}`).join(' ');
    const overlap = Math.pow((2*Math.sqrt(a1*a2))/(a1+a2), 1.5);
    const diversity = clamp(1 - Math.abs(overlap), 0, 1);
    const warning = overlap > 0.92 ? 'Danger: nearly redundant primitives — linear-dependence risk.' : overlap < 0.35 ? 'Great diversity: the primitives cover different radial scales.' : 'Good practice zone: some overlap, some flexibility.';
    const body = `${axis(W,H,pad)}<line x1="${pad}" x2="${W-pad}" y1="${y(0)}" y2="${y(0)}" stroke="#e5e7eb"></line><path d="${p1}" fill="none" stroke="#93c5fd" stroke-width="3" stroke-dasharray="6 6"></path><path d="${p2}" fill="none" stroke="#f97316" stroke-width="3" stroke-dasharray="5 5"></path><path d="${path}" fill="none" stroke="#174ea6" stroke-width="5" stroke-linecap="round"></path><text x="${pad+8}" y="28" class="axis-label">contracted radial function: primitive 1 + d₂ primitive 2</text><text x="${W-108}" y="${H-16}" class="axis-label">r →</text>`;
    if ($('gaussianPlot')) $('gaussianPlot').innerHTML = svgWrap(W,H,body,'Gaussian radial function plot');
    if ($('labReadout')) $('labReadout').innerHTML = `<strong>Shape readout:</strong> α₁=${a1.toFixed(2)}, α₂=${a2.toFixed(2)}, d₂=${c2.toFixed(2)}, ℓ=${l}. Primitive overlap ≈ ${overlap.toFixed(3)}; radial diversity ${(100*diversity).toFixed(0)}%. ${warning}`;
  }

  function updateAoShape() {
    const shape = $('aoShape')?.value || 's', orient = $('aoOrientation')?.value || 'z', amp = Number($('aoAmplitude')?.value || 1);
    const W=620,H=360,cx=W/2,cy=H/2,s=70*amp;
    let lobes = '';
    const ellipse = (x,y,rx,ry,rot,color,label='') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})" fill="${color}" fill-opacity=".44" stroke="${color}" stroke-width="3"></ellipse>${label?`<text x="${x-8}" y="${y+5}" font-size="18" fill="#111827">${label}</text>`:''}`;
    const rot = orient === 'x' ? 90 : orient === 'diag' ? 45 : 0;
    if (shape === 's') lobes = `<circle cx="${cx}" cy="${cy}" r="${s}" fill="#60a5fa" fill-opacity=".35" stroke="#174ea6" stroke-width="4"></circle><text x="${cx-10}" y="${cy+5}" font-size="22">+</text>`;
    if (shape === 'p') lobes = ellipse(cx,cy-s*.75,s*.45,s*.82,rot,'#2563eb','+') + ellipse(cx,cy+s*.75,s*.45,s*.82,rot,'#f97316','−');
    if (shape === 'd') lobes = [[-1,-1,'#2563eb','+'],[1,1,'#2563eb','+'],[1,-1,'#f97316','−'],[-1,1,'#f97316','−']].map(([dx,dy,c,l])=>ellipse(cx+dx*s*.62,cy+dy*s*.62,s*.38,s*.62,45+rot,c,l)).join('') + `<circle cx="${cx}" cy="${cy}" r="8" fill="#111827"></circle>`;
    if (shape === 'f') lobes = Array.from({length:6},(_,i)=>{ const a=i*Math.PI/3 + (orient==='diag'?Math.PI/6:0); const color=i%2?'#f97316':'#2563eb'; return ellipse(cx+Math.cos(a)*s*.75,cy+Math.sin(a)*s*.75,s*.28,s*.52,a*180/Math.PI,color,i%2?'−':'+'); }).join('');
    const body = `<rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="#fbfdff"></rect><line x1="${cx}" x2="${cx}" y1="42" y2="${H-42}" stroke="#d0d5dd" stroke-dasharray="5 5"></line><line x1="80" x2="${W-80}" y1="${cy}" y2="${cy}" stroke="#d0d5dd" stroke-dasharray="5 5"></line>${lobes}<text x="24" y="30" class="axis-label">${shape.toUpperCase()}-type angular basis function · orientation ${orient}</text>`;
    if ($('aoShapePlot')) $('aoShapePlot').innerHTML = svgWrap(W,H,body,'AO angular shape plot');
    const role = {s:'radial size/flexibility', p:'bond direction and lone-pair direction', d:'polarization and correlation angular freedom', f:'high-angular response and heavy-element flexibility'}[shape];
    if ($('aoReadout')) $('aoReadout').innerHTML = `<strong>${shape.toUpperCase()} function:</strong> ${role}. Orientation controls which chemical direction the function can describe.`;
  }

  function updateContractionForge() {
    const n=Number($('primitiveCount')?.value||4), split=Number($('splitValence')?.value||2), tight=Number($('contractTightness')?.value||0.55);
    const W=760,H=280,pad=38, baseY=H-58;
    let curves='';
    for (let i=0;i<n;i++) { const x0=60+i*(240/Math.max(1,n-1)); const height=60+120*(i+1)/n; const width=26+38*(1-tight); curves += `<path d="M${x0} ${baseY} C${x0+width} ${baseY-height}, ${x0+width*2} ${baseY-height}, ${x0+width*3} ${baseY}" fill="none" stroke="#60a5fa" stroke-width="3" opacity="${0.35+0.55*(i+1)/n}"></path>`; }
    let shells='';
    for (let i=0;i<split;i++) { const x=430+i*70; shells += `<path d="M${x} ${baseY} C${x+35} ${60+i*18}, ${x+80} ${60+i*18}, ${x+120} ${baseY}" fill="none" stroke="${i===0?'#174ea6':i===1?'#6d28d9':'#f97316'}" stroke-width="6" stroke-linecap="round"></path>`; }
    const body=`<rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="#fbfdff"></rect><text x="28" y="32" class="axis-label">primitive ingredients</text>${curves}<text x="350" y="145" font-size="42" fill="#667085">→</text><text x="430" y="32" class="axis-label">split-valence contracted shells</text>${shells}`;
    if ($('contractionPlot')) $('contractionPlot').innerHTML=svgWrap(W,H,body,'Contraction forge plot');
    const score = Math.round(40 + split*12 + n*4 - tight*10);
    if ($('forgeReadout')) $('forgeReadout').innerHTML = `<strong>Forge score:</strong> ${score}/100. ${n} primitives reduce integral pain through contraction; ${split} split-valence shell(s) give radial freedom. Tightness ${tight.toFixed(2)} means ${tight>0.7?'compact but less flexible':'more flexible but potentially costlier'}.`;
  }

  function updateOverlapDungeon() {
    const ov=Number($('overlapStrength')?.value||0.35), crowd=Number($('diffuseCrowding')?.value||0.2);
    const N=7,W=420,H=420,pad=42,cell=(W-2*pad)/N; let cells=''; let maxOff=0;
    for (let i=0;i<N;i++) for (let j=0;j<N;j++) { const dist=Math.abs(i-j); const val=i===j?1: Math.pow(ov,dist)*(1+crowd*(i>3&&j>3?1.8:0)); const v=clamp(val,0,1); maxOff=Math.max(maxOff, i===j?0:v); const col=`rgba(${Math.round(23+200*v)}, ${Math.round(78+60*(1-v))}, ${Math.round(166*(1-v)+40)}, ${0.25+0.7*v})`; cells += `<rect x="${pad+j*cell}" y="${pad+i*cell}" width="${cell-2}" height="${cell-2}" fill="${col}" rx="5"></rect>`; }
    const danger=clamp((maxOff-0.72)/0.28,0,1); const minEig=Math.pow(10,-(1+5*danger));
    const body=`<rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="#fbfdff"></rect><text x="24" y="28" class="axis-label">overlap matrix S heatmap</text>${cells}<text x="${pad}" y="${H-15}" class="axis-label">bright off-diagonal = basis functions too similar</text>`;
    if ($('overlapHeatmap')) $('overlapHeatmap').innerHTML=svgWrap(W,H,body,'Overlap matrix heatmap');
    if ($('conditionReadout')) $('conditionReadout').innerHTML = `<strong>Condition alarm:</strong> max off-diagonal ≈ ${maxOff.toFixed(2)}, estimated smallest S eigenvalue ≈ ${minEig.toExponential(1)}. ${danger>0.65?'Danger zone: remove redundant diffuse functions or tighten thresholds.':danger>0.25?'Watch carefully: inspect SCF warnings and overlap eigenvalues.':'Healthy enough for a toy model.'}`;
  }

  function updateBasisRadar() {
    const z=Number($('zetaQuality')?.value||3), pol=$('hasPolarization')?.checked, diff=$('hasDiffuse')?.checked, core=$('hasCore')?.checked, aux=$('hasAux')?.checked;
    const scores=[
      ['geometry', clamp(25*z + (pol?15:0),0,100)],
      ['anion', clamp(12*z + (diff?55:0) + (pol?10:0),0,100)],
      ['Rydberg', clamp(10*z + (diff?60:0),0,100)],
      ['correlation', clamp(18*z + (pol?16:0) + (core?18:0),0,100)],
      ['weak bind', clamp(14*z + (diff?32:0) + (pol?18:0),0,100)],
      ['efficiency', clamp(105 - 17*z - (diff?14:0) - (core?10:0) + (aux?18:0),0,100)]
    ];
    const W=520,H=420,cx=W/2,cy=H/2+10,R=145; const pts=scores.map(([_,v],i)=>{ const a=-Math.PI/2+i*2*Math.PI/scores.length; return [cx+Math.cos(a)*R*v/100, cy+Math.sin(a)*R*v/100]; });
    const poly=pts.map(p=>p.map(x=>x.toFixed(1)).join(',')).join(' ');
    let axes=''; scores.forEach(([name,v],i)=>{ const a=-Math.PI/2+i*2*Math.PI/scores.length; const x=cx+Math.cos(a)*R, y=cy+Math.sin(a)*R; axes += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#e5e7eb"></line><text x="${cx+Math.cos(a)*(R+38)-32}" y="${cy+Math.sin(a)*(R+28)}" class="axis-label">${name} ${Math.round(v)}</text>`; });
    const rings=[.33,.66,1].map(f=>`<circle cx="${cx}" cy="${cy}" r="${R*f}" fill="none" stroke="#e5e7eb"></circle>`).join('');
    if ($('basisRadar')) $('basisRadar').innerHTML=svgWrap(W,H,`<rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="#fbfdff"></rect>${rings}${axes}<polygon points="${poly}" fill="#174ea6" fill-opacity=".26" stroke="#174ea6" stroke-width="4"></polygon>`,'Basis readiness radar');
    const weakest=scores.slice().sort((a,b)=>a[1]-b[1])[0];
    if ($('kitReadout')) $('kitReadout').innerHTML=`<strong>Kit diagnosis:</strong> weakest mission is ${weakest[0]} (${Math.round(weakest[1])}/100). ${!diff?'Add diffuse functions for tails. ':''}${!pol?'Add polarization for directional density. ':''}${aux?'Matched auxiliary basis helps fitting efficiency.':''}`;
  }

  function updateBsseDuel() {
    const R=Number($('dimerDistance')?.value||3.2), size=$('bsseBasis')?.value||'medium', cp=$('counterpoise')?.checked;
    const mag={small:2.8,medium:1.2,large:0.35}[size]; const bsse=mag*Math.exp(-(R-2.4)/1.9); const trueE=-3.2*Math.exp(-Math.pow((R-3.2)/1.0,2)); const observed=trueE-bsse; const corrected=cp?trueE:observed;
    const W=620,H=320,pad=42; const xs=[]; for(let i=0;i<=80;i++) xs.push(2.4+i*(4.6/80)); const min=-6,max=1; const x=r=>pad+(r-2.4)/4.6*(W-2*pad), y=e=>H-pad-(e-min)/(max-min)*(H-2*pad); const curve=(fn)=>xs.map((r,i)=>`${i?'L':'M'} ${x(r).toFixed(1)} ${y(fn(r)).toFixed(1)}`).join(' ');
    const trueFn=r=>-3.2*Math.exp(-Math.pow((r-3.2)/1.0,2)); const obsFn=r=>trueFn(r)-mag*Math.exp(-(r-2.4)/1.9);
    const body=`${axis(W,H,pad)}<path d="${curve(obsFn)}" fill="none" stroke="#f97316" stroke-width="4"></path><path d="${curve(trueFn)}" fill="none" stroke="#174ea6" stroke-width="4"></path><circle cx="${x(R)}" cy="${y(corrected)}" r="7" fill="#111827"></circle><text x="${pad+8}" y="28" class="axis-label">blue=true-ish, orange=BSSE-overbound, dot=current ${cp?'corrected':'observed'}</text>`;
    if ($('bssePlot')) $('bssePlot').innerHTML=svgWrap(W,H,body,'BSSE interaction energy plot');
    if ($('bsseReadout')) $('bsseReadout').innerHTML=`<strong>At R=${R.toFixed(1)} Å:</strong> estimated BSSE ${bsse.toFixed(2)} kcal/mol. Reported interaction = ${corrected.toFixed(2)} kcal/mol. ${cp?'Counterpoise is ON: borrowing is approximately removed.':'Counterpoise is OFF: small bases overbind.'}`;
  }

  function updateAlarm() {
    const shells=Number($('diffuseShells')?.value||2), spacing=Number($('exponentSpacing')?.value||2); const danger=clamp((shells/6)*(2.4/spacing),0,1); const minEig=Math.pow(10,-(2+6*danger));
    const W=520,H=230,cx=260,cy=190,R=145,ang=-Math.PI+danger*Math.PI; const x=cx+Math.cos(ang)*R,y=cy+Math.sin(ang)*R; const col=danger>.66?'#b42318':danger>.35?'#f97316':'#047857';
    const body=`<rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="#fbfdff"></rect><path d="M${cx-R} ${cy} A${R} ${R} 0 0 1 ${cx+R} ${cy}" fill="none" stroke="#e5e7eb" stroke-width="24"></path><path d="M${cx-R} ${cy} A${R} ${R} 0 0 1 ${x} ${y}" fill="none" stroke="${col}" stroke-width="24" stroke-linecap="round"></path><circle cx="${x}" cy="${y}" r="12" fill="${col}"></circle><text x="${cx-75}" y="${cy-35}" font-size="24" font-weight="800" fill="${col}">risk ${(100*danger).toFixed(0)}%</text>`;
    if ($('alarmGauge')) $('alarmGauge').innerHTML=svgWrap(W,H,body,'Linear dependence risk gauge');
    if ($('alarmReadout')) $('alarmReadout').innerHTML=`<strong>Smallest-overlap warning:</strong> estimated min eigenvalue ≈ ${minEig.toExponential(1)}. ${danger>.66?'Severe: remove diffuse shells or increase exponent spacing.':danger>.35?'Moderate: monitor SCF/linear-dependence thresholds.':'Safe toy zone.'}`;
  }

  function updateCbs() {
    const eCBS=Number($('cbsOffset')?.value||-0.82), hard=Number($('cbsHardness')?.value||1.1), xmax=Number($('cardinalMax')?.value||4); const Xs=[2,3,4,5].filter(x=>x<=xmax); const data=Xs.map(X=>[X,eCBS+hard/Math.pow(X,3)]);
    const W=620,H=320,pad=45; const min=eCBS-0.08,max=eCBS+hard/8+0.06; const x=X=>pad+(X-2)/3*(W-2*pad), y=E=>H-pad-(E-min)/(max-min)*(H-2*pad); const pts=data.map(([X,E])=>`${x(X)},${y(E)}`).join(' ');
    const fit=data.length>=2? data.slice(-2):data; let est=eCBS+hard/125; if(fit.length===2){ const [[x1,e1],[x2,e2]]=fit; const A=(e1-e2)/(1/Math.pow(x1,3)-1/Math.pow(x2,3)); est=e2-A/Math.pow(x2,3); }
    const body=`${axis(W,H,pad)}<line x1="${pad}" x2="${W-pad}" y1="${y(eCBS)}" y2="${y(eCBS)}" stroke="#047857" stroke-width="3" stroke-dasharray="7 6"></line><polyline points="${pts}" fill="none" stroke="#174ea6" stroke-width="4"></polyline>${data.map(([X,E])=>`<circle cx="${x(X)}" cy="${y(E)}" r="7" fill="#174ea6"></circle><text x="${x(X)-8}" y="${H-16}" class="axis-label">${X===2?'D':X===3?'T':X===4?'Q':'5'}</text>`).join('')}<text x="${pad+8}" y="28" class="axis-label">dashed green = true CBS toy target</text>`;
    if ($('cbsPlot')) $('cbsPlot').innerHTML=svgWrap(W,H,body,'CBS extrapolation plot');
    if ($('cbsReadout')) $('cbsReadout').innerHTML=`<strong>Extrapolated CBS:</strong> ${est.toFixed(4)} relative units using ${data.length} point(s). True toy target is ${eCBS.toFixed(4)}; residual ${(est-eCBS).toFixed(4)}. More cardinal points make the extrapolation less magical.`;
  }

  function updateCost() {
    const K=Number($('basisCount')?.value||180), p=Number($('methodScaling')?.value||3); const rel=Math.pow(K/100,p); const W=620,H=300,pad=45; const ks=[50,100,200,400,800]; const max=Math.pow(800/100,p); const x=(i)=>pad+i*(W-2*pad)/(ks.length-1), y=v=>H-pad-(v/max)*(H-2*pad); const bars=ks.map((k,i)=>{ const v=Math.pow(k/100,p); return `<rect x="${x(i)-22}" y="${y(v)}" width="44" height="${H-pad-y(v)}" rx="6" fill="${k<=K?'#174ea6':'#bfdbfe'}"></rect><text x="${x(i)-18}" y="${H-16}" class="axis-label">${k}</text>`; }).join('');
    if ($('costPlot')) $('costPlot').innerHTML=svgWrap(W,H,`${axis(W,H,pad)}${bars}<text x="${pad+8}" y="28" class="axis-label">relative cost vs basis functions K, scaling K^${p}</text>`,'Cost scaling plot');
    if ($('costReadout')) $('costReadout').innerHTML=`<strong>Cost boss:</strong> K=${K}, scaling K^${p}, relative cost vs K=100 is ${rel.toFixed(1)}×. Doubling K multiplies cost by ${Math.pow(2,p).toFixed(0)}×.`;
  }

  const advice = {
    'neutral-dft': { minimal:['Low','Too cramped for reliable bonding. Use at least polarized double-ζ.'], svp:['Good starter','Reasonable for quick DFT geometries; confirm energies with triple-ζ.'], tzvp:['Strong','A balanced routine choice for geometry and many trends.'], 'aug-tz':['Overkill but safe','Diffuse functions may be unnecessary unless tails/response matter.'], 'qz-extrap':['Benchmark','More than needed for routine geometry, useful for reference data.'] },
    anion: { minimal:['Fail','No diffuse tail: the extra electron is artificially confined.'], svp:['Risky','Still usually lacks diffuse functions.'], tzvp:['Incomplete','Triple-ζ helps but diffuse functions are the key missing ingredient.'], 'aug-tz':['Good','Augmentation gives the density a physical tail.'], 'qz-extrap':['Excellent','Use augmented cardinal sets and check convergence.'] },
    rydberg: { minimal:['Fail','Rydberg orbitals require very diffuse functions.'], svp:['Fail','Valence-only functions cannot represent the extended excited electron.'], tzvp:['Risky','Angular/radial flexibility helps but missing diffuse shells dominate.'], 'aug-tz':['Good','Diffuse functions are mandatory; sometimes doubly augmented sets are needed.'], 'qz-extrap':['Excellent','Use augmented systematic sets and inspect orbital extent.'] },
    noncovalent: { minimal:['Fail','BSSE and missing polarization dominate.'], svp:['Screening only','Use counterpoise if comparing dimers; triple-ζ is safer.'], tzvp:['Good','Often reasonable with dispersion correction and BSSE checks.'], 'aug-tz':['Strong','Diffuse functions improve long-range density and weak binding.'], 'qz-extrap':['Benchmark','Best for high-quality interaction energies.'] },
    correlated: { minimal:['Fail','Correlation energy converges slowly with angular momentum.'], svp:['Insufficient','Not systematic enough for benchmark correlation.'], tzvp:['Useful','Good single-point tier but not a final CBS answer.'], 'aug-tz':['Strong','Use cc-pVXZ/aug-cc-pVXZ ladders and extrapolate.'], 'qz-extrap':['Excellent','Systematic cardinal extrapolation is the right strategy.'] },
    'transition-metal': { minimal:['Fail','d-shell energetics require polarization, balanced valence, and often relativistic/ECP treatment.'], svp:['Screening only','May work for rough structures but spin gaps are fragile.'], tzvp:['Good start','Use def2-TZVP/QZVP or specialized sets, inspect semicore/ECP choices.'], 'aug-tz':['Case-dependent','Diffuse is less central than balanced d/semi-core/relativistic treatment unless charged.'], 'qz-extrap':['High-level','Use matched ECP/relativistic Hamiltonian and check spin-state convergence.'] }
  };
  function updateGame() { const s=$('scenarioSelect')?.value||'neutral-dft', c=$('basisChoice')?.value||'svp'; const [rank,text]=advice[s][c]; if($('basisGameResult')) $('basisGameResult').innerHTML=`<strong>${rank}</strong><p>${text}</p>`; }

  function init() {
    document.querySelectorAll('.lesson-nav button').forEach(btn => btn.addEventListener('click', () => setStep(btn.dataset.step)));
    document.querySelectorAll('.quest-complete').forEach(btn => { btn.dataset.originalText = btn.textContent; btn.addEventListener('click', () => completeMission(btn)); });
    $('resetBasisQuest')?.addEventListener('click', () => { localStorage.removeItem(STORAGE_KEY); renderBadges(); });
    ['alpha1','alpha2','coef2','angularL'].forEach(id => $(id)?.addEventListener('input', updateGaussianLab));
    ['aoShape','aoOrientation','aoAmplitude'].forEach(id => $(id)?.addEventListener('input', updateAoShape));
    ['primitiveCount','splitValence','contractTightness'].forEach(id => $(id)?.addEventListener('input', updateContractionForge));
    ['overlapStrength','diffuseCrowding'].forEach(id => $(id)?.addEventListener('input', updateOverlapDungeon));
    ['zetaQuality','hasPolarization','hasDiffuse','hasCore','hasAux'].forEach(id => $(id)?.addEventListener('input', updateBasisRadar));
    ['dimerDistance','bsseBasis','counterpoise'].forEach(id => $(id)?.addEventListener('input', updateBsseDuel));
    ['diffuseShells','exponentSpacing'].forEach(id => $(id)?.addEventListener('input', updateAlarm));
    ['cbsOffset','cbsHardness','cardinalMax'].forEach(id => $(id)?.addEventListener('input', updateCbs));
    ['basisCount','methodScaling'].forEach(id => $(id)?.addEventListener('input', updateCost));
    ['scenarioSelect','basisChoice'].forEach(id => $(id)?.addEventListener('input', updateGame));
    [updateGaussianLab, updateAoShape, updateContractionForge, updateOverlapDungeon, updateBasisRadar, updateBsseDuel, updateAlarm, updateCbs, updateCost, updateGame, renderBadges].forEach(fn => fn());
    document.querySelector('.lesson-nav button[data-step="1"]')?.classList.add('active');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
