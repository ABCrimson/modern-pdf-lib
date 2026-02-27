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
// Decoder
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
    let decoder = png::Decoder::new(data);
    let mut reader = decoder.read_info().map_err(to_js_err)?;

    let info = reader.info();
    let width = info.width;
    let height = info.height;
    let color_type = color_type_to_u8(info.color_type);
    let bit_depth = info.bit_depth as u8;

    // Extract palette (for indexed images)
    let palette = info
        .palette
        .as_ref()
        .map(|p| p.to_vec())
        .unwrap_or_default();

    // Extract transparency chunk
    let transparency = match &info.trns {
        Some(trns) => trns.to_vec(),
        None => Vec::new(),
    };

    // Allocate output buffer for pixel data
    let output_size = reader.output_buffer_size();
    let mut pixel_data = vec![0u8; output_size];

    // Read the image frame
    let frame_info = reader.next_frame(&mut pixel_data).map_err(to_js_err)?;

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
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    // TODO: Add tests with embedded minimal PNG test fixtures.
    //
    // Test cases to cover:
    // 1. 1x1 grayscale PNG
    // 2. 1x1 RGB PNG
    // 3. 1x1 RGBA PNG
    // 4. Small indexed PNG with palette
    // 5. PNG with tRNS chunk
    // 6. 16-bit depth PNG
    // 7. Interlaced PNG
    // 8. Invalid/corrupt PNG (error case)
    // 9. Empty data (error case)

    #[test]
    fn placeholder() {
        // TODO: Replace with real PNG test fixtures
        assert!(true, "PNG decoder tests need real PNG fixtures");
    }
}
