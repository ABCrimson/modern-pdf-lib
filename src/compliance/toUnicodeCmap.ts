/**
 * @module compliance/toUnicodeCmap
 *
 * ToUnicode CMap generator for PDF/A compliance.
 *
 * PDF/A-2u (and higher) requires every font to have a ToUnicode CMap
 * so that text can be extracted from the PDF. The standard 14 fonts
 * don't normally include this, so we generate it.
 *
 * A ToUnicode CMap maps character codes to Unicode code points:
 *
 * ```
 * /CMapType 2 def
 * 1 begincodespacerange
 * <00> <FF>
 * endcodespacerange
 * N beginbfchar
 * <XX> <UUUU>
 * endbfchar
 * ```
 *
 * Three encodings are supported:
 * - **WinAnsi** (Windows-1252): used by the 12 Latin standard fonts
 * - **Symbol**: Adobe Symbol encoding
 * - **ZapfDingbats**: Adobe ZapfDingbats encoding
 *
 * Reference: PDF Reference 1.7, Section 5.9 — ToUnicode CMaps;
 *            Adobe Glyph List; Windows-1252 code page.
 */

// ---------------------------------------------------------------------------
// WinAnsi (Windows-1252) → Unicode
// ---------------------------------------------------------------------------

/**
 * WinAnsi codes 128–159 that differ from ISO 8859-1.
 * Codes not listed here (129, 141, 143, 144, 157) are undefined in
 * Windows-1252 and must be omitted from the CMap.
 */
const WIN_ANSI_TO_UNICODE: Record<number, number> = {
  128: 0x20AC, // €  Euro sign
  130: 0x201A, // ‚  Single low-9 quotation mark
  131: 0x0192, // ƒ  Latin small letter f with hook
  132: 0x201E, // „  Double low-9 quotation mark
  133: 0x2026, // …  Horizontal ellipsis
  134: 0x2020, // †  Dagger
  135: 0x2021, // ‡  Double dagger
  136: 0x02C6, // ˆ  Modifier letter circumflex accent
  137: 0x2030, // ‰  Per mille sign
  138: 0x0160, // Š  Latin capital letter S with caron
  139: 0x2039, // ‹  Single left-pointing angle quotation mark
  140: 0x0152, // Œ  Latin capital ligature OE
  142: 0x017D, // Ž  Latin capital letter Z with caron
  145: 0x2018, // '  Left single quotation mark
  146: 0x2019, // '  Right single quotation mark
  147: 0x201C, // "  Left double quotation mark
  148: 0x201D, // "  Right double quotation mark
  149: 0x2022, // •  Bullet
  150: 0x2013, // –  En dash
  151: 0x2014, // —  Em dash
  152: 0x02DC, // ˜  Small tilde
  153: 0x2122, // ™  Trade mark sign
  154: 0x0161, // š  Latin small letter s with caron
  155: 0x203A, // ›  Single right-pointing angle quotation mark
  156: 0x0153, // œ  Latin small ligature oe
  158: 0x017E, // ž  Latin small letter z with caron
  159: 0x0178, // Ÿ  Latin capital letter Y with diaeresis
};

/** Undefined codes in Windows-1252 (must be omitted from CMap). */
const WIN_ANSI_UNDEFINED = new Set([129, 141, 143, 144, 157]);

// ---------------------------------------------------------------------------
// Adobe Symbol encoding → Unicode
// ---------------------------------------------------------------------------

/**
 * Adobe Symbol encoding to Unicode mapping.
 *
 * Source: Adobe Symbol Encoding, PDF Reference Table D.5, and the
 * Adobe Glyph List (AGL).  Only populated entries are included.
 */
