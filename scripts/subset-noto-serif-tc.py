#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
按字频切片，自托管思源宋体 TC（Noto Serif TC / Source Han Serif TC，OFL 1.1）

为什么不用 Google 的分片：2026-09-13 实测，直搬 Google Fonts 的 108 片/字重方案，
呓语集首页正文只有 407 个不同汉字，浏览器却按 unicode-range 拉了 110 个分片 / 7.78MB
（受控 400 汉字探针 90 片 / 5.82MB）——它的分片不按字频聚合，常用字也散落在几十片里。
本脚本改为自己按字频切三片（可变字体，一片覆盖 wght 200~900 全部字重）：

  片 common（首屏必下）频率前 3500 字 + 标点/拉丁 + **站点自有用字**  ≈ 1.0MB
  片 ext（生僻字才下）《通用规范汉字表》一~三级其余                  ≈ 1.2MB
  片 trad（写繁体才下）常用简体字对应的繁体字                        ≈ 1.3MB
  （三片之外的字回退到字体栈里的系统衬线，例如 Noto Serif SC / 华文宋体）

为什么不再细分「高频/中频」：2026-09-13 实测，首页 407 个不同汉字里有 345 个落在高频 1200 内、
59 个落在中频，另有 3 个字（呓/瞳/蹩 —— 站点自己的用字，频率排名 4300+）落在生僻片里，
结果浏览器仍把生僻片整片 1.23MB 拖了下来。所以改为「常用的一把下 + 站点自有字并入」，
首屏稳定只下 common 一片。

浏览器只会下载 unicode-range 命中的片，所以首屏通常只取 A（有时 +B）。

用法（需要 fontTools + brotli，Python 3.10+）：
    pip install fontTools brotli          # 或装到独立目录后用 PYTHONPATH 指过去
    python scripts/subset-noto-serif-tc.py
源数据（16.8MB 可变字体 + 字频表 + 通用规范字表）会自动下载到 ..\\fonts\\raw\\，不入库。

产物：public/fonts/noto-serif-tc/  （nstc-hot.woff2 / nstc-mid.woff2 / nstc-ext.woff2
      + noto-serif-tc.css（含 unicode-range）+ OFL.txt），index.html 已 link 该 css。
