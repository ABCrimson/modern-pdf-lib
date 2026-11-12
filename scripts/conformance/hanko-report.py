"""Record what pyHanko makes of each signed input of the conformance run.

    python -I scripts/conformance/hanko-report.py --manifest <dir>/manifest.json --out <dir>

Reads the manifest that scripts/conformance/generate.ts wrote and, for every pyHanko entry, writes
``<out>/<file stem>.json`` with three views of the file:

* ``cli``: exit code and output of ``pyhanko sign validate --no-revocation-check --trust
  <signer.pem> --trust-replace --pretty-print <file>``. pyHanko exits 0 and prints nothing when its
  reader finds no signature, so the exit code alone is never read as a pass.
* ``signaturesFound``: the number of signatures pyHanko's reader finds through the catalog's
  /AcroForm (``PdfFileReader.embedded_signatures``), with their field names.
* ``fieldScan``: every object with ``/FT /Sig`` and a ``/V`` value in any revision, validated
  directly through the pyHanko API (``EmbeddedPdfSignature`` and ``validate_pdf_signature`` with
  ``ValidationContext(trust_roots=[signer], allow_fetching=False)``), whether or not the catalog
  links it. A field with a VALID bottom line that the reader does not find is a sound signature
  that the catalog does not reach, which is not the same as a cryptographic failure. When the full
  validation raises (for example in the difference analysis of a later revision), the bottom line
  is False, the error is kept, and ``withoutDiffAnalysis`` holds a second run with
  ``skip_diff=True`` that shows whether the CMS itself is sound.

``catalog`` records whether the newest catalog has /AcroForm, /Perms (and its keys) and /DSS, and
each scanned field records the /Reason, /Location and /ContactInfo of its signature dictionary,
the transform methods (/DocMDP, /FieldMDP) of its /Reference entries and ``widgetPages``, the
indexes of the pages of the newest page tree whose /Annots list the field or one of its widgets.
``fields`` repeats the manifest's list of the field names the generator passed to signPdf, so
scripts/conformance/summarize.ts can tell a field a writer added by itself. summarize.ts reads
these reports and, for a row that expected.json marks ``withheld``, replaces the report with its
file, case and writer before the workflow uploads it.

The script reads the files and never repairs or rewrites one. Nothing here uses the network: the
CLI runs with --no-revocation-check and the field scan with allow_fetching=False. Exit codes: 0
when a report was written for every pyHanko entry (whatever the verdicts), 1 when the manifest has
no pyHanko entry or names no signer, 2 on bad arguments (argparse).

A Python file in a TypeScript repository: pyHanko has no machine-readable output of its own, so the
reader count and the field scan need its API. Its imports come from the standard
library and the hash-pinned closure in .github/conformance/pyhanko-requirements.txt only.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from importlib.metadata import version
from pathlib import Path
from typing import Any

from pyhanko.keys import load_cert_from_pemder
from pyhanko.pdf_utils import generic
from pyhanko.pdf_utils.reader import PdfFileReader
from pyhanko.sign.validation import validate_pdf_signature
from pyhanko.sign.validation.pdf_embedded import EmbeddedPdfSignature
from pyhanko.sign.validation.status import PdfSignatureStatus
from pyhanko_certvalidator import ValidationContext

CLI_TIMEOUT_SECONDS = 120
CLI_OUTPUT_LIMIT = 20_000


def describe_error(error: BaseException) -> str:
    return f'{type(error).__name__}: {error}'


def run_cli(pdf: Path, signer: Path) -> dict[str, Any]:
    """Run ``pyhanko sign validate`` from this interpreter's pyHanko and keep its output."""
    command = [
        sys.executable,
        '-I',
        '-m',
        'pyhanko',
        'sign',
        'validate',
        '--no-revocation-check',
        '--trust',
        str(signer),
        '--trust-replace',
        '--pretty-print',
        str(pdf),
    ]
    try:
        done = subprocess.run(
            command, capture_output=True, text=True, timeout=CLI_TIMEOUT_SECONDS, check=False
        )
    except subprocess.TimeoutExpired:
        return {'exitCode': None, 'error': f'timed out after {CLI_TIMEOUT_SECONDS} s'}
    return {
        'exitCode': done.returncode,
        'stdout': done.stdout[:CLI_OUTPUT_LIMIT],
        'stderr': done.stderr[:CLI_OUTPUT_LIMIT],
    }


