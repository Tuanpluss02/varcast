#!/usr/bin/env bash
set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(cd "${PLUGIN_DIR}/.." && pwd)"

IR_PATH="${ROOT_DIR}/docs/tmp/ir.json"
OUT_DIR="${ROOT_DIR}/output/design_system_e2e"

if [[ ! -f "${IR_PATH}" ]]; then
  echo "Missing IR fixture at: ${IR_PATH}" >&2
  exit 2
fi

cd "${PLUGIN_DIR}"

echo "==> Typecheck"
npm run typecheck

echo "==> Unit tests"
npm test

echo "==> Build (plugin + CLI)"
npm run build

echo "==> Generate Flutter package from IR"
rm -rf "${OUT_DIR}"
mkdir -p "${OUT_DIR}"
node "${PLUGIN_DIR}/dist/cli.js" --ir "${IR_PATH}" --out "${OUT_DIR}" --name design_system

if ! command -v flutter >/dev/null 2>&1; then
  echo "flutter not found on PATH; skipping flutter analyze/test." >&2
  exit 3
fi

echo "==> flutter pub get"
cd "${OUT_DIR}"
flutter pub get

echo "==> flutter analyze"
flutter analyze

echo "==> flutter test"
flutter test

echo "✓ e2e OK"

