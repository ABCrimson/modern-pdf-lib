/**
 * @module compliance/rasterProfile
 *
 * Identification XMP packet builders for two PDF 2.0-era conformance
 * profiles that, unlike PDF/A and PDF/UA, do **not** define their own
 * ISO `…id/`-style XMP identification namespace:
 *
 * - **WTPDF** — "Well-Tagged PDF" (PDF Association specification,
 *   "Using Tagged PDF for Accessibility and Reuse in PDF 2.0", v1.0,
 *   February 2024).
 * - **PDF/R** — "Raster image transport and storage" (ISO 23504-1:2020,
 *   the ISO version of the PDF Association's PDF/Raster 1.0 spec).
 *
 * These builders emit *identification markers only*. They assert which
 * profile a document claims to follow; they do **not** validate or
 * guarantee conformance, and they do not mutate any PDF document.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS VERIFIED vs. WHAT IS PROVISIONAL
 * ---------------------------------------------------------------------------
 *
 * VERIFIED (from primary / corroborated sources):
 *
 * - WTPDF conformance is asserted via the PDF Association **"PDF
 *   Declarations"** mechanism embedded in document-level XMP — NOT via a
 *   bespoke `pdfwtid:part`/`conformance` namespace. PDF Declarations use
 *   the namespace prefix `pdfd` with namespace URI `http://pdfa.org/
 *   declarations/`, an `pdfd:declarations` container holding an `rdf:Bag`
 *   of declaration resources, each with a `pdfd:conformsTo` URI and an
 *   optional `pdfd:claimData` block (`pdfd:claimBy`, `pdfd:claimDate`,
 *   `pdfd:claimCredentials`, `pdfd:claimReport`).
 *   (PDF Association, "PDF Declarations — A use of ISO 32000", 2019;
 *   "Industry-recognized PDF Declarations".)
 *
 * - WTPDF 1.0 defines two conformance levels: **reuse** and
 *   **accessibility**. (PDF Association WTPDF 1.0.)
 *
 * - PDF/R (ISO 23504 / PDF/Raster 1.0) is primarily identified by a
 *   PDF *comment marker placed immediately before the final `startxref`*
 *   in the file trailer — it has **no ISO-defined XMP identification
 *   namespace**. (PDF Association, "PDF/raster: An Overview";
 *   ISO 23504-1:2020.) Any XMP-based identification for PDF/R is therefore
 *   non-normative.
 *
 * - The general ISO XMP identification pattern (used by `pdfaid` /
 *   `pdfuaid`) renders an integer `part`, an optional 4-digit-year `rev`,
 *   and a `conformance` token inside an `rdf:Description rdf:about=""`.
 *
 * PROVISIONAL / UNVERIFIED (clearly flagged; do not treat as normative):
 *
 * - The exact `pdfd:conformsTo` target URIs used below for WTPDF and
 *   PDF/R. The WTPDF declaration URI form is *explicitly acknowledged as
 *   inconsistent* in the source material: the PDF Association corrected it
 *   from `http://pdfa.org/declarations#wtpdf-reuse1.0` to
 *   `http://pdfa.org/declarations/wtpdf#reuse1.0`, and even the trailing
 *   `/`-vs-`#` form remains contested (see pdf-association/pdf-issues
 *   #395). We therefore treat the precise fragment as provisional.
 *
 * - No PDF/R `conformsTo` URI is published under the PDF Declarations
 *   registry at the time of writing; the value used here follows the same
 *   pattern and is provisional.
 *
 * Because of the above, callers MUST NOT rely on byte-for-byte matching of
 * the emitted `conformsTo` URIs for normative validation. The verified,
 * stable parts are the XMP envelope, the `pdfd` namespace/structure, and
 * the rendered `part`/`conformance` values.
 *
 * @see https://pdfa.org/wtpdf/
 * @see https://pdfa.org/resource/pdf-declarations/
 * @see https://pdfa.org/resource/iso-23504-pdfr/
 * @see https://github.com/pdf-association/pdf-issues/issues/395
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Options for building a profile identification XMP packet. */
export interface ProfileXmpOptions {
  /**
   * The standard's part number. Defaults to `1`
   * (WTPDF 1.0 / ISO 23504-1, i.e. PDF/R-1).
   */
  part?: number | undefined;
  /**
   * The conformance level / token. Optional and free-form because these
   * profiles do not share a single normative conformance vocabulary
   * (e.g. WTPDF uses `'reuse'` | `'accessibility'`).
   */
  conformance?: string | undefined;
}

