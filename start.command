#!/bin/zsh
cd "${0:A:h}" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "请先安装 Node.js 20 或更新版本，然后重新双击本文件。"
  read '?按回车退出…'
  exit 1
fi
node server.mjs &
studio_pid=$!
sleep 1
open 'http://127.0.0.1:8788/'
wait "$studio_pid"
