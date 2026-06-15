/* =========================================================================
 * Lotto 模拟器 — 预测 / 生成 / 验证
 * 全部基于 window.LOTTO_DATA（往期开奖，newest-first）。
 * 不使用 Math.random()：生成器用种子化 PRNG 对“统计权重”做加权采样。
 * ========================================================================= */
'use strict';
const DATA = (typeof window !== 'undefined' ? window.LOTTO_DATA : global.LOTTO_DATA);

/* ---------- 等奖规则（命中 N 个主号 [+ extra] → 第几等奖） ---------- */
const DIVISIONS = {
  ozlotto: [ // 7 主号 + 3 补充号；补充号来自同一池
    { div: 1, main: 7, supp: 0 },
    { div: 2, main: 6, supp: 1 },
    { div: 3, main: 6, supp: 0 },
    { div: 4, main: 5, supp: 1 },
    { div: 5, main: 5, supp: 0 },
    { div: 6, main: 4, supp: 0 },
    { div: 7, main: 3, supp: 1 },
  ],
  powerball: [ // 7 主号 + 1 Powerball
    { div: 1, main: 7, pb: true },
    { div: 2, main: 7, pb: false },
    { div: 3, main: 6, pb: true },
    { div: 4, main: 6, pb: false },
    { div: 5, main: 5, pb: true },
    { div: 6, main: 4, pb: true },
    { div: 7, main: 5, pb: false },
    { div: 8, main: 3, pb: true },
    { div: 9, main: 2, pb: true },
  ],
};

/* ---------- 状态 ---------- */
const state = { game: 'ozlotto', view: 'overview', genMode: 'recommend', lang: 'en' };

/* =========================================================================
 * i18n（默认英文）
 * ========================================================================= */
