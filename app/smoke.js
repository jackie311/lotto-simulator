// DOM 冒烟测试：用 jsdom 真实加载 index.html + data.js + app.js，
// 模拟用户操作（切游戏、切标签、生成、验证），断言无报错且有内容产出。
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
global.window = window;
global.document = window.document;
window.alert = () => {}; // 静默

// 注入 data.js 与 app.js
const dataSrc = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
let errors = [];
try {
  window.eval(dataSrc);
  window.eval(appSrc);
} catch (e) { errors.push('load: ' + e.message); }

const $ = s => window.document.querySelector(s);
const $$ = s => [...window.document.querySelectorAll(s)];
let pass = 0, fail = 0;
function ok(name, cond) { if (cond) pass++; else { fail++; console.log('  ✗', name); } }

// i18n：默认英文
ok('默认英文 tab', $$('.tab').find(t => t.dataset.view === 'overview').textContent.trim() === 'Overview');
ok('默认英文免责声明', $('.disclaimer').textContent.includes('independent random'));
const setLangSel = code => { const s = $('#langsel'); s.value = code; s.dispatchEvent(new window.Event('change')); };
ok('语言下拉有6个选项', $$('#langsel option').length === 6);
ok('英文窗口标签', $$('label').some(l => l.textContent.includes('Stats window')));
// 切到西语验证渲染
setLangSel('es');
ok('西语 tab', $$('.tab').find(t => t.dataset.view === 'overview').textContent.trim() === 'Resumen');
ok('西语动态渲染', $('#ov-meta').textContent.includes('Reglas actuales'));
// 切到日语
setLangSel('ja');
ok('日语 tab', $$('.tab').find(t => t.dataset.view === 'predict').textContent.trim() === '予測');
// 切到韩语
setLangSel('ko');
ok('韩语 tab', $$('.tab').find(t => t.dataset.view === 'generate').textContent.trim() === '생성');
// 切到法语
setLangSel('fr');
ok('法语 tab', $$('.tab').find(t => t.dataset.view === 'validate').textContent.trim() === 'Valider');
// 切到中文，后续断言沿用中文文案
setLangSel('zh');
ok('切换中文 tab', $$('.tab').find(t => t.dataset.view === 'overview').textContent.trim() === '概览');
ok('切换中文窗口标签', $$('label').some(l => l.textContent.includes('统计窗口')));

// 概览默认已渲染
ok('概览有热号图', $('#ov-hot').innerHTML.includes('bar-row'));
ok('概览频率格已填充', $$('#ov-freqgrid .freqcell').length === 47);
ok('概览最近开奖表', $('#ov-recent').innerHTML.includes('#'));

// 切到预测
$$('.tab').find(t => t.dataset.view === 'predict').click();
ok('预测渲染5方法', $$('#pr-results .method-block').length === 5);
ok('预测有号码球', $$('#pr-results .ball').length > 0);

// 预测方法旁有 tooltip 图标（5个）
ok('预测每方法有tooltip', $$('#pr-results .method-block .tip[data-tip]').length === 5);
ok('预测tooltip有内容', $$('#pr-results .tip')[0].getAttribute('data-tip').length > 20);

// 回测：sims 可调，设小值加速 → 点击运行 → 出对比表
ok('回测有sims控件', !!$('#pr-bt-sims'));
$('#pr-bt-sims').value = '1000';
$('#pr-bt-run').click();
ok('回测note反映所选sims', $('#pr-backtest').textContent.includes('1000 次'));
ok('回测产出表格', $('#pr-backtest').innerHTML.includes('<table'));
ok('回测含随机基准行', $('#pr-backtest').textContent.includes('随机基准'));
ok('回测含5方法名', ['加权频率', '冷门遗漏', '马尔可夫', '贝叶斯收缩', '综合融合'].every(s => $('#pr-backtest').textContent.includes(s)));
ok('回测有结论徽标', $$('#pr-backtest .verdict').length >= 5);
ok('回测含实测随机对照行', $('#pr-backtest').textContent.includes('随机选号'));
ok('回测含经验p值列', $('#pr-backtest').textContent.includes('经验 p 值'));
ok('回测含样本内提示', $('#pr-backtest').textContent.includes('样本内'));

