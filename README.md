# The Hales–Jewett Explorer

An interactive companion to the thesis **“Improving Bounds on Hales–Jewett Numbers:
Symmetric Colorings, SAT Solvers, Line-Family Variants, and Forcing Structures”**
(Y. Mouhib, ETH Zürich, 2026).

Live site (once deployed): **https://ysmouhib.github.io/hales-jewett-explorer/**

One self-contained page, `index.html`, that lets you

* explore the grid **[t]ⁿ** in 2D/3D for t ∈ {2,3,4}, n ∈ {1,2,3}, r ∈ {1,…,6}
  colours, with sliders for every parameter;
* draw and check the **four line families** of Chapter 6 — combinatorial,
  unit-cyclic, geometric, cyclic — under the **bracket L^[K]** and
  **interval L^(q)** restrictions of Chapter 4 (line counts are re-derived from
  the definitions and checked live against the closed forms of §6.1);
* generate colourings by class (Def. 2.6/2.8): **random**, **random symmetric**
  (a descent on the type simplex, Lemma 2.4), **one-weight c₍ω,χ₎** with an
  editable weight and palette, **sum-type**, plus eleven **preset certificates
  from the thesis** (Props 2.2, 3.14, 4.1, 4.5, 6.6; Thms 3.5, 3.10, 4.3, 4.10,
  4.11; the Table A.1 record slice via Lemma 3.3);
* paint points by hand (optionally whole Sₙ-orbits), and watch three linked
  views — the grid, the **type simplex with its corner tuples** (Lemma 3.1),
  and the **weight-level strip** where lines become homothets b + k·S_ω
  (Lemma 2.14);
* study the **forcing structures of Chapter 7**, live: the intersection graph
  G([t]ⁿ) with its induced edge colouring c̃(e) = c(x_e), the star dictionary
  (Lemma 7.5) and coherence classes (Prop. 7.6) — at t = 2 the Boolean-lattice
  comparability graph with its Mirsky chain (Prop. 7.1) — and the **corner
  hypergraph C⁽ᵗ⁾ₙ** with its pencils (Lemma 7.19), monochromatic corner
  tuples (Thm 7.21 ii), the clean cell-rainbow K_{t+1} of **Prop. 7.26** on a
  toggle, and the live Local-Lemma bound of Thm 7.28;
* read the **Rado panel (§2.4)**: the system E_s derived from your current
  weight (Prop. 2.19; the equation z + 2x = 3y for {0,1,3}, Example 2.20),
  exact counts of monochromatic forward homothets b + k·S (checked to agree
  with the grid, Lemma 2.14) versus reflected Rado-only copies — the gap of
  Remark 2.24, with R₄(z + 2x = 3y) ≥ 57 — and the Gallai rows of Table 2.1
  matched to your S₀ through the Thm 2.15 bound;
* leave **comments** (GitHub-issue-backed via utterances — see step 8);
* run exact tools in the browser: line-free verdicts with the monochromatic
  and rainbow lists, **Find line-free** / **Find diagonal-only** witnesses
  (backtracking), **Count symmetric line-free** on the simplex,
  **Count all line-free**, and **Min # monochromatic lines** — at
  (t,n,r) = (3,3,2) the counters return **1644** and **36**, reproducing
  Table A.5; at (3,2,2) cyclic, the minimum is **2** (Prop. 7.9).

Everything mathematical exists twice: in the page (JavaScript) and in
`python/hj.py`, and both are tested against the thesis’s numbers.

## Layout

```
index.html                 the whole site (three.js loaded from cdnjs)
index.template.html        template; js gets spliced in by the build step
js/hj-core.js              the mathematics (grids, 4 families, restrictions,
                           colouring classes, simplex reduction, counters)
js/app.js                  rendering + UI
js/extras.js               Chapter-7 graph panels + the Rado panel (§2.4)
js/test-core.js            node test battery (85 checks)
js/test-extras.js          Rado/homothet battery (23 checks)
python/hj.py               the same mathematics in Python
python/check_line_free.py  CLI: is a colouring line-free? (reads web exports)
python/census_333.py       reproduces the [3]^3 census: 1644 / 36 / 16 /
                           504 / 24 / 1080 / 6456 (Tables A.5–A.6)
python/examples.py         verifies every certificate embedded in the page
python/test_hj.py          dev test battery (89 checks)
```

## Run locally

```bash
cd hales-jewett-explorer
python3 -m http.server 8000       # then open http://localhost:8000
```

(Opening `index.html` directly by double-click also works in most browsers.)

## Python tools

```bash
cd python
python3 examples.py                       # verify every embedded certificate
python3 census_333.py                     # the [3]^3 census, exactly
python3 check_line_free.py --demo         # thesis certificates through the checker
python3 check_line_free.py export.json    # check a colouring exported by the page
python3 check_line_free.py export.json --family cyc --K 2
```

