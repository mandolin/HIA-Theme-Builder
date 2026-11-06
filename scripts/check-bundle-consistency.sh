#!/bin/bash
# @lang zh-CN 验证三端 scanner bundle 哈希一致性：运行 extractor 的 verify-bundle-consistency.mjs，
#   失败则退出码非 0（用于 CI 门禁）。
# @lang en Verify three-end scanner bundle hash consistency: run extractor's verify-bundle-consistency.mjs,
#   fail with non-zero exit code on failure (for CI gate).

set -e

echo "Verifying scanner bundle consistency across ends..."
cd HIA/extractor
node scripts/verify-bundle-consistency.mjs

if [ $? -eq 0 ]; then
  echo "✅ Bundle consistency verified: all ends use the same scanner bundle."
  exit 0
else
  echo "❌ Bundle consistency check failed: scanner bundles differ across ends."
  exit 1
fi
