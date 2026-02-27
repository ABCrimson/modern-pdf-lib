//! WASM-compiled TrueType / OpenType font parser for the modern-pdf library.
//!
//! Parses font binary data and extracts metrics, glyph information, and
//! character-to-glyph mappings needed for PDF text rendering and font
//! embedding.
//!
//! Uses the `ttf-parser` crate which is a safe, zero-allocation font
//! parser that works well in WASM environments.
//!
//! # Extracted Data
//!
//! - Global metrics: units_per_em, ascender, descender, line_gap
//! - Glyph count and per-glyph advance widths
//! - Character-to-glyph ID mapping (cmap)
//! - Font name entries (family, subfamily)

use wasm_bindgen::prelude::*;

// ---------------------------------------------------------------------------
// Result structs
// ---------------------------------------------------------------------------

/// Parsed font information returned to JavaScript.
///
/// Contains global font metrics, glyph widths, and character mapping
/// data needed for PDF text layout and font embedding.
#[wasm_bindgen]
pub struct FontInfo {
    /// Font design units per em square.
    /// Typically 1000 (Type 1) or 2048 (TrueType).
    units_per_em: u16,

    /// Typographic ascender in font units (positive, above baseline).
    ascender: i16,

    /// Typographic descender in font units (negative, below baseline).
    descender: i16,

    /// Line gap in font units.
    line_gap: i16,

    /// Total number of glyphs in the font.
    glyph_count: u16,

    /// Per-glyph horizontal advance widths (one u16 per glyph, in font units).
    /// Indexed by glyph ID.
    glyph_widths: Vec<u16>,

    /// Character-to-glyph mapping: packed as [codepoint_u32, glyph_id_u16, ...].
    /// Each entry is 6 bytes: 4 bytes for the Unicode codepoint, 2 bytes for
    /// the glyph ID.
    ///
    /// This flat layout avoids wasm-bindgen overhead of returning complex
    /// structures.
    cmap_entries: Vec<u8>,

    /// Font family name (from the `name` table), UTF-8 encoded.
    family_name: String,

    /// Font subfamily name (e.g. "Regular", "Bold"), UTF-8 encoded.
    subfamily_name: String,

    /// PostScript name, UTF-8 encoded.
    postscript_name: String,

    /// Whether the font has a CFF (Compact Font Format) outline.
    /// `true` for OpenType/CFF (.otf), `false` for TrueType (.ttf).
    is_cff: bool,
}

#[wasm_bindgen]
impl FontInfo {
    /// Font units per em square.
    #[wasm_bindgen(getter)]
    pub fn units_per_em(&self) -> u16 {
        self.units_per_em
    }

    /// Typographic ascender (font units, positive).
    #[wasm_bindgen(getter)]
    pub fn ascender(&self) -> i16 {
        self.ascender
    }

    /// Typographic descender (font units, negative).
    #[wasm_bindgen(getter)]
    pub fn descender(&self) -> i16 {
        self.descender
    }

    /// Line gap (font units).
    #[wasm_bindgen(getter)]
    pub fn line_gap(&self) -> i16 {
        self.line_gap
    }

    /// Total number of glyphs.
    #[wasm_bindgen(getter)]
    pub fn glyph_count(&self) -> u16 {
        self.glyph_count
    }

    /// Per-glyph advance widths as a flat array of u16 values.
    ///
    /// In JavaScript this becomes a `Uint8Array` containing the raw
    /// bytes. Use a `DataView` or typed array conversion to read u16 values.
    /// Each glyph width is 2 bytes, little-endian.
    #[wasm_bindgen(getter)]
    pub fn glyph_widths(&self) -> Vec<u8> {
        // Flatten Vec<u16> into Vec<u8> (little-endian)
        let mut bytes = Vec::with_capacity(self.glyph_widths.len() * 2);
        for &w in &self.glyph_widths {
            bytes.extend_from_slice(&w.to_le_bytes());
        }
        bytes
    }

    /// Character-to-glyph mapping entries.
    ///
    /// Packed as [codepoint_u32_le, glyph_id_u16_le, ...] — each entry
    /// is 6 bytes. Total length = entry_count * 6.
    #[wasm_bindgen(getter)]
    pub fn cmap_entries(&self) -> Vec<u8> {
        self.cmap_entries.clone()
    }

    /// Font family name.
    #[wasm_bindgen(getter)]
    pub fn family_name(&self) -> String {
        self.family_name.clone()
    }

    /// Font subfamily name (e.g. "Regular", "Bold").
    #[wasm_bindgen(getter)]
    pub fn subfamily_name(&self) -> String {
        self.subfamily_name.clone()
    }

