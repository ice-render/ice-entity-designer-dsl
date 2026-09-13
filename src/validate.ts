import {
  isBpmnDsl,
  isFlowDsl,
  isUmlDsl,
  isStatechartDsl,
  isGanttDsl,
  isPowerDsl,
  POWER_DSL_KINDS,
  IED_DSL_CODES,
} from './types';
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
  IedDslDiagnostic,
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
  /**
   * 记一条错误：`errors` 保持原来的英文句子（兼容既有调用方）；
   * `diagnostics` 带稳定码与位置（Agent / 工具据此分支，不要去匹配 message）。
   */
  const diagnostics: IedDslDiagnostic[] = [];
  const fail = (code: string, message: string, path?: string) => {
    errors.push(message);
    diagnostics.push({ severity: 'error', code, message, path });
  };
  if (!dsl || typeof dsl !== 'object' || Array.isArray(dsl)) {
    fail(IED_DSL_CODES.ROOT_NOT_OBJECT, 'DSL root must be an object');
    return { valid: false, errors, diagnostics };
  }
  if (dsl.schemaVersion !== undefined && dsl.schemaVersion !== DSL_SCHEMA_VERSION) {
    fail(IED_DSL_CODES.SCHEMA_VERSION_UNSUPPORTED, `Unsupported schemaVersion: ${dsl.schemaVersion}`);
  }

  const ids = new Set<string>();
  const kinds = new Map<string, string>();
  if (!Array.isArray(dsl.nodes)) {
    fail(IED_DSL_CODES.NODES_NOT_ARRAY, 'nodes must be an array');
  } else {
    dsl.nodes.forEach((node, index) => {
      const prefix = `nodes[${index}]`;
      if (!node || typeof node !== 'object') {
        fail(IED_DSL_CODES.NOT_OBJECT, `${prefix} must be an object`, prefix);
        return;
      }
      if (typeof node.id !== 'string' || !node.id.trim()) {
        fail(IED_DSL_CODES.ID_INVALID, `${prefix}.id must be a non-empty string`, prefix);
      } else if (ids.has(node.id)) {
        fail(IED_DSL_CODES.ID_DUPLICATED, `${prefix}.id is duplicated: ${node.id}`, prefix);
      } else {
        ids.add(node.id);
        kinds.set(node.id, node.kind || 'task');
      }
      if (node.kind !== undefined && BPMN_NODE_KINDS.indexOf(node.kind) === -1) {
        fail(IED_DSL_CODES.KIND_INVALID, `${prefix}.kind must be one of ${BPMN_NODE_KINDS.join('/')}`, prefix);
      }
      ['left', 'top', 'width', 'height'].forEach((key) => {
        const value = (node as any)[key];
        if (value !== undefined && typeof value !== 'number') {
          fail(IED_DSL_CODES.FIELD_TYPE, `${prefix}.${key} must be a number when present`, prefix);
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
          fail(IED_DSL_CODES.FIELD_ENUM, `${prefix}.${key} must be one of ${allowed.join('/')}`, prefix);
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
        fail(IED_DSL_CODES.PARENT_INVALID, `${prefix}.parent must be a non-empty string when present`, prefix);
        return;
      }
      if (!ids.has(node.parent)) {
        fail(IED_DSL_CODES.PARENT_UNKNOWN, `${prefix}.parent must reference an existing node id`, prefix);
        return;
      }
      if (node.parent === node.id) {
        fail(IED_DSL_CODES.PARENT_SELF, `${prefix}.parent must not reference itself`, prefix);
        return;
      }
      const parentKind = kinds.get(node.parent);
      if (node.kind === 'pool') {
        fail(IED_DSL_CODES.PARENT_NOT_ALLOWED, `${prefix}.parent is not allowed on a pool (池是最外层容器)`, prefix);
      } else if (node.kind === 'lane' && parentKind !== 'pool') {
        fail(IED_DSL_CODES.PARENT_KIND, `${prefix}.parent must reference a pool`, prefix);
      } else if (parentKind !== 'pool' && parentKind !== 'lane') {
        fail(IED_DSL_CODES.PARENT_KIND, `${prefix}.parent must reference a pool or a lane`, prefix);
      }
    });
  }

  if (dsl.edges !== undefined && !Array.isArray(dsl.edges)) {
    fail(IED_DSL_CODES.EDGES_NOT_ARRAY, 'edges must be an array when present');
  } else {
    (dsl.edges || []).forEach((edge, index) => {
      const prefix = `edges[${index}]`;
      if (!edge || typeof edge !== 'object') {
        fail(IED_DSL_CODES.NOT_OBJECT, `${prefix} must be an object`, prefix);
        return;
      }
      if (typeof edge.source !== 'string' || !edge.source.trim() || !ids.has(edge.source)) {
        fail(IED_DSL_CODES.EDGE_ENDPOINT_UNKNOWN, `${prefix}.source must reference an existing node id`, prefix);
      }
      if (typeof edge.target !== 'string' || !edge.target.trim() || !ids.has(edge.target)) {
        fail(IED_DSL_CODES.EDGE_ENDPOINT_UNKNOWN, `${prefix}.target must reference an existing node id`, prefix);
      }
      const flowType = edge.type !== undefined ? edge.type : edge.flowType;
      if (flowType !== undefined && BPMN_FLOW_TYPES.indexOf(flowType) === -1) {
        fail(IED_DSL_CODES.FIELD_ENUM, `${prefix}.type must be one of ${BPMN_FLOW_TYPES.join('/')}`, prefix);
      }
      if (edge.label !== undefined && typeof edge.label !== 'string') {
        fail(IED_DSL_CODES.FIELD_TYPE, `${prefix}.label must be a string when present`, prefix);
      }
      if (edge.condition !== undefined && typeof edge.condition !== 'string') {
        fail(IED_DSL_CODES.FIELD_TYPE, `${prefix}.condition must be a string when present`, prefix);
      }
      if (edge.linkShape !== undefined && edge.linkShape !== 'visio' && edge.linkShape !== 'bezier') {
        fail(IED_DSL_CODES.FIELD_ENUM, `${prefix}.linkShape must be "visio" or "bezier" when present`, prefix);
      }
    });
  }
  return { valid: errors.length === 0, errors, diagnostics };
}

/** 流程图文档校验：结构 + 端点必须指向已存在的节点（与 ER 的关系校验同一口径） */
export function validateFlowDsl(dsl: DslFlowDocument): DslValidationResult {
  const errors: string[] = [];
  /**
   * 记一条错误：`errors` 保持原来的英文句子（兼容既有调用方）；
   * `diagnostics` 带稳定码与位置（Agent / 工具据此分支，不要去匹配 message）。
   */
  const diagnostics: IedDslDiagnostic[] = [];
  const fail = (code: string, message: string, path?: string) => {
    errors.push(message);
    diagnostics.push({ severity: 'error', code, message, path });
  };
  if (!dsl || typeof dsl !== 'object' || Array.isArray(dsl)) {
    fail(IED_DSL_CODES.ROOT_NOT_OBJECT, 'DSL root must be an object');
    return { valid: false, errors, diagnostics };
  }
  if (dsl.schemaVersion !== undefined && dsl.schemaVersion !== DSL_SCHEMA_VERSION) {
    fail(IED_DSL_CODES.SCHEMA_VERSION_UNSUPPORTED, `Unsupported schemaVersion: ${dsl.schemaVersion}`);
  }

  const ids = new Set<string>();
  if (!Array.isArray(dsl.nodes)) {
    fail(IED_DSL_CODES.NODES_NOT_ARRAY, 'nodes must be an array');
  } else {
    dsl.nodes.forEach((node, index) => {
      const prefix = `nodes[${index}]`;
      if (!node || typeof node !== 'object') {
        fail(IED_DSL_CODES.NOT_OBJECT, `${prefix} must be an object`, prefix);
        return;
      }
      if (typeof node.id !== 'string' || !node.id.trim()) {
        fail(IED_DSL_CODES.ID_INVALID, `${prefix}.id must be a non-empty string`, prefix);
      } else if (ids.has(node.id)) {
        fail(IED_DSL_CODES.ID_DUPLICATED, `${prefix}.id is duplicated: ${node.id}`, prefix);
      } else {
        ids.add(node.id);
      }
      if (node.kind !== undefined && FLOW_NODE_KINDS.indexOf(node.kind) === -1) {
        fail(IED_DSL_CODES.KIND_INVALID, `${prefix}.kind must be one of ${FLOW_NODE_KINDS.join('/')}`, prefix);
      }
      ['left', 'top', 'width', 'height'].forEach((key) => {
        const value = (node as any)[key];
        if (value !== undefined && typeof value !== 'number') {
          fail(IED_DSL_CODES.FIELD_TYPE, `${prefix}.${key} must be a number when present`, prefix);
        }
      });
    });
  }

  if (dsl.edges !== undefined && !Array.isArray(dsl.edges)) {
    fail(IED_DSL_CODES.EDGES_NOT_ARRAY, 'edges must be an array when present');
  } else {
    (dsl.edges || []).forEach((edge, index) => {
      const prefix = `edges[${index}]`;
      if (!edge || typeof edge !== 'object') {
        fail(IED_DSL_CODES.NOT_OBJECT, `${prefix} must be an object`, prefix);
        return;
      }
      if (typeof edge.source !== 'string' || !edge.source.trim() || !ids.has(edge.source)) {
        fail(IED_DSL_CODES.EDGE_ENDPOINT_UNKNOWN, `${prefix}.source must reference an existing node id`, prefix);
      }
      if (typeof edge.target !== 'string' || !edge.target.trim() || !ids.has(edge.target)) {
        fail(IED_DSL_CODES.EDGE_ENDPOINT_UNKNOWN, `${prefix}.target must reference an existing node id`, prefix);
      }
      if (edge.label !== undefined && typeof edge.label !== 'string') {
        fail(IED_DSL_CODES.FIELD_TYPE, `${prefix}.label must be a string when present`, prefix);
      }
      if (edge.sourcePort !== undefined && FLOW_PORTS.indexOf(edge.sourcePort) === -1) {
        fail(IED_DSL_CODES.FIELD_ENUM, `${prefix}.sourcePort must be one of ${FLOW_PORTS.join('/')}`, prefix);
      }
      if (edge.targetPort !== undefined && FLOW_PORTS.indexOf(edge.targetPort) === -1) {
        fail(IED_DSL_CODES.FIELD_ENUM, `${prefix}.targetPort must be one of ${FLOW_PORTS.join('/')}`, prefix);
      }
      if (edge.linkShape !== undefined && edge.linkShape !== 'visio' && edge.linkShape !== 'bezier') {
        fail(IED_DSL_CODES.FIELD_ENUM, `${prefix}.linkShape must be "visio" or "bezier" when present`, prefix);
      }
    });
  }
  return { valid: errors.length === 0, errors, diagnostics };
}

/**
 * UML 文档校验：结构 + 词汇表 + 端点存在。
 *
 * 语义检查（重名类、继承成环等）交给 `UmlDesigner.validateUml()` —— 与 BPMN 同一分工：
 * 结构在 DSL 侧、语义在设计师侧，不重复实现。
 */
export function validateUmlDsl(dsl: DslUmlDocument): DslValidationResult {
  const errors: string[] = [];
  /**
   * 记一条错误：`errors` 保持原来的英文句子（兼容既有调用方）；
   * `diagnostics` 带稳定码与位置（Agent / 工具据此分支，不要去匹配 message）。
   */
  const diagnostics: IedDslDiagnostic[] = [];
  const fail = (code: string, message: string, path?: string) => {
    errors.push(message);
    diagnostics.push({ severity: 'error', code, message, path });
  };
  if (!dsl || typeof dsl !== 'object' || Array.isArray(dsl)) {
    fail(IED_DSL_CODES.ROOT_NOT_OBJECT, 'DSL root must be an object');
    return { valid: false, errors, diagnostics };
  }
  if (dsl.schemaVersion !== undefined && dsl.schemaVersion !== DSL_SCHEMA_VERSION) {
    fail(IED_DSL_CODES.SCHEMA_VERSION_UNSUPPORTED, `Unsupported schemaVersion: ${dsl.schemaVersion}`);
  }

  const ids = new Set<string>();
  if (!Array.isArray(dsl.nodes)) {
    fail(IED_DSL_CODES.NODES_NOT_ARRAY, 'nodes must be an array');
  } else {
    dsl.nodes.forEach((node, index) => {
      const prefix = `nodes[${index}]`;
      if (!node || typeof node !== 'object') {
        fail(IED_DSL_CODES.NOT_OBJECT, `${prefix} must be an object`, prefix);
        return;
      }
      if (typeof node.id !== 'string' || !node.id.trim()) {
        fail(IED_DSL_CODES.ID_INVALID, `${prefix}.id must be a non-empty string`, prefix);
      } else if (ids.has(node.id)) {
        fail(IED_DSL_CODES.ID_DUPLICATED, `${prefix}.id is duplicated: ${node.id}`, prefix);
      } else {
        ids.add(node.id);
      }
      if (node.kind !== undefined && UML_NODE_KINDS.indexOf(node.kind) === -1) {
        fail(IED_DSL_CODES.KIND_INVALID, `${prefix}.kind must be one of ${UML_NODE_KINDS.join('/')}`, prefix);
      }
      ['attributes', 'methods'].forEach((key) => {
        const value = (node as any)[key];
        if (value === undefined) {
          return;
        }
        if (!Array.isArray(value) || value.some((item: any) => typeof item !== 'string')) {
          fail(IED_DSL_CODES.FIELD_TYPE, `${prefix}.${key} must be an array of strings when present`, prefix);
        }
      });
      ['left', 'top', 'width', 'height'].forEach((key) => {
        const value = (node as any)[key];
        if (value !== undefined && typeof value !== 'number') {
          fail(IED_DSL_CODES.FIELD_TYPE, `${prefix}.${key} must be a number when present`, prefix);
        }
      });
    });
  }

  if (dsl.edges !== undefined && !Array.isArray(dsl.edges)) {
    fail(IED_DSL_CODES.EDGES_NOT_ARRAY, 'edges must be an array when present');
  } else {
    (dsl.edges || []).forEach((edge, index) => {
      const prefix = `edges[${index}]`;
      if (!edge || typeof edge !== 'object') {
        fail(IED_DSL_CODES.NOT_OBJECT, `${prefix} must be an object`, prefix);
        return;
      }
      if (typeof edge.source !== 'string' || !edge.source.trim() || !ids.has(edge.source)) {
        fail(IED_DSL_CODES.EDGE_ENDPOINT_UNKNOWN, `${prefix}.source must reference an existing node id`, prefix);
      }
      if (typeof edge.target !== 'string' || !edge.target.trim() || !ids.has(edge.target)) {
        fail(IED_DSL_CODES.EDGE_ENDPOINT_UNKNOWN, `${prefix}.target must reference an existing node id`, prefix);
      }
      const relationType = edge.type !== undefined ? edge.type : edge.relation;
      if (relationType !== undefined && UML_RELATION_TYPES.indexOf(relationType) === -1) {
        fail(IED_DSL_CODES.FIELD_ENUM, `${prefix}.type must be one of ${UML_RELATION_TYPES.join('/')}`, prefix);
      }
      if (edge.label !== undefined && typeof edge.label !== 'string') {
        fail(IED_DSL_CODES.FIELD_TYPE, `${prefix}.label must be a string when present`, prefix);
      }
    });
  }
  return { valid: errors.length === 0, errors, diagnostics };
}

/**
 * 状态机文档校验：结构 + 词汇表 + 端点存在 + parent 合法性（子状态只能挂复合状态）。
 * 语义检查（初始状态、终态出边、可达性）交给 `StatechartDesigner.validateStatechart()`。
 */
export function validateStatechartDsl(dsl: DslStatechartDocument): DslValidationResult {
  const errors: string[] = [];
  /**
   * 记一条错误：`errors` 保持原来的英文句子（兼容既有调用方）；
   * `diagnostics` 带稳定码与位置（Agent / 工具据此分支，不要去匹配 message）。
   */
  const diagnostics: IedDslDiagnostic[] = [];
  const fail = (code: string, message: string, path?: string) => {
    errors.push(message);
    diagnostics.push({ severity: 'error', code, message, path });
  };
  if (!dsl || typeof dsl !== 'object' || Array.isArray(dsl)) {
    fail(IED_DSL_CODES.ROOT_NOT_OBJECT, 'DSL root must be an object');
    return { valid: false, errors, diagnostics };
  }
  if (dsl.schemaVersion !== undefined && dsl.schemaVersion !== DSL_SCHEMA_VERSION) {
    fail(IED_DSL_CODES.SCHEMA_VERSION_UNSUPPORTED, `Unsupported schemaVersion: ${dsl.schemaVersion}`);
  }

  const ids = new Set<string>();
  const kinds = new Map<string, string>();
  if (!Array.isArray(dsl.nodes)) {
    fail(IED_DSL_CODES.NODES_NOT_ARRAY, 'nodes must be an array');
  } else {
    dsl.nodes.forEach((node, index) => {
      const prefix = `nodes[${index}]`;
      if (!node || typeof node !== 'object') {
        fail(IED_DSL_CODES.NOT_OBJECT, `${prefix} must be an object`, prefix);
        return;
      }
      if (typeof node.id !== 'string' || !node.id.trim()) {
        fail(IED_DSL_CODES.ID_INVALID, `${prefix}.id must be a non-empty string`, prefix);
      } else if (ids.has(node.id)) {
        fail(IED_DSL_CODES.ID_DUPLICATED, `${prefix}.id is duplicated: ${node.id}`, prefix);
      } else {
        ids.add(node.id);
        kinds.set(node.id, node.kind || 'state');
      }
      if (node.kind !== undefined && STATECHART_NODE_KINDS.indexOf(node.kind) === -1) {
        fail(IED_DSL_CODES.KIND_INVALID, `${prefix}.kind must be one of ${STATECHART_NODE_KINDS.join('/')}`, prefix);
      }
      ['left', 'top', 'width', 'height'].forEach((key) => {
        const value = (node as any)[key];
        if (value !== undefined && typeof value !== 'number') {
          fail(IED_DSL_CODES.FIELD_TYPE, `${prefix}.${key} must be a number when present`, prefix);
        }
      });
    });
    dsl.nodes.forEach((node, index) => {
      if (!node || typeof node !== 'object' || node.parent === undefined) {
        return;
      }
      const prefix = `nodes[${index}]`;
      if (typeof node.parent !== 'string' || !node.parent.trim() || !ids.has(node.parent)) {
        fail(IED_DSL_CODES.PARENT_UNKNOWN, `${prefix}.parent must reference an existing node id`, prefix);
        return;
      }
      if (node.parent === node.id) {
        fail(IED_DSL_CODES.PARENT_SELF, `${prefix}.parent must not reference itself`, prefix);
        return;
      }
      if (kinds.get(node.parent) !== 'composite') {
        fail(IED_DSL_CODES.PARENT_KIND, `${prefix}.parent must reference a composite state`, prefix);
      }
    });
  }

  if (dsl.edges !== undefined && !Array.isArray(dsl.edges)) {
    fail(IED_DSL_CODES.EDGES_NOT_ARRAY, 'edges must be an array when present');
  } else {
    (dsl.edges || []).forEach((edge, index) => {
      const prefix = `edges[${index}]`;
      if (!edge || typeof edge !== 'object') {
        fail(IED_DSL_CODES.NOT_OBJECT, `${prefix} must be an object`, prefix);
        return;
      }
      if (typeof edge.source !== 'string' || !edge.source.trim() || !ids.has(edge.source)) {
        fail(IED_DSL_CODES.EDGE_ENDPOINT_UNKNOWN, `${prefix}.source must reference an existing node id`, prefix);
      }
      if (typeof edge.target !== 'string' || !edge.target.trim() || !ids.has(edge.target)) {
        fail(IED_DSL_CODES.EDGE_ENDPOINT_UNKNOWN, `${prefix}.target must reference an existing node id`, prefix);
      }
      ['event', 'guard', 'action', 'label'].forEach((key) => {
        const value = (edge as any)[key];
        if (value !== undefined && typeof value !== 'string') {
          fail(IED_DSL_CODES.FIELD_TYPE, `${prefix}.${key} must be a string when present`, prefix);
        }
      });
    });
  }
  return { valid: errors.length === 0, errors, diagnostics };
}

/**
 * 甘特文档校验：结构 + 日期格式 + 数值范围 + 依赖端点。
 *
 * 语义检查（依赖成环等）交给 `GanttDesigner.validateGantt()`。
 */
export function validateGanttDsl(dsl: DslGanttDocument): DslValidationResult {
  const errors: string[] = [];
  /**
   * 记一条错误：`errors` 保持原来的英文句子（兼容既有调用方）；
   * `diagnostics` 带稳定码与位置（Agent / 工具据此分支，不要去匹配 message）。
   */
  const diagnostics: IedDslDiagnostic[] = [];
  const fail = (code: string, message: string, path?: string) => {
    errors.push(message);
    diagnostics.push({ severity: 'error', code, message, path });
  };
  if (!dsl || typeof dsl !== 'object' || Array.isArray(dsl)) {
    fail(IED_DSL_CODES.ROOT_NOT_OBJECT, 'DSL root must be an object');
    return { valid: false, errors, diagnostics };
  }
  if (dsl.schemaVersion !== undefined && dsl.schemaVersion !== DSL_SCHEMA_VERSION) {
    fail(IED_DSL_CODES.SCHEMA_VERSION_UNSUPPORTED, `Unsupported schemaVersion: ${dsl.schemaVersion}`);
  }

  const ids = new Set<string>();
  if (!Array.isArray(dsl.nodes)) {
    fail(IED_DSL_CODES.NODES_NOT_ARRAY, 'nodes must be an array');
  } else {
    dsl.nodes.forEach((task, index) => {
      const prefix = `nodes[${index}]`;
      if (!task || typeof task !== 'object') {
        fail(IED_DSL_CODES.NOT_OBJECT, `${prefix} must be an object`, prefix);
        return;
      }
      if (typeof task.id !== 'string' || !task.id.trim()) {
        fail(IED_DSL_CODES.ID_INVALID, `${prefix}.id must be a non-empty string`, prefix);
      } else if (ids.has(task.id)) {
        fail(IED_DSL_CODES.ID_DUPLICATED, `${prefix}.id is duplicated: ${task.id}`, prefix);
      } else {
        ids.add(task.id);
      }
      if (typeof task.start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(task.start)) {
        fail(IED_DSL_CODES.FIELD_FORMAT, `${prefix}.start must be a "YYYY-MM-DD" string`, prefix);
      }
      if (task.days !== undefined && !(Number(task.days) >= 1)) {
        fail(IED_DSL_CODES.FIELD_RANGE, `${prefix}.days must be a number >= 1 when present`, prefix);
      }
      if (task.progress !== undefined) {
        const progress = Number(task.progress);
        if (!(progress >= 0 && progress <= 1)) {
          fail(IED_DSL_CODES.FIELD_RANGE, `${prefix}.progress must be between 0 and 1 when present`, prefix);
        }
      }
      if (task.row !== undefined && !(Number(task.row) >= 0)) {
        fail(IED_DSL_CODES.FIELD_RANGE, `${prefix}.row must be a number >= 0 when present`, prefix);
      }
    });
  }

  if (dsl.edges !== undefined && !Array.isArray(dsl.edges)) {
    fail(IED_DSL_CODES.EDGES_NOT_ARRAY, 'edges must be an array when present');
  } else {
    (dsl.edges || []).forEach((edge, index) => {
      const prefix = `edges[${index}]`;
      if (!edge || typeof edge !== 'object') {
        fail(IED_DSL_CODES.NOT_OBJECT, `${prefix} must be an object`, prefix);
        return;
      }
      if (typeof edge.source !== 'string' || !edge.source.trim() || !ids.has(edge.source)) {
        fail(IED_DSL_CODES.EDGE_ENDPOINT_UNKNOWN, `${prefix}.source must reference an existing task id`, prefix);
      }
      if (typeof edge.target !== 'string' || !edge.target.trim() || !ids.has(edge.target)) {
        fail(IED_DSL_CODES.EDGE_ENDPOINT_UNKNOWN, `${prefix}.target must reference an existing task id`, prefix);
      }
    });
  }
  return { valid: errors.length === 0, errors, diagnostics };
}

/** ER 文档校验（原有实现，保持不变） */
function validateErDsl(dsl: any): DslValidationResult {
  const errors: string[] = [];
  /**
   * 记一条错误：`errors` 保持原来的英文句子（兼容既有调用方）；
   * `diagnostics` 带稳定码与位置（Agent / 工具据此分支，不要去匹配 message）。
   */
  const diagnostics: IedDslDiagnostic[] = [];
  const fail = (code: string, message: string, path?: string) => {
    errors.push(message);
    diagnostics.push({ severity: 'error', code, message, path });
  };
  if (!dsl || typeof dsl !== 'object' || Array.isArray(dsl)) {
    fail(IED_DSL_CODES.ROOT_NOT_OBJECT, 'DSL root must be an object');
    return { valid: false, errors, diagnostics };
  }
  if (dsl.schemaVersion !== undefined && dsl.schemaVersion !== DSL_SCHEMA_VERSION) {
    fail(IED_DSL_CODES.SCHEMA_VERSION_UNSUPPORTED, `Unsupported schemaVersion: ${dsl.schemaVersion}`);
  }
  if (!Array.isArray(dsl.entities)) {
    fail(IED_DSL_CODES.ENTITIES_NOT_ARRAY, 'entities must be an array');
  } else {
    const ids = new Set<string>();
    dsl.entities.forEach((entity, index) => {
      const prefix = `entities[${index}]`;
      if (!entity || typeof entity !== 'object') {
        fail(IED_DSL_CODES.NOT_OBJECT, `${prefix} must be an object`, prefix);
        return;
      }
      if (typeof entity.id !== 'string' || !entity.id.trim()) {
        fail(IED_DSL_CODES.ID_INVALID, `${prefix}.id must be a non-empty string`, prefix);
      } else if (ids.has(entity.id)) {
        fail(IED_DSL_CODES.ID_DUPLICATED, `${prefix}.id is duplicated: ${entity.id}`, prefix);
      } else {
        ids.add(entity.id);
      }
      if (!Array.isArray(entity.fields)) {
        fail(IED_DSL_CODES.FIELDS_NOT_ARRAY, `${prefix}.fields must be an array`, prefix);
      } else {
        entity.fields.forEach((field, fieldIndex) => {
          if (!field || typeof field !== 'object' || typeof field.name !== 'string' || !field.name.trim()) {
            fail(IED_DSL_CODES.FIELD_NAME_INVALID, `${prefix}.fields[${fieldIndex}].name must be a non-empty string`, prefix);
          }
        });
      }
    });
  }
  if (dsl.relations !== undefined && !Array.isArray(dsl.relations)) {
    fail(IED_DSL_CODES.RELATIONS_NOT_ARRAY, 'relations must be an array');
  } else {
    (dsl.relations || []).forEach((relation, index) => {
      const prefix = `relations[${index}]`;
      if (!relation || typeof relation !== 'object') {
        fail(IED_DSL_CODES.NOT_OBJECT, `${prefix} must be an object`, prefix);
      } else {
        if (typeof relation.source !== 'string' || !relation.source.trim()) {
          fail(IED_DSL_CODES.EDGE_ENDPOINT_INVALID, `${prefix}.source must be a non-empty string`, prefix);
        }
        if (typeof relation.target !== 'string' || !relation.target.trim()) {
          fail(IED_DSL_CODES.EDGE_ENDPOINT_INVALID, `${prefix}.target must be a non-empty string`, prefix);
        }
      }
    });
  }
  return { valid: errors.length === 0, errors, diagnostics };
}

/**
 * 电力一次系统图文档的结构校验（语义校验在 designer：`validatePower()`）。
 *
 * 这里只查「结构」：id 唯一、kind 合法、端点存在、母线 T 接指向母线、电压等级格式。
 * 电压等级一致性、母线进线、五防这些**语义**规则属于设计器（`renderPowerDsl` 返回的 designer）。
 */
export function validatePowerDsl(dsl: DslPowerDocument): DslValidationResult {
  const errors: string[] = [];
  /**
   * 记一条错误：`errors` 保持原来的英文句子（兼容既有调用方）；
   * `diagnostics` 带稳定码与位置（Agent / 工具据此分支，不要去匹配 message）。
   */
  const diagnostics: IedDslDiagnostic[] = [];
  const fail = (code: string, message: string, path?: string) => {
    errors.push(message);
    diagnostics.push({ severity: 'error', code, message, path });
  };
  const nodes = Array.isArray(dsl.nodes) ? dsl.nodes : [];
  if (!Array.isArray(dsl.nodes)) {
    fail(IED_DSL_CODES.NODES_NOT_ARRAY, 'nodes must be an array');
  }
  const ids = new Set<string>();
  nodes.forEach((node: any, index: number) => {
    const prefix = `nodes[${index}]`;
    if (!node || typeof node !== 'object') {
      fail(IED_DSL_CODES.NOT_OBJECT, `${prefix} must be an object`, prefix);
      return;
    }
    if (typeof node.id !== 'string' || !node.id) {
      fail(IED_DSL_CODES.ID_INVALID, `${prefix}.id must be a non-empty string`, prefix);
    } else if (ids.has(node.id)) {
      fail(IED_DSL_CODES.ID_DUPLICATED, `duplicated node id: ${node.id}`);
    } else {
      ids.add(node.id);
    }
    if (POWER_DSL_KINDS.indexOf(node.kind) === -1) {
      fail(IED_DSL_CODES.KIND_INVALID, `${prefix}.kind must be one of ${POWER_DSL_KINDS.join(' / ')}`, prefix);
    }
    if (node.voltageLevel !== undefined && !/^\d+(\.\d+)?kV$/.test(String(node.voltageLevel))) {
      fail(IED_DSL_CODES.FIELD_FORMAT, `${prefix}.voltageLevel must look like "110kV"`, prefix);
    }
  });
  nodes.forEach((node: any, index: number) => {
    if (!node || node.attachedTo === undefined) {
      return;
    }
    const bus = nodes.find((item: any) => item && item.id === node.attachedTo);
    if (!bus) {
      fail(IED_DSL_CODES.ATTACHED_TO_UNKNOWN, `nodes[${index}].attachedTo references an unknown node: ${node.attachedTo}`);
      return;
    }
    if (bus.kind !== 'busbar') {
      fail(IED_DSL_CODES.ATTACHED_TO_NOT_BUSBAR, `nodes[${index}].attachedTo must point at a busbar: ${node.attachedTo} is ${bus.kind}`);
    }
  });
  (dsl.edges || []).forEach((edge: any, index: number) => {
    const prefix = `edges[${index}]`;
    if (!edge || typeof edge !== 'object') {
      fail(IED_DSL_CODES.NOT_OBJECT, `${prefix} must be an object`, prefix);
      return;
    }
    if (!ids.has(edge.source)) {
      fail(IED_DSL_CODES.EDGE_ENDPOINT_UNKNOWN, `${prefix}.source references an unknown node: ${edge.source}`, prefix);
    }
    if (!ids.has(edge.target)) {
      fail(IED_DSL_CODES.EDGE_ENDPOINT_UNKNOWN, `${prefix}.target references an unknown node: ${edge.target}`, prefix);
    }
    if (edge.source === edge.target) {
      fail(IED_DSL_CODES.EDGE_SELF_LOOP, `${prefix} must not connect a node to itself`, prefix);
    }
  });
  return { valid: errors.length === 0, errors, diagnostics };
}
