'use strict';
const HJ = require('./hj-core.js');
let ok = 0;
function check(name, cond) {
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${name}`);
  if (!cond) process.exit(1); ok++;
}
const setOf = ls => new Set(ls.map(l => l.key));
const subset = (a, b) => [...a].every(x => b.has(x));

// 1. counts vs formulas + containments
for (const t of [2, 3, 4]) for (const n of [1, 2, 3]) {
  for (const fam of ['comb', 'unit', 'geom', 'cyc'])
    check(`count ${fam} t=${t} n=${n}`,
      HJ.lines(t, n, fam).length === HJ.lineCountFormula(t, n, fam));
  const comb = setOf(HJ.lines(t, n, 'comb')), unit = setOf(HJ.lines(t, n, 'unit')),
        geom = setOf(HJ.lines(t, n, 'geom')), cyc = setOf(HJ.lines(t, n, 'cyc'));
  check(`containments t=${t} n=${n}`,
    subset(comb, unit) && subset(unit, cyc) && subset(geom, cyc) && subset(comb, geom));
  if (t === 2) check(`t=2 collapse n=${n}`,
    unit.size === geom.size && geom.size === cyc.size && subset(unit, cyc) && subset(geom, cyc));
}

// bracket / interval sanity on [3]^3
const l33 = HJ.lines(3, 3, 'comb');
check('L^[1]([3]^3) = 27', l33.filter(l => l.active.length <= 1).length === 27);
check('interval: only active {0,2} is 2-fold',
  l33.filter(l => l.nIntervals > 1).every(l => l.active.join(',') === '0,2'));

// 2. certificates
const mono = (col, t, n, fam, K, q) => HJ.monoLines(col, HJ.lines(t, n, fam || 'comb', K, q)).length;
const halb = HJ.sumType(3, 3, s => Math.floor((s % 4) / 2));
check('Prop 3.14 line-free on [3]^3', mono(halb, 3, 3) === 0);
check('Prop 3.14 symmetric', HJ.isSymmetric(halb, 3, 3));
for (const r of [2, 3, 4])
  check(`Prop 2.2 σ mod ${r} on [2]^${r - 1}`,
    mono(HJ.sumType(2, r - 1, s => s % r), 2, r - 1) === 0);
const psi13 = HJ.periodic([1,0,0,1,0,1,0,0,1,2,2,2,2]);
check('Thm 4.10 (0,5,7)/ψ13 line-free on [3]^3',
  mono(HJ.oneWeight(3, 3, [0,5,7], psi13), 3, 3) === 0);
const chi0 = x => [4,5,7,9,11,12].includes(((x % 13) + 13) % 13) ? 1 : 0;
check('Thm 4.11 (0,2,3,5)/χ0 line-free on [4]^3',
  mono(HJ.oneWeight(4, 3, [0,2,3,5], chi0), 4, 3) === 0);
const rec26 = HJ.periodic([1,0,1,0,0,1,1,1,1,0,0,1,0,0,0,1,0,0,1,1,1,1,0,0,1,0]);
check('Thm 3.10 record palette line-free on [4]^3',
  mono(HJ.oneWeight(4, 3, [0,2,3,5], rec26), 4, 3) === 0);
check('Prop 4.5 palette line-free on [3]^3',
  mono(HJ.sumType(3, 3, HJ.periodic([2,0,1,2,1,1,0,1,2,0,0,2])), 3, 3) === 0);
for (const t of [3, 4]) {
  const col = HJ.words(t, 2).map(w => ((w[0] % t) + (w[1] % t)) % t <= 1 ? 1 : 0);
  check(`Prop 6.6 unit-line-free on Z_${t}^2`, mono(col, t, 2, 'unit') === 0);
}
const par43 = HJ.sumType(4, 3, s => s % 2);
check('Prop 4.1 parity avoids L^[1] on [4]^3', mono(par43, 4, 3, 'comb', 1) === 0);
check('… but not L^[2]', mono(par43, 4, 3, 'comb', 2) > 0);
// Table A.1 slice
const tail = { 18: '1001', 19: '120', 20: '20', 21: '0' };
const d = new Map();
for (const cell of HJ.simplex(3, 3)) d.set(HJ.cellKey(cell), +tail[18 + cell[0]][cell[1]]);
check('Table A.1 slice line-free on [3]^3', mono(HJ.liftDescent(d, 3, 3), 3, 3) === 0);

// 3. Lemma 3.1 equivalence on random symmetric colourings
let lemmaOK = true;
for (let trial = 0; trial < 200; trial++) {
  const t = 2 + (trial % 3), n = 1 + ((trial * 7) % 3), r = 2 + (trial % 2);
  const col = HJ.randomSymmetric(t, n, r);
  const desc = HJ.descentOf(col, t, n);
  const g = new Set(HJ.monoLines(col, HJ.lines(t, n, 'comb'))
                      .map(l => l.invariant.k + '|' + l.invariant.v.join(',')));
  const s = new Set(HJ.monoCorners(desc, t, n).map(ct => ct.k + '|' + ct.v.join(',')));
  if (g.size !== s.size || ![...g].every(x => s.has(x))) { lemmaOK = false; break; }
}
check('Lemma 3.1: mono line invariants = mono corners (200 trials)', lemmaOK);
for (const t of [2, 3, 4]) for (const n of [1, 2, 3])
  check(`#corner tuples = C(n+t−1, t) at t=${t}, n=${n}`,
    HJ.cornerTuples(t, n).length === HJ.binom(n + t - 1, t));

