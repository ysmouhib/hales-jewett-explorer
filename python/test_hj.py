"""Verification battery for hj.py against the thesis.  Run: python3 test_hj.py"""
import random
import hj

ok = 0
def check(name, cond):
    global ok
    status = 'PASS' if cond else 'FAIL'
    print(f'[{status}] {name}')
    if cond: ok += 1
    else: raise SystemExit(f'FAILED: {name}')

# ---- 1. line counts against the closed forms of Section 6.1 ----------
for t in (2, 3, 4):
    for n in (1, 2, 3):
        for fam in ('comb', 'unit', 'geom', 'cyc'):
            got = len(hj.lines(t, n, fam))
            want = hj.line_count_formula(t, n, fam)
            check(f'count {fam} t={t} n={n}: {got} = {want}', got == want)

# ---- 2. containments (6.1) -------------------------------------------
for t in (2, 3, 4):
    for n in (1, 2, 3):
        comb = {l.key for l in hj.lines(t, n, 'comb')}
        unit = {l.key for l in hj.lines(t, n, 'unit')}
        geom = {l.key for l in hj.lines(t, n, 'geom')}
        cyc  = {l.key for l in hj.lines(t, n, 'cyc')}
        check(f'comb ⊆ unit ⊆ cyc, geom ⊆ cyc (t={t},n={n})',
              comb <= unit <= cyc and geom <= cyc and comb <= geom)
        if t == 2:
            check(f't=2: unit = geom = cyc (n={n})', unit == geom == cyc)
        if t >= 3 and n >= 2:
            check(f't={t},n={n}: unit, geom incomparable',
                  not (unit <= geom) and not (geom <= unit))

# active-set well-defined: bracket/interval counts sane on [3]^3
l3 = hj.lines(3, 3, 'comb')
check('L^[1]([3]^3) has 27 lines', len([l for l in l3 if len(l.active) <= 1]) == 27)
check('L^(1)([3]^3): only {0,2} active set is 2-fold',
      len([l for l in l3 if l.n_intervals > 1]) ==
      len([l for l in l3 if l.active == (0, 2)]))

# ---- 3. certificates from the thesis ----------------------------------
check('Prop 3.14: ⌊(σ mod 4)/2⌋ line-free on [3]^3 (HJ(3,2)=4)',
      hj.is_line_free(hj.preset_halbeisen_33(), 3, 3))
check('Prop 3.14 witness is symmetric',
      hj.is_symmetric(hj.preset_halbeisen_33(), 3, 3))
for r in (2, 3, 4):
    n = r - 1
    if n <= 3:
        check(f'Prop 2.2: σ mod {r} line-free on [2]^{n}',
              hj.is_line_free(hj.preset_sum_mod_r(2, n, r), 2, n))
check('Thm 4.10: ω=(0,5,7), ψ₁₃ line-free on [3]^3 (r=3)',
      hj.is_line_free(hj.preset_ow_057(3), 3, 3))
check('Thm 4.11: ω=(0,2,3,5), χ₀ mod 13 line-free on [4]^3 (r=2)',
      hj.is_line_free(hj.preset_ow_0235_mod13(3), 4, 3))
check('Thm 3.10 record palette (mod 26) line-free on [4]^3',
      hj.is_line_free(hj.preset_record_42(3), 4, 3))
check('Prop 4.5 12-periodic sum palette line-free on [3]^3 (r=3)',
      hj.is_line_free(hj.preset_sum_1233(3), 3, 3))
for t in (3, 4):
    check(f'Prop 6.6: (i+j) mod {t} ∈ {{0,1}} unit-line-free on Z_{t}^2',
          hj.is_line_free(hj.preset_unitfree_n2(t), t, 2, family='unit'))
check('Table A.1 slice (Lemma 3.3): line-free 3-colouring of [3]^3',
      hj.is_line_free(hj.preset_record_33_slice(), 3, 3))
check('Prop 4.1: parity avoids L^[1] on [4]^3',
      hj.is_line_free(hj.preset_parity(4, 3), 4, 3, K=1))
check('… but parity has monochromatic lines with K=2 on [4]^3',
      not hj.is_line_free(hj.preset_parity(4, 3), 4, 3, K=2))

