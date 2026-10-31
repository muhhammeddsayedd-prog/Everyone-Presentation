# Production dependency and schema closure

Root's credential-free local launch of the deployed f391 daemon image failed
before the main startup guard: Node could not resolve `ajv`. The image copied
only the dependency builder's root `node_modules`; npm's production workspace
installation also placed required modules under the workspace directories.
The runtime also imports four JSON contracts outside the formerly staged tree.
This is a packaging defect, separate from the prior passing tiny native smoke.

Both Dockerfiles now copy the builder's `/opt/eps/apps` and `/opt/eps/packages`
after the source copies. That builder contains only the explicitly copied
workspace package manifests and `npm ci --omit=dev --ignore-scripts` output;
it has no private environment, source uploads or credential files. These copies
preserve nested production dependencies and workspace resolution. The original
root dependency copy stays in place. The dependency install and native heavy
APT/Chromium prefix are byte-identical to the prior image source.

Only these existing public runtime JSON files enter the source seal and sparse
context: `specs-extraction.schema.json`, `candidate-extraction.schema.json`,
`frame-selection.schema.json` and `slide-wording.schema.json`, all under
`contracts/json-schema/`. Both images copy those four files explicitly. Other
contracts remain outside the allowlist. A focused test compares the actual
integration-module JSON imports with that exact set.

The daemon build imports `runtime-main.ts` using production `tsx` as its final
UID1000 in a `RUN --network=none` layer. The imported module's existing entry
guard does not call the poller. The guard runs against the final image filesystem
and pruned dependency tree; host development dependencies cannot satisfy it.
It exercises import closure without credentials or provider/DB/job calls.
Docker documents network isolation for this build instruction in its
[Dockerfile reference](https://docs.docker.com/reference/dockerfile/#run---network).
The dependency installation retains the documented
[`npm ci` options](https://docs.npmjs.com/cli/v11/commands/npm-ci/).

All native UID/capability/NNP/process/file/network/scratch controls remain
unchanged. The new coherent graph must come from pristine49/5f, retaining its
dependency inputs, with the existing two NPROC overlays, both Dockerfiles, the
seal validator and these four JSON additions:156 source records/160 context
files. The already baked7b context is preserved. Existing secret-transfer and
frame-pin claims are immutable; adoption requires separately reviewed public
manifest/source-pin and future-frame forward updates, followed by a new daemon
deployment. No private environment transfer or credential rotation is part of
this fix.

Author tests establish the closed source/build contract only. Root's actual
fresh image build, credential-free production import/default-entry checks and
hosted startup receipts remain the evidence for the packaged artifact. The
author performed no Docker, provider, private configuration or deployment action.
