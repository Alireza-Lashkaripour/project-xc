#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

if (typeof globalThis.WebSocket !== 'function') {
  if (process.env.PROJECT_XC_WEBSOCKET_REEXEC === '1') {
    throw new Error('Node must provide the built-in WebSocket client (Node 20 with --experimental-websocket, or Node 21+)');
  }
  const rerun = spawnSync(process.execPath, ['--experimental-websocket', __filename, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, PROJECT_XC_WEBSOCKET_REEXEC: '1' }
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
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  for (const command of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const found = spawnSync('which', [command], { encoding: 'utf8' });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required for Atomic Structure interaction regressions');
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
  return ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png'
  })[path.extname(filePath)] || 'application/octet-stream';
}

function startServer() {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const relative = pathname === '/' ? '/site/qc-atoms.html' : pathname;
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
      response.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
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
    } catch (error) {
      lastError = error;
    }
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
      socket.onmessage = event => {
        const message = JSON.parse(event.data);
        if (!message.id || !pending.has(message.id)) return;
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
      resolve({ socket, call, evaluate });
    };
  });
}

async function press(call, key, code, keyCode, { autoRepeat = false } = {}) {
  const down = { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, autoRepeat };
  if (key === 'Enter') Object.assign(down, { text: '\r', unmodifiedText: '\r' });
  await call('Input.dispatchKeyEvent', down);
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
}

