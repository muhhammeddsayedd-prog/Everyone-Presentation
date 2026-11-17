// Phase 1: production migration rehearsal on the staging database (history 50 -> 57), one file at a time, each with
// a readback and a compatibility smoke of the PREVIOUS web release (:3161) and PREVIOUS worker (081e2dee) — the
// mixed-version window production goes through between the migrations and the new web/worker release.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { useApp, ok, call, check, note, journey, save, sql, runWorker, WS, ROOT, S } from './lib.mjs';

const OLD = process.env.EPS_STG_OLD_CHECKOUT ?? 'D:/Everyone/Presentation/EPS-c7-old';
const PY = 'd:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe';
const before = JSON.parse(readFileSync(path.join(S, 'before-state.json'), 'utf8'));
useApp('http://127.0.0.1:3161');
const FILES = ['20261116090000_m15_cycle7_shared_schema.sql', '20261116100000_m16_intake_membership_media.sql', '20261116110000_m17_scene_operations.sql',
  '20261116110500_m17_specs_extraction_v2.sql', '20261116120000_m18_notes_audience.sql', '20261116130000_m19_editorial_template_1_4.sql', '20261116140000_m20_appearance_observations.sql',
  '20261116150000_m21_previous_client_compat.sql'];
const READBACK = {
  m15_cycle7_shared_schema: "select (select count(*) from information_schema.columns where table_schema='eps' and table_name='workspace_candidates' and column_name in('portrait_asset_id','portrait_source','portrait_crop','media_selection_state'))=4 and to_regclass('eps.scenes') is not null and to_regclass('eps.scene_occurrences') is not null",
  m16_intake_membership_media: "select to_regprocedure('public.eps_list_workspace_uploads(uuid,text,integer)') is not null and to_regprocedure('public.eps_suggest_media_repairs(uuid)') is not null",
  m17_scene_operations: "select to_regprocedure('public.eps_list_scenes(uuid,text,integer)') is not null or exists(select 1 from pg_proc where proname='eps_list_scenes')",
  m17_specs_extraction_v2: "select (select prompt_version from eps.specs_pipeline_config where id=1)='spec_extract_v1.0.0'",
  m18_notes_audience: "select exists(select 1 from information_schema.columns where table_schema='eps' and table_name='app_settings' and column_name='default_audience_preset_id') and (select default_audience_preset_id is null from eps.app_settings)",
  m19_editorial_template_1_4: "select exists(select 1 from eps.presentation_templates where version='1.4.0' and registered) and (select template_version from eps.app_settings)='1.3.0'",
  m20_appearance_observations: "select to_regclass('eps.candidate_observations') is not null and not coalesce((select enabled from eps.appearance_config limit 1),false)",
  m21_previous_client_compat: "select to_regprocedure('eps.previous_client()') is not null and to_regprocedure('eps.cast_pool_dto_cycle7(uuid)') is not null",
};
const fingerprint = () => sql("select md5(string_agg(t,'|' order by t)) from (select id::text||':'||status||':'||version_number t from eps.presentation_versions union all select id::text||':'||coalesce(revoked_at::text,'') from eps.review_links union all select id::text||':'||template_version from eps.presentation_series) x");

await journey('1-migration-rehearsal', async () => {
  // Preflight (read-only), as on production.
  const [count, last] = sql('select count(*), max(version) from supabase_migrations.schema_migrations').split('|');
  check('preflight_history_50', count === '50' && last === '20261113120000', [count, last]);
  check('preflight_template_default_1_3', sql('select template_version from eps.app_settings') === '1.3.0');
  const userData = fingerprint(); note('user_data_fingerprint_before', userData);
  const steps = [];
  for (const file of FILES) {
    const name = file.replace(/^\d+_/, '').replace(/\.sql$/, '');
    const t0 = Date.now();
    const out = execFileSync(PY, ['-X', 'utf8', path.join(ROOT, 'development/cycle7/staging-full/build.py'), 'step', file], { encoding: 'utf8' }).trim().split('\n').pop();
    const applied = JSON.parse(out);
    execFileSync('bash', [path.join(ROOT, 'development/cycle7/staging-full/rest.sh')], { env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
    await new Promise(r => setTimeout(r, 1500));
    const readback = sql(READBACK[name]) === 't';
    // Second run must be refused (each migration guards against re-application).
    let refused = false; try { execFileSync(PY, ['-X', 'utf8', path.join(ROOT, 'development/cycle7/staging-full/build.py'), 'step', file], { encoding: 'utf8', stdio: 'pipe' }); } catch (e) { refused = /ALREADY_APPLIED|TARGET_REQUIRED|PREIMAGE_REQUIRED|already|duplicate|exists/i.test(String(e.stderr ?? e)); }
    // Previous web release still works on the new schema.
    const list = await call('GET', `/workspaces/${WS}/candidates?limit=10`);
    const review = await call('GET', `/workspaces/${WS}/review?series_id=${before.series.id}`);
    const version = await call('GET', `/versions/${before.version.id}`);
    const pdf = await call('GET', `/versions/${before.version.id}/pdf/content`, undefined, { raw: true });
    steps.push({ file, ms: Date.now() - t0, history: applied.history, readback, second_run_refused: refused,
      old_web: { list: list.status, review: review.status, version: version.status, pdf: pdf.status } });
    check(`${name}_applied_and_read_back`, readback && applied.history === 50 + steps.length, applied);
    steps.at(-1).runtime_surface = sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='eps' or n.nspname='public' and (p.proname like 'eps\_%' escape '\' or p.prosecdef)) and has_function_privilege('eps_specs_runtime',p.oid,'EXECUTE')");
    check(`${name}_worker_login_surface_unchanged`, steps.at(-1).runtime_surface === '12', steps.at(-1).runtime_surface);
    check(`${name}_second_run_refused`, refused);
    // Between m16 and m21 the previous release's candidate/role/series/settings reads fail its exact-key parsers (cutover
    // window, worker paused, applied back to back). Saved versions, review and PDFs keep working throughout.
    const compatible = [list, review, version].every(r => r.status === 200) && pdf.status === 200;
    if (['m15_cycle7_shared_schema', 'm21_previous_client_compat'].includes(name)) check(`${name}_previous_web_compatible`, compatible, steps.at(-1).old_web);
    else { check(`${name}_previous_web_saved_work_readable`, review.status === 200 && version.status === 200 && pdf.status === 200, steps.at(-1).old_web); steps.at(-1).cutover_window = !compatible; }
  }
  note('steps', steps);
  // Previous worker still processes work on the fully migrated schema (layout measurement for its 1.3.0 series).
  const review = (await ok('GET', `/workspaces/${WS}/review?series_id=${before.series.id}`)).data;
  note('old_review_fit_after_migrations', review.fit);
  const fit = await call('POST', `/workspaces/${WS}/review/fit`, { series_id: before.series.id, expected_input_fingerprint: review.input_fingerprint });
  note('old_fit_request', fit.status);
  const notices = runWorker(OLD); note('old_worker_after_migrations', notices.filter(n => !['idle', 'recovery_completed'].includes(n.event)).slice(-6));
  check('previous_worker_runs_on_migrated_schema', !notices.some(n => n.event === 'worker_exit'), notices.at(-1));
  check('user_data_unchanged_by_migrations', fingerprint() === userData);
  check('template_default_still_1_3', sql('select template_version from eps.app_settings') === '1.3.0');
});
save('staging-journeys.json');
