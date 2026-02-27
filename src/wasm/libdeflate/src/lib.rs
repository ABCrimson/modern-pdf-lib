//! WASM-compiled deflate compression module for the modern-pdf library.
//!
//! Provides raw deflate compression and decompression via the `flate2` crate.
//! Compiled to WebAssembly and consumed by the TypeScript wrapper in
//! `src/compression/libdeflateWasm.ts`.
//!
//! # Exported Functions
//!
//! - `compress(data, level)` — Compress raw bytes using deflate.
//! - `decompress(data, max_output_size)` — Decompress raw deflate bytes.
//!
//! # Compression Levels
//!
//! Levels 1–12 are supported. flate2 maps these to the underlying miniz
//! or zlib levels internally:
//! - 1 = fastest
//! - 6 = balanced (default)
//! - 9 = best standard compression
//! - 10–12 = extended range (implementation-dependent; flate2 clamps to 0–9
//!   for its built-in miniz backend, but levels >9 are useful for libdeflate
//!   native builds)

use std::io::Write;
use wasm_bindgen::prelude::*;

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

/// Convert a Rust error into a JsValue for wasm-bindgen.
fn to_js_err<E: std::fmt::Display>(err: E) -> JsValue {
    JsValue::from_str(&format!("modern-pdf-deflate: {}", err))
}

// ---------------------------------------------------------------------------
// Compression
// ---------------------------------------------------------------------------

/// Compress raw bytes using the deflate algorithm.
///
/// # Arguments
///
/// * `data`  — Input bytes to compress.
/// * `level` — Compression level (1–12). Values outside this range are clamped.
///             Levels 10–12 are mapped to flate2's maximum (9) since flate2's
///             miniz backend caps at 9.
///
/// # Returns
///
/// Compressed bytes in raw deflate format (no zlib or gzip wrapper).
///
/// # Errors
///
/// Returns a `JsValue` error string if compression fails.
#[wasm_bindgen]
pub fn compress(data: &[u8], level: u32) -> Result<Vec<u8>, JsValue> {
    // Clamp level to 1–9 for flate2 (flate2 uses 0–9; we map 1–12 → 1–9)
    let clamped = level.clamp(1, 9);
    let compression = flate2::Compression::new(clamped);

    // Pre-allocate output buffer — deflated data is typically smaller than
    // input, but we allocate input size as a starting point.  The encoder
    // will grow the Vec if needed.
    let estimated_size = data.len();
    let mut encoder = flate2::write::DeflateEncoder::new(
        Vec::with_capacity(estimated_size),
        compression,
    );

    encoder.write_all(data).map_err(to_js_err)?;
    let compressed = encoder.finish().map_err(to_js_err)?;

    Ok(compressed)
}

// ---------------------------------------------------------------------------
// Decompression
// ---------------------------------------------------------------------------

/// Decompress raw deflate bytes.
///
/// # Arguments
///
/// * `data`            — Compressed bytes in raw deflate format.
/// * `max_output_size` — Maximum allowed output size in bytes.  This is used
///                       to pre-allocate the output buffer and acts as a safety
///                       limit against decompression bombs.  If the decompressed
///                       data exceeds this limit, an error is returned.
///
/// # Returns
///
/// Decompressed bytes.
///
/// # Errors
///
/// Returns a `JsValue` error string if:
/// - The input is not valid deflate data.
/// - The decompressed output exceeds `max_output_size`.
#[wasm_bindgen]
pub fn decompress(data: &[u8], max_output_size: usize) -> Result<Vec<u8>, JsValue> {
    use std::io::Read;

    // Pre-allocate with a reasonable initial capacity
    let initial_capacity = max_output_size.min(data.len() * 4).max(1024);
    let mut output = Vec::with_capacity(initial_capacity);

    let mut decoder = flate2::read::DeflateDecoder::new(data);

    // Read in chunks to enforce the size limit
    let mut total_read = 0usize;
    let mut chunk = [0u8; 16384]; // 16 KiB read buffer

    loop {
        let n = decoder.read(&mut chunk).map_err(to_js_err)?;
        if n == 0 {
            break;
        }

        total_read += n;
        if total_read > max_output_size {
            return Err(JsValue::from_str(&format!(
                "modern-pdf-deflate: decompressed size ({}) exceeds max_output_size ({})",
                total_read, max_output_size
            )));
        }

        output.extend_from_slice(&chunk[..n]);
    }

    Ok(output)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_basic() {
        let input = b"Hello, modern-pdf! This is a test of deflate compression.";
        let compressed = compress(input, 6).expect("compress failed");
        assert!(!compressed.is_empty());
        assert!(compressed.len() < input.len() + 64);

        let decompressed = decompress(&compressed, input.len() * 2).expect("decompress failed");
        assert_eq!(&decompressed, input);
    }

    #[test]
    fn roundtrip_empty() {
        let input: &[u8] = b"";
        let compressed = compress(input, 6).expect("compress failed");
        let decompressed = decompress(&compressed, 1024).expect("decompress failed");
        assert!(decompressed.is_empty());
    }

    #[test]
    fn roundtrip_all_levels() {
        let input = b"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
        for level in 1..=12 {
            let compressed = compress(input, level).expect("compress failed");
            let decompressed = decompress(&compressed, input.len() * 2).expect("decompress failed");
            assert_eq!(&decompressed, input, "failed at level {}", level);
        }
    }

    #[test]
    fn decompress_size_limit() {
        let input = vec![0u8; 10000];
        let compressed = compress(&input, 1).expect("compress failed");

        // Try to decompress with a too-small limit
        let result = decompress(&compressed, 100);
        assert!(result.is_err());
    }

    #[test]
    fn roundtrip_large() {
        // ~64 KiB of pseudo-random-ish data
        let input: Vec<u8> = (0..65536).map(|i| (i * 7 + 13) as u8).collect();
        let compressed = compress(&input, 6).expect("compress failed");
        let decompressed = decompress(&compressed, input.len() * 2).expect("decompress failed");
        assert_eq!(decompressed, input);
    }
}
