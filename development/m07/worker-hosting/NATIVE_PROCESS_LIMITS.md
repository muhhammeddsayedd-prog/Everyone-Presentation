# Bounded Chromium process/thread capacity

Actual credential-free diagnostic `ae2a2d48` reached browser launch/context and
failed at `browser_page`. Its in-VM bounded browser log projection reported
`resource_exhausted:true` under verified `RLIMIT_NPROC=64`. File-size, disk,
crashpad and sandbox flags were false; `/tmp` used about0.5MiB. Permission and
missing-executable flags also appeared and remain unclassified; they are not
silently dismissed as harmless. All owned resources were removed and the lock
was released. See the immutable
[actual diagnostic receipt](../../../tracking/evidence/m07/worker-hosting/2026-10-30T23-58-15.355Z-ae2a2d48-hosted-probe.json).

Linux `RLIMIT_NPROC` counts threads for the real UID and returns `EAGAIN` when
creation exceeds that capacity. It applies to dedicated native UID65432 after
all capabilities are removed. This explains why final process/thread counts
after browser shutdown cannot establish the peak attempted thread count.
[Linux getrlimit manual](https://man7.org/linux/man-pages/man2/getrlimit.2.html).

The proposed image revision selects a fixed bound of256 only for `review_fit`,
`presentation_render`, `presentation_validate`, `presentation_export_render`
and `presentation_export_validate`. The closed task table rejects unknown,
inherited and non-string task keys. Document, video and PDF raster tasks retain
64; the original INIT boundary also retains64. CPU, memory, file descriptors,
file-size limits, capped scratch, network denial, dedicated identity, cleared
capabilities, NNP, private file descriptors and lifecycle checks are unchanged.

The old launcher `11689381…`, sealed5f/context49 image and all actual failure
receipts remain historical. The change is only a new image source overlay:
`native-task-limits.mjs` plus the launcher's closed per-task selection. It does
not edit the old context, dependencies, daemon identity or browser environment.
An independent source review and a fresh coherent image/context are required
before root's actual synthetic smoke can establish whether this bound resolves
the observed browser failure. Pure tests do not establish a successful renderer
or completed hosted acceptance. No provider or private-media action was
performed by the author.
