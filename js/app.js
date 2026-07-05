/* =====================================================================
   Hales–Jewett Explorer — application layer
   (math lives in HJ, spliced above; rendering with three.js r128)
   ===================================================================== */
'use strict';
(function () {

const PALETTE = ['#e69f00', '#56b4e9', '#009e73', '#f0e442', '#cc79a7', '#d55e00'];
const FAMNAME = { comb: 'combinatorial', unit: 'unit-cyclic', geom: 'geometric', cyc: 'cyclic' };
const SUP = n => ({1: '¹', 2: '²', 3: '³'})[n] || ('^' + n);
const $ = id => document.getElementById(id);
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- state
const S = {
  t: 3, n: 3, r: 2,
  family: 'comb',
  restrict: 'all', K: 1, q: 1,
  display: 'all',                 // mono | all | hover | none
  paint: 0, orbitPaint: false,
  col: [],                        // colouring, length t^n
  info: { kind: 'random', desc: 'random', omega: null, chi: null },
  regen: null,                    // (t,n,r) => {col, info} | null
};
const lineCache = new Map();
function familyLines(fam) {
  const key = S.t + '|' + S.n + '|' + fam;
  if (!lineCache.has(key)) lineCache.set(key, HJ.lines(S.t, S.n, fam));
  return lineCache.get(key);
}
function restrictOf() {
  return S.restrict === 'K' ? { mode: 'K', K: S.K }
       : S.restrict === 'q' ? { mode: 'q', q: S.q } : { mode: 'all' };
}
function currentLines(fam) {
  let ls = familyLines(fam);
  if (S.restrict === 'K') ls = ls.filter(l => l.active.length <= S.K);
  if (S.restrict === 'q') ls = ls.filter(l => l.nIntervals <= S.q);
  return ls;
}
function restrictText() {
  return S.restrict === 'K' ? ` in L[${S.K}]` : S.restrict === 'q' ? ` in L(${S.q})` : '';
}

// ------------------------------------------------------------- notebook
function log(html) {
  const d = document.createElement('div');
  d.className = 'ent';
  const tm = new Date().toTimeString().slice(0, 8);
  d.innerHTML = `<span class="tm">${tm}</span> · ${html}`;
  const box = $('lablog');
  box.appendChild(d);
  while (box.children.length > 16) box.removeChild(box.firstChild);
}

// --------------------------------------------------------- three.js set-up
const stage = $('stage'), tip = $('tip');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
stage.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
scene.add(new THREE.AmbientLight(0x9aa8b8, 0.75));
const dl = new THREE.DirectionalLight(0xfff4e0, 0.85);
dl.position.set(3, 5, 4); scene.add(dl);
const dl2 = new THREE.DirectionalLight(0x88a0c0, 0.35);
dl2.position.set(-4, -2, -3); scene.add(dl2);

const pointsGroup = new THREE.Group(), linesGroup = new THREE.Group(),
      hoverGroup = new THREE.Group(), frameGroup = new THREE.Group();
scene.add(frameGroup, linesGroup, hoverGroup, pointsGroup);

const sphereGeo = new THREE.SphereGeometry(1, 24, 16);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);

const cam = { theta: 0.95, phi: 1.12, dist: 6, target: new THREE.Vector3() };
function applyCamera() {
  const sp = Math.sin(cam.phi), cp = Math.cos(cam.phi);
  camera.position.set(
    cam.target.x + cam.dist * sp * Math.cos(cam.theta),
    cam.target.y + cam.dist * cp,
    cam.target.z + cam.dist * sp * Math.sin(cam.theta));
  camera.lookAt(cam.target);
}
function resetCamera() {
  cam.dist = 2.1 + 1.35 * S.t * Math.sqrt(S.n) / 1.6 + (S.n === 3 ? 1.2 : 0.4);
  if (S.n === 3) { cam.theta = 0.95; cam.phi = 1.12; }
  else { cam.theta = Math.PI / 2; cam.phi = Math.PI / 2 - 0.001; }
  applyCamera();
}

function positionOf(w) {
  const off = (S.t + 1) / 2;
  return new THREE.Vector3(
    w[0] - off,
    S.n >= 2 ? w[1] - off : 0,
    S.n >= 3 ? w[2] - off : 0);
}

let pointMeshes = [];          // idx → mesh
const POINT_R = () => 0.075 + 0.05 * (4 - S.t) / 2 + (S.n < 3 ? 0.04 : 0);

function buildPoints() {
  while (pointsGroup.children.length) {
    const m = pointsGroup.children.pop();
    m.material.dispose();
  }
  pointMeshes = [];
  const W = HJ.words(S.t, S.n), R = POINT_R();
  for (let i = 0; i < W.length; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.42, metalness: 0.08,
      emissive: 0x000000, emissiveIntensity: 0.5 });
    const m = new THREE.Mesh(sphereGeo, mat);
    m.scale.setScalar(R);
    m.position.copy(positionOf(W[i]));
    m.userData = { idx: i, word: W[i] };
    pointMeshes.push(m); pointsGroup.add(m);
  }
  // faint frame
  while (frameGroup.children.length) {
    const m = frameGroup.children.pop();
    m.material.dispose(); m.geometry.dispose();
  }
  const ext = S.t - 1 + 0.55;
  const box = new THREE.BoxGeometry(ext, S.n >= 2 ? ext : 0.001, S.n >= 3 ? ext : 0.001);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box),
    new THREE.LineBasicMaterial({ color: 0x2a333d, transparent: true, opacity: 0.9 }));
  frameGroup.add(edges);
  box.dispose();
}

function recolourPoints() {
  for (let i = 0; i < pointMeshes.length; i++) {
    const c = new THREE.Color(PALETTE[S.col[i] % PALETTE.length]);
    pointMeshes[i].material.color.copy(c);
    pointMeshes[i].material.emissive.copy(c).multiplyScalar(0.22);
  }
}

// -------------------------------------------------- orbit / pinch / pick
let userMoved = false, dragging = false, moved = 0;
const pointers = new Map();
let pinchD = 0;
stage.addEventListener('pointerdown', e => {
  stage.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  dragging = true; moved = 0; stage.classList.add('grabbing');
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchD = Math.hypot(a.x - b.x, a.y - b.y);
  }
});
stage.addEventListener('pointermove', e => {
  if (pointers.has(e.pointerId)) {
    const p = pointers.get(e.pointerId);
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 1) {
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 4) userMoved = true;
      cam.theta += dx * 0.0075;
      cam.phi = Math.min(Math.PI - 0.06, Math.max(0.06, cam.phi - dy * 0.0075));
      applyCamera();
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchD > 0) {
        cam.dist = Math.min(40, Math.max(1.2, cam.dist * pinchD / d));
        applyCamera();
      }
      pinchD = d; userMoved = true; moved = 99;
    }
  } else {
    hoverAt(e.clientX, e.clientY);
  }
});
function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (pointers.size === 0) {
    dragging = false; stage.classList.remove('grabbing');
    if (moved <= 4) pickAndPaint(e.clientX, e.clientY);
  }
}
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);
stage.addEventListener('pointerleave', () => { if (!dragging) setHover(null, null); });
stage.addEventListener('wheel', e => {
  e.preventDefault(); userMoved = true;
  cam.dist = Math.min(40, Math.max(1.2, cam.dist * Math.exp(e.deltaY * 0.0011)));
  applyCamera();
}, { passive: false });

