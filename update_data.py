#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
每周更新开奖数据。

从 Lotterywest 官方接口下载最新结果，把缺失的新期次追加进
history_results/ 下的两个 CSV（按期号去重、保持各自原有列格式与排序），
然后重新生成 app/data.js。

用法：
  python update_data.py            # 下载、追加新期、重建 data.js
  python update_data.py --dry-run  # 只检查有多少新期，不写文件

官方来源（Lotterywest）：
  Oz Lotto  : https://www.lotterywest.wa.gov.au/api/games/5130/results-csv
  Powerball : https://www.lotterywest.wa.gov.au/api/games/5132/results-csv

说明：网页是纯静态应用（file://），无法自己抓取/写文件，因此更新必须由本脚本在本地完成。
"""
import csv, io, os, sys, urllib.request

try:  # Windows 控制台中文输出
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
HIST = os.path.join(HERE, "history_results")

OZ_URL = "https://www.lotterywest.wa.gov.au/api/games/5130/results-csv"
PB_URL = "https://www.lotterywest.wa.gov.au/api/games/5132/results-csv"

OZ_CSV = os.path.join(HIST, "australia_oz_lotto_tuesday_results_1994_to_2026_full.csv")
PB_CSV = os.path.join(HIST, "australia_powerball_results_1996_to_2026_full.csv")

PB_SOURCE = "Lotterywest official Powerball results CSV"


def iso_date(dmy):
    """dd/mm/yyyy -> yyyy-mm-dd"""
    d, m, y = dmy.split("/")
    return f"{y}-{int(m):02d}-{int(d):02d}"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "lotto-updater/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        text = resp.read().decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(text)))
    if not rows or rows[0][0].strip().lower().startswith("failed"):
        raise RuntimeError(f"下载失败或格式异常: {url}")
    return rows  # 含表头，最新在前


def map_oz(live_row):
    """官方 OZ 行 -> 存档 OZ 行（在第3列插入 draw_date_iso）。
    官方: [Draw number, Draw date, W1..W7, Supp1..3, Div1..7(×4)]
    存档: [Draw number, Draw date, draw_date_iso, W1..W7, Supp1..3, Div1..7(×4)]"""
    return [live_row[0], live_row[1], iso_date(live_row[1])] + live_row[2:]


def map_pb(live_row):
    """官方 PB 行 -> 存档 PB 行（改列名+加 source 列）。
    官方: [Draw number, Draw date, W1..W7, Powerball, Div1..9(×4)]
    存档: [draw_number, draw_date_iso, draw_date_original, w1..w7, powerball,
           Div1..9(×4), source, source_url]"""
    dn = live_row[0]
    dmy = live_row[1]
    rest = live_row[2:]  # W1..W7, powerball, divisions...
    return [dn, iso_date(dmy), dmy] + rest + [PB_SOURCE, PB_URL]


def update_game(name, url, csv_path, mapper, ascending, dry_run):
    live = fetch(url)
    live_rows = [r for r in live[1:] if r and r[0].strip().isdigit()]

    with open(csv_path, encoding="utf-8-sig", newline="") as f:
        stored = list(csv.reader(f))
    header, data = stored[0], [r for r in stored[1:] if r and r[0].strip().isdigit()]
    existing = {int(r[0]) for r in data}

    new_rows = []
    for r in live_rows:
        dn = int(r[0])
        if dn in existing:
            continue
        new_rows.append(mapper(r))

    latest_stored = max(existing) if existing else 0
    latest_live = max(int(r[0]) for r in live_rows)
    print(f"[{name}] 存档最新期 #{latest_stored}｜官方最新期 #{latest_live}｜新增 {len(new_rows)} 期")
    for r in new_rows:
        print(f"        + #{r[0]}  {r[1] if name=='Oz Lotto' else r[2]}")

    if dry_run or not new_rows:
        return len(new_rows)

    all_data = data + new_rows
    all_data.sort(key=lambda r: int(r[0]), reverse=not ascending)
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(all_data)
    return len(new_rows)


def main():
    dry = "--dry-run" in sys.argv
    print("== 拉取 Lotterywest 官方结果 ==")
    total = 0
    total += update_game("Oz Lotto", OZ_URL, OZ_CSV, map_oz, ascending=True, dry_run=dry)
    total += update_game("Powerball", PB_URL, PB_CSV, map_pb, ascending=False, dry_run=dry)

    if dry:
        print(f"\n[dry-run] 共发现 {total} 期新数据，未写入。")
        return
    if total == 0:
        print("\n数据已是最新，无需更新 data.js。")
        return

    print("\n== 重新生成 app/data.js ==")
    import build_data
    build_data.main()
    print(f"\n✅ 完成：新增 {total} 期，data.js 已更新。")


if __name__ == "__main__":
    main()
