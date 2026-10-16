# Posting date is left out: among closed proposals, recent ones are mostly those that hit their
# minimum fast, so it would leak the outcome.
# Non-LLM baselines for predicting whether a proposal reaches its minimum, scored by repeated
# cross-validation on closed proposals and compared with the LLM run on the same rows.
# bun tools/proposal-eval/baseline-export.ts && python3 tools/proposal-eval/baseline.py
import json, os, sys
import numpy as np
from scipy.sparse import hstack, csr_matrix
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score, brier_score_loss
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import StandardScaler

here = os.path.dirname(os.path.abspath(__file__))
rows = [json.loads(l) for l in open(os.path.join(here, 'results', 'baseline-data.jsonl'))]
rows = [r for r in rows if r['funded'] is not None]
y = np.array([int(r['funded']) for r in rows])
texts = [r['text'] for r in rows]
# Tags for funding programs mark proposals already decided elsewhere, so they'd leak the outcome.
PROGRAM_CAUSES = {'leo-microgrants', 'grantmaking-ai'}
causes = sorted({c for r in rows for c in r['causes'] if c not in PROGRAM_CAUSES and sum(c in q['causes'] for q in rows) >= 8})

def meta(r):
    return [np.log1p(r['min_funding']), np.log1p(r['funding_goal']),
            np.log1p(r['funding_goal']) - np.log1p(r['min_funding']),
            np.log(r['text_len'] + 1)] + [c in r['causes'] for c in causes]

def creator(r):
    return [np.log1p(r['prior_projects']), np.log1p(r['prior_funded']), np.log1p(r['prior_donations']),
            np.log1p(r['account_age_days'])]

M = np.array([meta(r) for r in rows], float)
F = M[:, [0, 2, 3]]  # log min, log goal/min, log length; no cause tags (log goal is their sum)
MC = np.hstack([M, np.array([creator(r) for r in rows], float)])
logit = lambda p: np.log(np.clip(p, 1e-3, 1 - 1e-3) / (1 - np.clip(p, 1e-3, 1 - 1e-3)))
L = logit(np.array([r['llm_p'] for r in rows]))[:, None]

def dense(X, C=1.0):
    def fit(tr, te):
        s = StandardScaler().fit(X[tr])
        m = LogisticRegression(C=C, max_iter=2000).fit(s.transform(X[tr]), y[tr])
        return m.predict_proba(s.transform(X[te]))[:, 1]
    return fit

def gbm(X):
    def fit(tr, te):
        m = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=150, min_samples_leaf=10).fit(X[tr], y[tr])
        return m.predict_proba(X[te])[:, 1]
    return fit

def text(X_extra=None, C=3.0):
    def fit(tr, te):
        v = TfidfVectorizer(ngram_range=(1, 2), min_df=3, max_df=0.9, sublinear_tf=True, stop_words='english')
        Tt, Te = v.fit_transform([texts[i] for i in tr]), v.transform([texts[i] for i in te])
        if X_extra is not None:
            s = StandardScaler().fit(X_extra[tr])
            Tt = hstack([Tt, csr_matrix(s.transform(X_extra[tr]))]).tocsr()
            Te = hstack([Te, csr_matrix(s.transform(X_extra[te]))]).tocsr()
        m = LogisticRegression(C=C, max_iter=5000, class_weight=None).fit(Tt, y[tr])
        return m.predict_proba(Te)[:, 1]
    return fit

models = {
    'Amounts, length, causes': dense(M, 0.3),
    '+ creator history': dense(MC, 0.3),
    '+ creator history (boosted trees)': gbm(MC),
    'Words in the proposal (TF-IDF)': text(),
    'All non-LLM features': text(MC),
    'Claude p, refit': dense(L, 1.0),
    'Claude p + all non-LLM features': text(np.hstack([MC, L])),
    'Claude p + amounts and length': dense(np.hstack([L, F]), 1.0),
}
MAIN = 'Claude p + amounts and length'

REPEATS, K = 20, 5
oof = {k: np.zeros((REPEATS, len(y))) for k in models}
for rep in range(REPEATS):
    for tr, te in StratifiedKFold(K, shuffle=True, random_state=rep).split(M, y):
        for k, f in models.items():
            oof[k][rep, te] = f(tr, te)