重跑幂等：会先删掉该目录里上一次生成的 nstc-*.woff2 再重切。
"""
from __future__ import annotations

import csv
import json
import os
import re
import sys
import time
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
BLOG = os.path.dirname(HERE)
ROOT = os.path.dirname(BLOG)
RAW = os.path.join(ROOT, "fonts", "raw")
OUT_DIR = os.path.join(BLOG, "public", "fonts", "noto-serif-tc")

FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/notoseriftc/NotoSerifTC%5Bwght%5D.ttf"
FONT_FILE = os.path.join(RAW, "NotoSerifTC-var.ttf")
FREQ_URL = "https://raw.githubusercontent.com/ruddfawcett/hanziDB.csv/master/hanzi_db.csv"
FREQ_FILE = os.path.join(RAW, "hanzi_db.csv")
LEVEL_URL = "https://raw.githubusercontent.com/shengdoushi/common-standard-chinese-characters-table/master/level-%d.txt"
LEVEL_FILES = [os.path.join(RAW, f"chars-level-{i}.txt") for i in (1, 2, 3)]
# 简→繁映射（OpenCC 的 STCharacters）：用来生成「繁体字补充片」，让正文里偶尔出现的繁体字也用同一套字形
TRAD_URL = "https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/STCharacters.txt"
TRAD_FILE = os.path.join(RAW, "opencc-STCharacters.txt")

COMMON_END = 3500     # 片 common 收的频率排名上限（一把常用字，避免被少数冷字拖下整片）
EXT_PARTS = 4         # 生僻字片再均分成几片（命中一两个冷字时只下其中一片）
TRAD_PARTS = 2        # 繁体补充片均分成几片
FAMILY = "Noto Serif TC"

# 线上（Supabase）内容也扫一遍：文章/关于/留言里出现过的字必须进 common 片，
# 否则页面里冒出**一个**未收录的字，就会把一整片 1MB 级的生僻字片拽下来（2026-09-13 实测踩到：瞳、蹩）
SUPABASE_TS = os.path.join(BLOG, "src", "lib", "supabase.ts")
ONLINE_TABLES = [
    "articles", "about_versions", "site_text", "comments", "novels",
    "novel_chapters", "gallery", "friend_links", "profiles",
]

# 标点/数字/拉丁/常见符号：正文离不开，一律并入片 A
PUNCT = (
    "".join(chr(c) for c in range(0x20, 0x7F))
    + "　、。，．·：；？！…—～‘’“”「」『』（）〈〉《》【】〔〕〖〗￥＄＃＠＆＊＋－／％＝"
    + "①②③④⑤⑥⑦⑧⑨⑩℃±×÷≈≠≤≥∞√∑∏∫°′″§¶†‡•‰"
)
PUNCT = "".join(dict.fromkeys(PUNCT))

# 站点内容里出现、但不在简体字频表/规范表里的小撮字（日式汉字、异体字；例如文章里的「藤咲私立高中」）
EXTRA_CHARS = "咲涼々〆ヶ辻畑峠働榊雫凪髙﨑壹贰叁肆"


def fetch(url: str, path: str) -> None:
    if os.path.exists(path) and os.path.getsize(path) > 1024:
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    print(f"  下载 {url.rsplit('/', 1)[-1]} …")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
        f.write(r.read())
    print(f"    → {path} ({os.path.getsize(path) / 1048576:.1f}MB)")


def load_inputs() -> tuple[list[str], set[str]]:
    fetch(FONT_URL, FONT_FILE)
    fetch(FREQ_URL, FREQ_FILE)
    fetch(TRAD_URL, TRAD_FILE)
    for i, p in zip((1, 2, 3), LEVEL_FILES):
        fetch(LEVEL_URL % i, p)

    rows = list(csv.DictReader(open(FREQ_FILE, encoding="utf-8")))
    freq = [r["character"].strip() for r in rows if r.get("character", "").strip()]
    levels: set[str] = set()
    for p in LEVEL_FILES:
        levels |= {ch for ch in open(p, encoding="utf-8").read() if 0x3400 <= ord(ch) <= 0x9FFF}
    return freq, levels


def scan_source_chars() -> set[str]:
    """扫描 blog/src 下所有文本文件里的汉字 —— 站点自己的用字（站名「呓语集」、人物名等）不进常用片会掉系统字体"""
    out: set[str] = set()
    src = os.path.join(BLOG, "src")
    for dirpath, _dirnames, filenames in os.walk(src):
        for fn in filenames:
            if os.path.splitext(fn)[1] not in {".ts", ".tsx", ".css", ".html"}:
                continue
            try:
                text = open(os.path.join(dirpath, fn), encoding="utf-8").read()
            except UnicodeDecodeError:
                continue
            out |= {ch for ch in text if 0x3400 <= ord(ch) <= 0x9FFF}
    return out


def fetch_online_chars() -> set[str]:
    """抓线上 Supabase 各表所有文本字段里的汉字；解析不到配置或网络不通就只警告，不阻断。"""
    try:
        text = open(SUPABASE_TS, encoding="utf-8").read()
        url = re.search(r"https://[a-z0-9]+\.supabase\.co", text).group(0)
        key = re.search(r"(eyJ[A-Za-z0-9_\-\.]{40,}|sb_publishable_[A-Za-z0-9_\-]+)", text).group(0)
    except Exception:
        print("  ⚠ 没从 src/lib/supabase.ts 解析到 Supabase 地址/密钥，跳过线上用字")
        return set()

    found: set[str] = set()
    got: list[str] = []

    def walk(o):
        if isinstance(o, str):
            found.update(ch for ch in o if 0x3400 <= ord(ch) <= 0x9FFF)
        elif isinstance(o, dict):
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    for table in ONLINE_TABLES:
        try:
            req = urllib.request.Request(
                f"{url}/rest/v1/{table}?select=*&limit=500",
                headers={"apikey": key, "Authorization": f"Bearer {key}", "User-Agent": "Mozilla/5.0"},
            )
            with urllib.request.urlopen(req, timeout=60) as r:
                walk(json.loads(r.read().decode("utf-8")))
            got.append(table)
        except Exception:
            continue
    print(f"  线上用字：抓到 {len(got)} 张表（{', '.join(got) if got else '无'}）共 {len(found)} 个汉字")
    return found


def split_into(chars: set[str], parts: int, rank: dict[int, int]) -> list[set[str]]:
    """按字频排名（表外的按码位）均分成 parts 份：命中一两个冷字时只下其中一小片"""
    ordered = sorted(chars, key=lambda c: (rank.get(ord(c), 10**6), ord(c)))
    size = max(1, (len(ordered) + parts - 1) // parts)
    return [set(ordered[i : i + size]) for i in range(0, len(ordered), size)]


def load_trad_map(simplified: set[str]) -> set[str]:
    """读 OpenCC 的简→繁表，返回 simplified 里那些字对应的所有繁体/异体字"""
    out: set[str] = set()
    for line in open(TRAD_FILE, encoding="utf-8"):
        parts = line.split()
        if len(parts) < 2:
            continue
        src, targets = parts[0], parts[1:]
        if src in simplified:
            out |= {t for t in targets if 0x3400 <= ord(t) <= 0x9FFF}
    return out


def unicode_range_text(chars: set[str], per_line: int = 8) -> str:
    """把码位集合压成 unicode-range 文本（合并连续区间）

    注意：分行时**每行末尾必须保留逗号**——少了逗号整条 unicode-range 声明会被浏览器丢弃，
    三个片就都变成「覆盖全部字符」，浏览器会为缺字逐个片下载，等于白切（2026-09-13 踩过）。
    """
    cps = sorted(ord(c) for c in chars)
    ranges: list[tuple[int, int]] = []
    for cp in cps:
        if ranges and cp == ranges[-1][1] + 1:
            ranges[-1] = (ranges[-1][0], cp)
        else:
            ranges.append((cp, cp))
    items = [f"U+{a:04X}" if a == b else f"U+{a:04X}-{b:04X}" for a, b in ranges]
    lines = []
    for i in range(0, len(items), per_line):
        chunk = ",".join(items[i : i + per_line])
        if i + per_line < len(items):
            chunk += ","
        lines.append("    " + chunk)
    return "\n".join(lines)


def subset_slice(chars: set[str], out_name: str, label: str) -> tuple[str, int]:
    t0 = time.time()
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.name_legacy = True
    opts.drop_tables += ["DSIG", "gasp", "hdmx", "LTSH", "VDMX", "meta"]
    opts.recalc_bounds = False
    opts.notdef_outline = True
    font = subset.load_font(FONT_FILE, opts)
    s = subset.Subsetter(options=opts)
    s.populate(unicodes={ord(c) for c in chars})
    s.subset(font)
    out = os.path.join(OUT_DIR, out_name)
    subset.save_font(font, out, opts)
    font.close()

    # 校验：可变轴与几个字重都还在
    check = TTFont(out, lazy=True)
    axes = {a.axisTag: (a.minValue, a.maxValue) for a in check["fvar"].axes} if "fvar" in check else {}
    check.close()
    size = os.path.getsize(out)
    print(
        f"  {label:<22} {len(chars):>5} 字 → {out_name:<15} {size / 1024:7.1f}KB  "
        f"轴={axes}  ({time.time() - t0:.1f}s)"
    )
    return out_name, size


def main() -> int:
    print("== 准备源数据 ==")
    freq, levels = load_inputs()
    print(f"  频率表 {len(freq)} 字；《通用规范汉字表》一~三级 {len(levels)} 字")

    site_chars = scan_source_chars()
    online_chars = fetch_online_chars()
    rank = {ord(c): i + 1 for i, c in enumerate(freq)}

    set_common = (
        set(freq[:COMMON_END]) | set(PUNCT) | set(EXTRA_CHARS) | site_chars | online_chars
    )
    set_ext = levels - set_common
    # 片 trad：常用简体字 + 站点/线上用字对应的繁体字 —— 正文偶尔写繁体时也不掉回系统字体
    set_trad = (
        load_trad_map(set(freq[:COMMON_END]) | site_chars | online_chars | set(EXTRA_CHARS))
        - set_common
        - set_ext
    )

    os.makedirs(OUT_DIR, exist_ok=True)
    for f in os.listdir(OUT_DIR):
        if f.startswith("nstc-"):
            os.remove(os.path.join(OUT_DIR, f))

    print(f"  源码用字 {len(site_chars)} + 线上用字 {len(online_chars)} 已并入 common 片")
    print("== 切片（可变字体，wght 200~900 全字重）==")
    slices: list[tuple[str, set[str], str]] = [("common", set_common, "片common 常用+站点线上字")]
    for i, part in enumerate(split_into(set_ext, EXT_PARTS, rank), 1):
        slices.append((f"ext{i}", part, f"片ext{i} 生僻字"))
    for i, part in enumerate(split_into(set_trad, TRAD_PARTS, rank), 1):
        slices.append((f"trad{i}", part, f"片trad{i} 繁体补充"))
    built = []
    for key, chars, label in slices:
        name, size = subset_slice(chars, f"nstc-{key}.woff2", label)
        built.append((key, chars, name, size))

    css = [
        "/* 自托管思源宋体 TC（Noto Serif TC / Source Han Serif TC，OFL 1.1）",
        " * 由 scripts/subset-noto-serif-tc.py 按字频切片生成，勿手改。",
        " * 每片都是可变字体（wght 200~900 一片管全部字重），浏览器按 unicode-range 只取命中的片：",
        # ⚠ 注释正文里绝对不能出现「星号紧跟斜杠」：那会提前结束这一大段注释，
        # 余下的散字会被 CSS 解析器当成选择器，把紧随其后的**第一个** @font-face 整块吞掉
        # （2026-09-14 踩到：common 片就是这么在浏览器里消失的，Chrome/Safari 都一样）。
        " * common 是首屏必下的那一片（常用字 + 站点/线上用字），ext、trad 片只有真的遇到对应字才下载。",
        " * 片外的生僻字会回退到站点字体栈里的系统衬线。许可原文见同目录 OFL.txt。",
        " */",
    ]
    for key, chars, name, _ in built:
        css.append(
            "@font-face {\n"
            f"  font-family: '{FAMILY}';\n"
            "  font-style: normal;\n"
            "  font-weight: 200 900;\n"
            "  font-display: swap;\n"
            f"  src: url('/fonts/noto-serif-tc/{name}') format('woff2');\n"
            f"  unicode-range:\n{unicode_range_text(chars)};\n"
            "}"
        )
    css_path = os.path.join(OUT_DIR, "noto-serif-tc.css")
    text = "\n".join(css) + "\n"

    # 自检（2026-09-14 补）：注释必须**恰好**一对 /* */，且第一个 @font-face 之前除了这对注释没有别的活代码。
    # 一旦注释提前结束，多出来的散字会当选择器把第一个 @font-face 整块吞掉，浏览器里就少一片（common 片＝白切）。
    if text.count("/*") != 1 or text.count("*/") != 1:
        raise SystemExit("✗ 生成的 CSS 注释符数量不对：注释提前结束会吞掉第一个 @font-face，已中止")
    first_face = text.index("@font-face")
    if text[:first_face].count("*/") != 1 or text[:first_face].rstrip().endswith("*/") is False:
        raise SystemExit("✗ 第一个 @font-face 前面有游离代码，会被 CSS 解析器吞掉，已中止")

    with open(css_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)

    total = sum(s for *_, s in built)
    print(f"\n== 完成 ==\n  CSS: {os.path.relpath(css_path, BLOG)}  （{os.path.getsize(css_path) / 1024:.0f}KB）")
    print(f"  共 {len(built)} 片合计 {total / 1048576:.2f}MB；首屏只下 common 片（{built[0][3] / 1024:.0f}KB），"
          f"遇到生僻字/繁体字才会另取一小片（约 {built[1][3] / 1024:.0f}KB）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
