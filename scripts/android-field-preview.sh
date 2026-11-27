#!/bin/bash
set -eu
cd "$(dirname "$0")/.."
port="${1:-4187}"
if [[ ! "$port" =~ ^[1-9][0-9]{0,4}$ ]] || (( port < 1024 || port > 65535 )); then
  echo '請指定介於 1024 與 65535 的連接埠。' >&2
  exit 2
fi
phone_url="http://localhost:$port/"
update_url="${phone_url}api/mobile-update.html"

adb_bin="$(command -v adb || true)"
adb_bin="${adb_bin:-${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb}"
"$adb_bin" get-state >/dev/null
npm run build
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port "$port" --strictPort &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
for attempt in {1..30}; do
  sleep 0.3
  kill -0 "$server" || exit 1
  if curl -fsS "http://127.0.0.1:$port/sw.js" -o /dev/null; then break; fi
done
curl -fsS "http://127.0.0.1:$port/sw.js" -o /dev/null
"$adb_bin" reverse "tcp:$port" "tcp:$port"
"$adb_bin" shell am start -W -a android.intent.action.VIEW -d "$update_url" -p com.android.chrome
echo "手機更新網址：$update_url"
echo "按「檢查並更新」，返回首頁後確認版本。安裝網址：$phone_url"
echo '等手機顯示基本頁面已儲存，再拔線、開飛航模式，從同一網址重開。'
wait "$server"
