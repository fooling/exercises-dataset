#!/usr/bin/env bash
# 囚徒健身 webapp 的启停脚本（systemd user service）
#
#   ./app/ctl.sh install     安装并启动，开机自启
#   ./app/ctl.sh start | stop | restart | status | logs
#   ./app/ctl.sh uninstall   停止并移除服务
#
# 可用环境变量覆盖： PORT（默认 9876）、HOST（默认 0.0.0.0）
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT=calisthenics.service
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT_PATH="$UNIT_DIR/$UNIT"
TEMPLATE="$REPO/app/systemd/$UNIT.in"
PORT="${PORT:-9876}"
HOST="${HOST:-0.0.0.0}"
PYTHON="$(command -v python3)"

c_ok=$'\033[32m'; c_warn=$'\033[33m'; c_err=$'\033[31m'; c_dim=$'\033[2m'; c_off=$'\033[0m'
say()  { printf '%s\n' "$*"; }
ok()   { printf '%s✅ %s%s\n' "$c_ok" "$*" "$c_off"; }
warn() { printf '%s⚠️  %s%s\n' "$c_warn" "$*" "$c_off"; }
die()  { printf '%s❌ %s%s\n' "$c_err" "$*" "$c_off" >&2; exit 1; }

need_systemd() {
  command -v systemctl >/dev/null || die "找不到 systemctl，这台机器不是 systemd 系统"
  systemctl --user show-environment >/dev/null 2>&1 \
    || die "systemd user 实例不可用（可能是在纯 SSH 会话里且未开启 linger）"
}

# 列出可用于局域网访问的 IPv4 地址（跳过 docker/tun/veth 等虚拟接口，
# 192.168.* 优先）。多网卡机器上猜单一地址不可靠，所以全列出来。
lan_ips() {
  ip -4 -o addr show scope global 2>/dev/null \
    | awk '{print $2, $4}' \
    | grep -Ev '^(docker|br-|veth|tun|tap|virbr|lo)' \
    | cut -d/ -f1 \
    | awk '{print ($2 ~ /^192\.168\./ ? 0 : $2 ~ /^10\./ ? 1 : 2), $2, $1}' \
    | sort -n | awk '{print $2" ("$3")"}'
}

cmd_install() {
  need_systemd
  [[ -f "$TEMPLATE" ]] || die "缺少服务模板：$TEMPLATE"
  [[ -n "$PYTHON" ]]   || die "找不到 python3"

  mkdir -p "$UNIT_DIR"
  sed -e "s|@REPO@|$REPO|g" -e "s|@PYTHON@|$PYTHON|g" \
      -e "s|@HOST@|$HOST|g" -e "s|@PORT@|$PORT|g" \
      "$TEMPLATE" > "$UNIT_PATH"
  ok "已写入 $UNIT_PATH"

  # 开启 linger，让服务在未登录时也能常驻（失败不阻断安装）
  if ! loginctl show-user "$USER" -p Linger 2>/dev/null | grep -q 'Linger=yes'; then
    if loginctl enable-linger "$USER" 2>/dev/null; then
      ok "已开启 linger，注销后服务仍会运行"
    else
      warn "无法自动开启 linger，注销后服务会停止。需要时手动执行："
      say  "   ${c_dim}sudo loginctl enable-linger $USER${c_off}"
    fi
  fi

  systemctl --user daemon-reload
  systemctl --user enable --now "$UNIT"
  sleep 1
  cmd_status
}

cmd_uninstall() {
  need_systemd
  systemctl --user disable --now "$UNIT" 2>/dev/null || true
  rm -f "$UNIT_PATH"
  systemctl --user daemon-reload
  ok "服务已停止并移除（仓库文件未改动）"
}

installed() { [[ -f "$UNIT_PATH" ]] || die "服务尚未安装，先执行： ./app/ctl.sh install"; }

cmd_start()   { need_systemd; installed; systemctl --user start   "$UNIT"; sleep 1; cmd_status; }
cmd_stop()    { need_systemd; installed; systemctl --user stop    "$UNIT"; ok "已停止"; }
cmd_restart() { need_systemd; installed; systemctl --user restart "$UNIT"; sleep 1; cmd_status; }
cmd_logs()    { need_systemd; installed; journalctl --user -u "$UNIT" -n "${LINES:-50}" -f; }

cmd_status() {
  need_systemd
  if [[ ! -f "$UNIT_PATH" ]]; then
    warn "服务未安装"; say "   ${c_dim}./app/ctl.sh install${c_off}"; return
  fi
  local port
  port="$(grep -oP -- '--port \K\d+' "$UNIT_PATH" | head -1)"
  if systemctl --user is-active --quiet "$UNIT"; then
    ok "运行中"
    say "   本机   http://127.0.0.1:$port"
    local first=1
    while read -r ip iface; do
      [[ -z "$ip" ]] && continue
      if (( first )); then say "   手机   http://$ip:$port  ${c_dim}$iface${c_off}"; first=0
      else                 say "          http://$ip:$port  ${c_dim}$iface${c_off}"; fi
    done < <(lan_ips)
    systemctl --user is-enabled --quiet "$UNIT" && say "   ${c_dim}已设为开机自启${c_off}"
  else
    warn "未运行"
    systemctl --user status "$UNIT" --no-pager -n 15 || true
  fi
}

case "${1:-status}" in
  install)   cmd_install ;;
  uninstall) cmd_uninstall ;;
  start)     cmd_start ;;
  stop)      cmd_stop ;;
  restart)   cmd_restart ;;
  status)    cmd_status ;;
  logs)      cmd_logs ;;
  *) sed -n '2,9p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'; exit 1 ;;
esac
