/** Actual offline synthetic PDF/PNG proof. No service/provider/configuration. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { nativePresentation } from '../tests/worker/presentation-native-fixture.ts';
import { presentationCanonicalHash } from '../packages/domain/src/presentation.ts';
import { renderPresentationPdf, renderPresentationExportPdf, validatePresentationPdf, validatePresentationExportPdf } from '../apps/worker/src/presentation-pdf.ts';

const sha=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
const stamp=new Date().toISOString().replaceAll(':','-');const relative=`.local/m06-native/${stamp}`;const folder=path.resolve(relative);
assert.ok(folder.startsWith(path.resolve('.local/m06-native')+path.sep));await mkdir(folder,{recursive:true});
const sources=['tools/verify-m06-export-native.mts','tests/worker/presentation-native-fixture.ts','apps/worker/src/presentation-pdf.ts','apps/worker/src/presentation-pdf-inspect-process.mjs','apps/worker/src/review-fit.ts','apps/worker/src/native-browser.ts','packages/domain/src/presentation.ts','packages/templates/src/registered.ts','packages/templates/versions/1.1.0/render.ts','packages/templates/versions/1.1.0/registry.json'];
const before=Object.fromEntries(await Promise.all(sources.map(async p=>[p,sha(await readFile(p))])));
const {snapshot,images}=nativePresentation([0,1,2,3],true,'role');const frozen=await presentationCanonicalHash(snapshot);
snapshot.slides[2].fields!.skills_experience='ممثلة مسرحية / Stage experience; Arabic and English dialogue.';
const expectedFrozen=await presentationCanonicalHash(snapshot);
const access={version_id:snapshot.version_id,grant_token:'s'.repeat(43)};
const canonical=await renderPresentationPdf(snapshot,images);const variant=await renderPresentationExportPdf(snapshot,images,access);
const canonicalValidation=await validatePresentationPdf(snapshot,images,canonical.bytes);const variantValidation=await validatePresentationExportPdf(snapshot,images,variant.bytes,access);
assert.equal(await presentationCanonicalHash(snapshot),expectedFrozen);assert.notEqual(frozen,expectedFrozen);
class NoExternalData{async fetch():Promise<never>{throw Error('EXTERNAL_RESOURCE_DENIED');}}
async function raster(name:string,bytes:Uint8Array){
 await writeFile(path.join(folder,`${name}.pdf`),bytes);const task=getDocument({data:new Uint8Array(bytes),verbosity:0,useWorkerFetch:false,useWasm:false,useSystemFonts:false,BinaryDataFactory:NoExternalData});const pdf=await task.promise;const pages=[];
 try{for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);const viewport=page.getViewport({scale:1});const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await page.render({canvas:canvas as unknown as HTMLCanvasElement,canvasContext:canvas.getContext('2d')as unknown as CanvasRenderingContext2D,viewport}).promise;const png=canvas.toBuffer('image/png');const file=`${name}-${n}.png`;await writeFile(path.join(folder,file),png);
 const text=await page.getTextContent();const annotations=await page.getAnnotations();const links=annotations.filter(a=>a.subtype==='Link').map(a=>String(a.url??''));
 if(name==='export')for(const url of links)assert.ok(url.startsWith(`${snapshot.render_configuration.application_origin}/m/${access.grant_token}/versions/${snapshot.version_id}/media/`));
 else for(const url of links)assert.ok(url.startsWith(`${snapshot.render_configuration.application_origin}/presentations/versions/${snapshot.version_id}/media/`));
 const measuredText=text.items.map(item=>'fontName'in item?{...item,fontName:text.styles[item.fontName]}:item);
 pages.push({page:n,file,png_sha256:sha(png),width:canvas.width,height:canvas.height,text_sha256:sha(Buffer.from(JSON.stringify(measuredText))),link_count:links.length});page.cleanup();}}
 finally{await task.destroy();}return pages;
}
const internal=await raster('canonical',canonical.bytes);const external=await raster('export',variant.bytes);assert.equal(internal.length,external.length);
for(let n=0;n<internal.length;n++){assert.equal(external[n].png_sha256,internal[n].png_sha256);assert.equal(external[n].text_sha256,internal[n].text_sha256);assert.equal(external[n].link_count,internal[n].link_count);}
const after=Object.fromEntries(await Promise.all(sources.map(async p=>[p,sha(await readFile(p))])));assert.deepEqual(after,before);
const report={schema_version:'1.0',observed_at:new Date().toISOString(),result:'passed',scope:'Actual offline synthetic native canonical and access-only guest PDFs, independently inspected and raster compared',provider_or_cloud_called:false,private_configuration_read:false,real_cast_or_private_media_used:false,source_sha256:before,frozen_snapshot_sha256:expectedFrozen,snapshot_unchanged:true,template_version:snapshot.template.version,canonical:{pdf_sha256:sha(canonical.bytes),bytes:canonical.bytes.length,render:canonical.proof,validation:canonicalValidation,pages:internal},export:{pdf_sha256:sha(variant.bytes),bytes:variant.bytes.length,render:variant.proof,validation:variantValidation,pages:external},all_page_pixels_identical:true,all_text_geometry_identical:true,only_content_difference_is_pdf_link_targets:true,pdfjs_font_identity_normalization:'Per-document generated fontName IDs replaced by their actual style/metrics before text geometry comparison; strings, transforms, sizes, direction, font styles and raster pixels remain exact.',media_links_fixed_version:true,raw_grant_recorded:false,grant_scope:'Synthetic renderer-only token, never minted or valid against a database',private_artifact_directory:relative,visual_inspection:'pending_independent_page_review',pdf_skill_marker:{previously_invoked_once:true,tool_chunk_id:'b1029a',repeated:false},limits:['No live service, Storage, guest session or browser playback acceptance.','Synthetic geometry and bilingual text do not establish candidate factual accuracy.','Render timestamps and PDF object identities may differ; binary PDF identity is not claimed.']};
const evidence=`tracking/evidence/m06/native/${stamp}-access-only.json`;await mkdir(path.dirname(evidence),{recursive:true});await writeFile(evidence,JSON.stringify(report,null,2)+'\n');await writeFile(path.join(folder,'receipt.json'),JSON.stringify(report,null,2)+'\n');
process.stdout.write(JSON.stringify({result:report.result,evidence,artifact_directory:relative,pages:external.length,all_page_pixels_identical:true,visual_inspection:report.visual_inspection})+'\n');