const SYMBOL_TO_UNICODE: Record<number, number> = {
  0x20: 0x0020, // space
  0x21: 0x0021, // exclam
  0x22: 0x2200, // universal (∀)
  0x23: 0x0023, // numbersign
  0x24: 0x2203, // existential (∃)
  0x25: 0x0025, // percent
  0x26: 0x0026, // ampersand
  0x27: 0x220B, // suchthat (∋)
  0x28: 0x0028, // parenleft
  0x29: 0x0029, // parenright
  0x2A: 0x2217, // asteriskmath (∗)
  0x2B: 0x002B, // plus
  0x2C: 0x002C, // comma
  0x2D: 0x2212, // minus (−)
  0x2E: 0x002E, // period
  0x2F: 0x002F, // slash
  0x30: 0x0030, // zero
  0x31: 0x0031, // one
  0x32: 0x0032, // two
  0x33: 0x0033, // three
  0x34: 0x0034, // four
  0x35: 0x0035, // five
  0x36: 0x0036, // six
  0x37: 0x0037, // seven
  0x38: 0x0038, // eight
  0x39: 0x0039, // nine
  0x3A: 0x003A, // colon
  0x3B: 0x003B, // semicolon
  0x3C: 0x003C, // less
  0x3D: 0x003D, // equal
  0x3E: 0x003E, // greater
  0x3F: 0x003F, // question
  0x40: 0x2245, // congruent (≅)
  0x41: 0x0391, // Alpha (Α)
  0x42: 0x0392, // Beta (Β)
  0x43: 0x03A7, // Chi (Χ)
  0x44: 0x2206, // Delta (∆) — increment
  0x45: 0x0395, // Epsilon (Ε)
  0x46: 0x03A6, // Phi (Φ)
  0x47: 0x0393, // Gamma (Γ)
  0x48: 0x0397, // Eta (Η)
  0x49: 0x0399, // Iota (Ι)
  0x4A: 0x03D1, // theta1 (ϑ)
  0x4B: 0x039A, // Kappa (Κ)
  0x4C: 0x039B, // Lambda (Λ)
  0x4D: 0x039C, // Mu (Μ)
  0x4E: 0x039D, // Nu (Ν)
  0x4F: 0x039F, // Omicron (Ο)
  0x50: 0x03A0, // Pi (Π)
  0x51: 0x0398, // Theta (Θ)
  0x52: 0x03A1, // Rho (Ρ)
  0x53: 0x03A3, // Sigma (Σ)
  0x54: 0x03A4, // Tau (Τ)
  0x55: 0x03A5, // Upsilon (Υ)
  0x56: 0x03C2, // sigma1 (ς) — final sigma
  0x57: 0x03A9, // Omega (Ω)
  0x58: 0x039E, // Xi (Ξ)
  0x59: 0x03A8, // Psi (Ψ)
  0x5A: 0x005A, // Zeta — use Latin Z as placeholder
  0x5B: 0x005B, // bracketleft
  0x5C: 0x2234, // therefore (∴)
  0x5D: 0x005D, // bracketright
  0x5E: 0x22A5, // perpendicular (⊥)
  0x5F: 0x005F, // underscore
  0x60: 0xF8E5, // radicalex — Apple private use
  0x61: 0x03B1, // alpha (α)
  0x62: 0x03B2, // beta (β)
  0x63: 0x03C7, // chi (χ)
  0x64: 0x03B4, // delta (δ)
  0x65: 0x03B5, // epsilon (ε)
  0x66: 0x03C6, // phi (φ)
  0x67: 0x03B3, // gamma (γ)
  0x68: 0x03B7, // eta (η)
  0x69: 0x03B9, // iota (ι)
  0x6A: 0x03D5, // phi1 (ϕ)
  0x6B: 0x03BA, // kappa (κ)
  0x6C: 0x03BB, // lambda (λ)
  0x6D: 0x03BC, // mu (μ)
  0x6E: 0x03BD, // nu (ν)
  0x6F: 0x03BF, // omicron (ο)
  0x70: 0x03C0, // pi (π)
  0x71: 0x03B8, // theta (θ)
  0x72: 0x03C1, // rho (ρ)
  0x73: 0x03C3, // sigma (σ)
  0x74: 0x03C4, // tau (τ)
  0x75: 0x03C5, // upsilon (υ)
  0x76: 0x03D6, // omega1 (ϖ) — pi symbol / variant pi
  0x77: 0x03C9, // omega (ω)
  0x78: 0x03BE, // xi (ξ)
  0x79: 0x03C8, // psi (ψ)
  0x7A: 0x03B6, // zeta (ζ)
  0x7B: 0x007B, // braceleft
  0x7C: 0x007C, // bar
  0x7D: 0x007D, // braceright
  0x7E: 0x223C, // similar (∼)
  0xA0: 0x20AC, // Euro
  0xA1: 0x03D2, // Upsilon1 (ϒ)
  0xA2: 0x2032, // minute (′)
  0xA3: 0x2264, // lessequal (≤)
  0xA4: 0x2044, // fraction (⁄)
  0xA5: 0x221E, // infinity (∞)
  0xA6: 0x0192, // florin (ƒ)
  0xA7: 0x2663, // club (♣)
  0xA8: 0x2666, // diamond (♦)
  0xA9: 0x2665, // heart (♥)
  0xAA: 0x2660, // spade (♠)
  0xAB: 0x2194, // arrowboth (↔)
  0xAC: 0x2190, // arrowleft (←)
  0xAD: 0x2191, // arrowup (↑)
  0xAE: 0x2192, // arrowright (→)
  0xAF: 0x2193, // arrowdown (↓)
  0xB0: 0x00B0, // degree (°)
  0xB1: 0x00B1, // plusminus (±)
  0xB2: 0x2033, // second (″)
  0xB3: 0x2265, // greaterequal (≥)
  0xB4: 0x00D7, // multiply (×)
  0xB5: 0x221D, // proportional (∝)
  0xB6: 0x2202, // partialdiff (∂)
  0xB7: 0x2022, // bullet (•)
  0xB8: 0x00F7, // divide (÷)
  0xB9: 0x2260, // notequal (≠)
  0xBA: 0x2261, // equivalence (≡)
  0xBB: 0x2248, // approxequal (≈)
  0xBC: 0x2026, // ellipsis (…)
  0xBD: 0xF8E6, // arrowvertex — private use
  0xBE: 0xF8E7, // arrowhorizex — private use
  0xBF: 0x21B5, // carriagereturn (↵)
  0xC0: 0x2135, // aleph (ℵ)
  0xC1: 0x2111, // Ifraktur (ℑ)
  0xC2: 0x211C, // Rfraktur (ℜ)
  0xC3: 0x2118, // weierstrass (℘)
  0xC4: 0x2297, // circlemultiply (⊗)
  0xC5: 0x2295, // circleplus (⊕)
  0xC6: 0x2205, // emptyset (∅)
  0xC7: 0x2229, // intersection (∩)
  0xC8: 0x222A, // union (∪)
  0xC9: 0x2283, // propersuperset (⊃)
  0xCA: 0x2287, // reflexsuperset (⊇)
  0xCB: 0x2284, // notsubset (⊄)
  0xCC: 0x2282, // propersubset (⊂)
  0xCD: 0x2286, // reflexsubset (⊆)
  0xCE: 0x2208, // element (∈)
  0xCF: 0x2209, // notelement (∉)
  0xD0: 0x2220, // angle (∠)
  0xD1: 0x2207, // gradient (∇)
  0xD2: 0xF6DA, // registerserif — private use
  0xD3: 0xF6D9, // copyrightserif — private use
  0xD4: 0xF6DB, // trademarkserif — private use
  0xD5: 0x220F, // product (∏)
  0xD6: 0x221A, // radical (√)
  0xD7: 0x22C5, // dotmath (⋅)
  0xD8: 0x00AC, // logicalnot (¬)
  0xD9: 0x2227, // logicaland (∧)
  0xDA: 0x2228, // logicalor (∨)
  0xDB: 0x21D4, // arrowdblboth (⇔)
  0xDC: 0x21D0, // arrowdblleft (⇐)
  0xDD: 0x21D1, // arrowdblup (⇑)
  0xDE: 0x21D2, // arrowdblright (⇒)
  0xDF: 0x21D3, // arrowdbldown (⇓)
  0xE0: 0x25CA, // lozenge (◊)
  0xE1: 0x2329, // angleleft (〈)
  0xE2: 0xF8E8, // registersans — private use
  0xE3: 0xF8E9, // copyrightsans — private use
  0xE4: 0xF8EA, // trademarksans — private use
  0xE5: 0x2211, // summation (∑)
  0xE6: 0xF8EB, // parenlefttp — private use
  0xE7: 0xF8EC, // parenleftex — private use
  0xE8: 0xF8ED, // parenleftbt — private use
  0xE9: 0xF8EE, // bracketlefttp — private use
  0xEA: 0xF8EF, // bracketleftex — private use
  0xEB: 0xF8F0, // bracketleftbt — private use
  0xEC: 0xF8F1, // bracelefttp — private use
  0xED: 0xF8F2, // braceleftmid — private use
  0xEE: 0xF8F3, // braceleftbt — private use
  0xEF: 0xF8F4, // braceex — private use
  0xF1: 0x232A, // angleright (〉)
  0xF2: 0x222B, // integral (∫)
  0xF3: 0x2320, // integraltp (⌠)
  0xF4: 0xF8F5, // integralex — private use
  0xF5: 0x2321, // integralbt (⌡)
  0xF6: 0xF8F6, // parenrighttp — private use
  0xF7: 0xF8F7, // parenrightex — private use
  0xF8: 0xF8F8, // parenrightbt — private use
  0xF9: 0xF8F9, // bracketrighttp — private use
  0xFA: 0xF8FA, // bracketrightex — private use
  0xFB: 0xF8FB, // bracketrightbt — private use
  0xFC: 0xF8FC, // bracerighttp — private use
  0xFD: 0xF8FD, // bracerightmid — private use
  0xFE: 0xF8FE, // bracerightbt — private use
};

