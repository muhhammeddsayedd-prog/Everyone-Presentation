# Reachable-history privacy inventory

Read-only metadata inventory of Main commit
`d1e45592c972d4d14bde13a1517594ee896398e9`: 298 commits, 7,425 reachable
blobs totaling 1,054,434,849 bytes. Its tree has 6,616 tracked paths totaling
1,022,584,520 bytes; 6,617 distinct paths occur across its ancestry. There are
2,352 current evidence paths. Git tree/log/object-size metadata was read; blob
payloads were not rescanned for this inventory. No individual personal filenames
or payloads are included here.

The classes overlap. Each class has the same current-path and distinct
historical-path count at this commit.

| Safe path class | Paths | Current bytes |
| --- | ---: | ---: |
| Images | 100 | 10,173,881 |
| Screenshot-folder paths | 5 | 93,941 |
| Evidence media/PDF/caption paths | 94 | 10,048,191 |
| PDF fixture paths | 2 | 1,912 |
| Standalone video extensions | 0 | 0 |
| Standalone audio extensions | 0 | 0 |
| Transcript-named text/data or caption paths | 61 | 692,563 |
| Structured-data/source fixture paths | 15 | 66,314 |
| Archives | 1 | 787,228 |

Metadata does not distinguish real cast from synthetic examples, prove that a
transcript-named file contains raw transcripts, or establish whether JSON,
HTML, source, images or archives embed personal material. The two tiny fixture
PDFs are not evidence that production-downloaded PDFs were committed. Existing
handoff records explicitly identify retained live acceptance material.

## Separate fixed-family secret result

Root's actual delta receipt
[`2026-11-02T10-14-18.464Z-2e4f4db8-history-privacy-delta.json`](2026-11-02T10-14-18.464Z-2e4f4db8-history-privacy-delta.json)
has SHA256 `93bf5d1049490f7fc4a1b8c90a501a1cc08d9af65feff9ca6cf3c08b0e0f935f`
and binds this same Main commit. It passed for 476 new unique blobs /
17,601,050 bytes with zero hits; 6,949 previously scanned blobs were reused.
All ten private input files remained stable, with Root-attested continuity from
the prior audit. This covers the existing fourteen fixed secret families and
their derived encodings; it is not a PII or every-secret-class audit. This
inventory did not repeat that scan.

**Full public publication is not admitted.** Live-material provenance, public
consent, PII sanitization and public disclosure of reachable history have not
been established. Root confirmed private/writable repository status through
normal `gh` and independently read back pushed Main at the stated commit.
Private containment is distinct from public privacy acceptance; no public
visibility change is authorized by this incomplete review. No source rewrite,
deletion, visibility change, push or provider action was performed by this
inventory.
