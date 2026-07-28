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
import subprocess
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


SKIP_IF = ("docker", "br-", "veth", "tun", "tap", "virbr", "lo")


def lan_ips():
    """列出可用于局域网访问的 IPv4 地址，192.168.* 优先。

    不用「连一下 8.8.8.8 看源地址」那套：这台机器上有 VPN 时，
    默认路由会走 tun 口，探测到的地址在局域网里根本连不上。
    """
    try:
        out = subprocess.run(["ip", "-4", "-o", "addr", "show", "scope", "global"],
                             capture_output=True, text=True, timeout=3).stdout
    except (OSError, subprocess.SubprocessError):
        return [("127.0.0.1", "lo")]

    found = []
    for line in out.splitlines():
        f = line.split()
        if len(f) < 4:
            continue
        iface, ip = f[1], f[3].split("/")[0]
        if iface.startswith(SKIP_IF):
            continue
        rank = 0 if ip.startswith("192.168.") else 1 if ip.startswith("10.") else 2
        found.append((rank, ip, iface))
    found.sort()
    return [(ip, iface) for _, ip, iface in found] or [("127.0.0.1", "lo")]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--port", type=int, default=9876)
    a = ap.parse_args()

    data = os.path.join(PUBLIC, "data", "app-data.json")
    if not os.path.exists(data):
        raise SystemExit("缺少 app/public/data/app-data.json，请先运行： python3 app/build/build.py")

    srv = ThreadingHTTPServer((a.host, a.port), Handler)
    print("💪 囚徒健身 webapp 已启动")
    print(f"   本机   http://127.0.0.1:{a.port}")
    for i, (ip, iface) in enumerate(lan_ips()):
        print(f"   {'手机' if i == 0 else '    '}   http://{ip}:{a.port}  ({iface})")
    print("   Ctrl+C 停止")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
        srv.shutdown()


if __name__ == "__main__":
    main()
