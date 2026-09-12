/**
 * 实例 → DSL：把「可编辑的工程产物」写回成**同一份 DSL 文档**。
 *
 * 与 compiler/* 正好相反 —— compiler 读什么字段，这里就写什么字段。这样 Agent 产出的
 * 文档在被用户编辑（拖动 / 改名 / 分合 / 增删）之后，仍然能原样读回来继续迭代，
 * 而不是掉进引擎私有的场景快照格式。
 *
 * 三条约定：
 * 1. **只导出 DSL 词汇表里的字段**（引擎内部字段如 zIndex / 矩阵一律不外泄）；
 * 2. **坐标一律导出绝对位置**：子组件的 `left/top` 是相对父容器的，这里沿 `parentNode`
 *    链求和还原成文档口径的绝对坐标，用户拖过的位置不会丢；
 * 3. 值为 `undefined` 的键不出现（导出的文档必须能 `JSON.parse(JSON.stringify(doc))` 无损往返）。
 */
import { POWER_DSL_KINDS } from '../types';
import type { DslDocument } from '../types';
import { DSL_SCHEMA_VERSION } from '../validate';

/** 组件 kind → DSL kind（BPMN 是唯一需要反查的：`bpmnTask` ↔ `task`） */
const BPMN_DSL_KIND: Record<string, string> = {
  bpmnPool: 'pool',
  bpmnLane: 'lane',
  bpmnTask: 'task',
  bpmnEvent: 'event',
  bpmnGateway: 'gateway',
  bpmnSubprocess: 'subprocess',
  bpmnDataObject: 'dataObject',
  bpmnAnnotation: 'annotation',
};

const FLOW_KINDS = ['terminator', 'process', 'decision', 'io'];
const UML_KINDS = ['class', 'interface', 'enum'];
const STATECHART_KINDS = ['initial', 'final', 'state', 'composite'];

type DesignerLike = any;

function stateOf(component: any): any {
  return (component && component.state) || {};
}

function linkOf(edgeState: any, end: 'start' | 'end'): { id?: string; position?: string } {
  const links = edgeState.links;
  return (links && links[end]) || {};
}

/** 沿 `parentNode` 链把相对坐标累加成文档口径的绝对坐标 */
function absolutePosition(component: any): { left: number; top: number } {
  let left = 0;
  let top = 0;
  let cursor = component;
  while (cursor && cursor.state && typeof cursor.state.left === 'number') {
    left += cursor.state.left || 0;
    top += cursor.state.top || 0;
    cursor = cursor.parentNode;
  }
  return { left: Math.round(left), top: Math.round(top) };
}

