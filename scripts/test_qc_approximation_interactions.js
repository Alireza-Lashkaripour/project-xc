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
  throw new Error('Chrome/Chromium is required for Approximation Thinking interaction regressions');
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
    const relative = pathname === '/' ? '/site/qc-approximations.html' : pathname;
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
    const initialized = await cdp.evaluate("document.readyState === 'complete' && !!window.QCApproximationModels && document.querySelectorAll('.approximation-plot svg').length === 10 && !!document.querySelector('#approxBossAudit')");
    if (initialized) return true;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Approximation Thinking page did not initialize${mobile ? ' at mobile size' : ''}`);
}

async function main() {
  const chrome = findChrome();
  const server = await startServer();
  const serverPort = server.address().port;
  const debugPort = await availablePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'project-xc-approximation-interactions-'));
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
    await cdp.call('Page.navigate', { url: `http://127.0.0.1:${serverPort}/site/qc-approximations.html?test=interaction-contracts` });
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
        }
        return (node.textContent || node.value || node.title || '').trim();
      };
      const plots = [...document.querySelectorAll('.academy-plot-canvas')].map(plot => {
        const described = (plot.getAttribute('aria-describedby') || '').trim().split(/\\s+/).filter(Boolean);
        const svg = plot.querySelector('svg');
        return {
          id: plot.id,
          role: plot.getAttribute('role'),
          tabIndex: plot.tabIndex,
          aria: plot.getAttribute('aria-label'),
          described,
          allDescriptionsExist: described.every(id => !!document.getElementById(id)),
          svgLabel: svg?.getAttribute('aria-label') || '',
          badMarkup: /NaN|Infinity|undefined/.test(svg?.outerHTML || '')
        };
      });
      return {
        levels: document.querySelectorAll('.academy-lesson').length,
        games: document.querySelectorAll('.lab-grid').length,
        missions: document.querySelectorAll('.academy-complete[data-mission]').length,
        plots,
        keys: document.querySelectorAll('.academy-plot-key').length,
        duplicated,
        unnamedControls: controls.filter(node => !accessibleName(node)).map(node => node.id || node.outerHTML.slice(0, 60)),
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    })()`);
    assert(structure.levels === 12 && structure.games === 12 && structure.missions === 12, `12-level/12-game/12-mission contract failed: ${JSON.stringify(structure)}`);
    assert(structure.plots.length === 10 && structure.keys === 10, `10-plot/key contract failed: ${JSON.stringify(structure)}`);
    assert(structure.duplicated.length === 0, `page must not contain duplicate ids: ${structure.duplicated.join(', ')}`);
    assert(structure.unnamedControls.length === 0, `every control needs an accessible name: ${structure.unnamedControls.join(', ')}`);
    assert(structure.plots.every(plot => plot.role === 'region' && plot.tabIndex === 0 && plot.aria && plot.described.length >= 2 && plot.allDescriptionsExist && plot.svgLabel && !plot.badMarkup), `plot accessibility/finite-markup contract failed: ${JSON.stringify(structure.plots)}`);
    assert(structure.documentOverflow <= 1, `desktop page must not overflow horizontally: ${structure.documentOverflow}`);

    const initialGates = await cdp.evaluate(`(() => ({
      disabled: [...document.querySelectorAll('.academy-complete[data-game-gate]')].filter(button => button.disabled).length,
      lockedLabels: [...document.querySelectorAll('.academy-complete[data-game-gate]')].filter(button => button.textContent.startsWith('Locked seal')).length,
      progress: document.getElementById('chapterProgressText').textContent,
      notebook: document.querySelectorAll('#approxNotebookList article').length,
      gameStorage: localStorage.getItem('project-xc-approximation-games-v2'),
      rayleighHelperDisplay: getComputedStyle(document.getElementById('rayleighRevealActions')).display,
      perturbExactKeyDisplay: getComputedStyle(document.getElementById('perturbExactKey')).display,
      seriesBestKeyDisplay: getComputedStyle(document.getElementById('seriesBestKey')).display
    }))()`);
    assert(initialGates.disabled === 12 && initialGates.lockedLabels === 12, 'all twelve mission seals must start visibly and functionally locked');
    assert(initialGates.progress.includes('0 / 12') && initialGates.notebook === 0 && initialGates.gameStorage === null, 'fresh chapter starts without self-attested progress or game evidence');
    assert(initialGates.rayleighHelperDisplay === 'none' && initialGates.perturbExactKeyDisplay === 'none' && initialGates.seriesBestKeyDisplay === 'none', 'withheld helpers, oracle keys, and best-order labels must not leak visually before commitment');

    await cdp.evaluate(`localStorage.setItem('project-xc-approximation-games-v2', JSON.stringify({ version: 2, cleared: ['approximation-case-file'], passport: {}, overlap: 7, series: null, errors: false, residual: 'bad', boss: ['ground-upper-bound', 'overlap-collapse', 'error-cancellation'] }))`);
    await cdp.call('Page.reload', { ignoreCache: true });
    await waitForInitialization(cdp);
    const malformedGameRecovery = await cdp.evaluate(`(() => ({
      disabled: [...document.querySelectorAll('.academy-complete[data-game-gate]')].filter(button => button.disabled).length,
      notebook: document.querySelectorAll('#approxNotebookList article').length,
      plots: document.querySelectorAll('.approximation-plot svg').length
    }))()`);
    assert(malformedGameRecovery.disabled === 12 && malformedGameRecovery.notebook === 0 && malformedGameRecovery.plots === 10, `wrong-shaped game storage must recover to a clean usable chapter: ${JSON.stringify(malformedGameRecovery)}`);
    await cdp.evaluate(`localStorage.removeItem('project-xc-approximation-games-v2')`);

    const storageBlock = await cdp.call('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('storage blocked for test', 'SecurityError'); } });` });
    await cdp.call('Page.reload', { ignoreCache: true });
    await waitForInitialization(cdp);
    const unavailableStorageRecovery = await cdp.evaluate(`(() => ({
      disabled: [...document.querySelectorAll('.academy-complete[data-game-gate]')].filter(button => button.disabled).length,
      notebook: document.querySelectorAll('#approxNotebookList article').length,
      plots: document.querySelectorAll('.approximation-plot svg').length,
      progress: document.getElementById('chapterProgressText').textContent
    }))()`);
    assert(unavailableStorageRecovery.disabled === 12 && unavailableStorageRecovery.notebook === 0 && unavailableStorageRecovery.plots === 10 && unavailableStorageRecovery.progress.includes('0 / 12'), `blocked localStorage must leave the chapter usable and truthfully locked: ${JSON.stringify(unavailableStorageRecovery)}`);
    await cdp.call('Page.removeScriptToEvaluateOnNewDocument', { identifier: storageBlock.identifier });
    await cdp.call('Page.reload', { ignoreCache: true });
    await waitForInitialization(cdp);

    const depthRun = await cdp.evaluate(`(() => {
      const set = (id, value, eventName = 'change') => {
        const node = document.getElementById(id);
        node.value = String(value);
        node.dispatchEvent(new Event(eventName, { bubbles: true }));
      };
      const missionFocus = [];
      const recordMission = missionId => {
        const button = document.querySelector('.academy-complete[data-mission="' + missionId + '"]');
        const unlocked = !button.disabled;
        button.focus();
        button.click();
        missionFocus.push(document.activeElement === button);
        return unlocked;
      };
      const result = {};

      // Level 1: first miss gives a human hint without leaking internal answer slugs.
      set('approxPassportMethod', 'numerical-solver');
      set('approxPassportLayer', 'ansatz');
      document.getElementById('approxPassportAudit').click();
      result.passportFirst = {
        text: document.getElementById('approxPassportFeedback').textContent,
        stamp: document.getElementById('approxStampMethod').textContent,
        unlocked: !document.querySelector('[data-mission="approximation-passport"]').disabled
      };
      const passportCases = {
        'gaussian-family': ['variational', 'ansatz'],
        'six-site-subspace': ['representation-truncation', 'representation'],
        'weak-two-level': ['perturbation', 'series-truncation'],
        'harmonic-replacement': ['model-replacement', 'model']
      };
      for (const [caseId, answers] of Object.entries(passportCases)) {
        set('approxPassportCase', caseId);
        set('approxPassportMethod', answers[0]);
        set('approxPassportLayer', answers[1]);
        document.getElementById('approxPassportAudit').click();
      }
      result.passport = {
        score: document.getElementById('approxPassportScore').textContent,
        feedback: document.getElementById('approxPassportFeedback').textContent,
        unlocked: recordMission('approximation-passport')
      };

      // Level 2: inverse design must satisfy two numeric targets and one interpretation.
      set('scaleMass', 1.5, 'input'); set('scaleForce', 6, 'input'); set('scaleBeta', .45, 'input');
      set('scaleUnsolved', 'spectrum');
      document.getElementById('scalingLock').click();
      result.scaling = { text: document.getElementById('scalingChallengeFeedback').textContent, unlocked: recordMission('dimensionless-scaling') };

      // Level 3: two failed manual locks expose a helper, but only classified stationary locks earn the seal.
      document.getElementById('rayleighLockMin').click();
      const helperAfterOne = !document.getElementById('rayleighRevealActions').hidden;
      document.getElementById('rayleighLockMin').click();
      const helperAfterTwo = !document.getElementById('rayleighRevealActions').hidden;
      const spectrum = window.QCApproximationModels.symmetricEigen2x2(1, .2, 3);
      const angleFor = vector => ((Math.atan2(vector[1], vector[0]) * 180 / Math.PI) % 180 + 180) % 180;
      set('rayleighAngle', angleFor(spectrum.vectors[0]).toFixed(6), 'input');
      document.getElementById('rayleighLockMin').click();
      set('rayleighAngle', angleFor(spectrum.vectors[1]).toFixed(6), 'input');
      document.getElementById('rayleighLockMax').click();
      result.rayleigh = { helperAfterOne, helperAfterTwo, stage: document.getElementById('rayleighStage').textContent, unlocked: recordMission('rayleigh-quotient') };

      // Level 4: record the exact reciprocal pair, commit the prediction, then locate the balance manually.
      set('gaussianAlpha', .4, 'input'); document.getElementById('gaussianRecord').click();
      const offPairDiffuseRejected = document.getElementById('gaussianStage').textContent.includes('diffuse 0');
      set('gaussianAlpha', .25, 'input'); document.getElementById('gaussianRecord').click();
      set('gaussianReciprocal', 4); document.getElementById('gaussianCommitPrediction').click();
      set('gaussianAlpha', 4, 'input'); document.getElementById('gaussianRecord').click();
      set('gaussianAlpha', 1, 'input'); document.getElementById('gaussianLockMinimum').click();
      result.gaussian = { stage: document.getElementById('gaussianStage').textContent, offPairDiffuseRejected, helperHidden: document.getElementById('gaussianOptimize').hidden, unlocked: recordMission('variational-gaussian') };

      // Level 5: reject the exact but over-budget oracle; accept the smallest adequate nested space.
      set('basisSize', 6, 'input'); document.getElementById('basisSubmit').click();
      const overBudgetText = document.getElementById('basisReadout').textContent;
      const basisLockedAfterSix = document.querySelector('[data-mission="basis-truncation"]').disabled;
      set('basisSize', 5, 'input'); document.getElementById('basisSubmit').click();
      result.basis = { overBudgetText, basisLockedAfterSix, finalText: document.getElementById('basisReadout').textContent, unlocked: recordMission('basis-truncation') };

      // Level 6: validate both a retained metric solve and a thresholded duplicate-direction rescue.
      set('overlapCase', 'stable'); set('overlapAction', 'retain'); set('overlapThreshold', .03, 'input'); document.getElementById('overlapSubmit').click();
      set('overlapCase', 'duplicate'); set('overlapAction', 'prune'); set('overlapThreshold', .03, 'input'); document.getElementById('overlapSubmit').click();
      const overlapStage = document.getElementById('overlapStage').textContent;
      const overlapText = document.getElementById('overlapReadout').textContent;
      set('overlapH11', 1, 'input'); set('overlapH12', 0, 'input'); set('overlapH22', 1, 'input'); set('overlapS', 0, 'input');
      const groupedRootSvg = document.querySelector('#overlapPlot svg');
      const groupedLabels = [...groupedRootSvg.querySelectorAll('text')].filter(node => /^E[₀₁]=/.test(node.textContent)).map(node => Number(node.getAttribute('y')));
      result.overlap = {
        stage: overlapStage,
        text: overlapText,
        groupedRootLines: groupedRootSvg.dataset.generalizedRootLines,
        groupedRailCount: groupedRootSvg.querySelectorAll('[data-generalized-energy]').length,
        groupedLabelsSeparated: groupedLabels.length === 2 && groupedLabels[0] !== groupedLabels[1],
        groupedStatus: groupedRootSvg.textContent.includes('exactly coincident roots'),
        unlocked: recordMission('nonorthogonal-basis')
      };

      // Level 7: professor exploration cannot grade a fixed dossier; then commit wrong and revise after reveal.
      set('perturbGap', 3, 'input'); set('perturbCoupling', .7, 'input'); set('perturbOrderChoice', 4); set('perturbRangeChoice', .6); document.getElementById('perturbCommit').click();
      const perturbProfessorGuard = {
        text: document.getElementById('perturbationReadout').textContent,
        locked: document.querySelector('[data-mission="nondegenerate-perturbation"]').disabled,
        oracleHidden: document.querySelector('#perturbationPlot svg').textContent.includes('oracle hidden') && getComputedStyle(document.getElementById('perturbExactKey')).display === 'none'
      };
      document.getElementById('perturbMissionModel').click();
      const perturbMissionRestored = Number(document.getElementById('perturbGap').value) === 2 && Number(document.getElementById('perturbCoupling').value) === .5 && document.getElementById('perturbationReadout').textContent.includes('Fixed mission model restored');
      set('perturbOrderChoice', 2); set('perturbRangeChoice', .6); document.getElementById('perturbCommit').click();
      const perturbWrong = document.getElementById('perturbationReadout').textContent;
      const perturbStillLocked = document.querySelector('[data-mission="nondegenerate-perturbation"]').disabled;
      const oracleRevealed = document.querySelector('#perturbationPlot svg').textContent.includes('finite oracle revealed after commitment') && getComputedStyle(document.getElementById('perturbExactKey')).display !== 'none';
      set('perturbOrderChoice', 4); set('perturbRangeChoice', .6); document.getElementById('perturbCommit').click();
      result.perturbation = { perturbProfessorGuard, perturbMissionRestored, perturbWrong, perturbStillLocked, oracleRevealed, finalText: document.getElementById('perturbationReadout').textContent, unlocked: recordMission('nondegenerate-perturbation') };

      // Level 8: keep sub-display splittings distinct, then diagonalize, rotate away, and resolve the identity case.
      set('degenerateW11', 0, 'input'); set('degenerateW12', 0, 'input'); set('degenerateW22', 5e-13, 'input');
      const unresolvedDegeneracy = {
        distinct: document.querySelector('#degeneratePlot svg').getAttribute('data-distinct-levels'),
        plot: document.querySelector('#degeneratePlot svg').textContent,
        readout: document.getElementById('degenerateReadout').textContent
      };
      set('degenerateW11', 1, 'input'); set('degenerateW12', .5, 'input'); set('degenerateW22', -1, 'input');
      set('degeneratePreset', 'split');
      const degenerate = window.QCApproximationModels.degeneratePerturbation(1, .5, -1, 0);
      set('degenerateAngle', degenerate.preferredAngle.toFixed(8), 'input'); document.getElementById('degenerateLock').click();
      set('degenerateAngle', ((degenerate.preferredAngle + 30) % 180).toFixed(8), 'input'); document.getElementById('degenerateCheckInvariants').click();
      set('degeneratePreset', 'same'); document.getElementById('degenerateIdentity').click();
      result.degenerate = { unresolvedDegeneracy, stage: document.getElementById('degenerateStage').textContent, distinct: document.querySelector('#degeneratePlot svg').getAttribute('data-distinct-levels'), unlocked: recordMission('degenerate-perturbation') };

      // Level 9: three commit-before-reveal transfers; use production oracle only to drive this deterministic regression.
      const preSeriesLabel = document.querySelector('#seriesPlot svg').getAttribute('aria-label');
      for (const g of [.1, .2, .4]) {
        set('seriesCase', g);
        const model = window.QCApproximationModels.asymptoticSeriesModel(g, 0, 14);
        set('seriesOrder', model.bestOrder, 'input');
        document.getElementById('seriesCommit').click();
      }
      result.series = { preSeriesLabel, stage: document.getElementById('seriesStage').textContent, text: document.getElementById('seriesReadout').textContent, unlocked: recordMission('series-budget') };

      // Level 10: classify three signed run tables before their decomposition plots are revealed.
      const lockedErrorLabel = document.querySelector('#errorPlot svg').getAttribute('aria-label');
      const errorCases = {
        reinforcing: ['solver', 'no', 'tighten-solver'],
        cancellation: ['solver', 'yes', 'tighten-solver'],
        'converged-not-accurate': ['model', 'no', 'improve-model']
      };
      for (const [caseId, answers] of Object.entries(errorCases)) {
        set('errorCase', caseId);
        set('errorDominant', answers[0]); set('errorCancellation', answers[1]); set('errorNextAction', answers[2]);
        document.getElementById('errorAudit').click();
      }
      result.errors = { lockedErrorLabel, stage: document.getElementById('errorStage').textContent, text: document.getElementById('errorReadout').textContent, unlocked: recordMission('error-decomposition') };

      // Level 11: Professor trials cannot grade fixed files; then certify, reject, and refuse a wrong-root shortcut.
      set('residualCase', 'valid'); set('residualTheta', 80, 'input'); set('residualMix', 10, 'input'); set('residualDecision', 'certify'); document.getElementById('residualAudit').click();
      const residualProfessorGuard = {
        text: document.getElementById('residualReadout').textContent,
        locked: document.querySelector('[data-mission="residual-bounds"]').disabled,
        oracleHidden: !document.querySelector('#residualPlot svg').textContent.includes('Temple lower')
      };
      document.getElementById('residualRestoreCase').click();
      const residualCaseRestored = Number(document.getElementById('residualTheta').value) === 20 && Number(document.getElementById('residualMix').value) === 35 && document.getElementById('residualReadout').textContent.includes('Claim-file trial restored');
      const residualCases = { valid: 'certify', 'gap-fail': 'reject', 'wrong-root': 'missing-evidence' };
      let wrongRootGapWithheld = false;
      for (const [caseId, decision] of Object.entries(residualCases)) {
        set('residualCase', caseId);
        if (caseId === 'wrong-root') {
          const lockedPlotText = document.querySelector('#residualPlot svg').textContent;
          wrongRootGapWithheld = lockedPlotText.includes('target-root separation not supplied') && !lockedPlotText.includes('E₁=1.5') && !lockedPlotText.includes('conditional bracket hidden');
        }
        set('residualDecision', decision); document.getElementById('residualAudit').click();
      }
      result.residual = { residualProfessorGuard, residualCaseRestored, wrongRootGapWithheld, stage: document.getElementById('residualStage').textContent, text: document.getElementById('residualReadout').textContent, unlocked: recordMission('residual-bounds') };

      // Level 12: three evolving, budgeted dossiers; later controls unlock only after earlier evidence.
      const bossCases = {
        'ground-upper-bound': ['variational-ritz', 'rayleigh-residual', 'nested-convergence'],
        'overlap-collapse': ['generalized-eigenproblem', 'overlap-spectrum', 'threshold-stability'],
        'error-cancellation': ['error-budget-audit', 'signed-components', 'targeted-next-run']
      };
      const stageUnlocks = [];
      set('approxBossCase', 'ground-upper-bound');
      for (let miss = 0; miss < 4; miss += 1) {
        set('approxBossMethod', 'nondegenerate-perturbation');
        document.getElementById('approxBossAudit').click();
      }
      const budgetRecovery = {
        budget: document.getElementById('approxBossBudget').textContent,
        feedback: document.getElementById('approxBossFeedback').textContent,
        methodEnabled: !document.getElementById('approxBossMethod').disabled,
        diagnosticLocked: document.getElementById('approxBossDiagnostic').disabled,
        briefRestored: document.getElementById('approxBossArtifact').textContent.startsWith('Initial brief:')
      };
      for (const [caseId, answers] of Object.entries(bossCases)) {
        set('approxBossCase', caseId);
        set('approxBossMethod', answers[0]); document.getElementById('approxBossAudit').click();
        stageUnlocks.push(!document.getElementById('approxBossDiagnostic').disabled && document.getElementById('approxBossEvidence').disabled);
        set('approxBossDiagnostic', answers[1]); document.getElementById('approxBossAudit').click();
        stageUnlocks.push(!document.getElementById('approxBossEvidence').disabled);
        set('approxBossEvidence', answers[2]); document.getElementById('approxBossAudit').click();
      }
      result.boss = {
        budgetRecovery,
        stageUnlocks,
        score: document.getElementById('approxBossScore').textContent,
        artifact: document.getElementById('approxBossArtifact').textContent,
        feedback: document.getElementById('approxBossFeedback').textContent,
        unlocked: recordMission('approximation-case-file')
      };

      result.final = {
        completed: window.ProjectXCAcademy.completedMissions('qc-approximations'),
        progress: document.getElementById('chapterProgressText').textContent,
        notebook: document.querySelectorAll('#approxNotebookList article').length,
        gates: [...document.querySelectorAll('.academy-complete[data-game-gate]')].map(button => ({ mission: button.dataset.mission, gate: button.dataset.gameGate, disabled: button.disabled })),
        gameState: JSON.parse(localStorage.getItem('project-xc-approximation-games-v2')),
        missionFocus,
        badMarkup: [...document.querySelectorAll('.approximation-plot svg')].some(svg => /NaN|Infinity|undefined/.test(svg.outerHTML))
      };
      return result;
    })()`);

    assert(!depthRun.passportFirst.unlocked && !/Expected operation|numerical-solver|ansatz/.test(depthRun.passportFirst.text + depthRun.passportFirst.stamp), `first passport miss must hint without leaking internal answer slugs: ${JSON.stringify(depthRun.passportFirst)}`);
    assert(depthRun.passport.unlocked && depthRun.passport.score.includes('4 / 4') && depthRun.passport.feedback.includes('Passport cleared'), `passport must require all four research briefs: ${JSON.stringify(depthRun.passport)}`);
    assert(depthRun.scaling.unlocked && depthRun.scaling.text.includes('Both ω and g match'), `scaling must be a scored inverse design with interpretation: ${JSON.stringify(depthRun.scaling)}`);
    assert(!depthRun.rayleigh.helperAfterOne && depthRun.rayleigh.helperAfterTwo && depthRun.rayleigh.stage.includes('2 / 2') && depthRun.rayleigh.unlocked, `Rayleigh mission must require two manual stationary classifications before helper-based reveal: ${JSON.stringify(depthRun.rayleigh)}`);
    assert(depthRun.gaussian.unlocked && depthRun.gaussian.offPairDiffuseRejected && depthRun.gaussian.helperHidden && /diffuse 1.*prediction 1.*narrow 1.*minimum 1/.test(depthRun.gaussian.stage), `Gaussian mission must reject an off-pair sample, record the exact reciprocal pair, and require a manual balance: ${JSON.stringify(depthRun.gaussian)}`);
    assert(depthRun.basis.basisLockedAfterSix && depthRun.basis.overBudgetText.includes('exceeds the cost budget') && depthRun.basis.finalText.includes('smallest nested space') && depthRun.basis.unlocked, `basis mission must reject an accurate but over-budget oracle and accept n=5: ${JSON.stringify(depthRun.basis)}`);
    assert(depthRun.overlap.unlocked && depthRun.overlap.stage.includes('2 / 2') && depthRun.overlap.text.includes('three-point observable scan'), `overlap mission must validate two action/threshold/observable cases with a nearby-threshold scan: ${JSON.stringify(depthRun.overlap)}`);
    assert(depthRun.overlap.groupedRootLines === '1' && depthRun.overlap.groupedRailCount === 1 && depthRun.overlap.groupedLabelsSeparated && depthRun.overlap.groupedStatus, `coincident generalized roots must use one rail with separated readable labels: ${JSON.stringify(depthRun.overlap)}`);
    assert(depthRun.perturbation.perturbProfessorGuard.locked && depthRun.perturbation.perturbProfessorGuard.oracleHidden && depthRun.perturbation.perturbProfessorGuard.text.includes('Professor exploration is not graded') && depthRun.perturbation.perturbMissionRestored && depthRun.perturbation.perturbStillLocked && depthRun.perturbation.oracleRevealed && depthRun.perturbation.perturbWrong.includes('rejected after reveal') && depthRun.perturbation.finalText.includes('maximal tested') && depthRun.perturbation.unlocked, `perturbation mission must refuse mutated Professor evidence, restore its fixed target, and enforce commit-then-reveal revision: ${JSON.stringify(depthRun.perturbation)}`);
    assert(depthRun.degenerate.unlocked && depthRun.degenerate.unresolvedDegeneracy.distinct === '2-unresolved' && depthRun.degenerate.unresolvedDegeneracy.plot.includes('numerically unresolved') && depthRun.degenerate.unresolvedDegeneracy.readout.includes('not exactly degenerate') && /basis 1.*invariants 1.*identity case 1/.test(depthRun.degenerate.stage) && depthRun.degenerate.distinct === '1', `degenerate mission must distinguish sub-display splitting from identity, then test diagonal, rotated, and exact-identity stages: ${JSON.stringify(depthRun.degenerate)}`);
    assert(depthRun.series.unlocked && depthRun.series.preSeriesLabel.includes('Term magnitudes') && depthRun.series.stage.includes('3 / 3') && depthRun.series.text.includes('best displayed finite stop'), `series mission must transfer commit-before-reveal stopping decisions across three couplings: ${JSON.stringify(depthRun.series)}`);
    assert(depthRun.errors.unlocked && depthRun.errors.lockedErrorLabel.includes('Locked signed error ledger') && depthRun.errors.stage.includes('3 / 3') && depthRun.errors.text.includes('Error-ledger run cleared'), `error mission must classify three tables before signed decomposition: ${JSON.stringify(depthRun.errors)}`);
    assert(depthRun.residual.residualProfessorGuard.locked && depthRun.residual.residualProfessorGuard.oracleHidden && depthRun.residual.residualProfessorGuard.text.includes('Professor exploration is not graded') && depthRun.residual.residualCaseRestored && depthRun.residual.unlocked && depthRun.residual.wrongRootGapWithheld && depthRun.residual.stage.includes('3 / 3') && depthRun.residual.text.includes('tiny residual near E₁'), `residual mission must refuse mutated Professor evidence, restore fixed claim files, distinguish certification failures, and withhold wrong-root separation until commitment: ${JSON.stringify(depthRun.residual)}`);
    assert(depthRun.boss.budgetRecovery.budget.includes('4 / 4') && depthRun.boss.budgetRecovery.feedback.includes('dossier reset') && depthRun.boss.budgetRecovery.methodEnabled && depthRun.boss.budgetRecovery.diagnosticLocked && depthRun.boss.budgetRecovery.briefRestored, `boss token exhaustion must reset only the active dossier into a recoverable state: ${JSON.stringify(depthRun.boss.budgetRecovery)}`);
    assert(depthRun.boss.unlocked && depthRun.boss.stageUnlocks.every(Boolean) && depthRun.boss.score.includes('3 / 3') && depthRun.boss.score.includes('11 / 11') && depthRun.boss.feedback.includes('Campaign seal earned'), `boss must be staged, budgeted, and prerequisite-gated: ${JSON.stringify(depthRun.boss)}`);
    assert(depthRun.final.completed.length === 12 && depthRun.final.progress === '12 / 12 missions' && depthRun.final.notebook === 12 && depthRun.final.gates.every(gate => gate.gate === 'earned' && !gate.disabled) && depthRun.final.gameState.cleared.length === 12 && depthRun.final.missionFocus.every(Boolean) && !depthRun.final.badMarkup, `all 12 seals must be earned from decision evidence with finite plots and retained focus: ${JSON.stringify(depthRun.final)}`);

    await cdp.call('Page.reload', { ignoreCache: true });
    await waitForInitialization(cdp);
    const persisted = await cdp.evaluate(`(() => ({
      progress: document.getElementById('chapterProgressText').textContent,
      notebook: document.querySelectorAll('#approxNotebookList article').length,
      earnedGates: [...document.querySelectorAll('.academy-complete[data-game-gate="earned"]')].length,
      disabledGates: [...document.querySelectorAll('.academy-complete[data-game-gate]')].filter(button => button.disabled).length,
      stored: JSON.parse(localStorage.getItem('project-xc-approximation-games-v2')).cleared.length
    }))()`);
    assert(persisted.progress === '12 / 12 missions' && persisted.notebook === 12 && persisted.earnedGates === 12 && persisted.disabledGates === 0 && persisted.stored === 12, `earned notebook and gates must survive reload: ${JSON.stringify(persisted)}`);

    const reset = await cdp.evaluate(`(() => {
      window.ProjectXCAcademy.setMission('qc-foundations', 'outside-marker', true);
      localStorage.setItem('project-xc-basis-quest-badges-v2', JSON.stringify(['basis-marker']));
      const focusButton = document.querySelector('[data-mission="nonorthogonal-basis"]');
      focusButton.focus(); focusButton.click(); const focusAfterUncomplete = document.activeElement === focusButton;
      focusButton.click(); const focusAfterComplete = document.activeElement === focusButton;
      document.getElementById('resetChapterProgress').click();
      return {
        chapter: window.ProjectXCAcademy.completedMissions('qc-approximations'),
        foundations: window.ProjectXCAcademy.completedMissions('qc-foundations'),
        basis: localStorage.getItem('project-xc-basis-quest-badges-v2'),
        gameStorage: localStorage.getItem('project-xc-approximation-games-v2'),
        disabled: [...document.querySelectorAll('.academy-complete[data-game-gate]')].filter(button => button.disabled).length,
        notebook: document.querySelectorAll('#approxNotebookList article').length,
        focusAfterUncomplete,
        focusAfterComplete,
        resetView: {
          rayleighHelperHidden: getComputedStyle(document.getElementById('rayleighRevealActions')).display === 'none',
          gaussianHelperHidden: getComputedStyle(document.getElementById('gaussianOptimize')).display === 'none',
          perturbOracleHidden: document.querySelector('#perturbationPlot svg').textContent.includes('oracle hidden') && getComputedStyle(document.getElementById('perturbExactKey')).display === 'none',
          seriesOracleHidden: document.querySelector('#seriesPlot svg').getAttribute('aria-label').includes('Term magnitudes') && getComputedStyle(document.getElementById('seriesBestKey')).display === 'none' && getComputedStyle(document.getElementById('seriesErrorKey')).display === 'none',
          ledgersLocked: document.querySelector('#errorPlot svg').getAttribute('aria-label').includes('Locked signed error ledger'),
          residualBracketHidden: !document.querySelector('#residualPlot svg').textContent.includes('Temple lower'),
          passportNeutral: [...document.querySelectorAll('#approxPassportStamps li')].every(item => !item.dataset.state),
          bossBriefRestored: document.getElementById('approxBossArtifact').textContent.startsWith('Initial brief:'),
          controlDefaults: document.getElementById('approxPassportCase').value === 'gaussian-family' && document.getElementById('approxPassportMethod').value === '' && document.getElementById('approxPassportLayer').value === '' && Number(document.getElementById('scaleMass').value) === 1 && Number(document.getElementById('scaleForce').value) === 1 && Number(document.getElementById('scaleBeta').value) === .1 && document.getElementById('scaleUnsolved').value === '' && Number(document.getElementById('rayleighA').value) === 1 && Number(document.getElementById('rayleighB').value) === .2 && Number(document.getElementById('rayleighD').value) === 3 && Number(document.getElementById('rayleighAngle').value) === 20 && Number(document.getElementById('gaussianAlpha').value) === .25 && document.getElementById('gaussianReciprocal').value === '' && Number(document.getElementById('basisSize').value) === 3 && document.getElementById('overlapCase').value === 'stable' && document.getElementById('overlapAction').value === '' && Number(document.getElementById('overlapThreshold').value) === .03 && Number(document.getElementById('perturbGap').value) === 2 && Number(document.getElementById('perturbCoupling').value) === .5 && Number(document.getElementById('perturbLambda').value) === .4 && document.getElementById('perturbOrderChoice').value === '' && document.getElementById('perturbRangeChoice').value === '' && document.getElementById('degeneratePreset').value === 'split' && Number(document.getElementById('degenerateW11').value) === 1 && Number(document.getElementById('degenerateW12').value) === .5 && Number(document.getElementById('degenerateW22').value) === -1 && Number(document.getElementById('degenerateAngle').value) === 0 && document.getElementById('seriesCase').value === '0.1' && Number(document.getElementById('seriesOrder').value) === 4 && document.getElementById('errorCase').value === 'reinforcing' && document.getElementById('errorDominant').value === '' && document.getElementById('errorCancellation').value === '' && document.getElementById('errorNextAction').value === '' && document.getElementById('residualCase').value === 'valid' && Number(document.getElementById('residualTheta').value) === 20 && Number(document.getElementById('residualMix').value) === 35 && document.getElementById('residualDecision').value === '' && document.getElementById('approxBossCase').value === 'ground-upper-bound' && document.getElementById('approxBossMethod').value === '' && document.getElementById('approxBossDiagnostic').value === '' && document.getElementById('approxBossEvidence').value === '',
          successReadouts: document.querySelectorAll('.game-result[data-state="success"]').length
        }
      };
    })()`);
    const resetViewClean = Object.entries(reset.resetView).every(([key, value]) => key === 'successReadouts' ? value === 0 : value === true);
    assert(reset.chapter.length === 0 && reset.foundations.includes('outside-marker') && reset.basis.includes('basis-marker') && reset.gameStorage === null && reset.disabled === 12 && reset.notebook === 0 && reset.focusAfterUncomplete && reset.focusAfterComplete && resetViewClean, `chapter reset must clear only this chapter's progress/evidence, re-lock every oracle/helper/readout, and preserve outside Academy/Basis state: ${JSON.stringify(reset)}`);

    await cdp.evaluate(`window.ProjectXCAcademy.setMission('qc-approximations', 'approximation-passport', true)`);
    await cdp.call('Page.reload', { ignoreCache: true });
    await waitForInitialization(cdp);
    const legacyCompletion = await cdp.evaluate(`(() => {
      const button = document.querySelector('[data-mission="approximation-passport"]');
      return {
        progress: document.getElementById('chapterProgressText').textContent,
        gate: button.dataset.gameGate,
        disabled: button.disabled,
        label: button.textContent,
        notebook: document.querySelectorAll('#approxNotebookList article').length,
        gameStorage: localStorage.getItem('project-xc-approximation-games-v2')
      };
    })()`);
    assert(legacyCompletion.progress === '1 / 12 missions' && legacyCompletion.gate === 'legacy-complete' && !legacyCompletion.disabled && legacyCompletion.label.includes('Completed') && legacyCompletion.notebook === 0 && legacyCompletion.gameStorage === null, `historical canonical completion must remain usable without fabricating new game evidence: ${JSON.stringify(legacyCompletion)}`);
    const legacyRemoval = await cdp.evaluate(`(async () => {
      const button = document.querySelector('[data-mission="approximation-passport"]');
      button.focus(); button.click();
      await new Promise(resolve => setTimeout(resolve, 20));
      return { completed: window.ProjectXCAcademy.completedMissions('qc-approximations'), gate: button.dataset.gameGate, disabled: button.disabled, focusTarget: document.activeElement?.id || '' };
    })()`);
    assert(legacyRemoval.completed.length === 0 && legacyRemoval.gate === 'locked' && legacyRemoval.disabled && legacyRemoval.focusTarget === 'level1Title', `removing a legacy completion must return to a truthful locked state and move focus to the laboratory heading: ${JSON.stringify(legacyRemoval)}`);

    const runtimeErrors = cdp.events.filter(event => event.method === 'Runtime.exceptionThrown' || (event.method === 'Log.entryAdded' && ['error', 'warning'].includes(event.params?.entry?.level) && !/cdn\.jsdelivr\.net|favicon\.ico/.test(`${event.params?.entry?.text || ''} ${event.params?.entry?.url || ''}`)));
    assert(runtimeErrors.length === 0, `desktop run produced runtime errors: ${JSON.stringify(runtimeErrors)}`);

    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await cdp.call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp.call('Page.reload', { ignoreCache: true });
    await waitForInitialization(cdp, true);
    const mobile = await cdp.evaluate(`(() => {
      const plots = [...document.querySelectorAll('.academy-plot-canvas')].map(plot => {
        const box = plot.getBoundingClientRect();
        const style = getComputedStyle(plot);
        plot.focus();
        plot.scrollLeft = plot.scrollWidth;
        return { id: plot.id, client: plot.clientWidth, scroll: plot.scrollWidth, left: plot.scrollLeft, boxLeft: box.left, boxRight: box.right, overflowX: style.overflowX, focused: document.activeElement === plot };
      });
      const touchControls = [...document.querySelectorAll('.approximation-game-brief button, .academy-complete, .approximation-game-brief select')].filter(node => !node.hidden && node.getClientRects().length > 0).map(node => ({ id: node.id || node.dataset.mission, height: node.getBoundingClientRect().height, left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right }));
      const navLinks = [...document.querySelectorAll('.nav-links a')].map(node => { const box = node.getBoundingClientRect(); return { text: node.textContent.trim(), left: box.left, right: box.right, width: box.width, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }; });
      return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        plots,
        touchControls,
        navLinks,
        maxTouchPoints: navigator.maxTouchPoints,
        levels: document.querySelectorAll('.academy-lesson').length
      };
    })()`);
    assert(mobile.innerWidth === 390 && mobile.innerHeight === 844 && mobile.clientWidth === 390 && mobile.levels === 12, `true mobile emulation must preserve the complete chapter: ${JSON.stringify(mobile)}`);
    assert(mobile.scrollWidth - mobile.clientWidth <= 1, `mobile page must not create document-level horizontal overflow: ${JSON.stringify(mobile)}`);
    assert(mobile.plots.length === 10 && mobile.plots.every(plot => plot.scroll > plot.client && plot.left > 0 && plot.boxLeft >= 0 && plot.boxRight <= 390 && ['auto', 'scroll'].includes(plot.overflowX) && plot.focused), `all ten mobile plots must be contained, focusable internal scrollers: ${JSON.stringify(mobile.plots)}`);
    assert(mobile.touchControls.every(control => control.height >= 32 && control.left >= 0 && control.right <= 390), `mobile controls must remain usable and contained: ${JSON.stringify(mobile.touchControls)}`);
    assert(mobile.navLinks.length === 5 && mobile.navLinks.every(link => link.left >= 0 && link.right <= 390 && link.scrollWidth <= link.clientWidth + 1), `all five mobile chapter links must wrap as whole, unclipped controls: ${JSON.stringify(mobile.navLinks)}`);
    assert(mobile.maxTouchPoints > 0, 'mobile regression must run with touch emulation enabled');

    console.log('Project XC Approximation Thinking interaction tests OK');
    console.log(`- browser assertions: ${checks}`);
    console.log('- 12 deep games, ten finite plots, all passport/boss cases, malformed/blocked persistence, isolated Academy/Basis progress, focus/keyboard/reduced-motion behavior, and 390×844 internal scrolling: OK');
  } catch (error) {
    if (stderr) console.error(`Chrome stderr (tail):\n${stderr}`);
    throw error;
  } finally {
    cdp?.socket.close();
    server.close();
    if (browser.exitCode === null) browser.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 300));
    if (browser.exitCode === null) browser.kill('SIGKILL');
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