const I18N = {
  en: {
    'app.docTitle': 'Oz Lotto & Powerball Simulator · Predict / Generate / Validate',
    'app.title': '🎲 Lotto Simulator',
    'app.subtitle': 'Statistical prediction · generation · validation from past draws (no random())',
    'tab.overview': 'Overview', 'tab.predict': 'Predict', 'tab.generate': 'Generate', 'tab.validate': 'Validate',
    'disclaimer': '⚠️ Every draw is an independent random event — past results <strong>cannot</strong> truly predict the future. This tool applies various mathematical/statistical methods for experimentation and fun. Please view it rationally and never use it for betting decisions.',
    'window.label': 'Stats window (last N draws)',
    'ov.hot.title': '🔥 Hot Top 10 (most frequent in window)', 'ov.hot.hint': 'Main numbers drawn most often.',
    'ov.cold.title': '❄️ Cold Top 10 (longest absent)', 'ov.cold.hint': 'Numbers with the longest gap since last drawn.',
    'ov.freq.title': '📊 Frequency of all numbers', 'ov.freq.hint': 'Times each main number appeared in the window (red = hotter, blue = colder).',
    'ov.shape.title': '🧩 Shape distribution', 'ov.shape.hint': 'Structural features of past combinations, used by "balanced" generation.',
    'ov.pairs.title': '🔗 Top 10 pairs', 'ov.pairs.hint': 'Number pairs that appear together most (co-occurrence).',
    'ov.recent.title': '🕑 Recent draws',
    'legend.hot': 'Hot', 'legend.cold': 'Cold',
    'pr.title': 'Predict next draw · multiple math methods',
    'pr.hint': 'Each method scores every number and takes the highest few as a "predicted set". "Consensus" at the bottom fuses the rankings of multiple methods.',
    'pr.decay.label': 'Recency decay λ (higher = favor recent)',
    'decay.0': '0 · none (equal)', 'decay.0b': '0 · equal', 'decay.light': '0.01 · light', 'decay.medium': '0.03 · medium', 'decay.heavy': '0.06 · heavy',
    'pr.run': 'Recompute',
    'bt.title': '🧪 Backtest: do these methods actually beat random? (walk-forward)',
    'bt.hint': 'Predict each draw using only the data before it, roll forward to the end, and compare the real average hits against the random baseline — the only honest test of predictive power.',
    'bt.mode.label': 'Training mode', 'bt.mode.expanding': 'Expanding window (all history, growing)', 'bt.mode.fixed': 'Fixed window (last N draws only, N = window above)',
    'bt.sims.label': 'Monte Carlo sims (random draws for the empirical p-value)',
    'bt.sims.fast': '1000 · fast', 'bt.sims.default': '3000 · default', 'bt.sims.fine': '10000 · fine', 'bt.sims.veryfine': '50000 · very fine (slow)',
    'bt.run': 'Run backtest', 'bt.placeholder': 'Click "Run backtest".',
    'gen.title': 'Generate possible combinations · data-driven weighted sampling',
    'gen.hint': 'No <code>Math.random()</code>. Numbers are weighted by the statistical model, then drawn by <strong>reproducible seeded sampling</strong> (deterministic PRNG) — the same seed + parameters always give the same result.',
    'gen.mode.recommend': '🔰 Recommended', 'gen.mode.custom': '⚙️ Custom',
    'gen.method.label': 'Method',
    'gen.opt.frequency': 'Weighted frequency (hot bias)', 'gen.opt.overdue': 'Overdue (cold bias)', 'gen.opt.markov': 'Markov (follow last draw)',
    'gen.opt.bayes': 'Bayesian shrinkage (anti-overfit)', 'gen.opt.consensus': 'Consensus (fused methods)', 'gen.opt.balanced': 'Balanced shape (fits history)',
    'gen.opt.topk': 'Deterministic Top-K (no randomness)', 'gen.opt.random': '🎲 Pure random (uniform baseline)',
    'gen.window.label': 'Stats window', 'gen.decay.label': 'Recency decay λ', 'gen.count.label': 'How many lines', 'gen.seed.label': 'Seed',
    'gen.run': 'Generate', 'gen.newseed': 'New batch', 'gen.results.title': 'Generated lines', 'gen.results.placeholder': 'Click "Generate".',
    'val.title': 'Validate a combination · against all past draws',
    'val.hint': "Enter a set of numbers to see how many it would have matched each past draw, the highest prize division reached, hit counts per division, and each number's historical frequency.",
    'val.run': 'Validate', 'val.fillhot': 'Fill hot numbers', 'val.clear': 'Clear', 'val.result.title': 'Validation result',
    // dynamic
    'extraname.ozlotto': 'Supplementary', 'extraname.powerball': 'Powerball',
    'unit.times': '×', 'unit.draws': 'draws',
    'ov.meta': 'Current rules: <b>{mc}</b> main (1–{mm}) + <b>{ec}</b> {ex} (1–{em})｜Available history (current format): <b>{total}</b> draws｜Window: <b>{n}</b> draws',
    'ov.shape.sumRange': 'Main sum range', 'ov.shape.sumMean': 'Sum mean', 'ov.shape.odd': 'Most common odd count', 'ov.shape.low': 'Most common low (≤{h}) count',
    'ov.shape.oddDist': 'Odd/even distribution', 'ov.shape.oddItem': '{k} odd:{c}',
    'ov.pairs.pair': 'Pair', 'ov.pairs.co': 'Co-occur', 'tbl.draw': 'Draw', 'tbl.date': 'Date', 'tbl.numbers': 'Numbers',
    'predict.extraHot': '{ex} frequent',
    'bt.note.run': 'Backtest: {mode}, walk-forward over <b>{n}</b> test points (predict each draw using only earlier data; main numbers only).',
    'bt.mode.expandingShort': 'expanding window', 'bt.mode.fixedShort': 'fixed window',
    'bt.headline.good': '⚠️ {n} method(s) have an empirical p-value < 0.01. But with {m} methods tested at once and this being an <strong>in-sample</strong> backtest, ~{e} false positives are expected — verify on <strong>future draws</strong> and never bet on it.',
    'bt.headline.none': '✅ No method significantly beats random (all empirical p-values ≥ 0.01, including the actual random control). This matches "the lottery is an independent random event; history cannot predict the next draw".',
    'bt.col.method': 'Method', 'bt.col.avg': 'Avg hits/draw', 'bt.col.delta': 'vs baseline Δ', 'bt.col.z': 'z', 'bt.col.p': 'Emp. p', 'bt.col.verdict': 'Verdict',
    'bt.row.baseline': '🎲 Random baseline (theory)', 'bt.row.control': '🎰 Random pick (actual control)', 'bt.row.perfect': '🎯 Perfect-prediction ceiling', 'bt.row.perfectNote': '(if every draw were a full hit)',
    'bt.badge.baseline': 'baseline',
    'bt.note.p': '· <b>Empirical p</b>: {sims} actual random picks on the same draws (Monte Carlo); the share where random average hits ≥ this method. Smaller p → more likely to truly beat random.',
    'bt.note.z': '· z is a rough guide only — it assumes i.i.d. draws, but training sets overlap heavily and multiple methods are tested, which inflates significance; the verdict relies on the more conservative p-value and out-of-sample checks.',
    'bt.note.insample': '· This is an <strong>in-sample</strong> evaluation: it answers "was it slightly better than random in history", not "can it predict the next draw".',
    'verdict.none': 'no significant difference from random', 'verdict.good': 'significantly above random (still needs out-of-sample)', 'verdict.weak': 'slightly above random, weak evidence', 'verdict.bad': 'significantly below random',
    'gen.note.random': '🎲 <strong>Pure random</strong>: every number equally likely (uniform baseline), ignoring history. Generated with a seeded PRNG (not Math.random) using seed <b>{seed}</b>; click "New batch" for a fresh set.',
    'gen.note.topk': 'Currently <strong>deterministic Top-K</strong>: no randomness at all; numbers taken by sorting consensus weights and rotating.',
    'gen.note.default': 'Weights come from the statistical model; sampled without replacement by a deterministic PRNG with seed <b>{seed}</b> — same seed + parameters reproduce.',
    'gen.note.explain': '<br>· <b>Fit</b> = average score of these numbers under the chosen method; · <b>Overlap</b> = intersection with the "method prediction" below.',
    'gen.ref.label': 'Method "prediction" Top-{mc} (deterministic; compare with the Predict tab)',
    'gen.score.fit': 'Fit {pct}% · Overlap {ov}/{mc}', 'gen.score.random': 'pure random',
    'gen.verify': 'Validate', 'gen.collapse': 'Collapse', 'gen.noresult': 'No result — adjust parameters.',
    'gen.preset.badge': '🔰 <b>Recommended</b> · {name}: {win} · λ {decay} —— {why}',
    'gen.mode.hint.custom': 'Mix freely: method / window / decay / seed.',
    'gen.mode.hint.recommend': 'The system auto-configures the best window and decay per method — just pick a method and click "Generate".',
    'window.all': 'All {n}', 'window.recent': 'Last {n}', 'winlabel.all': 'all {n} draws', 'winlabel.recent': 'last {n} draws',
    'iv.checked': 'Checked <b>{n}</b> draws', 'iv.maxhit': 'Max matched <b>{h}</b>/{mc}', 'iv.best': 'Best <b style="color:var(--gold)">{div}</b>', 'iv.never': '<b>Never won</b>', 'iv.total': 'Total wins <b>{n}</b>', 'iv.dist': 'Hit distribution: {hits}', 'iv.none': 'none',
    'val.alert.main': 'Please enter {mc} distinct main numbers (1–{mm}).', 'val.alert.range': 'Main numbers out of range.', 'val.alert.extra': 'Please enter {ec} {ex} (1–{em}).',
    'val.input.main': 'Main numbers ({mc}, 1–{mm})', 'val.input.extra': '{ex} (1–{em})',
    'val.best': 'Best division ever reached: <span class="big">{div}</span><br><span class="small muted">e.g. draw #{n} ({date}): {nums}</span>',
    'val.neverBig': '<span class="big" style="color:var(--muted)">Never won</span><br><span class="small muted">Most main numbers matched: {h}</span>',
    'val.kv.checked': 'Draws checked <b>{n}</b>', 'val.kv.maxhit': 'Max main matched <b>{h}</b>/{mc}', 'val.kv.total': 'Total wins <b>{n}</b>',
    'val.h.divhits': 'Historical hits per division', 'val.h.freq': 'Historical frequency of chosen numbers',
    'val.tbl.div': 'Division', 'val.tbl.hits': 'Historical hits', 'val.times': '×',
    'method.frequency.name': 'Weighted frequency', 'method.overdue.name': 'Overdue', 'method.markov.name': 'Markov', 'method.bayes.name': 'Bayesian shrinkage', 'method.consensus.name': 'Consensus', 'method.balanced.name': 'Balanced shape', 'method.topk.name': 'Deterministic Top-K', 'method.random.name': 'Pure random',
    'method.frequency.short': 'More recent appearances → higher weight (hot bias)', 'method.overdue.short': 'Long absent → more "due" (mean-reversion assumption)', 'method.markov.short': 'Most co-occurring with the latest draw', 'method.bayes.short': 'Shrinks frequency toward prior 7/N, avoids treating noise as signal', 'method.consensus.short': 'Average of hot / overdue / co-occurrence after normalizing',
    'mi.frequency.title': '🔥 Weighted frequency (hot)', 'mi.frequency.body': 'How it works: counts appearances in the window and weights recent draws more via decay λ — more frequent → higher score.\nWhen to use: if you believe "hot stays hot" and want to follow recent trends.\nPairing: short window (50–100) + larger λ (0.03–0.06) emphasizes recent heat.\nNote: larger λ looks only at the last dozen draws; in a fair lottery "hot" is just random fluctuation.',
    'mi.overdue.title': '❄️ Overdue', 'mi.overdue.body': 'How it works: scores by "actual gap ÷ expected gap" — the longer unseen, the higher.\nWhen to use: if you believe "the long-absent should revert to the mean" (opposite of hot).\nPairing: use a large or "all" window for stable gap stats; unaffected by λ.\nNote: under independent random draws "long absent" does not make a number more likely — this is the reverse gambler\'s fallacy; it won\'t beat random in the backtest, kept only as a diagnostic.',
    'mi.markov.title': '🔗 Markov (co-occurrence)', 'mi.markov.body': 'How it works: looks at the most recent draw and finds numbers that historically co-occur with it most.\nWhen to use: to exploit "accompaniment / co-occurrence" between numbers.\nPairing: a larger window stabilizes the co-occurrence matrix; unaffected by λ.\nNote: lottery balls have no real association; co-occurrence is mostly coincidence.',
    'mi.bayes.title': '🧪 Bayesian shrinkage', 'mi.bayes.body': 'How it works: instead of trusting raw frequency, it shrinks each number\'s rate toward the prior 7/N — (count + k·prior) ÷ (draws + k), k≈50. Frequent numbers are pulled back toward the mean.\nWhen to use: to avoid overfitting "treating random noise as hot"; the most conservative honest frequency method.\nNote: because it shrinks, score gaps are small — which honestly reflects how weak the real signal is.',
    'mi.consensus.title': '🧠 Consensus', 'mi.consensus.body': 'How it works: normalizes "weighted frequency / overdue / co-occurrence" to 0–1 each, then averages with equal weight.\nWhen to use: when you don\'t want to bet on a single assumption and want a robust default.\nPairing: window 100 + λ 0.03 is a balanced setting.\nNote: fuses three mutually contradictory logics, so results are middling.',
    'mi.balanced.title': '🧩 Balanced shape', 'mi.balanced.body': 'How it works: on top of consensus weighted sampling, it filters out combinations whose structure deviates too far from history — constraining main-number "sum range, odd/even ratio, low/high ratio" toward historical modes.\nWhen to use: to make generated combinations "look like real draws".\nNote: it only constrains shape and does not raise winning odds.',
    'mi.topk.title': '🎯 Deterministic Top-K', 'mi.topk.body': 'How it works: no randomness at all. Sorts all numbers by consensus weight and rotates a sliding rank window to produce multiple lines.\nWhen to use: when you want reproducible, zero-randomness results.\nNote: lines differ only by the rotating rank window, so variety is limited; unrelated to the seed.',
    'mi.random.title': '🎲 Pure random (uniform baseline)', 'mi.random.body': 'How it works: ignores history entirely; every number is equally likely — this is what the lottery actually is, and the baseline for judging other methods.\nWhen to use: when you want an unbiased random line, or to compare against the "math methods".\nNote: still uses a seeded PRNG (not Math.random), reproducible with the same seed; click "New batch" for a fresh set. Window/decay have no effect.',
    'preset.frequency.why': 'Hot bias favors recent: shorter window + stronger decay', 'preset.overdue.why': 'Gap stats need a large sample to stabilize, and are unaffected by decay', 'preset.markov.why': 'Co-occurrence matrix is steadier on all history; unaffected by decay', 'preset.bayes.why': 'Bayesian shrinks frequency toward the prior using all history', 'preset.consensus.why': 'A robust, balanced default', 'preset.balanced.why': 'Balanced shape that fits historical structure', 'preset.topk.why': 'Deterministic ranked picks; unrelated to the seed', 'preset.random.why': 'Every number equally likely; independent of window/decay (pure random baseline)',
  },
  zh: {
    'app.docTitle': 'Oz Lotto & Powerball 模拟器 · 预测 / 生成 / 验证',
    'app.title': '🎲 Lotto 模拟器',
    'app.subtitle': '基于往期开奖结果的统计预测 · 生成 · 验证（非 random 随机）',
    'tab.overview': '概览', 'tab.predict': '预测', 'tab.generate': '生成', 'tab.validate': '验证',
    'disclaimer': '⚠️ 彩票每期都是独立随机事件，历史结果<strong>不能</strong>真正预测未来。本工具用多种数学/统计方法做实验与娱乐，请理性看待，切勿用于投注决策。',
    'window.label': '统计窗口（最近 N 期）',
    'ov.hot.title': '🔥 热号 Top 10（窗口内出现最多）', 'ov.hot.hint': '出现频率最高的主号码。',
    'ov.cold.title': '❄️ 冷号 Top 10（遗漏最久）', 'ov.cold.hint': '距上次开出间隔最长（最“久违”）的号码。',
    'ov.freq.title': '📊 全号码出现频率', 'ov.freq.hint': '窗口内每个主号码的出现次数（红=偏热，蓝=偏冷）。',
    'ov.shape.title': '🧩 形态分布', 'ov.shape.hint': '历史开奖组合的结构特征，用于“均衡生成”。',
    'ov.pairs.title': '🔗 高频对 Top 10', 'ov.pairs.hint': '最常一起出现的号码对（共现）。',
    'ov.recent.title': '🕑 最近开奖',
    'legend.hot': '热号', 'legend.cold': '冷号',
    'pr.title': '预测下一期 · 多数学方法',
    'pr.hint': '每种方法给所有号码打分，取分数最高的若干个组成“预测号码组”。底部“综合”为多方法排名融合。',
    'pr.decay.label': '近期加权衰减 λ（越大越看重最近）',
    'decay.0': '0 · 不加权（等权）', 'decay.0b': '0 · 等权', 'decay.light': '0.01 · 轻', 'decay.medium': '0.03 · 中', 'decay.heavy': '0.06 · 重',
    'pr.run': '重新计算',
    'bt.title': '🧪 回测：这些方法真的比随机强吗？（walk-forward）',
    'bt.hint': '用「该期之前」的数据预测每一期，滚动到底，统计真实平均命中数并与随机基准比较——这是检验预测力的唯一诚实方式。',
    'bt.mode.label': '训练模式', 'bt.mode.expanding': '累积窗口（用全部历史，逐期增加）', 'bt.mode.fixed': '固定窗口（仅用最近 N 期，N=上方窗口）',
    'bt.sims.label': '蒙特卡洛 sims（求经验 p 值的随机抽样次数）',
    'bt.sims.fast': '1000 · 快', 'bt.sims.default': '3000 · 默认', 'bt.sims.fine': '10000 · 精', 'bt.sims.veryfine': '50000 · 很精（较慢）',
    'bt.run': '运行回测', 'bt.placeholder': '点击「运行回测」。',
    'gen.title': '生成可能组合 · 数据驱动的加权采样',
    'gen.hint': '不使用 <code>Math.random()</code>。号码按统计模型计算权重，再用<strong>可复现的种子化采样</strong>（确定性 PRNG）按权重抽取——相同种子+参数永远得到相同结果。',
    'gen.mode.recommend': '🔰 推荐模式', 'gen.mode.custom': '⚙️ 自定义模式',
    'gen.method.label': '方法',
    'gen.opt.frequency': '加权频率（热号倾向）', 'gen.opt.overdue': '冷门遗漏（久违倾向）', 'gen.opt.markov': '马尔可夫（跟随最近一期）',
    'gen.opt.bayes': '贝叶斯收缩（防过拟合）', 'gen.opt.consensus': '综合（多方法融合）', 'gen.opt.balanced': '均衡形态（贴合历史结构）',
    'gen.opt.topk': '确定性 Top-K（完全无随机）', 'gen.opt.random': '🎲 纯随机（均匀基准）',
    'gen.window.label': '统计窗口', 'gen.decay.label': '近期加权衰减 λ', 'gen.count.label': '生成注数', 'gen.seed.label': '种子 Seed',
    'gen.run': '生成', 'gen.newseed': '换一批', 'gen.results.title': '生成结果', 'gen.results.placeholder': '点击「生成」。',
    'val.title': '验证组合 · 对照全部历史开奖',
    'val.hint': '输入一组号码，统计它在历史每一期里能中几个、最高能中第几等奖、各等奖命中次数，以及每个号码的历史频率。',
    'val.run': '验证', 'val.fillhot': '填入热号', 'val.clear': '清空', 'val.result.title': '验证结果',
    'extraname.ozlotto': '补充号', 'extraname.powerball': 'Powerball',
    'unit.times': '次', 'unit.draws': '期',
    'ov.meta': '当前规则：<b>{mc}</b> 个主号 (1–{mm}) + <b>{ec}</b> 个 {ex} (1–{em})｜可用历史（当前格式）：<b>{total}</b> 期｜统计窗口：<b>{n}</b> 期',
    'ov.shape.sumRange': '主号和 范围', 'ov.shape.sumMean': '和 均值', 'ov.shape.odd': '最常见 奇数个数', 'ov.shape.low': '最常见 小号(≤{h}) 个数',
    'ov.shape.oddDist': '奇偶分布', 'ov.shape.oddItem': '{k}奇:{c}',
    'ov.pairs.pair': '号码对', 'ov.pairs.co': '共现', 'tbl.draw': '期号', 'tbl.date': '日期', 'tbl.numbers': '号码',
    'predict.extraHot': '{ex} 高频',
    'bt.note.run': '回测方式：{mode}，对 <b>{n}</b> 个历史测试点做 walk-forward（仅用该期之前的数据预测该期，只比对主号）。',
    'bt.mode.expandingShort': '累积窗口', 'bt.mode.fixedShort': '固定窗口',
    'bt.headline.good': '⚠️ 有 {n} 个方法的经验 p 值 < 0.01。但同时检验 {m} 个方法、且这是<strong>样本内</strong>回测，期望假阳性约 {e} 个——务必在<strong>未来新开奖</strong>上做样本外验证，切勿据此投注。',
    'bt.headline.none': '✅ 没有任何方法显著优于随机（经验 p 值均 ≥ 0.01，含实测随机对照组也落在同一区间）。这与「彩票为独立随机事件、历史无法预测下一期」的结论一致。',
    'bt.col.method': '方法', 'bt.col.avg': '平均命中/期', 'bt.col.delta': 'vs 基准 Δ', 'bt.col.z': 'z 值', 'bt.col.p': '经验 p 值', 'bt.col.verdict': '结论',
    'bt.row.baseline': '🎲 随机基准（理论）', 'bt.row.control': '🎰 随机选号（实测对照）', 'bt.row.perfect': '🎯 完美预测上限', 'bt.row.perfectNote': '（若每期都全中）',
    'bt.badge.baseline': '理论基准',
    'bt.note.p': '· <b>经验 p 值</b>：在同一批实际开奖上做 {sims} 次真实随机选号（蒙特卡洛），统计「随机策略平均命中 ≥ 本方法」的比例。p 越小越可能真优于随机。',
    'bt.note.z': '· z 值仅作粗略参考——它假设各期独立同分布，但训练集高度重叠、且存在多重比较，会让显著性偏乐观，故结论以更保守的 p 值与样本外验证为准。',
    'bt.note.insample': '· 这是<strong>样本内</strong>评估：能回答「在历史上是否略好于随机」，不能证明「能预测下一期」。',
    'verdict.none': '与随机无显著差异', 'verdict.good': '显著高于随机（仍需样本外验证）', 'verdict.weak': '略高于随机，证据较弱', 'verdict.bad': '显著低于随机',
    'gen.note.random': '🎲 <strong>纯随机</strong>：每个号码等概率（均匀基准），不看历史。用种子 <b>{seed}</b> 的 PRNG（非 Math.random）生成，点「换一批」得到新一组。',
    'gen.note.topk': '当前为<strong>确定性 Top-K</strong>：完全不使用任何随机，按综合权重排序轮换取号。',
    'gen.note.default': '权重由统计模型计算，使用种子 <b>{seed}</b> 的确定性 PRNG 按权重不放回采样——相同种子+参数可复现。',
    'gen.note.explain': '<br>· <b>契合度</b>＝这组号在所选方法权重下的平均得分；· <b>重合</b>＝与下方「该方法预测」的交集。',
    'gen.ref.label': '该方法「预测」Top-{mc}（确定性，可与「预测」页对照）',
    'gen.score.fit': '契合度 {pct}% · 重合 {ov}/{mc}', 'gen.score.random': '纯随机',
    'gen.verify': '验证', 'gen.collapse': '收起', 'gen.noresult': '无结果，请调整参数。',
    'gen.preset.badge': '🔰 <b>推荐配置</b> · {name}：{win} · λ {decay} —— {why}',
    'gen.mode.hint.custom': '自由搭配：方法 / 窗口 / 衰减 / 种子。',
    'gen.mode.hint.recommend': '系统按所选方法自动配置最优窗口与衰减，选好方法直接点「生成」即可。',
    'window.all': '全部 {n}', 'window.recent': '最近 {n}', 'winlabel.all': '全部 {n} 期', 'winlabel.recent': '最近 {n} 期',
    'iv.checked': '对照 <b>{n}</b> 期', 'iv.maxhit': '最多命中 <b>{h}</b>/{mc}', 'iv.best': '最高 <b style="color:var(--gold)">{div}</b>', 'iv.never': '<b>从未中奖</b>', 'iv.total': '中奖总次数 <b>{n}</b>', 'iv.dist': '命中分布：{hits}', 'iv.none': '无',
    'val.alert.main': '请填写 {mc} 个不重复的主号码（1–{mm}）。', 'val.alert.range': '主号码超出范围。', 'val.alert.extra': '请填写 {ec} 个 {ex}（1–{em}）。',
    'val.input.main': '主号码（{mc} 个，1–{mm}）', 'val.input.extra': '{ex}（1–{em}）',
    'val.best': '历史上最高曾达 <span class="big">{div}</span><br><span class="small muted">例如第 #{n} 期（{date}）：{nums}</span>',
    'val.neverBig': '<span class="big" style="color:var(--muted)">从未中奖</span><br><span class="small muted">最多曾命中 {h} 个主号</span>',
    'val.kv.checked': '对照期数 <b>{n}</b>', 'val.kv.maxhit': '最多命中主号 <b>{h}</b>/{mc}', 'val.kv.total': '中奖总次数 <b>{n}</b>',
    'val.h.divhits': '各等奖历史命中', 'val.h.freq': '所选号码历史频率',
    'val.tbl.div': '等级', 'val.tbl.hits': '历史命中次数', 'val.times': '次',
    'method.frequency.name': '加权频率', 'method.overdue.name': '冷门遗漏', 'method.markov.name': '马尔可夫', 'method.bayes.name': '贝叶斯收缩', 'method.consensus.name': '综合融合', 'method.balanced.name': '均衡形态', 'method.topk.name': '确定性 Top-K', 'method.random.name': '纯随机',
    'method.frequency.short': '近期出现越多、权重越高（热号倾向）', 'method.overdue.short': '久未开出 → 越“该出”（回归均值假设）', 'method.markov.short': '与最近一期号码历史共现最多者', 'method.bayes.short': '频率往先验 7/N 收缩，防把噪声当信号', 'method.consensus.short': '热号 / 遗漏 / 共现 三法归一后平均',
    'mi.frequency.title': '🔥 加权频率（热号）', 'mi.frequency.body': '原理：统计窗口内各号码出现频率，并按近期加权衰减 λ 给最近几期更高权重，越常出现分越高。\n何时用：相信「热号会延续」、想跟随最近趋势时。\n搭配：小窗口(50–100) + 较大 λ(0.03~0.06) 更突出近期热度。\n注意：λ 越大越只看最近十几期；公平彩票下「热」本质是随机波动。',
    'mi.overdue.title': '❄️ 冷门遗漏（Overdue）', 'mi.overdue.body': '原理：用「实际遗漏间隔 ÷ 期望间隔」打分，一个号越久没开分越高。\n何时用：相信「久违的号该回归均值」时（与热号相反的思路）。\n搭配：用大窗口或「全部」期数，遗漏统计才稳定；本方法不受 λ 影响。\n注意：独立随机开奖下「久未出现」并不会让号码更易出现，这是赌徒谬误的反向版；回测里它不会优于随机，仅作诊断保留。',
    'mi.markov.title': '🔗 马尔可夫（共现）', 'mi.markov.body': '原理：看最近一期开出的号码，找历史上最常和它们一起出现的号码。\n何时用：想利用号码之间的「伴随 / 共现」关系时。\n搭配：窗口越大共现矩阵越稳；不受 λ 影响。\n注意：彩球之间没有真实关联，共现多为巧合。',
    'mi.bayes.title': '🧪 贝叶斯收缩（Shrinkage）', 'mi.bayes.body': '原理：不直接相信历史频率，而是把每个号码的出现率往先验 7/N 收缩——(出现次数 + k·先验) ÷ (期数 + k)，k≈50。出现多的号被往均值拉回。\n何时用：想避免「把随机波动当成热号」的过拟合时，是最保守诚实的频率法。\n注意：正因为它收缩，号码间分差很小——这恰恰反映了真实信号其实很弱。',
    'mi.consensus.title': '🧠 综合融合（Consensus）', 'mi.consensus.body': '原理：把「加权频率 / 遗漏 / 共现」三种打分各自归一化到 0–1 后等权平均。\n何时用：不想押注单一假设、想要稳健默认时。\n搭配：窗口 100 + λ 0.03 是均衡设置。\n注意：融合了三种相互矛盾的逻辑，结果偏中庸。',
    'mi.balanced.title': '🧩 均衡形态（Balanced）', 'mi.balanced.body': '原理：在综合加权采样基础上，筛掉与历史结构差异过大的组合——约束主号「和值区间、奇偶比、大小号比例」贴近历史众数。\n何时用：想让生成的组合「看起来像真实开奖」时。\n注意：只约束组合形态，并不提升中奖概率。',
    'mi.topk.title': '🎯 确定性 Top-K', 'mi.topk.body': '原理：完全不使用任何随机。按综合权重对全部号码排序，用滑动排名窗口轮换取号生成多注。\n何时用：想要可复现、零随机的确定性结果时。\n注意：多注之间靠排名窗口轮换，彼此差异有限；与种子无关。',
    'mi.random.title': '🎲 纯随机（均匀基准）', 'mi.random.body': '原理：完全不看历史，每个号码等概率随机选取——这就是彩票真实的样子，也是衡量其他方法的「基准线」。\n何时用：想要不带任何偏好的随机一注，或想和那些「数学方法」对照看差别时。\n说明：仍用种子化 PRNG（非 Math.random），相同种子可复现；点「换一批」得到新的一组。统计窗口/衰减对它无效。',
    'preset.frequency.why': '热号看重近期：较短窗口 + 较强衰减', 'preset.overdue.why': '遗漏统计需大样本才稳定，且不受衰减影响', 'preset.markov.why': '共现矩阵用全历史更稳，不受衰减影响', 'preset.bayes.why': '贝叶斯用全历史把频率往先验收缩', 'preset.consensus.why': '稳健均衡的默认设置', 'preset.balanced.why': '贴合历史结构的均衡形态', 'preset.topk.why': '确定性排序取号，与种子无关', 'preset.random.why': '每个号码等概率，与统计窗口/衰减无关（纯随机基准）',
  },
  es: {
    'app.docTitle': 'Simulador de Oz Lotto y Powerball · Predecir / Generar / Validar',
    'app.title': '🎲 Simulador de Lotería',
    'app.subtitle': 'Predicción · generación · validación estadística a partir de sorteos pasados (sin random())',
    'tab.overview': 'Resumen', 'tab.predict': 'Predecir', 'tab.generate': 'Generar', 'tab.validate': 'Validar',
    'disclaimer': '⚠️ Cada sorteo es un evento aleatorio independiente: los resultados pasados <strong>no pueden</strong> predecir el futuro. Esta herramienta aplica varios métodos matemáticos/estadísticos con fines experimentales y de entretenimiento. Úsala con sentido común y nunca para decisiones de apuestas.',
    'window.label': 'Ventana de estadísticas (últimos N sorteos)',
    'ov.hot.title': '🔥 Top 10 calientes (más frecuentes)', 'ov.hot.hint': 'Números principales que más salen.',
    'ov.cold.title': '❄️ Top 10 fríos (ausentes hace más tiempo)', 'ov.cold.hint': 'Números con mayor intervalo desde su última aparición.',
    'ov.freq.title': '📊 Frecuencia de todos los números', 'ov.freq.hint': 'Veces que apareció cada número principal en la ventana (rojo = más caliente, azul = más frío).',
    'ov.shape.title': '🧩 Distribución de forma', 'ov.shape.hint': 'Características estructurales de combinaciones pasadas, usadas por la generación "equilibrada".',
    'ov.pairs.title': '🔗 Top 10 pares', 'ov.pairs.hint': 'Pares de números que más aparecen juntos (coocurrencia).',
    'ov.recent.title': '🕑 Sorteos recientes',
    'legend.hot': 'Caliente', 'legend.cold': 'Frío',
    'pr.title': 'Predecir el próximo sorteo · varios métodos matemáticos',
    'pr.hint': 'Cada método puntúa cada número y toma los más altos como "conjunto predicho". "Consenso" abajo fusiona los rankings de varios métodos.',
    'pr.decay.label': 'Decaimiento de recencia λ (mayor = favorece lo reciente)',
    'decay.0': '0 · ninguno (igual)', 'decay.0b': '0 · igual', 'decay.light': '0.01 · ligero', 'decay.medium': '0.03 · medio', 'decay.heavy': '0.06 · fuerte',
    'pr.run': 'Recalcular',
    'bt.title': '🧪 Backtest: ¿estos métodos realmente superan al azar? (walk-forward)',
    'bt.hint': 'Predice cada sorteo usando solo los datos anteriores, avanza hasta el final y compara los aciertos medios reales con la base aleatoria: la única prueba honesta del poder predictivo.',
    'bt.mode.label': 'Modo de entrenamiento', 'bt.mode.expanding': 'Ventana expansiva (todo el historial, creciente)', 'bt.mode.fixed': 'Ventana fija (solo últimos N sorteos, N = ventana de arriba)',
    'bt.sims.label': 'Simulaciones Monte Carlo (sorteos aleatorios para el valor p empírico)',
    'bt.sims.fast': '1000 · rápido', 'bt.sims.default': '3000 · por defecto', 'bt.sims.fine': '10000 · fino', 'bt.sims.veryfine': '50000 · muy fino (lento)',
    'bt.run': 'Ejecutar backtest', 'bt.placeholder': 'Haz clic en "Ejecutar backtest".',
    'gen.title': 'Generar combinaciones posibles · muestreo ponderado basado en datos',
    'gen.hint': 'Sin <code>Math.random()</code>. Los números se ponderan con el modelo estadístico y se extraen mediante <strong>muestreo con semilla reproducible</strong> (PRNG determinista): la misma semilla + parámetros siempre dan el mismo resultado.',
    'gen.mode.recommend': '🔰 Recomendado', 'gen.mode.custom': '⚙️ Personalizado',
    'gen.method.label': 'Método',
    'gen.opt.frequency': 'Frecuencia ponderada (sesgo caliente)', 'gen.opt.overdue': 'Atrasados (sesgo frío)', 'gen.opt.markov': 'Markov (sigue el último sorteo)',
    'gen.opt.bayes': 'Contracción bayesiana (anti-sobreajuste)', 'gen.opt.consensus': 'Consenso (métodos fusionados)', 'gen.opt.balanced': 'Forma equilibrada (ajusta al historial)',
    'gen.opt.topk': 'Top-K determinista (sin azar)', 'gen.opt.random': '🎲 Aleatorio puro (base uniforme)',
    'gen.window.label': 'Ventana de estadísticas', 'gen.decay.label': 'Decaimiento de recencia λ', 'gen.count.label': 'Cuántas líneas', 'gen.seed.label': 'Semilla',
    'gen.run': 'Generar', 'gen.newseed': 'Nuevo lote', 'gen.results.title': 'Líneas generadas', 'gen.results.placeholder': 'Haz clic en "Generar".',
    'val.title': 'Validar una combinación · contra todos los sorteos pasados',
    'val.hint': 'Introduce un conjunto de números para ver cuántos habría acertado en cada sorteo pasado, la división de premio más alta alcanzada, los aciertos por división y la frecuencia histórica de cada número.',
    'val.run': 'Validar', 'val.fillhot': 'Rellenar calientes', 'val.clear': 'Limpiar', 'val.result.title': 'Resultado de validación',
    'extraname.ozlotto': 'Suplementario', 'extraname.powerball': 'Powerball',
    'unit.times': '×', 'unit.draws': 'sorteos',
    'ov.meta': 'Reglas actuales: <b>{mc}</b> principales (1–{mm}) + <b>{ec}</b> {ex} (1–{em})｜Historial disponible (formato actual): <b>{total}</b> sorteos｜Ventana: <b>{n}</b> sorteos',
    'ov.shape.sumRange': 'Rango de suma principal', 'ov.shape.sumMean': 'Media de la suma', 'ov.shape.odd': 'Cantidad impar más común', 'ov.shape.low': 'Cantidad baja (≤{h}) más común',
    'ov.shape.oddDist': 'Distribución par/impar', 'ov.shape.oddItem': '{k} impares:{c}',
    'ov.pairs.pair': 'Par', 'ov.pairs.co': 'Coocurr.', 'tbl.draw': 'Sorteo', 'tbl.date': 'Fecha', 'tbl.numbers': 'Números',
    'predict.extraHot': '{ex} frecuente',
    'bt.note.run': 'Backtest: {mode}, walk-forward sobre <b>{n}</b> puntos de prueba (predice cada sorteo usando solo datos anteriores; solo números principales).',
    'bt.mode.expandingShort': 'ventana expansiva', 'bt.mode.fixedShort': 'ventana fija',
    'bt.headline.good': '⚠️ {n} método(s) tienen un valor p empírico < 0.01. Pero con {m} métodos probados a la vez y siendo un backtest <strong>dentro de muestra</strong>, se esperan ~{e} falsos positivos: verifica con <strong>sorteos futuros</strong> y nunca apuestes por ello.',
    'bt.headline.none': '✅ Ningún método supera significativamente al azar (todos los valores p empíricos ≥ 0.01, incluido el control aleatorio real). Esto coincide con "la lotería es un evento aleatorio independiente; el historial no puede predecir el próximo sorteo".',
    'bt.col.method': 'Método', 'bt.col.avg': 'Aciertos medios/sorteo', 'bt.col.delta': 'vs base Δ', 'bt.col.z': 'z', 'bt.col.p': 'p emp.', 'bt.col.verdict': 'Veredicto',
    'bt.row.baseline': '🎲 Base aleatoria (teórica)', 'bt.row.control': '🎰 Selección aleatoria (control real)', 'bt.row.perfect': '🎯 Techo de predicción perfecta', 'bt.row.perfectNote': '(si cada sorteo fuera acierto total)',
    'bt.badge.baseline': 'base',
    'bt.note.p': '· <b>p empírico</b>: {sims} selecciones aleatorias reales sobre los mismos sorteos (Monte Carlo); la proporción donde los aciertos medios aleatorios ≥ este método. Menor p → más probable que supere realmente al azar.',
    'bt.note.z': '· z es solo una guía aproximada: asume sorteos i.i.d., pero los conjuntos de entrenamiento se solapan mucho y se prueban varios métodos, lo que infla la significancia; el veredicto se basa en el valor p más conservador y en comprobaciones fuera de muestra.',
    'bt.note.insample': '· Esta es una evaluación <strong>dentro de muestra</strong>: responde a "¿fue algo mejor que el azar en el historial?", no a "¿puede predecir el próximo sorteo?".',
    'verdict.none': 'sin diferencia significativa con el azar', 'verdict.good': 'significativamente por encima del azar (aún requiere fuera de muestra)', 'verdict.weak': 'algo por encima del azar, evidencia débil', 'verdict.bad': 'significativamente por debajo del azar',
    'gen.note.random': '🎲 <strong>Aleatorio puro</strong>: cada número igual de probable (base uniforme), ignorando el historial. Generado con un PRNG con semilla (no Math.random) usando la semilla <b>{seed}</b>; haz clic en "Nuevo lote" para otro conjunto.',
    'gen.note.topk': 'Actualmente <strong>Top-K determinista</strong>: sin azar alguno; números tomados ordenando los pesos de consenso y rotando.',
    'gen.note.default': 'Los pesos vienen del modelo estadístico; muestreados sin reemplazo por un PRNG determinista con semilla <b>{seed}</b>: la misma semilla + parámetros se reproducen.',
    'gen.note.explain': '<br>· <b>Ajuste</b> = puntuación media de estos números según el método elegido; · <b>Coincidencia</b> = intersección con la "predicción del método" de abajo.',
    'gen.ref.label': 'Predicción del método Top-{mc} (determinista; compara con la pestaña Predecir)',
    'gen.score.fit': 'Ajuste {pct}% · Coincid. {ov}/{mc}', 'gen.score.random': 'aleatorio puro',
    'gen.verify': 'Validar', 'gen.collapse': 'Contraer', 'gen.noresult': 'Sin resultado: ajusta los parámetros.',
    'gen.preset.badge': '🔰 <b>Recomendado</b> · {name}: {win} · λ {decay} —— {why}',
    'gen.mode.hint.custom': 'Combina libremente: método / ventana / decaimiento / semilla.',
    'gen.mode.hint.recommend': 'El sistema configura automáticamente la mejor ventana y decaimiento por método: elige un método y haz clic en "Generar".',
    'window.all': 'Todos {n}', 'window.recent': 'Últimos {n}', 'winlabel.all': 'los {n} sorteos', 'winlabel.recent': 'últimos {n} sorteos',
    'iv.checked': 'Comprobados <b>{n}</b> sorteos', 'iv.maxhit': 'Máx. acertados <b>{h}</b>/{mc}', 'iv.best': 'Mejor <b style="color:var(--gold)">{div}</b>', 'iv.never': '<b>Nunca ganó</b>', 'iv.total': 'Premios totales <b>{n}</b>', 'iv.dist': 'Distribución de aciertos: {hits}', 'iv.none': 'ninguno',
    'val.alert.main': 'Introduce {mc} números principales distintos (1–{mm}).', 'val.alert.range': 'Números principales fuera de rango.', 'val.alert.extra': 'Introduce {ec} {ex} (1–{em}).',
    'val.input.main': 'Números principales ({mc}, 1–{mm})', 'val.input.extra': '{ex} (1–{em})',
    'val.best': 'División más alta alcanzada: <span class="big">{div}</span><br><span class="small muted">p. ej. sorteo #{n} ({date}): {nums}</span>',
    'val.neverBig': '<span class="big" style="color:var(--muted)">Nunca ganó</span><br><span class="small muted">Máx. principales acertados: {h}</span>',
    'val.kv.checked': 'Sorteos comprobados <b>{n}</b>', 'val.kv.maxhit': 'Máx. principales acertados <b>{h}</b>/{mc}', 'val.kv.total': 'Premios totales <b>{n}</b>',
    'val.h.divhits': 'Aciertos históricos por división', 'val.h.freq': 'Frecuencia histórica de los números elegidos',
    'val.tbl.div': 'División', 'val.tbl.hits': 'Aciertos históricos', 'val.times': '×',
    'method.frequency.name': 'Frecuencia ponderada', 'method.overdue.name': 'Atrasados', 'method.markov.name': 'Markov', 'method.bayes.name': 'Contracción bayesiana', 'method.consensus.name': 'Consenso', 'method.balanced.name': 'Forma equilibrada', 'method.topk.name': 'Top-K determinista', 'method.random.name': 'Aleatorio puro',
    'method.frequency.short': 'Más apariciones recientes → mayor peso (sesgo caliente)', 'method.overdue.short': 'Ausente mucho tiempo → más "debido" (reversión a la media)', 'method.markov.short': 'Mayor coocurrencia con el último sorteo', 'method.bayes.short': 'Contrae la frecuencia hacia el prior 7/N, evita tomar el ruido como señal', 'method.consensus.short': 'Promedio de caliente / atrasado / coocurrencia tras normalizar',
    'mi.frequency.title': '🔥 Frecuencia ponderada (caliente)', 'mi.frequency.body': 'Cómo funciona: cuenta apariciones en la ventana y pondera más los sorteos recientes con el decaimiento λ; más frecuente → mayor puntuación.\nCuándo usar: si crees que "lo caliente sigue caliente" y quieres seguir tendencias recientes.\nCombinación: ventana corta (50–100) + λ mayor (0.03–0.06) resalta el calor reciente.\nNota: un λ mayor solo mira la última docena de sorteos; en una lotería justa lo "caliente" es solo fluctuación aleatoria.',
    'mi.overdue.title': '❄️ Atrasados (Overdue)', 'mi.overdue.body': 'Cómo funciona: puntúa por "intervalo real ÷ intervalo esperado": cuanto más ausente, mayor.\nCuándo usar: si crees que "lo ausente debe revertir a la media" (lo contrario de caliente).\nCombinación: usa una ventana grande o "todos" para estadísticas de intervalo estables; no le afecta λ.\nNota: con sorteos aleatorios independientes, "ausente mucho tiempo" no hace un número más probable; es la falacia del jugador invertida; no superará al azar en el backtest, se mantiene solo como diagnóstico.',
    'mi.markov.title': '🔗 Markov (coocurrencia)', 'mi.markov.body': 'Cómo funciona: mira el sorteo más reciente y encuentra los números que históricamente más coocurren con él.\nCuándo usar: para aprovechar el "acompañamiento / coocurrencia" entre números.\nCombinación: una ventana mayor estabiliza la matriz de coocurrencia; no le afecta λ.\nNota: las bolas no tienen asociación real; la coocurrencia es casi siempre coincidencia.',
    'mi.bayes.title': '🧪 Contracción bayesiana', 'mi.bayes.body': 'Cómo funciona: en vez de confiar en la frecuencia bruta, contrae la tasa de cada número hacia el prior 7/N: (conteo + k·prior) ÷ (sorteos + k), k≈50. Los números frecuentes se acercan a la media.\nCuándo usar: para evitar el sobreajuste de "tomar el ruido aleatorio como caliente"; el método de frecuencia más conservador y honesto.\nNota: como contrae, las diferencias de puntuación son pequeñas, lo que refleja honestamente lo débil que es la señal real.',
    'mi.consensus.title': '🧠 Consenso', 'mi.consensus.body': 'Cómo funciona: normaliza "frecuencia ponderada / atrasados / coocurrencia" a 0–1 cada una y promedia con igual peso.\nCuándo usar: cuando no quieres apostar por una sola hipótesis y buscas un valor por defecto robusto.\nCombinación: ventana 100 + λ 0.03 es un ajuste equilibrado.\nNota: fusiona tres lógicas mutuamente contradictorias, así que los resultados son intermedios.',
    'mi.balanced.title': '🧩 Forma equilibrada', 'mi.balanced.body': 'Cómo funciona: sobre el muestreo ponderado de consenso, filtra las combinaciones cuya estructura se desvía demasiado del historial, restringiendo "rango de suma, proporción par/impar, proporción bajo/alto" de los números principales hacia las modas históricas.\nCuándo usar: para que las combinaciones generadas "parezcan sorteos reales".\nNota: solo restringe la forma y no aumenta las probabilidades de ganar.',
    'mi.topk.title': '🎯 Top-K determinista', 'mi.topk.body': 'Cómo funciona: sin azar alguno. Ordena todos los números por peso de consenso y rota una ventana de rango deslizante para producir varias líneas.\nCuándo usar: cuando quieres resultados reproducibles y sin azar.\nNota: las líneas solo difieren por la ventana de rango rotatoria, así que la variedad es limitada; no depende de la semilla.',
    'mi.random.title': '🎲 Aleatorio puro (base uniforme)', 'mi.random.body': 'Cómo funciona: ignora el historial por completo; cada número es igual de probable: esto es lo que la lotería realmente es, y la base para juzgar otros métodos.\nCuándo usar: cuando quieres una línea aleatoria sin sesgo, o para comparar con los "métodos matemáticos".\nNota: aún usa un PRNG con semilla (no Math.random), reproducible con la misma semilla; haz clic en "Nuevo lote" para otro conjunto. La ventana/decaimiento no tienen efecto.',
    'preset.frequency.why': 'El sesgo caliente favorece lo reciente: ventana más corta + decaimiento más fuerte', 'preset.overdue.why': 'Las estadísticas de intervalo necesitan una muestra grande para estabilizarse, y no les afecta el decaimiento', 'preset.markov.why': 'La matriz de coocurrencia es más estable con todo el historial; no le afecta el decaimiento', 'preset.bayes.why': 'Bayes contrae la frecuencia hacia el prior usando todo el historial', 'preset.consensus.why': 'Un valor por defecto robusto y equilibrado', 'preset.balanced.why': 'Forma equilibrada que se ajusta a la estructura histórica', 'preset.topk.why': 'Selección ordenada determinista; no depende de la semilla', 'preset.random.why': 'Cada número igual de probable; independiente de ventana/decaimiento (base aleatoria pura)',
  },
  fr: {
    'app.docTitle': 'Simulateur Oz Lotto & Powerball · Prédire / Générer / Valider',
    'app.title': '🎲 Simulateur de Loto',
    'app.subtitle': 'Prédiction · génération · validation statistique à partir des tirages passés (sans random())',
    'tab.overview': 'Aperçu', 'tab.predict': 'Prédire', 'tab.generate': 'Générer', 'tab.validate': 'Valider',
    'disclaimer': '⚠️ Chaque tirage est un événement aléatoire indépendant : les résultats passés <strong>ne peuvent pas</strong> prédire l’avenir. Cet outil applique diverses méthodes mathématiques/statistiques à des fins d’expérimentation et de divertissement. À utiliser avec bon sens et jamais pour des décisions de pari.',
    'window.label': 'Fenêtre statistique (N derniers tirages)',
    'ov.hot.title': '🔥 Top 10 chauds (les plus fréquents)', 'ov.hot.hint': 'Numéros principaux les plus tirés.',
    'ov.cold.title': '❄️ Top 10 froids (absents le plus longtemps)', 'ov.cold.hint': 'Numéros avec le plus grand écart depuis leur dernière sortie.',
    'ov.freq.title': '📊 Fréquence de tous les numéros', 'ov.freq.hint': 'Nombre d’apparitions de chaque numéro principal dans la fenêtre (rouge = plus chaud, bleu = plus froid).',
    'ov.shape.title': '🧩 Distribution de forme', 'ov.shape.hint': 'Caractéristiques structurelles des combinaisons passées, utilisées par la génération « équilibrée ».',
    'ov.pairs.title': '🔗 Top 10 paires', 'ov.pairs.hint': 'Paires de numéros qui apparaissent le plus ensemble (cooccurrence).',
    'ov.recent.title': '🕑 Tirages récents',
    'legend.hot': 'Chaud', 'legend.cold': 'Froid',
    'pr.title': 'Prédire le prochain tirage · plusieurs méthodes mathématiques',
    'pr.hint': 'Chaque méthode note tous les numéros et retient les plus élevés comme « ensemble prédit ». « Consensus » en bas fusionne les classements de plusieurs méthodes.',
    'pr.decay.label': 'Décroissance de récence λ (plus élevé = favorise le récent)',
    'decay.0': '0 · aucune (égal)', 'decay.0b': '0 · égal', 'decay.light': '0.01 · légère', 'decay.medium': '0.03 · moyenne', 'decay.heavy': '0.06 · forte',
    'pr.run': 'Recalculer',
    'bt.title': '🧪 Backtest : ces méthodes battent-elles vraiment le hasard ? (walk-forward)',
    'bt.hint': 'Prédit chaque tirage en n’utilisant que les données antérieures, avance jusqu’à la fin et compare la moyenne réelle de bons numéros à la base aléatoire — le seul test honnête du pouvoir prédictif.',
    'bt.mode.label': 'Mode d’entraînement', 'bt.mode.expanding': 'Fenêtre extensible (tout l’historique, croissante)', 'bt.mode.fixed': 'Fenêtre fixe (N derniers tirages seulement, N = fenêtre ci-dessus)',
    'bt.sims.label': 'Simulations Monte-Carlo (tirages aléatoires pour la valeur p empirique)',
    'bt.sims.fast': '1000 · rapide', 'bt.sims.default': '3000 · par défaut', 'bt.sims.fine': '10000 · fin', 'bt.sims.veryfine': '50000 · très fin (lent)',
    'bt.run': 'Lancer le backtest', 'bt.placeholder': 'Cliquez sur « Lancer le backtest ».',
    'gen.title': 'Générer des combinaisons possibles · échantillonnage pondéré basé sur les données',
    'gen.hint': 'Sans <code>Math.random()</code>. Les numéros sont pondérés par le modèle statistique, puis tirés par <strong>échantillonnage à graine reproductible</strong> (PRNG déterministe) — la même graine + paramètres donnent toujours le même résultat.',
    'gen.mode.recommend': '🔰 Recommandé', 'gen.mode.custom': '⚙️ Personnalisé',
    'gen.method.label': 'Méthode',
    'gen.opt.frequency': 'Fréquence pondérée (biais chaud)', 'gen.opt.overdue': 'En retard (biais froid)', 'gen.opt.markov': 'Markov (suit le dernier tirage)',
    'gen.opt.bayes': 'Rétrécissement bayésien (anti-surajustement)', 'gen.opt.consensus': 'Consensus (méthodes fusionnées)', 'gen.opt.balanced': 'Forme équilibrée (colle à l’historique)',
    'gen.opt.topk': 'Top-K déterministe (sans hasard)', 'gen.opt.random': '🎲 Pur hasard (base uniforme)',
    'gen.window.label': 'Fenêtre statistique', 'gen.decay.label': 'Décroissance de récence λ', 'gen.count.label': 'Combien de lignes', 'gen.seed.label': 'Graine',
    'gen.run': 'Générer', 'gen.newseed': 'Nouveau lot', 'gen.results.title': 'Lignes générées', 'gen.results.placeholder': 'Cliquez sur « Générer ».',
    'val.title': 'Valider une combinaison · contre tous les tirages passés',
    'val.hint': 'Saisissez un ensemble de numéros pour voir combien il aurait fait correspondre à chaque tirage passé, le rang de gain le plus élevé atteint, les gains par rang et la fréquence historique de chaque numéro.',
    'val.run': 'Valider', 'val.fillhot': 'Remplir chauds', 'val.clear': 'Effacer', 'val.result.title': 'Résultat de validation',
    'extraname.ozlotto': 'Complémentaire', 'extraname.powerball': 'Powerball',
    'unit.times': '×', 'unit.draws': 'tirages',
    'ov.meta': 'Règles actuelles : <b>{mc}</b> principaux (1–{mm}) + <b>{ec}</b> {ex} (1–{em})｜Historique disponible (format actuel) : <b>{total}</b> tirages｜Fenêtre : <b>{n}</b> tirages',
    'ov.shape.sumRange': 'Plage de somme principale', 'ov.shape.sumMean': 'Moyenne de la somme', 'ov.shape.odd': 'Nombre impair le plus courant', 'ov.shape.low': 'Nombre bas (≤{h}) le plus courant',
    'ov.shape.oddDist': 'Distribution pair/impair', 'ov.shape.oddItem': '{k} impairs:{c}',
    'ov.pairs.pair': 'Paire', 'ov.pairs.co': 'Cooccur.', 'tbl.draw': 'Tirage', 'tbl.date': 'Date', 'tbl.numbers': 'Numéros',
    'predict.extraHot': '{ex} fréquents',
    'bt.note.run': 'Backtest : {mode}, walk-forward sur <b>{n}</b> points de test (prédit chaque tirage avec les seules données antérieures ; numéros principaux uniquement).',
    'bt.mode.expandingShort': 'fenêtre extensible', 'bt.mode.fixedShort': 'fenêtre fixe',
    'bt.headline.good': '⚠️ {n} méthode(s) ont une valeur p empirique < 0,01. Mais avec {m} méthodes testées à la fois et comme c’est un backtest <strong>en échantillon</strong>, ~{e} faux positifs sont attendus — vérifiez sur des <strong>tirages futurs</strong> et ne pariez jamais dessus.',
    'bt.headline.none': '✅ Aucune méthode ne bat significativement le hasard (toutes les valeurs p empiriques ≥ 0,01, y compris le contrôle aléatoire réel). Cela confirme que « la loterie est un événement aléatoire indépendant ; l’historique ne peut pas prédire le prochain tirage ».',
    'bt.col.method': 'Méthode', 'bt.col.avg': 'Bons moy./tirage', 'bt.col.delta': 'vs base Δ', 'bt.col.z': 'z', 'bt.col.p': 'p emp.', 'bt.col.verdict': 'Verdict',
    'bt.row.baseline': '🎲 Base aléatoire (théorique)', 'bt.row.control': '🎰 Tirage aléatoire (contrôle réel)', 'bt.row.perfect': '🎯 Plafond de prédiction parfaite', 'bt.row.perfectNote': '(si chaque tirage était un plein)',
    'bt.badge.baseline': 'base',
    'bt.note.p': '· <b>p empirique</b> : {sims} tirages aléatoires réels sur les mêmes tirages (Monte-Carlo) ; la part où la moyenne aléatoire de bons numéros ≥ cette méthode. Plus p est petit → plus probable de vraiment battre le hasard.',
    'bt.note.z': '· z n’est qu’un repère approximatif — il suppose des tirages i.i.d., mais les ensembles d’entraînement se chevauchent fortement et plusieurs méthodes sont testées, ce qui gonfle la significativité ; le verdict s’appuie sur la valeur p plus conservatrice et des vérifications hors échantillon.',
    'bt.note.insample': '· Il s’agit d’une évaluation <strong>en échantillon</strong> : elle répond à « était-ce un peu mieux que le hasard dans l’historique », pas à « peut-elle prédire le prochain tirage ».',
    'verdict.none': 'pas de différence significative avec le hasard', 'verdict.good': 'significativement au-dessus du hasard (nécessite encore hors échantillon)', 'verdict.weak': 'légèrement au-dessus du hasard, preuve faible', 'verdict.bad': 'significativement en dessous du hasard',
    'gen.note.random': '🎲 <strong>Pur hasard</strong> : chaque numéro également probable (base uniforme), sans tenir compte de l’historique. Généré avec un PRNG à graine (pas Math.random) avec la graine <b>{seed}</b> ; cliquez sur « Nouveau lot » pour un nouvel ensemble.',
    'gen.note.topk': 'Actuellement <strong>Top-K déterministe</strong> : aucun hasard ; numéros pris en triant les poids de consensus et en effectuant une rotation.',
    'gen.note.default': 'Les poids viennent du modèle statistique ; échantillonnés sans remise par un PRNG déterministe avec la graine <b>{seed}</b> — même graine + paramètres = reproductible.',
    'gen.note.explain': '<br>· <b>Adéquation</b> = score moyen de ces numéros selon la méthode choisie ; · <b>Chevauchement</b> = intersection avec la « prédiction de la méthode » ci-dessous.',
    'gen.ref.label': 'Prédiction de la méthode Top-{mc} (déterministe ; à comparer avec l’onglet Prédire)',
    'gen.score.fit': 'Adéq. {pct}% · Chevauch. {ov}/{mc}', 'gen.score.random': 'pur hasard',
    'gen.verify': 'Valider', 'gen.collapse': 'Réduire', 'gen.noresult': 'Aucun résultat — ajustez les paramètres.',
    'gen.preset.badge': '🔰 <b>Recommandé</b> · {name} : {win} · λ {decay} —— {why}',
    'gen.mode.hint.custom': 'Combinez librement : méthode / fenêtre / décroissance / graine.',
    'gen.mode.hint.recommend': 'Le système configure automatiquement la meilleure fenêtre et décroissance par méthode — choisissez une méthode et cliquez sur « Générer ».',
    'window.all': 'Tous {n}', 'window.recent': '{n} derniers', 'winlabel.all': 'les {n} tirages', 'winlabel.recent': '{n} derniers tirages',
    'iv.checked': '<b>{n}</b> tirages vérifiés', 'iv.maxhit': 'Max corrects <b>{h}</b>/{mc}', 'iv.best': 'Meilleur <b style="color:var(--gold)">{div}</b>', 'iv.never': '<b>Jamais gagné</b>', 'iv.total': 'Gains totaux <b>{n}</b>', 'iv.dist': 'Distribution des bons : {hits}', 'iv.none': 'aucun',
    'val.alert.main': 'Veuillez saisir {mc} numéros principaux distincts (1–{mm}).', 'val.alert.range': 'Numéros principaux hors plage.', 'val.alert.extra': 'Veuillez saisir {ec} {ex} (1–{em}).',
    'val.input.main': 'Numéros principaux ({mc}, 1–{mm})', 'val.input.extra': '{ex} (1–{em})',
    'val.best': 'Rang le plus élevé atteint : <span class="big">{div}</span><br><span class="small muted">ex. tirage #{n} ({date}) : {nums}</span>',
    'val.neverBig': '<span class="big" style="color:var(--muted)">Jamais gagné</span><br><span class="small muted">Max de principaux corrects : {h}</span>',
    'val.kv.checked': 'Tirages vérifiés <b>{n}</b>', 'val.kv.maxhit': 'Max principaux corrects <b>{h}</b>/{mc}', 'val.kv.total': 'Gains totaux <b>{n}</b>',
    'val.h.divhits': 'Gains historiques par rang', 'val.h.freq': 'Fréquence historique des numéros choisis',
    'val.tbl.div': 'Rang', 'val.tbl.hits': 'Gains historiques', 'val.times': '×',
    'method.frequency.name': 'Fréquence pondérée', 'method.overdue.name': 'En retard', 'method.markov.name': 'Markov', 'method.bayes.name': 'Rétrécissement bayésien', 'method.consensus.name': 'Consensus', 'method.balanced.name': 'Forme équilibrée', 'method.topk.name': 'Top-K déterministe', 'method.random.name': 'Pur hasard',
    'method.frequency.short': 'Plus d’apparitions récentes → poids plus élevé (biais chaud)', 'method.overdue.short': 'Absent longtemps → plus « attendu » (retour à la moyenne)', 'method.markov.short': 'Plus grande cooccurrence avec le dernier tirage', 'method.bayes.short': 'Rétrécit la fréquence vers le prior 7/N, évite de prendre le bruit pour un signal', 'method.consensus.short': 'Moyenne de chaud / en retard / cooccurrence après normalisation',
    'mi.frequency.title': '🔥 Fréquence pondérée (chaud)', 'mi.frequency.body': 'Principe : compte les apparitions dans la fenêtre et pondère davantage les tirages récents via la décroissance λ — plus fréquent → score plus élevé.\nQuand l’utiliser : si vous pensez que « le chaud reste chaud » et voulez suivre les tendances récentes.\nAssociation : fenêtre courte (50–100) + λ plus grand (0,03–0,06) accentue la chaleur récente.\nNote : un λ plus grand ne regarde que la dizaine de derniers tirages ; dans une loterie équitable, le « chaud » n’est qu’une fluctuation aléatoire.',
    'mi.overdue.title': '❄️ En retard (Overdue)', 'mi.overdue.body': 'Principe : note par « écart réel ÷ écart attendu » — plus c’est absent, plus c’est élevé.\nQuand l’utiliser : si vous pensez que « l’absent doit revenir à la moyenne » (l’inverse du chaud).\nAssociation : utilisez une grande fenêtre ou « tous » pour des stats d’écart stables ; non affecté par λ.\nNote : avec des tirages aléatoires indépendants, « absent longtemps » ne rend pas un numéro plus probable ; c’est le sophisme du joueur inversé ; il ne battra pas le hasard au backtest, gardé seulement comme diagnostic.',
    'mi.markov.title': '🔗 Markov (cooccurrence)', 'mi.markov.body': 'Principe : regarde le tirage le plus récent et trouve les numéros qui cooccurrent historiquement le plus avec lui.\nQuand l’utiliser : pour exploiter l’« accompagnement / cooccurrence » entre numéros.\nAssociation : une plus grande fenêtre stabilise la matrice de cooccurrence ; non affecté par λ.\nNote : les boules n’ont aucune association réelle ; la cooccurrence est surtout une coïncidence.',
    'mi.bayes.title': '🧪 Rétrécissement bayésien', 'mi.bayes.body': 'Principe : au lieu de se fier à la fréquence brute, il rétrécit le taux de chaque numéro vers le prior 7/N — (compte + k·prior) ÷ (tirages + k), k≈50. Les numéros fréquents sont ramenés vers la moyenne.\nQuand l’utiliser : pour éviter le surajustement « prendre le bruit aléatoire pour du chaud » ; la méthode de fréquence la plus conservatrice et honnête.\nNote : comme il rétrécit, les écarts de score sont faibles — ce qui reflète honnêtement la faiblesse du signal réel.',
    'mi.consensus.title': '🧠 Consensus', 'mi.consensus.body': 'Principe : normalise « fréquence pondérée / en retard / cooccurrence » à 0–1 chacune, puis fait la moyenne à poids égal.\nQuand l’utiliser : quand vous ne voulez pas parier sur une seule hypothèse et voulez une valeur par défaut robuste.\nAssociation : fenêtre 100 + λ 0,03 est un réglage équilibré.\nNote : fusionne trois logiques mutuellement contradictoires, donc les résultats sont moyens.',
    'mi.balanced.title': '🧩 Forme équilibrée', 'mi.balanced.body': 'Principe : par-dessus l’échantillonnage pondéré du consensus, il filtre les combinaisons dont la structure s’écarte trop de l’historique — en contraignant « plage de somme, ratio pair/impair, ratio bas/haut » des numéros principaux vers les modes historiques.\nQuand l’utiliser : pour que les combinaisons générées « ressemblent à de vrais tirages ».\nNote : il ne contraint que la forme et n’augmente pas les chances de gagner.',
    'mi.topk.title': '🎯 Top-K déterministe', 'mi.topk.body': 'Principe : aucun hasard. Trie tous les numéros par poids de consensus et fait tourner une fenêtre de rang glissante pour produire plusieurs lignes.\nQuand l’utiliser : quand vous voulez des résultats reproductibles et sans hasard.\nNote : les lignes ne diffèrent que par la fenêtre de rang rotative, donc la variété est limitée ; indépendant de la graine.',
    'mi.random.title': '🎲 Pur hasard (base uniforme)', 'mi.random.body': 'Principe : ignore complètement l’historique ; chaque numéro est également probable — c’est ce qu’est réellement la loterie, et la base pour juger les autres méthodes.\nQuand l’utiliser : quand vous voulez une ligne aléatoire sans biais, ou pour comparer aux « méthodes mathématiques ».\nNote : utilise toujours un PRNG à graine (pas Math.random), reproductible avec la même graine ; cliquez sur « Nouveau lot » pour un nouvel ensemble. La fenêtre/décroissance n’ont aucun effet.',
    'preset.frequency.why': 'Le biais chaud favorise le récent : fenêtre plus courte + décroissance plus forte', 'preset.overdue.why': 'Les stats d’écart nécessitent un grand échantillon pour se stabiliser, et ne sont pas affectées par la décroissance', 'preset.markov.why': 'La matrice de cooccurrence est plus stable sur tout l’historique ; non affectée par la décroissance', 'preset.bayes.why': 'Bayes rétrécit la fréquence vers le prior en utilisant tout l’historique', 'preset.consensus.why': 'Une valeur par défaut robuste et équilibrée', 'preset.balanced.why': 'Forme équilibrée qui colle à la structure historique', 'preset.topk.why': 'Sélection triée déterministe ; indépendante de la graine', 'preset.random.why': 'Chaque numéro également probable ; indépendant de la fenêtre/décroissance (pur hasard)',
  },
  ja: {
    'app.docTitle': 'Oz Lotto & Powerball シミュレーター · 予測 / 生成 / 検証',
    'app.title': '🎲 ロトシミュレーター',
    'app.subtitle': '過去の抽選結果による統計的な予測・生成・検証（random() 不使用）',
    'tab.overview': '概要', 'tab.predict': '予測', 'tab.generate': '生成', 'tab.validate': '検証',
    'disclaimer': '⚠️ 各抽選は独立したランダム事象で、過去の結果から未来を<strong>予測することはできません</strong>。本ツールは各種の数学的・統計的手法を実験と娯楽のために用いるものです。理性的にご利用ください。賭けの判断には決して使わないでください。',
    'window.label': '統計ウィンドウ（直近 N 回）',
    'ov.hot.title': '🔥 ホット Top 10（ウィンドウ内で最多出現）', 'ov.hot.hint': '最も出やすい本数字。',
    'ov.cold.title': '❄️ コールド Top 10（最も長く未出現）', 'ov.cold.hint': '前回出現からの間隔が最も長い数字。',
    'ov.freq.title': '📊 全数字の出現頻度', 'ov.freq.hint': 'ウィンドウ内で各本数字が出た回数（赤＝ホット、青＝コールド）。',
    'ov.shape.title': '🧩 形状分布', 'ov.shape.hint': '過去の組み合わせの構造的特徴。「バランス生成」で使用。',
    'ov.pairs.title': '🔗 高頻度ペア Top 10', 'ov.pairs.hint': '最も一緒に出る数字のペア（共起）。',
    'ov.recent.title': '🕑 最近の抽選',
    'legend.hot': 'ホット', 'legend.cold': 'コールド',
    'pr.title': '次回を予測 · 複数の数学的手法',
    'pr.hint': '各手法がすべての数字に得点を付け、上位を「予測セット」とします。下部の「コンセンサス」は複数手法の順位を統合したものです。',
    'pr.decay.label': '直近重み付け減衰 λ（大きいほど直近重視）',
    'decay.0': '0 · なし（均等）', 'decay.0b': '0 · 均等', 'decay.light': '0.01 · 弱', 'decay.medium': '0.03 · 中', 'decay.heavy': '0.06 · 強',
    'pr.run': '再計算',
    'bt.title': '🧪 バックテスト：これらの手法は本当にランダムを上回る？（ウォークフォワード）',
    'bt.hint': 'その回より前のデータだけで各回を予測し、最後までスライドして、実際の平均的中数をランダム基準と比較します——予測力を検証する唯一の誠実な方法です。',
    'bt.mode.label': '学習モード', 'bt.mode.expanding': '拡張ウィンドウ（全履歴・逐次増加）', 'bt.mode.fixed': '固定ウィンドウ（直近 N 回のみ、N＝上のウィンドウ）',
    'bt.sims.label': 'モンテカルロ試行回数（経験的 p 値用のランダム抽選回数）',
    'bt.sims.fast': '1000 · 速い', 'bt.sims.default': '3000 · 既定', 'bt.sims.fine': '10000 · 精密', 'bt.sims.veryfine': '50000 · 非常に精密（遅い）',
    'bt.run': 'バックテスト実行', 'bt.placeholder': '「バックテスト実行」をクリック。',
    'gen.title': '可能な組み合わせを生成 · データ駆動の重み付きサンプリング',
    'gen.hint': '<code>Math.random()</code> は不使用。数字は統計モデルで重み付けし、<strong>再現可能なシード付きサンプリング</strong>（決定論的 PRNG）で抽出します——同じシード＋パラメータなら常に同じ結果になります。',
    'gen.mode.recommend': '🔰 おすすめ', 'gen.mode.custom': '⚙️ カスタム',
    'gen.method.label': '手法',
    'gen.opt.frequency': '重み付き頻度（ホット寄り）', 'gen.opt.overdue': 'オーバーデュー（コールド寄り）', 'gen.opt.markov': 'マルコフ（直近回に追従）',
    'gen.opt.bayes': 'ベイズ収縮（過学習防止）', 'gen.opt.consensus': 'コンセンサス（手法統合）', 'gen.opt.balanced': 'バランス形状（履歴に整合）',
    'gen.opt.topk': '決定論的 Top-K（ランダムなし）', 'gen.opt.random': '🎲 純粋ランダム（一様基準）',
    'gen.window.label': '統計ウィンドウ', 'gen.decay.label': '直近重み付け減衰 λ', 'gen.count.label': '生成口数', 'gen.seed.label': 'シード',
    'gen.run': '生成', 'gen.newseed': '別のセット', 'gen.results.title': '生成結果', 'gen.results.placeholder': '「生成」をクリック。',
    'val.title': '組み合わせを検証 · 全履歴と照合',
    'val.hint': '数字を入力すると、過去の各回で何個一致したか、到達した最高等級、等級ごとの的中回数、各数字の過去頻度を表示します。',
    'val.run': '検証', 'val.fillhot': 'ホットを入力', 'val.clear': 'クリア', 'val.result.title': '検証結果',
    'extraname.ozlotto': '補助番号', 'extraname.powerball': 'パワーボール',
    'unit.times': '回', 'unit.draws': '回',
    'ov.meta': '現行ルール：本数字 <b>{mc}</b> 個 (1–{mm}) + {ex} <b>{ec}</b> 個 (1–{em})｜利用可能な履歴（現行形式）：<b>{total}</b> 回｜ウィンドウ：<b>{n}</b> 回',
    'ov.shape.sumRange': '本数字合計の範囲', 'ov.shape.sumMean': '合計の平均', 'ov.shape.odd': '最も多い奇数の個数', 'ov.shape.low': '最も多い小さい数(≤{h})の個数',
    'ov.shape.oddDist': '奇偶分布', 'ov.shape.oddItem': '奇{k}:{c}',
    'ov.pairs.pair': 'ペア', 'ov.pairs.co': '共起', 'tbl.draw': '回号', 'tbl.date': '日付', 'tbl.numbers': '数字',
    'predict.extraHot': '{ex} 高頻度',
    'bt.note.run': 'バックテスト方式：{mode}、<b>{n}</b> 個のテスト点でウォークフォワード（その回より前のデータのみで予測、本数字のみ照合）。',
    'bt.mode.expandingShort': '拡張ウィンドウ', 'bt.mode.fixedShort': '固定ウィンドウ',
    'bt.headline.good': '⚠️ {n} 個の手法で経験的 p 値 < 0.01。ただし {m} 個の手法を同時検定し、これは<strong>標本内</strong>バックテストのため、偽陽性は約 {e} 個と予想されます——必ず<strong>将来の新しい抽選</strong>で標本外検証し、これを根拠に賭けないでください。',
    'bt.headline.none': '✅ ランダムを有意に上回る手法はありません（実測のランダム対照を含め、経験的 p 値はすべて ≥ 0.01）。これは「宝くじは独立したランダム事象であり、履歴から次回は予測できない」という結論と一致します。',
    'bt.col.method': '手法', 'bt.col.avg': '平均的中/回', 'bt.col.delta': 'vs 基準 Δ', 'bt.col.z': 'z 値', 'bt.col.p': '経験的 p 値', 'bt.col.verdict': '判定',
    'bt.row.baseline': '🎲 ランダム基準（理論）', 'bt.row.control': '🎰 ランダム選択（実測対照）', 'bt.row.perfect': '🎯 完全予測の上限', 'bt.row.perfectNote': '（毎回すべて的中した場合）',
    'bt.badge.baseline': '基準',
    'bt.note.p': '· <b>経験的 p 値</b>：同じ抽選群に対して実際のランダム選択を {sims} 回（モンテカルロ）行い、「ランダムの平均的中 ≥ 本手法」の割合を算出。p が小さいほど真にランダムを上回る可能性が高い。',
    'bt.note.z': '· z 値はあくまで目安です——各回が i.i.d. と仮定しますが、学習集合は大きく重複し、複数手法を検定するため有意性が過大評価されます。判定はより保守的な p 値と標本外検証に基づきます。',
    'bt.note.insample': '· これは<strong>標本内</strong>評価です：「履歴上ランダムよりわずかに良かったか」には答えますが、「次回を予測できるか」は証明しません。',
    'verdict.none': 'ランダムと有意差なし', 'verdict.good': 'ランダムを有意に上回る（標本外検証が必要）', 'verdict.weak': 'ランダムをやや上回るが証拠は弱い', 'verdict.bad': 'ランダムを有意に下回る',
    'gen.note.random': '🎲 <strong>純粋ランダム</strong>：各数字が等確率（一様基準）で、履歴を見ません。シード <b>{seed}</b> の PRNG（Math.random ではない）で生成。「別のセット」で新しい組をどうぞ。',
    'gen.note.topk': '現在は<strong>決定論的 Top-K</strong>：ランダムを一切使わず、コンセンサス重みでソートしてローテーションで選びます。',
    'gen.note.default': '重みは統計モデルで算出し、シード <b>{seed}</b> の決定論的 PRNG で非復元抽出——同じシード＋パラメータで再現可能。',
    'gen.note.explain': '<br>· <b>適合度</b>＝選択手法の重みでのこの組の平均得点；· <b>重複</b>＝下の「手法の予測」との共通部分。',
    'gen.ref.label': '手法の「予測」Top-{mc}（決定論的、「予測」タブと比較可）',
    'gen.score.fit': '適合度 {pct}% · 重複 {ov}/{mc}', 'gen.score.random': '純粋ランダム',
    'gen.verify': '検証', 'gen.collapse': '閉じる', 'gen.noresult': '結果なし——パラメータを調整してください。',
    'gen.preset.badge': '🔰 <b>おすすめ設定</b> · {name}：{win} · λ {decay} —— {why}',
    'gen.mode.hint.custom': '自由に組み合わせ：手法 / ウィンドウ / 減衰 / シード。',
    'gen.mode.hint.recommend': 'システムが手法ごとに最適なウィンドウと減衰を自動設定します——手法を選んで「生成」をクリックするだけ。',
    'window.all': '全 {n}', 'window.recent': '直近 {n}', 'winlabel.all': '全 {n} 回', 'winlabel.recent': '直近 {n} 回',
    'iv.checked': '<b>{n}</b> 回を照合', 'iv.maxhit': '最多的中 <b>{h}</b>/{mc}', 'iv.best': '最高 <b style="color:var(--gold)">{div}</b>', 'iv.never': '<b>当選なし</b>', 'iv.total': '当選合計 <b>{n}</b>', 'iv.dist': '的中分布：{hits}', 'iv.none': 'なし',
    'val.alert.main': '{mc} 個の重複しない本数字を入力してください（1–{mm}）。', 'val.alert.range': '本数字が範囲外です。', 'val.alert.extra': '{ec} 個の {ex} を入力してください（1–{em}）。',
    'val.input.main': '本数字（{mc} 個、1–{mm}）', 'val.input.extra': '{ex}（1–{em}）',
    'val.best': '到達した最高等級：<span class="big">{div}</span><br><span class="small muted">例：第 #{n} 回（{date}）：{nums}</span>',
    'val.neverBig': '<span class="big" style="color:var(--muted)">当選なし</span><br><span class="small muted">最多的中の本数字：{h}</span>',
    'val.kv.checked': '照合回数 <b>{n}</b>', 'val.kv.maxhit': '最多的中の本数字 <b>{h}</b>/{mc}', 'val.kv.total': '当選合計 <b>{n}</b>',
    'val.h.divhits': '等級別の過去的中', 'val.h.freq': '選択数字の過去頻度',
    'val.tbl.div': '等級', 'val.tbl.hits': '過去的中回数', 'val.times': '回',
    'method.frequency.name': '重み付き頻度', 'method.overdue.name': 'オーバーデュー', 'method.markov.name': 'マルコフ', 'method.bayes.name': 'ベイズ収縮', 'method.consensus.name': 'コンセンサス', 'method.balanced.name': 'バランス形状', 'method.topk.name': '決定論的 Top-K', 'method.random.name': '純粋ランダム',
    'method.frequency.short': '直近の出現が多いほど重みが大きい（ホット寄り）', 'method.overdue.short': '長く未出 → より「出るべき」（平均回帰の仮定）', 'method.markov.short': '直近回と過去最も共起する数字', 'method.bayes.short': '頻度を事前分布 7/N に収縮し、ノイズを信号と見なさない', 'method.consensus.short': 'ホット／オーバーデュー／共起を正規化後に平均',
    'mi.frequency.title': '🔥 重み付き頻度（ホット）', 'mi.frequency.body': '仕組み：ウィンドウ内の出現回数を数え、減衰 λ で直近の回をより重視します——出現が多いほど高得点。\n使いどき：「ホットは続く」と考え、直近のトレンドに従いたいとき。\n組み合わせ：短いウィンドウ(50–100) + 大きめの λ(0.03–0.06)で直近の勢いを強調。\n注意：λ が大きいほど直近十数回しか見ません。公平な宝くじでは「ホット」は単なるランダムなゆらぎです。',
    'mi.overdue.title': '❄️ オーバーデュー（Overdue）', 'mi.overdue.body': '仕組み：「実際の間隔 ÷ 期待間隔」で採点し、長く出ていないほど高得点。\n使いどき：「久しく出ていない数は平均に回帰すべき」と考えるとき（ホットの逆）。\n組み合わせ：間隔統計を安定させるため大きいウィンドウか「全部」を使用。λ の影響を受けません。\n注意：独立なランダム抽選では「長く未出」でも出やすくはなりません。逆向きのギャンブラーの誤謬です。バックテストでランダムを上回らず、診断用としてのみ残しています。',
    'mi.markov.title': '🔗 マルコフ（共起）', 'mi.markov.body': '仕組み：直近の回を見て、それと過去に最も共起する数字を探します。\n使いどき：数字間の「随伴／共起」を活かしたいとき。\n組み合わせ：ウィンドウが大きいほど共起行列が安定。λ の影響を受けません。\n注意：ボール間に実際の関連はなく、共起はほぼ偶然です。',
    'mi.bayes.title': '🧪 ベイズ収縮（Shrinkage）', 'mi.bayes.body': '仕組み：生の頻度を鵜呑みにせず、各数字の率を事前分布 7/N に収縮します——(出現回数 + k·事前) ÷ (回数 + k)、k≈50。出現の多い数は平均へ引き戻されます。\n使いどき：「ランダムなゆらぎをホットと誤認する」過学習を避けたいとき。最も保守的で誠実な頻度手法。\n注意：収縮するため数字間の得点差は小さく、これは真の信号が弱いことを正直に反映しています。',
    'mi.consensus.title': '🧠 コンセンサス（Consensus）', 'mi.consensus.body': '仕組み：「重み付き頻度／オーバーデュー／共起」をそれぞれ 0–1 に正規化し、均等平均します。\n使いどき：単一の仮定に賭けず、堅実な既定値が欲しいとき。\n組み合わせ：ウィンドウ 100 + λ 0.03 がバランスの良い設定。\n注意：相互に矛盾する三つの論理を統合するため、結果は中庸になります。',
    'mi.balanced.title': '🧩 バランス形状（Balanced）', 'mi.balanced.body': '仕組み：コンセンサスの重み付きサンプリングに加え、履歴から逸脱しすぎる組み合わせを除外します——本数字の「合計範囲・奇偶比・大小比」を履歴の最頻値に近づけます。\n使いどき：生成した組を「本物の抽選らしく」見せたいとき。\n注意：形状を制約するだけで、当選確率は上がりません。',
    'mi.topk.title': '🎯 決定論的 Top-K', 'mi.topk.body': '仕組み：ランダムを一切使いません。全数字をコンセンサス重みでソートし、スライドする順位ウィンドウをローテーションして複数口を作ります。\n使いどき：再現可能でランダムなしの結果が欲しいとき。\n注意：各口は順位ウィンドウのローテーションだけで異なるため多様性は限定的。シードとは無関係です。',
    'mi.random.title': '🎲 純粋ランダム（一様基準）', 'mi.random.body': '仕組み：履歴を完全に無視し、各数字が等確率——これが宝くじの実際の姿であり、他手法を測る基準線です。\n使いどき：偏りのないランダムな一口が欲しいとき、または「数学的手法」と比較したいとき。\n注意：それでもシード付き PRNG（Math.random ではない）を使い、同じシードで再現可能。「別のセット」で新しい組を。ウィンドウ／減衰は無効です。',
    'preset.frequency.why': 'ホット寄りは直近重視：短めのウィンドウ + 強めの減衰', 'preset.overdue.why': '間隔統計は安定に大きな標本が必要で、減衰の影響を受けない', 'preset.markov.why': '共起行列は全履歴の方が安定；減衰の影響を受けない', 'preset.bayes.why': 'ベイズは全履歴で頻度を事前分布へ収縮', 'preset.consensus.why': '堅実でバランスの取れた既定値', 'preset.balanced.why': '履歴構造に整合するバランス形状', 'preset.topk.why': '決定論的な順位選択；シードと無関係', 'preset.random.why': '各数字が等確率；ウィンドウ／減衰と無関係（純粋ランダム基準）',
  },
  ko: {
    'app.docTitle': 'Oz Lotto & Powerball 시뮬레이터 · 예측 / 생성 / 검증',
    'app.title': '🎲 로또 시뮬레이터',
    'app.subtitle': '과거 추첨 결과 기반 통계적 예측·생성·검증 (random() 미사용)',
    'tab.overview': '개요', 'tab.predict': '예측', 'tab.generate': '생성', 'tab.validate': '검증',
    'disclaimer': '⚠️ 모든 추첨은 독립적인 무작위 사건으로, 과거 결과로 미래를 <strong>예측할 수 없습니다</strong>. 본 도구는 다양한 수학적·통계적 방법을 실험과 재미를 위해 사용합니다. 합리적으로 이용하시고 절대 베팅 결정에 사용하지 마세요.',
    'window.label': '통계 창 (최근 N회)',
    'ov.hot.title': '🔥 핫 Top 10 (창 내 최다 출현)', 'ov.hot.hint': '가장 자주 나오는 본번호.',
    'ov.cold.title': '❄️ 콜드 Top 10 (가장 오래 미출현)', 'ov.cold.hint': '마지막 출현 이후 간격이 가장 긴 번호.',
    'ov.freq.title': '📊 전체 번호 출현 빈도', 'ov.freq.hint': '창 내 각 본번호의 출현 횟수 (빨강=핫, 파랑=콜드).',
    'ov.shape.title': '🧩 형태 분포', 'ov.shape.hint': '과거 조합의 구조적 특징. "균형 생성"에 사용.',
    'ov.pairs.title': '🔗 고빈도 페어 Top 10', 'ov.pairs.hint': '가장 자주 함께 나오는 번호 쌍 (동시출현).',
    'ov.recent.title': '🕑 최근 추첨',
    'legend.hot': '핫', 'legend.cold': '콜드',
    'pr.title': '다음 회차 예측 · 여러 수학적 방법',
    'pr.hint': '각 방법이 모든 번호에 점수를 매기고 상위 몇 개를 "예측 세트"로 삼습니다. 하단의 "컨센서스"는 여러 방법의 순위를 융합한 것입니다.',
    'pr.decay.label': '최근 가중 감쇠 λ (클수록 최근 중시)',
    'decay.0': '0 · 없음(균등)', 'decay.0b': '0 · 균등', 'decay.light': '0.01 · 약', 'decay.medium': '0.03 · 중', 'decay.heavy': '0.06 · 강',
    'pr.run': '재계산',
    'bt.title': '🧪 백테스트: 이 방법들이 정말 무작위를 이기는가? (워크포워드)',
    'bt.hint': '각 회차를 그 이전 데이터만으로 예측하고 끝까지 진행하여, 실제 평균 적중수를 무작위 기준과 비교합니다 — 예측력을 검증하는 유일하게 정직한 방법입니다.',
    'bt.mode.label': '학습 모드', 'bt.mode.expanding': '확장 창 (전체 이력, 점차 증가)', 'bt.mode.fixed': '고정 창 (최근 N회만, N=위 창)',
    'bt.sims.label': '몬테카를로 시뮬 (경험적 p값용 무작위 추첨 횟수)',
    'bt.sims.fast': '1000 · 빠름', 'bt.sims.default': '3000 · 기본', 'bt.sims.fine': '10000 · 정밀', 'bt.sims.veryfine': '50000 · 매우 정밀(느림)',
    'bt.run': '백테스트 실행', 'bt.placeholder': '"백테스트 실행"을 클릭.',
    'gen.title': '가능한 조합 생성 · 데이터 기반 가중 샘플링',
    'gen.hint': '<code>Math.random()</code> 미사용. 번호는 통계 모델로 가중치를 두고 <strong>재현 가능한 시드 샘플링</strong>(결정론적 PRNG)으로 추출합니다 — 같은 시드+파라미터는 항상 같은 결과를 냅니다.',
    'gen.mode.recommend': '🔰 추천', 'gen.mode.custom': '⚙️ 사용자 지정',
    'gen.method.label': '방법',
    'gen.opt.frequency': '가중 빈도 (핫 편향)', 'gen.opt.overdue': '오버듀 (콜드 편향)', 'gen.opt.markov': '마르코프 (직전 회차 추종)',
    'gen.opt.bayes': '베이즈 수축 (과적합 방지)', 'gen.opt.consensus': '컨센서스 (방법 융합)', 'gen.opt.balanced': '균형 형태 (이력에 맞춤)',
    'gen.opt.topk': '결정론적 Top-K (무작위 없음)', 'gen.opt.random': '🎲 순수 무작위 (균등 기준)',
    'gen.window.label': '통계 창', 'gen.decay.label': '최근 가중 감쇠 λ', 'gen.count.label': '생성 줄 수', 'gen.seed.label': '시드',
    'gen.run': '생성', 'gen.newseed': '새 세트', 'gen.results.title': '생성 결과', 'gen.results.placeholder': '"생성"을 클릭.',
    'val.title': '조합 검증 · 전체 이력과 대조',
    'val.hint': '번호를 입력하면 과거 각 회차에서 몇 개 맞았는지, 도달한 최고 등위, 등위별 적중 횟수, 각 번호의 과거 빈도를 보여줍니다.',
    'val.run': '검증', 'val.fillhot': '핫 번호 채우기', 'val.clear': '지우기', 'val.result.title': '검증 결과',
    'extraname.ozlotto': '보조번호', 'extraname.powerball': '파워볼',
    'unit.times': '회', 'unit.draws': '회',
    'ov.meta': '현재 규칙: 본번호 <b>{mc}</b>개 (1–{mm}) + {ex} <b>{ec}</b>개 (1–{em})｜사용 가능 이력(현재 형식): <b>{total}</b>회｜창: <b>{n}</b>회',
    'ov.shape.sumRange': '본번호 합 범위', 'ov.shape.sumMean': '합 평균', 'ov.shape.odd': '가장 흔한 홀수 개수', 'ov.shape.low': '가장 흔한 작은수(≤{h}) 개수',
    'ov.shape.oddDist': '홀짝 분포', 'ov.shape.oddItem': '홀{k}:{c}',
    'ov.pairs.pair': '페어', 'ov.pairs.co': '동시출현', 'tbl.draw': '회차', 'tbl.date': '날짜', 'tbl.numbers': '번호',
    'predict.extraHot': '{ex} 고빈도',
    'bt.note.run': '백테스트 방식: {mode}, <b>{n}</b>개 테스트 지점에 대해 워크포워드(그 회차 이전 데이터만으로 예측, 본번호만 대조).',
    'bt.mode.expandingShort': '확장 창', 'bt.mode.fixedShort': '고정 창',
    'bt.headline.good': '⚠️ {n}개 방법의 경험적 p값 < 0.01. 그러나 {m}개 방법을 동시에 검정했고 <strong>표본 내</strong> 백테스트이므로 위양성은 약 {e}개로 예상됩니다 — 반드시 <strong>미래의 새 추첨</strong>으로 표본 외 검증을 하고, 이를 근거로 베팅하지 마세요.',
    'bt.headline.none': '✅ 무작위를 유의하게 이기는 방법은 없습니다(실측 무작위 대조 포함, 경험적 p값 모두 ≥ 0.01). 이는 "복권은 독립적 무작위 사건이며 이력으로 다음 회차를 예측할 수 없다"는 결론과 일치합니다.',
    'bt.col.method': '방법', 'bt.col.avg': '평균 적중/회', 'bt.col.delta': 'vs 기준 Δ', 'bt.col.z': 'z값', 'bt.col.p': '경험적 p값', 'bt.col.verdict': '판정',
    'bt.row.baseline': '🎲 무작위 기준(이론)', 'bt.row.control': '🎰 무작위 선택(실측 대조)', 'bt.row.perfect': '🎯 완벽 예측 상한', 'bt.row.perfectNote': '(매 회차 전부 적중 시)',
    'bt.badge.baseline': '기준',
    'bt.note.p': '· <b>경험적 p값</b>: 동일한 추첨군에 대해 실제 무작위 선택을 {sims}회(몬테카를로) 수행하여 "무작위 평균 적중 ≥ 본 방법"의 비율을 계산. p가 작을수록 진짜로 무작위를 이길 가능성이 큽니다.',
    'bt.note.z': '· z값은 대략적인 참고일 뿐입니다 — 각 회차가 i.i.d.라고 가정하지만 학습 집합이 크게 겹치고 여러 방법을 검정하므로 유의성이 과대평가됩니다. 판정은 더 보수적인 p값과 표본 외 검증을 따릅니다.',
    'bt.note.insample': '· 이것은 <strong>표본 내</strong> 평가입니다: "이력에서 무작위보다 조금 나았는가"에는 답하지만 "다음 회차를 예측할 수 있는가"는 증명하지 못합니다.',
    'verdict.none': '무작위와 유의차 없음', 'verdict.good': '무작위보다 유의하게 높음(표본 외 검증 필요)', 'verdict.weak': '무작위보다 약간 높으나 증거 약함', 'verdict.bad': '무작위보다 유의하게 낮음',
    'gen.note.random': '🎲 <strong>순수 무작위</strong>: 각 번호가 동일 확률(균등 기준)이며 이력을 보지 않습니다. 시드 <b>{seed}</b>의 PRNG(Math.random 아님)로 생성. "새 세트"로 새 조합을 받으세요.',
    'gen.note.topk': '현재 <strong>결정론적 Top-K</strong>: 무작위를 전혀 쓰지 않고 컨센서스 가중치로 정렬해 회전 선택합니다.',
    'gen.note.default': '가중치는 통계 모델에서 계산하며, 시드 <b>{seed}</b>의 결정론적 PRNG로 비복원 추출 — 같은 시드+파라미터로 재현 가능.',
    'gen.note.explain': '<br>· <b>적합도</b> = 선택한 방법 가중치에서 이 조합의 평균 점수; · <b>중복</b> = 아래 "방법 예측"과의 교집합.',
    'gen.ref.label': '방법 "예측" Top-{mc}(결정론적, "예측" 탭과 비교 가능)',
    'gen.score.fit': '적합도 {pct}% · 중복 {ov}/{mc}', 'gen.score.random': '순수 무작위',
    'gen.verify': '검증', 'gen.collapse': '접기', 'gen.noresult': '결과 없음 — 파라미터를 조정하세요.',
    'gen.preset.badge': '🔰 <b>추천 설정</b> · {name}: {win} · λ {decay} —— {why}',
    'gen.mode.hint.custom': '자유롭게 조합: 방법 / 창 / 감쇠 / 시드.',
    'gen.mode.hint.recommend': '시스템이 방법별 최적 창과 감쇠를 자동 설정합니다 — 방법을 고르고 "생성"을 클릭하세요.',
    'window.all': '전체 {n}', 'window.recent': '최근 {n}', 'winlabel.all': '전체 {n}회', 'winlabel.recent': '최근 {n}회',
    'iv.checked': '<b>{n}</b>회 대조', 'iv.maxhit': '최다 적중 <b>{h}</b>/{mc}', 'iv.best': '최고 <b style="color:var(--gold)">{div}</b>', 'iv.never': '<b>당첨 없음</b>', 'iv.total': '총 당첨 <b>{n}</b>', 'iv.dist': '적중 분포: {hits}', 'iv.none': '없음',
    'val.alert.main': '서로 다른 본번호 {mc}개를 입력하세요 (1–{mm}).', 'val.alert.range': '본번호가 범위를 벗어났습니다.', 'val.alert.extra': '{ex} {ec}개를 입력하세요 (1–{em}).',
    'val.input.main': '본번호 ({mc}개, 1–{mm})', 'val.input.extra': '{ex} (1–{em})',
    'val.best': '도달한 최고 등위: <span class="big">{div}</span><br><span class="small muted">예: 제{n}회 ({date}): {nums}</span>',
    'val.neverBig': '<span class="big" style="color:var(--muted)">당첨 없음</span><br><span class="small muted">최다 적중 본번호: {h}</span>',
    'val.kv.checked': '대조 회차 <b>{n}</b>', 'val.kv.maxhit': '최다 적중 본번호 <b>{h}</b>/{mc}', 'val.kv.total': '총 당첨 <b>{n}</b>',
    'val.h.divhits': '등위별 과거 적중', 'val.h.freq': '선택 번호의 과거 빈도',
    'val.tbl.div': '등위', 'val.tbl.hits': '과거 적중 횟수', 'val.times': '회',
    'method.frequency.name': '가중 빈도', 'method.overdue.name': '오버듀', 'method.markov.name': '마르코프', 'method.bayes.name': '베이즈 수축', 'method.consensus.name': '컨센서스', 'method.balanced.name': '균형 형태', 'method.topk.name': '결정론적 Top-K', 'method.random.name': '순수 무작위',
    'method.frequency.short': '최근 출현이 많을수록 가중치 높음(핫 편향)', 'method.overdue.short': '오래 미출현 → 더 "나올 차례"(평균 회귀 가정)', 'method.markov.short': '직전 회차와 과거 가장 많이 동시출현한 번호', 'method.bayes.short': '빈도를 사전분포 7/N로 수축, 잡음을 신호로 오인 방지', 'method.consensus.short': '핫/오버듀/동시출현을 정규화 후 평균',
    'mi.frequency.title': '🔥 가중 빈도(핫)', 'mi.frequency.body': '원리: 창 내 출현 횟수를 세고 감쇠 λ로 최근 회차에 더 큰 가중치를 줍니다 — 자주 나올수록 높은 점수.\n사용 시기: "핫은 계속 핫하다"고 보고 최근 추세를 따르고 싶을 때.\n조합: 짧은 창(50–100) + 큰 λ(0.03–0.06)이 최근 열기를 강조.\n주의: λ가 클수록 최근 십여 회만 봅니다. 공정한 복권에서 "핫"은 단지 무작위 변동입니다.',
    'mi.overdue.title': '❄️ 오버듀(Overdue)', 'mi.overdue.body': '원리: "실제 간격 ÷ 기대 간격"으로 점수를 매겨 오래 안 나올수록 높습니다.\n사용 시기: "오래 안 나온 번호는 평균으로 회귀해야 한다"고 볼 때(핫의 반대).\n조합: 간격 통계가 안정되도록 큰 창이나 "전체"를 사용. λ의 영향을 받지 않습니다.\n주의: 독립 무작위 추첨에서 "오래 미출현"이 번호를 더 잘 나오게 하지 않습니다. 역방향 도박사의 오류입니다. 백테스트에서 무작위를 이기지 못하며 진단용으로만 둡니다.',
    'mi.markov.title': '🔗 마르코프(동시출현)', 'mi.markov.body': '원리: 가장 최근 회차를 보고 과거에 그와 가장 많이 동시출현한 번호를 찾습니다.\n사용 시기: 번호 간 "동반/동시출현"을 활용하고 싶을 때.\n조합: 창이 클수록 동시출현 행렬이 안정. λ의 영향을 받지 않습니다.\n주의: 공들 사이에 실제 연관은 없으며 동시출현은 대부분 우연입니다.',
    'mi.bayes.title': '🧪 베이즈 수축(Shrinkage)', 'mi.bayes.body': '원리: 원시 빈도를 그대로 믿지 않고 각 번호의 비율을 사전분포 7/N로 수축합니다 — (출현수 + k·사전) ÷ (회차 + k), k≈50. 자주 나온 번호는 평균으로 당겨집니다.\n사용 시기: "무작위 변동을 핫으로 오인"하는 과적합을 피하고 싶을 때. 가장 보수적이고 정직한 빈도 방법.\n주의: 수축하기 때문에 번호 간 점수 차이가 작은데, 이는 실제 신호가 약함을 정직하게 반영합니다.',
    'mi.consensus.title': '🧠 컨센서스(Consensus)', 'mi.consensus.body': '원리: "가중 빈도/오버듀/동시출현"을 각각 0–1로 정규화한 뒤 동일 가중으로 평균합니다.\n사용 시기: 단일 가정에 베팅하지 않고 견고한 기본값을 원할 때.\n조합: 창 100 + λ 0.03이 균형 잡힌 설정.\n주의: 서로 모순되는 세 논리를 융합하므로 결과가 중간 성향입니다.',
    'mi.balanced.title': '🧩 균형 형태(Balanced)', 'mi.balanced.body': '원리: 컨센서스 가중 샘플링 위에, 이력과 너무 벗어난 조합을 걸러냅니다 — 본번호의 "합 범위, 홀짝비, 대소비"를 이력 최빈값에 가깝게 제약합니다.\n사용 시기: 생성한 조합이 "실제 추첨처럼" 보이길 원할 때.\n주의: 형태만 제약할 뿐 당첨 확률을 높이지 않습니다.',
    'mi.topk.title': '🎯 결정론적 Top-K', 'mi.topk.body': '원리: 무작위를 전혀 쓰지 않습니다. 모든 번호를 컨센서스 가중치로 정렬하고 슬라이딩 순위 창을 회전시켜 여러 줄을 만듭니다.\n사용 시기: 재현 가능하고 무작위 없는 결과를 원할 때.\n주의: 각 줄은 순위 창 회전으로만 달라져 다양성이 제한적이며 시드와 무관합니다.',
    'mi.random.title': '🎲 순수 무작위(균등 기준)', 'mi.random.body': '원리: 이력을 완전히 무시하고 각 번호가 동일 확률 — 이것이 복권의 실제 모습이며 다른 방법을 평가하는 기준선입니다.\n사용 시기: 편향 없는 무작위 한 줄을 원하거나 "수학적 방법"과 비교하고 싶을 때.\n주의: 그래도 시드 PRNG(Math.random 아님)를 사용해 같은 시드로 재현 가능. "새 세트"로 새 조합을 받으세요. 창/감쇠는 효과가 없습니다.',
    'preset.frequency.why': '핫 편향은 최근 중시: 짧은 창 + 강한 감쇠', 'preset.overdue.why': '간격 통계는 안정에 큰 표본이 필요하며 감쇠의 영향을 받지 않음', 'preset.markov.why': '동시출현 행렬은 전체 이력에서 더 안정적이며 감쇠의 영향을 받지 않음', 'preset.bayes.why': '베이즈는 전체 이력으로 빈도를 사전분포로 수축', 'preset.consensus.why': '견고하고 균형 잡힌 기본값', 'preset.balanced.why': '이력 구조에 맞춘 균형 형태', 'preset.topk.why': '결정론적 순위 선택; 시드와 무관', 'preset.random.why': '각 번호가 동일 확률; 창/감쇠와 무관(순수 무작위 기준)',
  },
};
function t(key, vars) {
  const d = I18N[state.lang] || I18N.en;
  let s = d[key] != null ? d[key] : (I18N.en[key] != null ? I18N.en[key] : key);
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}
const LANGS = [
  { code: 'en', label: 'English' }, { code: 'zh', label: '中文' }, { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' }, { code: 'ja', label: '日本語' }, { code: 'ko', label: '한국어' },
];
const METHOD_ICON = { frequency: '🔥', overdue: '❄️', markov: '🔗', bayes: '🧪', consensus: '🧠', balanced: '🧩', topk: '🎯', random: '🎲' };
const methodName = k => t('method.' + k + '.name');
const extraLabel = () => t('extraname.' + state.game);
function applyStaticI18n() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
  document.title = t('app.docTitle');
  $$('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
  $$('[data-i18n-html]').forEach(el => el.innerHTML = t(el.dataset.i18nHtml));
}

/* ---------- 工具 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rules = () => DATA[state.game].rules;
const allDraws = () => DATA[state.game].draws; // newest-first
const range1 = n => Array.from({ length: n }, (_, i) => i + 1);
const sum = a => a.reduce((x, y) => x + y, 0);

// 确定性 PRNG（mulberry32）— 给定种子即可复现，绝不调用 Math.random
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* =========================================================================
 * 统计引擎
 * ========================================================================= */
function computeStats(window, lambda = 0) {
  return computeStatsArr(allDraws().slice(0, window), lambda);
}
function computeStatsArr(draws, lambda = 0) { // draws: newest-first 切片
  const r = rules();
  const N = draws.length;
  const freq = new Array(r.mainMax + 1).fill(0);     // 出现次数
  const wfreq = new Array(r.mainMax + 1).fill(0);    // 近期加权频率
  const lastSeen = new Array(r.mainMax + 1).fill(Infinity); // 距今多少期前出现
  const extraFreq = new Array(r.extraMax + 1).fill(0);
  const pair = {}; // "a,b" -> count
  const sums = [], odd = [], low = [];
  const half = Math.ceil(r.mainMax / 2);

  draws.forEach((d, i) => { // i=0 最新
    const w = Math.exp(-lambda * i);
    d.main.forEach(n => {
      freq[n]++; wfreq[n] += w;
      if (lastSeen[n] === Infinity) lastSeen[n] = i;
    });
    d.extra.forEach(n => { if (n <= r.extraMax) extraFreq[n]++; });
    // 形态
    sums.push(sum(d.main));
    odd.push(d.main.filter(n => n % 2 === 1).length);
    low.push(d.main.filter(n => n <= half).length);
    // 共现对
    const m = [...d.main].sort((a, b) => a - b);
    for (let a = 0; a < m.length; a++)
      for (let b = a + 1; b < m.length; b++)
        pair[m[a] + ',' + m[b]] = (pair[m[a] + ',' + m[b]] || 0) + 1;
  });

  // 期望间隔 ≈ 池大小 / 每期抽取数
  const expGap = r.mainMax / r.mainCount;
  return { r, draws, N, freq, wfreq, lastSeen, extraFreq, pair, sums, odd, low, expGap, half };
}

/* ---------- 把数组归一化到 0..1 ---------- */
function normalize(scores) {
  const vals = scores.slice(1); // index 0 占位
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const out = scores.slice();
  for (let i = 1; i < out.length; i++)
    out[i] = mx > mn ? (out[i] - mn) / (mx - mn) : 0.5;
  return out;
}

/* =========================================================================
 * 每号码打分（各数学方法）→ 长度 mainMax+1 的权重向量
 * ========================================================================= */
function scoreHot(st) {           // 近期加权频率：越常出现分越高
  const s = new Array(st.r.mainMax + 1).fill(0);
  for (let n = 1; n <= st.r.mainMax; n++) s[n] = st.wfreq[n];
  return normalize(s);
}
function scoreOverdue(st) {        // 遗漏：实际间隔 / 期望间隔
  const s = new Array(st.r.mainMax + 1).fill(0);
  for (let n = 1; n <= st.r.mainMax; n++) {
    const gap = st.lastSeen[n] === Infinity ? st.N : st.lastSeen[n];
    s[n] = gap / st.expGap;
  }
  return normalize(s);
}
function scoreMarkov(st) {         // 与“最近一期号码”最常共现者
  const s = new Array(st.r.mainMax + 1).fill(0);
  if (!st.draws.length) return normalize(s);
  const last = st.draws[0].main;
  // 共现计数（对称）
  const co = {};
  for (const k in st.pair) {
    const [a, b] = k.split(',').map(Number); const c = st.pair[k];
    co[a] = co[a] || {}; co[b] = co[b] || {};
    co[a][b] = c; co[b][a] = c;
  }
  for (let n = 1; n <= st.r.mainMax; n++) {
    if (last.includes(n)) { s[n] = 0; continue; } // 通常不重复，降权
    let acc = 0;
    for (const ln of last) acc += (co[ln] && co[ln][n]) || 0;
    s[n] = acc;
  }
  return normalize(s);
}
function scoreConsensus(st) {      // 三法等权融合
  const a = scoreHot(st), b = scoreOverdue(st), c = scoreMarkov(st);
  const s = new Array(st.r.mainMax + 1).fill(0);
  for (let n = 1; n <= st.r.mainMax; n++) s[n] = (a[n] + b[n] + c[n]) / 3;
  return normalize(s);
}
function scoreBayes(st) {          // 贝叶斯收缩：把历史频率往先验 7/N 拉回
  const r = st.r, k = 50, p0 = r.mainCount / r.mainMax;
  const s = new Array(r.mainMax + 1).fill(0);
  for (let n = 1; n <= r.mainMax; n++)
    s[n] = (st.freq[n] + k * p0) / (st.N + k); // 收缩后的出现率估计
  return normalize(s);
}
function scoreUniform(st) {        // 均匀：所有号码等权（纯随机基准）
  return normalize(new Array(st.r.mainMax + 1).fill(1));
}
const METHODS = {
  frequency: { fn: scoreHot, icon: '🔥' },
  overdue:   { fn: scoreOverdue, icon: '❄️' },
  markov:    { fn: scoreMarkov, icon: '🔗' },
  bayes:     { fn: scoreBayes, icon: '🧪' },
  consensus: { fn: scoreConsensus, icon: '🧠' },
  random:    { fn: scoreUniform, icon: '🎲' },
};
function tipIcon(key, right = false) {
  const body = t('mi.' + key + '.body');
  if (!body) return '';
  return `<span class="tip${right ? ' right' : ''}" data-tip="${body.replace(/"/g, '&quot;')}">i</span>`;
}

/* ---------- 取权重最高的 k 个号码 ----------
 * tie-break 用号码哈希（确定性但中性）：分数并列时不再恒偏向小号，
 * 避免在回测里对小号产生人为偏差；同时保持可复现（不破坏确定性生成）。*/
const _tieMemo = {};
function tieKey(n) { return _tieMemo[n] != null ? _tieMemo[n] : (_tieMemo[n] = hashSeed('tb:' + n)); }
function topK(weights, k, exclude = new Set()) {
  const idx = [];
  for (let n = 1; n < weights.length; n++) if (!exclude.has(n)) idx.push(n);
  idx.sort((a, b) => weights[b] - weights[a] || tieKey(a) - tieKey(b));
  return idx.slice(0, k).sort((a, b) => a - b);
}

/* ---------- 按权重不放回采样（用种子化 rng，非 Math.random） ---------- */
function weightedSample(weights, k, rng, exclude = new Set()) {
  const pool = [];
  for (let n = 1; n < weights.length; n++)
    if (!exclude.has(n)) pool.push({ n, w: Math.max(weights[n], 0.0001) });
  const picked = [];
  for (let t = 0; t < k && pool.length; t++) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let x = rng() * total, i = 0;
    while (i < pool.length - 1 && (x -= pool[i].w) > 0) i++;
    picked.push(pool[i].n); pool.splice(i, 1);
  }
  return picked.sort((a, b) => a - b);
}

