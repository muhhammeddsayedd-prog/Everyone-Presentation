"""Create the fixed persisted17 regression from the existing local transport."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
text=(root/'tools/test-m03-candidate-kernel.mjs').read_text(encoding='utf8')
start=text.index('const FILES=');end=text.index('const LOCK=',start)
text=text[:start]+"""const FILES=['tests/db/m02-specs-assets-candidate.sql','tests/db/m02-pdf-vision-prepare.sql','tests/db/m02-pdf-vision-assertions.sql',
 'tests/db/m03-candidate-kernel.sql','tests/db/m03-candidate-kernel-behavior.sql','tests/db/m03-candidate-lifecycle.sql','tests/db/m03-candidate-partial-issues.sql','tests/db/m03-candidate-batch-control.sql'];
"""+text[end:]
text=text.replace('Fixed local16 composed candidate boundary','Fixed persisted17 specs and candidate compatibility boundary')
text=text.replace('tools/sql/specs-read-operation-readback.sql','tools/sql/candidate-pipeline-readback.sql').replace('rows[0].versions.length,16','rows[0].versions.length,17')
text=text.replace("set local eps.m03_candidate_rehearsal='rollback-only-v1';", "set local eps.m03_candidate_rehearsal='rollback-only-v1';set local eps.specs_assets_rehearsal='rollback-only-v1';")
text=text.replace("scope:'Synthetic SQL only: complete silent/zero-frame path, private payloads, callback replay and scoped asset fences; no native/video/Storage HTTP or provider acceptance.'", "scope:'Persisted17 synthetic SQL: existing M02 PDF/DOCX/vision through new bridges and seven M03 state/permission cases in separate rolled-back fixture transactions; no native/bytes/provider/cloud.'")
anchor="  const output=await execute(fragments.map(([,source])=>source).join('\\n'),runId);"
assert text.count(anchor)==1
text=text.replace(anchor,"""  const prepare=fragments[1][1];
  const red=" execute 'set local role eps_specs_assets_executor';perform pg_temp.asset_expect('select eps.store_specs_preparation(current_setting(''eps.vision.scope'')::jsonb)','RESULT_INVALID');execute 'set local role postgres';";
  assert.equal(prepare.split(red).length,2);
  // This historical fixture's one pre16 RED expectation is removed only in
  // this persisted17 regression. Its GREEN validation is executed unchanged.
  const specs=await execute([fragments[0][1],prepare.replace(red,'').replace("select 'PDF_VISION_RED_CURRENT_METHOD_REJECTED';",''),fragments[2][1]].join('\\n'),runId+'-specs');
  assert.equal(specs.split(/\\r?\\n/u).filter(line=>line==='PDF_VISION_GREEN_PAGES_CALLBACK_AND_FORMAT_GUARDS_PASSED').length,1);
  report.specs_assets_and_vision_dispatch_passed=true;
  const output=await execute(fragments.slice(3).map(([,source])=>source).join('\\n'),runId+'-candidate');""")
text=text.replace('tracking/evidence/m03/kernel-local','tracking/evidence/m03/persisted17-compatibility')
text=text.replace('Fixed local16 candidate kernel rehearsal stopped.','Fixed persisted17 compatibility regression stopped.')
(root/'tools/test-persisted17-compatibility.mjs').write_bytes(text.encode())