async function main() {
  const chrome = findChrome();
  const server = await startServer();
  const serverPort = server.address().port;
  const debugPort = await availablePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'project-xc-atomic-interactions-'));
  let stderr = '';
  const browser = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', `--remote-debugging-port=${debugPort}`, '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${profile}`, 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  browser.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-8000); });

  let cdp;
  try {
    const target = await waitForTargets(debugPort, browser);
    cdp = await connectCdp(target.webSocketDebuggerUrl);
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
    await cdp.call('Network.enable');
    await cdp.call('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.call('Network.setBlockedURLs', { urls: ['https://cdn.jsdelivr.net/*'] });
    await cdp.call('Page.navigate', { url: `http://127.0.0.1:${serverPort}/site/qc-atoms.html?test=interaction-contracts` });
    let initialized = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      initialized = await cdp.evaluate("document.readyState === 'complete' && !!window.QCAtomicModels && !!document.querySelector('.electron-box') && !!document.querySelector('#finePlot svg')");
      if (initialized) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(initialized, 'Atomic Structure page must initialize without external network access');

    const initial = await cdp.evaluate(`(() => {
      const button = document.querySelector('.electron-box');
      button.focus();
      return { identity: button.dataset.shell + ':' + button.dataset.box, state: button.textContent, focused: document.activeElement === button };
    })()`);
    assert(initial.focused, 'forge button must accept keyboard focus');
    await press(cdp.call, ' ', 'Space', 32);
    await new Promise(resolve => setTimeout(resolve, 50));
    const afterSpace = await cdp.evaluate(`(() => {
      const active = document.activeElement;
      return { identity: active?.dataset?.shell + ':' + active?.dataset?.box, state: active?.textContent, isBox: active?.classList?.contains('electron-box') || false };
    })()`);
    assert(afterSpace.isBox && afterSpace.identity === initial.identity, 'Space activation must retain focus on the same orbital box');
    assert(initial.state === '·' && afterSpace.state === '↑', `Space activation must advance exactly one orbital-box state: ${JSON.stringify({ initial, afterSpace })}`);
    await press(cdp.call, 'Enter', 'Enter', 13);
    await new Promise(resolve => setTimeout(resolve, 50));
    const afterEnter = await cdp.evaluate(`(() => {
      const active = document.activeElement;
      return { identity: active?.dataset?.shell + ':' + active?.dataset?.box, state: active?.textContent, isBox: active?.classList?.contains('electron-box') || false };
    })()`);
    assert(afterEnter.isBox && afterEnter.identity === initial.identity, 'Enter activation must retain focus on the same orbital box');
    assert(afterEnter.state === '↓', `Enter activation must advance exactly one orbital-box state: ${JSON.stringify({ initial, afterSpace, afterEnter })}`);
    await cdp.evaluate(`(() => {
      window.__forgeRepeatProbe = { seen: false, defaultPrevented: false };
      document.activeElement.addEventListener('keydown', event => {
        if (event.key === 'Enter' && event.repeat) window.__forgeRepeatProbe = { seen: true, defaultPrevented: event.defaultPrevented };
      });
      return true;
    })()`);
    await press(cdp.call, 'Enter', 'Enter', 13, { autoRepeat: true });
    await new Promise(resolve => setTimeout(resolve, 50));
    const afterHeldEnter = await cdp.evaluate(`(() => {
      const active = document.activeElement;
      return { identity: active?.dataset?.shell + ':' + active?.dataset?.box, state: active?.textContent, isBox: active?.classList?.contains('electron-box') || false, repeatProbe: window.__forgeRepeatProbe };
    })()`);
    assert(afterHeldEnter.isBox && afterHeldEnter.identity === initial.identity, 'held Enter must retain focus on the same orbital box');
    assert(afterHeldEnter.state === afterEnter.state, `auto-repeated Enter must not advance the orbital-box state: ${JSON.stringify({ afterEnter, afterHeldEnter })}`);
    assert(afterHeldEnter.repeatProbe.seen && afterHeldEnter.repeatProbe.defaultPrevented, `auto-repeated Enter must always suppress native button activation: ${JSON.stringify(afterHeldEnter)}`);

    const inspectFinePlot = await cdp.evaluate(`(() => {
      const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const inspect = (termValue, aValue) => {
        const term = document.getElementById('fineTerm');
        const slider = document.getElementById('fineA');
        term.value = termValue;
        term.dispatchEvent(new Event('change', { bubbles: true }));
        slider.value = String(aValue);
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        const labels = [...document.querySelectorAll('#finePlot [data-j-label]')];
        const labelRects = labels.map(node => ({ text: node.textContent, y: Number(node.getAttribute('y')), ...node.getBoundingClientRect().toJSON() }));
        const labelEnds = labels.map(node => { const box = node.getBBox(); return box.x + box.width; });
        const lineStarts = [...document.querySelectorAll('#finePlot [data-energy-group]')].map(node => Number(node.getAttribute('x1')));
        const baryNode = [...document.querySelectorAll('#finePlot text')].find(node => node.textContent.startsWith('term barycenter'));
        const baryRect = baryNode.getBoundingClientRect().toJSON();
        const baryGuide = document.querySelector('#finePlot [data-barycenter-guide]');
        const pairOverlap = labelRects.some((rect, index) => labelRects.slice(index + 1).some(other => intersects(rect, other)));
        return {
          energyLines: document.querySelectorAll('#finePlot [data-energy-group]').length,
          labels: labelRects,
          labelLineGap: Math.min(...lineStarts) - Math.max(...labelEnds),
          uniqueLabelY: new Set(labelRects.map(rect => rect.y)).size,
          pairOverlap,
          baryText: baryNode.textContent,
          baryOverlap: labelRects.some(rect => intersects(rect, baryRect)),
          baryGuideKind: baryGuide.getAttribute('data-barycenter-guide'),
          sameEnergyKey: document.getElementById('finePlotKey').textContent.includes('same E'),
          sameEnergyBracket: [...document.querySelectorAll('#finePlot text')].some(node => node.textContent.startsWith('same E ×')),
          markerY: [...document.querySelectorAll('#finePlot circle')].map(node => Number(node.getAttribute('cy'))),
          documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      };
      return { zeroTriplet: inspect('1,2', 0), quartetS: inspect('0,3', 100), ordinaryTriplet: inspect('1,2', 100) };
    })()`);

    const zero = inspectFinePlot.zeroTriplet;
    assert(zero.energyLines === 1 && zero.labels.length === 3, 'A=0 3P must render one true-energy line with three J labels');
    assert(zero.uniqueLabelY === 3 && !zero.pairOverlap, 'A=0 3P J labels must be stacked without overlap');
    assert(zero.labelLineGap >= 10, 'A=0 3P energy line must remain clear of every J label');
    assert(zero.sameEnergyBracket && zero.sameEnergyKey, 'A=0 3P must explain coincident J energies with a same-E bracket and HTML key');
    assert(new Set(zero.markerY).size === 1, 'A=0 3P markers must remain on the same physical energy line');
    assert(!zero.baryOverlap && zero.baryText.includes('same E') && zero.baryGuideKind === 'coincident', `A=0 barycenter must use a separate coincident-energy leader rather than cross the J labels: ${JSON.stringify(zero)}`);

    const quartet = inspectFinePlot.quartetS;
    assert(quartet.energyLines === 1 && quartet.labels.length === 1, '4S must render one true-energy line and one J label');
    assert(quartet.labelLineGap >= 10, '4S energy line must remain clear of its J label');
    assert(!quartet.baryOverlap && quartet.baryText.includes('same E') && quartet.baryGuideKind === 'coincident', '4S barycenter must use a separate coincident-energy leader rather than cross its J label');

    const ordinary = inspectFinePlot.ordinaryTriplet;
    assert(ordinary.energyLines === 3 && ordinary.labels.length === 3, 'ordinary 3P must render three distinct energy lines');
    assert(ordinary.labelLineGap >= 10, 'ordinary 3P energy lines must remain clear of signed shift labels');
    assert(!ordinary.pairOverlap && !ordinary.baryOverlap, 'ordinary 3P labels and barycenter must not overlap');
    assert(ordinary.baryGuideKind === 'distinct', 'ordinary 3P must retain its distinct dotted barycenter line');
    assert(ordinary.documentOverflow <= 1, 'interaction regressions must not introduce page-level horizontal overflow');

    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await cdp.call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp.call('Page.reload', { ignoreCache: true });
    let mobileInitialized = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      mobileInitialized = await cdp.evaluate("document.readyState === 'complete' && !!window.QCAtomicModels && !!document.querySelector('#finePlot svg')");
      if (mobileInitialized) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(mobileInitialized, 'Atomic Structure page must initialize at the canonical 390×844 mobile viewport');
    const mobile = await cdp.evaluate(`(() => {
      const plot = document.getElementById('finePlot');
      const bounds = plot.getBoundingClientRect();
      const style = getComputedStyle(plot);
      plot.focus();
      plot.scrollLeft = plot.scrollWidth;
      return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        plotClientWidth: plot.clientWidth,
        plotScrollWidth: plot.scrollWidth,
        plotScrollLeft: plot.scrollLeft,
        plotLeft: bounds.left,
        plotRight: bounds.right,
        overflowX: style.overflowX,
        focused: document.activeElement === plot,
        maxTouchPoints: navigator.maxTouchPoints
      };
    })()`);
    assert(mobile.innerWidth === 390 && mobile.innerHeight === 844 && mobile.documentClientWidth === 390, `mobile emulation must expose the canonical 390×844 viewport: ${JSON.stringify(mobile)}`);
    assert(mobile.documentScrollWidth - mobile.documentClientWidth <= 1, `mobile plot must not create document-level horizontal overflow: ${JSON.stringify(mobile)}`);
    assert(mobile.plotScrollWidth > mobile.plotClientWidth && mobile.plotScrollLeft > 0, `mobile fine-structure plot must retain intentional internal horizontal scrolling: ${JSON.stringify(mobile)}`);
    assert(mobile.plotLeft >= 0 && mobile.plotRight <= mobile.innerWidth && ['auto', 'scroll'].includes(mobile.overflowX), `mobile plot scroller must remain contained in the viewport: ${JSON.stringify(mobile)}`);
    assert(mobile.focused && mobile.maxTouchPoints > 0, `mobile plot scroller must stay keyboard-focusable with touch emulation enabled: ${JSON.stringify(mobile)}`);

    console.log('Project XC Atomic Structure interaction tests OK');
    console.log(`- browser assertions: ${checks}`);
    console.log('- repeat-safe keyboard focus, A=0/4S grouping, ordinary ladder, and 390×844 internal plot scrolling: OK');
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