/* ---------- 形态统计（众数区间） ---------- */
function modeStats(arr) {
  const cnt = {}; arr.forEach(v => cnt[v] = (cnt[v] || 0) + 1);
  let mode = null, mx = -1;
  for (const k in cnt) if (cnt[k] > mx) { mx = cnt[k]; mode = +k; }
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return { mode, mean, cnt };
}

/* =========================================================================
 * 渲染辅助
 * ========================================================================= */
function ball(n, cls = 'main', sm = false) {
  return `<span class="ball ${cls}${sm ? ' sm' : ''}">${n}</span>`;
}
function ballsRow(main, extra = [], extraCls = 'extra') {
  let h = '<div class="balls">';
  h += main.map(n => ball(n, 'main')).join('');
  if (extra.length) {
    h += `<span class="tag">${extraLabel()}</span>`;
    h += extra.map(n => ball(n, extraCls)).join('');
  }
  return h + '</div>';
}
function barChart(items, color) { // items: [{label,val,max}]
  const mx = Math.max(...items.map(i => i.val), 1);
  return '<div class="barchart">' + items.map(i => {
    const pct = (i.val / mx) * 100;
    const col = typeof color === 'function' ? color(i) : color;
    return `<div class="bar-row"><div class="lbl">${i.label}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${col}"></div></div>
      <div class="val">${i.disp != null ? i.disp : i.val}</div></div>`;
  }).join('') + '</div>';
}