def text_entry(dictionary: generic.DictionaryObject, key: str) -> str | None:
    value = dictionary.get(key)
    return None if value is None else str(value)


def reference_methods(sig_object: generic.DictionaryObject) -> list[str]:
    """Transform methods named by the /Reference array of a signature dictionary."""
    references = sig_object.get('/Reference')
    if references is None:
        return []
    methods = []
    for reference in references:
        method = reference.get_object().get('/TransformMethod')
        if method is not None:
            methods.append(str(method))
    return methods


def annotation_pages(reader: PdfFileReader) -> dict[int, int]:
    """Object number of every indirect annotation in a page's /Annots -> that page's index.

    Walks the newest page tree in document order; a node seen twice is skipped.
    """
    pages: dict[int, int] = {}
    seen: set[int] = set()
    page_index = 0
    pending = [reader.root.raw_get('/Pages')]
    while pending:
        raw = pending.pop()
        if isinstance(raw, generic.IndirectObject):
            if raw.idnum in seen:
                continue
            seen.add(raw.idnum)
        node = raw.get_object()
        if not isinstance(node, generic.DictionaryObject):
            continue
        if '/Kids' in node:
            kids = node['/Kids']
            # Reversed onto the stack, so the first kid is walked first.
            pending.extend(kids.raw_get(i) for i in reversed(range(len(kids))))
            continue
        if '/Annots' in node:
            annots = node['/Annots']
            for i in range(len(annots)):
                annot = annots.raw_get(i)
                if isinstance(annot, generic.IndirectObject):
                    pages.setdefault(annot.idnum, page_index)
        page_index += 1
    return pages


def widget_pages(
    field: generic.DictionaryObject, ref: generic.Reference, pages: dict[int, int]
) -> list[int]:
    """Indexes of the pages whose /Annots list the field itself or one of its /Kids widgets."""
    numbers = {ref.idnum}
    if '/Kids' in field:
        kids = field['/Kids']
        for i in range(len(kids)):
            kid = kids.raw_get(i)
            if isinstance(kid, generic.IndirectObject):
                numbers.add(kid.idnum)
    return sorted({pages[n] for n in numbers if n in pages})


def signature_fields(reader: PdfFileReader) -> list[tuple[int, generic.Reference]]:
    """Every object of any revision that is a signature field with a value, oldest first.

    Each reference is reported once, with the newest revision that writes it.
    """
    newest: dict[generic.Reference, int] = {}
    for revision in range(reader.xrefs.total_revisions):
        for ref in reader.xrefs.explicit_refs_in_revision(revision):
            newest[ref] = revision
    found = []
    for ref, revision in newest.items():
        try:
            obj = reader.get_object(ref)
        except Exception:  # an unreadable object is not a signature field; the reader reports it
            continue
        if (
            isinstance(obj, generic.DictionaryObject)
            and obj.get('/FT') == '/Sig'
            and '/V' in obj
        ):
            found.append((revision, ref))
    return sorted(found, key=lambda item: (item[0], item[1].idnum))


def scan_field(
    reader: PdfFileReader,
    revision: int,
    ref: generic.Reference,
    trust: ValidationContext,
    linked: set[str],
    pages: dict[int, int],
) -> dict[str, Any]:
    field = reader.get_object(ref)
    name = str(field.get('/T', f'object {ref.idnum}'))
    record: dict[str, Any] = {
        'field': name,
        'object': ref.idnum,
        'revision': revision,
        'linkedFromCatalog': name in linked,
        'widgetPages': widget_pages(field, ref, pages),
    }
    try:
        signature = EmbeddedPdfSignature(reader, field, name)
        sig_object = signature.sig_object
        record['reason'] = text_entry(sig_object, '/Reason')
        record['location'] = text_entry(sig_object, '/Location')
        record['contactInfo'] = text_entry(sig_object, '/ContactInfo')
        record['referenceMethods'] = reference_methods(sig_object)
    except Exception as error:  # a field pyHanko cannot read is a verdict, not a crash
        record.update({'bottomLine': False, 'error': describe_error(error)})
        return record
    try:
        record.update(status_fields(validate_pdf_signature(signature, trust, skip_diff=False)))
    except Exception as error:
        # The full validation (with the difference analysis of later revisions) did not finish:
        # the bottom line is False, and a second run without the difference analysis records
        # whether the CMS itself is sound.
        record.update({'bottomLine': False, 'error': describe_error(error)})
        try:
            without_diff = validate_pdf_signature(signature, trust, skip_diff=True)
            record['withoutDiffAnalysis'] = status_fields(without_diff)
        except Exception as second:
            record['withoutDiffAnalysis'] = {'error': describe_error(second)}
    return record


