"""Exact existing6o service/artifact anchors. No future artifact refs invented."""
from pathlib import Path
import hashlib,importlib.util
MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
GENERIC=MAIN/'development/m07/worker-source-identity-release'
COMPATIBLE=MAIN/'development/m07/worker-compatible-daemon-release'
FROZEN={
 'worker-source-identity-release/state.py':'83b859f8e5cb325c91a77c0b04f492354a0d28ffa6cad324fd2abb20bc9c466c',
 'worker-source-identity-release/admission.py':'55d6c22d8ed7f628d2ba4c9484c9343b9213b25ba9e6d268828f79a1fc73f4e5',
 'worker-source-identity-release/environment.py':'ce0f72c6f6c0fc1e56ab449513c36d0d2989731a2b7ad28c3186300eeb5aa7d6',
 'worker-source-identity-release/provider.py':'596f33da5a3f02ab9055452f7488170d66954fdcdaadc701be8ad23ed821f497',
 'worker-source-identity-release/controller.py':'f93670f84134c0fe227dad75c8c2fa9023188a6b0982bc34bc8256dcc695821f',
 'worker-source-identity-release/mechanisms.py':'4a7449b349794d9d2e2b49842d5e8ff6d82d7288077845d3f1b1061cef0842dc',
 'worker-source-identity-release/startup.py':'8da52175dd38d8084f1cc4c5fc111c28843d3bcd898533d97dc0a12ef19effcb',
 'worker-source-identity-release/registry.py':'4874e540ca5022a4311b0d3006c14d3ce585b1d4abb802f28a23fb2585885390',
 'worker-source-identity-release/native_probe.py':'151762460ca4bb4ab2d38fdacc6e295ce8058e4c8d772628acb2ab4ef4817a4f',
 'worker-source-identity-release/build.py':'b9fe07ed13c4786909513af6af1f8b17248c21054d419c203bce91f2ee917e7d',
 'worker-compatible-daemon-release/anchors.py':'29082b95b2d003fd727d87e7e6a416171096e2d39da44056009c37c0090e0a43',
 'worker-compatible-daemon-release/provider.py':'2a663f05af131099f199fd1b7e137be06571518a73985c3b3befc2e562995d1b',
 'worker-compatible-daemon-release/registry.py':'5d4c46197109513bcd99c26c6d8d179837e34a3326c8797000d2d0db7e8d2b40',
 'worker-compatible-daemon-release/startup.py':'e3ba87d90f92975a3b1d38370b089033cc987f26fb92cbf3b5a67e94460f1366'}
BASELINE={'deployment_id':'dpl_6oA1iaHte26KG1DEkBEJ9KU3ahS7','daemon_digest':'sha256:697362169825a7f71493e98870505cb74a2ae163999209785c02ac7a0b0a0329','daemon_source_sha256':'dc12eaab6d862b2d151665b13c092568a273a2b1c7e2fde24516654c7db40648','native_digest':'sha256:3d4286db01b27b40ec9078e303158e93003a096d5ddad1c9802130238de6dd80','native_manifest_sha256':'fa221d833f0417d303c55ecc43629b2edf68ccdcc020d90e7f1864341e02fa57','native_compatibility_sha256':'24737d69156a7dfb10459668c828265c7665be0efae80c5da678ea53fd61328b'}
READY={'path':'tracking/evidence/m07/worker-compatible-daemon-env-store-forward/2026-11-02T23-12-37-406966Z-ready.json','sha256':'03bb2f77a1fbda508c4ce2f30567701edf7066809aaa6900d2f17c130d42563b'}
RESUME={'path':'tracking/evidence/m07/worker-compatible-daemon-env-store-forward/2026-11-02T23-25-06-361305Z-resume.json','sha256':'0c9f05d2a98aee1650291ba59132d8846bf2013e435f59f913ef20d41fbf331d'}
BUILD=MAIN/'development/m07/worker-ocr-config-daemon-build/build.py'
BUILD_ANCHORS=MAIN/'development/m07/worker-ocr-config-daemon-build/anchors.py'
BUILD_SHA='20dffed203fb108195c4d537dc66391875b37f31f8a4ffaafa98776ad1e73a67'
BUILD_ANCHORS_SHA='c78fcc732fa98d214c4d670d4295c5afb43ad829c7845f35cd34298566a7fbc2'
INPUT='.local/worker-ocr-config-daemon-release/inputs.json'
PRIVATE='.local/worker-ocr-config-daemon-release'
EVIDENCE='tracking/evidence/m07/worker-ocr-config-daemon-release'
PURPOSE='ocr_configuration_daemon_forward_retained_native3d'
def need(ok):
 if not ok:raise ValueError('OCR_CONFIG_FORWARD_REFUSED')
def module(name,p):
 spec=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def frozen(name):
 for rel,h in FROZEN.items():
  p=MAIN/'development/m07'/rel;need(p.is_file()and not p.is_symlink()and p.stat().st_nlink==1 and hashlib.sha256(p.read_bytes()).hexdigest()==h)
 return module('ocr_frozen_'+name.replace('/','_').replace('.','_'),MAIN/'development/m07'/name)
def builder():
 import re
 for p,h in((BUILD,BUILD_SHA),(BUILD_ANCHORS,BUILD_ANCHORS_SHA)):
  need(type(h)is str and re.fullmatch('[a-f0-9]{64}',h)and p.is_file()and not p.is_symlink()and p.resolve()==p and p.stat().st_nlink==1 and hashlib.sha256(p.read_bytes()).hexdigest()==h)
 return module('ocr_reviewed_new_build',BUILD)
