#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

if (typeof globalThis.WebSocket !== 'function') {
  if (process.env.PROJECT_XC_WEBSOCKET_REEXEC === '1') throw new Error('Node must provide the built-in WebSocket client');
  const rerun = spawnSync(process.execPath, ['--experimental-websocket', __filename, ...process.argv.slice(2)], {
    stdio: 'inherit', env: { ...process.env, PROJECT_XC_WEBSOCKET_REEXEC: '1' }
  });
  if (rerun.error) throw rerun.error;
  process.exit(rerun.status ?? 1);
}

const root = path.resolve(__dirname, '..');
let checks = 0;
function assert(condition, message) {
  checks += 1;
  if (!condition) throw new Error(message);
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'
  ].filter(Boolean);
  for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
  for (const command of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const found = spawnSync('which', [command], { encoding: 'utf8' });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required for Hartree-Fock and SCF interaction regressions');
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function contentType(filePath) {
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(filePath)] || 'application/octet-stream';
}

function startServer() {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const relative = pathname === '/' ? '/site/qc-hartree-fock.html' : pathname;
    const filePath = path.resolve(root, `.${relative}`);
    if (!filePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(404).end('not found');
      return;
    }
    response.writeHead(200, { 'content-type': contentType(filePath), 'cache-control': 'no-store' });
    fs.createReadStream(filePath).pipe(response);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
    });
    request.once('error', reject);
    request.setTimeout(1000, () => request.destroy(new Error('request timeout')));
  });
}

