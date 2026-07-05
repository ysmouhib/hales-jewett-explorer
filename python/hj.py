"""
hj.py — Hales–Jewett toolkit
============================
Companion library to the thesis

    "Improving Bounds on Hales–Jewett Numbers: Symmetric Colorings, SAT
     Solvers, Line-Family Variants, and Forcing Structures"
     (Y. Mouhib, ETH Zürich, 2026)

Implements, from the definitions in the thesis:

  * the grid [t]^n, words, the type map (Lemma 2.4) and weight
    functionals <ω, type(·)> (Section 2.2);
  * the four line families of Chapter 6 —
        combinatorial  L([t]^n)          (roots τ over [t] ∪ {*})
        unit-cyclic                       (directions v ∈ {0,1}^n)
        geometric                         (± roots, ∗ ascending / ∗̄ descending)
        cyclic                            (directions v ∈ (Z_t^× ∪ {0})^n)
    with the containments comb ⊆ unit ⊆ cyclic and geom ⊆ cyclic of (6.1);
  * the bracket restriction L^[K] (≤ K active coordinates) and the
    interval restriction L^(q) (active set a union of ≤ q subintervals),
    Chapter 4;  for the coset families "active set" = support of the
    direction, which is well defined on the line;
  * colouring classes  sum ⊆ ow ⊆ sym ⊆ all  (Definition 2.6 / 2.8):
    random, symmetric (descents on the simplex T^(t)_n), one-weight
    c_{ω,χ}, sum-type;
  * the simplex reduction: corner tuples C_{k,v} and the equivalence
    "symmetric colouring line-free  ⇔  no monochromatic corner tuple"
    (Lemma 3.1);
  * line-free / monochromatic / rainbow checkers, and exact
    backtracking counters (used to reproduce the [3]^3 census of
    Appendix A.4).

Colours are integers 0..r-1.  A colouring of [t]^n is a list of length
t^n indexed by word_index().  Letters are 1..t; in the cyclic families
[t] is identified with Z_t via  t ↔ 0  (Section 6.1).

Pure standard library; Python ≥ 3.9.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from itertools import product, combinations
from math import gcd, comb as binom
import random as _random

# ----------------------------------------------------------------------
# words and the type map
# ----------------------------------------------------------------------

def words(t: int, n: int):
    """All words of [t]^n, letters 1..t, as tuples, in index order."""
    return [tuple(reversed(w)) for w in product(range(1, t + 1), repeat=n)]


def word_index(w, t: int) -> int:
    """Index of a word: sum (w_i - 1) t^i (coordinate 0 least significant)."""
    ix = 0
    for i, a in enumerate(w):
        ix += (a - 1) * t ** i
    return ix


def type_of(w, t: int):
    """type(w) = (a_1, ..., a_t), the letter counts (Notation)."""
    tp = [0] * t
    for a in w:
        tp[a - 1] += 1
    return tuple(tp)


def sigma(w) -> int:
    """σ(w) = Σ w_i, the weight (letter sum)."""
    return sum(w)


def simplex(t: int, n: int):
    """T^(t)_n: all types a ∈ Z^t_{≥0} with Σ a_j = n (size C(n+t-1, t-1))."""
    cells = []

    def rec(prefix, remaining, slots):
        if slots == 1:
            cells.append(tuple(prefix + [remaining]))
            return
        for v in range(remaining + 1):
            rec(prefix + [v], remaining - v, slots - 1)

    rec([], n, t)
    return cells


def weight_functional(omega, tp) -> int:
    """<ω, a> = Σ ω_j a_j on a type a (Notation)."""
    return sum(o * a for o, a in zip(omega, tp))


# ----------------------------------------------------------------------
# lines — the four families of Chapter 6
# ----------------------------------------------------------------------

@dataclass
class Line:
    """A line of [t]^n.

    points   : tuple of word indices, in traversal order (k = 1..t)
    active   : sorted tuple of active coordinates (0-based)
    family   : 'comb' | 'unit' | 'geom' | 'cyc'
    label    : human-readable description (root / base + direction)
    invariant: for combinatorial lines, the pair (k, v) of Lemma 2.5
    """
    points: tuple
    active: tuple
    family: str
    label: str
    invariant: tuple | None = None

    @property
    def key(self):
        return tuple(sorted(self.points))

    @property
    def n_intervals(self) -> int:
        """Number of maximal runs of consecutive coordinates in the active set."""
        runs, prev = 0, None
        for i in self.active:
            if prev is None or i != prev + 1:
                runs += 1
            prev = i
        return runs


def combinatorial_lines(t: int, n: int):
    """Roots τ ∈ ([t] ∪ {*})^n \\ [t]^n; L_τ = {τ(1), ..., τ(t)} (Notation).
    Count: (t+1)^n − t^n."""
    lines = []
    for root in product(list(range(1, t + 1)) + ['*'], repeat=n):
        if '*' not in root:
            continue
        active = tuple(i for i, s in enumerate(root) if s == '*')
        pts = []
        for a in range(1, t + 1):
            w = tuple(a if s == '*' else s for s in root)
            pts.append(word_index(w, t))
        k = len(active)
        v = [0] * t
        for s in root:
            if s != '*':
                v[s - 1] += 1
        label = ''.join('∗' if s == '*' else str(s) for s in root)
        lines.append(Line(tuple(pts), active, 'comb', label, (k, tuple(v))))
    return lines


def _units(t: int):
    return [u for u in range(1, t) if gcd(u, t) == 1]


def _res(letter: int, t: int) -> int:
    """Letter → residue in Z_t (t ↔ 0)."""
    return letter % t


def _letter(res: int, t: int) -> int:
    """Residue → letter (0 ↔ t)."""
    r = res % t
    return t if r == 0 else r


def _coset_lines(t: int, n: int, directions, family: str):
    """Lines {a + k v : k ∈ Z_t} for the given directions, deduplicated
    by point set (each line is a coset of the order-t subgroup <v>)."""
    seen = {}
    for v in directions:
        for a in product(range(t), repeat=n):  # residue vectors
            pts = []
            for k in range(t):
                w = tuple(_letter(a[i] + k * v[i], t) for i in range(n))
                pts.append(word_index(w, t))
            key = tuple(sorted(pts))
            if key in seen:
                continue
            active = tuple(i for i in range(n) if v[i] % t != 0)
            base = tuple(_letter(x, t) for x in a)
            label = f"a={''.join(map(str, base))}, v=({','.join(map(str, v))})"
            seen[key] = Line(tuple(pts), active, family, label)
    return list(seen.values())


def unit_lines(t: int, n: int):
    """Unit-cyclic lines: directions v ∈ {0,1}^n \\ {0}.
    Count: (2^n − 1) t^{n−1}."""
    dirs = [v for v in product((0, 1), repeat=n) if any(v)]
    return _coset_lines(t, n, dirs, 'unit')


def cyclic_lines(t: int, n: int):
    """Cyclic lines: valid directions v ∈ (Z_t^× ∪ {0})^n \\ {0}.
    Count: ((φ+1)^n − 1)/φ · t^{n−1}."""
    U = _units(t)
    dirs = [v for v in product([0] + U, repeat=n) if any(v)]
    return _coset_lines(t, n, dirs, 'cyc')


def geometric_lines(t: int, n: int):
    """Geometric lines: ± roots over [t] ∪ {∗, ∗̄}; ∗ ascends (k) and
    ∗̄ descends (t+1−k).  Two roots per line (τ and its reflection).
    Count: ((t+2)^n − t^n)/2."""
    seen = {}
    symbols = list(range(1, t + 1)) + ['+', '-']
    for root in product(symbols, repeat=n):
        if not any(s in ('+', '-') for s in root):
            continue
        pts = []
        for k in range(1, t + 1):
            w = tuple(k if s == '+' else (t + 1 - k) if s == '-' else s
                      for s in root)
            pts.append(word_index(w, t))
        key = tuple(sorted(pts))
        if key in seen:
            continue
        active = tuple(i for i, s in enumerate(root) if s in ('+', '-'))
        label = ''.join('∗' if s == '+' else '∗̄' if s == '-' else str(s)
                        for s in root)
        seen[key] = Line(tuple(pts), active, 'geom', label)
    return list(seen.values())


FAMILIES = {
    'comb': combinatorial_lines,
    'unit': unit_lines,
    'geom': geometric_lines,
    'cyc': cyclic_lines,
}


def lines(t: int, n: int, family: str = 'comb', K: int | None = None,
          q: int | None = None):
    """Lines of the family, optionally restricted:
       K — bracket L^[K]: at most K active coordinates (Chapter 4);
       q — interval L^(q): active set a union of ≤ q subintervals."""
    ls = FAMILIES[family](t, n)
    if K is not None:
        ls = [l for l in ls if len(l.active) <= K]
    if q is not None:
        ls = [l for l in ls if l.n_intervals <= q]
    return ls


def line_count_formula(t: int, n: int, family: str) -> int:
    """Closed-form counts of Section 6.1."""
    phi = len(_units(t))
    if family == 'comb':
        return (t + 1) ** n - t ** n
    if family == 'unit':
        return (2 ** n - 1) * t ** (n - 1)
    if family == 'geom':
        return ((t + 2) ** n - t ** n) // 2
    if family == 'cyc':
        return ((phi + 1) ** n - 1) // phi * t ** (n - 1)
    raise ValueError(family)


# ----------------------------------------------------------------------
# colourings
# ----------------------------------------------------------------------

def random_colouring(t, n, r, rng=None):
    rng = rng or _random
    return [rng.randrange(r) for _ in range(t ** n)]


def lift(descent: dict, t, n):
    """Lift a descent c̄ : T^(t)_n → colours to the symmetric colouring
    c = c̄ ∘ type (Lemma 2.4)."""
    return [descent[type_of(w, t)] for w in words(t, n)]


def random_symmetric_colouring(t, n, r, rng=None):
    rng = rng or _random
    descent = {cell: rng.randrange(r) for cell in simplex(t, n)}
    return lift(descent, t, n)


def one_weight_colouring(t, n, omega, chi):
    """c_{ω,χ}(w) = χ(<ω, type(w)>)  (Definition 2.6). chi: int → colour."""
    return [chi(weight_functional(omega, type_of(w, t))) for w in words(t, n)]


def sum_type_colouring(t, n, chi):
    """Sum-type: ω = (1, 2, ..., t), i.e. c = χ ∘ σ."""
    return one_weight_colouring(t, n, tuple(range(1, t + 1)), chi)


def periodic(pattern):
    """A palette χ(x) = pattern[x mod m]."""
    m = len(pattern)
    return lambda x: pattern[x % m]


def is_symmetric(colouring, t, n) -> bool:
    """Invariant under all coordinate permutations ⇔ constant on type fibres."""
    seen = {}
    for w in words(t, t and n):
        tp = type_of(w, t)
        c = colouring[word_index(w, t)]
        if seen.setdefault(tp, c) != c:
            return False
    return True


def descent_of(colouring, t, n):
    """The (unique) descent of a symmetric colouring; None if not symmetric."""
    d = {}
    for w in words(t, n):
        tp = type_of(w, t)
        c = colouring[word_index(w, t)]
        if d.setdefault(tp, c) != c:
            return None
    return d


# ----------------------------------------------------------------------
# checking
# ----------------------------------------------------------------------

def monochromatic_lines(colouring, line_list):
    out = []
    for l in line_list:
        cols = {colouring[p] for p in l.points}
        if len(cols) == 1:
            out.append(l)
    return out


def rainbow_lines(colouring, line_list):
    out = []
    for l in line_list:
        cols = {colouring[p] for p in l.points}
        if len(cols) == len(l.points):
            out.append(l)
    return out


def is_line_free(colouring, t, n, family='comb', K=None, q=None) -> bool:
    return not monochromatic_lines(colouring, lines(t, n, family, K, q))


# ----------------------------------------------------------------------
# the simplex reduction (Chapter 3)
# ----------------------------------------------------------------------

def corner_tuples(t: int, n: int, K: int | None = None):
    """Corner tuples C_{k,v} = {v + k e_1, ..., v + k e_t} ⊆ T^(t)_n for
    1 ≤ k ≤ K (default K = n), v ∈ T^(t)_{n−k}.  Total at K = n:
    C(n+t−1, t)  (Remark 3.2)."""
    K = n if K is None else min(K, n)
    tuples = []
    for k in range(1, K + 1):
        for v in simplex(t, n - k):
            cells = []
            for a in range(t):
                cell = list(v)
                cell[a] += k
                cells.append(tuple(cell))
            tuples.append(((k, v), tuple(cells)))
    return tuples


def monochromatic_corners(descent: dict, t, n, K=None):
    """Monochromatic corner tuples of a descent — by Lemma 3.1 these are
    exactly the (orbit classes of) monochromatic lines of the lift."""
    out = []
    for inv, cells in corner_tuples(t, n, K):
        cols = {descent[c] for c in cells}
        if len(cols) == 1:
            out.append((inv, cells))
    return out


# ----------------------------------------------------------------------
# exact counting by backtracking (census tools, Appendix A.4)
# ----------------------------------------------------------------------

def count_line_free_colourings(t, n, r, family='comb', K=None, q=None,
                               node_budget=50_000_000, extra_equal=None,
                               on_solution=None):
    """Exact number of line-free r-colourings of [t]^n (backtracking with
    not-all-equal constraints on every line).  extra_equal: an optional
    set of points forced monochromatic (used for the diagonal-only census).
    on_solution: optional callback receiving each colouring (as a list).
    Returns (count, exhausted) — exhausted=False if the node budget hit."""
    ls = [l.points for l in lines(t, n, family, K, q)]
    N = t ** n
    lines_at = [[] for _ in range(N)]
    for li, pts in enumerate(ls):
        for p in pts:
            lines_at[p].append(li)
    size = [len(pts) for pts in ls]
    pts_of = ls
    colour = [-1] * N
    remaining = size[:]           # uncoloured points per line
    colours_seen = [set() for _ in ls]
    count = 0
    nodes = 0
    exhausted = True

    # order: points on many lines first (stronger propagation)
    order = sorted(range(N), key=lambda p: -len(lines_at[p]))
    pos_of = {p: i for i, p in enumerate(order)}

    def ok(p, c):
        for li in lines_at[p]:
            if remaining[li] == 1 and len(colours_seen[li]) == 1 \
               and c in colours_seen[li]:
                return False
        return True

    def assign(p, c):
        colour[p] = c
        for li in lines_at[p]:
            remaining[li] -= 1
            colours_seen[li].add(c)

    def unassign(p, c):
        colour[p] = -1
        for li in lines_at[p]:
            remaining[li] += 1
            # rebuild colour set of the line
            s = set()
            for x in pts_of[li]:
                if colour[x] >= 0:
                    s.add(colour[x])
            colours_seen[li] = s

    eq_class = extra_equal or set()

    def rec(i):
        nonlocal count, nodes, exhausted
        if not exhausted:
            return
        if i == N:
            count += 1
            if on_solution is not None:
                on_solution(colour[:])
            return
        p = order[i]
        nodes += 1
        if nodes > node_budget:
            exhausted = False
            return
        choices = range(r)
        if p in eq_class:
            fixed = next((colour[x] for x in eq_class if colour[x] >= 0), None)
            if fixed is not None:
                choices = [fixed]
        for c in choices:
            # a completed line must not be monochromatic ...
            bad = False
            for li in lines_at[p]:
                if remaining[li] == 1:
                    s = colours_seen[li]
                    if len(s) == 1 and c in s:
                        if set(pts_of[li]) != eq_class:   # ... unless forced
                            bad = True
                            break
            if bad:
                continue
            # the forced class must stay monochromatic
            assign(p, c)
            rec(i + 1)
            unassign(p, c)

    rec(0)
    return count, exhausted


def count_line_free_symmetric(t, n, r, K=None, node_budget=50_000_000):
    """Exact number of line-free SYMMETRIC r-colourings of [t]^n, i.e.
    of descents on T^(t)_n with no monochromatic corner tuple (Lemma 3.1)."""
    cells = simplex(t, n)
    idx = {c: i for i, c in enumerate(cells)}
    cts = [tuple(idx[c] for c in cs) for _, cs in corner_tuples(t, n, K)]
    N = len(cells)
    at = [[] for _ in range(N)]
    for li, cs in enumerate(cts):
        for p in cs:
            at[p].append(li)
    colour = [-1] * N
    remaining = [len(cs) for cs in cts]
    seen = [set() for _ in cts]
    count = 0
    nodes = 0
    exhausted = True
    order = sorted(range(N), key=lambda p: -len(at[p]))

    def rec(i):
        nonlocal count, nodes, exhausted
        if not exhausted:
            return
        if i == N:
            count += 1
            return
        p = order[i]
        nodes += 1
        if nodes > node_budget:
            exhausted = False
            return
        for c in range(r):
            bad = False
            for li in at[p]:
                if remaining[li] == 1 and len(seen[li]) == 1 and c in seen[li]:
                    bad = True
                    break
            if bad:
                continue
            colour[p] = c
            for li in at[p]:
                remaining[li] -= 1
                seen[li].add(c)
            rec(i + 1)
            colour[p] = -1
            for li in at[p]:
                remaining[li] += 1
                s = set()
                for x in cts[li]:
                    if colour[x] >= 0:
                        s.add(colour[x])
                seen[li] = s

    rec(0)
    return count, exhausted


# ----------------------------------------------------------------------
# coordinate symmetry classification (Table A.5)
# ----------------------------------------------------------------------

def _permutations(n):
    from itertools import permutations as _p
    return list(_p(range(n)))


def stabilizer_class(colouring, t, n) -> str:
    """Stabilizer of the colouring in the coordinate group S_n, named as
    in Table A.5 (n = 3): 'S3' (symmetric), 'C3' (cyclic), 'C2'
    (block-symmetric, one transposition), '1' (asymmetric).  For n ≤ 2
    returns 'S{n}' or '1'."""
    W = words(t, n)
    stab = []
    for perm in _permutations(n):
        if all(colouring[word_index(tuple(w[perm[i]] for i in range(n)), t)]
               == colouring[word_index(w, t)] for w in W):
            stab.append(perm)
    m = len(stab)
    if n == 3:
        return {6: 'S3', 3: 'C3', 2: 'C2', 1: '1'}[m]
    if m == 1:
        return '1'
    return f'S{n}' if m == len(_permutations(n)) else f'order {m}'


# ----------------------------------------------------------------------
# certificates from the thesis (used as presets and in tests)
# ----------------------------------------------------------------------

def preset_halbeisen_33():
    """Proposition 3.14: c(w) = ⌊((Σ w_i) mod 4)/2⌋ is a symmetric
    line-free 2-colouring of [3]^3 — the witness for HJ(3,2) = 4."""
    return sum_type_colouring(3, 3, lambda s: (s % 4) // 2)


def preset_sum_mod_r(t, n, r):
    """Proposition 2.2 / Remark 6.5: w ↦ σ(w) mod r; line-free on [t]^n
    whenever n < r (along a k-active line the sum advances by k ≢ 0)."""
    return sum_type_colouring(t, n, lambda s: s % r)


def preset_ow_057(n):
    """Theorem 4.10: ω = (0,5,7), 13-periodic palette ψ — no
    monochromatic combinatorial line with ≤ 12 active coordinates in any
    dimension (hence fully line-free on [3]^n for n ≤ 12).  r = 3."""
    psi = periodic([1, 0, 0, 1, 0, 1, 0, 0, 1, 2, 2, 2, 2])
    return one_weight_colouring(3, n, (0, 5, 7), psi)


def preset_ow_0235_mod13(n):
    """Theorem 4.11: ω = (0,2,3,5), χ₀ mod 13 with χ₀⁻¹(1) =
    {4,5,7,9,11,12} — no monochromatic line with ≤ 12 active
    coordinates, any dimension.  r = 2."""
    ones = {4, 5, 7, 9, 11, 12}
    chi = lambda x: 1 if (x % 13) in ones else 0
    return one_weight_colouring(4, n, (0, 2, 3, 5), chi)


RECORD_PALETTE_26 = [1, 0, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 0,
                     0, 0, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 0]


def preset_record_42(n):
    """Theorem 3.10 (the HJ(4,2) ≥ 14 record): ω = (0,2,3,5) with the
    26-periodic palette; line-free on [4]^n for every n ≤ 13."""
    return one_weight_colouring(4, n, (0, 2, 3, 5),
                                periodic(RECORD_PALETTE_26))


def preset_sum_1233(n):
    """Proposition 4.5: the 12-periodic sum-type palette at (3,3) —
    no monochromatic 3-AP of gap ≤ 11, hence line-free on [3]^n, n ≤ 11."""
    return sum_type_colouring(3, n, periodic([2, 0, 1, 2, 1, 1,
                                              0, 1, 2, 0, 0, 2]))


def preset_unitfree_n2(t):
    """Proposition 6.6: c(i,j) = 1 ⇔ (i+j) mod t ∈ {0,1} has no
    monochromatic unit line on Z_t^2 (t ≥ 3)."""
    col = [0] * (t * t)
    for w in words(t, 2):
        i, j = w[0] % t, w[1] % t
        col[word_index(w, t)] = 1 if (i + j) % t in (0, 1) else 0
    return col


# rows a = 18..21 of Table A.1 (the 253-cell witness for HJ(3,3) ≥ 22);
# by monotonicity (Lemma 3.3), shifting the descent by 18·e1 restricts the
# record witness to a line-free symmetric 3-colouring of [3]^3.
_TABLE_A1_TAIL = {18: '1001', 19: '120', 20: '20', 21: '0'}


def preset_record_33_slice():
    descent = {}
    for (a, b, c) in simplex(3, 3):
        descent[(a, b, c)] = int(_TABLE_A1_TAIL[18 + a][b])
    return lift(descent, 3, 3)


def preset_parity(t, n):
    """Proposition 4.1: σ(w) mod 2 — every line of L^[1] alternates, so
    the colouring is line-free for the bracket restriction K = 1."""
    return sum_type_colouring(t, n, lambda s: s % 2)


# ----------------------------------------------------------------------
if __name__ == '__main__':
    print(__doc__)
