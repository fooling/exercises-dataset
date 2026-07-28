#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""囚徒健身 webapp 的静态服务器。

把 app/public 挂在 /，并把仓库根目录的 images/ 与 videos/ 直接映射出去，
这样前端可以用 /images/xxx.jpg、/videos/xxx.gif 引用数据集自带的媒体。

    python3 app/server.py [--host 0.0.0.0] [--port 9876]
"""
import argparse
import os
import posixpath
import socket
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PUBLIC = os.path.join(ROOT, "app", "public")
# 允许从仓库根目录直接读取的媒体目录
MEDIA_DIRS = ("images", "videos")


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        rel = unquote(urlparse(path).path).lstrip("/")
        # 规范化，挡掉 ../ 之类的穿越尝试
        parts = [p for p in posixpath.normpath("/" + rel).split("/") if p and p != ".."]
        rel = "/".join(parts)
        base = ROOT if parts and parts[0] in MEDIA_DIRS else PUBLIC
        full = os.path.join(base, *parts) if parts else os.path.join(PUBLIC, "index.html")
        if os.path.isdir(full):
            full = os.path.join(full, "index.html")
        return full

    def end_headers(self):
        p = self.path.split("?")[0]
        if p.startswith(("/images/", "/videos/")):
            self.send_header("Cache-Control", "public, max-age=604800")   # 媒体缓存一周
        else:
            self.send_header("Cache-Control", "no-cache")                 # 代码与数据不缓存
        super().end_headers()

    def log_message(self, fmt, *args):
        if "?" not in self.path and not self.path.startswith(("/images/", "/videos/")):
            super().log_message(fmt, *args)


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return "127.0.0.1"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--port", type=int, default=9876)
    a = ap.parse_args()

    data = os.path.join(PUBLIC, "data", "app-data.json")
    if not os.path.exists(data):
        raise SystemExit("缺少 app/public/data/app-data.json，请先运行： python3 app/build/build.py")

    srv = ThreadingHTTPServer((a.host, a.port), Handler)
    print(f"💪 囚徒健身 webapp 已启动")
    print(f"   本机   http://127.0.0.1:{a.port}")
    print(f"   手机   http://{lan_ip()}:{a.port}")
    print("   Ctrl+C 停止")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
        srv.shutdown()


if __name__ == "__main__":
    main()
