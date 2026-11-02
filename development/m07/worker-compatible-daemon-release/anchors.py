"""Closed historical references, never a new native build/probe acceptance."""
from pathlib import Path
MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
OLD=MAIN/'development/m07/worker-source-identity-release'
FROZEN={'provider.py':'596f33da5a3f02ab9055452f7488170d66954fdcdaadc701be8ad23ed821f497','controller.py':'f93670f84134c0fe227dad75c8c2fa9023188a6b0982bc34bc8256dcc695821f','startup.py':'8da52175dd38d8084f1cc4c5fc111c28843d3bcd898533d97dc0a12ef19effcb','registry.py':'4874e540ca5022a4311b0d3006c14d3ce585b1d4abb802f28a23fb2585885390','native_probe.py':'151762460ca4bb4ab2d38fdacc6e295ce8058e4c8d772628acb2ab4ef4817a4f','build.py':'b9fe07ed13c4786909513af6af1f8b17248c21054d419c203bce91f2ee917e7d'}
NATIVE_SOURCE='f742e9e5e4b83643f5bae18cace3e9e253912c0114f59b4489f0d163bcb39368'
NATIVE_GRAPH='247992bbe3331251f33186cfac22835e8734833cd229bb6a4d8bcafa3bc0c214'
NATIVE_DIGEST='sha256:3d4286db01b27b40ec9078e303158e93003a096d5ddad1c9802130238de6dd80'
NATIVE_MANIFEST='fa221d833f0417d303c55ecc43629b2edf68ccdcc020d90e7f1864341e02fa57'
NATIVE_EXPORT={'path':'tracking/evidence/m07/worker-source-identity-release/2026-11-02T19-09-59-072239Z-native-export.json','sha256':'a05c6dba0e59813afadc42b07a286c0fd43c07852fe4474fc48cf2916b870814'}
NATIVE_COPY={'path':'tracking/evidence/m07/worker-source-identity-release/2026-11-02T19-20-16-978244Z-native-registry-copy.json','sha256':'8c5ca46033600d1e0db890f5623c2d33c63f59b03587366618be40b1aaaff324'}
NATIVE_READY={'path':'tracking/evidence/m07/worker-source-identity-release/2026-11-02T19-23-34-403749Z-native-registry-ready.json','sha256':'7fcecd4e585e6f8f14809671c51636c13634ee590958eb197283b407e50e98c2'}
NATIVE_PROFILE={'path':'.local/worker-source-identity-release/build-inputs.json','sha256':'ffd55b6983d746e3c040a9274042358406eb241930cb7dca71ae7c6710a5f842'}
PROBE_INPUT={'path':'.local/worker-source-identity-release/native-inputs.json','sha256':'45e03de731e994ebc246c0d30e627bbe88252388531bb9613cf1ac8db2d225fc'}
PROBE_REFS={'path':'.local/worker-source-identity-release/native-receipt-inputs.json','sha256':'4f8f30e08a2173a359b92f65843515d82427103038772ea1bb3b43325c455d2a'}
NATIVE_ADMITTED={'path':'tracking/evidence/m07/worker-source-identity-release/2026-11-02T19-33-56-730888Z-native-probe-admitted.json','sha256':'a03db92ca8975c1cf32affc50480327fd4b7ac47ee140303543b5be4480fb662'}
WORKER_PROOF={'path':'tracking/evidence/m07/worker-source-identity-sql-observation-proof/2026-11-02T21-03-49.392Z-cb8bd7f9.json','sha256':'ddcb58b91a07e7d557834acfa852afc6f76a958f2dc67b0d14aea6dfb6bf97e3'}
BUILD_WRAPPER=MAIN/'development/m07/worker-compatible-daemon-build/build.py'
BUILD_WRAPPER_SHA='1409d10ccd1a5e0d48878ab256318ebe3a785d5a90343c57f8b7c771be6d75d0'
# Exact Root-armed source (1cbb1db), not a normalized or guessed future seal.
BUILD_ANCHORS=MAIN/'development/m07/worker-compatible-daemon-build/anchors.py'
BUILD_ANCHORS_SHA='591ea939dfb7fd43b999d81db78ab12eaeacc954984a9bb32bd48d51b4f05545'
BUILD_INPUT='.local/worker-compatible-daemon-build/build-inputs.json'
INPUT='.local/worker-compatible-daemon-release/inputs.json'
PRIVATE='.local/worker-compatible-daemon-release'
EVIDENCE='tracking/evidence/m07/worker-compatible-daemon-release'
PURPOSE='daemon_only_release_reusing_exact_native_3d'

def module(name,file):
 import importlib.util
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
def library(name):
 import hashlib
 file=OLD/name
 if hashlib.sha256(file.read_bytes()).hexdigest()!=FROZEN[name]:raise ValueError('COMPATIBLE_DAEMON_LIBRARY_REFUSED')
 return module('compatible_daemon_frozen_'+name.replace('.','_'),file)
