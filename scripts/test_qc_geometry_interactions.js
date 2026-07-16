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
function assert(condition, message) { checks += 1; if (!condition) throw new Error(message); }

function findChrome() {
  const candidates = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
  for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
  for (const command of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const found = spawnSync('which', [command], { encoding: 'utf8' });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error('Chrome/Chromium is required for Geometry interaction regressions');
}
function availablePort() {
  return new Promise((resolve, reject) => { const probe = net.createServer(); probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const { port } = probe.address(); probe.close(error => error ? reject(error) : resolve(port)); }); });
}
function contentType(filePath) { return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(filePath)] || 'application/octet-stream'; }
function startServer() {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const relative = pathname === '/' ? '/site/qc-geometry.html' : pathname;
    const filePath = path.resolve(root, `.${relative}`);
    if (!filePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) { response.writeHead(404).end('not found'); return; }
    response.writeHead(200, { 'content-type': contentType(filePath), 'cache-control': 'no-store' }); fs.createReadStream(filePath).pipe(response);
  });
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve(server)); });
}
function getJson(url) {
  return new Promise((resolve, reject) => { const request = http.get(url, response => { let body = ''; response.on('data', chunk => { body += chunk; }); response.on('end', () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } }); }); request.once('error', reject); request.setTimeout(1000, () => request.destroy(new Error('request timeout'))); });
}
async function waitForTargets(debugPort, browser) {
  let lastError;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (browser.exitCode !== null) throw new Error(`Chrome exited early with ${browser.exitCode}`);
    try { const targets = await getJson(`http://127.0.0.1:${debugPort}/json/list`); const page = targets.find(target => target.type === 'page'); if (page?.webSocketDebuggerUrl) return page; }
    catch (error) { lastError = error; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Chrome DevTools endpoint did not become ready: ${lastError?.message || 'no page target'}`);
}
function connectCdp(webSocketDebuggerUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketDebuggerUrl); socket.onerror = reject;
    socket.onopen = () => {
      let id = 0; const pending = new Map(); const events = [];
      socket.onmessage = event => { const message = JSON.parse(event.data); if (!message.id) { events.push(message); return; } if (!pending.has(message.id)) return; const operation = pending.get(message.id); pending.delete(message.id); if (message.error) operation.reject(new Error(JSON.stringify(message.error))); else operation.resolve(message.result); };
      const call = (method, params = {}) => new Promise((resolveCall, rejectCall) => { const callId = ++id; pending.set(callId, { resolve: resolveCall, reject: rejectCall }); socket.send(JSON.stringify({ id: callId, method, params })); });
      const evaluate = async expression => { const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
      resolve({ socket, call, evaluate, events });
    };
  });
}
async function waitForInitialization(cdp, mobile = false) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const initialized = await cdp.evaluate("document.readyState === 'complete' && !!window.QCGeometryModels && document.querySelectorAll('.geometry-plot svg').length === 9 && !!document.querySelector('#geometryBossAudit')");
    if (initialized) return true;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Geometry page did not initialize${mobile ? ' at mobile size' : ''}`);
}

