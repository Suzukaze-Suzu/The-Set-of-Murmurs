#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
按字频切片，自托管思源宋（Noto Serif TC 为主 + Noto Serif SC 补字，OFL 1.1）

为什么不用 Google 的分片：2026-09-13 实测，直搬 Google Fonts 的 108 片/字重方案，
呓语集首页正文只有 407 个不同汉字，浏览器却按 unicode-range 拉了 110 个分片 / 7.78MB
（受控 400 汉字探针 90 片 / 5.82MB）——它的分片不按字频聚合，常用字也散落在几十片里。
本脚本改为自己按字频切（可变字体，一片覆盖 wght 200~900 全部字重）：

  片 common（首屏必下）频率前 3500 字 + 标点/拉丁 + **站点自有用字**  ≈ 1.0MB
  片 ext（生僻字才下）《通用规范汉字表》一~三级其余                  ≈ 1.2MB
  片 trad（写繁体才下）常用简体字对应的繁体字                        ≈ 1.3MB
  片 fill（补字，**必需**）TC 字集里没有的简体字，由 Noto Serif SC 补  见构建输出

⚠️ 为什么必须有 fill 片（2026-09-17 踩到的大坑）：
Google Fonts 的 Noto Serif TC **只收繁体字集**（源文件 cmap 仅 20748 码位），
「呓 语 这 来 为 说 时 写 过 题 数 对 图 开 记 话 录 …」这些简体字它根本没有字形。
第一版脚本把「请求的字集」直接写进了 CSS unicode-range，而 pyftsubset 对源字体里
不存在的字是**静默丢弃**——于是 woff2 里声明了 3735 字、实际只有 2837 字：
- 桌面端这些字会回退到本机装着的思源宋/系统宋体，肉眼几乎看不出；
- 手机端（安卓/鸿蒙没有中文衬线）回退成黑体，于是「部分文字在手机端不兼容」。
修法＝① 每片的 unicode-range 改成**照产物真实 cmap 写**（不许照请求字集写）；
        ② TC 缺的字用 Noto Serif SC 另切 fill 片补上（同一套思源宋设计，字重轴一致）。
fill1 专收「站点源码 + 线上 Supabase 内容」用到的缺字，首屏要 preload；
其余缺字按字频再均分几片，只有当正文真出现冷僻字时才按需下载。

浏览器只会下载 unicode-range 命中的片，所以首屏通常只取 common（+ fill1）。

用法（需要 fontTools + brotli，Python 3.10+）：
    pip install fontTools brotli          # 或装到独立目录后用 PYTHONPATH 指过去
    python scripts/subset-noto-serif-tc.py
源数据（16.8MB TC 可变字体 + SC 可变字体 + 字频表 + 通用规范字表）会自动下载到 ..\\fonts\\raw\\，不入库。

产物：public/fonts/noto-serif-tc/  （nstc-common.woff2 / nstc-ext1~4.woff2 / nstc-trad1~2.woff2
      / nstc-fill1~N.woff2 + noto-serif-tc.css（含 unicode-range）+ OFL.txt），index.html 已 link 该 css。
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
# 补字源：思源宋 SC（Google 的 Noto Serif TC 只收繁体字集，简体字得从 SC 版补）
SC_FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf"
SC_FONT_FILE = os.path.join(RAW, "NotoSerifSC-var.ttf")
FREQ_URL = "https://raw.githubusercontent.com/ruddfawcett/hanziDB.csv/master/hanzi_db.csv"
FREQ_FILE = os.path.join(RAW, "hanzi_db.csv")
LEVEL_URL = "https://raw.githubusercontent.com/shengdoushi/common-standard-chinese-characters-table/master/level-%d.txt"
LEVEL_FILES = [os.path.join(RAW, f"chars-level-{i}.txt") for i in (1, 2, 3)]
# 简→繁映射（OpenCC 的 STCharacters）：用来生成「繁体字补充片」，让正文里偶尔出现的繁体字也用同一套字形
TRAD_URL = "https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/STCharacters.txt"
TRAD_FILE = os.path.join(RAW, "opencc-STCharacters.txt")