/* =========================================================================
 * 概览
 * ========================================================================= */
function renderOverview() {
  const win = +$('#ov-window').value;
  const st = computeStats(win, 0.03);
  const g = DATA[state.game];
  $('#ov-title').textContent = g.name + ' · ' + t('tab.overview');
  $('#ov-meta').innerHTML = t('ov.meta', {
    mc: st.r.mainCount, mm: st.r.mainMax, ec: st.r.extraCount, ex: extraLabel(),
    em: st.r.extraMax, total: g.draws.length, n: st.N,
  });

  // 热号 / 冷号
  const freqItems = range1(st.r.mainMax).map(n => ({ n, f: st.freq[n], gap: st.lastSeen[n] === Infinity ? st.N : st.lastSeen[n] }));
  const hot = [...freqItems].sort((a, b) => b.f - a.f || a.gap - b.gap).slice(0, 10);
  const cold = [...freqItems].sort((a, b) => b.gap - a.gap || a.f - b.f).slice(0, 10);
  $('#ov-hot').innerHTML = barChart(
    hot.map(i => ({ label: '#' + i.n, val: i.f, disp: i.f + t('unit.times') })),
    'linear-gradient(90deg,#ff6a86,#e23a5c)');
  $('#ov-cold').innerHTML = barChart(
    cold.map(i => ({ label: '#' + i.n, val: i.gap, disp: i.gap + ' ' + t('unit.draws') })),
    'linear-gradient(90deg,#5bbcff,#2e86d6)');

  // 频率格
  const mxF = Math.max(...st.freq.slice(1));
  const mnF = Math.min(...st.freq.slice(1, st.r.mainMax + 1));
  $('#ov-freqgrid').innerHTML = range1(st.r.mainMax).map(n => {
    const f = st.freq[n];
    const frac = mxF > mnF ? (f - mnF) / (mxF - mnF) : 0.5;
    // 蓝(冷)→红(热)
    const col = `rgba(${Math.round(77 + frac * (255 - 77))},${Math.round(184 - frac * 94)},${Math.round(255 - frac * 133)},0.22)`;
    return `<div class="freqcell" style="background:${col}">
      <div class="n">${n}</div><div class="f">${f}${t('unit.times')}</div></div>`;
  }).join('');

  // 形态
  const ms = modeStats(st.sums), mo = modeStats(st.odd), ml = modeStats(st.low);
  const sumMin = Math.min(...st.sums), sumMax = Math.max(...st.sums);
  $('#ov-shape').innerHTML = `
    <div class="kv">
      <div class="k">${t('ov.shape.sumRange')} <b>${sumMin}–${sumMax}</b></div>
      <div class="k">${t('ov.shape.sumMean')} <b>${ms.mean.toFixed(0)}</b></div>
      <div class="k">${t('ov.shape.odd')} <b>${mo.mode}</b>/${st.r.mainCount}</div>
      <div class="k">${t('ov.shape.low', { h: st.half })} <b>${ml.mode}</b>/${st.r.mainCount}</div>
    </div>
    <p class="note">${t('ov.shape.oddDist')}：${[...Array(st.r.mainCount + 1).keys()].map(k => t('ov.shape.oddItem', { k, c: mo.cnt[k] || 0 })).join('　')}</p>`;

  // 高频对
  const pairs = Object.entries(st.pair).sort((a, b) => b[1] - a[1]).slice(0, 10);
  $('#ov-pairs').innerHTML = `<table><tr><th>${t('ov.pairs.pair')}</th><th>${t('ov.pairs.co')}</th></tr>` +
    pairs.map(([k, c]) => {
      const [a, b] = k.split(',');
      return `<tr><td>${ball(a, 'main', true)} ${ball(b, 'main', true)}</td><td class="num">${c} ${t('unit.times')}</td></tr>`;
    }).join('') + '</table>';

  // 最近开奖
  $('#ov-recent').innerHTML = `<table><tr><th>${t('tbl.draw')}</th><th>${t('tbl.date')}</th><th>${t('tbl.numbers')}</th></tr>` +
    allDraws().slice(0, 8).map(d =>
      `<tr><td class="num">#${d.n}</td><td>${d.date}</td><td>${ballsRow(d.main, d.extra, state.game === 'powerball' ? 'pb' : 'extra')}</td></tr>`
    ).join('') + '</table>';
}

