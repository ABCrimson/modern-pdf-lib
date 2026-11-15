//! WASM-compiled PNG decoder for the modern-pdf library.
//!
//! Decodes PNG image data and returns raw pixel data along with image
//! metadata (width, height, color type, bit depth). This is used by the
//! TypeScript PNG embedding module to extract pixel data for PDF image
//! XObjects.
//!
//! # Supported Color Types
//!
//! All PNG color types defined in the PNG specification are handled:
//! - Grayscale (0)
//! - RGB (2)
//! - Indexed / Palette (3)
//! - Grayscale + Alpha (4)
//! - RGBA (6)
//!
//! # Output Format
//!
//! The decoder returns a `PngDecodeResult` struct via wasm-bindgen,
//! containing the image dimensions, color metadata, and raw pixel data
//! in the decoded color format.

use std::io::Cursor;
use wasm_bindgen::prelude::*;

// ---------------------------------------------------------------------------
// Result struct
// ---------------------------------------------------------------------------

/// Result of decoding a PNG image.
///
/// Returned to JavaScript as a wasm-bindgen struct with getter methods.
#[wasm_bindgen]
pub struct PngDecodeResult {
    /// Image width in pixels.
    width: u32,

    /// Image height in pixels.
    height: u32,

    /// PNG color type:
    /// - 0 = Grayscale
    /// - 2 = RGB
    /// - 3 = Indexed (palette)
    /// - 4 = Grayscale + Alpha
    /// - 6 = RGBA
    color_type: u8,

    /// Bits per sample (1, 2, 4, 8, or 16).
    bit_depth: u8,

    /// Raw decoded pixel data in the native color format.
    /// For indexed images, this contains palette indices (not expanded RGB).
    pixel_data: Vec<u8>,

    /// Palette data for indexed images (3 bytes per entry: R, G, B).
    /// Empty for non-indexed images.
    palette: Vec<u8>,

    /// Transparency data (tRNS chunk):
    /// - For indexed: one alpha byte per palette entry.
    /// - For grayscale: 2 bytes (16-bit transparent gray value).
    /// - For RGB: 6 bytes (16-bit R, G, B transparent color).
    /// Empty if no transparency chunk is present.
    transparency: Vec<u8>,
}

#[wasm_bindgen]
impl PngDecodeResult {
    /// Get the image width in pixels.
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.width
    }

    /// Get the image height in pixels.
    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.height
    }

    /// Get the PNG color type code.
    #[wasm_bindgen(getter)]
    pub fn color_type(&self) -> u8 {
        self.color_type
    }

    /// Get the bit depth per sample.
    #[wasm_bindgen(getter)]
    pub fn bit_depth(&self) -> u8 {
        self.bit_depth
    }

    /// Get the raw pixel data.
    ///
    /// Returns a copy of the pixel data as a `Vec<u8>` (transferred to
    /// JS as a `Uint8Array`).
    #[wasm_bindgen(getter)]
    pub fn pixel_data(&self) -> Vec<u8> {
        self.pixel_data.clone()
    }

    /// Get the palette data (for indexed color images).
    ///
    /// Each palette entry is 3 bytes (R, G, B). Returns empty for
    /// non-indexed images.
    #[wasm_bindgen(getter)]
    pub fn palette(&self) -> Vec<u8> {
        self.palette.clone()
    }

    /// Get the transparency (tRNS) data.
    ///
    /// Format depends on color type. Returns empty if no tRNS chunk.
    #[wasm_bindgen(getter)]
    pub fn transparency(&self) -> Vec<u8> {
        self.transparency.clone()
    }
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

/// Convert a Rust error into a JsValue for wasm-bindgen.
fn to_js_err<E: std::fmt::Display>(err: E) -> JsValue {
    JsValue::from_str(&format!("modern-pdf-png: {}", err))
}

/// Map a `png` crate ColorType to the PNG spec integer code.
fn color_type_to_u8(ct: png::ColorType) -> u8 {
    match ct {
        png::ColorType::Grayscale => 0,
        png::ColorType::Rgb => 2,
        png::ColorType::Indexed => 3,
        png::ColorType::GrayscaleAlpha => 4,
        png::ColorType::Rgba => 6,
    }
}

// ---------------------------------------------------------------------------
// Decoder (core logic, testable without WASM)
// ---------------------------------------------------------------------------

/// Internal decoding logic that returns a standard Rust `Result`.
/// Used by the wasm-bindgen wrapper and by native tests.
fn decode_png_impl(data: &[u8]) -> Result<PngDecodeResult, String> {
    let cursor = Cursor::new(data);
    let decoder = png::Decoder::new(cursor);
    let mut reader = decoder.read_info().map_err(|e| format!("modern-pdf-png: {}", e))?;

    let info = reader.info();
    let width = info.width;
    let height = info.height;
    let color_type = color_type_to_u8(info.color_type);
    let bit_depth = info.bit_depth as u8;

    // Extract palette (for indexed images)
    let palette: Vec<u8> = info
        .palette
        .as_ref()
        .map(|p| p.to_vec())
        .unwrap_or_default();

    // Extract transparency chunk
    let transparency: Vec<u8> = match &info.trns {
        Some(trns) => trns.to_vec(),
        None => Vec::new(),
    };

    // Allocate output buffer for pixel data
    let output_size = reader.output_buffer_size()
        .ok_or_else(|| "modern-pdf-png: could not determine output buffer size".to_string())?;
    let mut pixel_data = vec![0u8; output_size];

    // Read the image frame
    let frame_info = reader.next_frame(&mut pixel_data)
        .map_err(|e| format!("modern-pdf-png: {}", e))?;

    // Trim the pixel data to the actual frame size
    pixel_data.truncate(frame_info.buffer_size());

    Ok(PngDecodeResult {
        width,
        height,
        color_type,
        bit_depth,
        pixel_data,
        palette,
        transparency,
    })
}

