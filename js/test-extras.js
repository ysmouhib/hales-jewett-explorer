'use strict';
const HJ = require('./hj-core.js');
const P = require('./extras.js');
let ok = 0;
function check(name, cond){ console.log(`[${cond?'PASS':'FAIL'}] ${name}`); if(!cond) process.exit(1); ok++; }

// Rado systems (Prop 2.19 / Example 2.20)
const eq013 = P.radoEquations([0,1,3]);
check('E_s for {0,1,3} is z + 2x = 3y (one equation)',
  eq013.length === 1 && eq013[0].text === '2·X₁ + X₃ = 3·X₂');
const eq025 = P.radoEquations([0,2,5]);
check('E_s for {0,2,5}: 3·X₁ + 2·X₃ = 5·X₂',
  eq025.length === 1 && eq025[0].text === '3·X₁ + 2·X₃ = 5·X₂');
const eq0235 = P.radoEquations([0,2,3,5]);
check('E_s for {0,2,3,5}: two staggered equations',
  eq0235.length === 2 &&
  eq0235[0].text === 'X₁ + 2·X₃ = 3·X₂' &&
  eq0235[1].text === '2·X₂ + X₄ = 3·X₃');
// solutions a·1 + d·s satisfy every derived equation
for (const S0 of [[0,1,3],[0,2,5],[0,1,4],[0,2,3,5],[0,1,5,6]]) {
  const eqs = P.radoEquations(S0);
  let good = true;
  for (let a = -3; a <= 3; a++) for (let d = -3; d <= 3; d++) {
    const X = S0.map(s => a + d*s);
    for (const e of eqs) {
      const val = e.coef.reduce((s,c,j)=>s+c*X[e.vars[j]],0);
      if (val !== 0) good = false;
    }
  }
  check(`a·1 + d·s solves E_s for S0={${S0}}`, good);
}
// normalisation (Lemma 2.17)
const nrm = P.normaliseS([10, 4, 16, 4]);
check('normaliseS: {4,10,16} → {0,1,2}, degenerate detected',
  nrm.raw.join(',')==='4,10,16' && nrm.S0.join(',')==='0,1,2');

// Lemma 2.14: forward-scan boolean == grid mono boolean (200 random ow colourings)
let agree = true;
for (let trial = 0; trial < 200; trial++) {
  const t = 2 + (trial % 3), n = 1 + ((trial*5) % 3), r = 2 + (trial % 3);
  // random weight with t distinct values
  const vals = new Set(); while (vals.size < t) vals.add(Math.floor(Math.random()*11)-3);
  const omega = [...vals];
  const map = new Map();
  HJ.realizedLevels(t, n, omega).forEach(l => map.set(l, Math.floor(Math.random()*r)));
  const chi = x => map.has(x) ? map.get(x) : 0;
  const col = HJ.oneWeight(t, n, omega, chi);
  const fwd = P.homothetScan(HJ, t, n, omega, chi, false);
  const grid = HJ.monoLines(col, HJ.lines(t, n, 'comb')).length;
  if ((fwd.count > 0) !== (grid > 0)) { agree = false; break; }
}
check('Lemma 2.14: forward homothet classes ⇔ grid mono lines (200 trials)', agree);

// the Rem. 2.24 gap: line-free yet reflected copies present (ω=(0,1,3))
let found = false;
for (let trial = 0; trial < 4000 && !found; trial++) {
  const map = new Map();
  HJ.realizedLevels(3, 3, [0,1,3]).forEach(l => map.set(l, Math.floor(Math.random()*4)));
  const chi = x => map.get(x) ?? 0;
  const f = P.homothetScan(HJ, 3, 3, [0,1,3], chi, false);
  const rf = P.homothetScan(HJ, 3, 3, [0,1,3], chi, true);
  if (f.count === 0 && rf.count > 0) found = true;
}
check('gap of Rem. 2.24 realisable: forward-free palette with reflected copies', found);

// KNOWN_G rows are internally consistent: bound = ceil((G-1)/D)
for (const [key, row] of Object.entries(P.KNOWN_G)) {
  const S0 = key.split('|')[1].split(',').map(Number);
  const D = S0[S0.length-1];
  if (row.G.startsWith('≥')) continue;
  const G = +row.G, want = Math.ceil((G-1)/D);
  check(`Thm 2.15 ceiling for ${key}: ⌈(${G}−1)/${D}⌉ = ${row.bound}`, want === +row.bound);
}
console.log(`\nAll ${ok} extras checks passed.`);