/* =========================================================================
 * 预测
 * ========================================================================= */
function renderPredict() {
  const win = +$('#pr-window').value;
  const lambda = +$('#pr-decay').value;
  const st = computeStats(win, lambda);
  const r = st.r;
  let html = '';
  const order = ['frequency', 'overdue', 'markov', 'bayes', 'consensus'];
  for (const key of order) {
    const m = METHODS[key];
    const weights = m.fn(st);
    const pick = topK(weights, r.mainCount);
    // 每号码分数条（取被选号码）
    const bars = pick.map(n => ({ label: '#' + n, val: weights[n], disp: (weights[n]).toFixed(2) }));
    // extra 预测（频率最高）
    let extraHtml = '';
    if (r.extraCount) {
      const ef = range1(r.extraMax).map(n => ({ n, f: st.extraFreq[n] })).sort((a, b) => b.f - a.f);
      const ex = ef.slice(0, r.extraCount).map(e => e.n).sort((a, b) => a - b);
      extraHtml = `<div style="margin-top:8px"><span class="tag">${t('predict.extraHot', { ex: extraLabel() })}</span>${ex.map(n => ball(n, state.game === 'powerball' ? 'pb' : 'extra', true)).join('')}</div>`;
    }
    html += `<div class="method-block${key === 'consensus' ? ' consensus' : ''}">
      <div class="mh"><span style="font-size:18px">${m.icon}</span>
        <span class="name">${methodName(key)}${key === 'consensus' ? ' ⭐' : ''}</span>
        ${tipIcon(key)}
        <span class="desc">${t('method.' + key + '.short')}</span></div>
      ${ballsRow(pick)}
      ${extraHtml}
      <div style="margin-top:10px">${barChart(bars, key === 'consensus' ? 'linear-gradient(90deg,#ffce4d,#e9af2b)' : 'linear-gradient(90deg,#6c8cff,#4d63d6)')}</div>
    </div>`;
  }
  $('#pr-results').innerHTML = html;
}