base = brier_score_loss(y, np.full(len(y), y.mean()))
skill = lambda p: 1 - brier_score_loss(y, p) / base
llm = np.array([r['llm_p'] for r in rows])
qs_rows = [i for i, r in enumerate(rows) if r['quality_score'] is not None]
print(f'{len(y)} closed proposals, {y.sum()} funded ({y.mean():.1%}). {REPEATS}x {K}-fold CV, mean over repeats.\n')
print(f'{"model":38}{"AUC":>8}{"skill":>8}{"mean p":>9}')
print(f'{"Claude v3a, as given":38}{roc_auc_score(y, llm):8.3f}{skill(llm):8.3f}{llm.mean():9.1%}')
qs = np.array([rows[i]['quality_score'] for i in qs_rows])
print(f'{"Existing quality score":38}{roc_auc_score(y[qs_rows], qs):8.3f}{"-":>8}{"-":>9}')
res = {}
for k in models:
    a = np.mean([roc_auc_score(y, oof[k][r]) for r in range(REPEATS)])
    s = np.mean([skill(oof[k][r]) for r in range(REPEATS)])
    res[k] = (a, s)
    print(f'{k:38}{a:8.3f}{s:8.3f}{oof[k].mean():9.1%}')

# Paired bootstrap: Claude vs the best non-LLM model, and whether non-LLM features add to Claude.
best = max([k for k in models if 'Claude' not in k], key=lambda k: res[k][0])
rng = np.random.default_rng(0)
pb, pc = oof[best].mean(0), oof['Claude p + all non-LLM features'].mean(0)
d1, d2 = [], []
for _ in range(2000):
    i = rng.integers(0, len(y), len(y))
    if y[i].min() == y[i].max(): continue
    d1.append(roc_auc_score(y[i], llm[i]) - roc_auc_score(y[i], pb[i]))
    d2.append(roc_auc_score(y[i], pc[i]) - roc_auc_score(y[i], llm[i]))
print(f'\nClaude minus best non-LLM ({best}): AUC {np.mean(d1):+.3f}, 95% CI {np.percentile(d1, 2.5):+.3f} to {np.percentile(d1, 97.5):+.3f}')
print(f'Claude + features minus Claude: AUC {np.mean(d2):+.3f}, 95% CI {np.percentile(d2, 2.5):+.3f} to {np.percentile(d2, 97.5):+.3f}')

# Top words of a text model fit on everything, to see what it keys on.
v = TfidfVectorizer(ngram_range=(1, 2), min_df=3, max_df=0.9, sublinear_tf=True, stop_words='english')
T = v.fit_transform(texts)
m = LogisticRegression(C=3.0, max_iter=5000).fit(T, y)
w, names = m.coef_[0], np.array(v.get_feature_names_out())
print('\nwords pointing to funded:', ', '.join(names[np.argsort(-w)[:25]]))
print('words pointing to unfunded:', ', '.join(names[np.argsort(w)[:25]]))
s = StandardScaler().fit(MC)
m = LogisticRegression(C=0.3, max_iter=2000).fit(s.transform(MC), y)
labels = ['log min', 'log goal', 'log goal/min', 'log length'] + [f'cause:{c}' for c in causes] + ['prior projects', 'prior funded', 'prior donations', 'account age']
print('\nstandardized coefficients:', ', '.join(f'{l} {c:+.2f}' for l, c in sorted(zip(labels, m.coef_[0]), key=lambda t: -abs(t[1]))))
s = StandardScaler().fit(np.hstack([L, F]))
m = LogisticRegression(C=1.0, max_iter=2000).fit(s.transform(np.hstack([L, F])), y)
print(f'\n{MAIN} standardized coefficients:', ', '.join(f'{l} {c:+.2f}' for l, c in zip(['Claude logit', 'log min', 'log goal/min', 'log length'], m.coef_[0])))
# Calibration of the main model's out-of-fold probabilities (pooled over repeats).
BINS = [0, 0.05, 0.1, 0.2, 0.35, 0.5, 1.01]
calib = []
for name, P in [(MAIN, oof[MAIN].ravel()), ('Claude v3a, as given', np.tile(llm, REPEATS))]:
    Y = np.tile(y, REPEATS) if len(P) > len(y) else y
    for lo, hi in zip(BINS, BINS[1:]):
        b = (P >= lo) & (P < hi)
        if b.any():
            calib.append({'model': name, 'lo': lo, 'hi': hi, 'n': int(b.sum()) / (REPEATS if len(P) > len(y) else 1), 'mean_p': float(P[b].mean()), 'actual': float(Y[b].mean())})
            print(f'{name[:28]:28} {lo:.2f}-{hi:.2f}: n={calib[-1]["n"]:6.1f} predicted {P[b].mean():5.1%} actual {Y[b].mean():5.1%}')
json.dump({k: {'auc': res[k][0], 'skill': res[k][1], 'oof': oof[k].mean(0).tolist()} for k in models} | {'ids': [r['id'] for r in rows]},
          open(os.path.join(here, 'results', 'baseline-results.json'), 'w'))
json.dump(calib, open(os.path.join(here, 'results', 'baseline-calibration.json'), 'w'))
