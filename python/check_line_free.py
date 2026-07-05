#!/usr/bin/env python3
"""
check_line_free.py — is a colouring of [t]^n line-free?

Usage
-----
    python3 check_line_free.py FILE.json
    python3 check_line_free.py FILE.json --family cyc --K 2
    python3 check_line_free.py --demo

FILE.json is the format exported by the web page (index.html → Export):

    { "t": 3, "n": 3, "r": 2,
      "colours": [0, 1, 1, ...],                # length t^n, values 0..r-1
      "family": "comb",                          # optional: comb|unit|geom|cyc
      "restriction": {"mode": "K", "K": 2} }     # optional; or {"mode":"q","q":1}

Word order: index(w) = Σ (w_i − 1) t^i, coordinate 0 least significant —
exactly the order produced by hj.words(t, n).

Exit status: 0 if line-free, 1 if not, 2 on input error.
"""
import argparse
import json
import sys

import hj

FAMS = ('comb', 'unit', 'geom', 'cyc')


def report(col, t, n, family, K, q, label=''):
    ls = hj.lines(t, n, family, K, q)
    mono = hj.monochromatic_lines(col, ls)
    rest = f' in L[{K}]' if K is not None else (f' in L({q})' if q is not None else '')
    head = label or f'[{t}]^{n}'
    print(f'{head}: {len(ls)} {family} lines{rest} checked — ', end='')
    if not mono:
        print('LINE-FREE ✓')
    else:
        print(f'{len(mono)} monochromatic:')
        W = hj.words(t, n)
        for l in mono[:12]:
            pts = ', '.join(''.join(map(str, W[p])) for p in l.points)
            print(f'    {l.label}  →  {{{pts}}}  (colour {col[l.points[0]]})')
        if len(mono) > 12:
            print(f'    … and {len(mono) - 12} more')
    sym = hj.is_symmetric(col, t, n)
    print(f'    symmetric: {"yes" if sym else "no"}'
          f' · stabiliser class {hj.stabilizer_class(col, t, n)}')
    if sym and family == 'comb':
        d = hj.descent_of(col, t, n)
        mc = hj.monochromatic_corners(d, t, n, K)
        print(f'    simplex cross-check (Lemma 3.1): '
              f'{len(hj.corner_tuples(t, n, K))} corner tuples, '
              f'{len(mc)} monochromatic '
              f'{"✓ agrees" if bool(mc) == bool(mono) else "✗ DISAGREES"}')
    return not mono


def demo():
    print('Certificates from the thesis, re-verified from the definitions:\n')
    cases = [
        ('Prop. 3.14   ⌊(σ mod 4)/2⌋ on [3]^3 (r=2) — HJ(3,2)=4',
         hj.preset_halbeisen_33(), 3, 3, 'comb', None, None),
        ('Thm 4.10     ω=(0,5,7), ψ mod 13 on [3]^3 (r=3)',
         hj.preset_ow_057(3), 3, 3, 'comb', None, None),
        ('Thm 4.11     ω=(0,2,3,5), χ₀ mod 13 on [4]^3 (r=2)',
         hj.preset_ow_0235_mod13(3), 4, 3, 'comb', None, None),
        ('Thm 3.10     record palette mod 26 on [4]^3 (r=2) — HJ(4,2)≥14',
         hj.preset_record_42(3), 4, 3, 'comb', None, None),
        ('Prop. 4.5    12-periodic sum palette on [3]^3 (r=3)',
         hj.preset_sum_1233(3), 3, 3, 'comb', None, None),
        ('Lemma 3.3    Table A.1 slice on [3]^3 (r=3)',
         hj.preset_record_33_slice(), 3, 3, 'comb', None, None),
        ('Prop. 6.6    (i+j) mod 4 ∈ {0,1} on Z_4^2, unit lines (r=2)',
         hj.preset_unitfree_n2(4), 4, 2, 'unit', None, None),
        ('Prop. 4.1    parity σ mod 2 on [4]^3, bracket K=1 (r=2)',
         hj.preset_parity(4, 3), 4, 3, 'comb', 1, None),
    ]
    ok = True
    for label, col, t, n, fam, K, q in cases:
        ok &= report(col, t, n, fam, K, q, label)
        print()
    print('ALL LINE-FREE ✓' if ok else 'SOME FAILED ✗')
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('file', nargs='?', help='JSON colouring (web-page export)')
    ap.add_argument('--family', choices=FAMS, help='override the line family')
    ap.add_argument('--K', type=int, help='bracket restriction L^[K]')
    ap.add_argument('--q', type=int, help='interval restriction L^(q)')
    ap.add_argument('--demo', action='store_true',
                    help='verify the thesis certificates instead of a file')
    args = ap.parse_args()

    if args.demo:
        sys.exit(demo())
    if not args.file:
        ap.print_help()
        sys.exit(2)

    try:
        d = json.load(open(args.file))
        t, n, r = int(d['t']), int(d['n']), int(d['r'])
        col = list(d.get('colours', d.get('colors')))
        assert len(col) == t ** n, f'colours must have length t^n = {t ** n}'
        assert all(isinstance(c, int) and 0 <= c < r for c in col), \
            'colours must be integers in [0, r)'
    except Exception as e:                                     # noqa: BLE001
        print(f'input error: {e}', file=sys.stderr)
        sys.exit(2)

    family = args.family or d.get('family', 'comb')
    rst = d.get('restriction', {}) or {}
    K = args.K if args.K is not None else rst.get('K')
    q = args.q if args.q is not None else rst.get('q')
    sys.exit(0 if report(col, t, n, family, K, q) else 1)


if __name__ == '__main__':
    main()
