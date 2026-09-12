import { isBpmnDsl, isFlowDsl, isUmlDsl, isStatechartDsl, isGanttDsl, isPowerDsl, POWER_DSL_KINDS } from './types';
import type {
  DslPowerDocument,
  DslBpmnDocument,
  DslGanttDocument,
  DslStatechartDocument,
  DslUmlDocument,
  DslDocument,
  DslFlowDocument,
  DslFlowNodeKind,
  DslPort,
  DslValidationResult,
} from './types';

export const DSL_SCHEMA_VERSION = 1;

const FLOW_NODE_KINDS: DslFlowNodeKind[] = ['terminator', 'process', 'decision', 'io'];
const FLOW_PORTS: DslPort[] = ['T', 'R', 'B', 'L', 'C'];

const BPMN_NODE_KINDS = [
  'pool',
  'lane',
  'task',
  'event',
  'gateway',
  'subprocess',
  'dataObject',
  'annotation',
];
const BPMN_EVENT_KINDS = ['start', 'intermediate', 'end'];
const BPMN_TRIGGERS = ['none', 'message', 'timer', 'error', 'terminate'];
const BPMN_GATEWAY_TYPES = ['exclusive', 'parallel', 'inclusive', 'event'];
const BPMN_TASK_TYPES = ['none', 'user', 'service', 'script', 'send', 'receive', 'manual'];
const BPMN_FLOW_TYPES = ['sequence', 'message', 'association'];

const STATECHART_NODE_KINDS = ['initial', 'final', 'state', 'composite'];
const UML_NODE_KINDS = ['class', 'interface', 'enum'];
const UML_RELATION_TYPES = ['inheritance', 'realization', 'association', 'aggregation', 'composition', 'dependency'];

/**
 * 校验一份 DSL 文档：ER（entities/relations）、流程图（kind: 'flowchart'）
 * 或 BPMN（kind: 'bpmn'，nodes/edges + 池/泳道容器）。
 */
export function validateDsl(dsl: DslDocument): DslValidationResult {
  if (isGanttDsl(dsl)) {
    return validateGanttDsl(dsl);
  }
  if (isPowerDsl(dsl)) {
    return validatePowerDsl(dsl);
  }
  if (isStatechartDsl(dsl)) {
    return validateStatechartDsl(dsl);
  }
  if (isUmlDsl(dsl)) {
    return validateUmlDsl(dsl);
  }
  if (isBpmnDsl(dsl)) {
    return validateBpmnDsl(dsl);
  }
  if (isFlowDsl(dsl)) {
    return validateFlowDsl(dsl);
  }
  return validateErDsl(dsl as any);
}

/**
 * BPMN 文档校验：结构 + 取值词汇表 + 端点必须存在。
 *
 * 这里只做**结构**校验（离线可判定、错误信息稳定）。语义检查（每个池至少一个开始事件、
 * 顺序流不得跨池、可达性等）交给 `BpmnDesigner.validateBpmn()` —— 那是同一套规则，
 * 不要在 DSL 里再实现一遍。
 */
export function validateBpmnDsl(dsl: DslBpmnDocument): DslValidationResult {
  const errors: string[] = [];
  if (!dsl || typeof dsl !== 'object' || Array.isArray(dsl)) {
    return { valid: false, errors: ['DSL root must be an object'] };
  }
  if (dsl.schemaVersion !== undefined && dsl.schemaVersion !== DSL_SCHEMA_VERSION) {
    errors.push(`Unsupported schemaVersion: ${dsl.schemaVersion}`);
  }

  const ids = new Set<string>();
  const kinds = new Map<string, string>();
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
        kinds.set(node.id, node.kind || 'task');
      }
      if (node.kind !== undefined && BPMN_NODE_KINDS.indexOf(node.kind) === -1) {
        errors.push(`${prefix}.kind must be one of ${BPMN_NODE_KINDS.join('/')}`);
      }
      ['left', 'top', 'width', 'height'].forEach((key) => {
        const value = (node as any)[key];
        if (value !== undefined && typeof value !== 'number') {
          errors.push(`${prefix}.${key} must be a number when present`);
        }
      });
      const enums: Array<[string, string[]]> = [
        ['eventKind', BPMN_EVENT_KINDS],
        ['trigger', BPMN_TRIGGERS],
        ['gatewayType', BPMN_GATEWAY_TYPES],
        ['taskType', BPMN_TASK_TYPES],
      ];
      enums.forEach(([key, allowed]) => {
        const value = (node as any)[key];
        if (value !== undefined && allowed.indexOf(value) === -1) {
          errors.push(`${prefix}.${key} must be one of ${allowed.join('/')}`);
        }
      });
    });

    // parent 指向必须存在，且「容器的容器」只能是池（泳道里不能再放泳道/池）
    dsl.nodes.forEach((node, index) => {
      if (!node || typeof node !== 'object' || node.parent === undefined) {
        return;
      }
      const prefix = `nodes[${index}]`;
      if (typeof node.parent !== 'string' || !node.parent.trim()) {
        errors.push(`${prefix}.parent must be a non-empty string when present`);
        return;
      }
      if (!ids.has(node.parent)) {
        errors.push(`${prefix}.parent must reference an existing node id`);
        return;
      }
      if (node.parent === node.id) {
        errors.push(`${prefix}.parent must not reference itself`);
        return;
      }
      const parentKind = kinds.get(node.parent);
      if (node.kind === 'pool') {
        errors.push(`${prefix}.parent is not allowed on a pool (池是最外层容器)`);
      } else if (node.kind === 'lane' && parentKind !== 'pool') {
        errors.push(`${prefix}.parent must reference a pool`);
      } else if (parentKind !== 'pool' && parentKind !== 'lane') {
        errors.push(`${prefix}.parent must reference a pool or a lane`);
      }
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
      const flowType = edge.type !== undefined ? edge.type : edge.flowType;
      if (flowType !== undefined && BPMN_FLOW_TYPES.indexOf(flowType) === -1) {
        errors.push(`${prefix}.type must be one of ${BPMN_FLOW_TYPES.join('/')}`);
      }
      if (edge.label !== undefined && typeof edge.label !== 'string') {
        errors.push(`${prefix}.label must be a string when present`);
      }
      if (edge.condition !== undefined && typeof edge.condition !== 'string') {
        errors.push(`${prefix}.condition must be a string when present`);
      }
      if (edge.linkShape !== undefined && edge.linkShape !== 'visio' && edge.linkShape !== 'bezier') {
        errors.push(`${prefix}.linkShape must be "visio" or "bezier" when present`);
      }
    });
  }
  return { valid: errors.length === 0, errors };
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

