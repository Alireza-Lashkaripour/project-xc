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

    const passport = await cdp.evaluate(`(() => {
      const cases = {
        'gaussian-family': ['variational', 'ansatz'],
        'six-site-subspace': ['representation-truncation', 'representation'],
        'weak-two-level': ['perturbation', 'series-truncation'],
        'harmonic-replacement': ['model-replacement', 'model']
      };
      return Object.entries(cases).map(([caseId, answers]) => {
        const caseSelect = document.getElementById('approxPassportCase');
        caseSelect.value = caseId; caseSelect.dispatchEvent(new Event('change', { bubbles: true }));
        document.getElementById('approxPassportMethod').value = answers[0];
        document.getElementById('approxPassportLayer').value = answers[1];
        document.getElementById('approxPassportAudit').click();
        const feedback = document.getElementById('approxPassportFeedback');
        return {
          caseId,
          text: feedback.textContent,
          state: feedback.dataset.state,
          stampStates: ['approxStampMethod', 'approxStampLayer', 'approxStampDiagnostic', 'approxStampEvidence'].map(id => document.getElementById(id).dataset.state),
          populatedStamps: ['approxStampMethod', 'approxStampLayer', 'approxStampDiagnostic', 'approxStampEvidence'].every(id => document.getElementById(id).querySelector('strong'))
        };
      });
    })()`);
    assert(passport.every(item => item.text.includes('Passport cleared') && item.state === 'success' && item.populatedStamps && item.stampStates.join(',') === 'pass,pass,evidence,evidence'), `every passport case must produce exact, visibly differentiated dossier feedback: ${JSON.stringify(passport)}`);

    const instruments = await cdp.evaluate(`(() => {
      document.getElementById('rayleighMinimize').click();
      const angle = Number(document.getElementById('rayleighAngle').value);
      const rayleigh = window.QCApproximationModels.rayleighQuotient2(1, .2, 3, angle);
      document.getElementById('gaussianAlpha').value = '7';
      document.getElementById('gaussianAlpha').dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('gaussianOptimize').click();
      document.getElementById('basisSize').value = '6';
      document.getElementById('basisSize').dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('overlapS').value = '.98';
      document.getElementById('overlapS').dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('degeneratePreset').value = 'same';
      document.getElementById('degeneratePreset').dispatchEvent(new Event('change', { bubbles: true }));
      const same = {
        energyLines: document.querySelectorAll('#degeneratePlot [data-degenerate-energy]').length,
        distinct: document.querySelector('#degeneratePlot svg').getAttribute('data-distinct-levels'),
        text: document.getElementById('degenerateReadout').textContent
      };
      document.getElementById('degeneratePreset').value = 'split';
      document.getElementById('degeneratePreset').dispatchEvent(new Event('change', { bubbles: true }));
      const split = { energyLines: document.querySelectorAll('#degeneratePlot [data-degenerate-energy]').length, distinct: document.querySelector('#degeneratePlot svg').getAttribute('data-distinct-levels') };
      document.getElementById('degenerateAlign').click();
      const alignedDegenerate = window.QCApproximationModels.degeneratePerturbation(1, .5, -1, Number(document.getElementById('degenerateAngle').value));
      document.getElementById('seriesG').value = '.4';
      document.getElementById('seriesG').dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('seriesBest').click();
      const best = window.QCApproximationModels.asymptoticSeriesModel(.4, Number(document.getElementById('seriesOrder').value), 14);
      document.getElementById('errorCase').value = 'cancellation';
      document.getElementById('errorCase').dispatchEvent(new Event('change', { bubbles: true }));
      document.getElementById('residualTheta').value = '80';
      document.getElementById('residualTheta').dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('residualMix').value = '90';
      document.getElementById('residualMix').dispatchEvent(new Event('input', { bubbles: true }));
      const unavailable = document.getElementById('residualReadout').textContent;
      document.getElementById('residualGround').click();
      return {
        rayleighResidual: rayleigh.residualNorm,
        gaussianAlpha: Number(document.getElementById('gaussianAlpha').value),
        basisText: document.getElementById('basisReadout').textContent,
        overlapText: document.getElementById('overlapReadout').textContent,
        same, split,
        alignedDegenerateResidual: alignedDegenerate.offDiagonalResidual,
        selectedOrder: Number(document.getElementById('seriesOrder').value),
        bestOrder: best.bestOrder,
        seriesText: document.getElementById('seriesReadout').textContent,
        errorText: document.getElementById('errorReadout').textContent,
        unavailable,
        groundText: document.getElementById('residualReadout').textContent,
        badMarkup: [...document.querySelectorAll('.approximation-plot svg')].some(svg => /NaN|Infinity|undefined/.test(svg.outerHTML))
      };
    })()`);
    assert(instruments.rayleighResidual < 2e-7, `Rayleigh minimizer must land on an eigenvector: ${JSON.stringify(instruments)}`);
    assert(instruments.gaussianAlpha === 1, 'Gaussian optimizer must set alpha=1');
    assert(instruments.basisText.includes('external residual=0.000e+0') && instruments.basisText.includes('six-site matrix'), `full finite basis must close its external residual with the finite-model caveat: ${instruments.basisText}`);
    assert(instruments.overlapText.includes('Near-dependence warning') && instruments.overlapText.includes('κ₂=99.00'), `overlap edge must expose conditioning warning: ${instruments.overlapText}`);
    assert(instruments.same.energyLines === 1 && instruments.same.distinct === '1' && instruments.same.text.includes('one true energy line'), `identity perturbation must render one physical energy line: ${JSON.stringify(instruments.same)}`);
    assert(instruments.split.energyLines === 2 && instruments.split.distinct === '2', `split perturbation must render two physical energy lines: ${JSON.stringify(instruments.split)}`);
    assert(instruments.alignedDegenerateResidual < 2e-8, `degenerate-subspace diagonalizer must remove the rotated off-diagonal coupling: ${JSON.stringify(instruments)}`);
    assert(instruments.selectedOrder === instruments.bestOrder && instruments.seriesText.includes('best displayed finite order'), `best-order helper must select the model oracle: ${JSON.stringify(instruments)}`);
    assert(instruments.errorText.includes('Cancellation warning') && instruments.errorText.includes('not statistical uncertainties'), `error ledger must expose cancellation and uncertainty boundary: ${instruments.errorText}`);
    assert(instruments.unavailable.includes('not available') && instruments.groundText.includes('finite-model bracket is [0.000000, 0.000000]'), `residual certificate must turn off above the gap and recover at the ground state: ${JSON.stringify(instruments)}`);
    assert(!instruments.badMarkup, 'all plot updates must remain finite');

    const campaign = await cdp.evaluate(`(() => {
      const cases = {
        'weak-isolated': ['nondegenerate-perturbation', 'coupling-gap-ratio', 'order-stability'],
        'degenerate-pair': ['degenerate-perturbation', 'subspace-offdiagonal', 'basis-invariance'],
        'ground-upper-bound': ['variational-ritz', 'rayleigh-residual', 'nested-convergence'],
        'overlap-collapse': ['generalized-eigenproblem', 'overlap-spectrum', 'threshold-stability'],
        'factorial-tail': ['asymptotic-truncation', 'least-term', 'order-scan']
      };
      return Object.entries(cases).map(([caseId, values]) => {
        const selector = document.getElementById('approxBossCase');
        selector.value = caseId; selector.dispatchEvent(new Event('change', { bubbles: true }));
        document.getElementById('approxBossMethod').value = values[0];
        document.getElementById('approxBossDiagnostic').value = values[1];
        document.getElementById('approxBossEvidence').value = values[2];
        document.getElementById('approxBossAudit').click();
        const feedback = document.getElementById('approxBossFeedback');
        return { caseId, text: feedback.textContent, state: feedback.dataset.state };
      });
    })()`);
    assert(campaign.every(item => item.text.includes('Campaign approved') && item.text.length > 180 && item.state === 'success'), `every boss case must give deep field feedback, a surviving caveat, and a visible success state: ${JSON.stringify(campaign)}`);

    const progress = await cdp.evaluate(`(() => {
      window.localStorage.removeItem(window.ProjectXCAcademy.STORAGE_KEY);
      const buttons = [...document.querySelectorAll('.academy-complete')];
      buttons[5].focus();
      buttons[5].click();
      const focusAfterComplete = document.activeElement === buttons[5];
      buttons[5].click();
      const focusAfterUncomplete = document.activeElement === buttons[5];
      buttons[0].click(); buttons[11].click();
      return {
        chapter: window.ProjectXCAcademy.completedMissions('qc-approximations'),
        foundations: window.ProjectXCAcademy.completedMissions('qc-foundations'),
        text: document.getElementById('chapterProgressText').textContent,
        focusAfterComplete,
        focusAfterUncomplete
      };
    })()`);
    assert(progress.chapter.join(',') === 'approximation-passport,approximation-case-file' && progress.foundations.length === 0 && progress.text === '2 / 12 missions' && progress.focusAfterComplete && progress.focusAfterUncomplete, `chapter progress must use authoritative ids, remain isolated, and preserve activation focus: ${JSON.stringify(progress)}`);

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
      const touchControls = [...document.querySelectorAll('.approximation-game-brief button, .academy-complete, .approximation-game-brief select')].map(node => ({ id: node.id || node.dataset.mission, height: node.getBoundingClientRect().height, left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right }));
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
    console.log('- 12 deep games, ten finite plots, all passport/boss cases, model interactions, isolated progress, and 390×844 internal scrolling: OK');
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
