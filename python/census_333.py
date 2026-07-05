#!/usr/bin/env python3
"""
census_333.py — reproduce the [3]^3 census of Appendix A.4 (Tables A.5 / A.6)
by exhaustive backtracking from the definitions.  Runs in a few seconds.

Expected output:
    line-free 2-colourings of [3]^3 ........ 1644   (822 complementary pairs)
      stabiliser S3 (symmetric) ............   36
      stabiliser C2 (block-symmetric) ......  504
      stabiliser C3 (cyclic) ...............   24
      stabiliser 1  (asymmetric) ........... 1080
      sum-type (palettes on σ ∈ [3,9]) .....   16
    symmetric, counted on the simplex ......   36   (Lemma 3.1 cross-check)
    diagonal-only 2-colourings (Table A.6) . 6456
"""
import hj


def main():
    print(__doc__.splitlines()[1].strip())
    print()

    tally = {}

    def classify(col):
        k = hj.stabilizer_class(col, 3, 3)
        tally[k] = tally.get(k, 0) + 1

    total, done = hj.count_line_free_colourings(3, 3, 2, on_solution=classify)
    assert done
    print(f'line-free 2-colourings of [3]^3 ........ {total:5d}'
          f'   ({total // 2} complementary pairs)')
    for name, label in (('S3', 'S3 (symmetric)'), ('C2', 'C2 (block-symmetric)'),
                        ('C3', 'C3 (cyclic)'), ('1', '1  (asymmetric)')):
        print(f'  stabiliser {label:<22} {tally.get(name, 0):5d}')

    n_sum = sum(
        hj.is_line_free(hj.sum_type_colouring(3, 3,
                        lambda s, m=mask: (m >> (s - 3)) & 1), 3, 3)
        for mask in range(2 ** 7))
    print(f'  sum-type (palettes on σ ∈ [3,9]) ..... {n_sum:5d}')

    sym, done_s = hj.count_line_free_symmetric(3, 3, 2)
    assert done_s
    print(f'symmetric, counted on the simplex ...... {sym:5d}'
          f'   (Lemma 3.1 cross-check: {"agrees ✓" if sym == tally.get("S3") else "DISAGREES ✗"})')

    diag = frozenset(hj.word_index((a, a, a), 3) for a in (1, 2, 3))
    d_total, done_d = hj.count_line_free_colourings(3, 3, 2, extra_equal=diag)
    assert done_d
    print(f'diagonal-only 2-colourings (Table A.6) . {d_total:5d}')

    ok = (total == 1644 and tally.get('S3') == 36 and tally.get('C2') == 504
          and tally.get('C3') == 24 and tally.get('1') == 1080
          and n_sum == 16 and sym == 36 and d_total == 6456)
    print()
    print('matches Tables A.5 / A.6 ✓' if ok else 'MISMATCH with the thesis ✗')
    return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
