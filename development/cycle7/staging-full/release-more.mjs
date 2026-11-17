// Journeys 5-8 for release.mjs (imported by it): measurement states, generation and outputs, guest access, default switch.
import { writeFileSync } from 'node:fs';
import path from 'node:path';

export async function more(ctx) {
  const { ok, call, check, note, journey, runWorker, WS, seed, state, persist, before, ART, sha, members, run, NEW } = ctx;
  const review14 = async () => (await ok('GET', `/workspaces/${WS}/review?series_id=${state.series14}`)).data;
  const work = (label, opts) => { const notices = runWorker(NEW, opts); note(label, notices.filter(n => !['idle', 'recovery_completed'].includes(n.event)).slice(-12)); return notices; };
  const ignorable = new Set(['MISSING_FIELD', 'UNREVIEWED_PROFILE', 'FEWER_FRAMES', 'NO_INTRODUCTION', 'NO_MAIN']);
  const fitNow = async () => {
    const review = await review14();
    const request = await call('POST', `/workspaces/${WS}/review/fit`, { series_id: state.series14, expected_input_fingerprint: review.input_fingerprint });
    work('fit_worker'); return { request: request.status, review: await review14() };
  };

  if (run('5')) await journey('5-layout-measurement-states', async () => {
    // Measurement works from stored image dimensions and never reads file bytes: with the unreadable photo pinned it
    // still measures. Unreadable bytes are caught at render, which fails visibly (journey 9).
    const pinned = (await members()).find(m => m.candidate_id === seed.ids.brokenPerson);
    if (pinned.media_selection_state !== 'pinned') await ok('PATCH', `/workspace-candidates/${pinned.id}`, { row_version: pinned.row_version, media_selection_state: 'pinned', portrait_source: 'photo', portrait_asset_id: seed.ids.pb });
    let r = await fitNow();
    note('fit_with_broken', r.review.fit);
    note('issues_with_broken', r.review.issues.filter(i => !ignorable.has(i.code)).map(i => [i.code, i.blocking ?? null, String(i.message ?? '').slice(0, 100)]));
    check('measurement_uses_stored_dimensions_render_catches_bytes', r.review.fit?.status === 'measured', r.review.fit);
    // Owner decision for both problem rows: an intentional empty picture (placeholder on the slide).
    for (const candidate of [seed.ids.nonePerson, seed.ids.brokenPerson]) {
      const row = (await members()).find(m => m.candidate_id === candidate);
      if (row.media_selection_state !== 'intentionally_empty') await ok('PATCH', `/workspace-candidates/${row.id}`, { row_version: row.row_version, media_selection_state: 'intentionally_empty' });
    }
    const after = await review14();
    note('issues_after_choice', after.issues.filter(i => !ignorable.has(i.code)).map(i => i.code));
    check('intentional_empty_is_not_an_error', !after.issues.some(i => i.code === 'NO_PRESENTATION_PICTURE'), after.issues.map(i => i.code));
    r = await fitNow();
    note('fit_after_choice', r.review.fit);
    check('private_photos_measured_by_worker', r.review.fit?.status === 'measured' && r.review.fit.overflows.length === 0, r.review.fit);
    check('can_generate', r.review.can_generate === true, r.review.issues.filter(i => i.blocking).map(i => i.code));
  });

  if (run('6')) await journey('6-generate-1-4-outputs-saved', async () => {
    const review = await review14(); const workspace = (await ok('GET', `/workspaces/${WS}`)).data;
    let versions = (await ok('GET', `/presentation-series/${state.series14}/versions`)).data;
    if (!versions.some(v => v.status === 'ready')) {
      const g = await call('POST', `/presentation-series/${state.series14}/versions`, { expected_input_fingerprint: review.input_fingerprint, expected_workspace_row_version: workspace.row_version, expected_draft_revision: review.draft_revision });
      note('generate', g.status); check('generation_accepted', g.status === 202, g.body);
      work('render_worker');
      versions = (await ok('GET', `/presentation-series/${state.series14}/versions`)).data;
    }
    const version = versions.find(v => v.status === 'ready'); state.version14 = version?.id; persist();
    check('version_1_4_ready', Boolean(version), versions.map(v => [v.version_number, v.status, v.error_code ?? null]));
    const full = (await ok('GET', `/versions/${version.id}`)).data;
    writeFileSync(path.join(ART, 'version-1-4.json'), JSON.stringify(full, null, 1));
    const portraits = (full.render_context?.presentation?.slides ?? []).map(s => s.portrait);
    note('version_portraits', portraits.map(p => p && [p.source, p.asset_id.slice(-4), p.focal]));
    check('saved_version_keeps_photo_and_frame_portraits', portraits.some(p => p?.asset_id === seed.ids.p1 && p.focal?.join() === '500,300') && portraits.some(p => p?.asset_id === seed.ids.f2 && p.source === 'frame'), portraits);
    const pdf = await call('GET', `/versions/${version.id}/pdf/content`, undefined, { raw: true }); const pdfBytes = Buffer.from(await pdf.arrayBuffer());
    check('pdf_download', pdf.status === 200 && pdfBytes.subarray(0, 5).toString() === '%PDF-', pdf.status);
    writeFileSync(path.join(ART, 'staging-1-4.pdf'), pdfBytes); note('pdf', { bytes: pdfBytes.length, sha256: sha(pdfBytes) });
    const pptx = await call('GET', `/versions/${version.id}/pptx/content`, undefined, { raw: true }); const pptxBytes = Buffer.from(await pptx.arrayBuffer());
    check('pptx_download', pptx.status === 200 && pptxBytes.subarray(0, 2).toString() === 'PK', [pptx.status, pptxBytes.subarray(0, 120).toString()]);
    writeFileSync(path.join(ART, 'staging-1-4.pptx'), pptxBytes); note('pptx', { bytes: pptxBytes.length, sha256: sha(pptxBytes) });
    // Saved presentation media: the portrait bytes served for this version are the private photo/frame bytes.
    for (const [label, asset, key] of [['photo', seed.ids.p1, 'p1'], ['frame', seed.ids.f2, 'f2']]) {
      const media = await call('GET', `/versions/${version.id}/media/${asset}/content`, undefined, { raw: true }); const bytes = Buffer.from(await media.arrayBuffer());
      check(`saved_version_serves_${label}_portrait`, media.status === 200 && sha(bytes) === seed.image_sha256[key], [media.status, sha(bytes)]);
    }
    const outsider = await call('GET', `/versions/${version.id}`, undefined, { user: 'outsider' });
    check('outsider_denied_version', [403, 404].includes(outsider.status), outsider.status);
    const anon = await call('GET', `/versions/${version.id}/pdf/content`, undefined, { anonymous: true, raw: true });
    check('anonymous_denied_pdf', anon.status === 401, anon.status);
  });

  if (run('7')) await journey('7-guest-access-and-privacy', async () => {
    const link = (await ok('POST', '/review-links', { series_id: state.series14, label: 'Staging 1.4 guest link' })).data;
    state.link14 = { id: link.link.id }; persist();
    const token = link.token ?? new URL(link.url).pathname.split('/').pop();
    const guest = (p, method = 'GET', headers = {}, body) => call(method, p, body, { anonymous: true, headers });
    const opened = await guest('/review/open', 'POST', { 'x-review-token': token });
    check('guest_link_opens', opened.status === 200 && Boolean(opened.body?.data?.access_token), [opened.status, opened.body?.error]);
    const session = { 'x-review-session': opened.body?.data?.access_token ?? '' };
    const current = await guest('/review/presentation', 'GET', session);
    check('guest_sees_current_1_4_version', current.status === 200 && current.body?.data?.id === state.version14, [current.status, current.body?.data?.id, current.body?.error]);
    note('guest_version_keys', current.body?.data ? Object.keys(current.body.data) : null);
    // Guest image content (portraits/frames) is read with the guest session; the POST media grant is video playback only.
    for (const [label, asset, key] of [['photo', seed.ids.p1, 'p1'], ['frame', seed.ids.f2, 'f2']]) {
      const m = await call('GET', `/review/versions/${state.version14}/media/${asset}/content`, undefined, { anonymous: true, raw: true, headers: session });
      const bytes = Buffer.from(await m.arrayBuffer());
      check(`guest_reads_private_${label}_portrait`, m.status === 200 && sha(bytes) === seed.image_sha256[key], [m.status, bytes.subarray(0, 200).toString()]);
    }
    const notInDeck = await call('GET', `/review/versions/${state.version14}/media/${seed.ids.p2}/content`, undefined, { anonymous: true, raw: true, headers: session });
    const noSession = await call('GET', `/review/versions/${state.version14}/media/${seed.ids.p1}/content`, undefined, { anonymous: true, raw: true });
    check('guest_media_requires_session', noSession.status >= 400 && noSession.status < 500, noSession.status);
    check('guest_cannot_fetch_assets_outside_version', notInDeck.status >= 400, notInDeck.status);
    const bad = await guest('/review/open', 'POST', { 'x-review-token': 'A'.repeat(43) });
    check('invalid_guest_token_denied', bad.status >= 400 && bad.status < 500, bad.status);
    const old = before.link?.token ? await guest('/review/open', 'POST', { 'x-review-token': before.link.token }) : null;
    check('pre_release_guest_link_still_opens', old?.status === 200, old?.status);
    // Internal series cannot be shared; internal comments stay private.
    const internalSeries = (await ok('POST', '/presentation-series', { workspace_id: WS, output_type: 'shortlist', audience_preset_id: state.internal })).data;
    const refused = await call('POST', '/review-links', { series_id: internalSeries.id, label: 'should fail' });
    check('internal_series_not_shareable', refused.status === 422 && refused.body?.error?.code === 'EXTERNAL_SERIES_REQUIRED', refused.body);
    const slides = (await ok('GET', `/versions/${state.version14}`)).data.slides ?? []; note('slide_kinds', slides.map(x => x.kind));
    const slide = slides.find(x => x.kind !== 'cover' && x.kind !== 'closing' && x.kind !== 'divider') ?? slides[1];
    await ok('POST', `/versions/${state.version14}/comments`, { version_slide_id: slide.id, visibility: 'internal', body: 'Internal: staging privacy check' });
    await ok('POST', `/versions/${state.version14}/comments`, { version_slide_id: slide.id, visibility: 'external', body: 'External: visible to the guest' });
    const guestFeedback = await guest(`/review/versions/${state.version14}/feedback`, 'GET', session);
    const text = JSON.stringify(guestFeedback.body);
    check('guest_sees_external_comment', text.includes('External: visible to the guest'), guestFeedback.status);
    check('guest_never_sees_internal_comment', !text.includes('Internal: staging privacy check'));
    const outsiderFeedback = await call('GET', `/versions/${state.version14}/feedback`, undefined, { user: 'outsider' });
    check('outsider_denied_feedback', [403, 404].includes(outsiderFeedback.status), outsiderFeedback.status);
  });

  if (run('8')) await journey('8-template-default-switch', async () => {
    let settings = (await ok('GET', '/settings')).data;
    if (settings.template_version !== '1.4.0') settings = (await ok('PATCH', '/settings', { row_version: settings.row_version, template_version: '1.4.0' })).data;
    const created = (await ok('POST', '/presentation-series', { workspace_id: WS, output_type: 'selection' })).data;
    check('new_series_after_switch_on_1_4_client', created.template_version === '1.4.0' && created.audience_preset_id === state.client, created);
    const old = (await ok('GET', `/presentation-series/${before.series.id}`)).data;
    check('earlier_series_keep_1_3', old.template_version === '1.3.0');
    const oldVersion = (await ok('GET', `/versions/${before.version.id}`)).data;
    check('pre_release_version_unchanged', oldVersion.status === 'ready' && oldVersion.id === before.version.id);
    // The new worker still measures and generates the existing 1.3.0 series.
    const review = (await ok('GET', `/workspaces/${WS}/review?series_id=${before.series.id}`)).data;
    await call('POST', `/workspaces/${WS}/review/fit`, { series_id: before.series.id, expected_input_fingerprint: review.input_fingerprint });
    work('fit13_worker');
    const r2 = (await ok('GET', `/workspaces/${WS}/review?series_id=${before.series.id}`)).data;
    note('fit13', { fit: r2.fit, input_fingerprint: r2.input_fingerprint, measured_for: review.input_fingerprint, issues: r2.issues.filter(i => i.blocking).map(i => i.code) });
    check('new_worker_measures_1_3', r2.fit?.status === 'measured', r2.fit);
    const workspace = (await ok('GET', `/workspaces/${WS}`)).data;
    const g = await call('POST', `/presentation-series/${before.series.id}/versions`, { expected_input_fingerprint: r2.input_fingerprint, expected_workspace_row_version: workspace.row_version, expected_draft_revision: r2.draft_revision });
    note('generate13', [g.status, g.body?.error?.code ?? null]);
    work('render13_worker');
    const versions = (await ok('GET', `/presentation-series/${before.series.id}/versions`)).data;
    check('new_worker_generates_1_3', versions.filter(v => v.status === 'ready').length >= 2, versions.map(v => [v.version_number, v.status]));
    state.version13b = versions.find(v => v.version_number === Math.max(...versions.map(x => x.version_number)))?.id; persist();
  });
}