const raycaster = new THREE.Raycaster();
function ndcOf(cx, cy) {
  const rect = renderer.domElement.getBoundingClientRect();
  return { x: ((cx - rect.left) / rect.width) * 2 - 1,
           y: -((cy - rect.top) / rect.height) * 2 + 1,
           px: cx - rect.left, py: cy - rect.top, rect };
}
function pickPoint(cx, cy) {
  const p = ndcOf(cx, cy);
  raycaster.setFromCamera({ x: p.x, y: p.y }, camera);
  const hits = raycaster.intersectObjects(pointMeshes, false);
  return hits.length ? hits[0].object.userData.idx : null;
}
const _v = new THREE.Vector3();
function screenXY(vec3, rect) {
  _v.copy(vec3).project(camera);
  return { x: (_v.x + 1) / 2 * rect.width, y: (-_v.y + 1) / 2 * rect.height, z: _v.z };
}
function distToSeg(px, py, a, b) {
  const vx = b.x - a.x, vy = b.y - a.y;
  const L2 = vx * vx + vy * vy || 1e-9;
  let s = ((px - a.x) * vx + (py - a.y) * vy) / L2;
  s = Math.max(0, Math.min(1, s));
  return Math.hypot(px - (a.x + s * vx), py - (a.y + s * vy));
}
function pickLine(cx, cy) {
  const p = ndcOf(cx, cy);
  let best = null, bestD = 9;
  drawnLines.forEach(rec => {
    const pos = rec.line.points.map(ix => screenXY(pointMeshes[ix].position, p.rect));
    for (let i = 0; i + 1 < pos.length; i++) {
      if (pos[i].z > 1 || pos[i + 1].z > 1) continue;
      const d = distToSeg(p.px, p.py, pos[i], pos[i + 1]);
      if (d < bestD) { bestD = d; best = rec.line; }
    }
  });
  return best;
}

function pickAndPaint(cx, cy) {
  const idx = pickPoint(cx, cy);
  if (idx === null) return;
  const paint = Math.min(S.paint, S.r - 1);
  let targets = [idx];
  if (S.orbitPaint) {
    const tp = HJ.cellKey(HJ.typeOf(HJ.words(S.t, S.n)[idx], S.t));
    targets = [];
    HJ.words(S.t, S.n).forEach((w, i) => {
      if (HJ.cellKey(HJ.typeOf(w, S.t)) === tp) targets.push(i);
    });
  }
  targets.forEach(i => { S.col[i] = paint; });
  if (S.info.kind !== 'manual') {
    S.info = { kind: 'manual', desc: 'hand-painted (edited)', omega: null, chi: null };
    S.regen = null;
  }
  refresh('paint');
}

// ------------------------------------------------------------ animation
let clockT = 0;
function animate() {
  requestAnimationFrame(animate);
  clockT += 0.016;
  if (!userMoved && !reduceMotion) { cam.theta += 0.0022; applyCamera(); }
  const pulse = reduceMotion ? 0.75 : 0.62 + 0.3 * Math.sin(clockT * 2.6);
  monoMaterials.forEach(m => { m.emissiveIntensity = pulse; });
  renderer.render(scene, camera);
}
function fitRenderer() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(() => { fitRenderer(); drawSimplex(); drawStrip(); }).observe(stage);

// ================================================================ lines
let drawnLines = [];               // [{line, meshes:[...], mono, colour}]
let monoMaterials = [];
let monoKeySet = new Set();

function clearGroup(g) {
  while (g.children.length) {
    const m = g.children.pop();
    if (m.material) m.material.dispose();
  }
}
const UP = new THREE.Vector3(0, 1, 0);
function segMesh(p1, p2, mat, radius) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  const m = new THREE.Mesh(cylGeo, mat);
  m.scale.set(radius, len, radius);
  m.position.copy(p1).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}
function addLine(group, line, mono, colourIx, rec) {
  const mat = mono
    ? new THREE.MeshStandardMaterial({
        color: new THREE.Color(PALETTE[colourIx]).multiplyScalar(0.9),
        emissive: new THREE.Color(PALETTE[colourIx]), emissiveIntensity: 0.7,
        roughness: 0.5 })
    : new THREE.MeshStandardMaterial({
        color: 0x8ba1b8, transparent: true, opacity: 0.3, roughness: 0.8,
        emissive: 0x334455, emissiveIntensity: 0.25, depthWrite: false });
  const meshes = [];
  for (let i = 0; i + 1 < line.points.length; i++) {
    const a = pointMeshes[line.points[i]].position,
          b = pointMeshes[line.points[i + 1]].position;
    const seg = segMesh(a, b, mat, mono ? 0.036 : 0.014);
    meshes.push(seg); group.add(seg);
  }
  if (mono) monoMaterials.push(mat);
  if (rec) drawnLines.push({ line, meshes, mono, mat, baseR: mono ? 0.036 : 0.014 });
  return meshes;
}
function buildLines() {
  clearGroup(linesGroup); clearGroup(hoverGroup);
  drawnLines = []; monoMaterials = [];
  const active = currentLines(S.family);
  const monos = HJ.monoLines(S.col, active);
  monoKeySet = new Set(monos.map(l => l.key));
  let toDraw = [];
  if (S.display === 'all') toDraw = active;
  else if (S.display === 'mono') toDraw = monos;
  for (const l of toDraw)
    addLine(linesGroup, l, monoKeySet.has(l.key), S.col[l.points[0]], true);
}
function drawHoverLines(idx) {
  clearGroup(hoverGroup);
  if (idx === null || S.display !== 'hover') return;
  for (const l of currentLines(S.family)) {
    if (!l.points.includes(idx)) continue;
    addLine(hoverGroup, l, monoKeySet.has(l.key), S.col[l.points[0]], false);
  }
}
function highlightLine(key, on) {
  for (const rec of drawnLines) {
    if (rec.line.key !== key) continue;
    const r = on ? rec.baseR * 2.1 : rec.baseR;
    rec.meshes.forEach(m => { m.scale.x = r; m.scale.z = r; });
    if (!rec.mono) {
      rec.mat.opacity = on ? 0.95 : 0.3;
      rec.mat.color.set(on ? 0xe9e4d6 : 0x8ba1b8);
    }
  }
}

