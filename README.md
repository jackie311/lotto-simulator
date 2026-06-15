# 🎲 Oz Lotto & Powerball 模拟器（预测 / 生成 / 验证）

基于 `history_results/` 下的真实历史开奖数据，用**多种数学/统计方法**（非 `Math.random()` 随机）做：

1. **预测 Predict** — 预测下一期可能开出的号码组（页底含 walk-forward 回测）
2. **生成 Generate** — 生成下一期可能的投注组合（推荐 / 自定义两种模式）
3. **验证 Validate** — 把一组号码对照全部历史，看能中几等奖
4. **概览 Overview** — 热号 / 冷号 / 频率 / 形态 / 高频对统计

> 🌐 **多语言**：界面支持 English / 中文 / Español / Français / 日本語 / 한국어 共 6 种，**默认英文**，右上角一键切换。

> ⚠️ 彩票每期独立随机，历史**无法**真正预测未来。本工具仅作数学实验与娱乐。

## 运行

纯静态、零依赖、可离线。两种方式：

- **直接打开**：双击 `app/index.html`（数据已嵌入 `app/data.js`，无需服务器）。
- **本地服务器**（可选）：`cd app && python -m http.server 8000`，浏览器开 `http://localhost:8000`。

## 当前规则（程序自动只保留“当前格式”的历史期）

| 游戏 | 主号 | 附加号 | 可用期数 |
|---|---|---|---|
| Oz Lotto | 7 个，1–47 | 3 个补充号 Supplementary，1–47 | 213 |
| Powerball | 7 个，1–35 | 1 个 Powerball，1–20 | 426 |

## 用到的数学方法（均非朴素随机）

- **加权频率（热号）**：近期出现越多权重越高，带指数衰减 λ 的近期加权。
- **冷门遗漏（Overdue）**：实际遗漏间隔 / 期望间隔，越久未开越“该出”。
- **马尔可夫共现**：与最近一期号码历史共现最多的号码。
- **贝叶斯收缩**：把历史频率往先验 7/N 收缩 `(freq+k·p0)/(N+k)`，防止把随机波动当信号（最保守诚实的频率法）。
- **综合融合（Consensus）**：热号/遗漏/共现三法归一化后等权平均。
- **均衡形态**：按历史组合的和值区间、奇偶比、大小比约束筛选。
- **确定性 Top-K**：完全不使用任何随机，纯按权重排序取号。

## 诚实评估：这些方法真的有用吗？（核心）

**预测页底部 walk-forward 回测** — 用「该期之前」的数据预测每一期，滚动到底，
统计真实平均命中数，坦诚回答「能不能预测」。评估方法力求严谨：

- **实测随机对照组**：在同一批开奖上做种子化随机选号，直接看随机策略的真实表现（而非只比理论基准）。
- **蒙特卡洛经验 p 值**：在同一批开奖上重复随机选号 3000+ 次，得到「平均命中」的零分布，
  计算「随机 ≥ 本方法」的比例（p 越小越可能真优于随机）。比单纯 z 检验更可靠。
- **保守分级结论**：仅当 p<0.01 才记「显著高于随机（仍需样本外验证）」；明确标注多重比较与样本内的局限。

实测结果（经验 p 值）：

| 方法 | Oz 平均命中 (基准 1.043) | Powerball 平均命中 (基准 1.400) |
|---|---|---|
| 🎰 随机选号（实测对照） | 1.123 (p=0.14) | 1.354 (p=0.84) |
| 加权频率 | 1.055 (p=0.44) | 1.388 (p=0.61) |
| 冷门遗漏 | 1.037 (p=0.55) | 1.444 (p=0.19) |
| 马尔可夫 | 1.037 (p=0.55) | 1.282 (p=0.99，**显著低于随机**) |
| 贝叶斯收缩 | 1.037 (p=0.55) | 1.370 (p=0.75) |
| 综合融合 | 0.988 (p=0.80) | 1.359 (p=0.82) |

**结论：没有任何方法显著优于随机**——实测随机对照组（Oz 1.123）甚至比所有「聪明」方法都高，
正说明样本内跑赢基准只是运气。这印证了「彩票是独立随机事件，历史无法预测下一期」。
本工具用于统计探索与娱乐，**不能提高中奖概率**。

> 注：z 值仅作粗略参考。它假设各期独立同分布，但 walk-forward 的训练集高度重叠、且同时检验多个方法，
> 会让显著性偏乐观，故结论以更保守的经验 p 值与（必须的）样本外验证为准。回测是**样本内**评估：
> 能回答「历史上是否略好于随机」，不能证明「能预测下一期」。

**生成器不使用 `Math.random()`**：号码权重由统计模型计算，再用**种子化确定性 PRNG（mulberry32）按权重不放回采样**——相同种子 + 参数永远复现同一结果。

生成页有两种模式：

- **🔰 推荐模式（默认，面向新手）**：只需选方法，系统自动套用该方法的最优窗口与衰减搭配（如：热号 → 最近100期+λ0.06；遗漏/马尔可夫/贝叶斯 → 全历史+λ0；综合/均衡 → 100期+λ0.03），并显示一行配置说明，点「生成」即可。
- **⚙️ 自定义模式（面向进阶）**：自由搭配方法 / 统计窗口 / 衰减 λ / 种子 Seed。

## 每周更新数据

开奖数据来自 Lotterywest 官方接口（Oz Lotto = 游戏 5130，Powerball = 5132）。
一条命令即可拉取最新结果、按期号去重追加进 `history_results/` 下的 CSV，并自动重建 `app/data.js`：

```bash
python update_data.py            # 下载 → 追加新期 → 重建 data.js（幂等，已最新则跳过）
python update_data.py --dry-run  # 只检查有多少新期，不写文件
```

Windows 下也可直接双击 **`update.bat`**。

> 网页是纯静态应用（file://），无法自己抓取或写文件，所以更新必须由该脚本在本地完成。
> 开奖日：Oz Lotto 周二、Powerball 周四（澳洲时间），结果当晚稍后公布。

### 设为自动每周运行（Windows 任务计划）

在 PowerShell 里执行一次（建议周三、周五早上各跑一次，覆盖两个游戏）：

```powershell
$action  = New-ScheduledTaskAction -Execute "python" -Argument "update_data.py" -WorkingDirectory "D:\Jackie\repo\lotto"
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Wednesday,Friday -At 9am
Register-ScheduledTask -TaskName "LottoDataUpdate" -Action $action -Trigger $trigger `
  -Description "每周更新 Oz Lotto & Powerball 开奖数据"
```

取消：`Unregister-ScheduledTask -TaskName "LottoDataUpdate" -Confirm:$false`

## 手动重新生成 data.js

若只改了 CSV 想重建嵌入数据（不联网）：

```bash
python build_data.py
```

## 测试

```bash
node app/test.js        # 纯逻辑测试（无依赖）：191 项
node app/smoke.js       # DOM 冒烟测试（需 npm i jsdom）：82 项
```

## 文件结构

```
update_data.py       # 每周更新：拉官方结果 → 追加新期 → 重建 data.js
update.bat           # Windows 一键更新封装
build_data.py        # CSV → app/data.js 预处理
history_results/     # 原始官方 CSV
app/
  index.html         # 页面
  style.css          # 样式
  app.js             # 全部统计 / 预测 / 生成 / 验证逻辑
  data.js            # 嵌入的历史数据（自动生成）
  test.js / smoke.js # 测试
```