export async function failures(ctx) {
  const { ok, call, check, note, journey, runWorker, WS, seed, state, persist, members, run, NEW, sql } = ctx;
  if (run('9')) await journey('9-unreadable-picture-fails-visibly', async () => {
    const row = (await members()).find(m => m.candidate_id === seed.ids.brokenPerson);
    // Pin the unreadable archive photo (rows exist, object missing in private Storage).
    await ok('PATCH', `/workspace-candidates/${row.id}`, { row_version: row.row_version, media_selection_state: 'pinned', portrait_source: 'photo', portrait_asset_id: seed.ids.pb });
    let review = (await ok('GET', `/workspaces/${WS}/review?series_id=${state.series14}`)).data;
    note('issues_pinned_unreadable', review.issues.filter(i => i.severity === 'blocking').map(i => i.code));
    await call('POST', `/workspaces/${WS}/review/fit`, { series_id: state.series14, expected_input_fingerprint: review.input_fingerprint });
    runWorker(NEW);
    review = (await ok('GET', `/workspaces/${WS}/review?series_id=${state.series14}`)).data;
    note('fit', review.fit);
    const workspace = (await ok('GET', `/workspaces/${WS}`)).data;
    const g = await call('POST', `/presentation-series/${state.series14}/versions`, { expected_input_fingerprint: review.input_fingerprint, expected_workspace_row_version: workspace.row_version, expected_draft_revision: review.draft_revision });
    note('generate', [g.status, g.body?.error?.code ?? null]);
    if (g.status === 202) {
      const job = g.body.data.job_id;
      for (let i = 0; i < 4; i++) { sql(`update eps.jobs set available_at=now() where id='${job}' and status='queued'`); runWorker(NEW); }
      const j = (await ok('GET', `/jobs/${job}`)).data; note('job', { status: j.status, stage: j.stage, error: j.error?.code ?? j.error_code ?? null });
      check('render_fails_never_placeholder', j.status === 'failed', j.status);
      const versions = (await ok('GET', `/presentation-series/${state.series14}/versions`)).data;
      note('versions', versions.map(v => [v.version_number, v.status, v.failure_code ?? v.error_code ?? null]));
      check('previous_ready_version_kept', versions.some(v => v.id === state.version14 && v.status === 'ready'));
    } else check('generation_refused_before_render', g.status === 409, g.body);
    // Restore the producer's intentional choice for later journeys.
    const fresh = (await members()).find(m => m.candidate_id === seed.ids.brokenPerson);
    await ok('PATCH', `/workspace-candidates/${fresh.id}`, { row_version: fresh.row_version, media_selection_state: 'intentionally_empty' });
  });
}