// ================================================================ hover
let hoverIdx = null, hoverLineKey = null;
function lineTip(l) {
  const W = HJ.words(S.t, S.n);
  const pts = l.points.map(i => W[i].join('')).join(', ');
  let inv = '';
  if (l.family === 'comb')
    inv = `<br>invariant k=${l.invariant.k}, v=(${l.invariant.v.join(',')})`;
  const mono = monoKeySet.has(l.key) ? ' · <b>monochromatic</b>' : '';
  return `<b>${FAMNAME[l.family]} line</b> ${l.label}${mono}<br>{${pts}}` +
         `<br>active {${l.active.map(i => i + 1).join(',')}} · ` +
         `${l.nIntervals} interval${l.nIntervals > 1 ? 's' : ''}${inv}`;
}
function pointTip(idx) {
  const w = HJ.words(S.t, S.n)[idx];
  const tp = HJ.typeOf(w, S.t);
  const lam = tp.reduce((s, m) => s + (m ? Math.pow(2, m) - 1 : 0), 0);
  let lvl = '';
  if (S.info.omega && S.info.omega.length === S.t)
    lvl = `<br>⟨ω, type⟩ = ${HJ.weightF(S.info.omega, tp)}`;
  return `<b>word ${w.join('')}</b> · colour ${S.col[idx]}` +
         `<br>type (${tp.join(',')}) · σ = ${HJ.sigma(w)}` +
         `<br>λ(x) = ${lam} lines through x (Lemma 7.4)${lvl}`;
}
function setHover(idx, line, cx, cy) {
  if (hoverIdx !== null && pointMeshes[hoverIdx])
    pointMeshes[hoverIdx].material.emissiveIntensity = 0.5;
  if (hoverLineKey) highlightLine(hoverLineKey, false);
  hoverIdx = idx; hoverLineKey = line ? line.key : null;
  if (idx !== null) {
    pointMeshes[idx].material.emissiveIntensity = 1.4;
    tip.innerHTML = pointTip(idx);
  } else if (line) {
    highlightLine(line.key, true);
    tip.innerHTML = lineTip(line);
  }
  drawHoverLines(idx);
  const hlLevels = lineLevels(line);
  drawStrip(hlLevels, idx);
  drawSimplex(line && line.family === 'comb' ? cornerCellsOf(line) : null,
              idx !== null ? HJ.cellKey(HJ.typeOf(HJ.words(S.t, S.n)[idx], S.t)) : null);
  const showTip = Number.isFinite(cx) && Number.isFinite(cy);
  if ((idx !== null || line) && showTip) {
    tip.hidden = false;
    const rect = stage.getBoundingClientRect();
    tip.style.left = Math.min(cx - rect.left + 14, rect.width - 270) + 'px';
    tip.style.top = Math.max(8, cy - rect.top - 12) + 'px';
  } else tip.hidden = true;
}
function hoverAt(cx, cy) {
  const idx = pickPoint(cx, cy);
  const line = idx === null ? pickLine(cx, cy) : null;
  setHover(idx, line, cx, cy);
}
function cornerCellsOf(line) {
  const k = line.invariant.k, v = line.invariant.v;
  const keys = new Set();
  for (let a = 0; a < S.t; a++) {
    const c = v.slice(); c[a] += k; keys.add(HJ.cellKey(c));
  }
  return keys;
}
function lineLevels(line) {
  if (!line || line.family !== 'comb') return null;
  if (!S.info.omega || S.info.omega.length !== S.t || !S.info.chi) return null;
  const b = HJ.weightF(S.info.omega, line.invariant.v);
  return { b, k: line.invariant.k,
           levels: S.info.omega.map(o => b + line.invariant.k * o),
           mono: monoKeySet.has(line.key), label: line.label };
}

// ============================================================== dossier
function computeStats() {
  const out = {};
  for (const fam of ['comb', 'unit', 'geom', 'cyc']) {
    const all = familyLines(fam);
    let cur = all;
    if (S.restrict === 'K') cur = all.filter(l => l.active.length <= S.K);
    if (S.restrict === 'q') cur = all.filter(l => l.nIntervals <= S.q);
    out[fam] = {
      total: all.length, formula: HJ.lineCountFormula(S.t, S.n, fam),
      cur: cur.length,
      mono: HJ.monoLines(S.col, cur).length,
      rainbow: HJ.rainbowLines(S.col, cur).length,
    };
  }
  return out;
}
function renderFamTable(stats) {
  const rows = ['<tr><th>family</th><th>lines</th><th>mono</th><th>rainbow</th><th></th></tr>'];
  for (const fam of ['comb', 'unit', 'geom', 'cyc']) {
    const s = stats[fam];
    const dot = s.mono === 0 ? '<span class="dot ok"></span>' : '<span class="dot no"></span>';
    rows.push(`<tr data-f="${fam}" class="${fam === S.family ? 'on' : ''}">` +
      `<td>${FAMNAME[fam]}</td><td>${s.cur}${s.cur !== s.total ? '/' + s.total : ''}</td>` +
      `<td>${s.mono}</td><td>${s.rainbow}</td><td>${dot}</td></tr>`);
  }
  $('famTable').innerHTML = rows.join('');
  $('famTable').querySelectorAll('tr[data-f]').forEach(tr =>
    tr.addEventListener('click', () => { setFamily(tr.dataset.f); }));
  const okAll = ['comb', 'unit', 'geom', 'cyc'].every(f => stats[f].total === stats[f].formula);
  $('formulaOK').textContent = okAll ? '✓ counts = §6.1 formulas' : '⚠ count mismatch';
}
function renderVerdict(stats) {
  const s = stats[S.family];
  const head = s.mono === 0
    ? `<span class="ok">✔ line-free</span> — ${FAMNAME[S.family]} family, ` +
      `${s.cur} line${s.cur !== 1 ? 's' : ''}${restrictText()} checked`
    : `<span class="no">✘ ${s.mono} monochromatic ${FAMNAME[S.family]} ` +
      `line${s.mono !== 1 ? 's' : ''}</span>${restrictText()}`;
  const stab = HJ.stabilizerClass(S.col, S.t, S.n);
  $('verdict').innerHTML = head +
    `<div class="sub">colouring: ${S.info.desc} · stabiliser ${stab}` +
    ` · rainbow: ${s.rainbow}</div>`;
  $('lineTally').textContent =
    `${FAMNAME[S.family]}: ${s.cur} lines${restrictText()}`;
}
function renderMonoList() {
  const monos = HJ.monoLines(S.col, currentLines(S.family));
  $('monoCount').textContent = monos.length ? `${monos.length}` : 'none ✓';
  const box = $('monoList'); box.innerHTML = '';
  const W = HJ.words(S.t, S.n);
  monos.slice(0, 40).forEach(l => {
    const d = document.createElement('div');
    d.className = 'li'; d.tabIndex = 0;
    const c = S.col[l.points[0]];
    d.innerHTML = `<span class="sw" style="background:${PALETTE[c]}"></span>` +
      `<span>${l.label} · {${l.points.map(i => W[i].join('')).join(', ')}}</span>`;
    const on = () => setHover(null, l, NaN, NaN), off = () => setHover(null, null);
    d.addEventListener('mouseenter', on); d.addEventListener('mouseleave', off);
    d.addEventListener('focus', on); d.addEventListener('blur', off);
    box.appendChild(d);
  });
  if (monos.length > 40) {
    const d = document.createElement('div'); d.className = 'li';
    d.textContent = `… and ${monos.length - 40} more`; box.appendChild(d);
  }
  if (!monos.length) {
    const d = document.createElement('div'); d.className = 'li';
    d.innerHTML = `no monochromatic ${FAMNAME[S.family]} line${restrictText()}`;
    box.appendChild(d);
  }
  const rb = HJ.rainbowLines(S.col, currentLines(S.family)).length;
  $('rainbowNote').innerHTML = `rainbow lines (all ${S.t} colours distinct): <b>${rb}</b>` +
    (S.r < S.t ? ` — needs r ≥ t` : '');
}
function renderChips() {
  const box = $('chips'); box.innerHTML = '';
  S.paint = Math.min(S.paint, S.r - 1);
  for (let i = 0; i < S.r; i++) {
    const b = document.createElement('button');
    b.className = 'chip' + (i === S.paint ? ' on' : '');
    b.style.background = PALETTE[i];
    b.setAttribute('aria-label', 'paint colour ' + i);
    b.addEventListener('click', () => { S.paint = i; renderChips(); });
    box.appendChild(b);
  }
  const counts = new Array(S.r).fill(0);
  S.col.forEach(c => { if (c < S.r) counts[c]++; });
  $('colourCounts').innerHTML = counts.map((k, i) =>
    `<span><span class="swdot" style="background:${PALETTE[i]}"></span>${k}</span>`).join('') +
    `<span>· ${S.col.length} points</span>`;
}

