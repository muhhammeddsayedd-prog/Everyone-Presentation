// Seeds the cycle-7 staging stack with synthetic, non-personal test data:
//   * Auth users created through GoTrue's admin API (real password sign-in afterwards):
//       producer-a / producer-b (full studio capabilities), outsider (signed in, no project or capability).
//   * Capability grants, one project + workspace (what the owner's provisioning does on canonical).
//   * Test-card images rendered by Chromium (no real people) and uploaded to the private buckets through the
//     Storage API with the service key (what the archive import tool does): a photo-only person with two archive
//     photos, and a video person with a processed tape and three extracted frames.
//   * Settings row as on live (template 1.3.0 default); audience presets are created later through the API.
// Writes ids to .local/cycle7/stg/seed.json. Never contacts anything but the local stack.
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../..');
const S = path.join(root, '.local/cycle7/stg');
const secrets = JSON.parse(readFileSync(path.join(S, 'secrets.json'), 'utf8'));
const keys = JSON.parse(readFileSync(path.join(S, 'keys.json'), 'utf8'));
const AUTH = 'http://127.0.0.1:55512', STORAGE = 'http://127.0.0.1:55514';
const psql = sql => execFileSync('docker', ['exec', '-i', 'eps-c7stg-db', 'psql', '-U', 'supabase_admin', '-h', 'localhost', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-q'], { input: sql }).toString();
const sha = b => createHash('sha256').update(b).digest('hex');

const ID = {
  project: 'c7570000-0000-4000-8000-00000000c001', workspace: 'c7570000-0000-4000-8000-00000000d001',
  photoPerson: 'c7570000-0000-4000-8000-00000000f001', framePerson: 'c7570000-0000-4000-8000-00000000f002',
  p1: 'c7570000-0000-4000-8000-00000000e001', p1t: 'c7570000-0000-4000-8000-00000000e002',
  p2: 'c7570000-0000-4000-8000-00000000e003', p2t: 'c7570000-0000-4000-8000-00000000e004',
  ph1: 'c7570000-0000-4000-8000-00000000b001', ph2: 'c7570000-0000-4000-8000-00000000b002',
  video: 'c7570000-0000-4000-8000-00000000a001', media: 'c7570000-0000-4000-8000-00000000a101',
  f1: 'c7570000-0000-4000-8000-00000000a201', f2: 'c7570000-0000-4000-8000-00000000a202', f3: 'c7570000-0000-4000-8000-00000000a203',
  // Added after the release through the new app (default pins), a broken photo (object missing from Storage) and nobody-with-media.
  photoPerson2: 'c7570000-0000-4000-8000-00000000f003', brokenPerson: 'c7570000-0000-4000-8000-00000000f004', nonePerson: 'c7570000-0000-4000-8000-00000000f005',
  p3: 'c7570000-0000-4000-8000-00000000e005', p3t: 'c7570000-0000-4000-8000-00000000e006', ph3: 'c7570000-0000-4000-8000-00000000b003',
  pb: 'c7570000-0000-4000-8000-00000000e007', pbt: 'c7570000-0000-4000-8000-00000000e008', phb: 'c7570000-0000-4000-8000-00000000b004',
};

async function users() {
  const out = {};
  for (const [label, email] of [['a', 'producer-a@staging.example.com'], ['b', 'producer-b@staging.example.com'], ['outsider', 'outsider@staging.example.com']]) {
    let res = await fetch(`${AUTH}/admin/users`, { method: 'POST', headers: { authorization: `Bearer ${keys.service}`, apikey: keys.service, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: secrets.user_password, email_confirm: true }) });
    let body = await res.json();
    if (res.status === 422 || res.status === 400) { // already exists
      const list = await (await fetch(`${AUTH}/admin/users?per_page=50`, { headers: { authorization: `Bearer ${keys.service}`, apikey: keys.service } })).json();
      body = list.users.find(u => u.email === email);
    } else if (!res.ok) throw new Error(`user ${email}: ${res.status} ${JSON.stringify(body)}`);
    out[label] = { id: body.id, email };
  }
  return out;
}

async function cards() {
  const browser = await chromium.launch(); const page = await browser.newPage();
  // Each card has a crosshair at the focal point used for the presentation crop (x=50%, y=30%) and corner labels,
  // so a crop or stretch is visible in the rendered PDF/PPTX.
  const card = async (w, h, bg, label, quality = 90) => {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<html><body style="margin:0;width:${w}px;height:${h}px;background:${bg};font:bold ${Math.round(w / 12)}px sans-serif;color:#fff;position:relative;overflow:hidden">
      <div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 ${Math.round(h / 10) - 2}px,rgba(255,255,255,.25) ${Math.round(h / 10) - 2}px ${Math.round(h / 10)}px)"></div>
      <div style="position:absolute;left:50%;top:30%;width:${Math.round(w / 5)}px;height:${Math.round(w / 5)}px;margin:-${Math.round(w / 10)}px 0 0 -${Math.round(w / 10)}px;border:6px solid #ffeb3b;border-radius:50%"></div>
      <div style="position:absolute;left:50%;top:0;bottom:0;border-left:3px solid #ffeb3b"></div><div style="position:absolute;top:30%;left:0;right:0;border-top:3px solid #ffeb3b"></div>
      <div style="position:absolute;left:4%;top:3%">${label}</div><div style="position:absolute;right:4%;bottom:3%;font-size:${Math.round(w / 20)}px">TEST CARD · NOT A PERSON</div></body></html>`);
    return page.screenshot({ type: 'jpeg', quality });
  };
  const result = {
    p1: await card(800, 1000, '#8e24aa', 'PHOTO 1'), p1t: await card(200, 250, '#8e24aa', 'P1', 80),
    p2: await card(800, 1000, '#c2185b', 'PHOTO 2 (cover)'), p2t: await card(200, 250, '#c2185b', 'P2', 80),
    p3: await card(800, 1000, '#283593', 'PHOTO 3 (added after release)'), p3t: await card(200, 250, '#283593', 'P3', 80),
    pb: await card(800, 1000, '#5d4037', 'BROKEN'), pbt: await card(200, 250, '#5d4037', 'PB', 80),
    f1: await card(1280, 720, '#00796b', 'FRAME 1'), f2: await card(1280, 720, '#00897b', 'FRAME 2'), f3: await card(1280, 720, '#009688', 'FRAME 3'),
  };
  await browser.close(); return result;
}

async function upload(bucket, key, bytes, type) {
  const res = await fetch(`${STORAGE}/object/${bucket}/${key}`, { method: 'POST', headers: { authorization: `Bearer ${keys.service}`, 'content-type': type, 'x-upsert': 'true' }, body: bytes });
  if (!res.ok) throw new Error(`upload ${bucket}/${key}: ${res.status} ${await res.text()}`);
}

const FRAME_JOB = 'c7570000-0000-4000-8000-0000000a0901', FRAME_ATTEMPT = 'c7570000-0000-4000-8000-0000000a0902';
const u = await users();
const img = await cards();
const tape = Buffer.from('cycle7 staging placeholder tape bytes (not a playable video)');
const objects = {
  // Live key shapes: archive photos archive/<person>/photos/<n>-lg|th.jpg; frames jobs/<job>/attempts/<attempt>/<asset>.jpg.
  p1: ['eps-candidate-photos', `archive/${ID.photoPerson}/photos/1-lg.jpg`], p1t: ['eps-candidate-photos', `archive/${ID.photoPerson}/photos/1-th.jpg`], p2: ['eps-candidate-photos', `archive/${ID.photoPerson}/photos/2-lg.jpg`], p2t: ['eps-candidate-photos', `archive/${ID.photoPerson}/photos/2-th.jpg`],
  p3: ['eps-candidate-photos', `archive/${ID.photoPerson2}/photos/1-lg.jpg`], p3t: ['eps-candidate-photos', `archive/${ID.photoPerson2}/photos/1-th.jpg`],
  pb: ['eps-candidate-photos', `archive/${ID.brokenPerson}/photos/1-lg.jpg`], pbt: ['eps-candidate-photos', `archive/${ID.brokenPerson}/photos/1-th.jpg`],
  f1: ['eps-candidate-outputs', `jobs/${FRAME_JOB}/attempts/${FRAME_ATTEMPT}/${ID.f1}.jpg`], f2: ['eps-candidate-outputs', `jobs/${FRAME_JOB}/attempts/${FRAME_ATTEMPT}/${ID.f2}.jpg`], f3: ['eps-candidate-outputs', `jobs/${FRAME_JOB}/attempts/${FRAME_ATTEMPT}/${ID.f3}.jpg`],
};
// The broken person's full-size photo is deliberately NOT uploaded (rows exist, object missing: an unreadable image).
for (const [k, [bucket, key]] of Object.entries(objects)) if (k !== 'pb') await upload(bucket, key, img[k], 'image/jpeg');
await upload('eps-candidate-assets', 'assets/c7stg/intro.mp4', tape, 'video/mp4');

const caps = ['projects.read', 'projects.write', 'workspaces.read', 'workspaces.write', 'cast.read', 'cast.upload', 'cast.write', 'cast.review', 'presentations.generate', 'review_links.manage', 'settings.manage', 'operations.read', 'operations.retry'];
const asset = (id, k, purpose, w, h, extra = '') => `('${id}','${ID.workspace}','${purpose}','${path.basename(objects[k][1])}','image/jpeg','${objects[k][0]}','${objects[k][1]}',${img[k].length},'${sha(img[k])}',${w},${h},'ready'${extra})`;
psql(`
insert into public.app_capability_grants(principal_id,capability) select p,c from unnest(array['${u.a.id}','${u.b.id}']::uuid[]) p, unnest(array[${caps.map(c => `'${c}'`).join(',')}]) c on conflict do nothing;
insert into public.projects(id,name) values('${ID.project}','Cycle 7 staging project') on conflict do nothing;
insert into public.project_memberships(project_id,principal_id,can_write) values('${ID.project}','${u.a.id}',true),('${ID.project}','${u.b.id}',true) on conflict do nothing;
insert into eps.workspaces(id,project_id) values('${ID.workspace}','${ID.project}') on conflict do nothing;
insert into eps.app_settings(singleton,template_key,template_version,default_timezone,default_review_expiry_days) values(true,'everyone-casting','1.3.0','Africa/Cairo',30) on conflict do nothing;
set session_replication_role=replica;
insert into eps.candidates(id,casting_id,facts,source_kind,created_by,created_at,updated_at) values
 ('${ID.photoPerson}','EPS-STG-PHOTO','{"name":"Photo Only Test Card","casting_id":"EPS-STG-PHOTO","age_or_range":"25-30","stated_gender":null,"height_measurements":null,"languages":[],"accents":[],"skills_experience":null,"city":"Cairo","previous_projects_roles":null,"classification":null}','archive','${u.a.id}','2026-11-17 08:00:00+00','2026-11-17 08:00:00+00'),
 ('${ID.framePerson}','EPS-STG-FRAME','{"name":"Video Frame Test Card","casting_id":"EPS-STG-FRAME","age_or_range":"30-35","stated_gender":null,"height_measurements":null,"languages":["English"],"accents":[],"skills_experience":null,"city":"Riyadh","previous_projects_roles":null,"classification":null}','manual','${u.a.id}','2026-11-17 08:05:00+00','2026-11-17 08:05:00+00')
 on conflict do nothing;
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,status) values
 ${asset(ID.p1, 'p1', 'candidate_photo', 800, 1000)},${asset(ID.p1t, 'p1t', 'candidate_photo', 200, 250)},${asset(ID.p2, 'p2', 'candidate_photo', 800, 1000)},${asset(ID.p2t, 'p2t', 'candidate_photo', 200, 250)} on conflict do nothing;
insert into eps.candidate_photos(id,candidate_id,position,asset_id,thumb_asset_id,width,height,source_key) values
 ('${ID.ph1}','${ID.photoPerson}',1,'${ID.p1}','${ID.p1t}',800,1000,'c7stg/1'),('${ID.ph2}','${ID.photoPerson}',2,'${ID.p2}','${ID.p2t}',800,1000,'c7stg/2') on conflict do nothing;
insert into eps.candidate_attributes(candidate_id,cover_photo_id,name_ar,talent_type) values('${ID.photoPerson}','${ID.ph2}','بطاقة اختبار بالصور فقط','talent') on conflict do nothing;
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,duration_ms,status) values
 ('${ID.video}','${ID.workspace}','candidate_video','intro.mp4','video/mp4','eps-candidate-assets','assets/c7stg/intro.mp4',${tape.length},'${sha(tape)}',1280,720,10000,'ready') on conflict do nothing;
