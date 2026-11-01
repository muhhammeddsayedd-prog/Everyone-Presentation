# Owner task: fresh MCP upload through saved presentation

Run this after the current Claude frontend task has finished, through the existing
authenticated `everyone-studio` connection. Do not reconnect or change settings.
Read `development/m07/PRIVATE_UPLOAD_HANDOFF.md` for the supported client transfer.
Use actual tool schemas; return only safe IDs, status, error codes and request IDs.
Never return signed URLs, UploadSession objects, tokens, headers or private text.

1. Read workspace `86936940-b48d-497d-b1ff-8e0da0913afa`, project
   `6da14b82-8458-451f-aa21-28cb6c85bdc5` (Live Testing Project), confirmed Reviewed
   candidate `25a3c924-7b6c-48e3-88ce-c72e72b99c6d`, media, current participation,
   assignments, slots and saved versions through MCP. Retain safe baseline IDs,
   revisions, selected media/frames and Reviewed status. This is a new introduction
   for this known person; preserve their confirmed facts.
2. From Main `D:\Everyone\Presentation\Everyone-Presentation-Studio`, prepare a
   NEW inbox when ready to transfer, with:

   ```text
   node --import tsx tools/client-upload-inbox.mts prepare --allowed-root "C:\Users\iway\Downloads\Test Folder" --file "C:\Users\iway\Downloads\Test Folder\Videos\IMG_2850.MP4" --purpose candidate_video --mime video/mp4 --size 4316429 --sha256 ffe461d30d48b32d90f1165627e2d104b6817f61d96a5a4bd9dcd6ff1964fc0a
   ```

   Its returned expiry is 15 minutes after preparation. Never reuse a prior
   expired/consumed inbox or instructions. The helper verifies actual source bytes.
3. Call MCP `create_upload_session` with the returned reservation metadata,
   workspace and candidate IDs above. Use a stable reservation key derived from
   this NEW handoff UUID. Keep its UploadSession inside this client context.
   Structured Write must create the exact returned private `handoff_file` using
   this closed shape and the newly returned values:

   ```text
   {"schema_version":"1.0","handoff_id":<prepared UUID>,"nonce":<prepared nonce>,"manifest_sha256":<prepared hash>,"expected_upload_id":<session.id>,"expected_asset_id":<session.asset_id>,"session":<exact UploadSession>}
   ```

   Do not place capability data in a shell command, heredoc, environment, chat or
   general log. If structured Write/local execution is unavailable or denied,
   stop that step and report the safe limitation. Do not bypass a denial.
4. Run the existing helper with only nonsecret IDs:

   ```text
   node --import tsx tools/client-upload-inbox.mts transfer --handoff-id <new UUID> --manifest-sha <new hash> --upload-id <session.id> --asset-id <session.asset_id>
   ```

   On `result:transferred`, call MCP `complete_upload` with its exact
   `completion_body` and a distinct stable completion key. Replay that same
   completion key once and verify the same job/asset. Do not transfer twice.
5. Follow the new `get_job` to terminal state and re-read persisted media,
   candidate and workspace state. Retain safe IDs/stages/request IDs. A failed
   source remains failed; do not retry nonretryable or protected/old jobs.
   Preserve confirmed facts/Reviewed status. AI suggestions are not confirmations.
6. With fresh revisions, select this successfully processed introduction and
   its actual frames. Retain unrelated assignments and Main choices. Reuse the
   candidate's valid assignment, or add it to a suitable existing open slot.
   Keep explicit Shortlist separate from position. Read workspace review and
   address only supported issues. Missing facts/English content stay explicit.
   Stop for an actual unresolved factual decision; never fabricate a pass.
7. Confirm external Agency Selection series
   `93fb7425-7311-4b69-94cb-61588724c153` belongs to this workspace. Generate one
   future version using current expected revision/fingerprint and a stable key
   derived from the handoff UUID. Follow the render job, then `get_version`,
   `download_version_pdf` and `play_version_media`. Keep delivery URLs private.
   Compare saved media/frame IDs and English content with the intended choices,
   and re-read to establish persistence. Preserve all old Ready versions.
8. Call `get_feedback_summary` on this new version and retained English version
   `4f1b81a1-adb7-425b-8223-458d8bd82c28`. Return version IDs, count/null semantics
   and request IDs without comment text. Guest-summary lifecycle has a separate
   bounded helper in `development/m07/guest-summary-delta/README.md`; use it only
   after reading its exact temporary-link scope and required producer snapshots.

Return new upload/asset/job/media/version/PDF IDs, actual status, same-key replay
outcome, safe errors/request IDs and the preservation observations. A partial
result is useful; it is not complete M07 acceptance. Root will compare the app,
API and provider metadata. Token lifecycle/contributor/manual screen-reader and
representative workload checks keep their separate evidence requirements.
