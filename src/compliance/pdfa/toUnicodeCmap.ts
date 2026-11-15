/**
 * @module compliance/pdfa/toUnicodeCmap
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
  128: 0x20ac, // €  Euro sign
  130: 0x201a, // ‚  Single low-9 quotation mark
  131: 0x0192, // ƒ  Latin small letter f with hook
  132: 0x201e, // „  Double low-9 quotation mark
  133: 0x2026, // …  Horizontal ellipsis
  134: 0x2020, // †  Dagger
  135: 0x2021, // ‡  Double dagger
  136: 0x02c6, // ˆ  Modifier letter circumflex accent
  137: 0x2030, // ‰  Per mille sign
  138: 0x0160, // Š  Latin capital letter S with caron
  139: 0x2039, // ‹  Single left-pointing angle quotation mark
  140: 0x0152, // Œ  Latin capital ligature OE
  142: 0x017d, // Ž  Latin capital letter Z with caron
  145: 0x2018, // '  Left single quotation mark
  146: 0x2019, // '  Right single quotation mark
  147: 0x201c, // "  Left double quotation mark
  148: 0x201d, // "  Right double quotation mark
  149: 0x2022, // •  Bullet
  150: 0x2013, // –  En dash
  151: 0x2014, // —  Em dash
  152: 0x02dc, // ˜  Small tilde
  153: 0x2122, // ™  Trade mark sign
  154: 0x0161, // š  Latin small letter s with caron
  155: 0x203a, // ›  Single right-pointing angle quotation mark
  156: 0x0153, // œ  Latin small ligature oe
  158: 0x017e, // ž  Latin small letter z with caron
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
  0x27: 0x220b, // suchthat (∋)
  0x28: 0x0028, // parenleft
  0x29: 0x0029, // parenright
  0x2a: 0x2217, // asteriskmath (∗)
  0x2b: 0x002b, // plus
  0x2c: 0x002c, // comma
  0x2d: 0x2212, // minus (−)
  0x2e: 0x002e, // period
  0x2f: 0x002f, // slash
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
  0x3a: 0x003a, // colon
  0x3b: 0x003b, // semicolon
  0x3c: 0x003c, // less
  0x3d: 0x003d, // equal
  0x3e: 0x003e, // greater
  0x3f: 0x003f, // question
  0x40: 0x2245, // congruent (≅)
  0x41: 0x0391, // Alpha (Α)
  0x42: 0x0392, // Beta (Β)
  0x43: 0x03a7, // Chi (Χ)
  0x44: 0x2206, // Delta (∆) — increment
  0x45: 0x0395, // Epsilon (Ε)
  0x46: 0x03a6, // Phi (Φ)
  0x47: 0x0393, // Gamma (Γ)
  0x48: 0x0397, // Eta (Η)
  0x49: 0x0399, // Iota (Ι)
  0x4a: 0x03d1, // theta1 (ϑ)
  0x4b: 0x039a, // Kappa (Κ)
  0x4c: 0x039b, // Lambda (Λ)
  0x4d: 0x039c, // Mu (Μ)
  0x4e: 0x039d, // Nu (Ν)
  0x4f: 0x039f, // Omicron (Ο)
  0x50: 0x03a0, // Pi (Π)
  0x51: 0x0398, // Theta (Θ)
  0x52: 0x03a1, // Rho (Ρ)
  0x53: 0x03a3, // Sigma (Σ)
  0x54: 0x03a4, // Tau (Τ)
  0x55: 0x03a5, // Upsilon (Υ)
  0x56: 0x03c2, // sigma1 (ς) — final sigma
  0x57: 0x03a9, // Omega (Ω)
  0x58: 0x039e, // Xi (Ξ)
  0x59: 0x03a8, // Psi (Ψ)
  0x5a: 0x005a, // Zeta — use Latin Z as placeholder
  0x5b: 0x005b, // bracketleft
  0x5c: 0x2234, // therefore (∴)
  0x5d: 0x005d, // bracketright
  0x5e: 0x22a5, // perpendicular (⊥)
  0x5f: 0x005f, // underscore
  0x60: 0xf8e5, // radicalex — Apple private use
  0x61: 0x03b1, // alpha (α)
  0x62: 0x03b2, // beta (β)
  0x63: 0x03c7, // chi (χ)
  0x64: 0x03b4, // delta (δ)
  0x65: 0x03b5, // epsilon (ε)
  0x66: 0x03c6, // phi (φ)
  0x67: 0x03b3, // gamma (γ)
  0x68: 0x03b7, // eta (η)
  0x69: 0x03b9, // iota (ι)
  0x6a: 0x03d5, // phi1 (ϕ)
  0x6b: 0x03ba, // kappa (κ)
  0x6c: 0x03bb, // lambda (λ)
  0x6d: 0x03bc, // mu (μ)
  0x6e: 0x03bd, // nu (ν)
  0x6f: 0x03bf, // omicron (ο)
  0x70: 0x03c0, // pi (π)
  0x71: 0x03b8, // theta (θ)
  0x72: 0x03c1, // rho (ρ)
  0x73: 0x03c3, // sigma (σ)
  0x74: 0x03c4, // tau (τ)
  0x75: 0x03c5, // upsilon (υ)
  0x76: 0x03d6, // omega1 (ϖ) — pi symbol / variant pi
  0x77: 0x03c9, // omega (ω)
  0x78: 0x03be, // xi (ξ)
  0x79: 0x03c8, // psi (ψ)
  0x7a: 0x03b6, // zeta (ζ)
  0x7b: 0x007b, // braceleft
  0x7c: 0x007c, // bar
  0x7d: 0x007d, // braceright
  0x7e: 0x223c, // similar (∼)
  0xa0: 0x20ac, // Euro
  0xa1: 0x03d2, // Upsilon1 (ϒ)
  0xa2: 0x2032, // minute (′)
  0xa3: 0x2264, // lessequal (≤)
  0xa4: 0x2044, // fraction (⁄)
  0xa5: 0x221e, // infinity (∞)
  0xa6: 0x0192, // florin (ƒ)
  0xa7: 0x2663, // club (♣)
  0xa8: 0x2666, // diamond (♦)
  0xa9: 0x2665, // heart (♥)
  0xaa: 0x2660, // spade (♠)
  0xab: 0x2194, // arrowboth (↔)
  0xac: 0x2190, // arrowleft (←)
  0xad: 0x2191, // arrowup (↑)
  0xae: 0x2192, // arrowright (→)
  0xaf: 0x2193, // arrowdown (↓)
  0xb0: 0x00b0, // degree (°)
  0xb1: 0x00b1, // plusminus (±)
  0xb2: 0x2033, // second (″)
  0xb3: 0x2265, // greaterequal (≥)
  0xb4: 0x00d7, // multiply (×)
  0xb5: 0x221d, // proportional (∝)
  0xb6: 0x2202, // partialdiff (∂)
  0xb7: 0x2022, // bullet (•)
  0xb8: 0x00f7, // divide (÷)
  0xb9: 0x2260, // notequal (≠)
  0xba: 0x2261, // equivalence (≡)
  0xbb: 0x2248, // approxequal (≈)
  0xbc: 0x2026, // ellipsis (…)
  0xbd: 0xf8e6, // arrowvertex — private use
  0xbe: 0xf8e7, // arrowhorizex — private use
  0xbf: 0x21b5, // carriagereturn (↵)
  0xc0: 0x2135, // aleph (ℵ)
  0xc1: 0x2111, // Ifraktur (ℑ)
  0xc2: 0x211c, // Rfraktur (ℜ)
  0xc3: 0x2118, // weierstrass (℘)
  0xc4: 0x2297, // circlemultiply (⊗)
  0xc5: 0x2295, // circleplus (⊕)
  0xc6: 0x2205, // emptyset (∅)
  0xc7: 0x2229, // intersection (∩)
  0xc8: 0x222a, // union (∪)
  0xc9: 0x2283, // propersuperset (⊃)
  0xca: 0x2287, // reflexsuperset (⊇)
  0xcb: 0x2284, // notsubset (⊄)
  0xcc: 0x2282, // propersubset (⊂)
  0xcd: 0x2286, // reflexsubset (⊆)
  0xce: 0x2208, // element (∈)
  0xcf: 0x2209, // notelement (∉)
  0xd0: 0x2220, // angle (∠)
  0xd1: 0x2207, // gradient (∇)
  0xd2: 0xf6da, // registerserif — private use
  0xd3: 0xf6d9, // copyrightserif — private use
  0xd4: 0xf6db, // trademarkserif — private use
  0xd5: 0x220f, // product (∏)
  0xd6: 0x221a, // radical (√)
  0xd7: 0x22c5, // dotmath (⋅)
  0xd8: 0x00ac, // logicalnot (¬)
  0xd9: 0x2227, // logicaland (∧)
  0xda: 0x2228, // logicalor (∨)
  0xdb: 0x21d4, // arrowdblboth (⇔)
  0xdc: 0x21d0, // arrowdblleft (⇐)
  0xdd: 0x21d1, // arrowdblup (⇑)
  0xde: 0x21d2, // arrowdblright (⇒)
  0xdf: 0x21d3, // arrowdbldown (⇓)
  0xe0: 0x25ca, // lozenge (◊)
  0xe1: 0x2329, // angleleft (〈)
  0xe2: 0xf8e8, // registersans — private use
  0xe3: 0xf8e9, // copyrightsans — private use
  0xe4: 0xf8ea, // trademarksans — private use
  0xe5: 0x2211, // summation (∑)
  0xe6: 0xf8eb, // parenlefttp — private use
  0xe7: 0xf8ec, // parenleftex — private use
  0xe8: 0xf8ed, // parenleftbt — private use
  0xe9: 0xf8ee, // bracketlefttp — private use
  0xea: 0xf8ef, // bracketleftex — private use
  0xeb: 0xf8f0, // bracketleftbt — private use
  0xec: 0xf8f1, // bracelefttp — private use
  0xed: 0xf8f2, // braceleftmid — private use
  0xee: 0xf8f3, // braceleftbt — private use
  0xef: 0xf8f4, // braceex — private use
  0xf1: 0x232a, // angleright (〉)
  0xf2: 0x222b, // integral (∫)
  0xf3: 0x2320, // integraltp (⌠)
  0xf4: 0xf8f5, // integralex — private use
  0xf5: 0x2321, // integralbt (⌡)
  0xf6: 0xf8f6, // parenrighttp — private use
  0xf7: 0xf8f7, // parenrightex — private use
  0xf8: 0xf8f8, // parenrightbt — private use
  0xf9: 0xf8f9, // bracketrighttp — private use
  0xfa: 0xf8fa, // bracketrightex — private use
  0xfb: 0xf8fb, // bracketrightbt — private use
  0xfc: 0xf8fc, // bracerighttp — private use
  0xfd: 0xf8fd, // bracerightmid — private use
  0xfe: 0xf8fe, // bracerightbt — private use
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
  0x25: 0x260e, // ☎ black telephone
  0x26: 0x2706, // ✆ telephone location sign
  0x27: 0x2707, // ✇ tape drive
  0x28: 0x2708, // ✈ airplane
  0x29: 0x2709, // ✉ envelope
  0x2a: 0x261b, // ☛ black right pointing index
  0x2b: 0x261e, // ☞ white right pointing index
  0x2c: 0x270c, // ✌ victory hand
  0x2d: 0x270d, // ✍ writing hand
  0x2e: 0x270e, // ✎ lower right pencil
  0x2f: 0x270f, // ✏ pencil
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
  0x3a: 0x271a, // ✚ heavy Greek cross
  0x3b: 0x271b, // ✛ open centre cross
  0x3c: 0x271c, // ✜ heavy open centre cross
  0x3d: 0x271d, // ✝ Latin cross
  0x3e: 0x271e, // ✞ shadowed white Latin cross
  0x3f: 0x271f, // ✟ outlined Latin cross
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
  0x4a: 0x272a, // ✪ circled white star
  0x4b: 0x272b, // ✫ open centre black star
  0x4c: 0x272c, // ✬ black centre white star
  0x4d: 0x272d, // ✭ outlined black star
  0x4e: 0x272e, // ✮ heavy outlined black star
  0x4f: 0x272f, // ✯ pinwheel star
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
  0x5a: 0x273a, // ✺ sixteen pointed asterisk
  0x5b: 0x273b, // ✻ teardrop-spoked asterisk
  0x5c: 0x273c, // ✼ open centre teardrop-spoked asterisk
  0x5d: 0x273d, // ✽ heavy teardrop-spoked asterisk
  0x5e: 0x273e, // ✾ six petalled black and white florette
  0x5f: 0x273f, // ✿ black florette
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
  0x6a: 0x274a, // ❊ eight teardrop-spoked propeller asterisk
  0x6b: 0x274b, // ❋ heavy eight teardrop-spoked propeller asterisk
  0x6c: 0x25cf, // ● black circle
  0x6d: 0x274d, // ❍ shadowed white circle
  0x6e: 0x25a0, // ■ black square
  0x6f: 0x274f, // ❏ lower right drop-shadowed white square
  0x70: 0x2750, // ❐ upper right drop-shadowed white square
  0x71: 0x2751, // ❑ lower right shadowed white square
  0x72: 0x2752, // ❒ upper right shadowed white square
  0x73: 0x25b2, // ▲ black up-pointing triangle
  0x74: 0x25bc, // ▼ black down-pointing triangle
  0x75: 0x25c6, // ◆ black diamond
  0x76: 0x2756, // ❖ black diamond minus white X
  0x77: 0x25d7, // ◗ right half black circle
  0x78: 0x2758, // ❘ light vertical bar
  0x79: 0x2759, // ❙ medium vertical bar
  0x7a: 0x275a, // ❚ heavy vertical bar
  0x7b: 0x275b, // ❛ heavy single turned comma quotation mark ornament
  0x7c: 0x275c, // ❜ heavy single comma quotation mark ornament
  0x7d: 0x275d, // ❝ heavy double turned comma quotation mark ornament
  0x7e: 0x275e, // ❞ heavy double comma quotation mark ornament
  0x80: 0xf8d7, // private use
  0x81: 0xf8d8, // private use
  0x82: 0xf8d9, // private use
  0x83: 0xf8da, // private use
  0x84: 0xf8db, // private use
  0x85: 0xf8dc, // private use
  0x86: 0xf8dd, // private use
  0x87: 0xf8de, // private use
  0x88: 0xf8df, // private use
  0x89: 0xf8e0, // private use
  0x8a: 0xf8e1, // private use
  0x8b: 0xf8e2, // private use
  0x8c: 0xf8e3, // private use
  0x8d: 0xf8e4, // private use
  0xa1: 0x2761, // ❡ curved stem paragraph sign ornament
  0xa2: 0x2762, // ❢ heavy exclamation mark ornament
  0xa3: 0x2763, // ❣ heavy heart exclamation mark ornament
  0xa4: 0x2764, // ❤ heavy black heart
  0xa5: 0x2765, // ❥ rotated heavy black heart bullet
  0xa6: 0x2766, // ❦ floral heart
  0xa7: 0x2767, // ❧ rotated floral heart bullet
  0xa8: 0x2663, // ♣ black club suit
  0xa9: 0x2666, // ♦ black diamond suit
  0xaa: 0x2665, // ♥ black heart suit
  0xab: 0x2660, // ♠ black spade suit
  0xac: 0x2460, // ① circled digit one
  0xad: 0x2461, // ② circled digit two
  0xae: 0x2462, // ③ circled digit three
  0xaf: 0x2463, // ④ circled digit four
  0xb0: 0x2464, // ⑤ circled digit five
  0xb1: 0x2465, // ⑥ circled digit six
  0xb2: 0x2466, // ⑦ circled digit seven
  0xb3: 0x2467, // ⑧ circled digit eight
  0xb4: 0x2468, // ⑨ circled digit nine
  0xb5: 0x2469, // ⑩ circled number ten
  0xb6: 0x2776, // ❶ dingbat negative circled digit one
  0xb7: 0x2777, // ❷ dingbat negative circled digit two
  0xb8: 0x2778, // ❸ dingbat negative circled digit three
  0xb9: 0x2779, // ❹ dingbat negative circled digit four
  0xba: 0x277a, // ❺ dingbat negative circled digit five
  0xbb: 0x277b, // ❻ dingbat negative circled digit six
  0xbc: 0x277c, // ❼ dingbat negative circled digit seven
  0xbd: 0x277d, // ❽ dingbat negative circled digit eight
  0xbe: 0x277e, // ❾ dingbat negative circled digit nine
  0xbf: 0x277f, // ❿ dingbat negative circled number ten
  0xc0: 0x2780, // ➀ dingbat circled sans-serif digit one
  0xc1: 0x2781, // ➁ dingbat circled sans-serif digit two
  0xc2: 0x2782, // ➂ dingbat circled sans-serif digit three
  0xc3: 0x2783, // ➃ dingbat circled sans-serif digit four
  0xc4: 0x2784, // ➄ dingbat circled sans-serif digit five
  0xc5: 0x2785, // ➅ dingbat circled sans-serif digit six
  0xc6: 0x2786, // ➆ dingbat circled sans-serif digit seven
  0xc7: 0x2787, // ➇ dingbat circled sans-serif digit eight
  0xc8: 0x2788, // ➈ dingbat circled sans-serif digit nine
  0xc9: 0x2789, // ➉ dingbat circled sans-serif number ten
  0xca: 0x278a, // ➊ dingbat negative circled sans-serif digit one
  0xcb: 0x278b, // ➋ dingbat negative circled sans-serif digit two
  0xcc: 0x278c, // ➌ dingbat negative circled sans-serif digit three
  0xcd: 0x278d, // ➍ dingbat negative circled sans-serif digit four
  0xce: 0x278e, // ➎ dingbat negative circled sans-serif digit five
  0xcf: 0x278f, // ➏ dingbat negative circled sans-serif digit six
  0xd0: 0x2790, // ➐ dingbat negative circled sans-serif digit seven
  0xd1: 0x2791, // ➑ dingbat negative circled sans-serif digit eight
  0xd2: 0x2792, // ➒ dingbat negative circled sans-serif digit nine
  0xd3: 0x2793, // ➓ dingbat negative circled sans-serif number ten
  0xd4: 0x2794, // ➔ heavy wide-headed rightwards arrow
  0xd5: 0x2795, // ➕ heavy plus sign
  0xd6: 0x2796, // ➖ heavy minus sign
  0xd7: 0x2797, // ➗ heavy division sign
  0xd8: 0x2798, // ➘ heavy south east arrow
  0xd9: 0x2799, // ➙ heavy rightwards arrow
  0xda: 0x279a, // ➚ heavy north east arrow
  0xdb: 0x279b, // ➛ drafting point rightwards arrow
  0xdc: 0x279c, // ➜ heavy round-tipped rightwards arrow
  0xdd: 0x279d, // ➝ triangle-headed rightwards arrow
  0xde: 0x279e, // ➞ heavy triangle-headed rightwards arrow
  0xdf: 0x279f, // ➟ dashed triangle-headed rightwards arrow
  0xe0: 0x27a0, // ➠ heavy dashed triangle-headed rightwards arrow
  0xe1: 0x27a1, // ➡ black rightwards arrow
  0xe2: 0x27a2, // ➢ three-D top-lighted rightwards arrowhead
  0xe3: 0x27a3, // ➣ three-D bottom-lighted rightwards arrowhead
  0xe4: 0x27a4, // ➤ black rightwards arrowhead
  0xe5: 0x27a5, // ➥ heavy black curved downwards and rightwards arrow
  0xe6: 0x27a6, // ➦ heavy black curved upwards and rightwards arrow
  0xe7: 0x27a7, // ➧ squat black rightwards arrow
  0xe8: 0x27a8, // ➨ heavy concave-pointed black rightwards arrow
  0xe9: 0x27a9, // ➩ right-shaded white rightwards arrow
  0xea: 0x27aa, // ➪ left-shaded white rightwards arrow
  0xeb: 0x27ab, // ➫ back-tilted shadowed white rightwards arrow
  0xec: 0x27ac, // ➬ front-tilted shadowed white rightwards arrow
  0xed: 0x27ad, // ➭ heavy lower right-shadowed white rightwards arrow
  0xee: 0x27ae, // ➮ heavy upper right-shadowed white rightwards arrow
  0xef: 0x27af, // ➯ notched lower right-shadowed white rightwards arrow
  0xf1: 0x27b1, // ➱ notched upper right-shadowed white rightwards arrow
  0xf2: 0x27b2, // ➲ circled heavy white rightwards arrow
  0xf3: 0x27b3, // ➳ white-feathered rightwards arrow
  0xf4: 0x27b4, // ➴ black-feathered south east arrow
  0xf5: 0x27b5, // ➵ black-feathered rightwards arrow
  0xf6: 0x27b6, // ➶ black-feathered north east arrow
  0xf7: 0x27b7, // ➷ heavy black-feathered south east arrow
  0xf8: 0x27b8, // ➸ heavy black-feathered rightwards arrow
  0xf9: 0x27b9, // ➹ heavy black-feathered north east arrow
  0xfa: 0x27ba, // ➺ teardrop-barbed rightwards arrow
  0xfb: 0x27bb, // ➻ heavy teardrop-shanked rightwards arrow
  0xfc: 0x27bc, // ➼ wedge-tailed rightwards arrow
  0xfd: 0x27bd, // ➽ heavy wedge-tailed rightwards arrow
  0xfe: 0x27be, // ➾ open-outlined rightwards arrow
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
  const codes = Object.keys(mapping)
    .map(Number)
    .sort((a, b) => a - b);

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