function parentIdOf(component: any): string | undefined {
  const parent = component && component.parentNode;
  const id = parent && parent.state ? parent.state.id : undefined;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

function numberOf(value: any): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function textOf(value: any): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** 去掉 undefined 的键（浅层足够：这里所有值都是原始值或数组） */
function clean<T extends Record<string, any>>(input: T): T {
  const output: any = {};
  Object.keys(input).forEach((key) => {
    if (input[key] !== undefined) {
      output[key] = input[key];
    }
  });
  return output;
}

function nodesOf(designer: DesignerLike): any[] {
  return designer && Array.isArray(designer.nodes) ? designer.nodes : [];
}

function edgesOf(designer: DesignerLike): any[] {
  return designer && Array.isArray(designer.edges) ? designer.edges : [];
}

function baseOf(component: any): Record<string, any> {
  const state = stateOf(component);
  const position = absolutePosition(component);
  return {
    id: state.id,
    title: textOf(state.title),
    left: position.left,
    top: position.top,
  };
}

function exportFlow(designer: DesignerLike): any {
  return {
    schemaVersion: DSL_SCHEMA_VERSION,
    kind: 'flowchart',
    nodes: nodesOf(designer).map((node) => {
      const state = stateOf(node);
      return clean({
        ...baseOf(node),
        kind: state.kind,
        width: numberOf(state.width),
        height: numberOf(state.height),
        fillColor: textOf(state.fillColor),
        strokeColor: textOf(state.strokeColor),
      });
    }),
    edges: edgesOf(designer).map((edge) => {
      const state = stateOf(edge);
      const start = linkOf(state, 'start');
      const end = linkOf(state, 'end');
      return clean({
        id: state.id,
        source: start.id,
        target: end.id,
        sourcePort: start.position,
        targetPort: end.position,
        label: textOf(state.label) || '',
        linkShape: textOf(state.linkShape),
      });
    }),
  };
}

function exportEr(designer: DesignerLike): any {
  const entities = designer && Array.isArray(designer.entities) ? designer.entities : [];
  const relations = designer && Array.isArray(designer.relations) ? designer.relations : [];
  return {
    schemaVersion: DSL_SCHEMA_VERSION,
    entities: entities.map((entity) => {
      const state = stateOf(entity);
      const position = absolutePosition(entity);
      return clean({
        id: state.id,
        name: textOf(state.entityName),
        fields: Array.isArray(state.fields) ? state.fields : [],
        left: position.left,
        top: position.top,
      });
    }),
    relations: relations.map((relation) => {
      const state = stateOf(relation);
      const start = linkOf(state, 'start');
      const end = linkOf(state, 'end');
      return clean({
        id: state.id,
        source: start.id,
        target: end.id,
        type: state.relationType,
        sourceField: textOf(state.sourceField),
        targetField: textOf(state.targetField),
        label: textOf(state.label),
        onDelete: textOf(state.onDelete),
        onUpdate: textOf(state.onUpdate),
        joinTableName: textOf(state.joinTableName),
        nullable: typeof state.nullable === 'boolean' ? state.nullable : undefined,
        sourceCardinality: textOf(state.sourceCardinality),
        targetCardinality: textOf(state.targetCardinality),
        linkShape: textOf(state.linkShape),
      });
    }),
  };
}

function exportBpmn(designer: DesignerLike): any {
  return {
    schemaVersion: DSL_SCHEMA_VERSION,
    kind: 'bpmn',
    nodes: nodesOf(designer).map((node) => {
      const state = stateOf(node);
      return clean({
        ...baseOf(node),
        kind: BPMN_DSL_KIND[state.kind] || 'task',
        parent: parentIdOf(node),
        width: numberOf(state.width),
        height: numberOf(state.height),
        eventKind: textOf(state.eventKind),
        trigger: textOf(state.trigger),
        gatewayType: textOf(state.gatewayType),
        taskType: textOf(state.taskType),
        fillColor: textOf(state.fillColor),
        strokeColor: textOf(state.strokeColor),
      });
    }),
    edges: edgesOf(designer).map((edge) => {
      const state = stateOf(edge);
      const start = linkOf(state, 'start');
      const end = linkOf(state, 'end');
      return clean({
        id: state.id,
        source: start.id,
        target: end.id,
        type: textOf(state.flowType) || 'sequence',
        label: textOf(state.label),
        condition: textOf(state.condition),
        isDefault: state.isDefault === true ? true : undefined,
        linkShape: textOf(state.linkShape),
      });
    }),
  };
}

function exportUml(designer: DesignerLike): any {
  return {
    schemaVersion: DSL_SCHEMA_VERSION,
    kind: 'uml',
    nodes: nodesOf(designer).map((node) => {
      const state = stateOf(node);
      return clean({
        ...baseOf(node),
        kind: textOf(state.kind) || 'class',
        title: textOf(state.className) || textOf(state.title),
        abstract: state.abstract === true ? true : undefined,
        attributes: Array.isArray(state.attributes) ? state.attributes.map((item: any) => String(item)) : [],
        methods: Array.isArray(state.methods) ? state.methods.map((item: any) => String(item)) : [],
        width: numberOf(state.width),
        height: numberOf(state.height),
      });
    }),
    edges: edgesOf(designer).map((edge) => {
      const state = stateOf(edge);
      const start = linkOf(state, 'start');
      const end = linkOf(state, 'end');
      return clean({
        id: state.id,
        source: start.id,
        target: end.id,
        type: textOf(state.relationKind) || 'association',
        label: textOf(state.label),
      });
    }),
  };
}

function exportStatechart(designer: DesignerLike): any {
  return {
    schemaVersion: DSL_SCHEMA_VERSION,
    kind: 'statechart',
    nodes: nodesOf(designer).map((node) => {
      const state = stateOf(node);
      return clean({
        ...baseOf(node),
        kind: textOf(state.kind) || 'state',
        parent: parentIdOf(node),
        width: numberOf(state.width),
        height: numberOf(state.height),
      });
    }),
    edges: edgesOf(designer).map((edge) => {
      const state = stateOf(edge);
      const start = linkOf(state, 'start');
      const end = linkOf(state, 'end');
      return clean({
        id: state.id,
        source: start.id,
        target: end.id,
        event: textOf(state.event),
        guard: textOf(state.guard),
        action: textOf(state.action),
        label: textOf(state.label),
      });
    }),
  };
}

function exportGantt(designer: DesignerLike): any {
  return {
    schemaVersion: DSL_SCHEMA_VERSION,
    kind: 'gantt',
    // 甘特没有几何坐标：横轴是日期、纵轴是行号，导出时刻意不写 left/top
    nodes: nodesOf(designer).map((node) => {
      const state = stateOf(node);
      return clean({
        id: state.id,
        title: textOf(state.title),
        start: textOf(state.start),
        days: numberOf(state.days),
        progress: numberOf(state.progress),
        row: numberOf(state.row),
        resource: textOf(state.resource),
      });
    }),
    edges: edgesOf(designer).map((edge) => {
      const state = stateOf(edge);
      const start = linkOf(state, 'start');
      const end = linkOf(state, 'end');
      return clean({ id: state.id, source: start.id, target: end.id });
    }),
  };
}

function exportPower(designer: DesignerLike): any {
  return {
    schemaVersion: DSL_SCHEMA_VERSION,
    kind: 'power',
    nodes: nodesOf(designer).map((node) => {
      const state = stateOf(node);
      const position = absolutePosition(node);
      return clean({
        id: state.id,
        kind: state.kind,
        title: textOf(state.title) || textOf(state.name),
        voltageLevel: textOf(state.voltageLevel),
        left: position.left,
        top: position.top,
        width: numberOf(state.width),
        height: numberOf(state.height),
        switchState: textOf(state.switchState),
        // 「电源点」在组件上有两种落法：DSL 口径的 source，与拓扑计算用的 energizedSource
        source: state.source === true || state.energizedSource === true ? true : undefined,
        attachedTo: textOf(state.attachedBusId),
      });
    }),
    edges: edgesOf(designer).map((edge) => {
      const state = stateOf(edge);
      const start = linkOf(state, 'start');
      const end = linkOf(state, 'end');
      return clean({
        id: state.id,
        source: start.id,
        target: end.id,
        sourcePort: start.position,
        targetPort: end.position,
        voltageLevel: textOf(state.voltageLevel),
      });
    }),
  };
}

/** 按图元 kind / designer 形状推断文档类型（显式传 kind 时以显式为准） */
function detectKind(designer: DesignerLike): string {
  if (!designer) {
    return 'entity';
  }
  if (Array.isArray(designer.entities)) {
    return 'entity';
  }
  if (designer.originDate !== undefined || designer.dayWidth !== undefined) {
    return 'gantt';
  }
  const first = nodesOf(designer)[0];
  const kind = first ? String(stateOf(first).kind || '') : '';
  if (kind.startsWith('bpmn')) return 'bpmn';
  if (UML_KINDS.indexOf(kind) >= 0) return 'uml';
  if (STATECHART_KINDS.indexOf(kind) >= 0) return 'statechart';
  if ((POWER_DSL_KINDS as readonly string[]).indexOf(kind) >= 0) return 'power';
  if (FLOW_KINDS.indexOf(kind) >= 0) return 'flowchart';
  return 'entity';
}

/**
 * 把可编辑实例写回 DSL 文档。
 *
 * @param input `renderDsl()` 的返回值，或任意 designer 实例
 * @param options `{ kind }` 强制指定文档类型（推断不出来时用）
 */
export function toDsl(input: any, options: { kind?: string } = {}): DslDocument {
  const designer: DesignerLike = input && input.designer ? input.designer : input;
  const kind = options.kind || (input && input.kind) || detectKind(designer);
  switch (kind) {
    case 'flowchart':
      return exportFlow(designer) as DslDocument;
    case 'bpmn':
      return exportBpmn(designer) as DslDocument;
    case 'uml':
      return exportUml(designer) as DslDocument;
    case 'statechart':
      return exportStatechart(designer) as DslDocument;
    case 'gantt':
      return exportGantt(designer) as DslDocument;
    case 'power':
      return exportPower(designer) as DslDocument;
    case 'entity':
    case 'er':
    default:
      return exportEr(designer) as DslDocument;
  }
}
