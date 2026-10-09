#!/bin/zsh
set -e
cd -- "$(dirname -- "$0")/.."
if [[ -x .tools/node-v24.21.0-darwin-arm64/bin/node ]]; then
  export PATH="$PWD/.tools/node-v24.21.0-darwin-arm64/bin:$PATH"
fi
exec pnpm dev