// ======================================================== simplex panel
const simplexCv = $('simplex');
let cellHits = [], simplexHoverKey = null, orbitBoost = [];
function fit2d(cv, cssH) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.clientWidth || cv.parentElement.clientWidth;
  cv.style.height = cssH + 'px';
  cv.width = Math.round(w * dpr); cv.height = Math.round(cssH * dpr);
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w, h: cssH };
}
function cellColour(descent, mixed, key) {
  if (descent) return PALETTE[descent.get(key)];
  const set = mixed.get(key);
  return set.size === 1 ? PALETTE[[...set][0]] : null;
}
function drawSimplex(hlKeys, hoverKey) {
  const cssH = S.t === 2 ? 120 : S.t === 3 ? 220 : 200;
  const { g, w, h } = fit2d(simplexCv, cssH);
  g.clearRect(0, 0, w, h);
  cellHits = [];
  const descent = HJ.descentOf(S.col, S.t, S.n);
  const mixed = new Map();
  if (!descent) {
    HJ.words(S.t, S.n).forEach((wd, i) => {
      const k = HJ.cellKey(HJ.typeOf(wd, S.t));
      if (!mixed.has(k)) mixed.set(k, new Set());
      mixed.get(k).add(S.col[i]);
    });
  }
  const drawCell = (x, y, rad, cell) => {
    const key = HJ.cellKey(cell);
    const fill = cellColour(descent, mixed, key);
    g.beginPath(); g.arc(x, y, rad, 0, 7);
    if (fill) { g.fillStyle = fill; g.fill(); }
    else {
      g.fillStyle = '#242d36'; g.fill();
      g.strokeStyle = '#4a5561'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x - rad * .55, y + rad * .55);
      g.lineTo(x + rad * .55, y - rad * .55); g.stroke();
    }
    if (hlKeys && hlKeys.has(key)) {
      g.strokeStyle = '#e9e4d6'; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, rad + 3, 0, 7); g.stroke();
    }
    if (hoverKey === key || simplexHoverKey === key) {
      g.strokeStyle = '#8ba1b8'; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, rad + 3, 0, 7); g.stroke();
    }
    cellHits.push({ x, y, r: rad + 4, key, cell });
  };
  const pad = 20;
  if (S.t === 2) {
    // the levels V_0..V_n and the K_{n+1} pencil (Prop. 7.22)
    const cells = HJ.simplex(2, S.n);      // (n−i, i)
    const y0 = 44, dx = (w - 2 * pad) / Math.max(1, S.n);
    const pos = i => pad + dx * i;
    // pencil edges below
    for (let i = 0; i <= S.n; i++) for (let j = i + 1; j <= S.n; j++) {
      const ki = HJ.cellKey([S.n - i, i]), kj = HJ.cellKey([S.n - j, j]);
      const ci = cellColour(descent, mixed, ki), cj = cellColour(descent, mixed, kj);
      const same = ci && ci === cj;
      g.strokeStyle = same ? ci : 'rgba(139,161,184,.28)';
      g.lineWidth = same ? 2.2 : 1;
      g.beginPath(); g.moveTo(pos(i), y0);
      g.quadraticCurveTo((pos(i) + pos(j)) / 2, y0 + 14 + (j - i) * 16, pos(j), y0);
      g.stroke();
    }
    cells.sort((a, b) => a[1] - b[1]).forEach(cell => drawCell(pos(cell[1]), y0, 9, cell));
    g.fillStyle = '#6d7680'; g.font = '10px ui-monospace,monospace';
    g.fillText('H_ω(n) = K_{n+1} on the levels — an edge is a corner pair (Prop. 7.22)', pad, h - 10);
  } else if (S.t === 3) {
    const A = { x: pad + 6, y: h - 26 }, B = { x: w - pad - 6, y: h - 26 },
          C = { x: w / 2, y: 22 };
    const rad = Math.min(11, (B.x - A.x) / (2.6 * (S.n + 1)));
    for (const cell of HJ.simplex(3, S.n)) {
      const [a1, a2, a3] = cell, m = Math.max(1, S.n);
      const x = (a1 * A.x + a2 * B.x + a3 * C.x) / m,
            y = (a1 * A.y + a2 * B.y + a3 * C.y) / m;
      drawCell(S.n === 0 ? (A.x + B.x + C.x) / 3 : x,
               S.n === 0 ? (A.y + B.y + C.y) / 3 : y, rad, cell);
    }
    g.fillStyle = '#6d7680'; g.font = 'italic 11px Georgia,serif';
    g.fillText('a₁', A.x - 8, A.y + 16); g.fillText('a₂', B.x - 4, B.y + 16);
    g.fillText('a₃', C.x + 12, C.y + 2);
  } else {
    // t = 4: slices by a₄ = m, each a triangle over (a₁,a₂,a₃)
    const slices = S.n + 1, sw = (w - 2 * pad) / slices;
    for (let m = 0; m <= S.n; m++) {
      const x0 = pad + m * sw, size = S.n - m;
      const A = { x: x0 + 8, y: h - 40 }, B = { x: x0 + sw - 14, y: h - 40 },
            C = { x: x0 + sw / 2 - 3, y: 26 };
      const rad = Math.min(9, sw / (2.8 * (size + 1)));
      for (const c3 of HJ.simplex(3, size)) {
        const cell = [c3[0], c3[1], c3[2], m], mm = Math.max(1, size);
        const x = (c3[0] * A.x + c3[1] * B.x + c3[2] * C.x) / mm,
              y = (c3[0] * A.y + c3[1] * B.y + c3[2] * C.y) / mm;
        drawCell(size === 0 ? (A.x + B.x + C.x) / 3 : x,
                 size === 0 ? (A.y + B.y + C.y) / 3 : y, rad, cell);
      }
      g.fillStyle = '#6d7680'; g.font = '10px ui-monospace,monospace';
      g.fillText('a₄=' + m, x0 + sw / 2 - 14, h - 16);
    }
  }
  renderCornerInfo(descent);
}
function renderCornerInfo(descent) {
  const K = S.restrict === 'K' ? S.K : null;
  const total = HJ.cornerTuples(S.t, S.n, K).length;
  $('simplexLabel').textContent =
    ` — T(${S.t})_${S.n}, ${HJ.simplex(S.t, S.n).length} cells`;
  if (!descent) {
    $('cornerInfo').innerHTML =
      'colouring is <b>not symmetric</b> — mixed cells shown grey; ' +
      'the reduction of Lemma 3.1 applies to symmetric colourings';
    return;
  }
  const mono = HJ.monoCorners(descent, S.t, S.n, K).length;
  $('cornerInfo').innerHTML =
    `corner tuples C<sub>k,v</sub>${K ? ` (k ≤ ${K})` : ''}: <b>${total}</b> · ` +
    `monochromatic: <b>${mono}</b> ` +
    (mono === 0 ? '<span class="ok">✓ ⇒ line-free (Lemma 3.1)</span>'
                : '<span class="no">✘ ⇒ monochromatic lines exist</span>');
}
simplexCv.addEventListener('mousemove', e => {
  const rect = simplexCv.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  let best = null;
  for (const c of cellHits)
    if (Math.hypot(x - c.x, y - c.y) <= c.r) { best = c; break; }
  const key = best ? best.key : null;
  if (key === simplexHoverKey) return;
  simplexHoverKey = key;
  orbitBoost.forEach(m => { m.material.emissiveIntensity = 0.5; });
  orbitBoost = [];
  if (best) {
    const W = HJ.words(S.t, S.n);
    let cnt = 0;
    W.forEach((wd, i) => {
      if (HJ.cellKey(HJ.typeOf(wd, S.t)) === key) {
        pointMeshes[i].material.emissiveIntensity = 1.5;
        orbitBoost.push(pointMeshes[i]); cnt++;
      }
    });
    let lvl = '';
    if (S.info.omega && S.info.omega.length === S.t)
      lvl = ` · ⟨ω,·⟩ = ${HJ.weightF(S.info.omega, best.cell)}`;
    $('cellInfo').innerHTML =
      `cell (${best.cell.join(',')}) · orbit of <b>${cnt}</b> word${cnt > 1 ? 's' : ''}${lvl}`;
  } else {
    $('cellInfo').innerHTML = 'hover a cell — its S<sub>n</sub>-orbit lights up in the grid';
  }
  drawSimplex();
});
simplexCv.addEventListener('mouseleave', () => {
  simplexHoverKey = null;
  orbitBoost.forEach(m => { m.material.emissiveIntensity = 0.5; });
  orbitBoost = [];
  $('cellInfo').innerHTML = 'hover a cell — its S<sub>n</sub>-orbit lights up in the grid';
  drawSimplex();
});

