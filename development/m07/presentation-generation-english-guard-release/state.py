"""One legacy unaliased English source operand, all security terms retained."""
from pathlib import Path
import hashlib
import importlib.util

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parents[2]
MAIN = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
PARENT = MAIN / 'development/m07/presentation-generation-raw-preimage-release/state.py'
PARENT_SHA = 'c7cf493e40a65296def1ccc7b0d76752ea31aa4ae7709ef8198c48707e6ff8fd'
_stat = PARENT.lstat()
if not (PARENT.is_file() and not PARENT.is_symlink() and PARENT.resolve() == PARENT and _stat.st_nlink == 1 and 0 < _stat.st_size <= 16 * 1024**2 and hashlib.sha256(PARENT.read_bytes()).hexdigest() == PARENT_SHA):
    raise ValueError('GENERATION42_ENGLISH_GUARD_UNCONFIRMED')
_spec = importlib.util.spec_from_file_location('generation42_frozen_raw_Context', PARENT)
parent = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(parent)
for _name in ('TARGET', 'MAXIMUM', 'VERSION', 'MIGRATION', 'MIGRATION_SHA', 'MIGRATION_NAME', 'REMAINING_PROOF_REF', 'REMAINING_AUDIT_REF', 'READY', 'FIXED', 'TARGETS', 'uuid', 'need', 'sha', 'load', 'literal', 'json_sql', 'digest', 'parts', 'module'):
    globals()[_name] = getattr(parent, _name)
SIGNATURE = 'eps.capture_presentation_video_english_transcripts(uuid)'
BEFORE = 'c68de52a4ede0ec6401aa05e0f40b5932905dd8dc8c1c72149c9f95c51a23aeb'
OPERAND = "convert_to(prosrc,'UTF8')"
ANCHOR = "exists(select 1 from pg_proc where oid=to_regprocedure('" + SIGNATURE + "')and proowner='eps_review_owner'::regrole and prosecdef=false and provolatile='v' and proconfig=array['search_path=\"\"']::text[]and encode(sha256(" + OPERAND + "),'hex')='" + BEFORE + "')"


def project(text, before_body):
    need(sha(before_body.encode()) == BEFORE and text.count(ANCHOR) == 1)
    operand = "convert_to((case when oid=to_regprocedure('" + SIGNATURE + "')then " + literal(before_body) + "::text else prosrc end),'UTF8')"
    replacement = ANCHOR.replace(OPERAND, operand, 1)
    need(ANCHOR.count(OPERAND) == 1)
    result = text.replace(ANCHOR, replacement, 1)
    need(result.count(replacement) == 1 and result.replace(replacement, ANCHOR, 1) == text)
    return result, replacement


class Context(parent.Context):
    def __init__(self, root=MAIN, source=SOURCE):
        super().__init__(root=root, source=source)

    def compatibility_sql(self):
        original = super().compatibility_sql()
        return project(original, self.targets[SIGNATURE]['before_body'])[0]

    def admission(self):
        value = super().admission()
        value['legacy_English_source_operand_only'] = {'signature': SIGNATURE, 'frozen_before_body_sha256': BEFORE,
                                                     'all_other_security_conjunction_terms_unchanged': True,
                                                     'actual_target_source_and_full_attributes_still_checked': True}
        return value

    def source_pins(self):
        pins = super().source_pins()
        pins[str(PARENT)] = PARENT_SHA
        for file in sorted(HERE.iterdir()):
            if file.is_file():
                pins[str(file)] = sha(load(file))
        return dict(sorted(pins.items()))