async function main() {
  const chrome = findChrome(); const server = await startServer(); const serverPort = server.address().port; const debugPort = await availablePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-verify-geometry-interactions-'));
  let stderr = '';
  const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', `--remote-debugging-port=${debugPort}`, '--remote-debugging-address=127.0.0.1', '--window-size=1440,1000', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  browser.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-8000); });
  let cdp;
  try {
    const target = await waitForTargets(debugPort, browser); cdp = await connectCdp(target.webSocketDebuggerUrl);
    await cdp.call('Page.enable'); await cdp.call('Runtime.enable'); await cdp.call('Log.enable'); await cdp.call('Network.enable'); await cdp.call('Network.setCacheDisabled', { cacheDisabled: true }); await cdp.call('Network.setBlockedURLs', { urls: ['https://cdn.jsdelivr.net/*'] });
    await cdp.call('Page.navigate', { url: `http://127.0.0.1:${serverPort}/site/qc-geometry.html?test=interaction-contracts` }); await waitForInitialization(cdp);

    const structure = await cdp.evaluate(`(() => {
      const ids=[...document.querySelectorAll('[id]')].map(node=>node.id);const duplicated=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))];
      const accessibleName=node=>{if(node.getAttribute('aria-label'))return node.getAttribute('aria-label').trim();const labelled=node.getAttribute('aria-labelledby');if(labelled)return labelled.split(/\\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ').trim();if(node.id){const explicit=document.querySelector('label[for="'+CSS.escape(node.id)+'"]');if(explicit)return explicit.textContent.trim();const wrapping=node.closest('label');if(wrapping)return wrapping.textContent.trim();}return(node.textContent||node.value||node.title||'').trim();};
      const plots=[...document.querySelectorAll('.academy-plot-canvas')].map(plot=>{const described=(plot.getAttribute('aria-describedby')||'').trim().split(/\\s+/).filter(Boolean);const svg=plot.querySelector('svg');return{id:plot.id,role:plot.getAttribute('role'),tabIndex:plot.tabIndex,aria:plot.getAttribute('aria-label'),described,allDescriptionsExist:described.every(id=>!!document.getElementById(id)),svgLabel:svg?.getAttribute('aria-label')||'',badMarkup:/NaN|Infinity|undefined/.test(svg?.outerHTML||'')};});
      return{levels:document.querySelectorAll('.academy-lesson').length,games:document.querySelectorAll('.lab-grid').length,missions:document.querySelectorAll('.academy-complete[data-mission]').length,plots,keys:document.querySelectorAll('.academy-plot-key').length,duplicated,unnamedControls:[...document.querySelectorAll('input,select,button')].filter(node=>!accessibleName(node)).map(node=>node.id||node.outerHTML.slice(0,60)),documentOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,sourceLinks:document.querySelectorAll('.source-list a[href^="https://"]').length};
    })()`);
    assert(structure.levels === 10 && structure.games === 10 && structure.missions === 10, `10-level/10-game/10-mission contract failed: ${JSON.stringify(structure)}`);
    assert(structure.plots.length === 9 && structure.keys === 9 && structure.sourceLinks >= 5, `plot/key/source contract failed: ${JSON.stringify(structure)}`);
    assert(structure.duplicated.length === 0 && structure.unnamedControls.length === 0, `id/accessibility contract failed: ${JSON.stringify(structure)}`);
    assert(structure.plots.every(plot => plot.role === 'region' && plot.tabIndex === 0 && plot.aria && plot.described.length >= 2 && plot.allDescriptionsExist && plot.svgLabel && !plot.badMarkup), `plot semantics failed: ${JSON.stringify(structure.plots)}`);
    assert(structure.documentOverflow <= 1, `desktop page must not overflow horizontally: ${structure.documentOverflow}`);

    const oracleIds = ['pesOracleKey','gradientOracleKey','validationOracleKey','optimizationOracleKey','trustOracleKey','hessianOracleKey','modesOracleKey','stationaryOracleKey','ircOracleKey'];
    const publicAllowlist = ['vectorNorm','symmetricEigen2','quadraticSurface','directionalDerivative','stationaryGradientLedger','polynomialEnergy','polynomialDerivative','centralDifferenceDerivative','optimizationStep','predictedQuadraticChange','trustRatio','bfgsUpdate','finiteDifferenceHessian2','hessianInertia','massWeightedHessian','normalModes2','stationaryPointAudit','zpeKcalMol','doubleWellSurface','traceIrc','auditIrcEndpoints','zpeCorrectedBarrier'].sort();
    const initial = await cdp.evaluate(`(() => {
      const select=document.getElementById('pesCase');const before=document.getElementById('pesPlot').innerHTML;select.value='surface-b';select.dispatchEvent(new Event('change',{bubbles:true}));const changed=before!==document.getElementById('pesPlot').innerHTML;select.value='surface-a';select.dispatchEvent(new Event('change',{bubbles:true}));
      return{disabled:[...document.querySelectorAll('.academy-complete[data-game-gate]')].filter(b=>b.disabled).length,lockedLabels:[...document.querySelectorAll('.academy-complete[data-game-gate]')].filter(b=>b.textContent.startsWith('Locked seal')).length,progress:document.getElementById('chapterProgressText').textContent,notebook:document.querySelectorAll('#geometryNotebookList article').length,storage:localStorage.getItem('project-xc-geometry-games-v1'),publicKeys:Object.keys(window.QCGeometryModels||{}),publicSource:Object.entries(window.QCGeometryModels||{}).map(([k,v])=>k+'\\n'+String(v)).join('\\n'),visibleOracles:${JSON.stringify(oracleIds)}.filter(id=>{const n=document.getElementById(id);return n&&n.getClientRects().length>0;}),bossLocked:document.getElementById('geometryBossTarget').disabled&&document.getElementById('geometryBossAudit').disabled,plotChanged:changed,constraints:{gradient:document.getElementById('gradientConstraint').textContent,stationary:document.getElementById('stationaryConstraint').textContent,irc:document.getElementById('ircConstraint').textContent}};
    })()`);
    assert(initial.disabled === 10 && initial.lockedLabels === 10 && initial.progress.includes('0 / 10') && initial.notebook === 0 && initial.storage === null && initial.bossLocked, `fresh chapter state failed: ${JSON.stringify(initial)}`);
    assert(JSON.stringify(initial.publicKeys.sort()) === JSON.stringify(publicAllowlist) && !/DOSSIER|CASE_FILES|evaluatePesMission|evaluateGeometryCase|expectedAnswer|answerKey|bossRoutes/.test(initial.publicSource), `answer-free public API failed: ${JSON.stringify(initial.publicKeys)}`);
    assert(initial.visibleOracles.length === 0 && initial.plotChanged, `precommit oracle/dossier differentiation failed: ${JSON.stringify(initial)}`);
    assert(/Pulay|SCF residual/.test(initial.constraints.gradient) && /expected modes|zero tolerance/.test(initial.constraints.stationary) && /negative modes|imaginary mode/.test(initial.constraints.irc), `scientific constraints must be visible precommit: ${JSON.stringify(initial.constraints)}`);
    const shipped = await cdp.evaluate(`fetch('assets/qc-geometry.js').then(r=>r.text()).then(text=>({leaked:/\\b(?:EXPECTED|ANSWER_MAP|BOSS_ROUTES)\\b|\\bexpected\\s*:|\\banswerKey\\s*:/.test(text),bytes:text.length}))`);
    assert(!shipped.leaked && shipped.bytes > 30000, `shipped grading must derive from algebra, not answer maps: ${JSON.stringify(shipped)}`);

    await cdp.evaluate(`localStorage.setItem('project-xc-geometry-games-v1',JSON.stringify({version:2,pes:[{id:'surface-a',choice:'positive-q1',fingerprint:'forged'}],gradient:7,validation:null,optimization:false,trust:'bad',hessian:[],modes:[],stationary:[],irc:[],boss:{cleared:['geometry-case-a'],stage:{'geometry-case-a':3},answers:{'geometry-case-a':['minimum-optimization','gradient-and-hessian','tight-gradient-positive-modes-fd']},fingerprints:{'geometry-case-a':'forged'}}}))`);
    await cdp.call('Page.reload', { ignoreCache: true }); await waitForInitialization(cdp);
    const malformed = await cdp.evaluate(`({disabled:[...document.querySelectorAll('.academy-complete')].filter(b=>b.disabled).length,notebook:document.querySelectorAll('#geometryNotebookList article').length,plots:document.querySelectorAll('.geometry-plot svg').length,bossStage:document.getElementById('geometryBossStage').textContent,bossArtifact:document.getElementById('geometryBossArtifact').textContent})`);
    assert(malformed.disabled === 10 && malformed.notebook === 0 && malformed.plots === 9 && /Stage 1 \/ 3/.test(malformed.bossStage) && /Earn Levels/.test(malformed.bossArtifact), `malformed storage recovery failed: ${JSON.stringify(malformed)}`);
    await cdp.evaluate(`localStorage.removeItem('project-xc-geometry-games-v1')`);

    await cdp.evaluate(`(()=>{const b=document.querySelector('[data-mission="pes-forces"]');b.disabled=false;b.dataset.gameGate='earned';b.click();})()`); await new Promise(resolve=>setTimeout(resolve,50));
    const forgedSeal = await cdp.evaluate(`(()=>{const b=document.querySelector('[data-mission="pes-forces"]');return{disabled:b.disabled,gate:b.dataset.gameGate,canonical:window.ProjectXCAcademy.completedMissions('qc-geometry')};})()`);
    assert(forgedSeal.disabled && forgedSeal.gate === 'locked' && forgedSeal.canonical.length === 0, `manually re-enabled seal bypassed gate: ${JSON.stringify(forgedSeal)}`);
    await cdp.evaluate(`window.ProjectXCAcademy.setMission('qc-geometry','pes-forces',true)`); await new Promise(resolve=>setTimeout(resolve,50));
    const forgedCanonical = await cdp.evaluate(`(()=>{const b=document.querySelector('[data-mission="pes-forces"]');return{disabled:b.disabled,canonical:window.ProjectXCAcademy.completedMissions('qc-geometry')};})()`);
    assert(forgedCanonical.disabled && !forgedCanonical.canonical.includes('pes-forces'), `canonical forgery not rejected: ${JSON.stringify(forgedCanonical)}`);

    const storageBlock = await cdp.call('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('storage blocked for test','SecurityError');}});` });
    await cdp.call('Page.reload', { ignoreCache: true }); await waitForInitialization(cdp);
    const blocked = await cdp.evaluate(`({disabled:[...document.querySelectorAll('.academy-complete')].filter(b=>b.disabled).length,plots:document.querySelectorAll('.geometry-plot svg').length,progress:document.getElementById('chapterProgressText').textContent})`);
    assert(blocked.disabled === 10 && blocked.plots === 9 && blocked.progress.includes('0 / 10'), `blocked storage recovery failed: ${JSON.stringify(blocked)}`);
    await cdp.call('Page.removeScriptToEvaluateOnNewDocument', { identifier: storageBlock.identifier }); await cdp.call('Page.reload', { ignoreCache: true }); await waitForInitialization(cdp);

    const depthRun = await cdp.evaluate(`(() => {
      const set=(id,value)=>{const n=document.getElementById(id);n.value=String(value);n.dispatchEvent(new Event('change',{bubbles:true}));};
      const record=mission=>{const b=document.querySelector('[data-mission="'+mission+'"]');const unlocked=!b.disabled;b.focus();b.click();return{mission,unlocked,focused:document.activeElement===b};};
      const result={records:[]};const run=(caseControl,decisionControl,auditControl,cases,mission)=>{for(const [caseId,answer] of Object.entries(cases)){set(caseControl,caseId);set(decisionControl,answer);document.getElementById(auditControl).click();}result.records.push(record(mission));};
      set('pesDecision','stationary');document.getElementById('pesAudit').focus();document.getElementById('pesAudit').click();result.wrong={unlocked:!document.querySelector('[data-mission="pes-forces"]').disabled,text:document.getElementById('pesReadout').textContent,oracle:getComputedStyle(document.getElementById('pesOracleKey')).display,focus:document.activeElement===document.getElementById('pesAudit')};
      run('pesCase','pesDecision','pesAudit',{'surface-a':'positive-q1','surface-b':'negative-q2','surface-c':'stationary'},'pes-forces');
      run('gradientCase','gradientDecision','gradientAudit',{'gradient-a':'include-pulay','gradient-b':'stationary-explicit-complete','gradient-c':'reconverge-electronic-state'},'analytic-gradient');
      run('validationCase','validationDecision','validationAudit',{'validation-a':'validated-window','validation-b':'step-too-large','validation-c':'step-too-small'},'gradient-validation');
      run('optimizationCase','optimizationDecision','optimizationAudit',{'optimization-a':'trust-newton','optimization-b':'steepest-descent','optimization-c':'reject-indefinite-model'},'geometry-optimization');
      run('trustCase','trustDecision','trustAudit',{'trust-a':'accept-expand-bfgs','trust-b':'skip-bfgs','trust-c':'reject-shrink'},'trust-bfgs');
      run('hessianCase','hessianDecision','hessianAudit',{'hessian-a':'positive-definite','hessian-b':'one-negative-mode','hessian-c':'reject-asymmetric','hessian-d':'unresolved-near-zero'},'hessian-curvature');
      run('modesCase','modesDecision','modesAudit',{'modes-a':'translation-stretch','modes-b':'heavier-isotope-lowers-frequency','modes-c':'reject-masses'},'normal-modes');
      run('stationaryCase','stationaryDecision','stationaryAudit',{'stationary-a':'minimum','stationary-b':'first-order-saddle','stationary-c':'higher-order-saddle','stationary-d':'unresolved-near-zero','stationary-e':'invalid-mode-count'},'stationary-points');
      run('ircCase','ircDecision','ircAudit',{'irc-a':'validated-irc','irc-b':'higher-order-saddle','irc-c':'trace-both-directions'},'transition-state-irc');
      result.preBoss=JSON.parse(localStorage.getItem('project-xc-geometry-games-v1'));
      set('geometryBossTarget','transition-state-search');for(let i=0;i<4;i+=1)document.getElementById('geometryBossAudit').click();result.bossRecovery={stage:document.getElementById('geometryBossStage').textContent,budget:document.getElementById('geometryBossBudget').textContent,target:document.getElementById('geometryBossTarget').value,diagnosticDisabled:document.getElementById('geometryBossDiagnostic').disabled,feedback:document.getElementById('geometryBossFeedback').textContent};
      set('geometryBossTarget','minimum-optimization');document.getElementById('geometryBossAudit').click();set('geometryBossDiagnostic','gradient-and-hessian');document.getElementById('geometryBossAudit').click();result.partial={target:document.getElementById('geometryBossTarget').value,targetDisabled:document.getElementById('geometryBossTarget').disabled,diagnostic:document.getElementById('geometryBossDiagnostic').value,diagnosticDisabled:document.getElementById('geometryBossDiagnostic').disabled,evidenceDisabled:document.getElementById('geometryBossEvidence').disabled};
      set('geometryBossCase','geometry-case-b');set('geometryBossCase','geometry-case-a');result.partialRestore={target:document.getElementById('geometryBossTarget').value,targetDisabled:document.getElementById('geometryBossTarget').disabled,diagnostic:document.getElementById('geometryBossDiagnostic').value,diagnosticDisabled:document.getElementById('geometryBossDiagnostic').disabled,evidenceDisabled:document.getElementById('geometryBossEvidence').disabled};document.getElementById('geometryResetBossCase').click();
      const boss={'geometry-case-a':['minimum-optimization','gradient-and-hessian','tight-gradient-positive-modes-fd'],'geometry-case-b':['transition-state-search','one-imaginary-reaction-mode','two-sided-irc-endpoints'],'geometry-case-c':['frequency-recheck','near-zero-mode-contamination','tighter-grid-projection-repeat']};
      for(const [caseId,route] of Object.entries(boss)){set('geometryBossCase',caseId);set('geometryBossTarget',route[0]);document.getElementById('geometryBossAudit').click();set('geometryBossDiagnostic',route[1]);document.getElementById('geometryBossAudit').click();set('geometryBossEvidence',route[2]);document.getElementById('geometryBossAudit').click();}
      result.boss={score:document.getElementById('geometryBossScore').textContent,unlocked:!document.querySelector('[data-mission="geometry-case-file"]').disabled,artifact:document.getElementById('geometryBossArtifact').textContent};result.records.push(record('geometry-case-file'));
      result.final={progress:document.getElementById('chapterProgressText').textContent,notebook:document.querySelectorAll('#geometryNotebookList article').length,stored:JSON.parse(localStorage.getItem('project-xc-geometry-games-v1')),canonical:window.ProjectXCAcademy.completedMissions('qc-geometry')};return result;
    })()`);
    assert(!depthRun.wrong.unlocked && /Decision rejected/.test(depthRun.wrong.text) && depthRun.wrong.oracle !== 'none' && depthRun.wrong.focus, `wrong commitment/focus contract failed: ${JSON.stringify(depthRun.wrong)}`);
    assert(depthRun.records.every(item=>item.unlocked&&item.focused), `every earned seal must unlock and retain focus: ${JSON.stringify(depthRun.records)}`);
    assert(/Stage 1 \/ 3/.test(depthRun.bossRecovery.stage) && /4 attempts/.test(depthRun.bossRecovery.budget) && depthRun.bossRecovery.target === '' && depthRun.bossRecovery.diagnosticDisabled && /dossier reset/.test(depthRun.bossRecovery.feedback), `boss recovery failed: ${JSON.stringify(depthRun.bossRecovery)}`);
    assert(depthRun.partial.target === 'minimum-optimization' && depthRun.partial.targetDisabled && depthRun.partial.diagnostic === 'gradient-and-hessian' && depthRun.partial.diagnosticDisabled && !depthRun.partial.evidenceDisabled, `boss stage lock failed: ${JSON.stringify(depthRun.partial)}`);
    assert(JSON.stringify(depthRun.partial) === JSON.stringify(depthRun.partialRestore), `boss case-switch restore failed: ${JSON.stringify(depthRun.partialRestore)}`);
    assert(depthRun.boss.unlocked && /3 \/ 3/.test(depthRun.boss.score) && /method\/basis\/environment caveat/.test(depthRun.boss.artifact), `three-stage boss failed: ${JSON.stringify(depthRun.boss)}`);
    assert(depthRun.final.progress.includes('10 / 10') && depthRun.final.notebook === 10 && depthRun.final.canonical.length === 10, `full chapter progress failed: ${JSON.stringify(depthRun.final)}`);
    assert(depthRun.final.stored.pes.length === 3 && depthRun.final.stored.hessian.length === 4 && depthRun.final.stored.stationary.length === 5 && depthRun.final.stored.boss.cleared.length === 3, 'versioned storage must retain all predicates');

    await cdp.call('Page.reload', { ignoreCache: true }); await waitForInitialization(cdp);
    const persisted = await cdp.evaluate(`({progress:document.getElementById('chapterProgressText').textContent,notebook:document.querySelectorAll('#geometryNotebookList article').length,earned:[...document.querySelectorAll('.academy-complete')].filter(b=>b.dataset.gameGate==='earned').length,boss:document.getElementById('geometryBossScore').textContent})`);
    assert(persisted.progress.includes('10 / 10') && persisted.notebook === 10 && persisted.earned === 10 && /3 \/ 3/.test(persisted.boss), `reload persistence failed: ${JSON.stringify(persisted)}`);

    await cdp.evaluate(`(()=>{const state=JSON.parse(localStorage.getItem('project-xc-geometry-games-v1'));state.boss.cleared=[];state.boss.stage={'geometry-case-a':3};state.boss.answers={'geometry-case-a':['minimum-optimization','gradient-and-hessian','tight-gradient-positive-modes-fd']};localStorage.setItem('project-xc-geometry-games-v1',JSON.stringify(state));})()`); await cdp.call('Page.reload', { ignoreCache: true }); await waitForInitialization(cdp);
    const inconsistent = await cdp.evaluate(`(()=>{const seal=document.querySelector('[data-mission="geometry-case-file"]');return{stage:document.getElementById('geometryBossStage').textContent,target:document.getElementById('geometryBossTarget').value,targetDisabled:document.getElementById('geometryBossTarget').disabled,sealDisabled:seal.disabled,canonical:window.ProjectXCAcademy.completedMissions('qc-geometry')};})()`);
    assert(/Stage 1 \/ 3/.test(inconsistent.stage) && inconsistent.target === '' && !inconsistent.targetDisabled && inconsistent.sealDisabled && !inconsistent.canonical.includes('geometry-case-file'), `inconsistent stage-3 state must revoke mastery: ${JSON.stringify(inconsistent)}`);

    const reset = await cdp.evaluate(`(()=>{window.ProjectXCAcademy.setMission('qc-foundations','scale',true);localStorage.setItem('project-xc-basis-quest-badges-v2',JSON.stringify(['orbital-alphabet']));document.getElementById('resetChapterProgress').click();const defaults={pesCase:'surface-a',pesDecision:'',gradientCase:'gradient-a',gradientDecision:'',validationCase:'validation-a',validationDecision:'',optimizationCase:'optimization-a',optimizationDecision:'',trustCase:'trust-a',trustDecision:'',hessianCase:'hessian-a',hessianDecision:'',modesCase:'modes-a',modesDecision:'',stationaryCase:'stationary-a',stationaryDecision:'',ircCase:'irc-a',ircDecision:'',geometryBossCase:'geometry-case-a',geometryBossTarget:'',geometryBossDiagnostic:'',geometryBossEvidence:''};return{disabled:[...document.querySelectorAll('.academy-complete')].filter(b=>b.disabled).length,locked:[...document.querySelectorAll('.academy-complete')].filter(b=>b.textContent.startsWith('Locked seal')).length,progress:document.getElementById('chapterProgressText').textContent,notebook:document.querySelectorAll('#geometryNotebookList article').length,gameStorage:localStorage.getItem('project-xc-geometry-games-v1'),canonical:window.ProjectXCAcademy.completedMissions('qc-geometry'),foundation:window.ProjectXCAcademy.completedMissions('qc-foundations'),basis:localStorage.getItem('project-xc-basis-quest-badges-v2'),visibleOracles:${JSON.stringify(oracleIds)}.filter(id=>{const n=document.getElementById(id);return n&&getComputedStyle(n).display!=='none';}),defaults:Object.fromEntries(Object.keys(defaults).map(id=>[id,document.getElementById(id).value])),expectedDefaults:defaults,successReadouts:[...document.querySelectorAll('.game-result[data-state="success"]')].map(n=>n.id),bossStage:document.getElementById('geometryBossStage').textContent,bossTargetDisabled:document.getElementById('geometryBossTarget').disabled};})()`);
    assert(reset.disabled === 10 && reset.locked === 10 && reset.progress.includes('0 / 10') && reset.notebook === 0, `reset must relock chapter: ${JSON.stringify(reset)}`);
    assert(reset.gameStorage === null && reset.canonical.length === 0 && reset.foundation.includes('scale') && reset.basis.includes('orbital-alphabet'), `reset isolation failed: ${JSON.stringify(reset)}`);
    assert(reset.visibleOracles.length === 0 && reset.successReadouts.length === 0 && JSON.stringify(reset.defaults) === JSON.stringify(reset.expectedDefaults), `reset defaults failed: ${JSON.stringify(reset)}`);
    assert(/Stage 1 \/ 3/.test(reset.bossStage) && reset.bossTargetDisabled, `boss reset view failed: ${JSON.stringify(reset)}`);

    const keyboard = await cdp.evaluate(`(()=>{const buttons=[...document.querySelectorAll('.academy-lesson-nav button')];buttons[0].focus();buttons[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,repeat:true}));const repeatStayed=document.activeElement===buttons[0];buttons[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,repeat:false}));return{repeatStayed,moved:document.activeElement===buttons[1]};})()`);
    assert(keyboard.repeatStayed && keyboard.moved, `keyboard navigation failed: ${JSON.stringify(keyboard)}`);
    await cdp.call('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    const reduced = await cdp.evaluate(`(()=>{const s=getComputedStyle(document.querySelector('.academy-lesson'));return{transition:parseFloat(s.transitionDuration)||0,animation:parseFloat(s.animationDuration)||0};})()`);
    assert(reduced.transition <= 0.00001 && reduced.animation <= 0.00001, `reduced-motion failed: ${JSON.stringify(reduced)}`);

    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await cdp.call('Page.reload', { ignoreCache: true }); await waitForInitialization(cdp, true);
    const mobile = await cdp.evaluate(`(()=>{const viewport=document.documentElement.clientWidth;const pageX=window.scrollX;const offenders=[...document.querySelectorAll('body *')].filter(n=>!n.closest('.academy-plot-canvas')).map(n=>{const r=n.getBoundingClientRect();return{tag:n.tagName,id:n.id,classes:n.className?.baseVal||n.className||'',right:r.right+pageX};}).filter(x=>x.right>viewport+1).slice(0,30);const plots=[...document.querySelectorAll('.academy-plot-canvas')].map(n=>{const before=n.scrollLeft;const figure=n.closest('.geometry-plot');const style=getComputedStyle(n);n.scrollLeft=n.scrollWidth;return{id:n.id,client:n.clientWidth,scroll:n.scrollWidth,moved:n.scrollLeft>before,overflowX:style.overflowX,overflowY:style.overflowY,contain:style.contain,figureClient:figure.clientWidth,figureScroll:figure.scrollWidth};});const visible=[...document.querySelectorAll('button,input,select,a.button')].filter(n=>{const r=n.getBoundingClientRect();const s=getComputedStyle(n);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';});const undersized=visible.map(n=>{const r=n.getBoundingClientRect();return{id:n.id||n.textContent.trim().slice(0,30),w:r.width,h:r.height};}).filter(x=>x.h<44||x.w<44);return{innerWidth:window.innerWidth,clientWidth:document.documentElement.clientWidth,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,plots,undersized,offenders};})()`);
    assert(mobile.innerWidth === 390 && mobile.clientWidth <= 390 && mobile.overflow <= 1, `390x844 viewport overflow failed: ${JSON.stringify(mobile)}`);
    assert(mobile.plots.length === 9 && mobile.plots.every(plot=>plot.scroll>plot.client&&plot.moved&&plot.overflowX==='auto'), `all nine plots must scroll internally: ${JSON.stringify(mobile.plots)}`);
    assert(mobile.undersized.length === 0, `mobile touch targets failed: ${JSON.stringify(mobile.undersized)}`);
    if (process.env.GEOMETRY_SCREENSHOT_PATH) { await cdp.evaluate('window.scrollTo(0,0)'); const capture=await cdp.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true}); fs.writeFileSync(process.env.GEOMETRY_SCREENSHOT_PATH,Buffer.from(capture.data,'base64')); }

    const severe = cdp.events.filter(event => event.method === 'Runtime.exceptionThrown' || (event.method === 'Log.entryAdded' && ['error','warning'].includes(event.params?.entry?.level) && !String(event.params?.entry?.url || '').includes('cdn.jsdelivr.net') && !String(event.params?.entry?.url || '').endsWith('/favicon.ico')));
    assert(severe.length === 0, `browser emitted runtime/severe events: ${JSON.stringify(severe.slice(-6))}`);
    console.log('Project XC Geometry, Gradients, and Frequencies interaction tests OK'); console.log(`- browser assertions: ${checks}`); console.log('- 10 earned games, nine finite plots, 30 neutral dossiers, nine boss stages, replay/reset/forgery/accessibility/keyboard/mobile contracts: OK');
  } catch (error) {
    if (stderr) console.error(`Chrome stderr (tail):\n${stderr}`); throw error;
  } finally {
    try { cdp?.socket.close(); } catch (_error) { /* ignore */ }
    server.close(); if (browser.exitCode === null) browser.kill('SIGTERM'); await new Promise(resolve => setTimeout(resolve, 300)); if (browser.exitCode === null) browser.kill('SIGKILL');
    for (let attempt=0;attempt<5;attempt+=1){try{fs.rmSync(profile,{recursive:true,force:true});break;}catch(error){if(attempt===4)throw error;await new Promise(resolve=>setTimeout(resolve,100));}}
  }
}
main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