// ---------------------------------------------------------------------------
// Constants (verified namespace; provisional conformsTo targets)
// ---------------------------------------------------------------------------

/**
 * VERIFIED: PDF Association "PDF Declarations" namespace URI / prefix.
 * (Some published examples use the `https://` scheme; the `http://` form
 * is the one most commonly cited and is used here for stability.)
 */
const PDFD_NS = 'http://pdfa.org/declarations/';

/**
 * PROVISIONAL: WTPDF declaration target URIs, keyed by conformance level.
 * The fragment form follows the PDF Association's corrected pattern
 * (`…/declarations/wtpdf#<level>1.0`) but is acknowledged as unsettled
 * (pdf-issues #395). Treat as identification hint, not normative match.
 */
const WTPDF_CONFORMS_TO_BASE = 'http://pdfa.org/declarations/wtpdf#';

/**
 * PROVISIONAL: PDF/R declaration target URI. ISO 23504 / PDF/Raster has
 * no published PDF Declarations URI; this follows the same pattern and is
 * non-normative.
 */
const PDFR_CONFORMS_TO = 'http://pdfa.org/declarations/pdfr#1.0';

// ---------------------------------------------------------------------------
// XML escaping
// ---------------------------------------------------------------------------

/** Escape XML special characters in a string. */
function escapeXml(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

// ---------------------------------------------------------------------------
// Shared packet assembly
// ---------------------------------------------------------------------------

/**
 * Identification facts shared by both profile builders.
 *
 * `profileName` is a human-readable label rendered as a comment; it is
 * informational only and never used for matching.
 */
interface ProfileIdentity {
  /** Human-readable profile label (rendered as an XML comment). */
  readonly profileName: string;
  /** PROVISIONAL `pdfd:conformsTo` target URI. */
  readonly conformsTo: string;
  /** The resolved part number. */
  readonly part: number;
  /** The optional conformance token. */
  readonly conformance: string | undefined;
}

/**
 * Build an XMP packet carrying a single PDF Declaration plus a plain
 * `part`/`conformance` identification block.
 *
 * The packet is intentionally minimal: it declares the verified `pdfd`
 * PDF Declarations namespace and structure, embeds the (provisional)
 * `conformsTo` target, and additionally renders the supplied `part` and
 * `conformance` values under a clearly-named, profile-local namespace so
 * that the identification facts are machine-readable even though no ISO
 * identification namespace exists for these profiles.
 */
function buildIdentificationXmp(identity: ProfileIdentity): string {
  const { profileName, conformsTo, part, conformance } = identity;

  let xmp = '<?xpacket begin="\xef\xbb\xbf" id="W5M0MpCehiHzreSzNTczkc9d"?>\n';
  xmp += '<x:xmpmeta xmlns:x="adobe:ns:meta/">\n';
  xmp += `  <!-- ${escapeXml(profileName)} identification marker (non-normative). -->\n`;
  xmp += '  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n';

  // PDF Declaration (VERIFIED mechanism; PROVISIONAL conformsTo target).
  xmp += '    <rdf:Description rdf:about=""\n';
  xmp += `      xmlns:pdfd="${PDFD_NS}">\n`;
  xmp += '      <pdfd:declarations>\n';
  xmp += '        <rdf:Bag>\n';
  xmp += '          <rdf:li rdf:parseType="Resource">\n';
  xmp += `            <pdfd:conformsTo>${escapeXml(conformsTo)}</pdfd:conformsTo>\n`;
  xmp += '          </rdf:li>\n';
  xmp += '        </rdf:Bag>\n';
  xmp += '      </pdfd:declarations>\n';
  xmp += '    </rdf:Description>\n';

  // Plain identification block under a profile-local namespace.
  // NOTE: this namespace is provisional — these profiles define no ISO
  // identification namespace. It exists only to surface part/conformance
  // as machine-readable values; do not treat it as normative.
  xmp += '    <rdf:Description rdf:about=""\n';
  xmp += '      xmlns:pid="http://modern-pdf-lib/ns/profile-id/">\n';
  xmp += `      <pid:part>${part}</pid:part>\n`;
  if (conformance !== undefined) {
    xmp += `      <pid:conformance>${escapeXml(conformance)}</pid:conformance>\n`;
  }
  xmp += '    </rdf:Description>\n';

  xmp += '  </rdf:RDF>\n';
  xmp += '</x:xmpmeta>\n';
  xmp += '<?xpacket end="w"?>';

  return xmp;
}

// ---------------------------------------------------------------------------
// WTPDF
// ---------------------------------------------------------------------------

/**
 * Build a WTPDF ("Well-Tagged PDF") identification XMP packet.
 *
 * WTPDF conformance is asserted through the PDF Association's PDF
 * Declarations mechanism (VERIFIED). The `conformsTo` target URI is
 * PROVISIONAL — see the module doc comment and pdf-issues #395 for the
 * acknowledged inconsistency in its exact form. This builder produces an
 * identification marker only and does not assert or validate WTPDF
 * conformance.
 *
 * @param options - Optional part (default `1`, i.e. WTPDF 1.0) and a
 *   conformance level (WTPDF defines `'reuse'` and `'accessibility'`).
 * @returns A serialized XMP/RDF identification packet.
 */
export function buildWtpdfIdentificationXmp(
  options?: ProfileXmpOptions,
): string {
  const part = options?.part ?? 1;
  const conformance = options?.conformance;

  // Map the WTPDF conformance level into the provisional declaration URI
  // fragment when a recognised level is supplied; otherwise use a neutral
  // WTPDF target so the declaration still identifies the profile.
  let conformsTo = `${WTPDF_CONFORMS_TO_BASE}1.0`;
  if (conformance === 'reuse' || conformance === 'accessibility') {
    conformsTo = `${WTPDF_CONFORMS_TO_BASE}${conformance}1.0`;
  }

  return buildIdentificationXmp({
    profileName: 'WTPDF (Well-Tagged PDF) 1.0',
    conformsTo,
    part,
    conformance,
  });
}

// ---------------------------------------------------------------------------
// PDF/R
// ---------------------------------------------------------------------------

/**
 * Build a PDF/R (ISO 23504 / PDF/Raster) identification XMP packet.
 *
 * IMPORTANT: PDF/R is normatively identified by a comment marker before
 * the final `startxref` in the file trailer, NOT by XMP. There is no
 * ISO-defined XMP identification namespace for PDF/R, so this XMP marker
 * is non-normative: the `pdfd:conformsTo` target is PROVISIONAL. Use this
 * only as a supplementary, machine-readable hint alongside the required
 * trailer comment marker; it does not assert or validate PDF/R
 * conformance.
 *
 * @param options - Optional part (default `1`, i.e. ISO 23504-1 / PDF/R-1)
 *   and a conformance token.
 * @returns A serialized XMP/RDF identification packet.
 */
export function buildPdfRIdentificationXmp(
  options?: ProfileXmpOptions,
): string {
  const part = options?.part ?? 1;
  const conformance = options?.conformance;

  return buildIdentificationXmp({
    profileName: 'PDF/R (ISO 23504, raster image transport and storage)',
    conformsTo: PDFR_CONFORMS_TO,
    part,
    conformance,
  });
}
