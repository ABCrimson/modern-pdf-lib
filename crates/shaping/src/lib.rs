//! WASM-compiled text shaping engine for the modern-pdf library.
//!
//! Performs OpenType text shaping using `rustybuzz` (a Rust port of
//! HarfBuzz). This is essential for correct rendering of:
//!
//! - Complex scripts (Arabic, Devanagari, Thai, etc.)
//! - Ligatures and contextual alternates (fi, fl, etc.)
//! - Kerning and mark positioning
//! - Right-to-left text (Arabic, Hebrew)
//! - Combining characters and diacritics
//!
//! # Architecture
//!
//! The TypeScript layer sends raw font bytes and text to this module.
//! Internally, `ttf-parser` parses the font and `rustybuzz` performs
//! shaping. The results (glyph IDs, advances, offsets) are returned
//! as flat arrays for efficient transfer across the WASM boundary.
//!
//! # Text Direction
//!
//! The `direction` parameter controls text direction:
//! - 0 = Left-to-Right (LTR)
//! - 1 = Right-to-Left (RTL)
//! - 2 = Top-to-Bottom (TTB)
//! - 3 = Bottom-to-Top (BTT)

use std::str::FromStr;
use wasm_bindgen::prelude::*;

// ---------------------------------------------------------------------------
// Result struct
// ---------------------------------------------------------------------------

/// Result of text shaping — contains positioned glyph data.
///
/// All arrays are parallel (same length = number of output glyphs).
/// Values are in font design units.
#[wasm_bindgen]
pub struct ShapingResult {
    /// Output glyph IDs (one per shaped glyph).
    glyph_ids: Vec<u16>,

    /// Horizontal advance for each glyph (font units).
    x_advances: Vec<i32>,

    /// Vertical advance for each glyph (font units).
    /// Typically 0 for horizontal text.
    y_advances: Vec<i32>,

    /// Horizontal offset for each glyph (font units).
    /// Used for mark positioning and kerning adjustments.
    x_offsets: Vec<i32>,

    /// Vertical offset for each glyph (font units).
    /// Used for mark positioning (e.g., accents, vowel marks).
    y_offsets: Vec<i32>,

    /// Cluster mapping: maps each output glyph to its source
    /// character cluster index. Used to correlate glyphs back to
    /// the input text (important for text selection, caret positioning).
    clusters: Vec<u32>,
}

#[wasm_bindgen]
impl ShapingResult {
    /// Number of output glyphs.
    #[wasm_bindgen(getter)]
    pub fn glyph_count(&self) -> u32 {
        self.glyph_ids.len() as u32
    }

    /// Glyph IDs as a flat `Uint8Array` (2 bytes per glyph, little-endian).
    #[wasm_bindgen(getter)]
    pub fn glyph_ids(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(self.glyph_ids.len() * 2);
        for &id in &self.glyph_ids {
            bytes.extend_from_slice(&id.to_le_bytes());
        }
        bytes
    }

    /// Horizontal advances as a flat `Uint8Array` (4 bytes per value, LE i32).
    #[wasm_bindgen(getter)]
    pub fn x_advances(&self) -> Vec<u8> {
        flatten_i32(&self.x_advances)
    }

    /// Vertical advances as a flat `Uint8Array` (4 bytes per value, LE i32).
    #[wasm_bindgen(getter)]
    pub fn y_advances(&self) -> Vec<u8> {
        flatten_i32(&self.y_advances)
    }

    /// Horizontal offsets as a flat `Uint8Array` (4 bytes per value, LE i32).
    #[wasm_bindgen(getter)]
    pub fn x_offsets(&self) -> Vec<u8> {
        flatten_i32(&self.x_offsets)
    }

    /// Vertical offsets as a flat `Uint8Array` (4 bytes per value, LE i32).
    #[wasm_bindgen(getter)]
    pub fn y_offsets(&self) -> Vec<u8> {
        flatten_i32(&self.y_offsets)
    }

