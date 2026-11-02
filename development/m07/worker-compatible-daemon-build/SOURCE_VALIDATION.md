# Source preparation, 2026-11-02

The focused command in README passed **8/8** in **0.384 s** with Main's isolated Python environment. The actual default-off subprocess refused exit 1 with the static diagnostic before library/private-profile initialization. No stage, Docker, registry, provider, SQL or artifact operation ran. The native tests read only the retained small generated source/graph/manifest metadata; fake ports supplied all stage/reuse effects.

The final follow-up added the usual top-level `source_sha256` alias to the new daemon safe-receipt envelope, alongside explicit daemon and old-native identities. It does not change local transport, selected product bytes or the emitter. The folder remains default OFF and its future profile remains `None`.

Root's source review identified that raw native dependency row admission occurred only after emitter reuse. The follow-up extracts one shared pure guard and applies it before the new reuse claim/emitter call, after actual staged graph validation, retaining the post-reuse check. The added native-module/lock-row regression keeps the emitted graph identical yet requires zero reuse calls and no reuse claim. A private ignored source copy with only that pre-reuse call removed produced the expected RED (`ValueError not raised`); the original source was untouched. The corrected complete suite passed **9/9** in **0.336 s**, with diff check zero. No native rebuild, stage or provider action occurred.

This preparation is independent of the historical native build/probe and of future real daemon export, registry readiness, worker startup/cutover and specs-job completion. It does not assert production deployment, model factual accuracy or full M07 verification.