// 4. census (Appendix A.4)
let r1 = HJ.countLineFree(3, 3, 2, 'comb');
check(`census: ${r1.count} line-free 2-colourings of [3]^3 = 1644`,
  r1.exhausted && r1.count === 1644);
let r2 = HJ.countLineFreeSymmetric(3, 3, 2);
check(`census: ${r2.count} symmetric = 36`, r2.exhausted && r2.count === 36);
const tally = {};
HJ.countLineFree(3, 3, 2, 'comb', null, null, null, null, c => {
  const k = HJ.stabilizerClass(c, 3, 3).split(' ')[0];
  tally[k] = (tally[k] || 0) + 1;
});
check(`census stabilizers ${JSON.stringify(tally)}`,
  tally['S₃'] === 36 && tally['C₂'] === 504 && tally['C₃'] === 24 && tally['1'] === 1080);
const diag = new Set([0, 1, 2].map(a => HJ.wordIndex([a + 1, a + 1, a + 1], 3)));
let r3 = HJ.countLineFree(3, 3, 2, 'comb', null, null, null, null, null, diag);
check(`census: ${r3.count} diagonal-only = 6456`, r3.exhausted && r3.count === 6456);

// 5. cyclic numbers at (3,2)
check('Z_3^2 has 12 cyclic lines', HJ.lines(3, 2, 'cyc').length === 12);
let free22 = HJ.findLineFree(3, 2, 2, 'cyc');
check('HJ_cyc(3,2)=2: no cyclic-line-free 2-colouring of Z_3^2',
  free22.colouring === null && free22.searched);
check('min mono cyclic lines on Z_3^2 = 2 (Prop 7.9)',
  HJ.minMonochromatic(3, 2, 2, 'cyc') === 2);
check('Z_3^1 cyclic-line-free 2-colourable',
  HJ.findLineFree(3, 1, 2, 'cyc').colouring !== null);

// 6. finders
const f = HJ.findLineFree(3, 3, 2, 'comb');
check('finder produces a line-free colouring of [3]^3',
  f.colouring && mono(f.colouring, 3, 3) === 0);
const dOnly = HJ.findDiagonalOnly(3, 3, 2);
check('diagonal-only finder works',
  dOnly.colouring &&
  HJ.monoLines(dOnly.colouring, HJ.lines(3, 3, 'comb')).length === 1 &&
  HJ.monoLines(dOnly.colouring, HJ.lines(3, 3, 'comb'))[0].active.length === 3);

// 7. levels
check('realized levels of (0,1,29) on T_3 injective (radix, Thm 3.5)',
  HJ.realizedLevels(3, 3, [0, 1, 29]).length === HJ.simplex(3, 3).length);

console.log(`\nAll ${ok} checks passed.`);
