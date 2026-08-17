#!/bin/zsh
set -e

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js，请先安装 Node.js 18 或更高版本。"
  read -r "?按回车键退出..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "首次运行，正在安装依赖..."
  npm install
fi

npm run start:phone-transfer &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT INT TERM

sleep 1
open "http://localhost:8787/desktop.html"
echo "手机传文件服务已启动。关闭此窗口将停止服务。"
wait "$SERVER_PID"
