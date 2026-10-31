"""Checksum-frozen worker deployment continuation for actual OCI image proofs."""
from pathlib import Path
import importlib.util, sys

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
pipeline=module('english34_oci_worker_pipeline',HERE/'pipeline.py')
FROZEN=ROOT/'development/m03/english-worker-release34/worker.py'
FROZEN_SHA='af9740293f37d1884fa25f741c8a517851ea66737abb31a741b9b5dd10aa186c'
pipeline.need(pipeline.sha(FROZEN.read_bytes())==FROZEN_SHA)
worker=module('english34_frozen_worker_deployment',FROZEN)
original_sources=worker.source_pins
worker.PRIVATE=ROOT/'.local/m03-english-worker-oci34'
worker.PLAN=worker.PRIVATE/'plan.json';worker.PREPARE=worker.PRIVATE/'prepare.claim.json';worker.CLAIM=worker.PRIVATE/'deploy.claim.json';worker.RETURNED=worker.PRIVATE/'deploy.returned.json'
worker.BUILD_POINTER=pipeline.pointer('daemon')
def sources():
 pipeline.need(pipeline.sha(FROZEN.read_bytes())==FROZEN_SHA);return {**original_sources(),**pipeline.source_pins(),'frozen_worker_operator_sha256':FROZEN_SHA}
worker.source_pins=sources
def daemon_build(document,plan,import_proof):
 actual=pipeline.load_success('daemon');pipeline.need(document==actual);pipeline.validate_image('daemon',document)
 pipeline.need(document['runtime_digest']!=worker.OLD_IMAGE and document['source']['manifest_sha256']==plan['next']['manifest_sha256'])
 native=pipeline.load_success('native');pipeline.need(pipeline.manifest(native,document)==plan['next']['manifest_sha256']and native['runtime_digest']==plan['next']['native_image_id'])
 pipeline.need(import_proof.get('result')=='ready_image_and_import_gate_observed'and import_proof.get('daemon_runtime_digest')==document['runtime_digest']and import_proof.get('source_sha256')==pipeline.SOURCE and import_proof.get('run')==pipeline.RUN and import_proof.get('baked_manifest_sha256')==plan['next']['manifest_sha256']and import_proof.get('production_import_gate')==document['production_import_gate']and import_proof.get('actual_oci_receipts_used')is True)
 return document['runtime_digest']
worker.daemon_build=daemon_build
if __name__=='__main__':
 try:worker.main()
 except Exception:print('ENGLISH_WORKER_OCI_RELEASE_UNCONFIRMED');sys.exit(1)