A three-line check:

```python
import hj
col = hj.sum_type_colouring(3, 3, lambda s: (s % 4) // 2)   # Prop. 3.14
print(hj.is_line_free(col, 3, 3))                            # True → HJ(3,2) = 4
```

Developer batteries: `python3 python/test_hj.py`, `node js/test-core.js`,
`node js/test-extras.js`.
If you edit any file in `js/`, rebuild the page (splicing all three scripts) with:

```bash
python3 - << 'PY'
tpl = open('index.template.html').read()
out = (tpl.replace('/*__HJ_CORE__*/', open('js/hj-core.js').read())
          .replace('/*__APP__*/',     open('js/app.js').read())
          .replace('/*__EXTRAS__*/',  open('js/extras.js').read()))
open('index.html', 'w').write(out)
PY
```

---

## Deploy to GitHub Pages — step by step (account `ysmouhib`)

You only need a terminal and a browser. Time: about five minutes.

### Step 0 — one-time git setup

```bash
git --version                 # if this fails: install git first
                              #   macOS:  xcode-select --install
                              #   Ubuntu: sudo apt install git
git config --global user.name  "Y. Mouhib"
git config --global user.email "your-email@example.com"   # the email of your GitHub account
```

### Step 1 — go into the project folder

```bash
cd path/to/hales-jewett-explorer     # the folder that contains index.html
ls                                    # you should see: index.html  js  python  README.md
```

### Step 2 — turn it into a git repository and make the first commit

```bash
git init
git add .
git commit -m "Hales–Jewett explorer: interactive grids, lines, colourings"
git branch -M main
```

### Step 3 — create the (empty) repository on GitHub

In the browser:

1. go to **https://github.com/new** (logged in as `ysmouhib`);
2. Repository name: **`hales-jewett-explorer`**;
3. visibility **Public** (Pages on the free plan needs public);
4. leave *“Add a README”, “Add .gitignore”, “Choose a license”* **unchecked**
   (the folder already has its files);
5. click **Create repository**.

*(If you use the GitHub CLI, steps 3–4 are one command:
`gh repo create ysmouhib/hales-jewett-explorer --public --source=. --push`,
then skip to Step 5.)*

### Step 4 — connect and push

```bash
git remote add origin https://github.com/ysmouhib/hales-jewett-explorer.git
git push -u origin main
```

When git asks for credentials: **Username** = `ysmouhib`, **Password** = a
*Personal Access Token* (GitHub no longer accepts account passwords here).
To create one: GitHub → your avatar → **Settings** → **Developer settings** →
**Personal access tokens** → **Tokens (classic)** → **Generate new token
(classic)** → tick the **repo** scope → **Generate** → copy it and paste it as
the password. (Alternative: `gh auth login` and let the CLI handle it.)

### Step 5 — switch on GitHub Pages

In the browser, on the repository page:

1. **Settings** (top bar of the repo) → **Pages** (left sidebar);
2. under *Build and deployment*: **Source** = *Deploy from a branch*;
3. **Branch** = `main`, **Folder** = `/ (root)`;
4. **Save**.

### Step 6 — open your site

Wait one or two minutes (the Pages banner shows the status), then open

> **https://ysmouhib.github.io/hales-jewett-explorer/**

### Step 7 — updating the site later

```bash
# after editing any file:
git add -A
git commit -m "describe the change"
git push
```

The page refreshes automatically about a minute after each push.

### Step 8 — switch on the comments (one click)

The comments section is powered by [utterances](https://utteranc.es): each
page maps to a GitHub issue on this repository, so there is no backend and
nothing to configure in the code. After the repo is public:

1. open **https://github.com/apps/utterances**;
2. click **Install** → *Only select repositories* → choose
   **`ysmouhib/hales-jewett-explorer`** → **Install**;
3. done — the comment box on the site is live. Visitors need a GitHub login
   to post; the first comment auto-creates the backing issue. (Issues are on
   by default; check Settings → General → Features if you ever turned them
   off.)

*Prefer GitHub Discussions instead of issues?* Use
[giscus](https://giscus.app): enable **Discussions** in the repo settings,
install the giscus app, paste the repo into giscus.app to obtain the
data-repo-id / data-category-id, and swap the utterances script block at the
bottom of index.html for the snippet giscus generates.

**Variant.** If you name the repository `ysmouhib.github.io` instead, the site
lives at the root, **https://ysmouhib.github.io/** — everything else is
identical.

---

Records also appear in the companion note
[arXiv:2606.22155](https://arxiv.org/abs/2606.22155) (Mouhib–Halbeisen);
certificates and SAT logs in
[ysmouhib/hj-certificates](https://github.com/ysmouhib/hj-certificates).
Data colours: Okabe–Ito (colour-blind safe). No build tooling, no framework;
the page’s only external file is `three.js` r128 from cdnjs.
