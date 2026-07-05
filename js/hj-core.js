/* =====================================================================
   HJ core — the mathematics of the Hales–Jewett explorer
   ---------------------------------------------------------------------
   Mirrors python/hj.py; implements, from the thesis's definitions:
   words & the type map (Lemma 2.4), weight functionals (§2.2),
   the four line families of Chapter 6, the bracket L^[K] and interval
   L^(q) restrictions (Chapter 4), colouring classes sum ⊆ ow ⊆ sym ⊆ all
   (Def. 2.6/2.8), the simplex reduction via corner tuples (Lemma 3.1),
   and exact backtracking counters (Appendix A.4 census).
   Colours are 0..r−1; a colouring is an array of length t^n.
   ===================================================================== */
'use strict';
const HJ = (() => {

  // ---------- words and the type map --------------------------------
  function words(t, n) {
    const out = [], w = new Array(n).fill(1);
    const total = Math.pow(t, n);
    for (let ix = 0; ix < total; ix++) {
      out.push(w.slice());
      for (let i = 0; i < n; i++) {
        if (w[i] < t) { w[i]++; break; }
        w[i] = 1;
      }
    }
    return out;              // index order: coordinate 0 least significant
  }
  function wordIndex(w, t) {
    let ix = 0, p = 1;
    for (let i = 0; i < w.length; i++) { ix += (w[i] - 1) * p; p *= t; }
    return ix;
  }
  function typeOf(w, t) {
    const tp = new Array(t).fill(0);
    for (const a of w) tp[a - 1]++;
    return tp;
  }
  const sigma = w => w.reduce((s, a) => s + a, 0);
  function simplex(t, n) {           // T^(t)_n
    const cells = [];
    (function rec(prefix, rem, slots) {
      if (slots === 1) { cells.push(prefix.concat([rem])); return; }
      for (let v = 0; v <= rem; v++) rec(prefix.concat([v]), rem - v, slots - 1);
    })([], n, t);
    return cells;
  }
  const weightF = (omega, tp) => tp.reduce((s, a, j) => s + omega[j] * a, 0);
  const cellKey = c => c.join(',');
  const binom = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return Math.round(r); };

  // ---------- lines ---------------------------------------------------
  function nIntervals(active) {
    let runs = 0, prev = null;
    for (const i of active) { if (prev === null || i !== prev + 1) runs++; prev = i; }
    return runs;
  }
  function mkLine(points, active, family, label, invariant) {
    return { points, active, family, label, invariant: invariant || null,
             key: points.slice().sort((a, b) => a - b).join('-'),
             nIntervals: nIntervals(active) };
  }

  function combinatorialLines(t, n) {         // roots over [t] ∪ {∗}
    const lines = [], syms = t + 1;           // symbol t (0-based) = ∗
    const total = Math.pow(syms, n), root = new Array(n);
    for (let code = 0; code < total; code++) {
      let c = code, star = false;
      for (let i = 0; i < n; i++) { root[i] = c % syms; c = (c / syms) | 0; if (root[i] === t) star = true; }
      if (!star) continue;
      const active = [];
      for (let i = 0; i < n; i++) if (root[i] === t) active.push(i);
      const pts = [];
      for (let a = 1; a <= t; a++) {
        const w = root.map(s => s === t ? a : s + 1);
        pts.push(wordIndex(w, t));
      }
      const v = new Array(t).fill(0);
      for (const s of root) if (s !== t) v[s]++;
      const label = root.map(s => s === t ? '∗' : String(s + 1)).join('');
      lines.push(mkLine(pts, active, 'comb', label, { k: active.length, v }));
    }
    return lines;
  }

  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const units = t => { const u = []; for (let x = 1; x < t; x++) if (gcd(x, t) === 1) u.push(x); return u; };
  const toLetter = (res, t) => { const r = ((res % t) + t) % t; return r === 0 ? t : r; };

  function cosetLines(t, n, dirs, family) {
    const seen = new Map();
    const bases = words(t, n).map(w => w.map(a => a % t)); // residues
    for (const v of dirs) {
      for (const a of bases) {
        const pts = [];
        for (let k = 0; k < t; k++) {
          const w = new Array(n);
          for (let i = 0; i < n; i++) w[i] = toLetter(a[i] + k * v[i], t);
          pts.push(wordIndex(w, t));
        }
        const key = pts.slice().sort((x, y) => x - y).join('-');
        if (seen.has(key)) continue;
        const active = [];
        for (let i = 0; i < n; i++) if (v[i] % t !== 0) active.push(i);
        const base = a.map(x => toLetter(x, t)).join('');
        seen.set(key, mkLine(pts, active, family,
          'a=' + base + ', v=(' + v.join(',') + ')'));
      }
    }
    return Array.from(seen.values());
  }
  function vectorsOver(alphabet, n) {         // all non-zero vectors
    const out = [], total = Math.pow(alphabet.length, n), v = new Array(n);
    for (let code = 0; code < total; code++) {
      let c = code, nz = false;
      for (let i = 0; i < n; i++) { v[i] = alphabet[c % alphabet.length]; c = (c / alphabet.length) | 0; if (v[i] !== 0) nz = true; }
      if (nz) out.push(v.slice());
    }
    return out;
  }
  const unitLines   = (t, n) => cosetLines(t, n, vectorsOver([0, 1], n), 'unit');
  const cyclicLines = (t, n) => cosetLines(t, n, vectorsOver([0].concat(units(t)), n), 'cyc');

  function geometricLines(t, n) {             // ± roots: ∗ ascends, ∗̄ descends
    const seen = new Map(), syms = t + 2;     // t → '+', t+1 → '−'
    const total = Math.pow(syms, n), root = new Array(n);
    for (let code = 0; code < total; code++) {
      let c = code, star = false;
      for (let i = 0; i < n; i++) { root[i] = c % syms; c = (c / syms) | 0; if (root[i] >= t) star = true; }
      if (!star) continue;
      const pts = [];
      for (let k = 1; k <= t; k++) {
        const w = root.map(s => s === t ? k : s === t + 1 ? t + 1 - k : s + 1);
        pts.push(wordIndex(w, t));
      }
      const key = pts.slice().sort((x, y) => x - y).join('-');
      if (seen.has(key)) continue;
      const active = [];
      for (let i = 0; i < n; i++) if (root[i] >= t) active.push(i);
      const label = root.map(s => s === t ? '∗' : s === t + 1 ? '∗\u0304' : String(s + 1)).join('');
      seen.set(key, mkLine(pts, active, 'geom', label));
    }
    return Array.from(seen.values());
  }

  const FAMILIES = { comb: combinatorialLines, unit: unitLines,
                     geom: geometricLines, cyc: cyclicLines };

  function lines(t, n, family, K, q) {
    let ls = FAMILIES[family](t, n);
    if (K != null) ls = ls.filter(l => l.active.length <= K);
    if (q != null) ls = ls.filter(l => l.nIntervals <= q);
    return ls;
  }
  function lineCountFormula(t, n, family) {
    const phi = units(t).length;
    if (family === 'comb') return Math.pow(t + 1, n) - Math.pow(t, n);
    if (family === 'unit') return (Math.pow(2, n) - 1) * Math.pow(t, n - 1);
    if (family === 'geom') return (Math.pow(t + 2, n) - Math.pow(t, n)) / 2;
    if (family === 'cyc')  return (Math.pow(phi + 1, n) - 1) / phi * Math.pow(t, n - 1);
  }

  // ---------- colourings ---------------------------------------------
  const randomColouring = (t, n, r, rnd) =>
    Array.from({ length: Math.pow(t, n) }, () => Math.floor((rnd || Math.random)() * r));
  function liftDescent(descent, t, n) {       // descent: Map cellKey → colour
    return words(t, n).map(w => descent.get(cellKey(typeOf(w, t))));
  }
  function randomSymmetric(t, n, r, rnd) {
    const d = new Map();
    for (const cell of simplex(t, n)) d.set(cellKey(cell), Math.floor((rnd || Math.random)() * r));
    return liftDescent(d, t, n);
  }
  const oneWeight = (t, n, omega, chi) =>
    words(t, n).map(w => chi(weightF(omega, typeOf(w, t))));
  const sumType = (t, n, chi) =>
    oneWeight(t, n, Array.from({ length: t }, (_, i) => i + 1), chi);
  const periodic = pattern => x => pattern[((x % pattern.length) + pattern.length) % pattern.length];

  function descentOf(col, t, n) {             // Map or null (Lemma 2.4)
    const d = new Map();
    const W = words(t, n);
    for (const w of W) {
      const k = cellKey(typeOf(w, t)), c = col[wordIndex(w, t)];
      if (d.has(k)) { if (d.get(k) !== c) return null; } else d.set(k, c);
    }
    return d;
  }
  const isSymmetric = (col, t, n) => descentOf(col, t, n) !== null;

  function permutations(n) {
    if (n === 1) return [[0]];
    const smaller = permutations(n - 1), out = [];
    for (const p of smaller) for (let i = 0; i <= p.length; i++)
      out.push(p.slice(0, i).concat([n - 1], p.slice(i)));
    return out;
  }
  function stabilizerClass(col, t, n) {       // Table A.5 vocabulary
    const W = words(t, n);
    let m = 0;
    for (const perm of permutations(n)) {
      let fix = true;
      for (const w of W) {
        const pw = perm.map(i => w[i]);
        if (col[wordIndex(pw, t)] !== col[wordIndex(w, t)]) { fix = false; break; }
      }
      if (fix) m++;
    }
    if (n === 3) return { 6: 'S₃ — symmetric', 3: 'C₃ — cyclic',
                          2: 'C₂ — block-symmetric', 1: '1 — asymmetric' }[m];
    if (n === 2) return m === 2 ? 'S₂ — symmetric' : '1 — asymmetric';
    return 'S₁ — symmetric';
  }

  // ---------- checking -------------------------------------------------
  function monoLines(col, ls) {
    return ls.filter(l => l.points.every(p => col[p] === col[l.points[0]]));
  }
  function rainbowLines(col, ls) {
    return ls.filter(l => new Set(l.points.map(p => col[p])).size === l.points.length);
  }

  // ---------- simplex reduction ---------------------------------------
  function cornerTuples(t, n, K) {
    K = K == null ? n : Math.min(K, n);
    const out = [];
    for (let k = 1; k <= K; k++)
      for (const v of simplex(t, n - k)) {
        const cells = [];
        for (let a = 0; a < t; a++) { const c = v.slice(); c[a] += k; cells.push(c); }
        out.push({ k, v, cells });
      }
    return out;
  }
  function monoCorners(descent, t, n, K) {
    return cornerTuples(t, n, K).filter(ct => {
      const c0 = descent.get(cellKey(ct.cells[0]));
      return ct.cells.every(c => descent.get(cellKey(c)) === c0);
    });
  }

  // ---------- exact backtracking counters ------------------------------
  // Generic not-all-equal counting over `groups` of variables 0..N−1.
  // opts: { r, deadline (ms epoch), maxSolutions, forcedEqual: Set of vars
  //         allowed to be monochromatic (their group is forced equal),
  //         onSolution(colour) }
  function countNAE(N, groups, opts) {
    const r = opts.r;
    const at = Array.from({ length: N }, () => []);
    groups.forEach((g, gi) => g.forEach(p => at[p].push(gi)));
    const colour = new Array(N).fill(-1);
    const remaining = groups.map(g => g.length);
    const seenCount = groups.map(() => new Array(r).fill(0));
    const seenDistinct = groups.map(() => 0);
    const forced = opts.forcedEqual || null;
    const forcedKey = forced ? Array.from(forced).sort((a, b) => a - b).join('-') : null;
    const isForcedGroup = groups.map(g =>
      forcedKey !== null && g.slice().sort((a, b) => a - b).join('-') === forcedKey);
    const order = Array.from({ length: N }, (_, i) => i)
      .sort((a, b) => at[b].length - at[a].length);
    let count = 0, nodes = 0, exhausted = true;
    const deadline = opts.deadline || Infinity;
    const maxSol = opts.maxSolutions || Infinity;

    function rec(i) {
      if (!exhausted || count >= maxSol) { exhausted = exhausted && count < maxSol ? exhausted : false; return; }
      if (i === N) { count++; if (opts.onSolution) opts.onSolution(colour.slice()); return; }
      const p = order[i];
      if ((++nodes & 1023) === 0 && Date.now() > deadline) { exhausted = false; return; }
      let choices = null;
      if (forced && forced.has(p)) {
        for (const x of forced) if (colour[x] >= 0) { choices = [colour[x]]; break; }
      }
      for (let c = 0; c < r; c++) {
        if (choices && choices[0] !== c) continue;
        let bad = false;
        for (const gi of at[p]) {
          if (isForcedGroup[gi]) continue;               // must be mono
          if (remaining[gi] === 1 && seenDistinct[gi] === 1 && seenCount[gi][c] > 0) { bad = true; break; }
        }
        if (bad) continue;
        colour[p] = c;
        for (const gi of at[p]) { remaining[gi]--; if (seenCount[gi][c]++ === 0) seenDistinct[gi]++; }
        rec(i + 1);
        colour[p] = -1;
        for (const gi of at[p]) { remaining[gi]++; if (--seenCount[gi][c] === 0) seenDistinct[gi]--; }
        if (!exhausted || count >= maxSol) return;
      }
    }
    rec(0);
    return { count, exhausted: exhausted && count < maxSol, nodes,
             capped: count >= maxSol };
  }

  function countLineFree(t, n, r, family, K, q, budgetMs, maxSolutions, onSolution, forcedEqual) {
    const ls = lines(t, n, family || 'comb', K, q).map(l => l.points);
    return countNAE(Math.pow(t, n), ls,
      { r, deadline: budgetMs ? Date.now() + budgetMs : Infinity,
        maxSolutions, onSolution, forcedEqual });
  }
  function countLineFreeSymmetric(t, n, r, K, budgetMs) {
    const cells = simplex(t, n), idx = new Map();
    cells.forEach((c, i) => idx.set(cellKey(c), i));
    const groups = cornerTuples(t, n, K).map(ct => ct.cells.map(c => idx.get(cellKey(c))));
    return countNAE(cells.length, groups,
      { r, deadline: budgetMs ? Date.now() + budgetMs : Infinity });
  }
  function findLineFree(t, n, r, family, K, q, budgetMs) {
    let sol = null;
    const res = countLineFree(t, n, r, family, K, q, budgetMs, 1, c => { sol = c; });
    return { colouring: sol, searched: res.exhausted || sol !== null };
  }
  function findDiagonalOnly(t, n, r, budgetMs) {
    const diag = new Set();
    for (let a = 1; a <= t; a++) diag.add(wordIndex(new Array(n).fill(a), t));
    let sol = null;
    const res = countLineFree(t, n, r, 'comb', null, null, budgetMs, 1,
      c => { sol = c; }, diag);
    return { colouring: sol, searched: res.exhausted || sol !== null };
  }

  // min number of monochromatic lines over all colourings (brute force,
  // only for tiny r^{t^n}) — Prop 7.9 style
  function minMonochromatic(t, n, r, family, K, q, cap) {
    const N = Math.pow(t, n), total = Math.pow(r, N);
    if (total > (cap || 3e6)) return null;
    const ls = lines(t, n, family, K, q);
    let best = Infinity;
    const col = new Array(N).fill(0);
    for (let m = 0; m < total; m++) {
      let x = m;
      for (let i = 0; i < N; i++) { col[i] = x % r; x = (x / r) | 0; }
      let k = 0;
      for (const l of ls) {
        const c0 = col[l.points[0]];
        let mono = true;
        for (const p of l.points) if (col[p] !== c0) { mono = false; break; }
        if (mono && ++k >= best) break;
      }
      if (k < best) { best = k; if (best === 0) break; }
    }
    return best;
  }

  // realized levels of a weight on T^(t)_n  (the level strip, Lemma 2.14)
  function realizedLevels(t, n, omega) {
    const s = new Set();
    for (const cell of simplex(t, n)) s.add(weightF(omega, cell));
    return Array.from(s).sort((a, b) => a - b);
  }

  return { words, wordIndex, typeOf, sigma, simplex, weightF, cellKey, binom,
           combinatorialLines, unitLines, geometricLines, cyclicLines,
           lines, lineCountFormula, units,
           randomColouring, liftDescent, randomSymmetric, oneWeight, sumType,
           periodic, descentOf, isSymmetric, stabilizerClass,
           monoLines, rainbowLines,
           cornerTuples, monoCorners,
           countLineFree, countLineFreeSymmetric, findLineFree,
           findDiagonalOnly, minMonochromatic, realizedLevels };
})();
if (typeof module !== 'undefined') module.exports = HJ;