# 字体版本号：vercel.json 给 *.woff2 配了一年 immutable，同名文件在访客设备上会留很久。
# 所以 CSS 里的 woff2 URL 和 index.html 的 preload 都带 ?v=（**两处必须同一个号**，否则会重复下载），
# 只要重切字体或改动分片内容，就把这个号 +1，老访客自然会拿到一整套一致的新文件。
# v2＝2026-09-14 修「注释吞掉 common 片」时的 CSS 版本；v3＝2026-09-17 补字片；
# v4＝2026-09-19 全量汉字（国标之外的冷僻字/异体字）+ 符号片（用户原话「字体太少了，有好多文字无法显示」）。
FONT_VERSION = 4

COMMON_END = 3500     # 片 common 收的频率排名上限（一把常用字，避免被少数冷字拖下整片）
EXT_PARTS = 4         # 生僻字片再均分成几片（命中一两个冷字时只下其中一片）
TRAD_PARTS = 2        # 繁体补充片均分成几片
FILL_PARTS = 2        # 补字片的「其余缺字」再均分几片（fill1 永远是站点真用到的那些字）
FAMILY = "Noto Serif TC"

# ---- 2026-09-19 全量汉字（用户抉择 B：「A + 汉字全量（15958 字）」）----
# 起因：查覆盖率时发现，交付片里汉字只有 9322 个，而**国标《通用规范汉字表》一~三级 7909 字早就全覆盖**，
# 也就是说缺的必然是国标之外的冷僻字/异体字/罕用繁体（实测源字体里还有 18262 个基本区汉字没交付）。
# 现在把 TC|SC 两个源字体里**全部基本区汉字（27584）**都切出来，冷僻字再也不掉系统字体。
#
# 体积与首屏的关系（关键设计）：全量约 9.8MB，**绝不能一股脑塞进首屏**。
#   · 按字频把冷僻字切成 LONGFORM_PARTS 片（每片约 1.6MB 里的一小块），
#     浏览器只在页面**真的出现**某个字时，才按 unicode-range 拉它所在的那一片 —— 首页一个冷僻字都没有时，这片一分钱不花。
#   · 首屏仍然只 preload common（常用+站点线上用字）+ fill1（TC 缺的简体字补片）+ symbol1（符号片）。
#   · 因此 total 体积变大，但**首屏体积基本不变**，代价只体现在「正文真出现冷僻字时那一次多下几百 KB」。
LONGFORM_PARTS = 24   # 国标之外冷僻字的均分片数（按字频排，常用的排前面、先被下到）
SYMBOLS = True        # 符号片：标点/箭头/带圈数字/几何/杂项符号/全角/CJK 标点（2026-09-19 加）

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

# 扫描过程中顺手记下的「站点源码 + 线上内容里真正出现过的非汉字字符」（不参与汉字切片，只喂符号片）
NON_CJK_SEEN: set[str] = set()