/**
 * UML 文档校验：结构 + 词汇表 + 端点存在。
 *
 * 语义检查（重名类、继承成环等）交给 `UmlDesigner.validateUml()` —— 与 BPMN 同一分工：
 * 结构在 DSL 侧、语义在设计师侧，不重复实现。
 */
export function validateUmlDsl(dsl: DslUmlDocument): DslValidationResult {
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
      if (node.kind !== undefined && UML_NODE_KINDS.indexOf(node.kind) === -1) {
        errors.push(`${prefix}.kind must be one of ${UML_NODE_KINDS.join('/')}`);
      }
      ['attributes', 'methods'].forEach((key) => {
        const value = (node as any)[key];
        if (value === undefined) {
          return;
        }
        if (!Array.isArray(value) || value.some((item: any) => typeof item !== 'string')) {
          errors.push(`${prefix}.${key} must be an array of strings when present`);
        }
      });
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
      const relationType = edge.type !== undefined ? edge.type : edge.relation;
      if (relationType !== undefined && UML_RELATION_TYPES.indexOf(relationType) === -1) {
        errors.push(`${prefix}.type must be one of ${UML_RELATION_TYPES.join('/')}`);
      }
      if (edge.label !== undefined && typeof edge.label !== 'string') {
        errors.push(`${prefix}.label must be a string when present`);
      }
    });
  }
  return { valid: errors.length === 0, errors };
}

/**
 * 状态机文档校验：结构 + 词汇表 + 端点存在 + parent 合法性（子状态只能挂复合状态）。
 * 语义检查（初始状态、终态出边、可达性）交给 `StatechartDesigner.validateStatechart()`。
 */
export function validateStatechartDsl(dsl: DslStatechartDocument): DslValidationResult {
  const errors: string[] = [];
  if (!dsl || typeof dsl !== 'object' || Array.isArray(dsl)) {
    return { valid: false, errors: ['DSL root must be an object'] };
  }
  if (dsl.schemaVersion !== undefined && dsl.schemaVersion !== DSL_SCHEMA_VERSION) {
    errors.push(`Unsupported schemaVersion: ${dsl.schemaVersion}`);
  }

  const ids = new Set<string>();
  const kinds = new Map<string, string>();
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
        kinds.set(node.id, node.kind || 'state');
      }
      if (node.kind !== undefined && STATECHART_NODE_KINDS.indexOf(node.kind) === -1) {
        errors.push(`${prefix}.kind must be one of ${STATECHART_NODE_KINDS.join('/')}`);
      }
      ['left', 'top', 'width', 'height'].forEach((key) => {
        const value = (node as any)[key];
        if (value !== undefined && typeof value !== 'number') {
          errors.push(`${prefix}.${key} must be a number when present`);
        }
      });
    });
    dsl.nodes.forEach((node, index) => {
      if (!node || typeof node !== 'object' || node.parent === undefined) {
        return;
      }
      const prefix = `nodes[${index}]`;
      if (typeof node.parent !== 'string' || !node.parent.trim() || !ids.has(node.parent)) {
        errors.push(`${prefix}.parent must reference an existing node id`);
        return;
      }
      if (node.parent === node.id) {
        errors.push(`${prefix}.parent must not reference itself`);
        return;
      }
      if (kinds.get(node.parent) !== 'composite') {
        errors.push(`${prefix}.parent must reference a composite state`);
      }
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
      ['event', 'guard', 'action', 'label'].forEach((key) => {
        const value = (edge as any)[key];
        if (value !== undefined && typeof value !== 'string') {
          errors.push(`${prefix}.${key} must be a string when present`);
        }
      });
    });
  }
  return { valid: errors.length === 0, errors };
}

