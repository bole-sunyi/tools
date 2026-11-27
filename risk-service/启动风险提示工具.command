#!/bin/zsh
set -eu
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd -- "${0:A:h}"
echo "正在启动本机钉钉读取服务…"
exec node local-bridge.mjs --open