# ---- 符号片（2026-09-19 加，起因见上面 LONGFORM_PARTS 的说明）----
# 为什么单独切：站点界面里有一批**非汉字**字符（★ ☆ ✓ → ↓ ↑ ▶ ‹ › − » ▪ ─ ⋯ ⚠ 等）不在 PUNCT 里，
# 于是它们从不进托管片，只能回退系统字体。实测源字体（思源宋）里除「✕(U+2715)」外全都有字形，
# 所以把下面这些码位段一次切进托管片，符号也不用再赌设备有没有装。
# ⚠ 码位段一律**先与源字体 cmap 求交**再切，否则会造出「声明了却没有字形」的假覆盖（2026-09-17 的坑）。
SYMBOL_RANGES = [
    (0x2000, 0x206F),  # 通用标点（– — ’ “ ” … ‰ 等）
    (0x2070, 0x209F),  # 上下标
    (0x20A0, 0x20BF),  # 货币符号
    (0x2100, 0x214F),  # 字母式符号（№ ™ Ω 等）
    (0x2150, 0x218F),  # 数字形式（①② Ⅰ ½ 等）
    (0x2190, 0x21FF),  # 箭头（← → ↑ ↓ ↔ 等）
    (0x2200, 0x22FF),  # 数学运算符（− ≠ ≤ ∞ ∑ 等）
    (0x2300, 0x23FF),  # 杂项技术符号（⌘ ⌛ 等）
    (0x2460, 0x24FF),  # 带圈字母数字
    (0x25A0, 0x25FF),  # 几何图形（▪ ▶ ◆ ● 等）
    (0x2600, 0x26FF),  # 杂项符号（★ ☆ ⚠ ♪ 等）
    (0x2700, 0x27BF),  # 装饰符号（✓ ✗ ➜ 等）
    (0x2E00, 0x2E7F),  # 补充标点
    (0x3000, 0x303F),  # CJK 标点（、。「」〈〉《》等）
    (0xFE30, 0xFE4F),  # CJK 兼容形式（﹏ 等）
    (0xFF00, 0xFFEF),  # 全角 ASCII 与全角标点
    # 2026-09-19 第二轮：下面三段是「正文/留言里真的出现过、源字体也真有字形」的，一并收进来
    (0x02B0, 0x02FF),  # 修饰字母（˙ ˉ ˊ 等，留言里的语气符号）
    (0x0370, 0x03FF),  # 希腊字母（ω π Ω 等，数学/留言里出现）
    (0x3040, 0x30FF),  # 日文平假名+片假名（タ ケ 等，文章标题里有）
]
# ⚠ 故意**不收 emoji**（U+1F300 以上与 ✕ U+2715 这类）：emoji 应当交回系统字体，
#   一旦收进思源宋，iPhone 上原本彩色的 emoji 会被换成单色字形，反而更糟。
#   ✕(U+2715) 则是两个源字体都真的没有字形（实测），只能回退系统字体。


def fetch(url: str, path: str) -> None:
    if os.path.exists(path) and os.path.getsize(path) > 1024:
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    print(f"  下载 {url.rsplit('/', 1)[-1]} …")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
        f.write(r.read())
    print(f"    → {path} ({os.path.getsize(path) / 1048576:.1f}MB)")


def cmap_of(path: str) -> set[int]:
    """字体文件里**真实存在**的码位集合（unicode-range 必须照它写，不许照请求的字集写）"""
    font = TTFont(path, lazy=True)
    cps: set[int] = set()
    for table in font["cmap"].tables:
        cps.update(table.cmap.keys())
    font.close()
    return cps


def load_inputs() -> tuple[list[str], set[str]]:
    fetch(FONT_URL, FONT_FILE)
    fetch(SC_FONT_URL, SC_FONT_FILE)
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
            # 顺手收集非汉字字符（含 emoji、符号）供符号片对账用，见 SYMBOL_RANGES 的说明
            NON_CJK_SEEN.update(ch for ch in text if ord(ch) > 0x20 and not (0x3400 <= ord(ch) <= 0x9FFF))
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
            NON_CJK_SEEN.update(ch for ch in o if ord(ch) > 0x20 and not (0x3400 <= ord(ch) <= 0x9FFF))
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


def unicode_range_text(cps: set[int], per_line: int = 8) -> str:
    """把码位集合压成 unicode-range 文本（合并连续区间）

    注意：分行时**每行末尾必须保留逗号**——少了逗号整条 unicode-range 声明会被浏览器丢弃，
    各片就都变成「覆盖全部字符」，浏览器会为缺字逐个片下载，等于白切（2026-09-13 踩过）。
    """
    ranges: list[tuple[int, int]] = []
    for cp in sorted(cps):
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


