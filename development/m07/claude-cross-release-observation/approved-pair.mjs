// Closed historical compatibility pair. No caller-supplied release registration.
export const CLIENT='f2acafd5-d4b6-4176-b86c-067c57e45ecc';
export const PROJECT='prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0';
export const CENTRAL_PROJECT='6da14b82-8458-451f-aa21-28cb6c85bdc5';
export const TEAM='team_gboXPxTevpCOZuaA8eY9PmR1';
export const SEALS=Object.freeze({
 'development/m07/completion-oauth/collect.mjs':'ae466c59167952b9cc0b5cda915b93d8b664d9009d22b7b8d4df2ee8453cc2c1',
 'development/m07/oauth-consent-fix/read-pilot-trace.mjs':'0b998169cfcf4f4811398634ec4901a2074192830a5d1c5a84caeec36b81e179',
 'apps/web/lib/mcp-auth.ts':'98a6bc17ffdd4e1360431cb998af14313c136dbc3c6714a1460a2d3897a3e99e',
 'apps/web/app/mcp/route.ts':'85af587a7c63cb46dc975c2b15d33be8b20c8797c95841097994522cfcead28b'
});
export const V2=Object.freeze({path:'development/m07/completion-oauth/collect-v2.mjs',sha256:'33ca64eb8281630e48cf754ea64a16bd5cd598cf46ea83b1fc1306ed9ddbf6ce',cli:'5724f20cc65bb0e13c7a0668af107770ddb101bb72dd3fd6160aca672ea2a493',help:'f19e025f07602444e832f4096c829928959f5a315ab09048c66f8505277d189b',query:'vercel65.8_runtime_unquoted_allowlisted_event_AND_uuid_v1'});
export const BEFORE_OBSERVATION=Object.freeze({path:'tracking/evidence/m07/completion-oauth/2026-11-02T08-41-14.135Z-98295c0c-request-observation.json',sha256:'ee4d4a1cc8fccdecee5f129e92037e283eaf7806cb2f39b0f031b77ab4e26e35'});
export const BEFORE_EXECUTION=Object.freeze({path:'tracking/evidence/m07/completion-oauth/2026-11-02T08-41-14.138Z-869e1307-collector-v2-execution.json',sha256:'eaf1bf0722e29d5a314dff435c144d3c8971f1ff23efc60b32e62574b2b3b28f'});
export const APPROVED=Object.freeze({
 before:Object.freeze({deployment:'dpl_J3hmctcHndRp8zDVAPYfcnjEgpzG',commit:'c88f58c00820169f7396d72def77a74f1443594e',manifest:'f947fb53479d991b382bd50bf39e32a4e56dd17598470b209f2a185ed9f58d0a',entries:308,
  readback:{path:'tracking/evidence/m07/production-web-release/2026-11-02T02-34-07-437169Z-readback.json',sha256:'410caceb600e01589147fdb1e13cd3cbb5b8dc8d8ce8459f27c7ee178c0116cb'},
  source:{path:'tracking/evidence/m07/production-web-release/source-c5fee9c1-db68-41c5-9386-8c56bab0b418.json',sha256:'ec36e3940a178eb816b898991ce816d8a78e3dfecfa7b155ec5ffe9e1d1085ce'},
  archive:{path:'.local/production-web-release/source-c5fee9c1-db68-41c5-9386-8c56bab0b418.tar',sha256:'47ad9d1b2cfb4c096d0ced3041307c9f0ca1fb93e47142899e2d396bd0452dad'}}),
 after:Object.freeze({deployment:'dpl_5sevM277cLpQZPJV1XkaJxhMLqpe',commit:'fdd0aba30fbff3ecebd4f29915bb8b74b143fea2',manifest:'f68d43576db9c530a54c85af960658d7115547d5c2c406d47ead8ed0a7d11bb1',entries:309,
  readback:{path:'tracking/evidence/m07/mcp-diagnostic-web-release/2026-11-02T10-21-25-065548Z-958dbf0e-7cf7-4288-9a97-c7f52e001523-readback.json',sha256:'2ba99d53a414ea1fc4a77c28ecc262f6ce0eb230aadf4c0d583381864e946bbd'},
  source:{path:'tracking/evidence/m07/mcp-diagnostic-web-release/source-958dbf0e-7cf7-4288-9a97-c7f52e001523.json',sha256:'ad1549df81fc0534388e46ec8638a5015163e29d366571a0d7d41ff7c3061110'},
  archive:{path:'.local/mcp-diagnostic-web-release/958dbf0e-7cf7-4288-9a97-c7f52e001523/source.tar',sha256:'4553fec6b73bf6fb21621c6c0e8a99a0b58f2f4bd2b508c38d7748e697063c77'}})
});
export const DIAGNOSTICS=Object.freeze({
 'apps/web/lib/mcp-error-text.ts':[null,'b32bba6afade505fe074cf7f519c8c6274cb8d1bf196f53d8bbc5041acf085e2'],
 'apps/web/lib/mcp-output-validation.ts':['30026e1c38953c96cefbdd5c82cc9e3a567c4bf755d8bb7d748481d4be6cd583','2010f05eecc7a0240229f7ac6a2700269910f299d6f5a276056b9735b970ca80'],
 'apps/web/lib/mcp.ts':['822cc0b504a56b77041ef7052b9b6bbd7b1db86847b5a3ba8be44f7f5edb7d09','891272615f17652c7e093775c2025e55a2d34d94c0b7c106422b4c7b849a9046'],
 'packages/central/src/presentation.ts':['c733bf1956e9fbaf42a31e93449350511e3b3663b1845c9ebdef2cbc19447552','3f4ac0548b1e9d6b28dbf91993624036a3a01e280942f4c6af70e9a375abab4a']
});
function freeze(value){for(const child of Object.values(value))if(child&&typeof child==='object')freeze(child);return Object.freeze(value);}
freeze(APPROVED);freeze(DIAGNOSTICS);