/* =========================================================================
 * 回测（walk-forward）+ 随机性诊断
 * ========================================================================= */
const BT_METHODS = ['frequency', 'overdue', 'markov', 'bayes', 'consensus'];

// 随机基准：每期期望命中数 = mainCount²/mainMax；命中数服从超几何分布
function randomBaseline(r) {
  const K = r.mainCount, n = r.mainCount, N = r.mainMax;
  const mean = (K * n) / N;
  const varPerDraw = n * (K / N) * ((N - K) / N) * ((N - n) / (N - 1));
  return { mean, sd: Math.sqrt(varPerDraw) };
}
// 真中位数（偶数样本取两中值平均）
function median(arr) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
// 用种子化 rng 从 1..max 等概率取 k 个不重复号（非 Math.random，可复现）
function uniformPick(max, k, rng) {
  const a = []; for (let n = 1; n <= max; n++) a.push(n);
  for (let i = a.length - 1; i > 0; i--) {       // 部分 Fisher-Yates
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
    if (a.length - i >= k) break;
  }
  return a.slice(a.length - k);
}

// walk-forward：用第 t 期之前的数据预测第 t 期，滚动统计命中
function backtest(opts = {}) {
  const r = rules();
  const draws = allDraws();           // newest-first
  const total = draws.length;
  const minTrain = opts.minTrain || 50;
  const expanding = opts.expanding !== false; // 默认累积
  const lambda = opts.lambda != null ? opts.lambda : 0.03;
  const lookback = opts.lookback || 200;
  const sims = opts.sims || 3000;     // 蒙特卡洛随机零分布的抽样次数

  const res = {};
  BT_METHODS.forEach(k => res[k] = { hits: 0, arr: [] });
  // 真实随机选号对照组（种子化，可复现）
  const ctrl = { hits: 0, arr: [] };
  const ctrlRng = mulberry32(hashSeed('bt-control|' + state.game));
  const testActual = []; // 收集每个测试期的实际开奖，供蒙特卡洛复用

  for (let t = 0; t <= total - 1 - minTrain; t++) {
    const older = expanding ? draws.slice(t + 1) : draws.slice(t + 1, t + 1 + lookback);
    if (older.length < minTrain) continue;
    const st = computeStatsArr(older, lambda);
    const actual = draws[t].main;
    testActual.push(actual);
    for (const k of BT_METHODS) {
      const pick = topK(METHODS[k].fn(st), r.mainCount);
      const h = pick.filter(x => actual.includes(x)).length;
      res[k].hits += h; res[k].arr.push(h);
    }
    const cpick = uniformPick(r.mainMax, r.mainCount, ctrlRng);
    const ch = cpick.filter(x => actual.includes(x)).length;
    ctrl.hits += ch; ctrl.arr.push(ch);
  }
  const nTest = testActual.length;

  // 蒙特卡洛：在「同一批实际开奖」上反复随机选号，得到平均命中的零分布
  const nullAvgs = new Array(sims);
  const mcRng = mulberry32(hashSeed('bt-mc|' + state.game));
  for (let s = 0; s < sims; s++) {
    let tot = 0;
    for (const actual of testActual) {
      const pick = uniformPick(r.mainMax, r.mainCount, mcRng);
      tot += pick.filter(x => actual.includes(x)).length;
    }
    nullAvgs[s] = nTest ? tot / nTest : 0;
  }
  const pBetter = avg => nullAvgs.filter(x => x >= avg).length / sims; // 越小→越可能真优于随机
  const pWorse = avg => nullAvgs.filter(x => x <= avg).length / sims;

  const base = randomBaseline(r);
  const se = base.sd / Math.sqrt(Math.max(nTest, 1));
  const mkRow = (avg, arr) => {
    const z = se > 0 ? (avg - base.mean) / se : 0;
    const pb = pBetter(avg), pw = pWorse(avg);
    let verdict = t('verdict.none'), cls = 'neutral';
    if (pb < 0.01) { verdict = t('verdict.good'); cls = 'good'; }
    else if (pb < 0.05) { verdict = t('verdict.weak'); cls = 'neutral'; }
    else if (pw < 0.01) { verdict = t('verdict.bad'); cls = 'bad'; }
    return { avg, median: median(arr), max: arr.length ? Math.max(...arr) : 0, z, p: pb, verdict, cls };
  };

  const out = { nTest, sims, baseline: base.mean, perfect: r.mainCount, methods: {} };
  out.control = mkRow(ctrl.hits / Math.max(nTest, 1), ctrl.arr); // 实测随机对照
  for (const k of BT_METHODS) out.methods[k] = mkRow(res[k].hits / Math.max(nTest, 1), res[k].arr);
  return out;
}