def subset_slice(src_file: str, chars: set[str], out_name: str, label: str) -> tuple[str, int, set[int]]:
    """切一片，返回 (文件名, 字节数, 产物里真实存在的码位集合)

    ⚠️ 返回值里的码位集合是**产物自己的 cmap**：请求的字集里源字体没有的字会被 pyftsubset
    静默丢掉，所以 unicode-range 只能照产物写（2026-09-17 的「手机端部分文字不兼容」就是这么来的）。
    """
    t0 = time.time()
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.name_legacy = True
    opts.drop_tables += ["DSIG", "gasp", "hdmx", "LTSH", "VDMX", "meta"]
    opts.recalc_bounds = False
    opts.notdef_outline = True
    font = subset.load_font(src_file, opts)
    s = subset.Subsetter(options=opts)
    s.populate(unicodes={ord(c) for c in chars})
    s.subset(font)
    out = os.path.join(OUT_DIR, out_name)
    subset.save_font(font, out, opts)
    font.close()

    actual = cmap_of(out)
    dropped = len(chars) - sum(1 for c in chars if ord(c) in actual)
    # 校验：可变轴还在
    check = TTFont(out, lazy=True)
    axes = {a.axisTag: (a.minValue, a.maxValue) for a in check["fvar"].axes} if "fvar" in check else {}
    check.close()
    size = os.path.getsize(out)
    print(
        f"  {label:<26} 请求{len(chars):>5} 字 → {out_name:<19} {size / 1024:7.1f}KB  "
        f"实际字形{len(actual):>5}"
        + (f"  ⚠ 源字体没有 {dropped} 字" if dropped else "")
        + f"  轴={axes}  ({time.time() - t0:.1f}s)"
    )
    return out_name, size, actual


