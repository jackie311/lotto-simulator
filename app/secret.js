'use strict';
/* 私密战绩页：复用 app.js 的 genCombosFor / classifyDraw / divisionNames 等。
 * app.js 在本页不会执行 init()（无 #ov-window），仅暴露函数。 */
(function () {
  if (typeof DATA === 'undefined') return;
  state.lang = 'zh'; // 让 divisionNames 返回中文
  const root = document.getElementById('secret-root');
  const METHODS = ['consensus', 'frequency', 'overdue', 'markov', 'bayes', 'balanced', 'topk', 'random'];
  const MNAME = {
    frequency: '加权频率', overdue: '遗漏(冷号)', markov: '马尔可夫', bayes: '贝叶斯收缩',
    consensus: '共识', balanced: '均衡形态', topk: '确定性Top-K', random: '纯随机',
  };
  const LINES = 5;   // 每个方法生成几注
  const TRK = 12;    // 战绩回溯期数

  const seedFor = (game, method, tn) => 'secret|' + game + '|' + method + '|' + tn;
  const sortAsc = a => [...a].sort((x, y) => x - y);

  function ballsHTML(game, line, target) {
    const r = DATA[game].rules;
    const tmain = target ? target.main : [];
    const textra = target ? target.extra : [];
    let h = '<div class="balls">';
    h += line.main.map(n => {
      const hit = tmain.includes(n);
      const supp = !hit && textra.includes(n);
      return `<span class="ball main${hit ? ' hit' : ''}${supp ? ' supp' : ''}">${n}</span>`;
    }).join('');
    if (r.extraCount && !r.extraFromMain && line.extra.length) {
      h += '<span class="tag">PB</span>';
      h += line.extra.map(n => {
        const hit = textra.includes(n);
        return `<span class="ball pb${hit ? ' hit' : ''}">${n}</span>`;
      }).join('');
    }
    return h + '</div>';
  }

  function lineResult(game, line, target) {
    if (!target) return '';
    const r = DATA[game].rules;
    const mh = line.main.filter(n => target.main.includes(n)).length;
    let s = `<b>${mh}/${r.mainCount}</b> 主号`;
    if (game === 'ozlotto') {
      const sh = line.main.filter(n => target.extra.includes(n)).length;
      if (sh) s += ` + ${sh} 补`;
    } else {
      const pb = line.extra.length && target.extra.includes(line.extra[0]);
      s += pb ? ' + PB✓' : ' + PB✗';
    }
    const dv = classifyDraw(game, line, target);
    if (dv) s += ` · <span class="win">${divisionNames(game)[dv]} 中奖</span>`;
    return `<span class="res">${s}</span>`;
  }

  function methodBlock(game, method, before, target, tn) {
    const lines = genCombosFor(game, method, before, LINES, seedFor(game, method, tn));
    let summary = '';
    if (target) {
      let tot = 0, best = 0;
      lines.forEach(L => {
        tot += L.main.filter(n => target.main.includes(n)).length;
        const dv = classifyDraw(game, L, target);
        if (dv && (best === 0 || dv < best)) best = dv;
      });
      summary = `<span class="ms">${LINES} 注共命中 ${tot} 个主号${best ? ' · 最佳 ' + divisionNames(game)[best] : ''}</span>`;
    }
    const rows = lines.map(L =>
      `<div class="linerow">${ballsHTML(game, L, target)}${lineResult(game, L, target)}</div>`
    ).join('');
    return `<div class="mblock"><div class="mhead"><span class="mn">${(METHOD_ICON[method] || '') + ' ' + MNAME[method]}</span>${summary}</div>${rows}</div>`;
  }

  function actualHTML(game, d) {
    const main = sortAsc(d.main).map(n => `<span class="ball main">${n}</span>`).join('');
    const extra = game === 'powerball'
      ? `<span class="tag">PB</span><span class="ball pb">${d.extra[0]}</span>`
      : `<span class="tag">补</span>` + d.extra.map(n => `<span class="ball extra">${n}</span>`).join('');
    return `<div class="actual"><span class="lbl">实际开奖：</span><div class="balls">${main}${extra}</div></div>`;
  }

  function trackRecord(game) {
    const draws = DATA[game].draws, r = DATA[game].rules;
    const acc = {}; METHODS.forEach(m => acc[m] = { hits: 0, lines: 0, best: 0 });
    let used = 0;
    for (let i = 0; i < draws.length && used < TRK; i++) {
      const target = draws[i];
      const before = draws.filter(d => d.n < target.n);
      if (before.length < 80) break;
      used++;
      METHODS.forEach(m => {
        genCombosFor(game, m, before, LINES, seedFor(game, m, target.n)).forEach(L => {
          acc[m].hits += L.main.filter(n => target.main.includes(n)).length;
          acc[m].lines++;
          const dv = classifyDraw(game, L, target);
          if (dv && (acc[m].best === 0 || dv < acc[m].best)) acc[m].best = dv;
        });
      });
    }
    const baseline = (r.mainCount * r.mainCount) / r.mainMax;
    const rows = METHODS.map(m => {
      const avg = acc[m].lines ? acc[m].hits / acc[m].lines : 0;
      const cls = avg > baseline ? 'good' : '';
      return `<tr><td>${(METHOD_ICON[m] || '') + ' ' + MNAME[m]}</td>
        <td class="num ${cls}">${avg.toFixed(3)}</td>
        <td class="num">${acc[m].best ? divisionNames(game)[acc[m].best] : '—'}</td></tr>`;
    }).join('');
    return { used, baseline, html: `<table class="trk">
      <tr><th>方法</th><th class="num">平均命中/注</th><th class="num">最佳奖级</th></tr>${rows}</table>` };
  }

  function gameSection(game) {
    const draws = DATA[game].draws;
    const latest = draws[0];
    const nextN = latest.n + 1;
    const scoreBefore = draws.filter(d => d.n < latest.n);

    const pending = METHODS.map(m => methodBlock(game, m, draws, null, nextN)).join('');
    const score = METHODS.map(m => methodBlock(game, m, scoreBefore, latest, latest.n)).join('');
    const trk = trackRecord(game);

    return `<div class="secret-card">
      <h2>🎲 ${DATA[game].name}</h2>

      <h3>① 下一期预测 · 第 ${nextN} 期（待开奖）</h3>
      ${pending}

      <h3>② 最近一期核对 · 第 ${latest.n} 期（${latest.date}）</h3>
      ${actualHTML(game, latest)}
      ${score}

      <h3>③ 战绩回溯 · 最近 ${trk.used} 期（每期 ${LINES} 注/方法；随机基准≈${trk.baseline.toFixed(3)}/注）</h3>
      ${trk.html}
    </div>`;
  }

  root.innerHTML = ['ozlotto', 'powerball'].map(gameSection).join('');
})();
