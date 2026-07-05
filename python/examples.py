#!/usr/bin/env python3
"""
examples.py — verify everything the web page claims, from the definitions:

  * the closed-form line counts of §6.1 for all t ∈ {2,3,4}, n ∈ {1,2,3},
    against direct enumeration, and the containments (6.1);
  * every preset certificate (Props 2.2, 3.14, 4.1, 4.5, 6.6;
    Thms 3.10, 4.10, 4.11; Lemma 3.3 / Table A.1 slice);
  * HJ_cyc(3,2) = 2 and the minimum of 2 monochromatic cyclic lines on
    Z_3^2 (Thm 6.2, Prop. 7.9);
  * Lemma 3.1 on random symmetric colourings.
"""
import random

import hj

FAILED = []


def check(name, cond):
    print(f'[{"PASS" if cond else "FAIL"}] {name}')
    if not cond:
        FAILED.append(name)


def main():
    # counts and containments -------------------------------------------
    for t in (2, 3, 4):
        for n in (1, 2, 3):
            for fam in ('comb', 'unit', 'geom', 'cyc'):
                check(f'§6.1 count, {fam} on [{t}]^{n}',
                      len(hj.lines(t, n, fam)) == hj.line_count_formula(t, n, fam))
            comb = {l.key for l in hj.lines(t, n, 'comb')}
            unit = {l.key for l in hj.lines(t, n, 'unit')}
            geom = {l.key for l in hj.lines(t, n, 'geom')}
            cyc = {l.key for l in hj.lines(t, n, 'cyc')}
            check(f'(6.1) containments on [{t}]^{n}',
                  comb <= unit <= cyc and comb <= geom <= cyc)

    # certificates --------------------------------------------------------
    check('Prop. 3.14: ⌊(σ mod 4)/2⌋ line-free on [3]^3',
          hj.is_line_free(hj.preset_halbeisen_33(), 3, 3))
    for r in (2, 3, 4):
        check(f'Prop. 2.2: σ mod {r} line-free on [2]^{r - 1}',
              hj.is_line_free(hj.preset_sum_mod_r(2, r - 1, r), 2, r - 1))
    check('Thm 4.10: ω=(0,5,7), ψ mod 13 line-free on [3]^3',
          hj.is_line_free(hj.preset_ow_057(3), 3, 3))
    check('Thm 4.11: ω=(0,2,3,5), χ₀ mod 13 line-free on [4]^3',
          hj.is_line_free(hj.preset_ow_0235_mod13(3), 4, 3))
    check('Thm 3.10: record palette mod 26 line-free on [4]^3',
          hj.is_line_free(hj.preset_record_42(3), 4, 3))
    check('Prop. 4.5: 12-periodic sum palette line-free on [3]^3',
          hj.is_line_free(hj.preset_sum_1233(3), 3, 3))
    for t in (3, 4):
        check(f'Prop. 6.6: unit-line-free colouring of Z_{t}^2',
              hj.is_line_free(hj.preset_unitfree_n2(t), t, 2, family='unit'))
    check('Lemma 3.3: Table A.1 slice line-free on [3]^3',
          hj.is_line_free(hj.preset_record_33_slice(), 3, 3))
    check('Prop. 4.1: parity avoids L^[1] on [4]^3',
          hj.is_line_free(hj.preset_parity(4, 3), 4, 3, K=1))

    # cyclic numbers at (3,2) ---------------------------------------------
    cyc22 = hj.lines(3, 2, 'cyc')
    mins, free = 99, False
    for m in range(2 ** 9):
        col = [(m >> i) & 1 for i in range(9)]
        k = len(hj.monochromatic_lines(col, cyc22))
        mins, free = min(mins, k), free or k == 0
    check('Thm 6.2: HJ_cyc(3,2) = 2 (no line-free 2-colouring of Z_3^2)', not free)
    check('Prop. 7.9: min # mono cyclic lines on Z_3^2 is 2', mins == 2)

    # Lemma 3.1 ------------------------------------------------------------
    rng = random.Random(11)
    ok = True
    for _ in range(150):
        t, n, r = rng.choice((2, 3, 4)), rng.choice((1, 2, 3)), rng.choice((2, 3))
        d = {c: rng.randrange(r) for c in hj.simplex(t, n)}
        col = hj.lift(d, t, n)
        ok &= (bool(hj.monochromatic_lines(col, hj.lines(t, n)))
               == bool(hj.monochromatic_corners(d, t, n)))
    check('Lemma 3.1: line-free ⇔ corner-free (150 random symmetric colourings)', ok)

    print()
    print('ALL CHECKS PASSED ✓' if not FAILED else f'{len(FAILED)} FAILED ✗')
    return 0 if not FAILED else 1


if __name__ == '__main__':
    raise SystemExit(main())