# ---- 4. Lemma 3.1: simplex reduction equivalence ----------------------
rng = random.Random(7)
for trial in range(300):
    t = rng.choice((2, 3, 4)); n = rng.choice((1, 2, 3)); r = rng.choice((2, 3))
    d = {cell: rng.randrange(r) for cell in hj.simplex(t, n)}
    col = hj.lift(d, t, n)
    grid_mono = len(hj.monochromatic_lines(col, hj.lines(t, n, 'comb')))
    simp_mono = len(hj.monochromatic_corners(d, t, n))
    assert (grid_mono > 0) == (simp_mono > 0)
    # per-invariant match: mono line invariants = mono corner invariants
    inv_grid = {l.invariant for l in
                hj.monochromatic_lines(col, hj.lines(t, n, 'comb'))}
    inv_simp = {inv for inv, _ in hj.monochromatic_corners(d, t, n)}
    assert inv_grid == inv_simp
check('Lemma 3.1: line-free ⇔ corner-free on 300 random symmetric colourings', True)

from math import comb as binom
for t in (2, 3, 4):
    for n in (1, 2, 3):
        check(f'#corner tuples C(n+t−1, t) at t={t}, n={n}',
              len(hj.corner_tuples(t, n)) == binom(n + t - 1, t))

# ---- 5. weight functional / sum-type sanity ----------------------------
w = (2, 1, 3)
check('σ = <(1..t), type> on a word',
      hj.sigma(w) == hj.weight_functional((1, 2, 3), hj.type_of(w, 3)))

# ---- 6. the [3]^3 census (Appendix A.4) --------------------------------
cnt, done = hj.count_line_free_colourings(3, 3, 2)
check(f'census: {cnt} line-free 2-colourings of [3]^3 (Table A.5: 1644)',
      done and cnt == 1644)
cnt_s, done_s = hj.count_line_free_symmetric(3, 3, 2)
check(f'census: {cnt_s} symmetric ones (Table A.5: 36)', done_s and cnt_s == 36)

# sum-type: 16 line-free palettes χ on σ ∈ [3, 9]
n_sum = 0
for mask in range(2 ** 7):
    chi = lambda s, m=mask: (m >> (s - 3)) & 1
    if hj.is_line_free(hj.sum_type_colouring(3, 3, chi), 3, 3):
        n_sum += 1
check(f'census: {n_sum} sum-type line-free colourings (Table A.5: 16)',
      n_sum == 16)

# stabilizer split 36 / 504 / 24 / 1080 (Table A.5)
tally = {}
hj.count_line_free_colourings(
    3, 3, 2, on_solution=lambda c: tally.__setitem__(
        hj.stabilizer_class(c, 3, 3),
        tally.get(hj.stabilizer_class(c, 3, 3), 0) + 1))
check(f'census stabilizers {tally} = S3:36 C2:504 C3:24 1:1080',
      tally == {'S3': 36, 'C2': 504, 'C3': 24, '1': 1080})

# diagonal-only census: 6456 (Table A.6)
diag = frozenset(hj.word_index((a, a, a), 3) for a in (1, 2, 3))
cnt_d, done_d = hj.count_line_free_colourings(3, 3, 2, extra_equal=diag)
check(f'census: {cnt_d} diagonal-only 2-colourings (Table A.6: 6456)',
      done_d and cnt_d == 6456)

# ---- 7. cyclic numbers at (3,2) (Thm 6.2, Prop 7.9) --------------------
cyc22 = hj.lines(3, 2, 'cyc')
check('Z_3^2 has 12 cyclic lines', len(cyc22) == 12)
minmono, has_free = 99, False
for m in range(2 ** 9):
    col = [(m >> i) & 1 for i in range(9)]
    k = len(hj.monochromatic_lines(col, cyc22))
    minmono = min(minmono, k)
    has_free |= (k == 0)
check('HJ_cyc(3,2) = 2: no cyclic-line-free 2-colouring of Z_3^2',
      not has_free)
check('Prop 7.9: every 2-colouring of Z_3^2 leaves ≥ 2 monochromatic '
      f'cyclic lines (min = {minmono})', minmono == 2)
# and n = 1 is 2-colourable: HJ_cyc(3,2) > 1
check('Z_3^1 admits a cyclic-line-free 2-colouring',
      hj.is_line_free([0, 0, 1], 3, 1, family='cyc'))

# ---- 8. rainbow sanity --------------------------------------------------
col = hj.random_colouring(3, 3, 6, random.Random(1))
rb = hj.rainbow_lines(col, hj.lines(3, 3, 'comb'))
check('rainbow lines detected on a random 6-colouring of [3]^3', len(rb) > 0)

print(f'\nAll {ok} checks passed.')
