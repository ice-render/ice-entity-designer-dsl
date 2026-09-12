import { isFlowDsl } from './types';
import type { DslDocument, DslFlowDocument, DslFlowNodeKind, DslPort, DslValidationResult } from './types';

export const DSL_SCHEMA_VERSION = 1;

const FLOW_NODE_KINDS: DslFlowNodeKind[] = ['terminator', 'process', 'decision', 'io'];
const FLOW_PORTS: DslPort[] = ['T', 'R', 'B', 'L', 'C'];

/** 校验一份 DSL 文档：ER 文档（entities/relations）或流程图文档（kind: 'flowchart' + nodes/edges） */
export function validateDsl(dsl: DslDocument): DslValidationResult {
  if (isFlowDsl(dsl)) {
    return validateFlowDsl(dsl);
  }
  return validateErDsl(dsl as any);
}

/** 流程图文档校验：结构 + 端点必须指向已存在的节点（与 ER 的关系校验同一口径） */
export function validateFlowDsl(dsl: DslFlowDocument): DslValidationResult {
  const errors: string[] = [];
  if (!dsl || typeof dsl !== 'object' || Array.isArray(dsl)) {
    return { valid: false, errors: ['DSL root must be an object'] };
  }
  if (dsl.schemaVersion !== undefined && dsl.schemaVersion !== DSL_SCHEMA_VERSION) {
    errors.push(`Unsupported schemaVersion: ${dsl.schemaVersion}`);
  }

  const ids = new Set<string>();
  if (!Array.isArray(dsl.nodes)) {
    errors.push('nodes must be an array');
  } else {
    dsl.nodes.forEach((node, index) => {
      const prefix = `nodes[${index}]`;
      if (!node || typeof node !== 'object') {
        errors.push(`${prefix} must be an object`);
        return;
      }
      if (typeof node.id !== 'string' || !node.id.trim()) {
        errors.push(`${prefix}.id must be a non-empty string`);
      } else if (ids.has(node.id)) {
        errors.push(`${prefix}.id is duplicated: ${node.id}`);
      } else {
        ids.add(node.id);
      }
      if (node.kind !== undefined && FLOW_NODE_KINDS.indexOf(node.kind) === -1) {
        errors.push(`${prefix}.kind must be one of ${FLOW_NODE_KINDS.join('/')}`);
      }
      ['left', 'top', 'width', 'height'].forEach((key) => {
        const value = (node as any)[key];
        if (value !== undefined && typeof value !== 'number') {
          errors.push(`${prefix}.${key} must be a number when present`);
        }
      });
    });
  }

  if (dsl.edges !== undefined && !Array.isArray(dsl.edges)) {
    errors.push('edges must be an array when present');
  } else {
    (dsl.edges || []).forEach((edge, index) => {
      const prefix = `edges[${index}]`;
      if (!edge || typeof edge !== 'object') {
        errors.push(`${prefix} must be an object`);
        return;
      }
      if (typeof edge.source !== 'string' || !edge.source.trim() || !ids.has(edge.source)) {
        errors.push(`${prefix}.source must reference an existing node id`);
      }
      if (typeof edge.target !== 'string' || !edge.target.trim() || !ids.has(edge.target)) {
        errors.push(`${prefix}.target must reference an existing node id`);
      }
      if (edge.label !== undefined && typeof edge.label !== 'string') {
        errors.push(`${prefix}.label must be a string when present`);
      }
      if (edge.sourcePort !== undefined && FLOW_PORTS.indexOf(edge.sourcePort) === -1) {
        errors.push(`${prefix}.sourcePort must be one of ${FLOW_PORTS.join('/')}`);
      }
      if (edge.targetPort !== undefined && FLOW_PORTS.indexOf(edge.targetPort) === -1) {
        errors.push(`${prefix}.targetPort must be one of ${FLOW_PORTS.join('/')}`);
      }
      if (edge.linkShape !== undefined && edge.linkShape !== 'visio' && edge.linkShape !== 'bezier') {
        errors.push(`${prefix}.linkShape must be "visio" or "bezier" when present`);
      }
    });
  }
  return { valid: errors.length === 0, errors };
}

/** ER 文档校验（原有实现，保持不变） */
function validateErDsl(dsl: any): DslValidationResult {
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
