'use strict';
/* 私密战绩页：复用 app.js 的 genCombosFor / classifyDraw / METHOD_ICON / t 等。
 * app.js 在本页不执行 init()（无 #ov-window），仅暴露函数。
 * 本页自带 6 语言文案（默认英语）；方法名复用主应用的 method.*.name。 */
(function () {
  if (typeof DATA === 'undefined') return;

  const METHODS = ['consensus', 'frequency', 'overdue', 'markov', 'bayes', 'balanced', 'topk', 'random'];
  const LINES = 5;   // 每个方法生成几注
  const TRK = 12;    // 战绩回溯期数

  /* ---------- 本页 i18n（默认 en；缺失键回退英文） ---------- */
  const SI18N = {
    en: {
      title: '🔒 Private scorecard',
      subtitle: 'Picks are generated for the next draw; after each draw the previous one is auto-checked against the real result. This page is not indexed and not linked anywhere. Picks are deterministic — once a draw happens, its “awaiting” set becomes the “checked” set unchanged.',
      game: 'Game', language: 'Language',
      sec1: '① Next-draw predictions · #{n} (awaiting result)',
      sec2: '② Last-draw check · #{n} ({date})',
      sec3: '③ Track record · last {n} draws ({lines} lines/method; random baseline ≈ {b}/line)',
      actual: 'Actual draw:', supp: 'Supp',
      summary: '{lines} lines hit {tot} main numbers', best: ' · best {div}',
      rmain: '{h}/{mc} main', rsupp: ' + {s} supp', pbyes: ' + PB ✓', pbno: ' + PB ✗', won: ' · won {div}',
      div: 'Div {n}', tmethod: 'Method', tavg: 'Avg hits/line', tbest: 'Best division',
      note: 'Predictions use only data from before the target draw (true out-of-sample). Green = main number hit; gold = supplementary hit (Oz Lotto only). Every draw is an independent random event — this page is for personal fun, not betting advice.',
    },
    zh: {
      title: '🔒 私密战绩页',
      subtitle: '为「下一期」提前出号；每期开奖后自动核对上一期命中几个号。本页不收录、不对外链接。出号确定性可复现——下一期一旦开奖，"待开奖"那组会原样变成"已核对"。',
      game: '游戏', language: '语言',
      sec1: '① 下一期预测 · 第 {n} 期（待开奖）',
      sec2: '② 最近一期核对 · 第 {n} 期（{date}）',
      sec3: '③ 战绩回溯 · 最近 {n} 期（每期 {lines} 注/方法；随机基准≈{b}/注）',
      actual: '实际开奖：', supp: '补',
      summary: '{lines} 注共命中 {tot} 个主号', best: ' · 最佳 {div}',
      rmain: '{h}/{mc} 主号', rsupp: ' + {s} 补', pbyes: ' + PB ✓', pbno: ' + PB ✗', won: ' · 中 {div}',
      div: '{n} 等', tmethod: '方法', tavg: '平均命中/注', tbest: '最佳奖级',
      note: '预测仅用「目标期之前」的数据生成，是真正的样本外预测。绿色=命中主号；金色=命中补充号（仅 Oz Lotto）。每期都是独立随机事件——本页只为自娱，不构成投注建议。',
    },
    es: {
      title: '🔒 Marcador privado',
      subtitle: 'Las combinaciones se generan para el próximo sorteo; tras cada sorteo se comprueba automáticamente el anterior contra el resultado real. Esta página no se indexa ni se enlaza. Las combinaciones son deterministas: cuando ocurre un sorteo, su conjunto «pendiente» pasa a ser el «comprobado» sin cambios.',
      game: 'Juego', language: 'Idioma',
      sec1: '① Predicciones del próximo sorteo · n.º {n} (pendiente)',
      sec2: '② Comprobación del último sorteo · n.º {n} ({date})',
      sec3: '③ Historial · últimos {n} sorteos ({lines} líneas/método; base aleatoria ≈ {b}/línea)',
      actual: 'Sorteo real:', supp: 'Supl.',
      summary: '{lines} líneas acertaron {tot} números principales', best: ' · mejor {div}',
      rmain: '{h}/{mc} princ.', rsupp: ' + {s} supl.', pbyes: ' + PB ✓', pbno: ' + PB ✗', won: ' · ganó {div}',
      div: 'Div {n}', tmethod: 'Método', tavg: 'Aciertos medios/línea', tbest: 'Mejor división',
      note: 'Las predicciones usan solo datos anteriores al sorteo objetivo (fuera de muestra real). Verde = acierto principal; oro = acierto suplementario (solo Oz Lotto). Cada sorteo es un evento aleatorio independiente: esta página es para diversión personal, no un consejo de apuestas.',
    },
    fr: {
      title: '🔒 Tableau de bord privé',
      subtitle: 'Les grilles sont générées pour le prochain tirage ; après chaque tirage, le précédent est vérifié automatiquement avec le résultat réel. Cette page n’est ni indexée ni liée. Les grilles sont déterministes : une fois un tirage effectué, son ensemble « en attente » devient l’ensemble « vérifié » inchangé.',
      game: 'Jeu', language: 'Langue',
      sec1: '① Prédictions du prochain tirage · n° {n} (en attente)',
      sec2: '② Vérification du dernier tirage · n° {n} ({date})',
      sec3: '③ Bilan · {n} derniers tirages ({lines} lignes/méthode ; base aléatoire ≈ {b}/ligne)',
      actual: 'Tirage réel :', supp: 'Compl.',
      summary: '{lines} lignes ont trouvé {tot} numéros principaux', best: ' · meilleur {div}',
      rmain: '{h}/{mc} princ.', rsupp: ' + {s} compl.', pbyes: ' + PB ✓', pbno: ' + PB ✗', won: ' · gagné {div}',
      div: 'Div {n}', tmethod: 'Méthode', tavg: 'Bons moy./ligne', tbest: 'Meilleure division',
      note: 'Les prédictions n’utilisent que les données antérieures au tirage cible (hors échantillon réel). Vert = numéro principal trouvé ; or = complémentaire trouvé (Oz Lotto uniquement). Chaque tirage est un événement aléatoire indépendant — cette page est pour le plaisir personnel, pas un conseil de pari.',
    },
    ja: {
      title: '🔒 非公開スコアカード',
      subtitle: '次回抽選用に番号を生成し、各抽選後に前回分を実際の結果と自動照合します。本ページは索引登録もリンクもされません。番号は決定論的で、抽選が行われると「待機中」が「照合済み」にそのまま変わります。',
      game: 'ゲーム', language: '言語',
      sec1: '① 次回予測 · 第{n}回（結果待ち）',
      sec2: '② 直近回の照合 · 第{n}回（{date}）',
      sec3: '③ 成績 · 直近{n}回（各手法{lines}口；ランダム基準≈{b}/口）',
      actual: '実際の抽選：', supp: '補助',
      summary: '{lines}口で主番号{tot}個的中', best: ' · 最良 {div}',
      rmain: '主番号 {h}/{mc}', rsupp: ' + 補助{s}', pbyes: ' + PB ✓', pbno: ' + PB ✗', won: ' · {div} 当せん',
      div: '{n}等', tmethod: '手法', tavg: '平均的中/口', tbest: '最高等級',
      note: '予測は対象抽選より前のデータのみを使用（真の標本外）。緑＝主番号的中、金＝補助番号的中（Oz Lotto のみ）。各抽選は独立した無作為事象です——本ページは個人的な娯楽用で、投資・賭けの助言ではありません。',
    },
    ko: {
      title: '🔒 비공개 성적표',
      subtitle: '다음 추첨용으로 번호를 생성하고, 각 추첨 후 이전 회차를 실제 결과와 자동 대조합니다. 이 페이지는 색인되지 않고 어디에도 링크되지 않습니다. 번호는 결정론적이라, 추첨이 끝나면 "대기 중" 세트가 그대로 "확인됨" 세트가 됩니다.',
      game: '게임', language: '언어',
      sec1: '① 다음 추첨 예측 · #{n} (결과 대기)',
      sec2: '② 최근 추첨 확인 · #{n} ({date})',
      sec3: '③ 성적 기록 · 최근 {n}회 (방법당 {lines}줄; 무작위 기준 ≈ {b}/줄)',
      actual: '실제 추첨:', supp: '보조',
      summary: '{lines}줄에서 메인 {tot}개 적중', best: ' · 최고 {div}',
      rmain: '메인 {h}/{mc}', rsupp: ' + 보조 {s}', pbyes: ' + PB ✓', pbno: ' + PB ✗', won: ' · {div} 당첨',
      div: '{n}등', tmethod: '방법', tavg: '평균 적중/줄', tbest: '최고 등급',
      note: '예측은 대상 추첨 이전 데이터만 사용합니다(진짜 표본 외). 초록=메인 적중, 금색=보조 적중(Oz Lotto만). 각 추첨은 독립적인 무작위 사건입니다 — 이 페이지는 개인적 재미용이며 베팅 조언이 아닙니다.',
    },
  };
  function st(key, vars) {
    const d = SI18N[state.lang] || SI18N.en;
    let s = d[key] != null ? d[key] : SI18N.en[key];
    if (s == null) return key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }
  const divLabel = n => st('div', { n });
  const methodName = m => (typeof t === 'function' ? t('method.' + m + '.name') : m);

  /* ---------- 持久化选择 ---------- */
  const store = (typeof localStorage !== 'undefined') ? localStorage : null;
  state.lang = (store && store.getItem('secretLang')) || 'en';
  state.game = (store && store.getItem('secretGame')) || 'ozlotto';

  const head = document.getElementById('secret-head');
  const controls = document.getElementById('secret-controls');
  const root = document.getElementById('secret-root');
  const noteEl = document.getElementById('secret-note');

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
      h += line.extra.map(n => `<span class="ball pb${textra.includes(n) ? ' hit' : ''}">${n}</span>`).join('');
    }
    return h + '</div>';
  }

  function lineResult(game, line, target) {
    if (!target) return '';
    const r = DATA[game].rules;
    const mh = line.main.filter(n => target.main.includes(n)).length;
    let s = st('rmain', { h: mh, mc: r.mainCount });
    if (game === 'ozlotto') {
      const sh = line.main.filter(n => target.extra.includes(n)).length;
      if (sh) s += st('rsupp', { s: sh });
    } else {
      s += (line.extra.length && target.extra.includes(line.extra[0])) ? st('pbyes') : st('pbno');
    }
    const dv = classifyDraw(game, line, target);
    if (dv) s += `<span class="win">${st('won', { div: divLabel(dv) })}</span>`;
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
      summary = `<span class="ms">${st('summary', { lines: LINES, tot })}${best ? st('best', { div: divLabel(best) }) : ''}</span>`;
    }
    const rows = lines.map(L => `<div class="linerow">${ballsHTML(game, L, target)}${lineResult(game, L, target)}</div>`).join('');
    return `<div class="mblock"><div class="mhead"><span class="mn">${(METHOD_ICON[method] || '') + ' ' + methodName(method)}</span>${summary}</div>${rows}</div>`;
  }

  function actualHTML(game, d) {
    const main = sortAsc(d.main).map(n => `<span class="ball main">${n}</span>`).join('');
    const extra = game === 'powerball'
      ? `<span class="tag">PB</span><span class="ball pb">${d.extra[0]}</span>`
      : `<span class="tag">${st('supp')}</span>` + d.extra.map(n => `<span class="ball extra">${n}</span>`).join('');
    return `<div class="actual"><span class="lbl">${st('actual')}</span><div class="balls">${main}${extra}</div></div>`;
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
      return `<tr><td>${(METHOD_ICON[m] || '') + ' ' + methodName(m)}</td>
        <td class="num ${avg > baseline ? 'good' : ''}">${avg.toFixed(3)}</td>
        <td class="num">${acc[m].best ? divLabel(acc[m].best) : '—'}</td></tr>`;
    }).join('');
    return { used, baseline, html: `<table class="trk">
      <tr><th>${st('tmethod')}</th><th class="num">${st('tavg')}</th><th class="num">${st('tbest')}</th></tr>${rows}</table>` };
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
      <h3>${st('sec1', { n: nextN })}</h3>
      ${pending}
      <h3>${st('sec2', { n: latest.n, date: latest.date })}</h3>
      ${actualHTML(game, latest)}
      ${score}
      <h3>${st('sec3', { n: trk.used, lines: LINES, b: trk.baseline.toFixed(3) })}</h3>
      ${trk.html}
    </div>`;
  }

  function buildControls() {
    const langs = (typeof LANGS !== 'undefined') ? LANGS : [{ code: 'en', label: 'English' }];
    const gameOpts = ['ozlotto', 'powerball'].map(g =>
      `<option value="${g}"${g === state.game ? ' selected' : ''}>${DATA[g].name}</option>`).join('');
    const langOpts = langs.map(l =>
      `<option value="${l.code}"${l.code === state.lang ? ' selected' : ''}>${l.label}</option>`).join('');
    return `<div class="ctl"><label for="sec-game">${st('game')}</label><select id="sec-game">${gameOpts}</select></div>
      <div class="ctl"><label for="sec-lang">${st('language')}</label><select id="sec-lang">${langOpts}</select></div>`;
  }

  function renderAll() {
    document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : state.lang;
    document.title = st('title');
    head.innerHTML = `<h1>${st('title')}</h1><div class="sub">${st('subtitle')}</div>`;
    controls.innerHTML = buildControls();
    document.getElementById('sec-game').onchange = e => {
      state.game = e.target.value; if (store) store.setItem('secretGame', state.game); renderAll();
    };
    document.getElementById('sec-lang').onchange = e => {
      state.lang = e.target.value; if (store) store.setItem('secretLang', state.lang); renderAll();
    };
    root.innerHTML = gameSection(state.game);
    noteEl.innerHTML = st('note');
  }

  renderAll();
})();