function renderBacktest() {
  const expanding = ($('#pr-bt-mode') || {}).value !== 'fixed';
  const lambda = +$('#pr-decay').value;
  const sims = +(($('#pr-bt-sims') || {}).value) || 3000;
  const bt = backtest({ expanding, lambda, lookback: +($('#pr-window').value), sims });
  const nGood = BT_METHODS.filter(k => bt.methods[k].cls === 'good').length;
  const expFalse = (BT_METHODS.length * 0.01).toFixed(2); // p<0.01 下的期望假阳性数

  const pCell = p => p < 0.01 ? `<b style="color:var(--green)">${p.toFixed(3)}</b>`
    : p > 0.99 ? `<span style="color:var(--hot)">${p.toFixed(3)}</span>` : p.toFixed(3);
  const row = (icon, name, m, opts = {}) => {
    const d = m.avg - bt.baseline;
    return `<tr style="${opts.dim ? 'opacity:.8' : ''}">
      <td>${icon} ${name}</td>
      <td class="num">${m.avg.toFixed(3)}</td>
      <td class="num" style="color:${d > 0 ? 'var(--green)' : 'var(--muted)'}">${d >= 0 ? '+' : ''}${d.toFixed(3)}</td>
      <td class="num">${m.z >= 0 ? '+' : ''}${m.z.toFixed(2)}</td>
      <td class="num">${opts.baseline ? '—' : pCell(m.p)}</td>
      <td><span class="verdict ${opts.baseline ? 'neutral' : m.cls}">${opts.baseline ? t('bt.badge.baseline') : m.verdict}</span></td></tr>`;
  };

  let rows = `<tr><th>${t('bt.col.method')}</th><th>${t('bt.col.avg')}</th><th>${t('bt.col.delta')}</th><th>${t('bt.col.z')}</th><th>${t('bt.col.p')}</th><th>${t('bt.col.verdict')}</th></tr>`;
  rows += row('', t('bt.row.baseline'), { avg: bt.baseline, z: 0, p: 0.5 }, { baseline: true, dim: true });
  rows += row('', t('bt.row.control'), bt.control, { dim: true });
  for (const k of BT_METHODS) rows += row(METHODS[k].icon, methodName(k), bt.methods[k]);
  rows += `<tr style="opacity:.6"><td>${t('bt.row.perfect')}</td><td class="num">${bt.perfect.toFixed(3)}</td><td colspan="4" class="muted small">${t('bt.row.perfectNote')}</td></tr>`;

  const headline = nGood
    ? t('bt.headline.good', { n: nGood, m: BT_METHODS.length, e: expFalse })
    : t('bt.headline.none');

  $('#pr-backtest').innerHTML = `
    <p class="note">${t('bt.note.run', { mode: t(expanding ? 'bt.mode.expandingShort' : 'bt.mode.fixedShort'), n: bt.nTest })}</p>
    <div class="method-desc" style="margin-top:8px">${headline}</div>
    <table style="margin-top:10px">${rows}</table>
    <div class="note" style="margin-top:8px">
      ${t('bt.note.p', { sims: bt.sims })}<br>
      ${t('bt.note.z')}<br>
      ${t('bt.note.insample')}
    </div>`;
}

/* =========================================================================
 * 生成
 * ========================================================================= */