async function waitForTargets(debugPort, browser) {
  let lastError;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (browser.exitCode !== null) throw new Error(`Chrome exited early with ${browser.exitCode}`);
    try {
      const targets = await getJson(`http://127.0.0.1:${debugPort}/json/list`);
      const page = targets.find(target => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch (error) { lastError = error; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Chrome DevTools endpoint did not become ready: ${lastError?.message || 'no page target'}`);
}

function connectCdp(webSocketDebuggerUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketDebuggerUrl);
    socket.onerror = reject;
    socket.onopen = () => {
      let id = 0;
      const pending = new Map();
      const events = [];
      socket.onmessage = event => {
        const message = JSON.parse(event.data);
        if (!message.id) { events.push(message); return; }
        if (!pending.has(message.id)) return;
        const operation = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) operation.reject(new Error(JSON.stringify(message.error)));
        else operation.resolve(message.result);
      };
      const call = (method, params = {}) => new Promise((resolveCall, rejectCall) => {
        const callId = ++id;
        pending.set(callId, { resolve: resolveCall, reject: rejectCall });
        socket.send(JSON.stringify({ id: callId, method, params }));
      });
      const evaluate = async expression => {
        const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
        return result.result.value;
      };
      resolve({ socket, call, evaluate, events });
    };
  });
}

async function waitForInitialization(cdp, mobile = false) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const initialized = await cdp.evaluate("document.readyState === 'complete' && !!window.QCHartreeFockModels && document.querySelectorAll('.hf-plot svg').length === 11 && !!document.querySelector('#hfBossAudit')");
    if (initialized) return true;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Hartree-Fock and SCF page did not initialize${mobile ? ' at mobile size' : ''}`);
}

async function main() {
  const chrome = findChrome();
  const server = await startServer();
  const serverPort = server.address().port;
  const debugPort = await availablePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-verify-hf-interactions-'));
  let stderr = '';
  const browser = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', `--remote-debugging-port=${debugPort}`, '--remote-debugging-address=127.0.0.1',
    '--window-size=1440,1000', `--user-data-dir=${profile}`, 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  browser.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-8000); });

  let cdp;
  try {
    const target = await waitForTargets(debugPort, browser);
    cdp = await connectCdp(target.webSocketDebuggerUrl);
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
    await cdp.call('Log.enable');
    await cdp.call('Network.enable');
    await cdp.call('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.call('Network.setBlockedURLs', { urls: ['https://cdn.jsdelivr.net/*'] });
    await cdp.call('Page.navigate', { url: `http://127.0.0.1:${serverPort}/site/qc-hartree-fock.html?test=interaction-contracts` });
    await waitForInitialization(cdp);

    const structure = await cdp.evaluate(`(() => {
      const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
      const duplicated = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
      const controls = [...document.querySelectorAll('input, select, button')];
      const accessibleName = node => {
        if (node.getAttribute('aria-label')) return node.getAttribute('aria-label').trim();
        const labelled = node.getAttribute('aria-labelledby');
        if (labelled) return labelled.split(/\\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim();
        if (node.id) {
          const explicit = document.querySelector('label[for="' + CSS.escape(node.id) + '"]');
          if (explicit) return explicit.textContent.trim();
          const wrapping = node.closest('label');
          if (wrapping) return wrapping.textContent.trim();
        }
        return (node.textContent || node.value || node.title || '').trim();
      };
      const plots = [...document.querySelectorAll('.academy-plot-canvas')].map(plot => {
        const described = (plot.getAttribute('aria-describedby') || '').trim().split(/\\s+/).filter(Boolean);
        const svg = plot.querySelector('svg');
        return {
          id: plot.id, role: plot.getAttribute('role'), tabIndex: plot.tabIndex, aria: plot.getAttribute('aria-label'), described,
          allDescriptionsExist: described.every(id => !!document.getElementById(id)), svgLabel: svg?.getAttribute('aria-label') || '',
          badMarkup: /NaN|Infinity|undefined/.test(svg?.outerHTML || '')
        };
      });
      return {
        levels: document.querySelectorAll('.academy-lesson').length,
        games: document.querySelectorAll('.lab-grid').length,
        missions: document.querySelectorAll('.academy-complete[data-mission]').length,
        plots, keys: document.querySelectorAll('.academy-plot-key').length, duplicated,
        unnamedControls: controls.filter(node => !accessibleName(node)).map(node => node.id || node.outerHTML.slice(0, 60)),
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    })()`);
    assert(structure.levels === 12 && structure.games === 12 && structure.missions === 12, `12-level/12-game/12-mission contract failed: ${JSON.stringify(structure)}`);
    assert(structure.plots.length === 11 && structure.keys === 11, `11-plot/key contract failed: ${JSON.stringify(structure)}`);
    assert(structure.duplicated.length === 0, `page must not contain duplicate ids: ${structure.duplicated.join(', ')}`);
    assert(structure.unnamedControls.length === 0, `every control needs an accessible name: ${structure.unnamedControls.join(', ')}`);
    assert(structure.plots.every(plot => plot.role === 'region' && plot.tabIndex === 0 && plot.aria && plot.described.length >= 2 && plot.allDescriptionsExist && plot.svgLabel && !plot.badMarkup), `plot accessibility/finite-markup contract failed: ${JSON.stringify(structure.plots)}`);
    assert(structure.documentOverflow <= 1, `desktop page must not overflow horizontally: ${structure.documentOverflow}`);

    const oracleIds = ['variationOracleKey','coulombOracleKey','fockOracleKey','roothaanOracleKey','densityOracleKey','stationarityOracleKey','fixedOracleKey','pathologyOracleKey','stabilizationOracleKey','diisOracleKey','referenceOracleKey'];
    const publicModelAllowlist = ['symmetricEigen2','generalizedEigen2','densityProjector','auditDensity','coulombExchange','antisymmetrizedIntegralResidual','buildFock','hfEnergy','commutatorResidual','rotationSlice','classifyStationarity','twoLevelScfOutput','iterateTwoLevelScf','classifyScfLog','dampValue','levelShiftFock','diisCoefficients','diisMix','uhfSpinS2'].sort();
    const initial = await cdp.evaluate(`(() => ({
      disabled: [...document.querySelectorAll('.academy-complete[data-game-gate]')].filter(button => button.disabled).length,
      lockedLabels: [...document.querySelectorAll('.academy-complete[data-game-gate]')].filter(button => button.textContent.startsWith('Locked seal')).length,
      progress: document.getElementById('chapterProgressText').textContent,
      notebook: document.querySelectorAll('#hfNotebookList article').length,
      storage: localStorage.getItem('project-xc-hartree-fock-games-v1'),
      publicModelKeys: Object.keys(window.QCHartreeFockModels || {}),
      publicModelSource: Object.entries(window.QCHartreeFockModels || {}).map(entry => entry[0]+'\\n'+String(entry[1])).join('\\n'),
      visibleOracleKeys: ${JSON.stringify(oracleIds)}.filter(id => { const node=document.getElementById(id); return node && node.getClientRects().length > 0; }),
      bossLocked: document.getElementById('hfBossReference').disabled && document.getElementById('hfBossAudit').disabled,
      stabilizationPrecommit: (() => {
        const select=document.getElementById('stabilizationCase');
        const records=['stabilize-a','stabilize-b','stabilize-c'].map(id=>{select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));const svg=document.querySelector('#stabilizationPlot svg');return {id,curves:svg.querySelectorAll('.hf-curve').length,interventionBars:svg.querySelectorAll('rect[stroke="#92400e"],rect[stroke="#4338ca"]').length,answerText:/old-w|orthonormal gap|temporary shift|gates pass/.test(svg.textContent)};});
        select.value='stabilize-a';select.dispatchEvent(new Event('change',{bubbles:true}));return records;
      })(),
      referenceConstraints: (() => {
        const select=document.getElementById('referenceCase');
        const records=['reference-a','reference-b','reference-c'].map(id=>{select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));return {id,text:document.getElementById('referenceConstraint').textContent};});
        select.value='reference-a';select.dispatchEvent(new Event('change',{bubbles:true}));return records;
      })()
    }))()`);
    assert(initial.disabled === 12 && initial.lockedLabels === 12, 'all twelve mission seals must start visibly and functionally locked');
    assert(initial.progress.includes('0 / 12') && initial.notebook === 0 && initial.storage === null && initial.bossLocked, `fresh chapter state failed: ${JSON.stringify(initial)}`);
    assert(JSON.stringify(initial.publicModelKeys.sort()) === JSON.stringify(publicModelAllowlist) && !/HF_CASE_FILES|REFERENCE_DOSSIERS|evaluateHfCase|answerKey|bossRoutes|expectedAnswer/.test(initial.publicModelSource), `public finite-model API must match the answer-free allowlist: ${JSON.stringify(initial.publicModelKeys)}`);
    const shippedScriptAudit = await cdp.evaluate(`fetch('assets/qc-hartree-fock.js').then(response => response.text()).then(text => ({ leaked: /\\b(?:EXPECTED|ANSWER_MAP|BOSS_ROUTES)\\b|\\bexpected\\s*:|\\broute\\s*:|\\bevidenceClass\\s*:/.test(text), bytes: text.length }))`);
    assert(!shippedScriptAudit.leaked && shippedScriptAudit.bytes > 20000, `shipped source must derive grading from displayed algebra rather than static answer maps: ${JSON.stringify(shippedScriptAudit)}`);
    assert(initial.visibleOracleKeys.length === 0, `decisive oracle keys must stay hidden before commitment: ${initial.visibleOracleKeys.join(', ')}`);
    assert(initial.stabilizationPrecommit.every(record => record.curves === 1 && record.interventionBars === 0 && !record.answerText), `all unrevealed stabilization dossiers must share an answer-free raw-history structure: ${JSON.stringify(initial.stabilizationPrecommit)}`);
    assert(initial.referenceConstraints.length === 3 && /paired closed shell.*common spatial orbitals.*spin purity/i.test(initial.referenceConstraints[0].text) && /spin-pure open shell.*common closed-shell spatial orbitals/i.test(initial.referenceConstraints[1].text) && /alpha\/beta orbital relaxation.*broken-symmetry/i.test(initial.referenceConstraints[2].text), `reference constraints must be explicit before grading: ${JSON.stringify(initial.referenceConstraints)}`);

    // Wrong-shaped evidence and an impossible stage-3 boss entry cannot invent mastery.
    await cdp.evaluate(`localStorage.setItem('project-xc-hartree-fock-games-v1', JSON.stringify({version:2,variation:[{id:'variation-a',choice:'local-minimum-slice',fingerprint:'forged'}],coulomb:7,fock:null,roothaan:false,density:'bad',stationarity:[],fixed:[],pathology:[],stabilization:[],diis:[],reference:[],boss:{cleared:[],stage:{'hf-boss-a':3},budget:{'hf-boss-a':2},answers:{'hf-boss-a':['rhf-reference','density-residual','energy-density-residual']},fingerprints:{'hf-boss-a':'forged'}}}))`);
    await cdp.call('Page.reload', { ignoreCache: true });
    await waitForInitialization(cdp);
    const malformed = await cdp.evaluate(`(() => ({disabled:[...document.querySelectorAll('.academy-complete')].filter(button=>button.disabled).length,notebook:document.querySelectorAll('#hfNotebookList article').length,plots:document.querySelectorAll('.hf-plot svg').length,bossStage:document.getElementById('hfBossStage').textContent,bossArtifact:document.getElementById('hfBossArtifact').textContent,referenceDisabled:document.getElementById('hfBossReference').disabled}))()`);
    assert(malformed.disabled === 12 && malformed.notebook === 0 && malformed.plots === 11 && /Stage 1 \/ 3/.test(malformed.bossStage) && /Earn Levels/.test(malformed.bossArtifact) && malformed.referenceDisabled, `malformed storage must recover to clean locked state: ${JSON.stringify(malformed)}`);
    await cdp.evaluate(`localStorage.removeItem('project-xc-hartree-fock-games-v1')`);

    // Re-enabling or relabeling a locked seal cannot bypass the chapter evidence predicate.
    await cdp.evaluate(`(() => { const button=document.querySelector('[data-mission="hf-variational-manifold"]');button.disabled=false;button.dataset.gameGate='earned';button.click(); })()`);
    await new Promise(resolve => setTimeout(resolve, 50));
    const forgedSeal = await cdp.evaluate(`(() => { const button=document.querySelector('[data-mission="hf-variational-manifold"]');return {disabled:button.disabled,gate:button.dataset.gameGate,canonical:window.ProjectXCAcademy.completedMissions('qc-hartree-fock'),notebook:document.querySelectorAll('#hfNotebookList article').length}; })()`);
    assert(forgedSeal.disabled && forgedSeal.gate === 'locked' && forgedSeal.canonical.length === 0 && forgedSeal.notebook === 0, `manually re-enabled seal must be blocked before canonical write: ${JSON.stringify(forgedSeal)}`);

    // Canonical progress alone cannot forge chapter-local evidence.
    await cdp.evaluate(`window.ProjectXCAcademy.setMission('qc-hartree-fock','hf-variational-manifold',true)`);
    await new Promise(resolve => setTimeout(resolve, 50));
    const forgedLive = await cdp.evaluate(`(() => { const b=document.querySelector('[data-mission="hf-variational-manifold"]'); return {disabled:b.disabled,gate:b.dataset.gameGate,canonical:window.ProjectXCAcademy.completedMissions('qc-hartree-fock')}; })()`);
    assert(forgedLive.disabled && forgedLive.gate === 'locked' && !forgedLive.canonical.includes('hf-variational-manifold'), `live canonical forgery must be rejected immediately: ${JSON.stringify(forgedLive)}`);
    await cdp.call('Page.reload', { ignoreCache: true });
    await waitForInitialization(cdp);
    const forgedReload = await cdp.evaluate(`(() => { const b=document.querySelector('[data-mission="hf-variational-manifold"]'); return {disabled:b.disabled,notebook:document.querySelectorAll('#hfNotebookList article').length,canonical:window.ProjectXCAcademy.completedMissions('qc-hartree-fock')}; })()`);
    assert(forgedReload.disabled && forgedReload.notebook === 0 && !forgedReload.canonical.includes('hf-variational-manifold'), `persisted canonical forgery must be rejected: ${JSON.stringify(forgedReload)}`);

    // Storage denial leaves finite models and controls usable.
    const storageBlock = await cdp.call('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('storage blocked for test', 'SecurityError'); } });` });
    await cdp.call('Page.reload', { ignoreCache: true });
    await waitForInitialization(cdp);
    const blocked = await cdp.evaluate(`(() => ({disabled:[...document.querySelectorAll('.academy-complete')].filter(b=>b.disabled).length,plots:document.querySelectorAll('.hf-plot svg').length,progress:document.getElementById('chapterProgressText').textContent}))()`);
    assert(blocked.disabled === 12 && blocked.plots === 11 && blocked.progress.includes('0 / 12'), `blocked storage recovery failed: ${JSON.stringify(blocked)}`);
    await cdp.call('Page.removeScriptToEvaluateOnNewDocument', { identifier: storageBlock.identifier });
    await cdp.call('Page.reload', { ignoreCache: true });
    await waitForInitialization(cdp);

    const depthRun = await cdp.evaluate(`(() => {
      const set=(id,value)=>{const node=document.getElementById(id);node.value=String(value);node.dispatchEvent(new Event('change',{bubbles:true}));};
      const record=mission=>{const button=document.querySelector('[data-mission="'+mission+'"]');const unlocked=!button.disabled;button.focus();button.click();return {mission,unlocked,focused:document.activeElement===button};};
      const result={records:[]};
      const run=(caseControl,decisionControl,auditControl,cases,mission)=>{for(const [caseId,answer] of Object.entries(cases)){set(caseControl,caseId);set(decisionControl,answer);document.getElementById(auditControl).click();}result.records.push(record(mission));};

      set('variationDecision','local-maximum-slice');document.getElementById('variationAudit').click();
      result.wrongVariation={unlocked:!document.querySelector('[data-mission="hf-variational-manifold"]').disabled,text:document.getElementById('variationReadout').textContent,oracle:getComputedStyle(document.getElementById('variationOracleKey')).display};
      run('variationCase','variationDecision','variationAudit',{'variation-a':'local-minimum-slice','variation-b':'local-maximum-slice','variation-c':'not-stationary'},'hf-variational-manifold');
      run('coulombCase','coulombDecision','coulombAudit',{'coulomb-a':'same-spin-j-minus-k','coulomb-b':'opposite-spin-j-only','coulomb-c':'self-cancelled'},'coulomb-exchange');
      result.fockVisuals=[];
      for(const [caseId,answer] of Object.entries({'fock-a':'hermitian-density-dependent','fock-b':'reject-nonhermitian-build'})){set('fockCase',caseId);set('fockDecision',answer);document.getElementById('fockAudit').click();const svg=document.querySelector('#fockPlot svg');result.fockVisuals.push({caseId,titles:svg.querySelectorAll('.hf-plot-title').length,masked:svg.textContent.includes('?'),text:svg.textContent});}
      result.records.push(record('fock-assembly'));
      result.roothaanVisuals=[];
      for(const [caseId,answer] of Object.entries({'roothaan-a':'solve-generalized','roothaan-b':'reject-overlap-metric'})){set('roothaanCase',caseId);set('roothaanDecision',answer);document.getElementById('roothaanAudit').click();const svg=document.querySelector('#roothaanPlot svg');result.roothaanVisuals.push({caseId,text:svg.textContent});}
      result.records.push(record('roothaan-hall'));
      run('densityCase','densityDecision','densityAudit',{'density-a':'projector-closed','density-b':'not-a-determinant-projector'},'density-projector');
      run('stationarityCase','stationarityDecision','stationarityAudit',{'stationarity-a':'stationary-slice','stationarity-b':'occupied-virtual-gradient','stationarity-c':'unstable-stationary-slice'},'orbital-stationarity');
      run('fixedCase','fixedDecision','fixedAudit',{'fixed-a':'self-consistent-fixed-point','fixed-b':'not-self-consistent'},'scf-fixed-point');
      run('pathologyCase','pathologyDecision','pathologyAudit',{'pathology-a':'converged','pathology-b':'false-plateau','pathology-c':'oscillatory','pathology-d':'divergent'},'scf-pathology');
      result.stabilizationVisuals=[];
      for(const [caseId,answer] of Object.entries({'stabilize-a':'density-damping','stabilize-b':'virtual-level-shift','stabilize-c':'no-intervention'})){set('stabilizationCase',caseId);set('stabilizationDecision',answer);document.getElementById('stabilizationAudit').click();const svg=document.querySelector('#stabilizationPlot svg');result.stabilizationVisuals.push({caseId,curves:svg.querySelectorAll('.hf-curve').length,bars:svg.querySelectorAll('rect[stroke="#92400e"],rect[stroke="#4338ca"]').length,text:svg.textContent});}
      result.records.push(record('scf-stabilization'));
      run('diisCase','diisDecision','diisAudit',{'diis-a':'usable-residual-subspace','diis-b':'singular-residual-history'},'diis');
      run('referenceCase','referenceDecision','referenceAudit',{'reference-a':'rhf-reference','reference-b':'rohf-reference','reference-c':'uhf-reference'},'reference-spin');

      // Four misses exhaust and reset only the active dossier.
      set('hfBossReference','rohf-reference');for(let i=0;i<4;i+=1)document.getElementById('hfBossAudit').click();
      result.bossRecovery={stage:document.getElementById('hfBossStage').textContent,budget:document.getElementById('hfBossBudget').textContent,reference:document.getElementById('hfBossReference').value,diagnosticDisabled:document.getElementById('hfBossDiagnostic').disabled,feedback:document.getElementById('hfBossFeedback').textContent};

      // Two accepted stages become immutable and survive case switching.
      set('hfBossReference','rhf-reference');document.getElementById('hfBossAudit').click();
      set('hfBossDiagnostic','density-residual');document.getElementById('hfBossAudit').click();
      result.bossCommitLock={reference:document.getElementById('hfBossReference').value,referenceDisabled:document.getElementById('hfBossReference').disabled,diagnostic:document.getElementById('hfBossDiagnostic').value,diagnosticDisabled:document.getElementById('hfBossDiagnostic').disabled,evidenceDisabled:document.getElementById('hfBossEvidence').disabled};
      set('hfBossCase','hf-boss-b');set('hfBossCase','hf-boss-a');
      result.bossCommitRestore={reference:document.getElementById('hfBossReference').value,referenceDisabled:document.getElementById('hfBossReference').disabled,diagnostic:document.getElementById('hfBossDiagnostic').value,diagnosticDisabled:document.getElementById('hfBossDiagnostic').disabled,evidenceDisabled:document.getElementById('hfBossEvidence').disabled,feedback:document.getElementById('hfBossFeedback').textContent};
      document.getElementById('hfResetBossCase').click();

      const boss={
        'hf-boss-a':['rhf-reference','density-residual','energy-density-residual'],
        'hf-boss-b':['uhf-reference','spin-contamination','s2-and-stability-scan'],
        'hf-boss-c':['rohf-reference','two-cycle','residual-history-and-intervention-scan']
      };
      for(const [caseId,route] of Object.entries(boss)){set('hfBossCase',caseId);set('hfBossReference',route[0]);document.getElementById('hfBossAudit').click();set('hfBossDiagnostic',route[1]);document.getElementById('hfBossAudit').click();set('hfBossEvidence',route[2]);document.getElementById('hfBossAudit').click();}
      result.boss={score:document.getElementById('hfBossScore').textContent,unlocked:!document.querySelector('[data-mission="hf-case-file"]').disabled,artifact:document.getElementById('hfBossArtifact').textContent};
      result.records.push(record('hf-case-file'));
      result.final={progress:document.getElementById('chapterProgressText').textContent,notebook:document.querySelectorAll('#hfNotebookList article').length,stored:JSON.parse(localStorage.getItem('project-xc-hartree-fock-games-v1')),canonical:window.ProjectXCAcademy.completedMissions('qc-hartree-fock')};
      return result;
    })()`);

    assert(!depthRun.wrongVariation.unlocked && /Decision rejected/.test(depthRun.wrongVariation.text) && depthRun.wrongVariation.oracle !== 'none', `wrong commitment must reveal diagnostic without unlocking: ${JSON.stringify(depthRun.wrongVariation)}`);
    assert(depthRun.fockVisuals.length === 2 && depthRun.fockVisuals.every(item => item.titles === 4 && !item.masked) && /ERI symmetry=0\.0e\+0/.test(depthRun.fockVisuals[0].text) && !/ERI symmetry=0\.0e\+0/.test(depthRun.fockVisuals[1].text), `Fock dossiers must show four matrices and differentiated ERI certificates after commitment: ${JSON.stringify(depthRun.fockVisuals)}`);
    assert(/max \|\|Fc−εSc\|\|=.*CᵀSC−I/.test(depthRun.roothaanVisuals[0].text) && /Rejected: overlap metric is singular or non-positive/.test(depthRun.roothaanVisuals[1].text), `Roothaan dossiers must expose equation and metric certificates: ${JSON.stringify(depthRun.roothaanVisuals)}`);
    assert(depthRun.stabilizationVisuals[0].curves === 2 && depthRun.stabilizationVisuals[0].bars === 0 && /old-w/.test(depthRun.stabilizationVisuals[0].text) && depthRun.stabilizationVisuals[1].curves === 1 && depthRun.stabilizationVisuals[1].bars === 2 && /orthonormal gap/.test(depthRun.stabilizationVisuals[1].text) && depthRun.stabilizationVisuals[2].curves === 1 && depthRun.stabilizationVisuals[2].bars === 0 && /gates pass/.test(depthRun.stabilizationVisuals[2].text), `stabilization plots must expose only intervention-specific finite evidence: ${JSON.stringify(depthRun.stabilizationVisuals)}`);
    assert(depthRun.records.every(item => item.unlocked && item.focused), `every earned seal must unlock and remain keyboard-focused: ${JSON.stringify(depthRun.records)}`);
    assert(/Stage 1 \/ 3/.test(depthRun.bossRecovery.stage) && /4 attempts/.test(depthRun.bossRecovery.budget) && depthRun.bossRecovery.reference === '' && depthRun.bossRecovery.diagnosticDisabled && /dossier reset/.test(depthRun.bossRecovery.feedback), `boss exhaustion must reset deterministically: ${JSON.stringify(depthRun.bossRecovery)}`);
    assert(depthRun.bossCommitLock.reference === 'rhf-reference' && depthRun.bossCommitLock.referenceDisabled && depthRun.bossCommitLock.diagnostic === 'density-residual' && depthRun.bossCommitLock.diagnosticDisabled && !depthRun.bossCommitLock.evidenceDisabled, `accepted boss stages must be immutable: ${JSON.stringify(depthRun.bossCommitLock)}`);
    assert(depthRun.bossCommitRestore.reference === 'rhf-reference' && depthRun.bossCommitRestore.referenceDisabled && depthRun.bossCommitRestore.diagnostic === 'density-residual' && depthRun.bossCommitRestore.diagnosticDisabled && !depthRun.bossCommitRestore.evidenceDisabled && /Stage 3/.test(depthRun.bossCommitRestore.feedback), `partial boss stage must restore after case switching: ${JSON.stringify(depthRun.bossCommitRestore)}`);
    assert(depthRun.boss.unlocked && /3 \/ 3/.test(depthRun.boss.score) && /finite-basis\/stability\/correlation caveat/.test(depthRun.boss.artifact), `three-stage boss contract failed: ${JSON.stringify(depthRun.boss)}`);
    assert(depthRun.final.progress.includes('12 / 12') && depthRun.final.notebook === 12 && depthRun.final.canonical.length === 12, `full earned chapter progress failed: ${JSON.stringify(depthRun.final)}`);
    assert(depthRun.final.stored.variation.length === 3 && depthRun.final.stored.pathology.length === 4 && depthRun.final.stored.boss.cleared.length === 3, 'versioned game evidence must retain every multi-case predicate');

    await cdp.call('Page.reload', { ignoreCache: true });
    await waitForInitialization(cdp);
    const persisted = await cdp.evaluate(`(() => ({progress:document.getElementById('chapterProgressText').textContent,notebook:document.querySelectorAll('#hfNotebookList article').length,earned:[...document.querySelectorAll('.academy-complete')].filter(button=>button.dataset.gameGate==='earned').length,boss:document.getElementById('hfBossScore').textContent}))()`);
    assert(persisted.progress.includes('12 / 12') && persisted.notebook === 12 && persisted.earned === 12 && /3 \/ 3/.test(persisted.boss), `reload persistence failed: ${JSON.stringify(persisted)}`);

    // Corrupting an uncleared boss to stage 3 must normalize it and revoke the boss seal.
    await cdp.evaluate(`(() => { const state=JSON.parse(localStorage.getItem('project-xc-hartree-fock-games-v1'));state.boss.cleared=[];state.boss.stage={'hf-boss-a':3};state.boss.answers={'hf-boss-a':['rhf-reference','density-residual','energy-density-residual']};localStorage.setItem('project-xc-hartree-fock-games-v1',JSON.stringify(state)); })()`);
    await cdp.call('Page.reload', { ignoreCache: true });
    await waitForInitialization(cdp);
    const inconsistentBoss = await cdp.evaluate(`(() => {document.getElementById('hfBossCase').value='hf-boss-a';document.getElementById('hfBossCase').dispatchEvent(new Event('change',{bubbles:true}));const seal=document.querySelector('[data-mission="hf-case-file"]');return {stage:document.getElementById('hfBossStage').textContent,reference:document.getElementById('hfBossReference').value,referenceDisabled:document.getElementById('hfBossReference').disabled,sealDisabled:seal.disabled,canonical:window.ProjectXCAcademy.completedMissions('qc-hartree-fock')};})()`);
    assert(/Stage 1 \/ 3/.test(inconsistentBoss.stage) && inconsistentBoss.reference === '' && !inconsistentBoss.referenceDisabled && inconsistentBoss.sealDisabled && !inconsistentBoss.canonical.includes('hf-case-file'), `inconsistent stage-3 persistence must normalize and revoke mastery: ${JSON.stringify(inconsistentBoss)}`);

    // Chapter reset preserves unrelated Academy and Basis evidence.
    const reset = await cdp.evaluate(`(() => {
      window.ProjectXCAcademy.setMission('qc-foundations','scale',true);
      localStorage.setItem('project-xc-basis-quest-badges-v2',JSON.stringify(['orbital-alphabet']));
      document.getElementById('resetChapterProgress').click();
      const defaults={variationCase:'variation-a',variationDecision:'',coulombCase:'coulomb-a',coulombDecision:'',fockCase:'fock-a',fockDecision:'',roothaanCase:'roothaan-a',roothaanDecision:'',densityCase:'density-a',densityDecision:'',stationarityCase:'stationarity-a',stationarityDecision:'',fixedCase:'fixed-a',fixedDecision:'',pathologyCase:'pathology-a',pathologyDecision:'',stabilizationCase:'stabilize-a',stabilizationDecision:'',diisCase:'diis-a',diisDecision:'',referenceCase:'reference-a',referenceDecision:'',hfBossCase:'hf-boss-a',hfBossReference:'',hfBossDiagnostic:'',hfBossEvidence:''};
      return {
        disabled:[...document.querySelectorAll('.academy-complete')].filter(button=>button.disabled).length,
        locked:[...document.querySelectorAll('.academy-complete')].filter(button=>button.textContent.startsWith('Locked seal')).length,
        progress:document.getElementById('chapterProgressText').textContent,notebook:document.querySelectorAll('#hfNotebookList article').length,
        gameStorage:localStorage.getItem('project-xc-hartree-fock-games-v1'),canonical:window.ProjectXCAcademy.completedMissions('qc-hartree-fock'),
        foundation:window.ProjectXCAcademy.completedMissions('qc-foundations'),basis:localStorage.getItem('project-xc-basis-quest-badges-v2'),
        visibleOracles:${JSON.stringify(oracleIds)}.filter(id=>{const node=document.getElementById(id);return node&&getComputedStyle(node).display!=='none';}),
        defaults:Object.fromEntries(Object.keys(defaults).map(id=>[id,document.getElementById(id).value])),expectedDefaults:defaults,
        successReadouts:[...document.querySelectorAll('.game-result[data-state="success"]')].map(node=>node.id),bossStage:document.getElementById('hfBossStage').textContent,bossReferenceDisabled:document.getElementById('hfBossReference').disabled
      };
    })()`);
    assert(reset.disabled === 12 && reset.locked === 12 && reset.progress.includes('0 / 12') && reset.notebook === 0, `reset must relock all twelve seals: ${JSON.stringify(reset)}`);
    assert(reset.gameStorage === null && reset.canonical.length === 0 && reset.foundation.includes('scale') && reset.basis.includes('orbital-alphabet'), `reset isolation failed: ${JSON.stringify(reset)}`);
    assert(reset.visibleOracles.length === 0 && reset.successReadouts.length === 0 && JSON.stringify(reset.defaults) === JSON.stringify(reset.expectedDefaults), `reset must restore defaults and hide evidence: ${JSON.stringify(reset)}`);
    assert(/Stage 1 \/ 3/.test(reset.bossStage) && reset.bossReferenceDisabled, `boss reset/prerequisite view failed: ${JSON.stringify(reset)}`);

    const keyboard = await cdp.evaluate(`(() => {const buttons=[...document.querySelectorAll('.academy-lesson-nav button')];buttons[0].focus();buttons[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,repeat:true}));const repeatStayed=document.activeElement===buttons[0];buttons[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,repeat:false}));return {repeatStayed,moved:document.activeElement===buttons[1]};})()`);
    assert(keyboard.repeatStayed && keyboard.moved, `lesson keyboard navigation/repeat contract failed: ${JSON.stringify(keyboard)}`);
    await cdp.call('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    const reduced = await cdp.evaluate(`(() => {const style=getComputedStyle(document.querySelector('.academy-lesson'));return {durationSeconds:parseFloat(style.transitionDuration)||0,animationSeconds:parseFloat(style.animationDuration)||0};})()`);
    assert(reduced.durationSeconds <= 0.00001 && reduced.animationSeconds <= 0.00001, `reduced-motion contract failed: ${JSON.stringify(reduced)}`);

    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await cdp.call('Page.reload', { ignoreCache: true });
    await waitForInitialization(cdp, true);
    const mobile = await cdp.evaluate(`(() => {
      const viewport=document.documentElement.clientWidth;
      const pageX=window.scrollX;
      const offenders=[...document.querySelectorAll('body *')].filter(node=>!node.closest('.academy-plot-canvas')).map(node=>{const rectangle=node.getBoundingClientRect();return {tag:node.tagName,id:node.id,classes:node.className?.baseVal||node.className||'',text:(node.textContent||'').trim().slice(0,80),left:rectangle.left+pageX,right:rectangle.right+pageX,width:rectangle.width,scroll:node.scrollWidth,client:node.clientWidth};}).filter(item=>item.right>viewport+1).slice(0,30);
      const initialOverflow=document.documentElement.scrollWidth-document.documentElement.clientWidth;
      const plots=[...document.querySelectorAll('.academy-plot-canvas')].map(node=>{const before=node.scrollLeft;const figure=node.closest('.hf-plot');const style=getComputedStyle(node);const figureStyle=getComputedStyle(figure);node.scrollLeft=node.scrollWidth;return {id:node.id,client:node.clientWidth,scroll:node.scrollWidth,moved:node.scrollLeft>before,overflowX:style.overflowX,overflowY:style.overflowY,contain:style.contain,figureClient:figure.clientWidth,figureScroll:figure.scrollWidth,figureOverflow:figureStyle.overflow};});
      const visible=[...document.querySelectorAll('button,input,select,a.button')].filter(node=>{const rectangle=node.getBoundingClientRect();const style=getComputedStyle(node);return rectangle.width>0&&rectangle.height>0&&style.display!=='none'&&style.visibility!=='hidden';});
      const undersized=visible.map(node=>{const rectangle=node.getBoundingClientRect();return {id:node.id||node.textContent.trim().slice(0,30),w:rectangle.width,h:rectangle.height};}).filter(item=>item.h<44||item.w<44);
      const wideNodes=[document.documentElement,document.body,...document.querySelectorAll('body *')].filter(node=>!node.closest?.('.academy-plot-canvas')&&node.scrollWidth>node.clientWidth+1).map(node=>({tag:node.tagName,id:node.id,classes:node.className||'',scroll:node.scrollWidth,client:node.clientWidth,text:(node.textContent||'').trim().slice(0,70)})).slice(0,40);
      return {innerWidth:window.innerWidth,visualWidth:window.visualViewport?.width,clientWidth:document.documentElement.clientWidth,pageX,initialOverflow,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,plots,undersized,offenders,wideNodes};
    })()`);
    assert(mobile.innerWidth === 390 && mobile.clientWidth <= 390, `mobile layout viewport must remain 390px: ${JSON.stringify(mobile)}`);
    assert(mobile.overflow <= 1, `390x844 document must not overflow: ${JSON.stringify(mobile)}`);
    assert(mobile.plots.length === 11 && mobile.plots.every(plot => plot.scroll > plot.client && plot.moved), `all eleven finite plots must scroll internally at 390x844: ${JSON.stringify(mobile.plots)}`);
    assert(mobile.undersized.length === 0, `visible mobile controls must remain touch-sized: ${JSON.stringify(mobile.undersized)}`);
    if (process.env.HF_SCREENSHOT_PATH) {
      await cdp.evaluate('window.scrollTo(0, 0)');
      const capture = await cdp.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
      fs.writeFileSync(process.env.HF_SCREENSHOT_PATH, Buffer.from(capture.data, 'base64'));
    }

    const severe = cdp.events.filter(event => event.method === 'Runtime.exceptionThrown' || (event.method === 'Log.entryAdded' && ['error','warning'].includes(event.params?.entry?.level) && !String(event.params?.entry?.url || '').includes('cdn.jsdelivr.net') && !String(event.params?.entry?.url || '').endsWith('/favicon.ico')));
    assert(severe.length === 0, `browser emitted runtime/severe console events: ${JSON.stringify(severe.slice(-6))}`);

    console.log('Project XC Hartree-Fock and SCF interaction tests OK');
    console.log(`- browser assertions: ${checks}`);
    console.log('- 12 earned games, eleven finite plots, all dossiers, persistence/reset isolation, accessibility, keyboard, and 390x844 internal scrolling: OK');
  } catch (error) {
    if (stderr) console.error(`Chrome stderr (tail):\n${stderr}`);
    throw error;
  } finally {
    try { cdp?.socket.close(); } catch (_error) { /* ignore */ }
    server.close();
    if (browser.exitCode === null) browser.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 300));
    if (browser.exitCode === null) browser.kill('SIGKILL');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try { fs.rmSync(profile, { recursive: true, force: true }); break; }
      catch (error) { if (attempt === 4) throw error; await new Promise(resolve => setTimeout(resolve, 100)); }
    }
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
