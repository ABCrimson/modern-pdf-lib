# Image fixtures

| File               | Made by                                                        | How                                                                                                                                                                                         |
| ------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pillow-16x16.jpg` | Pillow 13.0.0 (libjpeg-turbo 3.2.0), Python 3.14.4, 2026-11-11 | `Image.new("RGB", (16, 16))`, pixel (x, y) = (16x, 16y, 128), `save(out, format="JPEG", quality=90)`; 678 bytes, SHA-256 `fd0db6301a338433c269e30e8683a371c1595baddb83268ffcafb858b06c51fc` |

`pillow-16x16.jpg` is the decodable JPEG from an outside encoder that the JPEG row of
tests/oracle/writer-matrix.test.ts embeds and checks with qpdf and pdf.js. `sample.jpg` is older
and is not a decodable JPEG (qpdf reports "JPEG data is corrupt"); in the oracle project only a
format-detection check (tests/oracle/capabilities.test.ts) reads it, and no oracle row decodes it.
