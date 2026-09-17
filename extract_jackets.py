#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 Arcaea APK 中提取缺失的曲目曲绘（170x170 / JPEG 质量70）。

用法：
    python extract_jackets.py <apk文件> [<apk文件> ...] [--size 170] [--quality 70] [--dry-run]

文件来源：只接受显式上传 / 传入的 APK 路径，不再从 sample 等目录自动读取。
  - 命令行参数传入（可传多个，也可直接把 APK 拖到脚本上）
  - 不传参数时弹出文件选择窗口（可多选）

每个 APK 的处理顺序：
  1) 先把 APK 内的 songlist / packlist 整文件复制到 json 目录（覆盖旧版本）；
  2) 再以"刚刚复制过来的最新 songlist"为基准，派生本次需要的曲绘清单；
  3) 只对 Processed_Illustration 中缺失的曲绘做提取、缩放、重新编码。

曲绘清单由 songlist 派生：
  - 普通难度的曲绘 -> <songId>.jpg
    APK 内对应 assets/songs/<songId>/ 或 assets/songs/dl_<songId>/ 下的 1080_base.jpg（兼容 base.jpg）
  - jacketOverride 难度（如 BYD 特殊曲绘）-> <songId>_<ratingClass>.jpg
    APK 内对应同目录下的 1080_<ratingClass>.jpg

已存在于 Processed_Illustration 的文件会跳过，可重复运行。
"""

import argparse
import io
import json
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


def process_apk(apk_path, out_dir, size, quality):
    """处理单个 APK：先同步元数据 -> 再按最新 songlist 拉取缺失曲绘"""
    print("-" * 60)
    print("处理上传文件: %s" % apk_path)
    try:
        zf = zipfile.ZipFile(apk_path)
    except (zipfile.BadZipFile, OSError) as e:
        print("跳过：不是有效的 APK/zip 文件（%s）" % e, file=sys.stderr)
        return [], [], []

    with zf:
        entry_set = set(zf.namelist())

        # 1) 先复制 songlist / packlist
        songlist_ok = sync_metadata(zf, entry_set)
        if not songlist_ok and not SONGLIST.is_file():
            print("APK 内没有 songlist，且本地也没有可用的 json/songlist，无法确定曲绘清单，跳过。",
                  file=sys.stderr)
            return [], [], []
        if not songlist_ok:
            print("提示：本次未同步到新 songlist，沿用本地已有的 %s 作为基准。" % SONGLIST)

        # 2) 以最新的 songlist 为基准
        missing = collect_missing(out_dir, SONGLIST)

        # 3) 提取缺失曲绘
        if not missing:
            print("没有缺失曲绘，无需处理。")
            return [], [], []

        done, skipped, failed = [], [], []
        for name in sorted(missing):
            sid, rc = missing[name]
            entry = find_entry(entry_set, sid, rc)
            if entry is None:
                skipped.append(name)
                continue
            try:
                process_one(zf, entry, out_dir / name, size, quality)
                done.append(name)
            except Exception as e:
                failed.append((name, str(e)))
    return done, skipped, failed


def main():
    ap = argparse.ArgumentParser(description="从 Arcaea APK 提取缺失曲绘（170x170 / JPEG 质量70）")
    ap.add_argument("apk", nargs="*",
                    help="APK 文件路径，可传多个（也可把文件直接拖到脚本上）；省略则弹出文件选择窗口")
    ap.add_argument("--size", type=int, default=170, help="输出边长（像素），默认 170")
    ap.add_argument("--quality", type=int, default=70, help="JPEG 质量，默认 70")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help="输出目录，默认 Processed_Illustration")
    ap.add_argument("--dry-run", action="store_true",
                    help="只按当前 json/songlist 列出缺失曲绘，不读取 APK、不写入任何文件")
    args = ap.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)

    if args.dry_run:
        if not SONGLIST.is_file():
            sys.exit("找不到 songlist: %s" % SONGLIST)
        for name in sorted(collect_missing(args.out, SONGLIST)):
            print("  ", name)
        return

    apk_paths = pick_apk_paths(args)

    total_done, total_skipped, total_failed = [], [], []
    for apk_path in apk_paths:
        done, skipped, failed = process_apk(apk_path, args.out, args.size, args.quality)
        total_done += done
        total_skipped += skipped
        total_failed += failed
        print("本文件完成：新增 %d 张，未找到源文件 %d 张，失败 %d 张"
              % (len(done), len(skipped), len(failed)))

    print("=" * 60)
    print("全部完成：新增 %d 张，未找到源文件 %d 张，失败 %d 张"
          % (len(total_done), len(total_skipped), len(total_failed)))
    if total_skipped:
        print("未在 APK 中找到的曲绘（可能该版本 APK 未收录）:")
        for n in total_skipped:
            print("  ", n)
    if total_failed:
        print("处理失败的曲绘:")
        for n, err in total_failed:
            print("  %s: %s" % (n, err))


if __name__ == "__main__":
    main()
