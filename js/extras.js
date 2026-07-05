/* =====================================================================
   Extras — Chapter 7 graph constructions and the Rado reading (§2.4)
   ---------------------------------------------------------------------
   Pure parts (HJPURE) are node-testable; the panels read the live
   explorer state through the HJX bridge and re-render on every refresh.
   ===================================================================== */
'use strict';
const HJPURE = (() => {
  const gcd2 = (a, b) => { a = Math.abs(a); b = Math.abs(b);
    while (b) { const t = a % b; a = b; b = t; } return a; };

  // sorted distinct values, translated to min 0 and divided by the gcd
  // (Lemma 2.17: the pattern matters only up to ±c·S + d)
  function normaliseS(vals) {
    const raw = [...new Set(vals)].sort((a, b) => a - b);
    if (raw.length < 2) return { raw, S0: raw.map(x => x - (raw[0] || 0)), g: 1 };
    let g = 0;
    raw.forEach(s => { g = gcd2(g, s - raw[0]); });
    return { raw, S0: raw.map(s => (s - raw[0]) / g), g };
  }

  // Prop. 2.19: a basis of the lattice Λ_s of affine dependencies of s,
  // one 3-term relation per consecutive triple; each equation has
  // coefficient sum 0 (Rado's column condition) and ⟨c, s⟩ = 0.
  function radoEquations(S0) {
    const V = ['X\u2081', 'X\u2082', 'X\u2083', 'X\u2084'];
    const term = (co, i) => (co === 1 ? '' : co + '\u00b7') + V[i];
    const eqs = [];
    for (let i = 0; i + 2 < S0.length; i++) {
      let c = [S0[i + 1] - S0[i + 2], S0[i + 2] - S0[i], S0[i] - S0[i + 1]];
      let g = 0; c.forEach(x => { g = gcd2(g, x); });
      c = c.map(x => x / g);
      if (c[0] < 0) c = c.map(x => -x);
      const L = [], R = [];
      c.forEach((co, j) => {
        if (co > 0) L.push(term(co, i + j));
        else if (co < 0) R.push(term(-co, i + j));
      });
      eqs.push({ coef: c, vars: [i, i + 1, i + 2],
                 text: (L.join(' + ') || '0') + ' = ' + (R.join(' + ') || '0') });
    }
    return eqs;
  }

  // Exact scan of Lemma 2.14: the homothet classes realised on [t]^n are
  //   b + k·S_ω  with 1 ≤ k ≤ n and b ∈ ⟨ω, T^(t)_{n−k}⟩.
  // reflected = true scans the reflected pattern (min+max) − ω instead —
  // sets of the form b' + k·(−S), which the grid never realises
  // (Example 2.20) — restricted to copies landing inside Λ_ω(n).
  function homothetScan(HJref, t, n, omega, chi, reflected) {
    const mn = Math.min(...omega), mx = Math.max(...omega);
    const pat = reflected ? omega.map(o => mn + mx - o) : omega;
    const realised = new Set(HJref.realizedLevels(t, n, omega));
    let count = 0, first = null;
    for (let k = 1; k <= n; k++) {
      const bases = new Set();
      HJref.simplex(t, n - k).forEach(v => bases.add(HJref.weightF(omega, v)));
      for (const b of bases) {
        const levels = pat.map(p => b + k * p);
        if (reflected && !levels.every(l => realised.has(l))) continue;
        const c0 = chi(levels[0]);
        if (levels.every(l => chi(l) === c0)) {
          count++;
          if (!first) first = { k, b, levels: levels.slice() };
        }
      }
    }
    return { count, first };
  }

  // Gallai-number rows computed in the thesis (Table 2.1), keyed r|S0
  const KNOWN_G = {
    '2|0,1': { G: '3', bound: '2', note: 'G_r({0,1}) = r+1 — tight (HJ(2,r)=r)' },
    '3|0,1': { G: '4', bound: '3', note: 'G_r({0,1}) = r+1 — tight' },
    '4|0,1': { G: '5', bound: '4', note: 'G_r({0,1}) = r+1 — tight' },
    '5|0,1': { G: '6', bound: '5', note: 'G_r({0,1}) = r+1 — tight' },
    '6|0,1': { G: '7', bound: '6', note: 'G_r({0,1}) = r+1 — tight' },
    '2|0,1,2': { G: '9', bound: '4', note: '= W(3,2); tight at (3,2)' },
    '3|0,1,2': { G: '27', bound: '13', note: '= W(3,3): the van der Waerden shadow' },
    '3|0,1,3': { G: '42', bound: '14', note: 'new in the thesis (Thm 2.22)' },
    '3|0,1,4': { G: '57', bound: '14', note: 'new in the thesis (Thm 2.22)' },
    '3|0,2,5': { G: '≥ 77', bound: '≥ 16', note: 'the ratio champion (Thm 2.22)' },
    '2|0,1,2,3': { G: '35', bound: '12', note: '= W(4,2)' },
    '2|0,2,3,5': { G: '67', bound: '14', note: 'the (4,2) record weight (Thm 3.10)' },
    '2|0,1,5,6': { G: '80', bound: '14', note: 'second (4,2) champion' },
  };

  return { normaliseS, radoEquations, homothetScan, KNOWN_G };
})();
if (typeof module !== 'undefined') module.exports = HJPURE;