def status_fields(status: PdfSignatureStatus) -> dict[str, Any]:
    modification_level = status.modification_level
    return {
        'bottomLine': status.bottom_line,
        'intact': status.intact,
        'valid': status.valid,
        'trusted': status.trusted,
        'mdAlgorithm': status.md_algorithm,
        'coverage': None if status.coverage is None else status.coverage.name,
        'modificationLevel': None if modification_level is None else modification_level.name,
        'docmdpOk': status.docmdp_ok,
        'summary': status.summary(),
    }


def report_file(pdf: Path, signer: Path, entry: dict[str, Any]) -> dict[str, Any]:
    report: dict[str, Any] = {
        'file': entry['file'],
        'case': entry.get('case'),
        'writer': entry.get('writer'),
        'fields': entry.get('fields', []),
        'tools': {
            'python': sys.version.split()[0],
            'pyhanko': version('pyhanko'),
            'pyhankoCli': version('pyhanko-cli'),
            'pyhankoCertvalidator': version('pyhanko-certvalidator'),
        },
        'cli': run_cli(pdf, signer),
    }
    trust = ValidationContext(
        trust_roots=[load_cert_from_pemder(str(signer))],
        allow_fetching=False,
        revocation_mode='soft-fail',
    )
    with pdf.open('rb') as stream:
        try:
            reader = PdfFileReader(stream, strict=False)
            found = reader.embedded_signatures
            root = reader.root
        except Exception as error:
            report.update({'verdict': 'parse-failure', 'error': describe_error(error)})
            return report
        linked = {signature.field_name for signature in found}
        perms = root.get('/Perms')
        report['signaturesFound'] = len(found)
        report['signatureFields'] = sorted(linked)
        report['catalog'] = {
            'acroForm': '/AcroForm' in root,
            'perms': [] if perms is None else sorted(str(key) for key in perms.get_object()),
            'dss': '/DSS' in root,
        }
        pages = annotation_pages(reader)
        report['fieldScan'] = [
            scan_field(reader, revision, ref, trust, linked, pages)
            for revision, ref in signature_fields(reader)
        ]
    scanned = report['fieldScan']
    report['fieldScanVerdict'] = (
        'none' if not scanned else 'valid' if all(f['bottomLine'] for f in scanned) else 'invalid'
    )
    if report['signaturesFound'] == 0:
        report['verdict'] = 'no-signature-found'
    else:
        linked_ok = all(f['bottomLine'] for f in scanned if f['linkedFromCatalog'])
        report['verdict'] = 'valid' if report['cli']['exitCode'] == 0 and linked_ok else 'invalid'
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--manifest', required=True, type=Path, help='manifest.json of generate.ts')
    parser.add_argument('--out', required=True, type=Path, help='directory for the JSON reports')
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding='utf-8'))
    base = args.manifest.parent
    entries = [entry for entry in manifest.get('files', []) if entry.get('oracle') == 'pyhanko']
    if not entries or not manifest.get('signer'):
        print(f'{args.manifest}: no pyHanko entries or no signer', file=sys.stderr)
        return 1
    signer = base / manifest['signer']
    args.out.mkdir(parents=True, exist_ok=True)
    for entry in entries:
        report = report_file(base / entry['file'], signer, entry)
        target = args.out / f'{Path(entry["file"]).stem}.json'
        target.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
        # The log names the file only: summarize.ts decides what the public summary shows of it.
        print(f'{entry["file"]}: report written to {target.name}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
