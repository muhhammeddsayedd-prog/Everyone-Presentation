# Saved English display observation — 2026-10-31

Root observed the actual hosted saved player for Ready version
`4f1b81a1-adb7-425b-8223-458d8bd82c28`, series
`93fb7425-7311-4b69-94cb-61588724c153`, generation job
`90e815ba-7eb8-4ea8-bd70-4f3a02ed9997`.

The [exact saved-capture observer receipt](../../../tracking/evidence/m03/english-version34/2026-10-31T18-17-52-411860Z-f022da9a-3e56-45a2-a734-387e7e110c50-capture.json)
passed all 24 checks. It binds the actual new Ready cohort 1.0 version, controlled
scan, selected video/media revision, stored English text/hash and immutable
companions. It explicitly does not grant app/guest/old-cohort or semantic
acceptance by itself.

The separate actual browser observation found one expanded English region,
`lang=en`, 248 UTF8 bytes and SHA256
`0e81d416e19b6600930cd171083595f6a7604f1cc755654f75732c60f561cecd`,
matching the observer. The original video reached readyState4, played to
18.580216 seconds of 21.856009 seconds, rendered 853×480 with no media error, and
was then paused. This is an internal saved-player observation; no guest-browser
or full-video-completion claim follows.

## Correct supported CUA invocation

With the reviewed raw JavaScript capture function available in CUA Node, pass
an **invoked expression string** to the connected tab:

```javascript
const expression = '(' + captureVisibleEnglishRegion.toString() + ')()';
let privateCapture;
let publicProof;
try {
  privateCapture = await tab.playwright.evaluate(expression);
  publicProof = visibleEnglishRegionProof(privateCapture, expectedEnglishSha256);
} finally {
  if (privateCapture) delete privateCapture.privateText;
  privateCapture = undefined;
}
nodeRepl.write(publicProof);
```

The initial `evaluate(fn.toString())` supplied a function declaration without
invoking it. That returned `undefined`, and the Node guard correctly reported
`CAPTURE_INVALID`. The corrected `evaluate('(' + fn.toString() + ')()')` returned
the private bounded capture and the proof passed. Retain the first false capture
as a verification-invocation error; it is not an app, translation or playback
failure. The frozen helper and README were not changed after the observer pinned
them.

Browser evaluation uses DOM only. UTF8 length and SHA are computed with standard
Node Buffer/crypto outside the page. Never print, persist or log privateCapture,
privateText, transcript content, URLs or tokens. Only the closed proof metadata
is published. Route/session/version access still needs its separate actual
app/API evidence; a matching DOM hash does not prove translation semantics.

Guest display/playback remains a separate live check at this checkpoint. Manual
screen-reader acceptance remains pending and mobile testing remains skipped.
