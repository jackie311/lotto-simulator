// 纯逻辑测试：在 Node 下加载 data.js + app.js 的导出函数，对真实历史数据做断言。
const fs = require('fs');
const path = require('path');
// 加载 data.js（其内部是 window.LOTTO_DATA = ...）
global.window = undefined;
const dataSrc = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8')
  .replace('window.LOTTO_DATA', 'global.LOTTO_DATA');
eval(dataSrc);

const A = require('./app.js');
let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL:', name); } }

for (const game of ['ozlotto', 'powerball']) {
  A._setState({ game, view: 'overview' });
  const D = global.LOTTO_DATA[game];
  const r = D.rules;
  console.log(`\n=== ${D.name} (${D.draws.length} 期) ===`);

  // 1. 数据完整性
  ok('每期主号数正确', D.draws.every(d => d.main.length === r.mainCount));
  ok('主号范围正确', D.draws.every(d => d.main.every(n => n >= 1 && n <= r.mainMax)));
  ok('主号无重复', D.draws.every(d => new Set(d.main).size === r.mainCount));
  ok('newest-first 排序', D.draws[0].date >= D.draws[D.draws.length - 1].date);

  // 2. 统计
  const st = A.computeStats(D.draws.length, 0.03);
  const totalSlots = st.freq.slice(1).reduce((a, b) => a + b, 0);
  ok('频率总和 = 期数*主号数', totalSlots === D.draws.length * r.mainCount);

  // 3. 打分向量：范围 0..1、长度正确、Top-K 合法
  for (const [nm, fn] of [['hot', A.scoreHot], ['overdue', A.scoreOverdue], ['markov', A.scoreMarkov], ['bayes', A.scoreBayes], ['consensus', A.scoreConsensus]]) {
    const w = fn(st);
    ok(`${nm} 权重长度`, w.length === r.mainMax + 1);
    ok(`${nm} 权重 0..1`, w.slice(1).every(x => x >= 0 && x <= 1));
    const pick = A.topK(w, r.mainCount);
    ok(`${nm} Top-K 数量`, pick.length === r.mainCount);
    ok(`${nm} Top-K 不重复且在范围内`, new Set(pick).size === r.mainCount && pick.every(n => n >= 1 && n <= r.mainMax));
  }

  // 4. 生成器确定性：同种子同结果，不同种子可不同
  const w = A.scoreConsensus(st);
  const rngA = A.mulberry32(A.hashSeed('seed-X'));
  const rngB = A.mulberry32(A.hashSeed('seed-X'));
  const s1 = A.weightedSample(w, r.mainCount, rngA);
  const s2 = A.weightedSample(w, r.mainCount, rngB);
  ok('同种子 → 相同组合', JSON.stringify(s1) === JSON.stringify(s2));
  ok('生成组合合法', new Set(s1).size === r.mainCount && s1.every(n => n >= 1 && n <= r.mainMax));

  // 4b. 回测 walk-forward：基准、对照、p 值、合理范围
  const bt = A.backtest({ expanding: true, lambda: 0.03, sims: 800 });
  const baseExpect = r.mainCount * r.mainCount / r.mainMax;
  ok('回测有测试点', bt.nTest > 0);
  ok('回测基准 = mainCount²/mainMax', Math.abs(bt.baseline - baseExpect) < 1e-9);
  ok('回测含5方法', Object.keys(bt.methods).length === 5);
  ok('回测含实测随机对照', bt.control && typeof bt.control.avg === 'number');
  ok('随机对照贴近基准(±0.3)', Math.abs(bt.control.avg - bt.baseline) < 0.3);
  for (const k of Object.keys(bt.methods)) {
    const m = bt.methods[k];
    ok(`回测[${k}] p 值在 0..1`, m.p >= 0 && m.p <= 1);
    ok(`回测[${k}] 均值贴近基准(±0.5)`, Math.abs(m.avg - bt.baseline) < 0.5);
    ok(`回测[${k}] 有结论`, typeof m.verdict === 'string' && m.verdict.length > 0);
    ok(`回测[${k}] max<=mainCount`, m.max <= r.mainCount);
  }

  // 4b-2. 中位数正确（偶数样本取两中值平均）
  ok('median 奇数', A.median([3, 1, 2]) === 2);
  ok('median 偶数', A.median([1, 2, 3, 4]) === 2.5);
  ok('median 空', A.median([]) === 0);

  // 4b-3. uniformPick 合法且种子可复现
  const rngA1 = A.mulberry32(A.hashSeed('u')), rngA2 = A.mulberry32(A.hashSeed('u'));
  const u1 = A.uniformPick(r.mainMax, r.mainCount, rngA1);
  const u2 = A.uniformPick(r.mainMax, r.mainCount, rngA2);
  ok('uniformPick 数量&不重复&范围', u1.length === r.mainCount && new Set(u1).size === r.mainCount && u1.every(n => n >= 1 && n <= r.mainMax));
  ok('uniformPick 同种子可复现', JSON.stringify(u1.slice().sort((a, b) => a - b)) === JSON.stringify(u2.slice().sort((a, b) => a - b)));

  // 4b-4. topK tie-break 中性：全并列时不应恒取最小的 k 个
  const flat = new Array(r.mainMax + 1).fill(0.5); flat[0] = 0;
  const tied = A.topK(flat, r.mainCount);
  const smallest = Array.from({ length: r.mainCount }, (_, i) => i + 1);
  ok('topK 并列 tie-break 非恒取最小', JSON.stringify(tied) !== JSON.stringify(smallest));
  ok('topK 并列结果合法', new Set(tied).size === r.mainCount && tied.every(n => n >= 1 && n <= r.mainMax));

  // 4d. 推荐模式：每个生成方法都有预设搭配，且参数合法
  const GEN_METHODS = ['frequency', 'overdue', 'markov', 'bayes', 'consensus', 'balanced', 'topk', 'random'];
  ok('每个生成方法都有推荐预设', GEN_METHODS.every(k => A.GEN_PRESET[k]));
  ok('预设 decay 合法', GEN_METHODS.every(k => [0, 0.01, 0.03, 0.06].includes(A.GEN_PRESET[k].decay)));
  ok('预设 window 合法', GEN_METHODS.every(k => A.GEN_PRESET[k].window === 'all' || A.GEN_PRESET[k].window > 0));

  // 4d-2. i18n：所有语言每个 key 都齐全（无缺失/无多余），方法名/预设文案存在
  const enKeys = Object.keys(A.I18N.en);
  ok('LANGS 与 I18N 一致', A.LANGS.every(l => A.I18N[l.code]) && A.LANGS.length === 6);
  for (const l of A.LANGS) {
    const d = A.I18N[l.code], ks = Object.keys(d);
    ok(`[${l.code}] key 数量一致`, ks.length === enKeys.length);
    ok(`[${l.code}] 无缺失 key`, enKeys.every(k => k in d));
    ok(`[${l.code}] 无空值`, ks.every(k => typeof d[k] === 'string' && d[k].length > 0));
  }
  A._setState({ lang: 'en' });
  ok('英文方法名存在', GEN_METHODS.every(k => A.t('method.' + k + '.name').length > 0 && !A.t('method.' + k + '.name').startsWith('method.')));
  ok('英文预设文案存在', GEN_METHODS.every(k => A.t('preset.' + k + '.why').length > 4));
  A._setState({ lang: 'zh' });
  ok('中文方法名存在', GEN_METHODS.every(k => A.t('method.' + k + '.name').length > 0));
  ok('插值生效', A.t('iv.checked', { n: 42 }).includes('42'));
  A._setState({ lang: 'en' });

  // 4e. 纯随机：均匀权重 + 采样合法
  const uni = A.scoreUniform(st);
  ok('scoreUniform 全部等权', uni.slice(1).every(x => x === uni[1]));
  const rrng = A.mulberry32(A.hashSeed('rnd'));
  const rpick = A.weightedSample(uni, r.mainCount, rrng);
  ok('随机采样合法', new Set(rpick).size === r.mainCount && rpick.every(n => n >= 1 && n <= r.mainMax));

  // 5. 验证/等奖逻辑：用某历史期当彩票，应中一等奖
  const sample = D.draws[10];
  const ticket = { main: sample.main, extra: game === 'powerball' ? [sample.extra[0]] : [] };
  const div = A.classifyDraw(game, ticket, sample);
  ok('完全匹配历史 → 一等奖(Div1)', div === 1);

  // 5b. evaluateTicket：拿历史某期当票，应至少中过一次一等奖
  const ev = A.evaluateTicket(game, ticket);
  ok('evaluateTicket 对照全历史', ev.drawsChecked === D.draws.length);
  ok('evaluateTicket 命中过一等', ev.best === 1 && ev.divCount[1] >= 1);
  ok('evaluateTicket 最多命中=mainCount', ev.bestMain === r.mainCount);
  ok('divisionNames 含一等', !!A.divisionNames(game)[1]);

  // 部分匹配
  if (game === 'ozlotto') {
    ok('oz 4主号 → 六等', A.ozDivision(4, 0) === 6);
    ok('oz 6主+1补 → 二等', A.ozDivision(6, 1) === 2);
    ok('oz 2主号 → 不中', A.ozDivision(2, 0) === 0);
  } else {
    ok('pb 7主+PB → 一等', A.pbDivision(7, true) === 1);
    ok('pb 7主无PB → 二等', A.pbDivision(7, false) === 2);
    ok('pb 2主+PB → 九等', A.pbDivision(2, true) === 9);
    ok('pb 1主+PB → 不中', A.pbDivision(1, true) === 0);
  }
}

console.log(`\n结果：${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
