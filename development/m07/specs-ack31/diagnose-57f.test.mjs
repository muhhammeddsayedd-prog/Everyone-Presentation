import assert from 'node:assert/strict';
import {test} from 'node:test';
import {projectFailure} from './diagnose-57f.mjs';
test('fixed SQL diagnostic projects only known code/line/function and never raw payload',()=>{
 const value=projectFailure({message:'ACK31_LOCAL_COMMAND_UNCONFIRMED',stack:'at ackReadback (SYNTHETIC_PRIVATE_PATH/run-local.mjs:105:2)',diagnostic:{stderr:'psql:<stdin>:9: ERROR:  42883: function has_column_privilege(text, text, text, text) does not exist\nLINE 7: SYNTHETIC_PRIVATE_TOKEN'}});
 assert.equal(value.sqlstate,'42883');assert.equal(value.psql_line,9);assert.equal(value.function_name,'has_column_privilege');assert.equal(value.stack_stage,'ackReadback');assert(!JSON.stringify(value).includes('SYNTHETIC_PRIVATE'));
});
test('assertion projection closes boolean fields and drops unexpected message/key content',()=>{
 const value=projectFailure({message:'Expected values to be strictly deep-equal:\n+ whole_job_select_still_denied: false,\n- whole_job_select_still_denied: true,\n+ access_token: SYNTHETIC_PRIVATE',stack:'at ackReadback (fixed/run-local.mjs:105:2)',extra:'SYNTHETIC_PRIVATE'});
 assert.equal(value.kind,'assertion');assert.deepEqual(value.boolean_differences,[{field:'whole_job_select_still_denied',actual:false,expected:true}]);assert(!JSON.stringify(value).includes('PRIVATE'));
});