// ---------------------------------------------------------------------------
// WASM entry point
// ---------------------------------------------------------------------------

/// Decode a PNG image from raw bytes.
///
/// # Arguments
///
/// * `data` — Complete PNG file bytes (including the PNG signature).
///
/// # Returns
///
/// A `PngDecodeResult` containing image metadata and raw pixel data.
///
/// # Errors
///
/// Returns a `JsValue` error string if:
/// - The input is not a valid PNG file.
/// - The PNG is corrupt or uses an unsupported feature.
/// - Memory allocation fails (e.g., extremely large images).
///
/// # Color Handling
///
/// The decoder preserves the native color format of the PNG:
/// - Grayscale images return grayscale pixel data.
/// - RGB images return interleaved R,G,B bytes.
/// - RGBA images return interleaved R,G,B,A bytes.
/// - Indexed images return palette indices; the palette is returned
///   separately.
/// - Grayscale+Alpha images return interleaved Gray,Alpha bytes.
///
/// The TypeScript layer is responsible for converting to the appropriate
/// PDF color space.
#[wasm_bindgen]
pub fn decode_png(data: &[u8]) -> Result<PngDecodeResult, JsValue> {
    decode_png_impl(data).map_err(|e| JsValue::from_str(&e))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    /// Create a minimal valid PNG file programmatically.
    /// Uses the `png` crate's encoder to create test data.
    fn build_png(width: u32, height: u32, color_type: png::ColorType, bit_depth: png::BitDepth, pixels: &[u8]) -> Vec<u8> {
        let mut buf = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut buf, width, height);
            encoder.set_color(color_type);
            encoder.set_depth(bit_depth);
            let mut writer = encoder.write_header().expect("write PNG header");
            writer.write_image_data(pixels).expect("write PNG data");
        }
        buf
    }

    #[test]
    fn decode_1x1_rgb() {
        let pixels = [255u8, 0, 0]; // Single red pixel
        let png_data = build_png(1, 1, png::ColorType::Rgb, png::BitDepth::Eight, &pixels);

        let result = decode_png_impl(&png_data).expect("should decode RGB PNG");
        assert_eq!(result.width, 1);
        assert_eq!(result.height, 1);
        assert_eq!(result.color_type, 2); // RGB
        assert_eq!(result.bit_depth, 8);
        assert_eq!(result.pixel_data, vec![255, 0, 0]);
        assert!(result.palette.is_empty());
        assert!(result.transparency.is_empty());
    }

    #[test]
    fn decode_1x1_rgba() {
        let pixels = [0u8, 255, 0, 128]; // Green with 50% alpha
        let png_data = build_png(1, 1, png::ColorType::Rgba, png::BitDepth::Eight, &pixels);

        let result = decode_png_impl(&png_data).expect("should decode RGBA PNG");
        assert_eq!(result.width, 1);
        assert_eq!(result.height, 1);
        assert_eq!(result.color_type, 6); // RGBA
        assert_eq!(result.bit_depth, 8);
        assert_eq!(result.pixel_data, vec![0, 255, 0, 128]);
    }

    #[test]
    fn decode_1x1_grayscale() {
        let pixels = [127u8]; // Mid-gray
        let png_data = build_png(1, 1, png::ColorType::Grayscale, png::BitDepth::Eight, &pixels);

        let result = decode_png_impl(&png_data).expect("should decode grayscale PNG");
        assert_eq!(result.width, 1);
        assert_eq!(result.height, 1);
        assert_eq!(result.color_type, 0); // Grayscale
        assert_eq!(result.bit_depth, 8);
        assert_eq!(result.pixel_data, vec![127]);
    }

    #[test]
    fn decode_2x2_rgb() {
        // 2x2 image: red, green, blue, white
        let pixels = [
            255, 0, 0,    0, 255, 0,     // row 1
            0, 0, 255,    255, 255, 255,  // row 2
        ];
        let png_data = build_png(2, 2, png::ColorType::Rgb, png::BitDepth::Eight, &pixels);

        let result = decode_png_impl(&png_data).expect("should decode 2x2 RGB PNG");
        assert_eq!(result.width, 2);
        assert_eq!(result.height, 2);
        assert_eq!(result.pixel_data.len(), 12); // 2*2*3
        // Verify first pixel is red
        assert_eq!(&result.pixel_data[0..3], &[255, 0, 0]);
    }

    #[test]
    fn decode_grayscale_alpha() {
        let pixels = [200u8, 128]; // Gray with alpha
        let png_data = build_png(1, 1, png::ColorType::GrayscaleAlpha, png::BitDepth::Eight, &pixels);

        let result = decode_png_impl(&png_data).expect("should decode grayscale+alpha PNG");
        assert_eq!(result.color_type, 4); // GrayscaleAlpha
        assert_eq!(result.pixel_data, vec![200, 128]);
    }

    #[test]
    fn decode_empty_data_fails() {
        let result = decode_png_impl(&[]);
        assert!(result.is_err(), "empty data should fail");
    }

    #[test]
    fn decode_invalid_data_fails() {
        let result = decode_png_impl(&[0xDE, 0xAD, 0xBE, 0xEF]);
        assert!(result.is_err(), "invalid data should fail");
    }

    #[test]
    fn decode_truncated_png_fails() {
        // Valid PNG signature but truncated
        let result = decode_png_impl(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        assert!(result.is_err(), "truncated PNG should fail");
    }
}