// 切到生成 + 各方法
$$('.tab').find(t => t.dataset.view === 'generate').click();
// 模式切换：默认推荐模式（高级控件隐藏、预设徽标显示）
ok('有模式切换按钮(2个)', $$('.modebtn').length === 2);
ok('默认推荐模式徽标可见', $('#gen-preset').style.display !== 'none');
ok('推荐模式隐藏高级控件', $$('.gen-adv').every(el => el.style.display === 'none'));
ok('推荐徽标含配置说明', $('#gen-preset').textContent.includes('推荐配置'));
// 切方法后徽标更新
$('#gen-method').value = 'overdue'; $('#gen-method').dispatchEvent(new window.Event('change'));
ok('徽标随方法更新(全部期)', $('#gen-preset').textContent.includes('全部'));
// 切到自定义模式 → 高级控件显示、徽标隐藏
$$('.modebtn').find(b => b.dataset.mode === 'custom').click();
ok('自定义模式显示高级控件', $$('.gen-adv').every(el => el.style.display !== 'none'));
ok('自定义模式隐藏徽标', $('#gen-preset').style.display === 'none');
// 方法说明框随选择更新
ok('生成说明框初始有内容', $('#gen-method-desc').textContent.length > 20);
$('#gen-method').value = 'overdue'; $('#gen-method').dispatchEvent(new window.Event('change'));
ok('生成说明框切换后含遗漏说明', $('#gen-method-desc').textContent.includes('遗漏'));
ok('生成方法tip同步', $('#gen-method-tip').getAttribute('data-tip').includes('遗漏'));
for (const m of ['frequency', 'overdue', 'markov', 'bayes', 'consensus', 'balanced', 'topk', 'random']) {
  $('#gen-method').value = m;
  $('#gen-run').click();
  const combos = $$('#gen-results .gcombo');
  ok('生成-' + m + ' 出5注', combos.length === 5);
  // 每注主号合法
  const balls = combos[0].querySelectorAll('.ball.main');
  ok('生成-' + m + ' 首注7主号', balls.length === 7);
  if (m === 'random') {
    // 纯随机：无预测对照行，显示「纯随机」
    ok('生成-random 无预测对照行', $$('#gen-results .ref').length === 0);
    ok('生成-random 显示纯随机', combos[0].textContent.includes('纯随机'));
  } else {
    ok('生成-' + m + ' 有预测对照行', $$('#gen-results .ref').length === 1);
    ok('生成-' + m + ' 显示重合', combos[0].textContent.includes('重合'));
  }
}
// 确定性：同种子两次相同
$('#gen-method').value = 'consensus'; $('#gen-seed').value = '999';
$('#gen-run').click(); const a1 = $('#gen-results').innerHTML;
$('#gen-run').click(); const a2 = $('#gen-results').innerHTML;
ok('生成确定性(同种子同结果)', a1 === a2);

// 内联验证：点「验证」就地展开，不跳转标签页（仍停留在 generate）
const viewBefore = $$('.view.active')[0].id;
const ivb = $$('#gen-results .gcombo .ivbtn')[0];
ivb.click();
ok('内联验证不跳转(仍在生成页)', $$('.view.active')[0].id === viewBefore && viewBefore === 'view-generate');
ok('内联验证就地展开结果', $$('#gen-results .ivrow').length === 1);
ok('内联验证含对奖摘要', $('#gen-results .ivresult').textContent.includes('对照'));
ok('内联验证按钮变收起', ivb.textContent === '收起');
ivb.click();
ok('再次点击收起', $$('#gen-results .ivrow').length === 0 && ivb.textContent === '验证');

// 验证：切游戏到 powerball 测一遍验证流程
$$('.gamebtn').find(b => b.dataset.game === 'powerball').click();
$$('.tab').find(t => t.dataset.view === 'validate').click();
ok('PB验证有主号输入7个', $$('#val-inputs .vmain').length === 7);
ok('PB验证有PB输入1个', $$('#val-inputs .vextra').length === 1);
// 填入一期真实历史，应中一等奖
const D = window.LOTTO_DATA.powerball.draws[5];
$$('#val-inputs .vmain').forEach((el, i) => el.value = D.main[i]);
$$('#val-inputs .vextra')[0].value = D.extra[0];
$('#val-run').click();
ok('PB验证结果显示一等', $('#val-result').textContent.includes('一等'));
ok('PB验证卡片可见', $('#val-result-card').style.display === 'block');

// 切回 ozlotto 验证（无 extra 输入）
$$('.gamebtn').find(b => b.dataset.game === 'ozlotto').click();
$$('.tab').find(t => t.dataset.view === 'validate').click();
ok('OZ验证无extra输入', $$('#val-inputs .vextra').length === 0);
$('#val-fill-hot').click();
ok('OZ填入热号7个', $$('#val-inputs .vmain').filter(el => el.value).length === 7);
$('#val-run').click();
ok('OZ验证产出结果', $('#val-result').textContent.length > 20);

if (errors.length) { console.log('运行时错误:', errors); fail += errors.length; }
console.log(`\nDOM 冒烟：${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