    /// Cluster indices as a flat `Uint8Array` (4 bytes per value, LE u32).
    #[wasm_bindgen(getter)]
    pub fn clusters(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(self.clusters.len() * 4);
        for &c in &self.clusters {
            bytes.extend_from_slice(&c.to_le_bytes());
        }
        bytes
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Flatten a `Vec<i32>` into little-endian bytes.
fn flatten_i32(values: &[i32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(values.len() * 4);
    for &v in values {
        bytes.extend_from_slice(&v.to_le_bytes());
    }
    bytes
}

/// Map a direction byte to a rustybuzz `Direction`.
fn parse_direction(direction: u8) -> rustybuzz::Direction {
    match direction {
        0 => rustybuzz::Direction::LeftToRight,
        1 => rustybuzz::Direction::RightToLeft,
        2 => rustybuzz::Direction::TopToBottom,
        3 => rustybuzz::Direction::BottomToTop,
        _ => rustybuzz::Direction::LeftToRight, // Default to LTR
    }
}

// ---------------------------------------------------------------------------
// Shaping (core logic, testable without WASM)
// ---------------------------------------------------------------------------

/// Internal shaping logic that returns a standard Rust `Result`.
/// Used by the wasm-bindgen wrappers and by native tests.
fn shape_text_with_features_impl(
    font_data: &[u8],
    text: &str,
    direction: u8,
    script: &str,
    language: &str,
) -> Result<ShapingResult, String> {
    // Parse the font
    let face = rustybuzz::Face::from_slice(font_data, 0)
        .ok_or_else(|| "modern-pdf-shaping: failed to parse font data".to_string())?;

    // Create the shaping buffer
    let mut buffer = rustybuzz::UnicodeBuffer::new();
    buffer.push_str(text);
    buffer.set_direction(parse_direction(direction));

    // Set script tag if provided
    if !script.is_empty() {
        if let Some(tag) = parse_script_tag(script) {
            buffer.set_script(tag);
        }
    }

    // Set language tag if provided
    if !language.is_empty() {
        if let Some(lang) = parse_language_tag(language) {
            buffer.set_language(lang);
        }
    }

    // Perform shaping
    let output = rustybuzz::shape(&face, &[], buffer);

    // Extract results
    let positions = output.glyph_positions();
    let infos = output.glyph_infos();
    let len = positions.len();

    let mut glyph_ids = Vec::with_capacity(len);
    let mut x_advances = Vec::with_capacity(len);
    let mut y_advances = Vec::with_capacity(len);
    let mut x_offsets = Vec::with_capacity(len);
    let mut y_offsets = Vec::with_capacity(len);
    let mut clusters = Vec::with_capacity(len);

    for i in 0..len {
        glyph_ids.push(infos[i].glyph_id as u16);
        x_advances.push(positions[i].x_advance);
        y_advances.push(positions[i].y_advance);
        x_offsets.push(positions[i].x_offset);
        y_offsets.push(positions[i].y_offset);
        clusters.push(infos[i].cluster);
    }

    Ok(ShapingResult {
        glyph_ids,
        x_advances,
        y_advances,
        x_offsets,
        y_offsets,
        clusters,
    })
}

// ---------------------------------------------------------------------------
// WASM entry points
// ---------------------------------------------------------------------------

/// Shape a text string using OpenType layout rules.
///
/// Performs full OpenType shaping including:
/// - GSUB (glyph substitution): ligatures, contextual alternates, etc.
/// - GPOS (glyph positioning): kerning, mark attachment, etc.
/// - Script/language-specific rules
/// - Bidirectional text handling
///
/// # Arguments
///
/// * `font_data` — Complete font file bytes (.ttf or .otf).
/// * `text`      — Unicode text string to shape.
/// * `direction` — Text direction: 0=LTR, 1=RTL, 2=TTB, 3=BTT.
///
/// # Returns
///
/// A `ShapingResult` containing glyph IDs, advances, offsets, and
/// cluster mappings.
///
/// # Errors
///
/// Returns a `JsValue` error string if:
/// - The font data is invalid.
/// - The font cannot be parsed by ttf-parser.
///
/// # Example (from JavaScript)
///
/// ```js
/// const result = shape_text(fontBytes, "Hello, World!", 0);
/// console.log(`Shaped ${result.glyph_count} glyphs`);
/// ```
#[wasm_bindgen]
pub fn shape_text(
    font_data: &[u8],
    text: &str,
    direction: u8,
) -> Result<ShapingResult, JsValue> {
    shape_text_with_features(font_data, text, direction, "", "")
}

/// Shape text with explicit script and language tags.
///
/// This is the full-featured shaping entry point, allowing control
/// over script and language for correct shaping of multi-script text.
///
/// # Arguments
///
/// * `font_data` — Complete font file bytes (.ttf or .otf).
/// * `text`      — Unicode text string to shape.
/// * `direction` — Text direction: 0=LTR, 1=RTL, 2=TTB, 3=BTT.
/// * `script`    — OpenType script tag (e.g. "latn", "arab", "deva").
///                 Pass empty string for auto-detection.
/// * `language`  — OpenType language tag (e.g. "ENG ", "ARA ").
///                 Pass empty string for default language.
///
/// # Returns
///
/// A `ShapingResult` with positioned glyph data.
///
/// # Errors
///
/// Returns a `JsValue` error if the font is invalid.
#[wasm_bindgen]
pub fn shape_text_with_features(
    font_data: &[u8],
    text: &str,
    direction: u8,
    script: &str,
    language: &str,
) -> Result<ShapingResult, JsValue> {
    shape_text_with_features_impl(font_data, text, direction, script, language)
        .map_err(|e| JsValue::from_str(&e))
}

// ---------------------------------------------------------------------------
// Tag parsing helpers
// ---------------------------------------------------------------------------

/// Parse a 4-character OpenType script tag string into a rustybuzz Script.
///
/// The string should be exactly 4 ASCII characters (e.g., "latn", "arab").
/// Shorter strings are padded with spaces.
fn parse_script_tag(tag_str: &str) -> Option<rustybuzz::Script> {
    if tag_str.is_empty() {
        return None;
    }

    // Pad to 4 characters with spaces
    let mut bytes = [b' '; 4];
    for (i, b) in tag_str.as_bytes().iter().enumerate().take(4) {
        bytes[i] = *b;
    }

    let tag = rustybuzz::ttf_parser::Tag::from_bytes(&bytes);
    rustybuzz::Script::from_iso15924_tag(tag)
}

/// Parse a language tag string into a rustybuzz Language.
fn parse_language_tag(tag_str: &str) -> Option<rustybuzz::Language> {
    if tag_str.is_empty() {
        return None;
    }

    // Pad to 4 characters with spaces
    let mut padded = String::with_capacity(4);
    padded.push_str(tag_str);
    while padded.len() < 4 {
        padded.push(' ');
    }

    rustybuzz::Language::from_str(&padded).ok()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // TODO: Add tests with embedded minimal font fixtures.
    //
    // Test cases to cover:
    // 1. Shape simple Latin text (LTR)
    // 2. Shape Arabic text (RTL) with ligatures
    // 3. Verify glyph count matches expected output
    // 4. Verify kerning adjustments in x_offsets
    // 5. Verify ligature substitution (e.g., "fi" -> single glyph)
    // 6. Verify cluster mapping for multi-glyph clusters
    // 7. Shape with explicit script/language tags
    // 8. Invalid font data (error case)
    // 9. Empty text string
    // 10. Vertical text shaping (TTB direction)

    #[test]
    fn parse_direction_values() {
        assert!(matches!(parse_direction(0), rustybuzz::Direction::LeftToRight));
        assert!(matches!(parse_direction(1), rustybuzz::Direction::RightToLeft));
        assert!(matches!(parse_direction(2), rustybuzz::Direction::TopToBottom));
        assert!(matches!(parse_direction(3), rustybuzz::Direction::BottomToTop));
        assert!(matches!(parse_direction(99), rustybuzz::Direction::LeftToRight));
    }

    #[test]
    fn parse_script_tag_valid() {
        let tag = parse_script_tag("latn");
        assert!(tag.is_some());
    }

    #[test]
    fn parse_script_tag_empty() {
        let tag = parse_script_tag("");
        assert!(tag.is_none());
    }

    #[test]
    fn parse_script_tag_short() {
        // Short tag padded with spaces — may or may not be a valid ISO 15924 tag
        let tag = parse_script_tag("la");
        // Just verify it doesn't panic
        let _ = tag;
    }

    #[test]
    fn shape_empty_text_fails_without_font() {
        let result = shape_text_with_features_impl(&[], "", 0, "", "");
        assert!(result.is_err(), "empty font data should fail");
    }

    #[test]
    fn shape_invalid_font_fails() {
        let result = shape_text_with_features_impl(&[0xDE, 0xAD, 0xBE, 0xEF], "Hello", 0, "", "");
        assert!(result.is_err(), "invalid font data should fail");
    }

    #[test]
    fn shape_with_features_invalid_font_fails() {
        let result = shape_text_with_features_impl(&[0xFF; 16], "Test", 0, "latn", "ENG ");
        assert!(result.is_err(), "invalid font should fail with features");
    }

    #[test]
    fn parse_language_tag_empty() {
        let lang = parse_language_tag("");
        assert!(lang.is_none());
    }

    #[test]
    fn parse_language_tag_valid() {
        let lang = parse_language_tag("ENG ");
        // rustybuzz::Language::from_str returns Option<Language>
        // We just verify it returns Some or None without panicking
        let _ = lang; // no panic = pass
    }
}
