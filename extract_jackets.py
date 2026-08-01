#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 Arcaea APK 中提取缺失的曲目曲绘，处理为 170x170 / JPEG 质量70，写入 Processed_Illustration。

用法：
    python extract_jackets.py [apk路径] [--size 170] [--quality 70] [--dry-run]

不传 apk 路径时会弹出文件选择窗口（tkinter），默认定位到 sample 目录；
无图形环境时自动回退到 sample 目录下第一个 *.apk。

曲绘清单由 json/songlist 派生：
  - 普通难度的曲绘 -> <songId>.jpg
    APK 内对应 assets/songs/<songId>/ 或 assets/songs/dl_<songId>/ 下的 1080_base.jpg（兼容 base.jpg）
  - jacketOverride 难度（如 BYD 特殊曲绘）-> <songId>_<ratingClass>.jpg
    APK 内对应同目录下的 1080_<ratingClass>.jpg

已存在于 Processed_Illustration 的文件会跳过，可重复运行。
"""

import argparse
import io
import json
import sys
import zipfile
from pathlib import Path

from PIL import Image

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_SONGLIST = SCRIPT_DIR / "json" / "songlist"
DEFAULT_OUT = SCRIPT_DIR / "Processed_Illustration"
DEFAULT_APK_HINT_DIR = SCRIPT_DIR / "sample"


def build_needed(songlist_path):
    """按 songlist 的 difficulty/jacketOverride 派生所需曲绘文件名 -> (songId, ratingClass|None)"""
    with open(songlist_path, encoding="utf-8") as f:
        songs = json.load(f)["songs"]
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


def pick_apk_path(args):
    if args.apk:
        p = Path(args.apk)
        if not p.is_file():
            sys.exit("APK 文件不存在: %s" % p)
        return p
    # 弹出文件选择窗口
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        initial = DEFAULT_APK_HINT_DIR if DEFAULT_APK_HINT_DIR.is_dir() else SCRIPT_DIR
        path = filedialog.askopenfilename(
            title="选择 Arcaea APK 文件",
            initialdir=str(initial),
            filetypes=[("APK 文件", "*.apk"), ("所有文件", "*.*")],
        )
        root.destroy()
        if not path:
            sys.exit("未选择 APK 文件，已取消。")
        return Path(path)
    except Exception as e:
        # 无图形环境时回退到 sample 下的 APK
        print("无法弹出文件选择窗口（%s），尝试查找 sample 目录下的 APK…" % e, file=sys.stderr)
        candidates = sorted(DEFAULT_APK_HINT_DIR.glob("*.apk")) if DEFAULT_APK_HINT_DIR.is_dir() else []
        if candidates:
            return candidates[0]
        sys.exit("未提供 APK 路径，且没有可用的图形窗口或 sample 目录下的 APK。")


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


def main():
    ap = argparse.ArgumentParser(description="从 Arcaea APK 提取缺失曲绘（170x170 / JPEG 质量70）")
    ap.add_argument("apk", nargs="?", help="APK 文件路径；省略则弹出文件选择窗口")
    ap.add_argument("--size", type=int, default=170, help="输出边长（像素），默认 170")
    ap.add_argument("--quality", type=int, default=70, help="JPEG 质量，默认 70")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help="输出目录，默认 Processed_Illustration")
    ap.add_argument("--dry-run", action="store_true", help="只列出缺失曲绘，不写入")
    args = ap.parse_args()

    if not DEFAULT_SONGLIST.is_file():
        sys.exit("找不到 songlist: %s" % DEFAULT_SONGLIST)

    needed = build_needed(DEFAULT_SONGLIST)
    args.out.mkdir(parents=True, exist_ok=True)
    existing = set(p.name for p in args.out.iterdir() if p.is_file())
    missing = {name: info for name, info in needed.items() if name not in existing}
    print("songlist 所需曲绘: %d，%s 已有: %d，缺失: %d"
          % (len(needed), args.out, len(existing), len(missing)))
    if not missing:
        print("没有缺失曲绘，无需处理。")
        return

    if args.dry_run:
        for name in sorted(missing):
            print("  ", name)
        return

    apk_path = pick_apk_path(args)
    print("使用 APK: %s" % apk_path)

    try:
        zf = zipfile.ZipFile(apk_path)
    except zipfile.BadZipFile as e:
        sys.exit("APK 不是有效的 zip 文件: %s" % e)

    with zf:
        entry_set = set(zf.namelist())

        def find_entry(sid, rc):
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

        done, skipped, failed = [], [], []
        for name in sorted(missing):
            sid, rc = missing[name]
            entry = find_entry(sid, rc)
            if entry is None:
                skipped.append(name)
                continue
            out_path = args.out / name
            try:
                process_one(zf, entry, out_path, args.size, args.quality)
                done.append(name)
            except Exception as e:
                failed.append((name, str(e)))

    print("完成：新增 %d 张，未找到源文件 %d 张，失败 %d 张" % (len(done), len(skipped), len(failed)))
    if skipped:
        print("未在 APK 中找到的曲绘（可能该版本 APK 未收录）:")
        for n in skipped:
            print("  ", n)
    if failed:
        print("处理失败的曲绘:")
        for n, err in failed:
            print("  %s: %s" % (n, err))


if __name__ == "__main__":
    main()