    /// PostScript name.
    #[wasm_bindgen(getter)]
    pub fn postscript_name(&self) -> String {
        self.postscript_name.clone()
    }

    /// Whether the font uses CFF outlines (OpenType/CFF).
    #[wasm_bindgen(getter)]
    pub fn is_cff(&self) -> bool {
        self.is_cff
    }
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

fn to_js_err<E: std::fmt::Display>(err: E) -> JsValue {
    JsValue::from_str(&format!("modern-pdf-ttf: {}", err))
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/// Parse a TrueType or OpenType font and extract metrics and mappings.
///
/// # Arguments
///
/// * `data` — Complete font file bytes (.ttf or .otf).
///
/// # Returns
///
/// A `FontInfo` struct containing all extracted font data.
///
/// # Errors
///
/// Returns a `JsValue` error string if:
/// - The input is not a valid TrueType/OpenType font.
/// - Required tables are missing or corrupt.
///
/// # Example (from JavaScript)
///
/// ```js
/// const info = parse_font(fontBytes);
/// console.log(`${info.family_name}: ${info.glyph_count} glyphs`);
/// console.log(`Ascender: ${info.ascender}, Descender: ${info.descender}`);
/// ```
#[wasm_bindgen]
pub fn parse_font(data: &[u8]) -> Result<FontInfo, JsValue> {
    let face = ttf_parser::Face::parse(data, 0).map_err(to_js_err)?;

    // -- Global metrics --
    let units_per_em = face.units_per_em();
    let ascender = face.ascender();
    let descender = face.descender();
    let line_gap = face.line_gap();
    let glyph_count = face.number_of_glyphs();

    // -- Per-glyph advance widths --
    let mut glyph_widths = Vec::with_capacity(glyph_count as usize);
    for gid in 0..glyph_count {
        let id = ttf_parser::GlyphId(gid);
        let advance = face.glyph_hor_advance(id).unwrap_or(0);
        glyph_widths.push(advance);
    }

    // -- Character-to-glyph mapping (cmap) --
    // We iterate all Unicode codepoints in the Basic Multilingual Plane
    // and the Supplementary Multilingual Plane to build the mapping.
    let mut cmap_entries = Vec::new();

    // Iterate cmap subtables to build character mappings
    if let Some(subtable) = face.tables().cmap {
        for subtable in subtable.subtables {
            if !subtable.is_unicode() {
                continue;
            }
            subtable.codepoints(|codepoint| {
                if let Some(glyph_id) = subtable.glyph_index(codepoint) {
                    // Pack: 4 bytes codepoint (LE) + 2 bytes glyph ID (LE)
                    cmap_entries.extend_from_slice(&codepoint.to_le_bytes());
                    cmap_entries.extend_from_slice(&glyph_id.0.to_le_bytes());
                }
            });
            // Use the first Unicode subtable we find
            break;
        }
    }

    // -- Font names --
    let family_name = face
        .names()
        .into_iter()
        .find(|n| n.name_id == ttf_parser::name_id::FAMILY)
        .and_then(|n| n.to_string())
        .unwrap_or_default();

    let subfamily_name = face
        .names()
        .into_iter()
        .find(|n| n.name_id == ttf_parser::name_id::SUBFAMILY)
        .and_then(|n| n.to_string())
        .unwrap_or_default();

    let postscript_name = face
        .names()
        .into_iter()
        .find(|n| n.name_id == ttf_parser::name_id::POST_SCRIPT_NAME)
        .and_then(|n| n.to_string())
        .unwrap_or_default();

    // -- Font type detection --
    let is_cff = face.tables().cff.is_some();

    Ok(FontInfo {
        units_per_em,
        ascender,
        descender,
        line_gap,
        glyph_count,
        glyph_widths,
        cmap_entries,
        family_name,
        subfamily_name,
        postscript_name,
        is_cff,
    })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    // TODO: Add tests with embedded minimal font test fixtures.
    //
    // Test cases to cover:
    // 1. Parse a minimal TrueType font
    // 2. Parse a minimal OpenType/CFF font
    // 3. Verify units_per_em extraction
    // 4. Verify ascender/descender values
    // 5. Verify glyph count matches expected
    // 6. Verify cmap entries for known characters
    // 7. Verify glyph widths for known glyphs
    // 8. Invalid/corrupt font data (error case)
    // 9. Empty data (error case)
    // 10. Font with no cmap table

    #[test]
    fn placeholder() {
        // TODO: Replace with real font test fixtures
        assert!(true, "TTF parser tests need real font fixtures");
    }
}
