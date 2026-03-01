//! WASM-compiled JPEG encoder/decoder module for the modern-pdf library.
//!
//! Provides JPEG encoding (raw pixels → JPEG bytes) and decoding (JPEG bytes →
//! raw pixels) via the `jpeg-encoder` and `jpeg-decoder` crates.  Compiled to
//! WebAssembly and consumed by the TypeScript bridge.
//!
//! # Exported Functions
//!
//! - `encode_jpeg(pixels, width, height, channels, quality, progressive, chroma)`
//!   — Encode raw pixels to JPEG bytes.
//! - `decode_jpeg(data)` — Decode JPEG bytes to raw pixels.  Returns a flat
//!   byte array with layout: `[width_u32_le, height_u32_le, channels_u8, ...pixels]`.

use std::io::Read;
use wasm_bindgen::prelude::*;

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

/// Convert a Rust error into a JsValue for wasm-bindgen.
fn to_js_err<E: std::fmt::Display>(err: E) -> JsValue {
    JsValue::from_str(&format!("modern-pdf-jpeg: {}", err))
}

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/// Encode raw pixel data into JPEG format.
///
/// # Arguments
///
/// * `pixels`   — Raw pixel data in row-major, channel-interleaved order.
/// * `width`    — Image width in pixels.
/// * `height`   — Image height in pixels.
/// * `channels` — Number of color channels: 1 (grayscale), 3 (RGB), or 4 (RGBA/CMYK).
/// * `quality`  — JPEG quality 1–100 (100 = best quality, largest file).
/// * `progressive` — If true, encode as progressive JPEG.
/// * `chroma_subsampling` — Chroma subsampling mode:
///   - 0 = 4:4:4 (no subsampling, best quality)
///   - 1 = 4:2:2 (horizontal subsampling)
///   - 2 = 4:2:0 (both directions, smallest file, default for most encoders)
///
/// # Returns
///
/// JPEG-encoded bytes.
///
/// # Errors
///
/// Returns a `JsValue` error string if encoding fails (e.g. invalid dimensions
/// or unsupported channel count).
#[wasm_bindgen]
pub fn encode_jpeg(
    pixels: &[u8],
    width: u32,
    height: u32,
    channels: u8,
    quality: u8,
    progressive: bool,
    chroma_subsampling: u8,
) -> Result<Vec<u8>, JsValue> {
    // Validate pixel data length
    let expected_len = (width as usize) * (height as usize) * (channels as usize);
    if pixels.len() != expected_len {
        return Err(JsValue::from_str(&format!(
            "modern-pdf-jpeg: pixel data length {} does not match {}x{}x{}={}",
            pixels.len(),
            width,
            height,
            channels,
            expected_len,
        )));
    }

    // Map channel count to jpeg-encoder ColorType
    let color_type = match channels {
        1 => jpeg_encoder::ColorType::Luma,
        3 => jpeg_encoder::ColorType::Rgb,
        4 => jpeg_encoder::ColorType::Rgba,
        _ => {
            return Err(JsValue::from_str(&format!(
                "modern-pdf-jpeg: unsupported channel count {}; expected 1, 3, or 4",
                channels,
            )));
        }
    };

    // Map chroma subsampling
    let sampling = match chroma_subsampling {
        0 => jpeg_encoder::SamplingFactor::R_4_4_4,
        1 => jpeg_encoder::SamplingFactor::R_4_2_2,
        _ => jpeg_encoder::SamplingFactor::R_4_2_0, // default
    };

    // Clamp quality to 1–100
    let clamped_quality = quality.clamp(1, 100);

    // Estimate output size (JPEG is typically much smaller than raw)
    let estimated_size = expected_len / 4;
    let mut output = Vec::with_capacity(estimated_size.max(4096));

    {
        let mut encoder = jpeg_encoder::Encoder::new(&mut output, clamped_quality);
        encoder.set_sampling_factor(sampling);

        if progressive {
            encoder.set_progressive(true);
        }

        encoder
            .encode(pixels, width as u16, height as u16, color_type)
            .map_err(to_js_err)?;
    }

    Ok(output)
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

/// Decode JPEG bytes into raw pixel data.
///
/// # Returns
///
/// A flat byte array with the following layout:
/// - Bytes 0–3: width as little-endian u32
/// - Bytes 4–7: height as little-endian u32
/// - Byte 8: number of channels (1 or 3)
/// - Bytes 9+: raw pixel data (row-major, channel-interleaved)
///
/// This flat layout avoids the overhead of returning a struct from WASM.
///
/// # Errors
///
/// Returns a `JsValue` error string if the input is not valid JPEG data.
#[wasm_bindgen]
pub fn decode_jpeg(data: &[u8]) -> Result<Vec<u8>, JsValue> {
    let mut decoder = jpeg_decoder::Decoder::new(std::io::Cursor::new(data));

    let pixels = decoder.decode().map_err(to_js_err)?;
    let info = decoder.info().ok_or_else(|| {
        JsValue::from_str("modern-pdf-jpeg: failed to read JPEG metadata after decoding")
    })?;

    let channels: u8 = match info.pixel_format {
        jpeg_decoder::PixelFormat::L8 => 1,
        jpeg_decoder::PixelFormat::L16 => {
            // 16-bit grayscale — convert to 8-bit by taking high byte
            let pixel_count = (info.width as usize) * (info.height as usize);
            let mut result =
                Vec::with_capacity(9 + pixel_count);

            // Header: width(4) + height(4) + channels(1)
            result.extend_from_slice(&info.width.to_le_bytes());
            result.extend_from_slice(&info.height.to_le_bytes());
            result.push(1);

            // Convert 16-bit to 8-bit
            for i in (0..pixels.len()).step_by(2) {
                // Little-endian: high byte is second
                result.push(pixels[i + 1]);
            }

            return Ok(result);
        }
        jpeg_decoder::PixelFormat::RGB24 => 3,
        jpeg_decoder::PixelFormat::CMYK32 => {
            // CMYK → RGB conversion
            let pixel_count = (info.width as usize) * (info.height as usize);
            let mut result =
                Vec::with_capacity(9 + pixel_count * 3);

            // Header
            result.extend_from_slice(&info.width.to_le_bytes());
            result.extend_from_slice(&info.height.to_le_bytes());
            result.push(3);

            // Convert CMYK to RGB (inverted CMYK, Adobe convention)
            for i in (0..pixels.len()).step_by(4) {
                let c = pixels[i] as f32 / 255.0;
                let m = pixels[i + 1] as f32 / 255.0;
                let y = pixels[i + 2] as f32 / 255.0;
                let k = pixels[i + 3] as f32 / 255.0;

                let r = (255.0 * (1.0 - c) * (1.0 - k)) as u8;
                let g = (255.0 * (1.0 - m) * (1.0 - k)) as u8;
                let b = (255.0 * (1.0 - y) * (1.0 - k)) as u8;

                result.push(r);
                result.push(g);
                result.push(b);
            }

            return Ok(result);
        }
    };

    // Standard case: L8 or RGB24
    let mut result = Vec::with_capacity(9 + pixels.len());

    // Header: width(4) + height(4) + channels(1)
    result.extend_from_slice(&info.width.to_le_bytes());
    result.extend_from_slice(&info.height.to_le_bytes());
    result.push(channels);

    // Pixel data
    result.extend_from_slice(&pixels);

    Ok(result)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    /// Create a simple 2x2 RGB test image.
    fn test_rgb_2x2() -> Vec<u8> {
        vec![
            255, 0, 0, // red
            0, 255, 0, // green
            0, 0, 255, // blue
            255, 255, 0, // yellow
        ]
    }

    /// Create a simple 2x2 grayscale test image.
    fn test_gray_2x2() -> Vec<u8> {
        vec![0, 85, 170, 255]
    }

    #[test]
    fn encode_rgb_basic() {
        let pixels = test_rgb_2x2();
        let result = encode_jpeg(&pixels, 2, 2, 3, 80, false, 0);
        assert!(result.is_ok());
        let jpeg = result.unwrap();
        // JPEG starts with SOI marker (0xFF 0xD8)
        assert!(jpeg.len() >= 2);
        assert_eq!(jpeg[0], 0xFF);
        assert_eq!(jpeg[1], 0xD8);
    }

    #[test]
    fn encode_grayscale_basic() {
        let pixels = test_gray_2x2();
        let result = encode_jpeg(&pixels, 2, 2, 1, 80, false, 0);
        assert!(result.is_ok());
        let jpeg = result.unwrap();
        assert_eq!(jpeg[0], 0xFF);
        assert_eq!(jpeg[1], 0xD8);
    }

    #[test]
    fn encode_rgba_basic() {
        let pixels = vec![
            255, 0, 0, 255, // red with alpha
            0, 255, 0, 128, // green with alpha
            0, 0, 255, 0, // blue with alpha
            255, 255, 0, 255, // yellow with alpha
        ];
        let result = encode_jpeg(&pixels, 2, 2, 4, 80, false, 0);
        assert!(result.is_ok());
    }

    #[test]
    fn encode_progressive() {
        let pixels = test_rgb_2x2();
        let result = encode_jpeg(&pixels, 2, 2, 3, 80, true, 0);
        assert!(result.is_ok());
    }

    #[test]
    fn encode_quality_range() {
        let pixels = test_rgb_2x2();
        for q in [1, 10, 50, 80, 95, 100] {
            let result = encode_jpeg(&pixels, 2, 2, 3, q, false, 2);
            assert!(result.is_ok(), "failed at quality {}", q);
        }
    }

    #[test]
    fn encode_chroma_subsampling_modes() {
        let pixels = test_rgb_2x2();
        for chroma in [0, 1, 2] {
            let result = encode_jpeg(&pixels, 2, 2, 3, 80, false, chroma);
            assert!(result.is_ok(), "failed at chroma mode {}", chroma);
        }
    }

    #[test]
    fn encode_invalid_pixel_length() {
        let pixels = vec![255, 0]; // too short for 2x2 RGB
        let result = encode_jpeg(&pixels, 2, 2, 3, 80, false, 0);
        assert!(result.is_err());
    }

    #[test]
    fn encode_invalid_channels() {
        let pixels = vec![0; 2 * 2 * 2]; // 2 channels
        let result = encode_jpeg(&pixels, 2, 2, 2, 80, false, 0);
        assert!(result.is_err());
    }

    #[test]
    fn roundtrip_rgb() {
        let pixels = test_rgb_2x2();
        let jpeg = encode_jpeg(&pixels, 2, 2, 3, 100, false, 0).unwrap();
        let decoded = decode_jpeg(&jpeg).unwrap();

        // Parse header
        let width = u16::from_le_bytes([decoded[0], decoded[1]]) as u32;
        let height = u16::from_le_bytes([decoded[2], decoded[3]]) as u32;
        // Note: width is u16 le in first 4 bytes (as le u32, low 2 bytes)
        let w = u32::from_le_bytes([decoded[0], decoded[1], decoded[2], decoded[3]]);
        let h = u32::from_le_bytes([decoded[4], decoded[5], decoded[6], decoded[7]]);
        let ch = decoded[8];

        assert_eq!(w, 2);
        assert_eq!(h, 2);
        assert_eq!(ch, 3);

        // JPEG is lossy, so pixel values won't match exactly
        // but decoded image should have correct number of pixels
        let pixel_data = &decoded[9..];
        assert_eq!(pixel_data.len(), 2 * 2 * 3);
    }

    #[test]
    fn roundtrip_grayscale() {
        let pixels = test_gray_2x2();
        let jpeg = encode_jpeg(&pixels, 2, 2, 1, 100, false, 0).unwrap();
        let decoded = decode_jpeg(&jpeg).unwrap();

        let w = u32::from_le_bytes([decoded[0], decoded[1], decoded[2], decoded[3]]);
        let h = u32::from_le_bytes([decoded[4], decoded[5], decoded[6], decoded[7]]);
        let ch = decoded[8];

        assert_eq!(w, 2);
        assert_eq!(h, 2);
        assert_eq!(ch, 1);

        let pixel_data = &decoded[9..];
        assert_eq!(pixel_data.len(), 2 * 2 * 1);
    }

    #[test]
    fn decode_invalid_data() {
        let result = decode_jpeg(&[0, 1, 2, 3]);
        assert!(result.is_err());
    }

    #[test]
    fn encode_large_image() {
        // 256x256 RGB gradient
        let mut pixels = Vec::with_capacity(256 * 256 * 3);
        for y in 0..256u16 {
            for x in 0..256u16 {
                pixels.push(x as u8);
                pixels.push(y as u8);
                pixels.push(((x + y) / 2) as u8);
            }
        }

        let jpeg = encode_jpeg(&pixels, 256, 256, 3, 85, false, 2).unwrap();
        assert!(jpeg.len() < pixels.len(), "JPEG should be smaller than raw");

        // Verify it decodes back
        let decoded = decode_jpeg(&jpeg).unwrap();
        let w = u32::from_le_bytes([decoded[0], decoded[1], decoded[2], decoded[3]]);
        let h = u32::from_le_bytes([decoded[4], decoded[5], decoded[6], decoded[7]]);
        assert_eq!(w, 256);
        assert_eq!(h, 256);
    }

    #[test]
    fn encode_progressive_larger() {
        // 64x64 gradient for progressive encoding
        let mut pixels = Vec::with_capacity(64 * 64 * 3);
        for y in 0..64u16 {
            for x in 0..64u16 {
                pixels.push((x * 4) as u8);
                pixels.push((y * 4) as u8);
                pixels.push(128);
            }
        }

        let baseline = encode_jpeg(&pixels, 64, 64, 3, 80, false, 2).unwrap();
        let progressive = encode_jpeg(&pixels, 64, 64, 3, 80, true, 2).unwrap();

        // Both should produce valid JPEG
        assert_eq!(baseline[0], 0xFF);
        assert_eq!(baseline[1], 0xD8);
        assert_eq!(progressive[0], 0xFF);
        assert_eq!(progressive[1], 0xD8);

        // Both should decode to same dimensions
        let dec_b = decode_jpeg(&baseline).unwrap();
        let dec_p = decode_jpeg(&progressive).unwrap();
        assert_eq!(
            &dec_b[0..9],
            &dec_p[0..9],
            "headers should match",
        );
    }

    #[test]
    fn encode_1x1() {
        // Edge case: 1x1 pixel
        let pixels = vec![128, 64, 32]; // single RGB pixel
        let jpeg = encode_jpeg(&pixels, 1, 1, 3, 90, false, 0).unwrap();
        assert_eq!(jpeg[0], 0xFF);
        assert_eq!(jpeg[1], 0xD8);

        let decoded = decode_jpeg(&jpeg).unwrap();
        let w = u32::from_le_bytes([decoded[0], decoded[1], decoded[2], decoded[3]]);
        let h = u32::from_le_bytes([decoded[4], decoded[5], decoded[6], decoded[7]]);
        assert_eq!(w, 1);
        assert_eq!(h, 1);
    }
}