/* ======================================================================
   Browser panels
   ====================================================================== */
if (typeof window !== 'undefined') (function () {
  const PAL = HJX.palette;
  const $ = id => document.getElementById(id);
  const state = () => HJX.getState();
  function fit2d(cv, cssH) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth || cv.parentElement.clientWidth;
    cv.style.height = cssH + 'px';
    cv.width = Math.round(w * dpr); cv.height = Math.round(cssH * dpr);
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, w, h: cssH };
  }
  const esc = a => a.join(',');

  /* ------------------------------------------------------------ Rado */
  function updateRado() {
    if (!$('radoEq')) return;
    const S = state();
    const live = (S.info.kind === 'ow' || S.info.kind === 'sum') &&
                 S.info.omega && S.info.omega.length === S.t && S.info.chi;
    const vals = live ? S.info.omega : [0, 1, 3];
    const { raw, S0 } = HJPURE.normaliseS(vals);
    const D = S0.length ? S0[S0.length - 1] : 0;
    const degen = raw.length < vals.length;

    $('radoS').innerHTML =
      (live ? `current weight ω = (${vals.join(', ')})`
            : `example pattern (apply a one-weight colouring above to make this live)`) +
      ` → S = {${raw.join(', ')}}, normalised S₀ = {${S0.join(', ')}}` +
      ` (Lemma 2.17), diameter D = ${D}` +
      (degen ? ' · <b>degenerate weight</b> — repeated values (Rem. 7.23)' : '');

    if (S0.length < 3) {
      $('radoEq').innerHTML =
        `t − 2 = ${Math.max(0, S0.length - 2)} equations: a two-point pattern has no ` +
        `Rado system — its homothets are just the pairs {b, b+kD}.`;
    } else {
      const eqs = HJPURE.radoEquations(S0);
      $('radoEq').innerHTML =
        `E<sub>s</sub> (Prop. 2.19 — ${eqs.length} equation${eqs.length > 1 ? 's' : ''}, ` +
        `each with coefficient sum 0, hence partition regular):` +
        `<div class="mono" style="margin:6px 0 4px;color:var(--chalk)">` +
        eqs.map(e => e.text).join('&ensp;·&ensp;') + `</div>` +
        `injective solutions = a·<b>1</b> + d·<b>s</b>: homothets of S₀ for d ≥ 1 ` +
        `and of the reflected −S₀ for d ≤ −1; <b>the grid realises only d ≥ 1</b> (Ex. 2.20).`;
    }

    // matched Gallai row → closed-form bound (Thm 2.15)
    const row = HJPURE.KNOWN_G[S.r + '|' + esc(S0)];
    $('radoBound').innerHTML = row
      ? `G<sub>${S.r}</sub>(S₀) = <b>${row.G}</b> ⇒ HJ(${S0.length}, ${S.r}) ≥ ` +
        `⌈(G−1)/D⌉ = <b>${row.bound}</b> (Thm 2.15) — ${row.note}`
      : `G<sub>${S.r}</sub>(S₀) is not among the values computed in the thesis ` +
        `(Table 2.1 lists the SAT-computed cases).`;

    // live counts + strip
    const cv = $('radoStrip');
    if (!live || degen || S0.length !== S.t) {
      $('radoCounts').innerHTML = live && degen
        ? 'counts need a weight with t distinct values (|S_ω| = t, Lemma 2.14)'
        : 'apply a one-weight colouring in the explorer to scan homothets against its palette χ';
      const { g, w, h } = fit2d(cv, 40);
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#6d7680'; g.font = '11px ui-monospace,monospace';
      g.fillText('— level strip inactive —', 14, 24);
      return;
    }
    const chi = x => ((S.info.chi(x) % S.r) + S.r) % S.r;
    const fwd = HJPURE.homothetScan(HJ, S.t, S.n, vals, chi, false);
    const rfl = HJPURE.homothetScan(HJ, S.t, S.n, vals, chi, true);
    const gridMono = HJ.monoLines(S.col, HJ.lines(S.t, S.n, 'comb')).length;
    const agree = (fwd.count > 0) === (gridMono > 0);
    $('radoCounts').innerHTML =
      `forward homothets b + k·S (1 ≤ k ≤ ${S.n}, b ∈ ⟨ω, T⟩): ` +
      `<b>${fwd.count}</b> monochromatic class${fwd.count === 1 ? '' : 'es'} — ` +
      `grid has <b>${gridMono}</b> mono line${gridMono === 1 ? '' : 's'} ` +
      (agree ? '<span class="ok">✓ agree (Lemma 2.14)</span>'
             : '<span class="no">✗ disagree?!</span>') +
      `<br>reflected copies b + k·(−S) inside Λ_ω(${S.n}): ` +
      `<b>${rfl.count}</b> monochromatic — invisible to the grid (Ex. 2.20); ` +
      `freeness for E<sub>s</sub> needs <b>both</b> counts 0` +
      (fwd.count === 0 && rfl.count > 0
        ? ' — <b>this palette is line-free yet not solution-free</b>, the gap of Rem. 2.24'
        : '');

    // strip with the first monochromatic copy of each kind marked
    const realised = HJ.realizedLevels(S.t, S.n, vals);
    const lo = Math.min(...realised), hi = Math.max(...realised);
    const { g, w, h } = fit2d(cv, 74);
    g.clearRect(0, 0, w, h);
    const pad = 16, span = Math.max(1, hi - lo), y0 = 34;
    const X = v => pad + (v - lo) / span * (w - 2 * pad);
    g.strokeStyle = '#39434e';
    g.beginPath(); g.moveTo(pad - 6, y0); g.lineTo(w - pad + 6, y0); g.stroke();
    realised.forEach(v => {
      g.beginPath(); g.arc(X(v), y0, 4, 0, 7);
      g.fillStyle = PAL[chi(v)]; g.fill();
    });
    const mark = (item, colour, diamond, dy) => {
      if (!item) return;
      g.strokeStyle = colour; g.lineWidth = 1.6;
      const xs = item.levels.map(X);
      g.beginPath(); g.moveTo(Math.min(...xs), y0 + dy);
      g.lineTo(Math.max(...xs), y0 + dy); g.stroke();
      item.levels.forEach(v => {
        g.beginPath();
        if (diamond) {
          g.moveTo(X(v), y0 - 8); g.lineTo(X(v) + 6, y0); g.lineTo(X(v), y0 + 8);
          g.lineTo(X(v) - 6, y0); g.closePath();
        } else g.arc(X(v), y0, 7, 0, 7);
        g.stroke();
      });
    };
    mark(fwd.first, '#e07a72', false, 13);   // first mono forward homothet
    mark(rfl.first, '#e0b060', true, -13);   // first mono reflected copy
    g.fillStyle = '#6d7680'; g.font = '10px ui-monospace,monospace';
    g.fillText(String(lo), pad - 4, y0 + 27);
    g.fillText(String(hi), w - pad - 10, y0 + 27);
    if (fwd.first) g.fillText('○ forward (grid line)', pad, 12);
    if (rfl.first) g.fillText('◇ reflected (Rado-only)', pad + 150, 12);
  }

  /* ------------------------------------ intersection graph G([t]^n) */
  let igCache = null, igHover = null;   // {kind:'v'|'e', i}
  function igBuild() {
    const S = state();
    const key = S.t + '|' + S.n;
    if (igCache && igCache.key === key) return igCache;
    const lines = HJ.lines(S.t, S.n, 'comb');
    const sets = lines.map(l => new Set(l.points));
    const edges = [], starOf = lines.map(() => []), wordEdges = new Map();
    for (let i = 0; i < lines.length; i++)
      for (let j = i + 1; j < lines.length; j++) {
        let word = -1, cnt = 0;
        for (const p of lines[i].points)
          if (sets[j].has(p)) { word = p; cnt++; }
        if (cnt === 0) continue;           // Lemma 7.3: cnt is 0 or 1
        const e = { a: i, b: j, word };
        starOf[i].push(edges.length); starOf[j].push(edges.length);
        if (!wordEdges.has(word)) wordEdges.set(word, []);
        wordEdges.get(word).push(edges.length);
        edges.push(e);
      }
    igCache = { key, lines, edges, starOf, wordEdges, pos: [] };
    return igCache;
  }
  function drawIGraph() {
    const cv = $('igraph'); if (!cv) return;
    const S = state(), col = S.col;
    const C = igBuild();
    const { g, w, h } = fit2d(cv, 340);
    g.clearRect(0, 0, w, h);
    const W = HJ.words(S.t, S.n);

    if (S.t === 2) {
      // G_2(n): comparability graph of the Boolean lattice (Prop. 7.1)
      const byLevel = new Map();
      W.forEach((wd, i) => {
        const s = HJ.sigma(wd);
        if (!byLevel.has(s)) byLevel.set(s, []);
        byLevel.get(s).push(i);
      });
      const levels = [...byLevel.keys()].sort((a, b) => a - b);
      const pos = new Map();
      levels.forEach((s, li) => {
        const row = byLevel.get(s);
        const y = h - 46 - li * (h - 84) / Math.max(1, levels.length - 1);
        row.forEach((idx, j) =>
          pos.set(idx, { x: (j + 1) * w / (row.length + 1), y }));
      });
      const chain = [];                          // 1^n, 21^{n−1}, …, 2^n
      for (let k = 0; k <= S.n; k++) {
        const wd = Array.from({ length: S.n }, (_, i) => i < k ? 2 : 1);
        chain.push(HJ.wordIndex(wd, 2));
      }
      const inChain = (a, b) => {
        const ia = chain.indexOf(a), ib = chain.indexOf(b);
        return ia >= 0 && ib >= 0;
      };
      C.lines.forEach(l => {
        const [a, b] = l.points;
        const A = pos.get(a), B = pos.get(b);
        const mono = col[a] === col[b];
        g.strokeStyle = mono ? PAL[col[a]] : 'rgba(139,161,184,.25)';
        g.lineWidth = mono ? 2.3 : 1;
        g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke();
        if (inChain(a, b)) {
          g.strokeStyle = 'rgba(233,228,214,.9)'; g.lineWidth = 1.4;
          g.setLineDash([5, 4]);
          g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke();
          g.setLineDash([]);
        }
      });
      W.forEach((wd, i) => {
        const P = pos.get(i);
        g.beginPath(); g.arc(P.x, P.y, 8, 0, 7);
        g.fillStyle = PAL[col[i]]; g.fill();
        if (chain.includes(i)) {
          g.strokeStyle = '#e9e4d6'; g.lineWidth = 1.6;
          g.beginPath(); g.arc(P.x, P.y, 11, 0, 7); g.stroke();
        }
      });
      igCache.pos = pos;
      $('igraphInfo').innerHTML =
        `G₂(${S.n}) = comparability graph of the Boolean lattice: vertices = the ` +
        `${W.length} words, edges = the ${C.lines.length} lines (comparable pairs). ` +
        `Dashed: a maximal chain w₀ &lt; … &lt; w_${S.n} — a clique K_${S.n + 1}, ` +
        `so χ = ${S.n + 1} by Mirsky and <b>HJ(2, r) = r</b> (Prop. 7.1, Rem. 7.2). ` +
        `Coloured edges are monochromatic lines.`;
      return;
    }

    // t ≥ 3: vertices are the lines, on a circle; edges carry c̃(e) = c(x_e)
    const N = C.lines.length, cx = w / 2, cy = h / 2 + 4,
          R = Math.min(w, h) / 2 - 34;
    const order = C.lines.map((l, i) => i)
      .sort((a, b) => (C.lines[a].active.length - C.lines[b].active.length) ||
                      (C.lines[a].label < C.lines[b].label ? -1 : 1));
    const pos = new Array(N);
    order.forEach((li, j) => {
      const a = -Math.PI / 2 + 2 * Math.PI * j / N;
      pos[li] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
    });
    const hovV = igHover && igHover.kind === 'v' ? igHover.i : -1;
    const hovClass = igHover && igHover.kind === 'e'
      ? new Set(C.wordEdges.get(C.edges[igHover.i].word)) : null;
    C.edges.forEach((e, ei) => {
      const hot = e.a === hovV || e.b === hovV || (hovClass && hovClass.has(ei));
      g.strokeStyle = PAL[col[e.word]];
      g.globalAlpha = hot ? 0.95 : 0.16;
      g.lineWidth = hot ? 2.3 : 1;
      g.beginPath(); g.moveTo(pos[e.a].x, pos[e.a].y);
      g.lineTo(pos[e.b].x, pos[e.b].y); g.stroke();
    });
    g.globalAlpha = 1;
    C.lines.forEach((l, i) => {
      const mono = l.points.every(p => col[p] === col[l.points[0]]);
      g.beginPath(); g.arc(pos[i].x, pos[i].y, i === hovV ? 6 : 4.3, 0, 7);
      g.fillStyle = mono ? PAL[col[l.points[0]]] : '#242d36'; g.fill();
      g.strokeStyle = mono ? '#e9e4d6' : '#4a5561';
      g.lineWidth = mono ? 1.6 : 1; g.stroke();
    });
    igCache.pos = pos;
    const lam = W.map(wd => HJ.typeOf(wd, S.t)
      .reduce((s, m) => s + (m ? Math.pow(2, m) - 1 : 0), 0));
    const base = `G([${S.t}]${'⁰¹²³'[S.n]}): |V| = ${N} lines, |E| = ${C.edges.length} ` +
      `intersecting pairs, each edge coloured by its word, c̃(e) = c(x_e). ` +
      `λ(x) ∈ [${Math.min(...lam)}, ${Math.max(...lam)}] (Lemma 7.4: n ≤ λ ≤ 2ⁿ−1). ` +
      `No K⁽${S.t}⁾_${S.t + 1} (Prop. 7.7)` +
      (S.t === 3 ? ', no Fano (Prop. 7.8).' : '.');
    if (hovV >= 0) {
      const l = C.lines[hovV];
      const starCols = new Set(C.starOf[hovV].map(ei => col[C.edges[ei].word]));
      const sm = starCols.size === 1 && C.starOf[hovV].length > 0;
      const lm = l.points.every(p => col[p] === col[l.points[0]]);
      HJX.boostWords(l.points);
      $('igraphInfo').innerHTML =
        `line <b>${l.label}</b> — star of ${C.starOf[hovV].length} edges over its ` +
        `${S.t} words; star monochromatic: <b>${sm ? 'yes' : 'no'}</b> ⇔ line ` +
        `monochromatic: <b>${lm ? 'yes' : 'no'}</b> ` +
        (sm === lm ? '<span class="ok">✓ (Lemma 7.5)</span>'
                   : '<span class="no">✗</span>');
    } else if (hovClass) {
      const e = C.edges[igHover.i];
      HJX.boostWords([e.word]);
      $('igraphInfo').innerHTML =
        `edge at word <b>${W[e.word].join('')}</b>, colour ${col[e.word]} — its ` +
        `<b>coherence class</b> has ${hovClass.size} edges sharing this word: any ` +
        `graph reformulation of HJ must carry this constraint (Prop. 7.6).`;
    } else $('igraphInfo').innerHTML = base;
  }
  function igHit(x, y) {
    if (!igCache || !igCache.pos) return null;
    const S = state();
    if (S.t === 2) return null;
    let best = null, bd = 81;
    igCache.lines.forEach((l, i) => {
      const P = igCache.pos[i];
      const d = (x - P.x) ** 2 + (y - P.y) ** 2;
      if (d < bd) { bd = d; best = { kind: 'v', i }; }
    });
    if (best) return best;
    let be = null, bde = 6;
    igCache.edges.forEach((e, ei) => {
      const A = igCache.pos[e.a], B = igCache.pos[e.b];
      const vx = B.x - A.x, vy = B.y - A.y, L2 = vx * vx + vy * vy || 1e-9;
      let s = ((x - A.x) * vx + (y - A.y) * vy) / L2;
      s = Math.max(0, Math.min(1, s));
      const d = Math.hypot(x - A.x - s * vx, y - A.y - s * vy);
      if (d < bde) { bde = d; be = { kind: 'e', i: ei }; }
    });
    return be;
  }

  /* -------------------------------------- corner hypergraph C^(t)_n */
  let chCache = null, chHoverCell = null, chHoverTuple = null, k4on = false;
  function cellLayout(t, n, w, h) {
    const pos = new Map(), pad = 22;
    if (t === 2) {
      const cells = HJ.simplex(2, n), cx = w / 2, cy = h / 2 + 6,
            R = Math.min(w, h) / 2 - 40;
      cells.sort((a, b) => a[1] - b[1]).forEach((c, j) => {
        const a = -Math.PI / 2 + 2 * Math.PI * j / cells.length;
        pos.set(esc(c), { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), c });
      });
      return { pos, rad: 10 };
    }
    if (t === 3) {
      const A = { x: pad + 8, y: h - 34 }, B = { x: w - pad - 8, y: h - 34 },
            C = { x: w / 2, y: 26 };
      const m = Math.max(1, n);
      for (const c of HJ.simplex(3, n)) {
        const x = (c[0] * A.x + c[1] * B.x + c[2] * C.x) / m,
              y = (c[0] * A.y + c[1] * B.y + c[2] * C.y) / m;
        pos.set(esc(c), n === 0
          ? { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3, c }
          : { x, y, c });
      }
      return { pos, rad: Math.min(10, (B.x - A.x) / (3 * (n + 1))) };
    }
    const slices = n + 1, sw = (w - 2 * pad) / slices;   // t = 4
    for (let m4 = 0; m4 <= n; m4++) {
      const x0 = pad + m4 * sw, size = n - m4;
      const A = { x: x0 + 8, y: h - 44 }, B = { x: x0 + sw - 16, y: h - 44 },
            C = { x: x0 + sw / 2 - 4, y: 28 };
      const mm = Math.max(1, size);
      for (const c3 of HJ.simplex(3, size)) {
        const cell = [c3[0], c3[1], c3[2], m4];
        const x = (c3[0] * A.x + c3[1] * B.x + c3[2] * C.x) / mm,
              y = (c3[0] * A.y + c3[1] * B.y + c3[2] * C.y) / mm;
        pos.set(esc(cell), size === 0
          ? { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3, c: cell }
          : { x, y, c: cell });
      }
    }
    return { pos, rad: 7, slices: true };
  }
  function chBuild(w, h) {
    const S = state();
    const key = S.t + '|' + S.n + '|' + w;
    if (chCache && chCache.key === key) return chCache;
    const lay = cellLayout(S.t, S.n, w, h);
    const tuples = HJ.cornerTuples(S.t, S.n).map(ct => {
      const keys = ct.cells.map(esc);
      const pts = keys.map(k => lay.pos.get(k));
      return { k: ct.k, v: ct.v, keys, pts,
               cx: pts.reduce((s, p) => s + p.x, 0) / pts.length,
               cy: pts.reduce((s, p) => s + p.y, 0) / pts.length };
    });
    const pencil = new Map();
    tuples.forEach((tp, i) => tp.keys.forEach(k => {
      if (!pencil.has(k)) pencil.set(k, []);
      pencil.get(k).push(i);
    }));
    chCache = { key, lay, tuples, pencil };
    return chCache;
  }
  function k4Tuples(t, n) {                       // Prop. 7.26
    if (n < 2) return null;
    const v0 = new Array(t).fill(0); v0[0] = n - 2;
    const list = [{ k: 2, v: v0.slice() }];
    for (let a = 0; a < t; a++) {
      const v = v0.slice(); v[a] += 1; list.push({ k: 1, v });
    }
    return list.map(x => x.k + '|' + esc(x.v));
  }
  function factorial(m) { let r = 1; for (let i = 2; i <= m; i++) r *= i; return r; }
  function drawCHyper() {
    const cv = $('chyper'); if (!cv) return;
    const S = state();
    const { g, w, h } = fit2d(cv, 340);
    g.clearRect(0, 0, w, h);
    const C = chBuild(w, h);
    const descent = HJ.descentOf(S.col, S.t, S.n);
    const k4 = k4on ? k4Tuples(S.t, S.n) : null;
    const k4set = k4 ? new Set(k4) : null;
    const sharedCells = new Set();
    if (k4) {
      const tks = C.tuples.filter(tp => k4set.has(tp.k + '|' + esc(tp.v)));
      for (let i = 0; i < tks.length; i++)
        for (let j = i + 1; j < tks.length; j++)
          tks[i].keys.forEach(kk => { if (tks[j].keys.includes(kk)) sharedCells.add(kk); });
    }
    let monoCount = 0;
    C.tuples.forEach((tp, i) => {
      const mono = descent && tp.keys.every(k => descent.get(k) === descent.get(tp.keys[0]));
      if (mono) monoCount++;
      const hot = chHoverTuple === i ||
        (chHoverCell !== null && C.pencil.get(chHoverCell).includes(i));
      const special = k4set && k4set.has(tp.k + '|' + esc(tp.v));
      g.beginPath();
      tp.pts.forEach((p, j) => j ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y));
      g.closePath();
      if (mono) {
        const c = PAL[descent.get(tp.keys[0])];
        g.fillStyle = c + '38'; g.fill();
        g.strokeStyle = c; g.lineWidth = 2;
      } else {
        g.strokeStyle = 'rgba(139,161,184,.3)'; g.lineWidth = 1;
      }
      if (hot) { g.strokeStyle = '#e9e4d6'; g.lineWidth = 2.2; }
      if (special) { g.setLineDash([6, 4]); g.strokeStyle = '#e9e4d6'; g.lineWidth = 2.4; }
      g.stroke(); g.setLineDash([]);
    });
    const mixed = new Map();
    if (!descent) HJ.words(S.t, S.n).forEach((wd, i) => {
      const k = esc(HJ.typeOf(wd, S.t));
      if (!mixed.has(k)) mixed.set(k, new Set());
      mixed.get(k).add(S.col[i]);
    });
    for (const [key, P] of C.lay.pos) {
      g.beginPath(); g.arc(P.x, P.y, C.lay.rad, 0, 7);
      if (descent) { g.fillStyle = PAL[descent.get(key)]; g.fill(); }
      else {
        const set = mixed.get(key);
        if (set.size === 1) { g.fillStyle = PAL[[...set][0]]; g.fill(); }
        else {
          g.fillStyle = '#242d36'; g.fill();
          g.strokeStyle = '#4a5561'; g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(P.x - 4, P.y + 4); g.lineTo(P.x + 4, P.y - 4); g.stroke();
        }
      }
      if (sharedCells.has(key) || chHoverCell === key) {
        g.strokeStyle = '#e9e4d6'; g.lineWidth = 1.8;
        g.beginPath(); g.arc(P.x, P.y, C.lay.rad + 3.5, 0, 7); g.stroke();
      }
    }
    if (C.lay.slices) {
      g.fillStyle = '#6d7680'; g.font = '10px ui-monospace,monospace';
      const sw = (w - 44) / (S.n + 1);
      for (let m4 = 0; m4 <= S.n; m4++)
        g.fillText('a₄=' + m4, 22 + m4 * sw + sw / 2 - 14, h - 20);
    }
    // info lines
    const nb = HJ.binom;
    $('chyperStats').innerHTML =
      `|V| = C(${S.n + S.t - 1},${S.t - 1}) = <b>${nb(S.n + S.t - 1, S.t - 1)}</b> cells · ` +
      `|E| = C(${S.n + S.t - 1},${S.t}) = <b>${nb(S.n + S.t - 1, S.t)}</b> corner tuples · ` +
      `every cell in exactly n = ${S.n} edges, distinct edges share ≤ 1 cell ` +
      `(Lemmas 7.19, 7.12)` +
      (descent
        ? ` · monochromatic tuples: <b>${monoCount}</b> — the descent is a proper weak ` +
          `colouring of C⁽${S.t}⁾_${S.n} ⇔ this is 0 (Thm 7.21 ii)`
        : ` · <span style="color:var(--faint)">colouring not symmetric — C⁽ᵗ⁾ₙ is ` +
          `coloured by descents (Lemma 2.4); mixed cells grey</span>`);
    const b = $('b-k4');
    if (b) {
      b.disabled = S.n < 2;
      b.textContent = (k4on ? 'hide' : 'show') + ` the clean K_${S.t + 1} (Prop. 7.26)`;
    }
    if (chHoverCell !== null) {
      const cell = C.lay.pos.get(chHoverCell).c;
      const orbit = factorial(S.n) / cell.reduce((p, a) => p * factorial(a), 1);
      const idxs = [];
      HJ.words(S.t, S.n).forEach((wd, i) => {
        if (esc(HJ.typeOf(wd, S.t)) === chHoverCell) idxs.push(i);
      });
      HJX.boostWords(idxs);
      $('chyperInfo').innerHTML =
        `cell (${cell.join(',')}) — orbit of ${orbit} word${orbit > 1 ? 's' : ''}; its ` +
        `<b>pencil</b> is the ${S.n} highlighted tuples, pairwise meeting only here: ` +
        `a complete K_${S.n} (Lemma 7.19).`;
    } else if (chHoverTuple !== null) {
      const tp = C.tuples[chHoverTuple];
      const orbitLines = factorial(S.n) /
        (factorial(tp.k) * tp.v.reduce((p, a) => p * factorial(a), 1));
      const idxs = new Set();
      HJ.words(S.t, S.n).forEach((wd, i) => {
        if (tp.keys.includes(esc(HJ.typeOf(wd, S.t)))) idxs.add(i);
      });
      HJX.boostWords([...idxs]);
      $('chyperInfo').innerHTML =
        `C<sub>k,v</sub> with k = ${tp.k}, v = (${tp.v.join(',')}) — the S<sub>n</sub>-orbit ` +
        `of <b>${orbitLines}</b> line${orbitLines > 1 ? 's' : ''}; monochromatic ⇔ every ` +
        `line of the orbit is (Prop. 7.13).`;
    } else if (k4on && S.n >= 2) {
      $('chyperInfo').innerHTML =
        `dashed: B = C<sub>2,v₀</sub> and A<sub>a</sub> = C<sub>1,v₀+e_a</sub> with ` +
        `v₀ = (n−2)e₁ — pairwise intersections A_a∩B = {v₀+2e_a}, A_a∩A_b = {v₀+e_a+e_b} ` +
        `are the ${sharedCells.size} ringed cells, all distinct: a loopless cell-rainbow ` +
        `K_${S.t + 1} in every dimension (Prop. 7.26).`;
    } else {
      $('chyperInfo').innerHTML =
        `hover a cell (its pencil, Lemma 7.19) or a tuple (its line orbit, Prop. 7.13)` +
        (S.t === 3 ? ' — for t = 3 these are the upward triangles of the corners ' +
                     'configuration (Ajtai–Szemerédi, Def. 7.18)' : '') + '.';
    }
    const lll = 2 + Math.floor((Math.pow(S.r, S.t - 1) / Math.E - 1) / S.t);
    const el = $('lllVal');
    if (el) el.innerHTML = `at the current (t, r) = (${S.t}, ${S.r}): ` +
      `HJ<sub>sym</sub> ≥ 2 + ⌊(r<sup>t−1</sup>/e − 1)/t⌋ = <b>${lll}</b>` +
      (lll <= 2 ? ' — vacuous at small parameters (Rem. 7.29); the bound is asymptotic in r'
                : '');
  }
  function chHit(x, y) {
    if (!chCache) return { cell: null, tuple: null };
    for (const [key, P] of chCache.lay.pos)
      if (Math.hypot(x - P.x, y - P.y) <= chCache.lay.rad + 4)
        return { cell: key, tuple: null };
    let best = null, bd = 15;
    chCache.tuples.forEach((tp, i) => {
      const d = Math.hypot(x - tp.cx, y - tp.cy);
      if (d < bd) { bd = d; best = i; }
    });
    return { cell: null, tuple: best };
  }

  /* ------------------------------------------------------- wiring */
  function bindCanvas(cv, onMove, onLeave) {
    if (!cv) return;
    cv.addEventListener('mousemove', e => {
      const r = cv.getBoundingClientRect();
      onMove(e.clientX - r.left, e.clientY - r.top);
    });
    cv.addEventListener('mouseleave', onLeave);
  }
  bindCanvas($('igraph'), (x, y) => {
    const hit = igHit(x, y);
    const same = JSON.stringify(hit) === JSON.stringify(igHover);
    if (!same) { igHover = hit; drawIGraph(); if (!hit) HJX.clearBoost(); }
  }, () => { igHover = null; HJX.clearBoost(); drawIGraph(); });
  bindCanvas($('chyper'), (x, y) => {
    const hit = chHit(x, y);
    if (hit.cell !== chHoverCell || hit.tuple !== chHoverTuple) {
      chHoverCell = hit.cell; chHoverTuple = hit.tuple;
      if (!hit.cell && hit.tuple === null) HJX.clearBoost();
      drawCHyper();
    }
  }, () => { chHoverCell = null; chHoverTuple = null; HJX.clearBoost(); drawCHyper(); });
  const bk4 = $('b-k4');
  if (bk4) bk4.addEventListener('click', () => { k4on = !k4on; drawCHyper(); });

  function updateAll() {
    igCache = null; chCache = null;      // parameters/colours may have changed
    igHover = null; chHoverCell = null; chHoverTuple = null;
    drawIGraph(); drawCHyper(); updateRado();
  }
  HJX.onRefresh.push(updateAll);
  ['igraph', 'chyper', 'radoStrip'].forEach(id => {
    const el = $(id);
    if (el) new ResizeObserver(() => { igCache = null; chCache = null;
      drawIGraph(); drawCHyper(); updateRado(); }).observe(el);
  });
  updateAll();
})();
