#!/usr/bin/env bash
# build-wasm.sh — Build all WASM modules with wasm-pack, then optimise each with wasm-opt
#
# Usage:
#   ./scripts/build/build-wasm.sh              # Release build (default)
#   ./scripts/build/build-wasm.sh --release    # Release build (explicit)
#   ./scripts/build/build-wasm.sh --debug      # Debug build (unoptimized, faster compile)
#
# wasm-opt decision: wasm-pack 0.15.1 downloads its own binaryen (version_130),
# which lags the newest release. Each crate sets
# `[package.metadata.wasm-pack.profile.release] wasm-opt = false`, and this
# script runs binaryen BINARYEN_VERSION itself on every pkg/*_bg.wasm. The tarball
# is cached in .cache/binaryen/ and verified against the SHA-256 values below
# (taken from the release's .sha256 assets). No --enable-* flags are passed:
# rustc writes every wasm32 target feature it enables into the target_features
# section (the defaults since 1.82/1.87: bulk-memory, multivalue, mutable-globals,
# nontrapping-float-to-int, reference-types, sign-ext, plus the implied
# bulk-memory-opt and call-indirect-overlong), and wasm-opt reads that section.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WASM_DIR="$PROJECT_ROOT/crates"

# Keep in sync with the CI binaryen cache key (it keys on this variable).
BINARYEN_VERSION=133
BINARYEN_SHA256_X86_64_LINUX="2dc9c7813f5375db93d96ead4b78222fcc3e2677bbb832297af4797782a37489"
BINARYEN_SHA256_AARCH64_LINUX="89c07ea56faf38d0fbecf36ca8ec0721756716185f265b568e133d427f299bf8"
BINARYEN_SHA256_X86_64_MACOS="13a9b90be775c6389ce3d1f879cb8627bea56708ba8c122983941d53a8199b95"
BINARYEN_SHA256_ARM64_MACOS="ad66da82ac13f163e424b1643f16c6dfcccc98b5966296b43e52d3cab04f84a8"
BINARYEN_SHA256_X86_64_WINDOWS="17a2cbeac6b5693c5fbafab3838d3c65fd9c1eb38b05f5baec6c657e8c84995b"
BINARYEN_SHA256_ARM64_WINDOWS="492a8e1847a0be1554bb9a7f384227981d60bc013aedc02d8ba1372c3943178c"

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
  echo "Install it with: pnpm install (wasm-pack is a pinned devDependency)"
  exit 1
fi

if ! command -v rustc &>/dev/null; then
  echo "Error: Rust toolchain is not installed."
  echo "Install rustup from https://rustup.rs; rust-toolchain.toml pins the nightly, components and wasm32 target."
  exit 1
fi

# ---------------------------------------------------------------------------
# Fetch and verify binaryen (release builds only)
# ---------------------------------------------------------------------------

WASM_OPT=""

fetch_binaryen() {
  local platform sha exe
  case "$(uname -s)-$(uname -m)" in
    Linux-x86_64)
      platform="x86_64-linux"; sha="$BINARYEN_SHA256_X86_64_LINUX"; exe="wasm-opt" ;;
    Linux-aarch64|Linux-arm64)
      platform="aarch64-linux"; sha="$BINARYEN_SHA256_AARCH64_LINUX"; exe="wasm-opt" ;;
    Darwin-x86_64)
      platform="x86_64-macos"; sha="$BINARYEN_SHA256_X86_64_MACOS"; exe="wasm-opt" ;;
    Darwin-arm64)
      platform="arm64-macos"; sha="$BINARYEN_SHA256_ARM64_MACOS"; exe="wasm-opt" ;;
    MINGW*-x86_64|MSYS*-x86_64|CYGWIN*-x86_64)
      platform="x86_64-windows"; sha="$BINARYEN_SHA256_X86_64_WINDOWS"; exe="wasm-opt.exe" ;;
    MINGW*-aarch64|MINGW*-arm64|MSYS*-aarch64|MSYS*-arm64)
      platform="arm64-windows"; sha="$BINARYEN_SHA256_ARM64_WINDOWS"; exe="wasm-opt.exe" ;;
    *)
      echo "Error: no pinned binaryen checksum for $(uname -s) $(uname -m)."
      exit 1 ;;
  esac

  local dir="$PROJECT_ROOT/.cache/binaryen/version_${BINARYEN_VERSION}"
  local tarball="$dir/binaryen-version_${BINARYEN_VERSION}-${platform}.tar.gz"
  WASM_OPT="$dir/binaryen-version_${BINARYEN_VERSION}/bin/$exe"

  if [ ! -x "$WASM_OPT" ]; then
    mkdir -p "$dir"
    echo "Downloading binaryen version_${BINARYEN_VERSION} (${platform})"
    curl --fail --silent --show-error --location --output "$tarball" \
      "https://github.com/WebAssembly/binaryen/releases/download/version_${BINARYEN_VERSION}/binaryen-version_${BINARYEN_VERSION}-${platform}.tar.gz"
    local actual
    if command -v sha256sum >/dev/null; then
      actual="$(sha256sum "$tarball" | cut -d' ' -f1)"
    else
      actual="$(shasum -a 256 "$tarball" | cut -d' ' -f1)"
    fi
    if [ "$actual" != "$sha" ]; then
      echo "Error: binaryen checksum mismatch for $tarball"
      echo "  expected $sha"
      echo "  actual   $actual"
      rm -f "$tarball"
      exit 1
    fi
    tar -xzf "$tarball" -C "$dir"
  fi

  "$WASM_OPT" --version
}

if [ "$BUILD_PROFILE" = "--release" ]; then
  fetch_binaryen
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
  "jpeg"
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

  # The default relative out-dir (<crate>/pkg) is used on purpose: an absolute
  # --out-dir left stray crates/<crate>/crates/<crate>/pkg trees on Windows.
  if wasm-pack build "$CRATE_DIR" \
    --target web \
    "$BUILD_PROFILE" \
    --out-name "modern_pdf_${crate}" 2>&1 | sed 's/^/    /' && \
    { [ -z "$WASM_OPT" ] || \
      "$WASM_OPT" -O "$CRATE_DIR/pkg/modern_pdf_${crate}_bg.wasm" \
        -o "$CRATE_DIR/pkg/modern_pdf_${crate}_bg.wasm" 2>&1 | sed 's/^/    /'; }; then
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