insert into eps.candidate_media(id,candidate_id,source_asset_id,selected_frame_asset_ids,created_at) values('${ID.media}','${ID.framePerson}','${ID.video}','{${ID.f2},${ID.f1}}','2026-11-17 08:05:00+00') on conflict do nothing;
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,status,source_asset_id,producing_job_id,producing_attempt_id,output_stage,output_key,source_timestamp_ms) values
 ${asset(ID.f1, 'f1', 'candidate_frame', 1280, 720, `,'${ID.video}','${FRAME_JOB}','${FRAME_ATTEMPT}','prepare_candidate','frame_1',1000`)},
 ${asset(ID.f2, 'f2', 'candidate_frame', 1280, 720, `,'${ID.video}','${FRAME_JOB}','${FRAME_ATTEMPT}','prepare_candidate','frame_2',4000`)},
 ${asset(ID.f3, 'f3', 'candidate_frame', 1280, 720, `,'${ID.video}','${FRAME_JOB}','${FRAME_ATTEMPT}','prepare_candidate','frame_3',7000`)} on conflict do nothing;
insert into eps.candidate_media_frames(candidate_media_id,asset_id) values('${ID.media}','${ID.f1}'),('${ID.media}','${ID.f2}'),('${ID.media}','${ID.f3}') on conflict do nothing;
insert into eps.candidates(id,casting_id,facts,source_kind,created_by,created_at,updated_at) values
 ('${ID.photoPerson2}','EPS-STG-PHOTO2','{"name":"Second Photo Test Card","casting_id":"EPS-STG-PHOTO2","age_or_range":null,"stated_gender":null,"height_measurements":null,"languages":[],"accents":[],"skills_experience":null,"city":null,"previous_projects_roles":null,"classification":null}','archive','${u.a.id}','2026-11-17 08:10:00+00','2026-11-17 08:10:00+00'),
 ('${ID.brokenPerson}','EPS-STG-BROKEN','{"name":"Unreadable Photo Test Card","casting_id":"EPS-STG-BROKEN","age_or_range":null,"stated_gender":null,"height_measurements":null,"languages":[],"accents":[],"skills_experience":null,"city":null,"previous_projects_roles":null,"classification":null}','archive','${u.a.id}','2026-11-17 08:11:00+00','2026-11-17 08:11:00+00'),
 ('${ID.nonePerson}','EPS-STG-NONE','{"name":"No Media Test Card","casting_id":"EPS-STG-NONE","age_or_range":null,"stated_gender":null,"height_measurements":null,"languages":[],"accents":[],"skills_experience":null,"city":null,"previous_projects_roles":null,"classification":null}','manual','${u.a.id}','2026-11-17 08:12:00+00','2026-11-17 08:12:00+00')
 on conflict do nothing;
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,status) values
 ${asset(ID.p3, 'p3', 'candidate_photo', 800, 1000)},${asset(ID.p3t, 'p3t', 'candidate_photo', 200, 250)},${asset(ID.pb, 'pb', 'candidate_photo', 800, 1000)},${asset(ID.pbt, 'pbt', 'candidate_photo', 200, 250)} on conflict do nothing;
insert into eps.candidate_photos(id,candidate_id,position,asset_id,thumb_asset_id,width,height,source_key) values
 ('${ID.ph3}','${ID.photoPerson2}',1,'${ID.p3}','${ID.p3t}',800,1000,'c7stg/3'),('${ID.phb}','${ID.brokenPerson}',1,'${ID.pb}','${ID.pbt}',800,1000,'c7stg/b') on conflict do nothing;
insert into eps.candidate_attributes(candidate_id,cover_photo_id,name_ar,talent_type) values('${ID.photoPerson2}','${ID.ph3}','بطاقة اختبار ثانية','talent'),('${ID.brokenPerson}','${ID.phb}',null,'talent') on conflict do nothing;
set session_replication_role=origin;
`);
mkdirSync(S, { recursive: true });
writeFileSync(path.join(S, 'seed.json'), JSON.stringify({ users: u, ids: ID, publishable_key: 'sb_publishable_c7staginglocal01', gateway: 'http://127.0.0.1:55511',
  image_sha256: Object.fromEntries(Object.entries(img).map(([k, v]) => [k, sha(v)])) }, null, 1));
console.log(JSON.stringify({ users: Object.keys(u), objects: Object.keys(objects).length + 1 }));
