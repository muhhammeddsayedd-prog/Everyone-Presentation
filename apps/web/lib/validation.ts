import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { DomainError } from '@eps/domain';
import schemas from './generated-contracts.json';

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validators = new Map<string, ReturnType<typeof ajv.compile>>();
export function validateContract<T = unknown>(name: string, value: unknown): T {
  let check = validators.get(name);
  if (!check) { check = ajv.compile({ ...schemas, $ref: `#/$defs/${name}` }); validators.set(name, check); }
  if (!check(value)) throw new DomainError('VALIDATION_FAILED', 'Request does not match the operation contract.', 400,
    { fields: check.errors?.map(error => ({ path: error.instancePath, rule: error.keyword })) ?? [] });
  return value as T;
}
