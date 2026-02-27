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
// Parser (core logic, testable without WASM)
// ---------------------------------------------------------------------------

/// Internal parsing logic that returns a standard Rust `Result`.
/// Used by the wasm-bindgen wrapper and by native tests.
fn parse_font_impl(data: &[u8]) -> Result<FontInfo, String> {
    let face = ttf_parser::Face::parse(data, 0)
        .map_err(|e| format!("modern-pdf-ttf: {}", e))?;

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
    let mut cmap_entries = Vec::new();

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
// WASM entry point
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
    parse_font_impl(data).map_err(|e| JsValue::from_str(&e))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a minimal valid TrueType font with the required tables.
    /// This creates a font with 2 glyphs (.notdef + one glyph for 'A').
    fn build_minimal_ttf() -> Vec<u8> {
        // TrueType offset table
        let num_tables: u16 = 8; // head, hhea, maxp, hmtx, cmap, name, post, OS/2
        let search_range: u16 = 128; // 2^(floor(log2(8))) * 16
        let entry_selector: u16 = 3;
        let range_shift: u16 = num_tables * 16 - search_range;

        let mut font = Vec::new();

        // Offset table (12 bytes)
        font.extend_from_slice(&0x00010000u32.to_be_bytes()); // sfVersion (TrueType)
        font.extend_from_slice(&num_tables.to_be_bytes());
        font.extend_from_slice(&search_range.to_be_bytes());
        font.extend_from_slice(&entry_selector.to_be_bytes());
        font.extend_from_slice(&range_shift.to_be_bytes());

        // We'll build table records (each 16 bytes) then table data
        // Table directory starts at offset 12, each record is 16 bytes
        // So table data starts at 12 + 8*16 = 140
        let dir_start = 12usize;
        let data_start = dir_start + (num_tables as usize) * 16;

        // Build each table's data first, then compute offsets
        let head = build_head_table();
        let hhea = build_hhea_table();
        let maxp = build_maxp_table(2); // 2 glyphs
        let hmtx = build_hmtx_table();
        let cmap = build_cmap_table();
        let name_tbl = build_name_table();
        let post = build_post_table();
        let os2 = build_os2_table();

        // Collect tables in alphabetical tag order for the directory
        let tables: Vec<(&[u8; 4], Vec<u8>)> = vec![
            (b"OS/2", os2),
            (b"cmap", cmap),
            (b"head", head),
            (b"hhea", hhea),
            (b"hmtx", hmtx),
            (b"maxp", maxp),
            (b"name", name_tbl),
            (b"post", post),
        ];

        // Compute offsets
        let mut offset = data_start;
        let mut records: Vec<(Vec<u8>, usize, usize)> = Vec::new();
        for (tag, data) in &tables {
            let len = data.len();
            let padded = (len + 3) & !3; // 4-byte aligned
            records.push((tag.to_vec(), offset, len));
            offset += padded;
        }

        // Write table directory
        for (i, (tag, data)) in tables.iter().enumerate() {
            let (_, tbl_offset, tbl_len) = &records[i];
            font.extend_from_slice(*tag);
            font.extend_from_slice(&checksum(data).to_be_bytes());
            font.extend_from_slice(&(*tbl_offset as u32).to_be_bytes());
            font.extend_from_slice(&(*tbl_len as u32).to_be_bytes());
        }

        // Write table data with 4-byte padding
        for (_tag, data) in &tables {
            font.extend_from_slice(data);
            let pad = (4 - (data.len() % 4)) % 4;
            font.extend_from_slice(&vec![0u8; pad]);
        }

        font
    }

    fn checksum(data: &[u8]) -> u32 {
        let mut sum: u32 = 0;
        let mut i = 0;
        while i + 3 < data.len() {
            sum = sum.wrapping_add(u32::from_be_bytes([data[i], data[i+1], data[i+2], data[i+3]]));
            i += 4;
        }
        if i < data.len() {
            let mut last = [0u8; 4];
            for (j, &b) in data[i..].iter().enumerate() {
                last[j] = b;
            }
            sum = sum.wrapping_add(u32::from_be_bytes(last));
        }
        sum
    }

    fn build_head_table() -> Vec<u8> {
        let mut t = Vec::new();
        t.extend_from_slice(&0x00010000u32.to_be_bytes()); // majorVersion.minorVersion
        t.extend_from_slice(&0x00005000u32.to_be_bytes()); // fontRevision (fixed 0.5)
        t.extend_from_slice(&0u32.to_be_bytes()); // checksumAdjustment
        t.extend_from_slice(&0x5F0F3CF5u32.to_be_bytes()); // magicNumber
        t.extend_from_slice(&0x000Bu16.to_be_bytes()); // flags
        t.extend_from_slice(&1000u16.to_be_bytes()); // unitsPerEm = 1000
        t.extend_from_slice(&0i64.to_be_bytes()); // created (LONGDATETIME)
        t.extend_from_slice(&0i64.to_be_bytes()); // modified (LONGDATETIME)
        t.extend_from_slice(&0i16.to_be_bytes()); // xMin
        t.extend_from_slice(&0i16.to_be_bytes()); // yMin
        t.extend_from_slice(&500i16.to_be_bytes()); // xMax
        t.extend_from_slice(&700i16.to_be_bytes()); // yMax
        t.extend_from_slice(&0u16.to_be_bytes()); // macStyle
        t.extend_from_slice(&8u16.to_be_bytes()); // lowestRecPPEM
        t.extend_from_slice(&2i16.to_be_bytes()); // fontDirectionHint
        t.extend_from_slice(&1i16.to_be_bytes()); // indexToLocFormat (long)
        t.extend_from_slice(&0i16.to_be_bytes()); // glyphDataFormat
        t
    }

    fn build_hhea_table() -> Vec<u8> {
        let mut t = Vec::new();
        t.extend_from_slice(&0x00010000u32.to_be_bytes()); // majorVersion.minorVersion
        t.extend_from_slice(&800i16.to_be_bytes()); // ascender
        t.extend_from_slice(&(-200i16).to_be_bytes()); // descender
        t.extend_from_slice(&0i16.to_be_bytes()); // lineGap
        t.extend_from_slice(&600u16.to_be_bytes()); // advanceWidthMax
        t.extend_from_slice(&0i16.to_be_bytes()); // minLeftSideBearing
        t.extend_from_slice(&0i16.to_be_bytes()); // minRightSideBearing
        t.extend_from_slice(&500i16.to_be_bytes()); // xMaxExtent
        t.extend_from_slice(&1i16.to_be_bytes()); // caretSlopeRise
        t.extend_from_slice(&0i16.to_be_bytes()); // caretSlopeRun
        t.extend_from_slice(&0i16.to_be_bytes()); // caretOffset
        t.extend_from_slice(&[0u8; 8]); // reserved (4 x i16)
        t.extend_from_slice(&0i16.to_be_bytes()); // metricDataFormat
        t.extend_from_slice(&2u16.to_be_bytes()); // numberOfHMetrics
        t
    }

    fn build_maxp_table(num_glyphs: u16) -> Vec<u8> {
        let mut t = Vec::new();
        t.extend_from_slice(&0x00005000u32.to_be_bytes()); // version 0.5
        t.extend_from_slice(&num_glyphs.to_be_bytes());
        t
    }

    fn build_hmtx_table() -> Vec<u8> {
        let mut t = Vec::new();
        // .notdef glyph: width=0, lsb=0
        t.extend_from_slice(&0u16.to_be_bytes());
        t.extend_from_slice(&0i16.to_be_bytes());
        // Glyph 1 ('A'): width=600, lsb=0
        t.extend_from_slice(&600u16.to_be_bytes());
        t.extend_from_slice(&0i16.to_be_bytes());
        t
    }

    fn build_cmap_table() -> Vec<u8> {
        let mut t = Vec::new();
        // cmap header
        t.extend_from_slice(&0u16.to_be_bytes()); // version
        t.extend_from_slice(&1u16.to_be_bytes()); // numTables

        // Encoding record: platform 0 (Unicode), encoding 3 (BMP)
        t.extend_from_slice(&0u16.to_be_bytes()); // platformID
        t.extend_from_slice(&3u16.to_be_bytes()); // encodingID
        t.extend_from_slice(&12u32.to_be_bytes()); // subtableOffset

        // Format 4 subtable mapping 'A' (U+0041) to glyph 1
        let seg_count = 2u16;
        let seg_count_x2 = seg_count * 2;
        let search_range = 4u16;
        let entry_selector = 1u16;
        let range_shift = seg_count_x2 - search_range;

        let subtable_start = t.len();
        t.extend_from_slice(&4u16.to_be_bytes()); // format
        let length_pos = t.len();
        t.extend_from_slice(&0u16.to_be_bytes()); // length (fill later)
        t.extend_from_slice(&0u16.to_be_bytes()); // language
        t.extend_from_slice(&seg_count_x2.to_be_bytes());
        t.extend_from_slice(&search_range.to_be_bytes());
        t.extend_from_slice(&entry_selector.to_be_bytes());
        t.extend_from_slice(&range_shift.to_be_bytes());

        // endCode array
        t.extend_from_slice(&0x0041u16.to_be_bytes()); // 'A'
        t.extend_from_slice(&0xFFFFu16.to_be_bytes()); // sentinel

        // reservedPad
        t.extend_from_slice(&0u16.to_be_bytes());

        // startCode array
        t.extend_from_slice(&0x0041u16.to_be_bytes()); // 'A'
        t.extend_from_slice(&0xFFFFu16.to_be_bytes()); // sentinel

        // idDelta array
        t.extend_from_slice(&(-0x40i16 as u16).to_be_bytes());
        t.extend_from_slice(&1u16.to_be_bytes()); // sentinel delta

        // idRangeOffset array
        t.extend_from_slice(&0u16.to_be_bytes()); // use delta
        t.extend_from_slice(&0u16.to_be_bytes()); // sentinel

        // Fill in subtable length
        let subtable_len = (t.len() - subtable_start) as u16;
        t[length_pos..length_pos+2].copy_from_slice(&subtable_len.to_be_bytes());

        t
    }

    /// Encode an ASCII string as UTF-16BE bytes for the name table.
    fn to_utf16be(s: &str) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(s.len() * 2);
        for c in s.chars() {
            bytes.extend_from_slice(&(c as u16).to_be_bytes());
        }
        bytes
    }

    fn build_name_table() -> Vec<u8> {
        let mut t = Vec::new();

        // Encode strings as UTF-16BE (platform 3 = Windows, encoding 1 = Unicode BMP)
        let family = to_utf16be("TestFont");
        let subfamily = to_utf16be("Regular");
        let ps_name = to_utf16be("TestFont-Regular");

        let num_records = 3u16;
        let storage_offset = 6 + num_records * 12;

        t.extend_from_slice(&0u16.to_be_bytes()); // format
        t.extend_from_slice(&num_records.to_be_bytes());
        t.extend_from_slice(&storage_offset.to_be_bytes());

        let mut str_offset = 0u16;

        // Family (nameID=1) — platform 3 (Windows), encoding 1 (Unicode BMP)
        t.extend_from_slice(&3u16.to_be_bytes()); // platformID (Windows)
        t.extend_from_slice(&1u16.to_be_bytes()); // encodingID (Unicode BMP)
        t.extend_from_slice(&0x0409u16.to_be_bytes()); // languageID (English US)
        t.extend_from_slice(&1u16.to_be_bytes()); // nameID (family)
        t.extend_from_slice(&(family.len() as u16).to_be_bytes());
        t.extend_from_slice(&str_offset.to_be_bytes());
        str_offset += family.len() as u16;

        // Subfamily (nameID=2)
        t.extend_from_slice(&3u16.to_be_bytes());
        t.extend_from_slice(&1u16.to_be_bytes());
        t.extend_from_slice(&0x0409u16.to_be_bytes());
        t.extend_from_slice(&2u16.to_be_bytes());
        t.extend_from_slice(&(subfamily.len() as u16).to_be_bytes());
        t.extend_from_slice(&str_offset.to_be_bytes());
        str_offset += subfamily.len() as u16;

        // PostScript name (nameID=6)
        t.extend_from_slice(&3u16.to_be_bytes());
        t.extend_from_slice(&1u16.to_be_bytes());
        t.extend_from_slice(&0x0409u16.to_be_bytes());
        t.extend_from_slice(&6u16.to_be_bytes());
        t.extend_from_slice(&(ps_name.len() as u16).to_be_bytes());
        t.extend_from_slice(&str_offset.to_be_bytes());

        // String storage (UTF-16BE encoded)
        t.extend_from_slice(&family);
        t.extend_from_slice(&subfamily);
        t.extend_from_slice(&ps_name);

        t
    }

    fn build_post_table() -> Vec<u8> {
        let mut t = Vec::new();
        t.extend_from_slice(&0x00030000u32.to_be_bytes()); // format 3.0
        t.extend_from_slice(&0x00000000u32.to_be_bytes()); // italicAngle
        t.extend_from_slice(&(-100i16).to_be_bytes()); // underlinePosition
        t.extend_from_slice(&50i16.to_be_bytes()); // underlineThickness
        t.extend_from_slice(&0u32.to_be_bytes()); // isFixedPitch
        t.extend_from_slice(&0u32.to_be_bytes()); // minMemType42
        t.extend_from_slice(&0u32.to_be_bytes()); // maxMemType42
        t.extend_from_slice(&0u32.to_be_bytes()); // minMemType1
        t.extend_from_slice(&0u32.to_be_bytes()); // maxMemType1
        t
    }

    fn build_os2_table() -> Vec<u8> {
        let mut t = vec![0u8; 78]; // version 1 is 78 bytes
        // version = 1
        t[0..2].copy_from_slice(&1u16.to_be_bytes());
        // xAvgCharWidth
        t[2..4].copy_from_slice(&500i16.to_be_bytes());
        // usWeightClass = 400 (Regular)
        t[4..6].copy_from_slice(&400u16.to_be_bytes());
        // usWidthClass = 5 (Normal)
        t[6..8].copy_from_slice(&5u16.to_be_bytes());
        // sTypoAscender at offset 68
        t[68..70].copy_from_slice(&800i16.to_be_bytes());
        // sTypoDescender at offset 70
        t[70..72].copy_from_slice(&(-200i16).to_be_bytes());
        // sTypoLineGap at offset 72
        t[72..74].copy_from_slice(&0i16.to_be_bytes());
        t
    }

    // ----- Actual tests -----

    #[test]
    fn parse_minimal_ttf_units_per_em() {
        let font = build_minimal_ttf();
        let info = parse_font_impl(&font).expect("should parse minimal TTF");
        assert_eq!(info.units_per_em, 1000);
    }

    #[test]
    fn parse_minimal_ttf_ascender_descender() {
        let font = build_minimal_ttf();
        let info = parse_font_impl(&font).expect("should parse");
        assert_eq!(info.ascender, 800);
        assert_eq!(info.descender, -200);
        assert_eq!(info.line_gap, 0);
    }

    #[test]
    fn parse_minimal_ttf_glyph_count() {
        let font = build_minimal_ttf();
        let info = parse_font_impl(&font).expect("should parse");
        assert_eq!(info.glyph_count, 2);
    }

    #[test]
    fn parse_minimal_ttf_glyph_widths() {
        let font = build_minimal_ttf();
        let info = parse_font_impl(&font).expect("should parse");
        assert_eq!(info.glyph_widths.len(), 2);
        assert_eq!(info.glyph_widths[0], 0);   // .notdef
        assert_eq!(info.glyph_widths[1], 600);  // glyph for 'A'
    }

    #[test]
    fn parse_minimal_ttf_glyph_widths_bytes() {
        let font = build_minimal_ttf();
        let info = parse_font_impl(&font).expect("should parse");
        let bytes = info.glyph_widths(); // Returns LE bytes
        assert_eq!(bytes.len(), 4); // 2 glyphs * 2 bytes
        // .notdef = 0 in LE
        assert_eq!(bytes[0], 0);
        assert_eq!(bytes[1], 0);
        // Glyph 1 = 600 in LE (0x0258)
        assert_eq!(u16::from_le_bytes([bytes[2], bytes[3]]), 600);
    }

    #[test]
    fn parse_minimal_ttf_cmap_has_a() {
        let font = build_minimal_ttf();
        let info = parse_font_impl(&font).expect("should parse");
        // cmap_entries is packed as [codepoint_u32_le, glyph_id_u16_le, ...]
        assert!(!info.cmap_entries.is_empty(), "cmap should have entries");
        assert_eq!(info.cmap_entries.len() % 6, 0, "entries should be 6 bytes each");

        // Find 'A' (U+0041)
        let mut found_a = false;
        for chunk in info.cmap_entries.chunks_exact(6) {
            let cp = u32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
            let gid = u16::from_le_bytes([chunk[4], chunk[5]]);
            if cp == 0x0041 {
                assert_eq!(gid, 1, "'A' should map to glyph 1");
                found_a = true;
            }
        }
        assert!(found_a, "cmap should contain mapping for 'A'");
    }

    #[test]
    fn parse_minimal_ttf_names() {
        let font = build_minimal_ttf();
        let info = parse_font_impl(&font).expect("should parse");
        assert_eq!(info.family_name, "TestFont");
        assert_eq!(info.subfamily_name, "Regular");
        assert_eq!(info.postscript_name, "TestFont-Regular");
    }

    #[test]
    fn parse_minimal_ttf_is_not_cff() {
        let font = build_minimal_ttf();
        let info = parse_font_impl(&font).expect("should parse");
        assert!(!info.is_cff, "minimal TTF should not be CFF");
    }

    #[test]
    fn parse_empty_data_fails() {
        let result = parse_font_impl(&[]);
        assert!(result.is_err(), "empty data should fail");
    }

    #[test]
    fn parse_garbage_data_fails() {
        let result = parse_font_impl(&[0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0x00, 0x00, 0x00]);
        assert!(result.is_err(), "garbage data should fail");
    }
}
