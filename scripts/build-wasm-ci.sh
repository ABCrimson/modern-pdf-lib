#!/usr/bin/env bash
# build-wasm-ci.sh — CI-optimized WASM build with caching support
#
# Features:
#   - Skips crates whose source has not changed since the last build
#   - Generates a cache key for CI caching (GitHub Actions, etc.)
#   - Supports --force to rebuild all crates regardless of timestamps
#
# Usage:
#   ./scripts/build-wasm-ci.sh              # Build changed crates only
#   ./scripts/build-wasm-ci.sh --force      # Rebuild everything
#   ./scripts/build-wasm-ci.sh --cache-key  # Print cache key and exit

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WASM_DIR="$PROJECT_ROOT/src/wasm"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------

FORCE_BUILD=false
CACHE_KEY_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --force)
      FORCE_BUILD=true
      ;;
    --cache-key)
      CACHE_KEY_ONLY=true
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: $0 [--force|--cache-key]"
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# WASM crates
# ---------------------------------------------------------------------------

CRATES=(
  "libdeflate"
  "png"
  "ttf"
  "shaping"
)

# ---------------------------------------------------------------------------
# Cache key generation
# ---------------------------------------------------------------------------

generate_cache_key() {
  local hash_input=""

  for crate in "${CRATES[@]}"; do
    local crate_dir="$WASM_DIR/$crate"
    if [ -d "$crate_dir" ]; then
      # Hash Cargo.toml and all Rust source files
      if [ -f "$crate_dir/Cargo.toml" ]; then
        hash_input+="$(sha256sum "$crate_dir/Cargo.toml" 2>/dev/null || shasum -a 256 "$crate_dir/Cargo.toml")"
      fi
      if [ -d "$crate_dir/src" ]; then
        hash_input+="$(find "$crate_dir/src" -name '*.rs' -exec sha256sum {} \; 2>/dev/null || find "$crate_dir/src" -name '*.rs' -exec shasum -a 256 {} \;)"
      fi
    fi
  done

  # Also include the build script itself
  hash_input+="$(sha256sum "$SCRIPT_DIR/build-wasm.sh" 2>/dev/null || shasum -a 256 "$SCRIPT_DIR/build-wasm.sh")"

  echo "$hash_input" | sha256sum 2>/dev/null | cut -d' ' -f1 || echo "$hash_input" | shasum -a 256 | cut -d' ' -f1
}

if [ "$CACHE_KEY_ONLY" = true ]; then
  echo "wasm-$(generate_cache_key)"
  exit 0
fi

# ---------------------------------------------------------------------------
# Verify prerequisites
# ---------------------------------------------------------------------------

if ! command -v wasm-pack &>/dev/null; then
  echo "Error: wasm-pack is not installed."
  echo "Install it with: cargo install wasm-pack"
  exit 1
fi

# ---------------------------------------------------------------------------
# Check if a crate needs rebuilding
# ---------------------------------------------------------------------------

crate_needs_build() {
  local crate="$1"
  local crate_dir="$WASM_DIR/$crate"
  local pkg_dir="$crate_dir/pkg"

  # Always build if forced
  if [ "$FORCE_BUILD" = true ]; then
    return 0
  fi

  # Build if pkg directory doesn't exist
  if [ ! -d "$pkg_dir" ]; then
    return 0
  fi

  # Build if no .wasm file exists
  local wasm_file
  wasm_file=$(find "$pkg_dir" -name '*.wasm' -print -quit 2>/dev/null || true)
  if [ -z "$wasm_file" ]; then
    return 0
  fi

  # Build if any source file is newer than the .wasm output
  local newest_source
  newest_source=$(find "$crate_dir/src" "$crate_dir/Cargo.toml" -newer "$wasm_file" 2>/dev/null | head -1)
  if [ -n "$newest_source" ]; then
    return 0
  fi

  # No rebuild needed
  return 1
}

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

echo "==========================================="
echo "  modern-pdf — WASM CI Build"
echo "==========================================="
echo ""

CACHE_KEY="wasm-$(generate_cache_key)"
echo "Cache key: $CACHE_KEY"
echo ""

TOTAL=${#CRATES[@]}
CURRENT=0
BUILT=0
SKIPPED=0
FAILED=0

for crate in "${CRATES[@]}"; do
  CURRENT=$((CURRENT + 1))
  CRATE_DIR="$WASM_DIR/$crate"

  if [ ! -d "$CRATE_DIR" ]; then
    echo "[$CURRENT/$TOTAL] SKIP  $crate — directory not found"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  if ! crate_needs_build "$crate"; then
    echo "[$CURRENT/$TOTAL] CACHE $crate — up to date"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo "[$CURRENT/$TOTAL] BUILD $crate"

  if wasm-pack build "$CRATE_DIR" \
    --target web \
    --release \
    --out-dir "$CRATE_DIR/pkg" \
    --out-name "modern_pdf_${crate}" 2>&1 | sed 's/^/    /'; then
    echo "[$CURRENT/$TOTAL] OK    $crate"
    BUILT=$((BUILT + 1))
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
echo "  Built: $BUILT | Cached: $SKIPPED | Failed: $FAILED"
echo "==========================================="

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi

exit 0