// ---------------------------------------------------------------------------
// Adobe ZapfDingbats encoding → Unicode
// ---------------------------------------------------------------------------

/**
 * Adobe ZapfDingbats encoding to Unicode mapping.
 *
 * Source: PDF Reference Table D.6 and the Adobe Glyph List (AGL).
 * The ZapfDingbats font uses its own built-in encoding.
 */
const ZAPF_DINGBATS_TO_UNICODE: Record<number, number> = {
  0x20: 0x0020, // space
  0x21: 0x2701, // ✁ upper blade scissors
  0x22: 0x2702, // ✂ black scissors
  0x23: 0x2703, // ✃ lower blade scissors
  0x24: 0x2704, // ✄ white scissors
  0x25: 0x260E, // ☎ black telephone
  0x26: 0x2706, // ✆ telephone location sign
  0x27: 0x2707, // ✇ tape drive
  0x28: 0x2708, // ✈ airplane
  0x29: 0x2709, // ✉ envelope
  0x2A: 0x261B, // ☛ black right pointing index
  0x2B: 0x261E, // ☞ white right pointing index
  0x2C: 0x270C, // ✌ victory hand
  0x2D: 0x270D, // ✍ writing hand
  0x2E: 0x270E, // ✎ lower right pencil
  0x2F: 0x270F, // ✏ pencil
  0x30: 0x2710, // ✐ upper right pencil
  0x31: 0x2711, // ✑ white nib
  0x32: 0x2712, // ✒ black nib
  0x33: 0x2713, // ✓ check mark
  0x34: 0x2714, // ✔ heavy check mark
  0x35: 0x2715, // ✕ multiplication x
  0x36: 0x2716, // ✖ heavy multiplication x
  0x37: 0x2717, // ✗ ballot x
  0x38: 0x2718, // ✘ heavy ballot x
  0x39: 0x2719, // ✙ outlined Greek cross
  0x3A: 0x271A, // ✚ heavy Greek cross
  0x3B: 0x271B, // ✛ open centre cross
  0x3C: 0x271C, // ✜ heavy open centre cross
  0x3D: 0x271D, // ✝ Latin cross
  0x3E: 0x271E, // ✞ shadowed white Latin cross
  0x3F: 0x271F, // ✟ outlined Latin cross
  0x40: 0x2720, // ✠ Maltese cross
  0x41: 0x2721, // ✡ star of David
  0x42: 0x2722, // ✢ four teardrop-spoked asterisk
  0x43: 0x2723, // ✣ four balloon-spoked asterisk
  0x44: 0x2724, // ✤ heavy four balloon-spoked asterisk
  0x45: 0x2725, // ✥ four club-spoked asterisk
  0x46: 0x2726, // ✦ black four pointed star
  0x47: 0x2727, // ✧ white four pointed star
  0x48: 0x2605, // ★ black star
  0x49: 0x2729, // ✩ stress outlined white star
  0x4A: 0x272A, // ✪ circled white star
  0x4B: 0x272B, // ✫ open centre black star
  0x4C: 0x272C, // ✬ black centre white star
  0x4D: 0x272D, // ✭ outlined black star
  0x4E: 0x272E, // ✮ heavy outlined black star
  0x4F: 0x272F, // ✯ pinwheel star
  0x50: 0x2730, // ✰ shadowed white star
  0x51: 0x2731, // ✱ heavy asterisk
  0x52: 0x2732, // ✲ open centre asterisk
  0x53: 0x2733, // ✳ eight spoked asterisk
  0x54: 0x2734, // ✴ eight pointed black star
  0x55: 0x2735, // ✵ eight pointed pinwheel star
  0x56: 0x2736, // ✶ six pointed black star
  0x57: 0x2737, // ✷ eight pointed rectilinear black star
  0x58: 0x2738, // ✸ heavy eight pointed rectilinear black star
  0x59: 0x2739, // ✹ twelve pointed black star
  0x5A: 0x273A, // ✺ sixteen pointed asterisk
  0x5B: 0x273B, // ✻ teardrop-spoked asterisk
  0x5C: 0x273C, // ✼ open centre teardrop-spoked asterisk
  0x5D: 0x273D, // ✽ heavy teardrop-spoked asterisk
  0x5E: 0x273E, // ✾ six petalled black and white florette
  0x5F: 0x273F, // ✿ black florette
  0x60: 0x2740, // ❀ white florette
  0x61: 0x2741, // ❁ eight petalled outlined black florette
  0x62: 0x2742, // ❂ circled open centre eight pointed star
  0x63: 0x2743, // ❃ heavy teardrop-spoked pinwheel asterisk
  0x64: 0x2744, // ❄ snowflake
  0x65: 0x2745, // ❅ tight trifoliate snowflake
  0x66: 0x2746, // ❆ heavy chevron snowflake
  0x67: 0x2747, // ❇ sparkle
  0x68: 0x2748, // ❈ heavy sparkle
  0x69: 0x2749, // ❉ balloon-spoked asterisk
  0x6A: 0x274A, // ❊ eight teardrop-spoked propeller asterisk
  0x6B: 0x274B, // ❋ heavy eight teardrop-spoked propeller asterisk
  0x6C: 0x25CF, // ● black circle
  0x6D: 0x274D, // ❍ shadowed white circle
  0x6E: 0x25A0, // ■ black square
  0x6F: 0x274F, // ❏ lower right drop-shadowed white square
  0x70: 0x2750, // ❐ upper right drop-shadowed white square
  0x71: 0x2751, // ❑ lower right shadowed white square
  0x72: 0x2752, // ❒ upper right shadowed white square
  0x73: 0x25B2, // ▲ black up-pointing triangle
  0x74: 0x25BC, // ▼ black down-pointing triangle
  0x75: 0x25C6, // ◆ black diamond
  0x76: 0x2756, // ❖ black diamond minus white X
  0x77: 0x25D7, // ◗ right half black circle
  0x78: 0x2758, // ❘ light vertical bar
  0x79: 0x2759, // ❙ medium vertical bar
  0x7A: 0x275A, // ❚ heavy vertical bar
  0x7B: 0x275B, // ❛ heavy single turned comma quotation mark ornament
  0x7C: 0x275C, // ❜ heavy single comma quotation mark ornament
  0x7D: 0x275D, // ❝ heavy double turned comma quotation mark ornament
  0x7E: 0x275E, // ❞ heavy double comma quotation mark ornament
  0x80: 0xF8D7, // private use
  0x81: 0xF8D8, // private use
  0x82: 0xF8D9, // private use
  0x83: 0xF8DA, // private use
  0x84: 0xF8DB, // private use
  0x85: 0xF8DC, // private use
  0x86: 0xF8DD, // private use
  0x87: 0xF8DE, // private use
  0x88: 0xF8DF, // private use
  0x89: 0xF8E0, // private use
  0x8A: 0xF8E1, // private use
  0x8B: 0xF8E2, // private use
  0x8C: 0xF8E3, // private use
  0x8D: 0xF8E4, // private use
  0xA1: 0x2761, // ❡ curved stem paragraph sign ornament
  0xA2: 0x2762, // ❢ heavy exclamation mark ornament
  0xA3: 0x2763, // ❣ heavy heart exclamation mark ornament
  0xA4: 0x2764, // ❤ heavy black heart
  0xA5: 0x2765, // ❥ rotated heavy black heart bullet
  0xA6: 0x2766, // ❦ floral heart
  0xA7: 0x2767, // ❧ rotated floral heart bullet
  0xA8: 0x2663, // ♣ black club suit
  0xA9: 0x2666, // ♦ black diamond suit
  0xAA: 0x2665, // ♥ black heart suit
  0xAB: 0x2660, // ♠ black spade suit
  0xAC: 0x2460, // ① circled digit one
  0xAD: 0x2461, // ② circled digit two
  0xAE: 0x2462, // ③ circled digit three
  0xAF: 0x2463, // ④ circled digit four
  0xB0: 0x2464, // ⑤ circled digit five
  0xB1: 0x2465, // ⑥ circled digit six
  0xB2: 0x2466, // ⑦ circled digit seven
  0xB3: 0x2467, // ⑧ circled digit eight
  0xB4: 0x2468, // ⑨ circled digit nine
  0xB5: 0x2469, // ⑩ circled number ten
  0xB6: 0x2776, // ❶ dingbat negative circled digit one
  0xB7: 0x2777, // ❷ dingbat negative circled digit two
  0xB8: 0x2778, // ❸ dingbat negative circled digit three
  0xB9: 0x2779, // ❹ dingbat negative circled digit four
  0xBA: 0x277A, // ❺ dingbat negative circled digit five
  0xBB: 0x277B, // ❻ dingbat negative circled digit six
  0xBC: 0x277C, // ❼ dingbat negative circled digit seven
  0xBD: 0x277D, // ❽ dingbat negative circled digit eight
  0xBE: 0x277E, // ❾ dingbat negative circled digit nine
  0xBF: 0x277F, // ❿ dingbat negative circled number ten
  0xC0: 0x2780, // ➀ dingbat circled sans-serif digit one
  0xC1: 0x2781, // ➁ dingbat circled sans-serif digit two
  0xC2: 0x2782, // ➂ dingbat circled sans-serif digit three
  0xC3: 0x2783, // ➃ dingbat circled sans-serif digit four
  0xC4: 0x2784, // ➄ dingbat circled sans-serif digit five
  0xC5: 0x2785, // ➅ dingbat circled sans-serif digit six
  0xC6: 0x2786, // ➆ dingbat circled sans-serif digit seven
  0xC7: 0x2787, // ➇ dingbat circled sans-serif digit eight
  0xC8: 0x2788, // ➈ dingbat circled sans-serif digit nine
  0xC9: 0x2789, // ➉ dingbat circled sans-serif number ten
  0xCA: 0x278A, // ➊ dingbat negative circled sans-serif digit one
  0xCB: 0x278B, // ➋ dingbat negative circled sans-serif digit two
  0xCC: 0x278C, // ➌ dingbat negative circled sans-serif digit three
  0xCD: 0x278D, // ➍ dingbat negative circled sans-serif digit four
  0xCE: 0x278E, // ➎ dingbat negative circled sans-serif digit five
  0xCF: 0x278F, // ➏ dingbat negative circled sans-serif digit six
  0xD0: 0x2790, // ➐ dingbat negative circled sans-serif digit seven
  0xD1: 0x2791, // ➑ dingbat negative circled sans-serif digit eight
  0xD2: 0x2792, // ➒ dingbat negative circled sans-serif digit nine
  0xD3: 0x2793, // ➓ dingbat negative circled sans-serif number ten
  0xD4: 0x2794, // ➔ heavy wide-headed rightwards arrow
  0xD5: 0x2795, // ➕ heavy plus sign
  0xD6: 0x2796, // ➖ heavy minus sign
  0xD7: 0x2797, // ➗ heavy division sign
  0xD8: 0x2798, // ➘ heavy south east arrow
  0xD9: 0x2799, // ➙ heavy rightwards arrow
  0xDA: 0x279A, // ➚ heavy north east arrow
  0xDB: 0x279B, // ➛ drafting point rightwards arrow
  0xDC: 0x279C, // ➜ heavy round-tipped rightwards arrow
  0xDD: 0x279D, // ➝ triangle-headed rightwards arrow
  0xDE: 0x279E, // ➞ heavy triangle-headed rightwards arrow
  0xDF: 0x279F, // ➟ dashed triangle-headed rightwards arrow
  0xE0: 0x27A0, // ➠ heavy dashed triangle-headed rightwards arrow
  0xE1: 0x27A1, // ➡ black rightwards arrow
  0xE2: 0x27A2, // ➢ three-D top-lighted rightwards arrowhead
  0xE3: 0x27A3, // ➣ three-D bottom-lighted rightwards arrowhead
  0xE4: 0x27A4, // ➤ black rightwards arrowhead
  0xE5: 0x27A5, // ➥ heavy black curved downwards and rightwards arrow
  0xE6: 0x27A6, // ➦ heavy black curved upwards and rightwards arrow
  0xE7: 0x27A7, // ➧ squat black rightwards arrow
  0xE8: 0x27A8, // ➨ heavy concave-pointed black rightwards arrow
  0xE9: 0x27A9, // ➩ right-shaded white rightwards arrow
  0xEA: 0x27AA, // ➪ left-shaded white rightwards arrow
  0xEB: 0x27AB, // ➫ back-tilted shadowed white rightwards arrow
  0xEC: 0x27AC, // ➬ front-tilted shadowed white rightwards arrow
  0xED: 0x27AD, // ➭ heavy lower right-shadowed white rightwards arrow
  0xEE: 0x27AE, // ➮ heavy upper right-shadowed white rightwards arrow
  0xEF: 0x27AF, // ➯ notched lower right-shadowed white rightwards arrow
  0xF1: 0x27B1, // ➱ notched upper right-shadowed white rightwards arrow
  0xF2: 0x27B2, // ➲ circled heavy white rightwards arrow
  0xF3: 0x27B3, // ➳ white-feathered rightwards arrow
  0xF4: 0x27B4, // ➴ black-feathered south east arrow
  0xF5: 0x27B5, // ➵ black-feathered rightwards arrow
  0xF6: 0x27B6, // ➶ black-feathered north east arrow
  0xF7: 0x27B7, // ➷ heavy black-feathered south east arrow
  0xF8: 0x27B8, // ➸ heavy black-feathered rightwards arrow
  0xF9: 0x27B9, // ➹ heavy black-feathered north east arrow
  0xFA: 0x27BA, // ➺ teardrop-barbed rightwards arrow
  0xFB: 0x27BB, // ➻ heavy teardrop-shanked rightwards arrow
  0xFC: 0x27BC, // ➼ wedge-tailed rightwards arrow
  0xFD: 0x27BD, // ➽ heavy wedge-tailed rightwards arrow
  0xFE: 0x27BE, // ➾ open-outlined rightwards arrow
};

