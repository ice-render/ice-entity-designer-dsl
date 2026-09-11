import type { DslDocument, DslValidationResult } from './types';

export const DSL_SCHEMA_VERSION = 1;

export function validateDsl(dsl: DslDocument): DslValidationResult {
  const errors: string[] = [];
  if (!dsl || typeof dsl !== 'object' || Array.isArray(dsl)) {
    return { valid: false, errors: ['DSL root must be an object'] };
  }
  if (dsl.schemaVersion !== undefined && dsl.schemaVersion !== DSL_SCHEMA_VERSION) {
    errors.push(`Unsupported schemaVersion: ${dsl.schemaVersion}`);
  }
  if (!Array.isArray(dsl.entities)) {
    errors.push('entities must be an array');
  } else {
    const ids = new Set<string>();
    dsl.entities.forEach((entity, index) => {
      const prefix = `entities[${index}]`;
      if (!entity || typeof entity !== 'object') {
        errors.push(`${prefix} must be an object`);
        return;
      }
      if (typeof entity.id !== 'string' || !entity.id.trim()) {
        errors.push(`${prefix}.id must be a non-empty string`);
      } else if (ids.has(entity.id)) {
        errors.push(`${prefix}.id is duplicated: ${entity.id}`);
      } else {
        ids.add(entity.id);
      }
      if (!Array.isArray(entity.fields)) {
        errors.push(`${prefix}.fields must be an array`);
      } else {
        entity.fields.forEach((field, fieldIndex) => {
          if (!field || typeof field !== 'object' || typeof field.name !== 'string' || !field.name.trim()) {
            errors.push(`${prefix}.fields[${fieldIndex}].name must be a non-empty string`);
          }
        });
      }
    });
  }
  if (dsl.relations !== undefined && !Array.isArray(dsl.relations)) {
    errors.push('relations must be an array');
  } else {
    (dsl.relations || []).forEach((relation, index) => {
      const prefix = `relations[${index}]`;
      if (!relation || typeof relation !== 'object') {
        errors.push(`${prefix} must be an object`);
      } else {
        if (typeof relation.source !== 'string' || !relation.source.trim()) {
          errors.push(`${prefix}.source must be a non-empty string`);
        }
        if (typeof relation.target !== 'string' || !relation.target.trim()) {
          errors.push(`${prefix}.target must be a non-empty string`);
        }
      }
    });
  }
  return { valid: errors.length === 0, errors };
}