// ============================================================ level strip
const stripCv = $('strip');
function drawStrip(hl, hoverIdxLocal) {
  const show = (S.info.kind === 'ow' || S.info.kind === 'sum') &&
               S.info.omega && S.info.omega.length === S.t && S.info.chi;
  $('stripPane').hidden = !show;
  if (!show) return;
  const { g, w, h } = fit2d(stripCv, 74);
  g.clearRect(0, 0, w, h);
  const omega = S.info.omega, chi = S.info.chi;
  const realized = HJ.realizedLevels(S.t, S.n, omega);
  const lo = Math.min(...realized), hi = Math.max(...realized);
  const pad = 16, span = Math.max(1, hi - lo);
  const X = v => pad + (v - lo) / span * (w - 2 * pad);
  const y0 = 34;
  g.strokeStyle = '#39434e'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(pad - 6, y0); g.lineTo(w - pad + 6, y0); g.stroke();
  const rset = new Set(realized);
  if (span <= 260) {
    g.fillStyle = '#39434e';
    for (let v = lo; v <= hi; v++) if (!rset.has(v)) {
      g.beginPath(); g.arc(X(v), y0, 1.4, 0, 7); g.fill();
    }
  }
  realized.forEach(v => {
    g.beginPath(); g.arc(X(v), y0, 4, 0, 7);
    g.fillStyle = PALETTE[((chi(v) % S.r) + S.r) % S.r]; g.fill();
  });
  if (hoverIdxLocal !== null && hoverIdxLocal !== undefined) {
    const wd = HJ.words(S.t, S.n)[hoverIdxLocal];
    const v = HJ.weightF(omega, HJ.typeOf(wd, S.t));
    g.strokeStyle = '#e9e4d6';
    g.beginPath(); g.moveTo(X(v), y0 - 12); g.lineTo(X(v), y0 - 5); g.stroke();
  }
  if (hl) {
    g.strokeStyle = hl.mono ? '#e07a72' : '#e9e4d6'; g.lineWidth = 1.6;
    const xs = hl.levels.map(X);
    g.beginPath(); g.moveTo(Math.min(...xs), y0 + 12);
    g.lineTo(Math.max(...xs), y0 + 12); g.stroke();
    hl.levels.forEach(v => {
      g.beginPath(); g.arc(X(v), y0, 7, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(X(v), y0 + 7); g.lineTo(X(v), y0 + 12); g.stroke();
    });
    $('stripInfo').innerHTML =
      `line ${hl.label}: b = ⟨ω,v⟩ = <b>${hl.b}</b>, k = <b>${hl.k}</b> → homothet ` +
      `b + k·S<sub>ω</sub> = {${hl.levels.slice().sort((a, b) => a - b).join(', ')}} ` +
      (hl.mono ? '<span class="no">monochromatic</span>'
               : '<span class="ok">bichromatic ✓</span>');
  } else {
    $('stripInfo').innerHTML = 'hover a combinatorial line — its homothet b + k·S<sub>ω</sub> appears here (Lemma 2.14)';
  }
  g.fillStyle = '#6d7680'; g.font = '10px ui-monospace,monospace';
  g.fillText(String(lo), pad - 4, y0 + 26);
  g.fillText(String(hi), w - pad - 10, y0 + 26);
  $('stripLabel').textContent = ` ω = (${omega.join(',')}) · ${realized.length} realised levels`;
}

// ============================================================== refresh
function refresh() {
  $('gridLabel').textContent =
    ` [${S.t}]${SUP(S.n)} → ${S.r} colour${S.r > 1 ? 's' : ''} · ${S.col.length} points`;
  recolourPoints();
  const stats = computeStats();
  renderFamTable(stats);
  renderVerdict(stats);
  renderMonoList();
  renderChips();
  buildLines();
  drawSimplex();
  drawStrip();
  if (window.HJX) HJX.onRefresh.forEach(f => { try { f(); } catch (e) { console.error(e); } });
}
function rebuildAll() {
  lineCache.clear();
  buildPoints();
  resetCamera();
  refresh();
}
function setColouring(col, info, regen) {
  S.col = col; S.info = info; S.regen = regen || null;
  refresh();
}
function regenerate(reason) {
  const need = Math.pow(S.t, S.n);
  const made = S.regen ? S.regen(S.t, S.n, S.r) : null;
  if (made) { S.col = made.col; S.info = made.info; return; }
  if (S.col.length === need) {                 // keep the colouring, clamp to r
    S.col = S.col.map(c => ((c % S.r) + S.r) % S.r);
    if (S.regen) {
      S.regen = null;
      log('previous colouring rule not defined at the new parameters — kept the colours as painted');
    }
    return;
  }
  S.col = HJ.randomColouring(S.t, S.n, S.r);
  S.info = { kind: 'random', desc: 'random', omega: null, chi: null };
  S.regen = (t, n, r) => ({ col: HJ.randomColouring(t, n, r),
    info: { kind: 'random', desc: 'random', omega: null, chi: null } });
  log('grid size changed — drew a random colouring');
}

// ============================================================= controls
function setFamily(f) {
  S.family = f;
  document.querySelectorAll('#seg-family button').forEach(b =>
    b.classList.toggle('on', b.dataset.v === f));
  refresh();
}
function bindSeg(id, fn) {
  document.querySelectorAll('#' + id + ' button').forEach(b =>
    b.addEventListener('click', () => {
      document.querySelectorAll('#' + id + ' button').forEach(x =>
        x.classList.toggle('on', x === b));
      fn(b.dataset.v);
    }));
}
bindSeg('seg-family', setFamily);
bindSeg('seg-restrict', v => {
  S.restrict = v;
  $('row-Kq').hidden = v === 'all';
  $('nm-Kq').textContent = v === 'q' ? 'q' : 'K';
  $('v-Kq').textContent = v === 'q' ? S.q : S.K;
  $('sl-Kq').value = v === 'q' ? S.q : S.K;
  refresh();
});
bindSeg('seg-display', v => { S.display = v; refresh(); });
$('sl-Kq').addEventListener('input', e => {
  const v = +e.target.value;
  if (S.restrict === 'q') S.q = v; else S.K = v;
  $('v-Kq').textContent = v; refresh();
});
$('ck-orbit').addEventListener('change', e => { S.orbitPaint = e.target.checked; });

function syncParamSliders() {
  $('sl-t').value = S.t; $('v-t').textContent = S.t;
  $('sl-n').value = S.n; $('v-n').textContent = S.n;
  $('sl-r').value = S.r; $('v-r').textContent = S.r;
  $('sl-Kq').max = S.n;
  S.K = Math.min(S.K, S.n); S.q = Math.min(S.q, S.n);
  $('v-Kq').textContent = S.restrict === 'q' ? S.q : S.K;
  $('sl-Kq').value = S.restrict === 'q' ? S.q : S.K;
}
$('sl-t').addEventListener('input', e => {
  S.t = +e.target.value; syncParamSliders();
  populatePresets(); regenerate('t'); rebuildAll();
});
$('sl-n').addEventListener('input', e => {
  S.n = +e.target.value; syncParamSliders();
  regenerate('n'); rebuildAll();
});
$('sl-r').addEventListener('input', e => {
  S.r = +e.target.value; syncParamSliders();
  regenerate('r'); S.col = S.col.map(c => c % S.r); refresh();
});

$('b-random').addEventListener('click', () => {
  const regen = (t, n, r) => ({ col: HJ.randomColouring(t, n, r),
    info: { kind: 'random', desc: 'random', omega: null, chi: null } });
  const m = regen(S.t, S.n, S.r); setColouring(m.col, m.info, regen);
});
$('b-randsym').addEventListener('click', () => {
  const regen = (t, n, r) => ({ col: HJ.randomSymmetric(t, n, r),
    info: { kind: 'sym', desc: 'random symmetric (descent on T, Lemma 2.4)',
            omega: null, chi: null } });
  const m = regen(S.t, S.n, S.r); setColouring(m.col, m.info, regen);
});
$('b-clear').addEventListener('click', () => {
  const regen = (t, n) => ({ col: new Array(Math.pow(t, n)).fill(0),
    info: { kind: 'manual', desc: 'constant (colour 0)', omega: null, chi: null } });
  const m = regen(S.t, S.n); setColouring(m.col, m.info, regen);
});

// one-weight editor -----------------------------------------------------
$('sel-chi').addEventListener('change', () => {
  $('lbl-pattern').hidden = $('sel-chi').value !== 'periodic';
});
function parseInts(s) {
  const v = s.split(/[,\s]+/).filter(x => x.length).map(Number);
  return v.every(Number.isInteger) && v.length ? v : null;
}
$('b-ow').addEventListener('click', () => {
  const omega = parseInts($('in-omega').value);
  if (!omega || omega.length !== S.t) {
    log(`<b>ω</b> must be ${S.t} integers (t = ${S.t})`); return;
  }
  const mode = $('sel-chi').value;
  let chi, chidesc;
  if (mode === 'periodic') {
    const pat = parseInts($('in-pattern').value);
    if (!pat) { log('pattern must be a list of integers'); return; }
    const p = pat.map(x => ((x % S.r) + S.r) % S.r);
    chi = HJ.periodic(p); chidesc = `χ = pattern mod ${p.length}`;
  } else if (mode === 'modr') {
    chi = x => ((x % S.r) + S.r) % S.r; chidesc = 'χ = x mod r';
  } else {
    const map = new Map();
    HJ.realizedLevels(S.t, S.n, omega).forEach(l =>
      map.set(l, Math.floor(Math.random() * S.r)));
    chi = x => map.has(x) ? map.get(x) : 0; chidesc = 'χ random on levels';
  }
  const isSum = omega.every((o, i) => o === omega[0] + i * (omega[1] - omega[0])) &&
                omega[1] - omega[0] === 1;
  const info = { kind: isSum ? 'sum' : 'ow',
    desc: `one-weight ω=(${omega.join(',')}), ${chidesc}`, omega, chi };
  const regen = (t, n, r) => t === omega.length && r >= 1
    ? { col: HJ.oneWeight(t, n, omega, x => ((chi(x) % r) + r) % r), info } : null;
  setColouring(HJ.oneWeight(S.t, S.n, omega, x => ((chi(x) % S.r) + S.r) % S.r),
               info, regen);
  log(`applied c<sub>ω,χ</sub> with ω=(${omega.join(',')})`);
});

// presets ---------------------------------------------------------------
function owPreset(omega, chi, desc) {
  const info = { kind: 'ow', desc, omega, chi };
  const mk = (t, n, r) => t !== omega.length ? null :
    { col: HJ.oneWeight(t, n, omega, x => ((chi(x) % r) + r) % r), info };
  return mk;
}
const PRESETS = [
  { id: 'p314', label: '⌊(σ mod 4)/2⌋ — line-free on [3]³ (Prop. 3.14)', t: 3, n: 3, r: 2,
    note: 'The symmetric witness for HJ(3,2) = 4.',
    make: () => {
      const chi = s => Math.floor((s % 4) / 2);
      const info = { kind: 'sum', desc: '⌊(σ mod 4)/2⌋ (Prop. 3.14)',
                     omega: [1, 2, 3], chi };
      const mk = (t, n, r) => t === 3 ? { col: HJ.sumType(3, n, chi), info } : null;
      return { mk };
    } },
  { id: 'a1', label: 'Record slice — Table A.1 rows 18–21 (Lemma 3.3)', t: 3, n: 3, r: 3,
    note: 'The 253-cell HJ(3,3) ≥ 22 witness, restricted to [3]³ by the monotonicity shift.',
    make: () => {
      const tail = { 18: '1001', 19: '120', 20: '20', 21: '0' };
      const mk = (t, n, r) => {
        if (t !== 3 || n !== 3 || r < 3) return null;
        const d = new Map();
        for (const c of HJ.simplex(3, 3))
          d.set(HJ.cellKey(c), +tail[18 + c[0]][c[1]]);
        return { col: HJ.liftDescent(d, 3, 3),
          info: { kind: 'sym', desc: 'Table A.1 slice (Lemma 3.3)', omega: null, chi: null } };
      };
      return { mk };
    } },
  { id: 'psi13', label: 'ω=(0,5,7), ψ mod 13 — HJ^[12](3,3)=∞ (Thm 4.10)', t: 3, r: 3,
    note: 'No monochromatic line with ≤ 12 active coordinates, in any dimension.',
    make: () => ({ mk: owPreset([0, 5, 7],
      HJ.periodic([1, 0, 0, 1, 0, 1, 0, 0, 1, 2, 2, 2, 2]),
      'ω=(0,5,7), ψ mod 13 (Thm 4.10)') }) },
  { id: 'sum1233', label: '12-periodic sum palette at (3,3) (Prop. 4.5)', t: 3, r: 3,
    note: 'κ_sum(3,3) = 11: no monochromatic 3-AP of gap ≤ 11.',
    make: () => ({ mk: owPreset([1, 2, 3],
      HJ.periodic([2, 0, 1, 2, 1, 1, 0, 1, 2, 0, 0, 2]),
      '12-periodic sum palette (Prop. 4.5)') }) },
  { id: 'chi13', label: 'ω=(0,2,3,5), χ₀ mod 13 — HJ^[12](4,2)=∞ (Thm 4.11)', t: 4, r: 2,
    note: 'The mod-13 shadow of the record: line-free at every bracket K ≤ 12.',
    make: () => ({ mk: owPreset([0, 2, 3, 5],
      x => [4, 5, 7, 9, 11, 12].includes(((x % 13) + 13) % 13) ? 1 : 0,
      'ω=(0,2,3,5), χ₀ mod 13 (Thm 4.11)') }) },
  { id: 'rec26', label: 'Record palette mod 26 — HJ(4,2) ≥ 14 (Thm 3.10)', t: 4, r: 2,
    note: 'Line-free on [4]ⁿ for every n ≤ 13; the (4,2) record.',
    make: () => ({ mk: owPreset([0, 2, 3, 5],
      HJ.periodic([1,0,1,0,0,1,1,1,1,0,0,1,0,0,0,1,0,0,1,1,1,1,0,0,1,0]),
      'record palette mod 26 (Thm 3.10)') }) },
  { id: 'summodr', label: 'σ mod r — line-free iff n < r (Prop. 2.2 / Rem. 6.5)',
    note: 'At t = 2 this is exactly the HJ(2, r) = r witness.',
    make: () => {
      const mk = (t, n, r) => {
        const chi = x => ((x % r) + r) % r;
        return { col: HJ.sumType(t, n, chi),
          info: { kind: 'sum', desc: `σ mod ${r}`,
                  omega: Array.from({ length: t }, (_, i) => i + 1), chi } };
      };
      return { mk };
    } },
  { id: 'parity', label: 'Parity σ mod 2 — kills L^[1] (Prop. 4.1)',
    note: 'Set the restriction to K = 1: every 1-active line alternates.',
    make: () => {
      const chi = x => ((x % 2) + 2) % 2;
      const mk = (t, n, r) => r < 2 ? null : { col: HJ.sumType(t, n, chi),
        info: { kind: 'sum', desc: 'parity σ mod 2 (Prop. 4.1)',
                omega: Array.from({ length: t }, (_, i) => i + 1), chi } };
      return { mk, restrict: { mode: 'K', val: 1 } };
    } },
  { id: 'block', label: 'Block palette 0^{t−1}…(r−1)^{t−1} (Thm 4.3)',
    note: 'Avoids every line with < (t−1)r active coordinates, in any dimension.',
    make: () => {
      const mk = (t, n, r) => {
        const b = t - 1, m = b * r;
        const chi = x => Math.floor((((x % m) + m) % m) / b);
        return { col: HJ.sumType(t, n, chi),
          info: { kind: 'sum', desc: `block palette, period ${m} (Thm 4.3)`,
                  omega: Array.from({ length: t }, (_, i) => i + 1), chi } };
      };
      return { mk };
    } },
  { id: 'unit2', label: '(i+j) mod t ∈ {0,1} — unit-line-free on ℤ_t² (Prop. 6.6)',
    n: 2, r: 2, note: 'Switches the family to unit-cyclic; needs t ≥ 3.',
    family: 'unit',
    make: () => {
      const mk = (t, n, r) => {
        if (t < 3 || n !== 2) return null;
        const col = HJ.words(t, 2).map(w => ((w[0] % t) + (w[1] % t)) % t <= 1 ? 1 : 0);
        return { col, info: { kind: 'preset',
          desc: '(i+j) mod t ∈ {0,1} (Prop. 6.6)', omega: null, chi: null } };
      };
      return { mk };
    } },
  { id: 'radix', label: 'Radix one-weight — ow = sym (Thm 3.5)',
    note: 'ω = (0, 1, p, p²), p = n+1: injective on T, so one weight realises a random symmetric colouring.',
    make: () => {
      const mk = (t, n, r) => {
        const p = n + 1;
        const omega = [0, 1, p, p * p].slice(0, t);
        const map = new Map();
        HJ.realizedLevels(t, n, omega).forEach(l =>
          map.set(l, Math.floor(Math.random() * r)));
        const chi = x => map.has(x) ? map.get(x) : 0;
        return { col: HJ.oneWeight(t, n, omega, chi),
          info: { kind: 'ow', desc: `radix ω=(${omega.join(',')}) (Thm 3.5)`, omega, chi } };
      };
      return { mk };
    } },
];
function populatePresets() {
  const sel = $('sel-preset'); sel.innerHTML = '';
  PRESETS.filter(p => p.t === undefined || p.t === S.t).forEach(p => {
    const o = document.createElement('option');
    o.value = p.id; o.textContent = p.label; sel.appendChild(o);
  });
  updatePresetNote();
}
function updatePresetNote() {
  const p = PRESETS.find(x => x.id === $('sel-preset').value);
  $('preset-note').textContent = p ? p.note : '';
}
$('sel-preset').addEventListener('change', updatePresetNote);
function loadPreset(id) {
  const p = PRESETS.find(x => x.id === id);
  if (!p) return;
  if (p.t) S.t = p.t;
  if (p.n) S.n = p.n;
  if (p.r && S.r < p.r) S.r = p.r;
  const built = p.make();
  const made = built.mk(S.t, S.n, S.r);
  if (!made) { log(`preset needs different parameters`); return; }
  if (p.family) S.family = p.family;
  if (built.restrict) {
    S.restrict = built.restrict.mode;
    if (built.restrict.mode === 'K') S.K = Math.min(built.restrict.val, S.n);
    document.querySelectorAll('#seg-restrict button').forEach(b =>
      b.classList.toggle('on', b.dataset.v === S.restrict));
    $('row-Kq').hidden = S.restrict === 'all';
    $('nm-Kq').textContent = 'K';
  }
  document.querySelectorAll('#seg-family button').forEach(b =>
    b.classList.toggle('on', b.dataset.v === S.family));
  syncParamSliders(); populatePresets();
  $('sel-preset').value = id; updatePresetNote();
  S.col = made.col; S.info = made.info; S.regen = built.mk;
  rebuildAll();
  log(`loaded preset: <b>${p.label}</b>`);
}
$('b-preset').addEventListener('click', () => loadPreset($('sel-preset').value));

// tools ------------------------------------------------------------------
function famArgs() {
  return [S.family, S.restrict === 'K' ? S.K : null, S.restrict === 'q' ? S.q : null];
}
$('b-find').addEventListener('click', () => {
  const [fam, K, q] = famArgs();
  const res = HJ.findLineFree(S.t, S.n, S.r, fam, K, q, 4000);
  if (res.colouring) {
    setColouring(res.colouring,
      { kind: 'search', desc: `search witness (${FAMNAME[fam]}${restrictText()})`,
        omega: null, chi: null }, null);
    log(`<b>found</b> a line-free ${S.r}-colouring of [${S.t}]${SUP(S.n)} for the ` +
        `${FAMNAME[fam]} family${restrictText()}`);
  } else if (res.searched) {
    log(`<b>none exists</b>: every ${S.r}-colouring of [${S.t}]${SUP(S.n)} has a ` +
        `monochromatic ${FAMNAME[fam]} line${restrictText()} ⇒ ` +
        `HJ<sub>${fam}</sub>${restrictText()}(${S.t},${S.r}) ≤ ${S.n} (exhaustive backtracking)`);
  } else log('search inconclusive within the 4 s budget');
});
$('b-diag').addEventListener('click', () => {
  const res = HJ.findDiagonalOnly(S.t, S.n, S.r, 4000);
  if (res.colouring) {
    if (S.family !== 'comb') setFamily('comb');
    setColouring(res.colouring,
      { kind: 'search', desc: 'diagonal-only witness (Conj. 4.23)', omega: null, chi: null },
      null);
    log(`<b>diagonal-only</b> colouring found: the only monochromatic combinatorial ` +
        `line of [${S.t}]${SUP(S.n)} is the diagonal ∗…∗ — certifies L^[${S.n - 1}]-line-freeness`);
  } else if (res.searched) log('no diagonal-only colouring exists at these parameters');
  else log('search inconclusive within the 4 s budget');
});
$('b-countsym').addEventListener('click', () => {
  let K = S.restrict === 'K' ? S.K : null;
  if (S.restrict === 'q')
    log('interval restrictions are invisible to symmetric colourings ' +
        '(Prop. 4.15) — counting without restriction');
  const res = HJ.countLineFreeSymmetric(S.t, S.n, S.r, K, 5000);
  const tag = (S.t === 3 && S.n === 3 && S.r === 2 && K === null)
    ? ' — Table A.5 ✓' : '';
  log(`symmetric line-free ${S.r}-colourings of [${S.t}]${SUP(S.n)}` +
      (K ? ` (L[${K}])` : '') + ': ' +
      (res.exhausted ? `<b>= ${res.count}</b>${tag}` : `<b>≥ ${res.count}</b> (5 s budget hit)`) +
      ` · counted on the ${HJ.simplex(S.t, S.n).length}-cell simplex via Lemma 3.1`);
});
$('b-countall').addEventListener('click', () => {
  const [fam, K, q] = famArgs();
  const res = HJ.countLineFree(S.t, S.n, S.r, fam, K, q, 6000);
  const tag = (S.t === 3 && S.n === 3 && S.r === 2 && fam === 'comb' && !K && !q)
    ? ' — Table A.5 ✓' : '';
  log(`line-free ${S.r}-colourings of [${S.t}]${SUP(S.n)}, ${FAMNAME[fam]}` +
      `${restrictText()}: ` +
      (res.exhausted ? `<b>= ${res.count}</b>${tag}` : `<b>≥ ${res.count}</b> (6 s budget hit)`));
});
$('b-minmono').addEventListener('click', () => {
  const [fam, K, q] = famArgs();
  const states = Math.pow(S.r, Math.pow(S.t, S.n));
  if (states > 2097152) {
    log(`brute force needs r^(tⁿ) = ${S.r}^${Math.pow(S.t, S.n)} colourings — too many; ` +
        `try smaller t, n or r (e.g. t=3, n=2, r=2, cyclic → Prop. 7.9)`);
    return;
  }
  const m = HJ.minMonochromatic(S.t, S.n, S.r, fam, K, q);
  const tag = (S.t === 3 && S.n === 2 && S.r === 2 && fam === 'cyc' && !K && !q)
    ? ' — Prop. 7.9 ✓' : '';
  log(`minimum # monochromatic ${FAMNAME[fam]} lines${restrictText()} over all ` +
      `${states} colourings: <b>${m}</b>${tag}`);
});
$('b-export').addEventListener('click', () => {
  const data = { t: S.t, n: S.n, r: S.r, colours: S.col,
    family: S.family, restriction: restrictOf(),
    meta: { desc: S.info.desc, page: 'hales-jewett-explorer' } };
  const txt = JSON.stringify(data);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
  a.download = `hj-colouring-t${S.t}n${S.n}r${S.r}.json`;
  a.click(); URL.revokeObjectURL(a.href);
  if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {});
  log('exported JSON (and copied to clipboard) — check it with ' +
      '<b>python/check_line_free.py</b>');
});
$('b-import').addEventListener('click', () => $('dlg-import').showModal());
$('b-import-cancel').addEventListener('click', () => $('dlg-import').close());
$('b-import-load').addEventListener('click', () => {
  try {
    const d = JSON.parse($('import-text').value);
    const cols = d.colours || d.colors;
    const t = +d.t, n = +d.n, r = +d.r;
    if (!(t >= 2 && t <= 4 && n >= 1 && n <= 3 && r >= 1 && r <= 6))
      throw new Error('need t∈[2,4], n∈[1,3], r∈[1,6]');
    if (!Array.isArray(cols) || cols.length !== Math.pow(t, n))
      throw new Error(`colours must have length t^n = ${Math.pow(t, n)}`);
    S.t = t; S.n = n; S.r = r;
    syncParamSliders(); populatePresets();
    S.col = cols.map(c => ((c % r) + r) % r);
    S.info = { kind: 'import', desc: 'imported', omega: null, chi: null };
    S.regen = null;
    $('dlg-import').close();
    rebuildAll();
    log('imported colouring');
  } catch (err) {
    log(`import failed: ${err.message}`);
  }
});

// ============================================== bridge for extra panels
let extBoost = [];
window.HJX = {
  onRefresh: [],
  palette: PALETTE,
  getState: () => S,
  boostWords(idxs) {
    extBoost.forEach(m => { if (m.material) m.material.emissiveIntensity = 0.5; });
    extBoost = (idxs || []).map(i => pointMeshes[i]).filter(Boolean);
    extBoost.forEach(m => { m.material.emissiveIntensity = 1.6; });
  },
  clearBoost() { this.boostWords([]); },
};

// ================================================================= init
populatePresets();
fitRenderer();
loadPreset('p314');
$('sel-chi').dispatchEvent(new Event('change'));
log('welcome — the grid shows the thesis\'s own line-free 2-colouring of [3]³ ' +
    '(Prop. 3.14). Family counts are re-derived from the definitions and checked ' +
    'against the §6.1 formulas on every change.');
animate();

})();
