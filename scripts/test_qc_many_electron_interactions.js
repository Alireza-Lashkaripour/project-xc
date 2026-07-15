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
  throw new Error('Chrome/Chromium is required for Many-Electron Wavefunctions interaction regressions');
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
    const relative = pathname === '/' ? '/site/qc-many-electron.html' : pathname;
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
    const initialized = await cdp.evaluate("document.readyState === 'complete' && !!window.QCManyElectronModels && document.querySelectorAll('.many-electron-plot svg').length === 9 && !!document.querySelector('#manyBossAudit')");
    if (initialized) return true;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Many-Electron Wavefunctions page did not initialize${mobile ? ' at mobile size' : ''}`);
}

async function main() {
  const chrome = findChrome();
  const server = await startServer();
  const serverPort = server.address().port;
  const debugPort = await availablePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'project-xc-many-electron-interactions-'));
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
    await cdp.call('Page.navigate', { url: `http://127.0.0.1:${serverPort}/site/qc-many-electron.html?test=interaction-contracts` });
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
          allDescriptionsExist: described.every(id => !!document.getElementById(id)),
          svgLabel: svg?.getAttribute('aria-label') || '', badMarkup: /NaN|Infinity|undefined/.test(svg?.outerHTML || '')
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
    assert(structure.levels === 10 && structure.games === 10 && structure.missions === 10, `10-level/10-game/10-mission contract failed: ${JSON.stringify(structure)}`);
    assert(structure.plots.length === 9 && structure.keys === 9, `9-plot/key contract failed: ${JSON.stringify(structure)}`);
    assert(structure.duplicated.length === 0, `page must not contain duplicate ids: ${structure.duplicated.join(', ')}`);
    assert(structure.unnamedControls.length === 0, `every control needs an accessible name: ${structure.unnamedControls.join(', ')}`);
    assert(structure.plots.every(plot => plot.role === 'region' && plot.tabIndex === 0 && plot.aria && plot.described.length >= 2 && plot.allDescriptionsExist && plot.svgLabel && !plot.badMarkup), `plot accessibility/finite-markup contract failed: ${JSON.stringify(structure.plots)}`);
    assert(structure.documentOverflow <= 1, `desktop page must not overflow horizontally: ${structure.documentOverflow}`);

    const initial = await cdp.evaluate(`(() => ({
      disabled: [...document.querySelectorAll('.academy-complete[data-game-gate]')].filter(button => button.disabled).length,
      lockedLabels: [...document.querySelectorAll('.academy-complete[data-game-gate]')].filter(button => button.textContent.startsWith('Locked seal')).length,
      progress: document.getElementById('chapterProgressText').textContent,
      notebook: document.querySelectorAll('#manyNotebookList article').length,
      storage: localStorage.getItem('project-xc-many-electron-games-v1'),
      publicModelKeys: Object.keys(window.QCManyElectronModels || {}),
      publicAnswerLeak: /expected|route|BOSS_CASES|SELECTION_CASES|RDM_CASES/.test(JSON.stringify(window.QCManyElectronModels || {})),
      visibleOracleKeys: ['exchangeOracleKey','occupancyCountKey','parityOracleKey','overlapSpectrumKey','overlapDetKey','oneBodyRankKey','twoBodyOracleKey','spinWeightKey','oneRdmOccupationKey','oneRdmTraceKey','twoRdmTraceKey','twoRdmContractKey'].filter(id => { const node=document.getElementById(id); return node && getComputedStyle(node).display !== 'none'; })
    }))()`);
    assert(initial.disabled === 10 && initial.lockedLabels === 10, 'all ten mission seals must start visibly and functionally locked');
    assert(initial.progress.includes('0 / 10') && initial.notebook === 0 && initial.storage === null, `fresh chapter state failed: ${JSON.stringify(initial)}`);
    assert(!initial.publicAnswerLeak && initial.publicModelKeys.length > 0 && initial.publicModelKeys.every(name => !name.startsWith('evaluate') && name !== 'constants'), `public finite-model API must not expose grading tables/evaluators: ${JSON.stringify(initial.publicModelKeys)}`);
    const shippedScriptAudit = await cdp.evaluate(`fetch('assets/qc-many-electron.js').then(response => response.text()).then(text => ({ leaked: /\\b(?:BOSS_CASES|RDM_CASES|TWO_RDM_CASES)\\b|\\bexpected\\s*:|\\broute\\s*:/.test(text), bytes: text.length }))`);
    assert(!shippedScriptAudit.leaked && shippedScriptAudit.bytes > 10000, `shipped browser source must derive grading from displayed algebra rather than static answer maps: ${JSON.stringify(shippedScriptAudit)}`);
    assert(initial.visibleOracleKeys.length === 0, `decisive oracle keys must stay hidden before commitment: ${initial.visibleOracleKeys.join(', ')}`);

    // Wrong-shaped standalone evidence cannot invent mastery or boss completion.
    await cdp.evaluate(`localStorage.setItem('project-xc-many-electron-games-v1', JSON.stringify({ version: 1, exchange: {}, occupancy: 7, parity: null, overlap: false, oneBody: 'bad', twoBody: [], spin: [], oneRdm: [], twoRdm: [], boss: [], bossStage: {'boss-a':3}, bossBudget: {'boss-a':2} }))`);
    await cdp.call('Page.reload', { ignoreCache: true });
    await waitForInitialization(cdp);
    const malformed = await cdp.evaluate(`(() => ({ disabled: [...document.querySelectorAll('.academy-complete[data-game-gate]')].filter(button=>button.disabled).length, notebook: document.querySelectorAll('#manyNotebookList article').length, plots: document.querySelectorAll('.many-electron-plot svg').length, bossStage: document.getElementById('manyBossStage').textContent, bossArtifact: document.getElementById('manyBossArtifact').textContent, representationDisabled: document.getElementById('manyBossRepresentation').disabled }))()`);
    assert(malformed.disabled === 10 && malformed.notebook === 0 && malformed.plots === 9 && /Stage 1 \/ 3/.test(malformed.bossStage) && !/Evidence unlocked/.test(malformed.bossArtifact) && !malformed.representationDisabled, `wrong-shaped or inconsistent storage must recover to clean usable state: ${JSON.stringify(malformed)}`);
    await cdp.evaluate(`localStorage.removeItem('project-xc-many-electron-games-v1')`);

    // This chapter has no published legacy game evidence: canonical-only writes cannot forge an earned seal.
    await cdp.evaluate(`window.ProjectXCAcademy.setMission('qc-many-electron','fermion-exchange',true)`);
    await new Promise(resolve => setTimeout(resolve, 50));
    const forgedLive = await cdp.evaluate(`(() => { const b=document.querySelector('[data-mission="fermion-exchange"]'); return {disabled:b.disabled, gate:b.dataset.gameGate, canonical:window.ProjectXCAcademy.completedMissions('qc-many-electron')}; })()`);
    assert(forgedLive.disabled && forgedLive.gate === 'locked' && !forgedLive.canonical.includes('fermion-exchange'), `live canonical-only completion must be rejected immediately: ${JSON.stringify(forgedLive)}`);
    await cdp.call('Page.reload', { ignoreCache: true });
    await waitForInitialization(cdp);
    const forgedCanonical = await cdp.evaluate(`(() => { const b=document.querySelector('[data-mission="fermion-exchange"]'); return {disabled:b.disabled, gate:b.dataset.gameGate, notebook:document.querySelectorAll('#manyNotebookList article').length, canonical:window.ProjectXCAcademy.completedMissions('qc-many-electron')}; })()`);
    assert(forgedCanonical.disabled && forgedCanonical.gate === 'locked' && forgedCanonical.notebook === 0 && !forgedCanonical.canonical.includes('fermion-exchange'), `canonical-only completion must be rejected without game evidence: ${JSON.stringify(forgedCanonical)}`);
    await cdp.call('Page.reload', { ignoreCache: true });
    await waitForInitialization(cdp);

    // Storage denial must leave all finite models and controls usable.
    const storageBlock = await cdp.call('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('storage blocked for test', 'SecurityError'); } });` });
    await cdp.call('Page.reload', { ignoreCache: true });
    await waitForInitialization(cdp);
    const blocked = await cdp.evaluate(`(() => ({ disabled:[...document.querySelectorAll('.academy-complete')].filter(b=>b.disabled).length, plots:document.querySelectorAll('.many-electron-plot svg').length, progress:document.getElementById('chapterProgressText').textContent }))()`);
    assert(blocked.disabled === 10 && blocked.plots === 9 && blocked.progress.includes('0 / 10'), `blocked storage recovery failed: ${JSON.stringify(blocked)}`);
    await cdp.call('Page.removeScriptToEvaluateOnNewDocument', { identifier: storageBlock.identifier });
    await cdp.call('Page.reload', { ignoreCache: true });
    await waitForInitialization(cdp);

    const depthRun = await cdp.evaluate(`(() => {
      const set = (id, value, eventName='change') => { const node=document.getElementById(id); node.value=String(value); node.dispatchEvent(new Event(eventName,{bubbles:true})); };
      const record = mission => { const button=document.querySelector('[data-mission="'+mission+'"]'); const unlocked=!button.disabled; button.focus(); button.click(); return {unlocked, focused:document.activeElement===button}; };
      const result={records:[]};

      // Level 1: wrong commitment reveals diagnostic but cannot unlock.
      set('exchangeDecision','symmetric'); document.getElementById('exchangeAudit').click();
      result.exchangeWrong={unlocked:!document.querySelector('[data-mission="fermion-exchange"]').disabled, text:document.getElementById('exchangeReadout').textContent, oracle:getComputedStyle(document.getElementById('exchangeOracleKey')).display};
      const exchange={'exchange-a':'antisymmetric','exchange-b':'symmetric','exchange-c':'neither'};
      for (const [caseId,answer] of Object.entries(exchange)) { set('exchangeCase',caseId); set('exchangeDecision',answer); document.getElementById('exchangeAudit').click(); }
      result.records.push(record('fermion-exchange'));

      // Level 2: duplicate creation fails recoverably, then every fixed-N sector is forged.
      set('occupancyOrbitals','0,0','input'); set('occupancyCount',6); document.getElementById('occupancyAudit').click();
      result.occupancyWrong={text:document.getElementById('occupancyReadout').textContent, unlocked:!document.querySelector('[data-mission="spin-orbital-occupancy"]').disabled};
      const occupancy={ 'occupancy-a':['0,3',6], 'occupancy-b':['0,2,5',20], 'occupancy-c':['0,2,5,7',70] };
      for (const [caseId,answers] of Object.entries(occupancy)) { set('occupancyCase',caseId); set('occupancyOrbitals',answers[0],'input'); set('occupancyCount',answers[1]); document.getElementById('occupancyAudit').click(); }
      result.records.push(record('spin-orbital-occupancy'));

      const parity={ '1,0,2':-1, '2,0,3,1':-1, '3,2,1,0':1 };
      for (const [caseId,answer] of Object.entries(parity)) { set('parityCase',caseId); set('paritySign',answer); document.getElementById('parityAudit').click(); }
      result.records.push(record('determinant-parity'));

      const overlap={'overlap-a':'accept-normalized','overlap-b':'renormalize','overlap-c':'scan-threshold','overlap-d':'reject-dependent'};
      for (const [caseId,answer] of Object.entries(overlap)) { set('overlapCase',caseId); set('overlapDecision',answer); document.getElementById('overlapAudit').click(); }
      result.records.push(record('determinant-overlap'));

      const one={'connection-a':'allowed','connection-b':'allowed','connection-c':'forbidden','connection-d':'forbidden'};
      for (const [caseId,answer] of Object.entries(one)) { set('oneBodyCase',caseId); set('oneBodyDecision',answer); document.getElementById('oneBodyAudit').click(); }
      result.records.push(record('one-body-selection'));

      // Calling supplied determinant expectation an HF solution is rejected.
      set('twoBodyDecision','allowed'); set('energyInterpretation','hf-solution'); document.getElementById('twoBodyAudit').click();
      result.twoBodyWrong={text:document.getElementById('twoBodyReadout').textContent,unlocked:!document.querySelector('[data-mission="two-body-selection"]').disabled};
      set('twoBodyCase','connection-a');
      const twoBodyVisibleA=document.getElementById('twoBodyPlot').textContent;
      set('twoBodyCase','connection-d');
      const twoBodyVisibleD=document.getElementById('twoBodyPlot').textContent;
      result.twoBodyVisibleDossiers={a:twoBodyVisibleA,d:twoBodyVisibleD};
      const two={'connection-a':'allowed','connection-b':'allowed','connection-c':'allowed','connection-d':'forbidden'};
      for (const [caseId,answer] of Object.entries(two)) { set('twoBodyCase',caseId); set('twoBodyDecision',answer); set('energyInterpretation','coulomb-minus-exchange'); document.getElementById('twoBodyAudit').click(); }
      result.records.push(record('two-body-selection'));

      const spin={'spin-a':'singlet','spin-b':'triplet','spin-c':'mixture'};
      for (const [caseId,answer] of Object.entries(spin)) { set('spinCase',caseId); set('spinDecision',answer); document.getElementById('spinAudit').click(); }
      result.records.push(record('spin-adaptation'));

      const oneRdm={'one-rdm-a':'idempotent','one-rdm-b':'fractional','one-rdm-c':'reject-trace'};
      for (const [caseId,answer] of Object.entries(oneRdm)) { set('oneRdmCase',caseId); set('oneRdmDecision',answer); document.getElementById('oneRdmAudit').click(); }
      result.records.push(record('one-rdm'));

      const twoRdm={'two-rdm-a':'certify-necessary','two-rdm-b':'reject-contraction','two-rdm-c':'missing-pair-evidence'};
      for (const [caseId,answer] of Object.entries(twoRdm)) { set('twoRdmCase',caseId); set('twoRdmDecision',answer); document.getElementById('twoRdmAudit').click(); }
      result.records.push(record('two-rdm'));

      // Four misses exhaust and reset only the active boss dossier.
      set('manyBossRepresentation','orbital-energy-list');
      for(let i=0;i<4;i+=1) document.getElementById('manyBossAudit').click();
      result.bossRecovery={stage:document.getElementById('manyBossStage').textContent, representation:document.getElementById('manyBossRepresentation').value, diagnosticDisabled:document.getElementById('manyBossDiagnostic').disabled, feedback:document.getElementById('manyBossFeedback').textContent};

      // Accepted boss commitments must become immutable and survive case switching.
      set('manyBossRepresentation','wedge-state'); document.getElementById('manyBossAudit').click();
      set('manyBossRepresentation','multi-determinant-state');
      set('manyBossDiagnostic','zero-determinant'); document.getElementById('manyBossAudit').click();
      result.bossCommitLock={representation:document.getElementById('manyBossRepresentation').value, representationDisabled:document.getElementById('manyBossRepresentation').disabled, diagnostic:document.getElementById('manyBossDiagnostic').value, diagnosticDisabled:document.getElementById('manyBossDiagnostic').disabled, evidenceDisabled:document.getElementById('manyBossEvidence').disabled};
      set('manyBossCase','boss-b'); set('manyBossCase','boss-a');
      result.bossCommitRestore={representation:document.getElementById('manyBossRepresentation').value, representationDisabled:document.getElementById('manyBossRepresentation').disabled, diagnostic:document.getElementById('manyBossDiagnostic').value, diagnosticDisabled:document.getElementById('manyBossDiagnostic').disabled, evidenceDisabled:document.getElementById('manyBossEvidence').disabled, feedback:document.getElementById('manyBossFeedback').textContent};
      document.getElementById('manyBossReset').click();

      const boss={
        'boss-a':['wedge-state','zero-determinant','canonical-occupancy'],
        'boss-b':['determinant-pair','excitation-rank','one-body-integral'],
        'boss-c':['multi-determinant-state','natural-occupations','two-rdm-contraction']
      };
      for (const [caseId,route] of Object.entries(boss)) {
        set('manyBossCase',caseId);
        set('manyBossRepresentation',route[0]); document.getElementById('manyBossAudit').click();
        set('manyBossDiagnostic',route[1]); document.getElementById('manyBossAudit').click();
        set('manyBossEvidence',route[2]); document.getElementById('manyBossAudit').click();
      }
      result.boss={score:document.getElementById('manyBossScore').textContent, unlocked:!document.querySelector('[data-mission="many-electron-case-file"]').disabled, artifact:document.getElementById('manyBossArtifact').textContent};
      result.records.push(record('many-electron-case-file'));
      result.final={progress:document.getElementById('chapterProgressText').textContent, notebook:document.querySelectorAll('#manyNotebookList article').length, stored:JSON.parse(localStorage.getItem('project-xc-many-electron-games-v1')), canonical:window.ProjectXCAcademy.completedMissions('qc-many-electron')};
      return result;
    })()`);

    assert(!depthRun.exchangeWrong.unlocked && /Revise/.test(depthRun.exchangeWrong.text) && depthRun.exchangeWrong.oracle !== 'none', `exchange miss must recover through revealed diagnostic without unlocking: ${JSON.stringify(depthRun.exchangeWrong)}`);
    assert(!depthRun.occupancyWrong.unlocked && /Pauli zero/.test(depthRun.occupancyWrong.text), `duplicate creation must fail recoverably: ${JSON.stringify(depthRun.occupancyWrong)}`);
    assert(!depthRun.twoBodyWrong.unlocked && /not.*Hartree|No stationarity|Interpretation rejected/i.test(depthRun.twoBodyWrong.text), `HF-boundary mislabel must be rejected: ${JSON.stringify(depthRun.twoBodyWrong)}`);
    assert(depthRun.twoBodyVisibleDossiers.a !== depthRun.twoBodyVisibleDossiers.d && /bra/.test(depthRun.twoBodyVisibleDossiers.a) && /ket/.test(depthRun.twoBodyVisibleDossiers.d), `Level 6 must visibly render the selected determinant pair that is graded: ${JSON.stringify(depthRun.twoBodyVisibleDossiers)}`);
    assert(depthRun.records.every(item => item.unlocked && item.focused), `each earned seal must unlock and remain keyboard-focused when recorded: ${JSON.stringify(depthRun.records)}`);
    assert(/Stage 1 \/ 3.*4 tokens/.test(depthRun.bossRecovery.stage) && depthRun.bossRecovery.representation === '' && depthRun.bossRecovery.diagnosticDisabled && /dossier reset/.test(depthRun.bossRecovery.feedback), `boss token exhaustion must deterministically reset: ${JSON.stringify(depthRun.bossRecovery)}`);
    assert(depthRun.bossCommitLock.representation === 'wedge-state' && depthRun.bossCommitLock.representationDisabled && depthRun.bossCommitLock.diagnostic === 'zero-determinant' && depthRun.bossCommitLock.diagnosticDisabled && !depthRun.bossCommitLock.evidenceDisabled, `accepted boss stages must be immutable while only the current stage is enabled: ${JSON.stringify(depthRun.bossCommitLock)}`);
    assert(depthRun.bossCommitRestore.representation === 'wedge-state' && depthRun.bossCommitRestore.representationDisabled && depthRun.bossCommitRestore.diagnostic === 'zero-determinant' && depthRun.bossCommitRestore.diagnosticDisabled && !depthRun.bossCommitRestore.evidenceDisabled && /Stage 3/.test(depthRun.bossCommitRestore.feedback), `partial boss commitments and stage-specific feedback must restore consistently after case switching: ${JSON.stringify(depthRun.bossCommitRestore)}`);
    assert(depthRun.boss.unlocked && /3 \/ 3/.test(depthRun.boss.score) && /not a complete arbitrary 2-RDM/.test(depthRun.boss.artifact), `three-stage boss contract failed: ${JSON.stringify(depthRun.boss)}`);
    assert(depthRun.final.progress.includes('10 / 10') && depthRun.final.notebook === 10 && depthRun.final.canonical.length === 10, `full earned chapter progress failed: ${JSON.stringify(depthRun.final)}`);
    assert(depthRun.final.stored.exchange.length === 3 && depthRun.final.stored.overlap.length === 4 && depthRun.final.stored.boss.length === 3, 'versioned game evidence must retain all multi-case predicates');

    // Reload proves isolated evidence and canonical progress persist.
    await cdp.call('Page.reload', { ignoreCache: true });
    await waitForInitialization(cdp);
    const persisted = await cdp.evaluate(`(() => ({ progress:document.getElementById('chapterProgressText').textContent, notebook:document.querySelectorAll('#manyNotebookList article').length, earned:[...document.querySelectorAll('.academy-complete')].filter(b=>b.dataset.gameGate==='earned').length, boss:document.getElementById('manyBossScore').textContent }))()`);
    assert(persisted.progress.includes('10 / 10') && persisted.notebook === 10 && persisted.earned === 10 && /3 \/ 3/.test(persisted.boss), `reload persistence failed: ${JSON.stringify(persisted)}`);

    // Chapter reset restores every visible default/re-lock and preserves unrelated Academy/Basis data.
    const reset = await cdp.evaluate(`(() => {
      window.ProjectXCAcademy.setMission('qc-foundations','scale',true);
      localStorage.setItem('project-xc-basis-quest-badges-v2',JSON.stringify(['orbital-alphabet']));
      document.getElementById('resetChapterProgress').click();
      const oracleIds=['exchangeOracleKey','occupancyCountKey','parityOracleKey','overlapSpectrumKey','overlapDetKey','twoBodyOracleKey','spinWeightKey','oneRdmOccupationKey','oneRdmTraceKey','twoRdmTraceKey','twoRdmContractKey'];
      const defaults={exchangeCase:'exchange-a',exchangeDecision:'',occupancyCase:'occupancy-a',occupancyOrbitals:'0,3',occupancyCount:'',parityCase:'1,0,2',paritySign:'',overlapCase:'overlap-a',overlapDecision:'',oneBodyCase:'connection-a',oneBodyDecision:'',twoBodyCase:'connection-a',twoBodyDecision:'',energyInterpretation:'',spinCase:'spin-a',spinDecision:'',oneRdmCase:'one-rdm-a',oneRdmDecision:'',twoRdmCase:'two-rdm-a',twoRdmDecision:'',manyBossCase:'boss-a',manyBossRepresentation:'',manyBossDiagnostic:'',manyBossEvidence:''};
      return {
        disabled:[...document.querySelectorAll('.academy-complete')].filter(b=>b.disabled).length,
        locked:[...document.querySelectorAll('.academy-complete')].filter(b=>b.textContent.startsWith('Locked seal')).length,
        progress:document.getElementById('chapterProgressText').textContent,
        notebook:document.querySelectorAll('#manyNotebookList article').length,
        gameStorage:localStorage.getItem('project-xc-many-electron-games-v1'),
        canonical:window.ProjectXCAcademy.completedMissions('qc-many-electron'),
        foundation:window.ProjectXCAcademy.completedMissions('qc-foundations'),
        basis:localStorage.getItem('project-xc-basis-quest-badges-v2'),
        visibleOracles:oracleIds.filter(id=>{const node=document.getElementById(id);return node&&getComputedStyle(node).display!=='none';}),
        defaults:Object.fromEntries(Object.keys(defaults).map(id=>[id,document.getElementById(id).value])), expectedDefaults:defaults,
        successReadouts:[...document.querySelectorAll('.game-result[data-state="success"]')].map(node=>node.id),
        bossStage:document.getElementById('manyBossStage').textContent,
        bossDiagnosticDisabled:document.getElementById('manyBossDiagnostic').disabled
      };
    })()`);
    assert(reset.disabled === 10 && reset.locked === 10 && reset.progress.includes('0 / 10') && reset.notebook === 0, `reset must relock all ten seals: ${JSON.stringify(reset)}`);
    assert(reset.gameStorage === null && reset.canonical.length === 0 && reset.foundation.includes('scale') && reset.basis.includes('orbital-alphabet'), `reset isolation failed: ${JSON.stringify(reset)}`);
    assert(reset.visibleOracles.length === 0 && reset.successReadouts.length === 0 && JSON.stringify(reset.defaults) === JSON.stringify(reset.expectedDefaults), `reset must restore visible defaults and hide all evidence: ${JSON.stringify(reset)}`);
    assert(/Stage 1 \/ 3.*4 tokens/.test(reset.bossStage) && reset.bossDiagnosticDisabled, `boss reset view failed: ${JSON.stringify(reset)}`);

    // Keyboard nav repeat suppression and reduced-motion contract.
    const keyboard = await cdp.evaluate(`(() => {
      const buttons=[...document.querySelectorAll('.academy-lesson-nav button')];
      buttons[0].focus();
      buttons[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,repeat:true}));
      const repeatStayed=document.activeElement===buttons[0];
      buttons[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,repeat:false}));
      return {repeatStayed,moved:document.activeElement===buttons[1]};
    })()`);
    assert(keyboard.repeatStayed && keyboard.moved, `lesson keyboard navigation/repeat contract failed: ${JSON.stringify(keyboard)}`);
    await cdp.call('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    const reduced = await cdp.evaluate(`(() => { const s=getComputedStyle(document.querySelector('.academy-lesson')); return {duration:s.transitionDuration,animation:s.animationDuration,durationSeconds:parseFloat(s.transitionDuration)||0,animationSeconds:parseFloat(s.animationDuration)||0}; })()`);
    assert(reduced.durationSeconds <= 0.00001 && reduced.animationSeconds <= 0.00001, `reduced-motion contract failed: ${JSON.stringify(reduced)}`);

    // True mobile viewport: no document overflow, every finite plot scrolls internally, controls remain touch-sized.
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await cdp.call('Page.reload', { ignoreCache: true });
    await waitForInitialization(cdp, true);
    const mobile = await cdp.evaluate(`(() => {
      const plots=[...document.querySelectorAll('.academy-plot-canvas')].map(node=>{ const before=node.scrollLeft; node.scrollLeft=node.scrollWidth; return {id:node.id,client:node.clientWidth,scroll:node.scrollWidth,moved:node.scrollLeft>before}; });
      const visible=[...document.querySelectorAll('button,input,select,a.button')].filter(node=>{const r=node.getBoundingClientRect();const s=getComputedStyle(node);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';});
      const undersized=visible.map(node=>{const r=node.getBoundingClientRect();return {id:node.id||node.textContent.trim().slice(0,30),w:r.width,h:r.height};}).filter(item=>item.h<40||item.w<40);
      return {overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,plots,undersized};
    })()`);
    assert(mobile.overflow <= 1, `390x844 document must not overflow: ${JSON.stringify(mobile)}`);
    assert(mobile.plots.length === 9 && mobile.plots.every(plot => plot.scroll > plot.client && plot.moved), `all nine finite plots must scroll internally at 390x844: ${JSON.stringify(mobile.plots)}`);
    assert(mobile.undersized.length === 0, `visible mobile controls must remain touch-sized: ${JSON.stringify(mobile.undersized)}`);

    const severe = cdp.events.filter(event => event.method === 'Runtime.exceptionThrown' || (event.method === 'Log.entryAdded' && ['error','warning'].includes(event.params?.entry?.level) && !String(event.params?.entry?.url || '').includes('cdn.jsdelivr.net') && !String(event.params?.entry?.url || '').endsWith('/favicon.ico')));
    assert(severe.length === 0, `browser emitted runtime/severe console events: ${JSON.stringify(severe.slice(-6))}`);

    console.log('Project XC Many-Electron Wavefunctions interaction tests OK');
    console.log(`- browser assertions: ${checks}`);
    console.log('- 10 earned games, nine finite plots, all dossiers, persistence/reset isolation, accessibility, keyboard, and 390x844 internal scrolling: OK');
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
