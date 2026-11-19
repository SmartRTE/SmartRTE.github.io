#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 Arcaea APK 中提取缺失的曲目曲绘（170x170 / JPEG 质量70）与角色头像（170x170 / WebP 保留 alpha）。

用法：
    python extract_jackets.py <apk文件> [<apk文件> ...] [--size 170] [--quality 70]
                             [--avatar-size 170] [--avatar-quality 90]
                             [--skip-jackets] [--skip-avatars] [--dry-run]

文件来源：只接受显式上传 / 传入的 APK 路径，不再从 sample 等目录自动读取。
  - 命令行参数传入（可传多个，也可直接把 APK 拖到脚本上）
  - 不传参数时弹出文件选择窗口（可多选）

每个 APK 的处理顺序：
  1) 先把 APK 内的 songlist / packlist 整文件复制到 json 目录（覆盖旧版本）；
  2) 再以"刚刚复制过来的最新 songlist"为基准，派生本次需要的曲绘清单；
  3) 只对 Processed_Illustration 中缺失的曲绘做提取、缩放、重新编码；
  4) 再扫描 assets/char/*_icon.png，与 sample/avatar.csv 比对后补齐缺失头像。

曲绘清单由 songlist 派生：
  - 普通难度的曲绘 -> <songId>.jpg
    APK 内对应 assets/songs/<songId>/ 或 assets/songs/dl_<songId>/ 下的 1080_base.jpg（兼容 base.jpg）
  - jacketOverride 难度（如 BYD 特殊曲绘）-> <songId>_<ratingClass>.jpg
    APK 内对应同目录下的 1080_<ratingClass>.jpg

头像清单：
  - APK 内 assets/char/ 下所有以 _icon.png 结尾的文件（如 12u_icon.png）；
  - 排除前缀以 o 结尾的（0o_icon、1o_icon 这类），既不提取也不登记；
  - sample/avatar.csv 每行只存文件名前半段（去掉 _icon.png，如 12u），与之比对；
  - 缺失的先转成保留 alpha 通道的 WebP、缩放到 170x170，写入 img/avatar/<name>_icon.webp；
  - 处理完把新条目按自然序追加回 avatar.csv（保留原有换行风格与结尾格式）。

已存在的曲绘 / 头像会跳过，可重复运行。
"""

import argparse
import io
import json
import re
import shutil
import sys
import zipfile
from pathlib import Path

from PIL import Image

SCRIPT_DIR = Path(__file__).resolve().parent
JSON_DIR = SCRIPT_DIR / "json"
SONGLIST = JSON_DIR / "songlist"
PACKLIST = JSON_DIR / "packlist"
DEFAULT_OUT = SCRIPT_DIR / "Processed_Illustration"

SONGLIST_ENTRY = "assets/songs/songlist"
PACKLIST_ENTRY = "assets/songs/packlist"

AVATAR_DIR = SCRIPT_DIR / "img" / "avatar"
AVATAR_CSV = SCRIPT_DIR / "sample" / "avatar.csv"
AVATAR_ENTRY_PREFIX = "assets/char/"
ICON_SUFFIX = "_icon.png"
# 头像名（去掉 _icon.png 后）以此为结尾的一律排除，如 0o_icon / 1o_icon
AVATAR_EXCLUDE_TAILS = ("o",)


def build_needed(songlist_path):
    """按 songlist 的 difficulty/jacketOverride 派生所需曲绘文件名 -> (songId, ratingClass|None)"""
    try:
        with open(songlist_path, encoding="utf-8") as f:
            songs = json.load(f)["songs"]
    except Exception as e:
        sys.exit("无法解析 songlist（%s）: %s" % (songlist_path, e))
    needed = {}
    for song in songs:
        sid = song["id"]
        for d in song.get("difficulties", []):
            rc = d.get("ratingClass")
            if d.get("jacketOverride"):
                name = "%s_%s.jpg" % (sid, rc)
                needed.setdefault(name, (sid, rc))
            else:
                name = "%s.jpg" % sid
                needed.setdefault(name, (sid, None))
    return needed


def pick_apk_paths(args):
    """返回待处理的 APK 路径列表；只接受显式传入 / 上传，绝不从任何默认目录读取"""
    if args.apk:
        paths = []
        for raw in args.apk:
            p = Path(raw).expanduser()
            if not p.is_file():
                sys.exit("APK 文件不存在: %s" % p)
            paths.append(p)
        return paths

    # 没有传参 -> 弹出文件选择窗口（可多选）
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        chosen = filedialog.askopenfilenames(
            title="选择 Arcaea APK 文件（可多选）",
            initialdir=str(Path.cwd()),
            filetypes=[("APK 文件", "*.apk"), ("压缩包", "*.zip"), ("所有文件", "*.*")],
        )
        root.destroy()
    except Exception as e:
        sys.exit(
            "没有可用的图形文件选择窗口（%s）。\n"
            "请直接把 APK 路径作为参数传入，例如：\n"
            "    python extract_jackets.py \"D:/xxx/Arcaea.apk\"" % e
        )

    if not chosen:
        sys.exit("未选择 APK 文件，已取消。")
    return [Path(p) for p in chosen]


def process_one(zf, entry, out_path, size, quality):
    """读取 APK 内单张曲绘，直接缩放到 size×size，以指定质量存为 JPEG"""
    with zf.open(entry) as src:
        data = src.read()
    im = Image.open(io.BytesIO(data))
    im.load()
    if im.mode != "RGB":
        im = im.convert("RGB")
    im = im.resize((size, size), Image.LANCZOS)
    im.save(out_path, "JPEG", quality=quality, optimize=True)


def sync_metadata(zf, entry_set):
    """直接把 APK 中的 songlist / packlist 整文件复制到项目 json 目录（逐字节一致）

    返回 True 表示 songlist 已成功同步（可作为后续曲绘拉取的基准）。
    """
    specs = ((SONGLIST_ENTRY, SONGLIST), (PACKLIST_ENTRY, PACKLIST))
    songlist_ok = False
    for entry, out_path in specs:
        if entry not in entry_set:
            print("APK 中未找到 %s，跳过同步" % entry)
            continue
        try:
            out_path.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(entry) as src, open(out_path, "wb") as dst:
                shutil.copyfileobj(src, dst)
            print("已同步 %s -> %s" % (entry, out_path))
            if entry == SONGLIST_ENTRY:
                songlist_ok = True
        except Exception as e:
            print("同步 %s 失败: %s" % (entry, e))
    return songlist_ok


def collect_missing(out_dir, songlist_path):
    """以 songlist 为基准，算出输出目录里还缺哪些曲绘"""
    needed = build_needed(songlist_path)
    existing = set(p.name for p in out_dir.iterdir() if p.is_file())
    missing = {name: info for name, info in needed.items() if name not in existing}
    print("songlist 所需曲绘: %d，%s 已有: %d，缺失: %d"
          % (len(needed), out_dir, len(existing), len(missing)))
    return missing


def find_entry(entry_set, sid, rc):
    folders = ("assets/songs/%s/" % sid, "assets/songs/dl_%s/" % sid)
    if rc is None:
        for folder in folders:
            for cand in ("1080_base.jpg", "base.jpg"):
                if folder + cand in entry_set:
                    return folder + cand
    else:
        cand = "1080_%s.jpg" % rc
        for folder in folders:
            if folder + cand in entry_set:
                return folder + cand
    return None


# ---------------------------------------------------------------- 头像（assets/char）


def natural_key(name):
    """自然排序键：数字按数值比较，其余按小写字符串比较"""
    return [(1, int(t)) if t.isdigit() else (0, t.lower())
            for t in re.split(r"(\d+)", name)]


def read_avatar_csv(csv_path):
    """读取头像清单（每行一个名字，只有 _icon.webp 的前半段），返回原顺序列表"""
    if not csv_path.is_file():
        return []
    text = csv_path.read_bytes().decode("utf-8-sig")
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    return [ln.strip() for ln in lines if ln.strip()]


def append_avatar_csv(csv_path, names):
    """把新名字追加到清单末尾；沿用原文件的换行风格、BOM 与结尾无换行格式"""
    raw = csv_path.read_bytes() if csv_path.is_file() else b""
    has_bom = raw.startswith(b"\xef\xbb\xbf")
    text = raw.decode("utf-8-sig")
    eol = "\r\n" if "\r\n" in text else "\n"
    if text and not text.endswith(("\n", "\r")):
        text += eol
    text += eol.join(names)
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    csv_path.write_bytes((b"\xef\xbb\xbf" if has_bom else b"") + text.encode("utf-8"))


def is_excluded_avatar(prefix):
    """0o / 1o 这类前缀以 o 结尾的头像不参与筛选与处理"""
    return prefix.lower().endswith(AVATAR_EXCLUDE_TAILS)


def collect_avatar_entries(entry_set):
    """从 APK 条目中筛出 assets/char/*_icon.png

    返回 ({名字(不含扩展名): 条目路径}, 被排除的条目数)。
    名字前缀以 o 结尾的（0o_icon、1o_icon）直接排除。
    """
    found = {}
    excluded = 0
    for entry in entry_set:
        if not entry.lower().startswith(AVATAR_ENTRY_PREFIX):
            continue
        base = entry.rsplit("/", 1)[-1]
        if not base.lower().endswith(ICON_SUFFIX):
            continue
        stem = base[: -len(".png")]
        if len(stem) <= len("_icon"):
            continue
        if is_excluded_avatar(stem[: -len("_icon")]):
            excluded += 1
            continue
        found.setdefault(stem, entry)
    return found, excluded


def resize_avatar(im, size):
    """缩放到 size×size；先转预乘 alpha 再缩，避免透明边缘出现灰边/黑边"""
    if im.size == (size, size):
        return im
    try:
        return im.convert("RGBa").resize((size, size), Image.LANCZOS).convert("RGBA")
    except (ValueError, OSError):
        return im.resize((size, size), Image.LANCZOS)


def process_avatar(zf, entry, out_path, size, quality):
    """读取 APK 内头像 PNG，保留 alpha 通道缩放到 size×size 后存为 WebP"""
    with zf.open(entry) as src:
        data = src.read()
    im = Image.open(io.BytesIO(data))
    im.load()
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    im = resize_avatar(im, size)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    im.save(out_path, "WEBP", quality=quality, method=6)


def process_avatars(zf, entry_set, out_dir, csv_path, size, quality):
    """补齐 APK 里比 avatar.csv 多出来的头像图标，并回写清单

    返回 (新增名字列表, 清单里已有的名字列表, 失败列表[(名字, 错误)])。
    """
    icons, excluded = collect_avatar_entries(entry_set)
    listed = read_avatar_csv(csv_path)
    listed_set = set(listed)
    print("APK 内头像图标: %d 张（按规则排除 %d 张），%s 已登记: %d 条"
          % (len(icons), excluded, csv_path.name, len(listed_set)))

    new_names, existing, failed = [], [], []
    for stem in sorted(icons, key=natural_key):
        prefix = stem[: -len("_icon")]          # 12u_icon -> 12u
        if prefix in listed_set:
            existing.append(prefix)
            continue
        target = out_dir / (stem + ".webp")
        try:
            if target.is_file():                # 文件已在、只是清单没登记 -> 只补清单
                print("  已存在（仅补清单）: %s" % target.name)
            else:
                process_avatar(zf, icons[stem], target, size, quality)
                print("  新增头像: %s" % target.name)
            new_names.append(prefix)
        except Exception as e:
            failed.append((stem, str(e)))

    if new_names:
        append_avatar_csv(csv_path, sorted(new_names, key=natural_key))
        print("头像新增 %d 张，已写入 %s 并更新 %s" % (len(new_names), out_dir, csv_path))
    else:
        print("没有缺失头像，无需处理。")
    return new_names, existing, failed


# ---------------------------------------------------------------- APK 处理


def empty_result():
    return {
        "jacket_done": [], "jacket_skipped": [], "jacket_failed": [],
        "avatar_done": [], "avatar_existing": [], "avatar_failed": [],
    }


def extract_jackets(zf, entry_set, res, out_dir, size, quality):
    """同步 songlist 后按最新曲库补齐缺失曲绘"""
    songlist_ok = sync_metadata(zf, entry_set)
    if not songlist_ok:
        if not SONGLIST.is_file():
            print("APK 内没有 songlist，且本地也没有可用的 json/songlist，"
                  "无法确定曲绘清单，跳过曲绘。", file=sys.stderr)
            return
        print("提示：本次未同步到新 songlist，沿用本地已有的 %s 作为基准。" % SONGLIST)

    missing = collect_missing(out_dir, SONGLIST)
    if not missing:
        print("没有缺失曲绘，无需处理。")
        return

    for name in sorted(missing):
        sid, rc = missing[name]
        entry = find_entry(entry_set, sid, rc)
        if entry is None:
            res["jacket_skipped"].append(name)
            continue
        try:
            process_one(zf, entry, out_dir / name, size, quality)
            res["jacket_done"].append(name)
        except Exception as e:
            res["jacket_failed"].append((name, str(e)))


def process_apk(apk_path, args):
    """处理单个 APK：先同步元数据 -> 拉取缺失曲绘 -> 补齐头像"""
    print("-" * 60)
    print("处理上传文件: %s" % apk_path)
    res = empty_result()
    try:
        zf = zipfile.ZipFile(apk_path)
    except (zipfile.BadZipFile, OSError) as e:
        print("跳过：不是有效的 APK/zip 文件（%s）" % e, file=sys.stderr)
        return res

    with zf:
        entry_set = set(zf.namelist())

        if args.skip_jackets:
            print("已跳过曲绘提取。")
        else:
            extract_jackets(zf, entry_set, res, args.out, args.size, args.quality)

        if args.skip_avatars:
            print("已跳过头像提取。")
        else:
            (res["avatar_done"], res["avatar_existing"],
             res["avatar_failed"]) = process_avatars(
                zf, entry_set, args.avatar_out, args.avatar_csv,
                args.avatar_size, args.avatar_quality)
    return res


def main():
    ap = argparse.ArgumentParser(
        description="从 Arcaea APK 提取缺失曲绘（170x170 JPEG）与角色头像（170x170 WebP）")
    ap.add_argument("apk", nargs="*",
                    help="APK 文件路径，可传多个（也可把文件直接拖到脚本上）；省略则弹出文件选择窗口")
    ap.add_argument("--size", type=int, default=170, help="曲绘输出边长（像素），默认 170")
    ap.add_argument("--quality", type=int, default=70, help="曲绘 JPEG 质量，默认 70")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT,
                    help="曲绘输出目录，默认 Processed_Illustration")
    ap.add_argument("--avatar-size", type=int, default=170,
                    help="头像输出边长（像素），默认 170")
    ap.add_argument("--avatar-quality", type=int, default=90, help="头像 WebP 质量，默认 90")
    ap.add_argument("--avatar-out", type=Path, default=AVATAR_DIR,
                    help="头像输出目录，默认 img/avatar")
    ap.add_argument("--avatar-csv", type=Path, default=AVATAR_CSV,
                    help="头像清单文件，默认 sample/avatar.csv")
    ap.add_argument("--skip-jackets", action="store_true", help="只处理头像，不提取曲绘")
    ap.add_argument("--skip-avatars", action="store_true", help="只提取曲绘，不处理头像")
    ap.add_argument("--dry-run", action="store_true",
                    help="只按当前 json/songlist 列出缺失曲绘，不读取 APK、不写入任何文件")
    args = ap.parse_args()

    if args.skip_jackets and args.skip_avatars:
        sys.exit("曲绘与头像都被跳过，没有可执行的工作。")

    if args.dry_run:
        if not SONGLIST.is_file():
            sys.exit("找不到 songlist: %s" % SONGLIST)
        for name in sorted(collect_missing(args.out, SONGLIST)):
            print("  ", name)
        print("提示：dry-run 不读取 APK，因此不检查头像缺失情况。")
        return

    if not args.skip_jackets:
        args.out.mkdir(parents=True, exist_ok=True)

    apk_paths = pick_apk_paths(args)

    total = empty_result()
    for apk_path in apk_paths:
        res = process_apk(apk_path, args)
        for key, value in res.items():
            total[key] += value
        print("本文件完成：曲绘新增 %d / 未找到源文件 %d / 失败 %d；"
              "头像新增 %d / 已有 %d / 失败 %d"
              % (len(res["jacket_done"]), len(res["jacket_skipped"]),
                 len(res["jacket_failed"]), len(res["avatar_done"]),
                 len(res["avatar_existing"]), len(res["avatar_failed"])))

    print("=" * 60)
    print("全部完成：曲绘新增 %d 张，未找到源文件 %d 张，失败 %d 张；"
          "头像新增 %d 张，已有 %d 张，失败 %d 张"
          % (len(total["jacket_done"]), len(total["jacket_skipped"]),
             len(total["jacket_failed"]), len(total["avatar_done"]),
             len(total["avatar_existing"]), len(total["avatar_failed"])))
    if total["jacket_skipped"]:
        print("未在 APK 中找到的曲绘（可能该版本 APK 未收录）:")
        for n in total["jacket_skipped"]:
            print("  ", n)
    for label, key in (("曲绘", "jacket_failed"), ("头像", "avatar_failed")):
        if total[key]:
            print("处理失败的%s:" % label)
            for n, err in total[key]:
                print("  %s: %s" % (n, err))


if __name__ == "__main__":
    main()
