"""Pure seventh-target extension; no database, process or provider dispatch."""
from pathlib import Path
import hashlib
import importlib.util
import json

LIBRARY = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
DATA = LIBRARY / 'development/m07/presentation-generation-data-proof/proof_source.py'
SCALAR = LIBRARY / 'development/m07/presentation-mcp-scalar-capability/candidate.py'
DATA_SHA = '67cc13d0fed354e102eb769bf5d9712b07e1af1f434d2a3da8ede57333232c1c'
SCALAR_SHA = '58f7764c9fbf783bd62a2b2fff8f3130894e0217e7306b241c3cf2fc3e5630ee'
ENGLISH_SIGNATURE = 'eps.capture_presentation_video_english_transcripts(uuid)'
SCALAR_SIGNATURE = 'eps.mcp_token_permits_capability(text)'
SCALAR_NAME = 'eps.mcp_token_permits_capability'
VALIDATOR_SIGNATURE = 'public.eps_validate_own_oauth_session(text)'
VALIDATOR_NAME = 'public.eps_validate_own_oauth_session'
BEFORE = '5eb6c1272a78a4ca821569082c54d2b1ce434516585c8eac533c29ec1c445ccc'
AFTER = '8455eeb4094d74a11e487627711f237192c9b591fdf61d1b54b9114bedd487ab'
VALIDATOR = '9fe44accb3998d924bb0f453c721a33f5603f20e4c245abbf0e46807561891f6'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('SCALAR_SEVEN_TARGET_EXTENSION_UNCONFIRMED')


def load(name, file, digest):
    info = file.lstat()
    need(file.is_file() and not file.is_symlink() and info.st_nlink == 1 and sha(file.read_bytes()) == digest)
    spec = importlib.util.spec_from_file_location(name, file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def scalar_bindings():
    scalar = load('seven_target_scalar_source', SCALAR, SCALAR_SHA)
    row = scalar.build()
    need(row['before_body_sha256'] == BEFORE and row['after_body_sha256'] == AFTER)
    result = {'scalar' + phase.capitalize(): {
        'name': SCALAR_NAME, 'sha': row[phase + '_body_sha256'],
        'sql': row[phase], 'definition_sha256': sha(row[phase].encode())}
        for phase in ('before', 'after')}
    validator = scalar.definitions()[1]
    need(sha(scalar.parts(validator)[2].encode()) == VALIDATOR)
    result['publicValidator'] = {'name': VALIDATOR_NAME, 'sha': VALIDATOR,
                                 'sql': validator, 'definition_sha256': sha(validator.encode())}
    return result


def edits():
    data = load('seven_target_identity_source', DATA, DATA_SHA)
    six = ['eps.presentation_lock_sources(uuid,text,text)'] + data.SIGNATURES + [ENGLISH_SIGNATURE]
    need(len(six) == 6 and SCALAR_SIGNATURE not in six and VALIDATOR_SIGNATURE not in six)
    mask = lambda values: 'p.oid in(' + ','.join("'" + name + "'::regprocedure" for name in values) + ')'
    old_identity = data.IDENTITY_SQL[:-2] + ",'" + ENGLISH_SIGNATURE + "'::regprocedure);"
    new_identity = old_identity[:-2] + ",'" + SCALAR_SIGNATURE + "'::regprocedure,'" + VALIDATOR_SIGNATURE + "'::regprocedure);"
    selection = "  const english=bodies===ctx.bindings.afterBodies?ctx.bindings.englishAfter:ctx.bindings.englishBefore;"
    selected = selection + "\n  const scalar=bodies===ctx.bindings.afterBodies?ctx.bindings.scalarAfter:ctx.bindings.scalarBefore;\n  assert.equal(scalar.name,'" + SCALAR_NAME + "');"
    install_tail = '  for(const item of bodies){assert.equal(actual[item.name].source,item.sha);assert.deepEqual(actual[item.name].authority,originalBodyIdentity[item.name].authority);}'
    validator_check = "\n  assert.deepEqual(actual['" + VALIDATOR_NAME + "'],originalBodyIdentity['" + VALIDATOR_NAME + "']);record.public_validator_unchanged=true;"
    original = 'const originalBodyIdentity=await value(' + json.dumps(new_identity) + ');'
    return [
        (mask(six), mask(six + [SCALAR_SIGNATURE]), 1),
        (json.dumps(old_identity), json.dumps(new_identity), 2),
        (selection, selected, 1),
        ('bodies=[...bodies,english];', 'bodies=[...bodies,english,scalar];', 1),
        (original, original + "\n assert.equal(originalBodyIdentity['" + SCALAR_NAME + "'].source,ctx.bindings.scalarBefore.sha);\n assert.equal(originalBodyIdentity['" + VALIDATOR_NAME + "'].source,ctx.bindings.publicValidator.sha);", 1),
        (install_tail, install_tail + validator_check, 1),
        ('catalogue_prosrc_exclusions:6', 'catalogue_prosrc_exclusions:7', 1),
        ('original4107_and_all_five_old_bodies_restored=true', 'original4107_and_all_six_old_bodies_restored=true', 1),
    ]


def extend_callback(source):
    before = source
    changes = edits()
    for old, new, count in changes:
        need(source.count(old) == count)
        source = source.replace(old, new)
    need(inverse_callback(source) == before)
    return source, {
        'inverse_byte_equal': True, 'catalogue_prosrc_targets_exactly_seven': True,
        'scalar_selected_before_any_local_array_expansion': True,
        'binding_arrays_remain_four': True, 'installed_body_identities_six': True,
        'helper_identity_preserved_separately': True,
        'public_validator_not_masked_or_installed': True,
        'public_validator_source_and_full_pg_proc_identity_checked_each_install': True,
        'initial_old_candidate_final_installs_select_scalar_explicitly': True,
        'original_seven_targets_restored': True,
    }


def inverse_callback(source):
    for old, new, count in reversed(edits()):
        need(source.count(new) == count)
        source = source.replace(new, old)
    return source