/**
 * 甘特文档校验：结构 + 日期格式 + 数值范围 + 依赖端点。
 *
 * 语义检查（依赖成环等）交给 `GanttDesigner.validateGantt()`。
 */
export function validateGanttDsl(dsl: DslGanttDocument): DslValidationResult {
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
    dsl.nodes.forEach((task, index) => {
      const prefix = `nodes[${index}]`;
      if (!task || typeof task !== 'object') {
        errors.push(`${prefix} must be an object`);
        return;
      }
      if (typeof task.id !== 'string' || !task.id.trim()) {
        errors.push(`${prefix}.id must be a non-empty string`);
      } else if (ids.has(task.id)) {
        errors.push(`${prefix}.id is duplicated: ${task.id}`);
      } else {
        ids.add(task.id);
      }
      if (typeof task.start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(task.start)) {
        errors.push(`${prefix}.start must be a "YYYY-MM-DD" string`);
      }
      if (task.days !== undefined && !(Number(task.days) >= 1)) {
        errors.push(`${prefix}.days must be a number >= 1 when present`);
      }
      if (task.progress !== undefined) {
        const progress = Number(task.progress);
        if (!(progress >= 0 && progress <= 1)) {
          errors.push(`${prefix}.progress must be between 0 and 1 when present`);
        }
      }
      if (task.row !== undefined && !(Number(task.row) >= 0)) {
        errors.push(`${prefix}.row must be a number >= 0 when present`);
      }
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
        errors.push(`${prefix}.source must reference an existing task id`);
      }
      if (typeof edge.target !== 'string' || !edge.target.trim() || !ids.has(edge.target)) {
        errors.push(`${prefix}.target must reference an existing task id`);
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

/**
 * 电力一次系统图文档的结构校验（语义校验在 designer：`validatePower()`）。
 *
 * 这里只查「结构」：id 唯一、kind 合法、端点存在、母线 T 接指向母线、电压等级格式。
 * 电压等级一致性、母线进线、五防这些**语义**规则属于设计器（`renderPowerDsl` 返回的 designer）。
 */
export function validatePowerDsl(dsl: DslPowerDocument): DslValidationResult {
  const errors: string[] = [];
  const nodes = Array.isArray(dsl.nodes) ? dsl.nodes : [];
  if (!Array.isArray(dsl.nodes)) {
    errors.push('nodes must be an array');
  }
  const ids = new Set<string>();
  nodes.forEach((node: any, index: number) => {
    const prefix = `nodes[${index}]`;
    if (!node || typeof node !== 'object') {
      errors.push(`${prefix} must be an object`);
      return;
    }
    if (typeof node.id !== 'string' || !node.id) {
      errors.push(`${prefix}.id must be a non-empty string`);
    } else if (ids.has(node.id)) {
      errors.push(`duplicated node id: ${node.id}`);
    } else {
      ids.add(node.id);
    }
    if (POWER_DSL_KINDS.indexOf(node.kind) === -1) {
      errors.push(`${prefix}.kind must be one of ${POWER_DSL_KINDS.join(' / ')}`);
    }
    if (node.voltageLevel !== undefined && !/^\d+(\.\d+)?kV$/.test(String(node.voltageLevel))) {
      errors.push(`${prefix}.voltageLevel must look like "110kV"`);
    }
  });
  nodes.forEach((node: any, index: number) => {
    if (!node || node.attachedTo === undefined) {
      return;
    }
    const bus = nodes.find((item: any) => item && item.id === node.attachedTo);
    if (!bus) {
      errors.push(`nodes[${index}].attachedTo references an unknown node: ${node.attachedTo}`);
      return;
    }
    if (bus.kind !== 'busbar') {
      errors.push(`nodes[${index}].attachedTo must point at a busbar: ${node.attachedTo} is ${bus.kind}`);
    }
  });
  (dsl.edges || []).forEach((edge: any, index: number) => {
    const prefix = `edges[${index}]`;
    if (!edge || typeof edge !== 'object') {
      errors.push(`${prefix} must be an object`);
      return;
    }
    if (!ids.has(edge.source)) {
      errors.push(`${prefix}.source references an unknown node: ${edge.source}`);
    }
    if (!ids.has(edge.target)) {
      errors.push(`${prefix}.target references an unknown node: ${edge.target}`);
    }
    if (edge.source === edge.target) {
      errors.push(`${prefix} must not connect a node to itself`);
    }
  });
  return { valid: errors.length === 0, errors };
}