// ---------------------------------------------------------------------------
// CMap generation
// ---------------------------------------------------------------------------

/**
 * Build a CMap string from a mapping table (character code → Unicode).
 *
 * Entries are chunked into blocks of at most 100 `bfchar` mappings,
 * as required by the CMap specification.
 */
function buildCmapString(mapping: Record<number, number>): string {
  const entries: string[] = [];

  // Sort codes numerically for deterministic output
  const codes = Object.keys(mapping).map(Number).sort((a, b) => a - b);

  for (const code of codes) {
    const unicode = mapping[code]!;
    const codeHex = code.toString(16).padStart(2, '0').toUpperCase();
    const unicodeHex = unicode.toString(16).padStart(4, '0').toUpperCase();
    entries.push(`<${codeHex}> <${unicodeHex}>`);
  }

  // Split into chunks of 100 (CMap spec allows max 100 per bfchar block)
  const chunks: string[][] = [];
  for (let i = 0; i < entries.length; i += 100) {
    chunks.push(entries.slice(i, i + 100));
  }

  let cmap = '/CIDInit /ProcSet findresource begin\n';
  cmap += '12 dict begin\n';
  cmap += 'begincmap\n';
  cmap += '/CIDSystemInfo\n';
  cmap += '<< /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n';
  cmap += '/CMapName /Adobe-Identity-UCS def\n';
  cmap += '/CMapType 2 def\n';
  cmap += '1 begincodespacerange\n';
  cmap += '<00> <FF>\n';
  cmap += 'endcodespacerange\n';

  for (const chunk of chunks) {
    cmap += `${chunk.length} beginbfchar\n`;
    cmap += chunk.join('\n') + '\n';
    cmap += 'endbfchar\n';
  }

  cmap += 'endcmap\n';
  cmap += 'CMapName currentdict /CMap defineresource pop\n';
  cmap += 'end\n';
  cmap += 'end\n';

  return cmap;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a ToUnicode CMap string for a standard WinAnsi-encoded font.
 *
 * WinAnsi (Windows-1252) is the default encoding for the 12 Latin
 * standard 14 fonts (all except Symbol and ZapfDingbats).
 * This maps each byte code (32–255) to its Unicode equivalent.
 *
 * @returns A complete CMap program as a string.
 */
export function generateWinAnsiToUnicodeCmap(): string {
  const mapping: Record<number, number> = {};

  for (let code = 32; code <= 255; code++) {
    // Skip undefined codes in Windows-1252
    if (WIN_ANSI_UNDEFINED.has(code)) continue;

    // Use the special mapping for codes 128–159, otherwise identity
    mapping[code] = WIN_ANSI_TO_UNICODE[code] ?? code;
  }

  return buildCmapString(mapping);
}

/**
 * Generate a ToUnicode CMap for the Symbol font.
 *
 * The Symbol font uses the Adobe Symbol encoding, which maps
 * character codes to Greek letters, mathematical symbols, and
 * other special characters.
 *
 * @returns A complete CMap program as a string.
 */
export function generateSymbolToUnicodeCmap(): string {
  return buildCmapString(SYMBOL_TO_UNICODE);
}

/**
 * Generate a ToUnicode CMap for the ZapfDingbats font.
 *
 * The ZapfDingbats font uses its own built-in encoding that maps
 * character codes to decorative symbols, arrows, and ornaments.
 *
 * @returns A complete CMap program as a string.
 */
export function generateZapfDingbatsToUnicodeCmap(): string {
  return buildCmapString(ZAPF_DINGBATS_TO_UNICODE);
}

/**
 * Get the appropriate ToUnicode CMap for a standard 14 font.
 *
 * - Symbol → Symbol encoding CMap
 * - ZapfDingbats → ZapfDingbats encoding CMap
 * - All others → WinAnsi (Windows-1252) encoding CMap
 *
 * @param fontName  The PDF base font name (e.g. `'Helvetica'`, `'Symbol'`).
 * @returns         A complete CMap program as a string.
 */
export function getToUnicodeCmap(fontName: string): string {
  if (fontName === 'Symbol') return generateSymbolToUnicodeCmap();
  if (fontName === 'ZapfDingbats') return generateZapfDingbatsToUnicodeCmap();
  return generateWinAnsiToUnicodeCmap();
}
