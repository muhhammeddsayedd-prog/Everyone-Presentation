import Ajv2020 from 'ajv/dist/2020';
import type { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { DomainError } from '@eps/domain';
import catalog from '../../../contracts/mcp-tool-catalog.json';

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validators = new Map<string, ValidateFunction>();

/** Call only for successful operations. Error results retain their separate
 * published ErrorResponse envelope; invalid private output is never returned. */
export function validateMcpSuccess(name: string, value: unknown): Record<string, unknown> {
  let validate = validators.get(name);
  if (!validate) {
    const tool = catalog.tools.find(tool => tool.name === name);
    if (tool) { validate = ajv.compile(tool.outputSchema); validators.set(name, validate); }
  }
  if (!validate || !validate(value)) throw new DomainError('OPERATION_RESPONSE_INVALID', 'The operation result did not match its published contract. Retry access or contact the workspace administrator.', 503);
  return value as Record<string, unknown>;
}
