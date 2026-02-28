[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / StructureType

# Type Alias: StructureType

> **StructureType** = `"Document"` \| `"Part"` \| `"Art"` \| `"Sect"` \| `"Div"` \| `"BlockQuote"` \| `"Caption"` \| `"TOC"` \| `"TOCI"` \| `"Index"` \| `"NonStruct"` \| `"Private"` \| `"P"` \| `"H"` \| `"H1"` \| `"H2"` \| `"H3"` \| `"H4"` \| `"H5"` \| `"H6"` \| `"L"` \| `"LI"` \| `"Lbl"` \| `"LBody"` \| `"Table"` \| `"TR"` \| `"TH"` \| `"TD"` \| `"THead"` \| `"TBody"` \| `"TFoot"` \| `"Span"` \| `"Quote"` \| `"Note"` \| `"Reference"` \| `"BibEntry"` \| `"Code"` \| `"Link"` \| `"Annot"` \| `"Ruby"` \| `"RB"` \| `"RT"` \| `"RP"` \| `"Warichu"` \| `"WT"` \| `"WP"` \| `"Figure"` \| `"Formula"` \| `"Form"` \| `string` & `object`

Defined in: [src/accessibility/structureTree.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/accessibility/structureTree.ts#L50)

Standard structure types defined by the PDF specification (ISO 32000-1,
Table 333 through Table 340), plus a `string` catch-all for custom
structure types.

Groups:
- **Grouping**: Document, Part, Art, Sect, Div, BlockQuote, Caption,
  TOC, TOCI, Index, NonStruct, Private
- **Block-level**: P, H, H1..H6
- **List**: L, LI, Lbl, LBody
- **Table**: Table, TR, TH, TD, THead, TBody, TFoot
- **Inline-level**: Span, Quote, Note, Reference, BibEntry, Code,
  Link, Annot
- **Ruby / Warichu**: Ruby, RB, RT, RP, Warichu, WT, WP
- **Illustration**: Figure, Formula, Form