def main() -> int:
    print("== 准备源数据 ==")
    freq, levels = load_inputs()
    print(f"  频率表 {len(freq)} 字；《通用规范汉字表》一~三级 {len(levels)} 字")

    tc_cmap = cmap_of(FONT_FILE)
    sc_cmap = cmap_of(SC_FONT_FILE)
    print(f"  TC 源字体字集 {len(tc_cmap)} 码位；SC 源字体字集 {len(sc_cmap)} 码位")

    site_chars = scan_source_chars()
    online_chars = fetch_online_chars()
    rank = {ord(c): i + 1 for i, c in enumerate(freq)}

    set_common = (
        set(freq[:COMMON_END]) | set(PUNCT) | set(EXTRA_CHARS) | site_chars | online_chars
    )
    # 符号片：先取码位段，再**只留两个源字体里真有字形的**（否则又会出现「声明却没字形」）
    # 2026-09-19 第二轮修正：光靠码位段总会漏掉散例（实测漏过 ─(U+2500) »(U+00BB)），
    # 所以这里再补一刀「站点源码 + 线上内容里真正出现过的非汉字字符」——
    # 码位段管通用面，用字集管散例，两者并起来才不漏。
    set_symbol = set()
    if SYMBOLS:
        for lo, hi in SYMBOL_RANGES:
            set_symbol |= {chr(cp) for cp in range(lo, hi + 1)}
        set_symbol |= {c for c in (PUNCT + EXTRA_CHARS)}          # 已有的标点白名单
        set_symbol |= NON_CJK_SEEN                                # 站点/线上真用到的非汉字字符（散例就靠这条兜住）
        # 汉字本身由 common/ext/trad/long 负责，符号片只管非汉字（避免与汉字片争码位）
        set_symbol = {c for c in set_symbol if not (0x3400 <= ord(c) <= 0x9FFF)}
        # emoji（U+1F300 以上）一律留给系统字体：收进思源宋会把 iPhone 的彩色 emoji 换成单色字形
        set_symbol = {c for c in set_symbol if ord(c) < 0x1F300}
        set_symbol = {c for c in set_symbol if ord(c) in tc_cmap or ord(c) in sc_cmap}
        set_symbol -= set_common

    set_ext = levels - set_common - set_symbol
    # 片 trad：常用简体字 + 站点/线上用字对应的繁体字 —— 正文偶尔写繁体时也不掉回系统字体
    set_trad = (
        load_trad_map(set(freq[:COMMON_END]) | site_chars | online_chars | set(EXTRA_CHARS))
        - set_common
        - set_symbol
        - set_ext
    )
    # 片 longform：国标之外的全部冷僻字/异体字/罕用繁体（2026-09-19 全量覆盖）
    # 目标＝TC|SC 两个源字体里**所有基本区汉字**，已有分片覆盖的扣掉，剩下的按字频均分
    all_cjk = {chr(cp) for cp in (tc_cmap | sc_cmap) if 0x3400 <= cp <= 0x9FFF}
    set_longform = all_cjk - set_common - set_symbol - set_ext - set_trad

    os.makedirs(OUT_DIR, exist_ok=True)
    for f in os.listdir(OUT_DIR):
        if f.startswith("nstc-"):
            os.remove(os.path.join(OUT_DIR, f))

    print(f"  源码用字 {len(site_chars)} + 线上用字 {len(online_chars)} 已并入 common 片")
    if SYMBOLS:
        print(f"  符号片要切的码位 {len(set_symbol)} 个（源字体里真有字形的）")
    print(f"  全量冷僻字分片：源字体可用基本区汉字 {len(all_cjk)}，扣掉已有分片后剩 {len(set_longform)} 个")
    print("== 切片（可变字体，wght 200~900 全字重）==")
    # 顺序＝CSS 里 @font-face 的声明顺序：首屏那几片排最前，便于阅读生成的 CSS
    slices: list[tuple[str, set[str], str]] = []
    if set_symbol:
        slices.append(("symbol1", set_symbol, "片symbol1 符号/标点"))
    slices.append(("common", set_common, "片common 常用+站点线上字"))
    for i, part in enumerate(split_into(set_ext, EXT_PARTS, rank), 1):
        slices.append((f"ext{i}", part, f"片ext{i} 生僻字"))
    for i, part in enumerate(split_into(set_trad, TRAD_PARTS, rank), 1):
        slices.append((f"trad{i}", part, f"片trad{i} 繁体补充"))
    if set_longform:
        parts = split_into(set_longform, LONGFORM_PARTS, rank)
        for i, part in enumerate(parts, 1):
            slices.append((f"long{i}", part, f"片long{i} 冷僻字全量 {i}/{len(parts)}"))

    built: list[tuple[str, set[int], str, int, str]] = []   # (key, 真实码位, 文件名, 字节, 源)
    residual: set[str] = set()
    for key, chars, label in slices:
        name, size, actual = subset_slice(FONT_FILE, chars, f"nstc-{key}.woff2", label)
        built.append((key, actual, name, size, "TC"))
        residual |= {c for c in chars if ord(c) not in actual}

    # ---- 补字片：TC 字集里没有的简体字，从 SC 字体切 ----
    # ⚠ 全量模式下「其余缺字」可能上万，但它分成 long* 片时就已按字频均分过，
    #   这里保持原样：fill1 永远是「站点/线上真用到的缺字」，因为 index.html 会 preload 它。
    print("== 补字片（TC 字集缺失的简体字，源＝Noto Serif SC）==")
    fill_used = {c for c in residual if c in site_chars or c in online_chars}
    fill_rest = residual - fill_used
    # 其余缺字按字频均分成与冷僻片同一量级的小片（片名沿用 fill2.. 保证老链接不失效）
    fill_parts = max(FILL_PARTS, LONGFORM_PARTS) if fill_rest else FILL_PARTS
    fill_slices: list[tuple[str, set[str], str]] = []
    n = 1
    if fill_used:
        fill_slices.append(("fill1", fill_used, "片fill1 站点/线上用到的缺字"))
        n = 2
    for part in split_into(fill_rest, fill_parts, rank):
        fill_slices.append((f"fill{n}", part, f"片fill{n} 其余缺字"))
        n += 1

    for key, chars, label in fill_slices:
        name, size, actual = subset_slice(SC_FONT_FILE, chars, f"nstc-{key}.woff2", label)
        built.append((key, actual, name, size, "SC"))
        if label.endswith("缺字"):  # 补字片理论上不该再丢字
            residual = {c for c in residual if ord(c) not in actual}

    # ---- 覆盖面自检 ----
    requested = set_common | set_ext | set_trad | set_symbol | set_longform
    covered = set().union(*(a for _, a, *_ in built))
    holes = sorted((c for c in requested if ord(c) not in covered), key=lambda c: (rank.get(ord(c), 10**6), ord(c)))
    print("\n== 覆盖面自检 ==")
    print(f"  想要的字 {len(requested)} 个；产物里真实有字形 "
          f"{sum(1 for c in requested if ord(c) in covered)} 个")
    if holes:
        print(f"  ⚠ {len(holes)} 个字两个源字体都没有（只能回退系统字体）：{''.join(holes[:120])}")
    else:
        print("  ✅ 请求的字全部在托管片里真的有字形（不会再回退系统字体）")
    cjk_total = len({c for c in covered if 0x3400 <= c <= 0x9FFF})
    print(f"  托管片里的汉字总数：{cjk_total}（全量模式目标＝源字体所有基本区汉字 {len(all_cjk)}）")

    css = [
        "/* 自托管思源宋（Noto Serif TC 为主 + Noto Serif SC 补字，OFL 1.1）",
        " * 由 scripts/subset-noto-serif-tc.py 按字频切片生成，勿手改。",
        " * 每片都是可变字体（wght 200~900 一片管全部字重），浏览器按 unicode-range 只取命中的片：",
        # ⚠ 注释正文里绝对不能出现「星号紧跟斜杠」：那会提前结束这一大段注释，
        # 余下的散字会被 CSS 解析器当成选择器，把紧随其后的**第一个** @font-face 整块吞掉
        # （2026-09-14 踩到：common 片就是这么在浏览器里消失的，Chrome/Safari 都一样）。
        " * common 是首屏必下的那一片（常用字 + 站点/线上用字），ext、trad 片只有真的遇到对应字才下载。",
        " * fill 片是补字片：Google 版 Noto Serif TC 只收繁体字集，简体字（呓/语/这/为…）它没有字形，",
        " * 由 Noto Serif SC 补切；fill1 专收站点真用到的那些字，首屏要一起下，其余按需取。",
        " * 所有 unicode-range 都照产物真实 cmap 写，绝不允许「声明了却没有字形」。",
        f" * 各片 URL 都带 ?v={FONT_VERSION}（一年 immutable 缓存，改内容就靠它换血）：",
        f" * index.html 里的 preload 必须引用同一个 ?v={FONT_VERSION}，否则同一份文件会被下载两次。",
        " */",
    ]
    for key, actual, name, _size, source in built:
        css.append(
            "@font-face {\n"
            f"  font-family: '{FAMILY}';\n"
            "  font-style: normal;\n"
            "  font-weight: 200 900;\n"
            "  font-display: swap;\n"
            f"  src: url('/fonts/noto-serif-tc/{name}?v={FONT_VERSION}') format('woff2');\n"
            f"  unicode-range:\n{unicode_range_text(actual)};\n"
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

    total = sum(s for *_, s, _ in built)
    # 首屏必下的片＝common（常用+站点线上用字）+ fill1（TC 缺的简体字补片）+ symbol1（界面符号/标点）
    # index.html 里的 preload 必须就是这几个，改这里要同步改 index.html（见文件末尾打印）
    first = [b for b in built if b[0] in ("common", "fill1", "symbol1")]
    print(f"\n== 完成 ==\n  CSS: {os.path.relpath(css_path, BLOG)}  （{os.path.getsize(css_path) / 1024:.0f}KB）")
    print(f"  共 {len(built)} 片合计 {total / 1048576:.2f}MB")
    print("  首屏必下：" + " + ".join(f"{k} {s / 1024:.0f}KB" for k, _a, _n, s, _src in first)
          + f" ≈ {sum(s for *_, s, _ in first) / 1024:.0f}KB")
    print("  其余按 unicode-range 按需取（正文出现哪个片里的字，才下那一片）。")
    print("  ⚠ index.html 需要的 preload：")
    for k, _a, n, _s, _src in first:
        print(f'      <link rel="preload" as="font" type="font/woff2" href="/fonts/noto-serif-tc/{n}?v={FONT_VERSION}" crossorigin />')
    return 0


if __name__ == "__main__":
    sys.exit(main())
