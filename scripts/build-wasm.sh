#!/usr/bin/env bash
# build-wasm.sh — Build all WASM modules using wasm-pack
#
# Usage:
#   ./scripts/build-wasm.sh              # Release build (default)
#   ./scripts/build-wasm.sh --release    # Release build (explicit)
#   ./scripts/build-wasm.sh --debug      # Debug build (unoptimized, faster compile)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WASM_DIR="$PROJECT_ROOT/src/wasm"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------

BUILD_PROFILE="--release"

for arg in "$@"; do
  case "$arg" in
    --debug)
      BUILD_PROFILE="--dev"
      ;;
    --release)
      BUILD_PROFILE="--release"
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: $0 [--release|--debug]"
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Verify prerequisites
# ---------------------------------------------------------------------------

if ! command -v wasm-pack &>/dev/null; then
  echo "Error: wasm-pack is not installed."
  echo "Install it with: cargo install wasm-pack"
  exit 1
fi

if ! command -v rustc &>/dev/null; then
  echo "Error: Rust toolchain is not installed."
  echo "Install it from: https://rustup.rs"
  exit 1
fi

# ---------------------------------------------------------------------------
# WASM crates to build
# ---------------------------------------------------------------------------

CRATES=(
  "libdeflate"
  "png"
  "ttf"
  "shaping"
  "jbig2"
)

PROFILE_LABEL="release"
if [ "$BUILD_PROFILE" = "--dev" ]; then
  PROFILE_LABEL="debug"
fi

echo "==========================================="
echo "  modern-pdf — WASM Build ($PROFILE_LABEL)"
echo "==========================================="
echo ""

TOTAL=${#CRATES[@]}
CURRENT=0
FAILED=0

for crate in "${CRATES[@]}"; do
  CURRENT=$((CURRENT + 1))
  CRATE_DIR="$WASM_DIR/$crate"

  if [ ! -d "$CRATE_DIR" ]; then
    echo "[$CURRENT/$TOTAL] SKIP  $crate — directory not found"
    continue
  fi

  echo "[$CURRENT/$TOTAL] BUILD $crate"

  if wasm-pack build "$CRATE_DIR" \
    --target web \
    "$BUILD_PROFILE" \
    --out-dir "$CRATE_DIR/pkg" \
    --out-name "modern_pdf_${crate}" 2>&1 | sed 's/^/    /'; then
    echo "[$CURRENT/$TOTAL] OK    $crate"
  else
    echo "[$CURRENT/$TOTAL] FAIL  $crate"
    FAILED=$((FAILED + 1))
  fi

  echo ""
done

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo "==========================================="
if [ "$FAILED" -gt 0 ]; then
  echo "  Build completed with $FAILED failure(s)"
  echo "==========================================="
  exit 1
else
  echo "  All $TOTAL WASM crates built successfully"
  echo "==========================================="
  exit 0
fi