function weightsFor(method, st) {
  switch (method) {
    case 'frequency': return scoreHot(st);
    case 'overdue': return scoreOverdue(st);
    case 'markov': return scoreMarkov(st);
    case 'bayes': return scoreBayes(st);
    case 'random': return scoreUniform(st);
    case 'balanced':
    case 'consensus':
    case 'topk':
    default: return scoreConsensus(st);
  }
}
function extraWeights(st) {
  const r = st.r;
  const s = new Array(r.extraMax + 1).fill(0);
  for (let n = 1; n <= r.extraMax; n++) s[n] = st.extraFreq[n];
  return normalize(s);
}
function comboScore(main, weights) {
  // 契合度：这组号在「所选方法权重」下的平均得分（0..1），与生成逻辑一致
  return main.reduce((a, n) => a + (weights[n] || 0), 0) / main.length;
}
function shapeOk(main, st) {
  const mo = modeStats(st.odd), ml = modeStats(st.low);
  const odd = main.filter(n => n % 2 === 1).length;
  const lowc = main.filter(n => n <= st.half).length;
  const s = sum(main);
  const smin = Math.min(...st.sums), smax = Math.max(...st.sums);
  const lo = smin + (smax - smin) * 0.2, hi = smin + (smax - smin) * 0.8;
  return Math.abs(odd - mo.mode) <= 1 && Math.abs(lowc - ml.mode) <= 1 && s >= lo && s <= hi;
}
function updateGenMethodDesc() {
  const key = $('#gen-method').value;
  const title = t('mi.' + key + '.title'), body = t('mi.' + key + '.body');
  $('#gen-method-desc').innerHTML = `<b>${title}</b>\n${body}`;
  $('#gen-method-tip').setAttribute('data-tip', body.replace(/"/g, '&quot;'));
}

/* ---------- 推荐模式：系统为每个方法给出最优窗口 / 衰减搭配（why 文案见 i18n preset.*） ---------- */
const GEN_PRESET = {
  frequency: { window: 100, decay: 0.06 },
  overdue:   { window: 'all', decay: 0 },
  markov:    { window: 'all', decay: 0 },
  bayes:     { window: 'all', decay: 0 },
  consensus: { window: 100, decay: 0.03 },
  balanced:  { window: 100, decay: 0.03 },
  topk:      { window: 100, decay: 0.03 },
  random:    { window: 'all', decay: 0 },
};
function setGenWindow(target) { // 把窗口选择设为最接近推荐值的可用项
  const sel = $('#gen-window');
  const opts = [...sel.options].map(o => +o.value);
  const v = target === 'all' ? Math.max(...opts)
    : opts.reduce((best, o) => Math.abs(o - target) < Math.abs(best - target) ? o : best, opts[0]);
  sel.value = String(v);
  return v;
}
function applyPreset(method) {
  const p = GEN_PRESET[method] || GEN_PRESET.consensus;
  const wv = setGenWindow(p.window);
  $('#gen-decay').value = String(p.decay);
  const winLabel = p.window === 'all' ? t('winlabel.all', { n: wv }) : t('winlabel.recent', { n: wv });
  return { ...p, winLabel };
}
function updateGenMode() {
  const mode = state.genMode;
  $$('.modebtn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const adv = mode === 'custom';
  $$('.gen-adv').forEach(el => el.style.display = adv ? '' : 'none');
  $('#gen-mode-hint').textContent = adv ? t('gen.mode.hint.custom') : t('gen.mode.hint.recommend');
  if (mode === 'recommend') {
    const key = $('#gen-method').value;
    const p = applyPreset(key);
    $('#gen-preset').style.display = 'block';
    $('#gen-preset').innerHTML = t('gen.preset.badge', {
      name: methodName(key), win: p.winLabel, decay: p.decay, why: t('preset.' + key + '.why'),
    });
  } else {
    $('#gen-preset').style.display = 'none';
  }
}

function renderGenerate() {
  const method = $('#gen-method').value;
  if (state.genMode === 'recommend') applyPreset(method); // 确保窗口/λ 为推荐值
  const win = +$('#gen-window').value;
  const lambda = +$('#gen-decay').value;
  const count = Math.max(1, Math.min(50, +$('#gen-count').value || 1));
  const seedStr = $('#gen-seed').value || '0';
  const st = computeStats(win, lambda);
  const r = st.r;
  const isRandom = method === 'random';
  const w = weightsFor(method, st);
  const ew = isRandom ? scoreUniform({ r: { mainMax: r.extraMax } }) : extraWeights(st);
  const rng = mulberry32(hashSeed(seedStr + '|' + method + '|' + win + '|' + lambda + '|' + state.game));
  const erng = mulberry32(hashSeed(seedStr + '|extra|' + state.game));

  const combos = [];
  const seen = new Set();
  let guard = 0;
  while (combos.length < count && guard < count * 200) {
    guard++;
    let main;
    if (method === 'topk') {
      // 确定性：取 Top-(mainCount + offset) 的不同子集（按注数轮换）
      const k = r.mainCount, off = combos.length;
      const ranked = topK(w, r.mainMax); // 全排序
      main = ranked.slice(off, off + k).sort((a, b) => a - b);
      if (main.length < k) main = ranked.slice(0, k).sort((a, b) => a - b);
    } else {
      main = weightedSample(w, r.mainCount, rng);
      if (method === 'balanced' && !shapeOk(main, st) && guard < count * 150) continue;
    }
    const key = main.join(',');
    if (seen.has(key) && method !== 'topk') continue;
    seen.add(key);
    // extra
    let extra = [];
    if (r.extraCount && !r.extraFromMain) {
      extra = method === 'topk'
        ? topK(ew, r.extraCount)
        : weightedSample(ew, r.extraCount, erng);
    }
    combos.push({ main, extra, score: comboScore(main, w) });
  }

  // 该方法的「确定性预测」Top-K（即「预测」页那一组）+ 高频 extra，用于对照
  const predicted = topK(w, r.mainCount);
  const pset = new Set(predicted);
  const predExtra = (r.extraCount && !r.extraFromMain) ? topK(ew, r.extraCount) : [];

  const extraCls = state.game === 'powerball' ? 'pb' : 'extra';
  $('#gen-note').innerHTML = isRandom
    ? t('gen.note.random', { seed: seedStr })
    : (method === 'topk' ? t('gen.note.topk') : t('gen.note.default', { seed: seedStr })) + t('gen.note.explain');

  // 顶部对照行：该方法的确定性预测（纯随机无此概念，故省略）
  const refRow = isRandom ? '' : `<div class="combo ref" style="border-color:var(--gold)">
      <span class="idx">🎯</span>
      <div style="flex:1">
        <div class="small muted" style="margin-bottom:3px">${t('gen.ref.label', { mc: r.mainCount })}</div>
        ${ballsRow(predicted, predExtra, extraCls)}
      </div>
      <button class="copy ivbtn" data-combo="${predicted.join(',')}" data-extra="${predExtra.join(',')}">${t('gen.verify')}</button>
    </div>`;

  const comboRows = combos.map((c, i) => {
    const ov = c.main.filter(n => pset.has(n)).length;
    const scoreTxt = isRandom ? t('gen.score.random')
      : t('gen.score.fit', { pct: (c.score * 100).toFixed(0), ov, mc: r.mainCount });
    return `<div class="combo gcombo">
      <span class="idx">#${i + 1}</span>
      ${ballsRow(c.main, c.extra, extraCls)}
      <span class="score">${scoreTxt}</span>
      <button class="copy ivbtn" data-combo="${c.main.join(',')}" data-extra="${c.extra.join(',')}">${t('gen.verify')}</button>
    </div>`;
  }).join('');

  $('#gen-results').innerHTML = (refRow + comboRows) || `<p class="muted">${t('gen.noresult')}</p>`;

  // 内联验证：在本页就地展开/收起结果，不跳转标签页
  $$('#gen-results .ivbtn').forEach(b => b.onclick = () => {
    const rowEl = b.closest('.combo');
    const next = rowEl.nextElementSibling;
    if (next && next.classList.contains('ivrow')) { next.remove(); b.textContent = t('gen.verify'); return; }
    const main = b.dataset.combo.split(',').filter(Boolean).map(Number);
    const extra = b.dataset.extra.split(',').filter(Boolean).map(Number);
    const wrap = document.createElement('div');
    wrap.className = 'ivrow';
    wrap.innerHTML = inlineValidate(state.game, { main, extra });
    rowEl.after(wrap);
    b.textContent = t('gen.collapse');
  });
}

/* =========================================================================
 * 验证
 * ========================================================================= */
function buildValidatorInputs() {
  const r = rules();
  let h = `<label>${t('val.input.main', { mc: r.mainCount, mm: r.mainMax })}</label><div class="input-balls">`;
  for (let i = 0; i < r.mainCount; i++)
    h += `<input type="number" class="vmain" min="1" max="${r.mainMax}" />`;
  h += '</div>';
  if (!r.extraFromMain && r.extraCount) {
    h += `<label style="margin-top:10px">${t('val.input.extra', { ex: extraLabel(), em: r.extraMax })}</label><div class="input-balls">`;
    for (let i = 0; i < r.extraCount; i++)
      h += `<input type="number" class="vextra ex" min="1" max="${r.extraMax}" />`;
    h += '</div>';
  }
  $('#val-inputs').innerHTML = h;
}
function fillValidator(main, extra) {
  buildValidatorInputs();
  $$('#val-inputs .vmain').forEach((el, i) => el.value = main[i] != null ? main[i] : '');
  $$('#val-inputs .vextra').forEach((el, i) => el.value = extra[i] != null ? extra[i] : '');
}
function readValidator() {
  const main = $$('#val-inputs .vmain').map(el => +el.value).filter(v => v >= 1);
  const extra = $$('#val-inputs .vextra').map(el => +el.value).filter(v => v >= 1);
  return { main: [...new Set(main)], extra };
}
function classifyDraw(game, ticket, draw) {
  const mainHit = ticket.main.filter(n => draw.main.includes(n)).length;
  if (game === 'ozlotto') {
    const suppHit = ticket.main.filter(n => draw.extra.includes(n)).length;
    return ozDivision(mainHit, suppHit);
  }
  const pbHit = ticket.extra.length > 0 && draw.extra.includes(ticket.extra[0]);
  return pbDivision(mainHit, pbHit);
}
function ozDivision(m, s) {
  if (m >= 7) return 1;
  if (m === 6 && s >= 1) return 2;
  if (m === 6) return 3;
  if (m === 5 && s >= 1) return 4;
  if (m === 5) return 5;
  if (m === 4) return 6;
  if (m === 3 && s >= 1) return 7;
  return 0;
}
function pbDivision(m, pb) {
  if (m >= 7 && pb) return 1;
  if (m >= 7) return 2;
  if (m === 6 && pb) return 3;
  if (m === 6) return 4;
  if (m === 5 && pb) return 5;
  if (m === 4 && pb) return 6;
  if (m === 5) return 7;
  if (m === 3 && pb) return 8;
  if (m === 2 && pb) return 9;
  return 0;
}
function divisionNames(game) {
  const zh = state.lang === 'zh';
  if (game === 'ozlotto') return zh
    ? { 1: '一等(7)', 2: '二等(6+补)', 3: '三等(6)', 4: '四等(5+补)', 5: '五等(5)', 6: '六等(4)', 7: '七等(3+补)' }
    : { 1: 'Div 1 (7)', 2: 'Div 2 (6+supp)', 3: 'Div 3 (6)', 4: 'Div 4 (5+supp)', 5: 'Div 5 (5)', 6: 'Div 6 (4)', 7: 'Div 7 (3+supp)' };
  return zh
    ? { 1: '一等(7+PB)', 2: '二等(7)', 3: '三等(6+PB)', 4: '四等(6)', 5: '五等(5+PB)', 6: '六等(4+PB)', 7: '七等(5)', 8: '八等(3+PB)', 9: '九等(2+PB)' }
    : { 1: 'Div 1 (7+PB)', 2: 'Div 2 (7)', 3: 'Div 3 (6+PB)', 4: 'Div 4 (6)', 5: 'Div 5 (5+PB)', 6: 'Div 6 (4+PB)', 7: 'Div 7 (5)', 8: 'Div 8 (3+PB)', 9: 'Div 9 (2+PB)' };
}
// 把一张票对照全部历史对奖（纯计算，供验证页与生成页内联共用）
function evaluateTicket(game, ticket) {
  const draws = DATA[game].draws;
  const divCount = {}; let best = 0, bestDraw = null, bestMain = 0;
  draws.forEach(d => {
    const div = classifyDraw(game, ticket, d);
    const mh = ticket.main.filter(n => d.main.includes(n)).length;
    if (mh > bestMain) bestMain = mh;
    if (div) {
      divCount[div] = (divCount[div] || 0) + 1;
      if (best === 0 || div < best) { best = div; bestDraw = d; }
    }
  });
  const total = Object.values(divCount).reduce((a, b) => a + b, 0);
  return { drawsChecked: draws.length, divCount, best, bestDraw, bestMain, total };
}
// 生成页内联用的紧凑验证摘要
function inlineValidate(game, ticket) {
  const e = evaluateTicket(game, ticket);
  const names = divisionNames(game), mc = DATA[game].rules.mainCount;
  const hits = Object.keys(names).filter(k => e.divCount[k])
    .map(k => `${names[k]}×${e.divCount[k]}`).join('　') || t('iv.none');
  return `<div class="ivresult">
    <div class="kv">
      <div class="k">${t('iv.checked', { n: e.drawsChecked })}</div>
      <div class="k">${t('iv.maxhit', { h: e.bestMain, mc })}</div>
      <div class="k">${e.best ? t('iv.best', { div: names[e.best] }) : t('iv.never')}</div>
      <div class="k">${t('iv.total', { n: e.total })}</div>
    </div>
    <div class="small muted" style="margin-top:6px">${t('iv.dist', { hits })}</div>
  </div>`;
}

function renderValidate() {
  const r = rules();
  const ticket = readValidator();
  if (ticket.main.length !== r.mainCount) {
    alert(t('val.alert.main', { mc: r.mainCount, mm: r.mainMax }));
    return;
  }
  if (ticket.main.some(n => n < 1 || n > r.mainMax)) { alert(t('val.alert.range')); return; }
  if (!r.extraFromMain && r.extraCount && ticket.extra.length !== r.extraCount) {
    alert(t('val.alert.extra', { ec: r.extraCount, ex: extraLabel(), em: r.extraMax })); return;
  }

  const draws = allDraws();
  const ev = evaluateTicket(state.game, ticket);
  const divCount = ev.divCount, best = ev.best, bestDraw = ev.bestDraw, bestMain = ev.bestMain;

  // 每号码历史频率（全历史）
  const freq = new Array(r.mainMax + 1).fill(0);
  draws.forEach(d => d.main.forEach(n => freq[n]++));
  const perNum = ticket.main.slice().sort((a, b) => a - b).map(n =>
    `${ball(n, 'main', true)} <span class="small muted">${freq[n]}${t('val.times')} / ${(freq[n] / draws.length * 100).toFixed(1)}%</span>`);

  const divNames = divisionNames(state.game);

  let divHtml = `<table><tr><th>${t('val.tbl.div')}</th><th>${t('val.tbl.hits')}</th></tr>`;
  Object.keys(divNames).forEach(k => {
    const c = divCount[k] || 0;
    divHtml += `<tr><td>${divNames[k]}</td><td class="num">${c ? '<b style="color:var(--green)">' + c + '</b>' : '0'} ${t('val.times')}</td></tr>`;
  });
  divHtml += '</table>';

  const bestTxt = best
    ? t('val.best', { div: divNames[best], n: bestDraw.n, date: bestDraw.date, nums: bestDraw.main.join(' ') })
    : t('val.neverBig', { h: bestMain });

  $('#val-result').innerHTML = `
    <div style="margin-bottom:10px">${ballsRow(ticket.main, ticket.extra, state.game === 'powerball' ? 'pb' : 'extra')}</div>
    <div class="div-result">${bestTxt}</div>
    <div class="kv">
      <div class="k">${t('val.kv.checked', { n: draws.length })}</div>
      <div class="k">${t('val.kv.maxhit', { h: bestMain, mc: r.mainCount })}</div>
      <div class="k">${t('val.kv.total', { n: Object.values(divCount).reduce((a, b) => a + b, 0) })}</div>
    </div>
    <h3 style="margin:16px 0 6px;font-size:14px">${t('val.h.divhits')}</h3>
    ${divHtml}
    <h3 style="margin:16px 0 6px;font-size:14px">${t('val.h.freq')}</h3>
    <div class="balls">${perNum.join('<span style="width:8px"></span>')}</div>`;
  $('#val-result-card').style.display = 'block';
}

/* =========================================================================
 * 视图 / 控件
 * ========================================================================= */
function fillWindowSelects() {
  const total = allDraws().length;
  const opts = [50, 100, 150, 200, 300].filter(v => v < total).concat([total]);
  const html = opts.map(v => `<option value="${v}">${v === total ? t('window.all', { n: total }) : t('window.recent', { n: v })}</option>`).join('');
  ['#ov-window', '#pr-window', '#gen-window'].forEach(sel => {
    const el = $(sel); const prev = el.value;
    el.innerHTML = html;
    // 默认 100 或全部
    el.value = opts.includes(100) ? 100 : total;
    if (prev && [...el.options].some(o => o.value === prev)) el.value = prev;
  });
}
function switchView(v) {
  state.view = v;
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === v));
  $$('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  rerender();
}
function rerender() {
  if (state.view === 'overview') renderOverview();
  else if (state.view === 'predict') renderPredict();
  else if (state.view === 'generate') {/* 等待点击生成 */ }
  else if (state.view === 'validate') {/* 等待输入 */ }
}
function switchGame(g) {
  state.game = g;
  $$('.gamebtn').forEach(b => b.classList.toggle('active', b.dataset.game === g));
  fillWindowSelects();
  buildValidatorInputs();
  updateGenMode();
  $('#val-result-card').style.display = 'none';
  $('#gen-results').innerHTML = `<p class="muted">${t('gen.results.placeholder')}</p>`;
  $('#pr-backtest').innerHTML = `<p class="muted">${t('bt.placeholder')}</p>`;
  rerender();
}
function setLang(lang) {
  state.lang = lang;
  const sel = $('#langsel');
  if (sel) sel.value = lang;
  applyStaticI18n();
  // 刷新依赖语言的动态 UI
  fillWindowSelects();
  buildValidatorInputs();
  updateGenMethodDesc();
  updateGenMode();
  $('#val-result-card').style.display = 'none';
  $('#gen-results').innerHTML = `<p class="muted">${t('gen.results.placeholder')}</p>`;
  $('#pr-backtest').innerHTML = `<p class="muted">${t('bt.placeholder')}</p>`;
  rerender();
}

/* ---------- 事件绑定 ---------- */
function init() {
  $$('.gamebtn').forEach(b => b.onclick = () => switchGame(b.dataset.game));
  $('#langpick').innerHTML = `<span class="langglobe">🌐</span><select id="langsel" aria-label="Language">` +
    LANGS.map(l => `<option value="${l.code}"${l.code === state.lang ? ' selected' : ''}>${l.label}</option>`).join('') +
    '</select>';
  $('#langsel').onchange = e => setLang(e.target.value);
  $$('.tab').forEach(el => el.onclick = () => switchView(el.dataset.view));
  $('#ov-window').onchange = renderOverview;
  $('#pr-window').onchange = renderPredict;
  $('#pr-decay').onchange = renderPredict;
  $('#pr-run').onclick = renderPredict;
  $('#pr-bt-run').onclick = renderBacktest;
  $('#gen-method').onchange = () => { updateGenMethodDesc(); updateGenMode(); };
  $$('.modebtn').forEach(b => b.onclick = () => { state.genMode = b.dataset.mode; updateGenMode(); });
  $('#gen-run').onclick = renderGenerate;
  $('#gen-newseed').onclick = () => {
    // 用现有种子哈希推进，得到新的确定性种子（不调用 Math.random）
    const cur = $('#gen-seed').value || '0';
    $('#gen-seed').value = (hashSeed(cur + 'x') % 100000).toString();
    renderGenerate();
  };
  $('#val-run').onclick = renderValidate;
  $('#val-clear').onclick = () => { buildValidatorInputs(); $('#val-result-card').style.display = 'none'; };
  $('#val-fill-hot').onclick = () => {
    const st = computeStats(allDraws().length, 0.03);
    const hot = topK(scoreHot(st), st.r.mainCount);
    const ex = st.r.extraFromMain ? [] : range1(st.r.extraMax)
      .map(n => ({ n, f: st.extraFreq[n] })).sort((a, b) => b.f - a.f)
      .slice(0, st.r.extraCount).map(e => e.n);
    fillValidator(hot, ex);
  };

  applyStaticI18n();
  fillWindowSelects();
  buildValidatorInputs();
  updateGenMethodDesc();
  updateGenMode();
  renderOverview();
}

if (typeof document !== 'undefined') {
  init();
} else if (typeof module !== 'undefined') {
  // Node 下仅导出纯函数用于测试（不触碰 DOM）
  module.exports = {
    computeStats, computeStatsArr, scoreHot, scoreOverdue, scoreMarkov,
    scoreBayes, scoreConsensus, scoreUniform, backtest, randomBaseline, median, uniformPick,
    tieKey, GEN_PRESET,
    topK, weightedSample, mulberry32, hashSeed, ozDivision, pbDivision,
    classifyDraw, divisionNames, evaluateTicket, normalize, modeStats, t, I18N, LANGS,
    _setState: s => Object.assign(state, s),
  };
}
